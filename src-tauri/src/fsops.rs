use crate::error::CmdError;
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Serialize, Clone)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: i64,
    pub created_ms: i64,
    pub is_hidden: bool,
}

#[derive(Serialize, Clone)]
pub struct DeviceEntry {
    pub label: String,
    pub path: String,
}

fn to_ms(t: std::io::Result<std::time::SystemTime>) -> i64 {
    t.ok()
        .and_then(|v| v.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn entry_from_path(path: &Path) -> Option<FsEntry> {
    let meta = fs::metadata(path).ok()?;
    let name = path.file_name()?.to_string_lossy().to_string();
    Some(FsEntry {
        name: name.clone(),
        path: path.to_string_lossy().to_string(),
        is_dir: meta.is_dir(),
        size: if meta.is_dir() { 0 } else { meta.len() },
        modified_ms: to_ms(meta.modified()),
        created_ms: to_ms(meta.created()),
        is_hidden: name.starts_with('.'),
    })
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<FsEntry>, CmdError> {
    let dir = fs::read_dir(&path)?;
    let mut out = vec![];
    for item in dir {
        let item = item?;
        if let Some(entry) = entry_from_path(&item.path()) {
            out.push(entry);
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn stat_path(path: String) -> Result<FsEntry, CmdError> {
    entry_from_path(Path::new(&path)).ok_or_else(|| CmdError::new("gone", format!("Not found: {path}")))
}

#[tauri::command]
pub fn home_dir() -> Result<String, CmdError> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| CmdError::new("internal", "Could not determine the home directory"))
}

/// Rejects name parameters that could escape the directory they're joined onto.
/// Every IPC command that takes a bare file/folder name (as opposed to a full path)
/// must call this before joining it — the UI only ever sends plain names, so anything
/// with a separator or `..` in it is a forged `invoke()` call, not a user action.
pub(crate) fn validate_name(name: &str) -> Result<(), CmdError> {
    if name.is_empty() || name == "." || name == ".." {
        return Err(CmdError::new("invalid_name", format!("Invalid name: {name:?}")));
    }
    if name.contains('/') || name.contains('\\') || name.contains('\0') {
        return Err(CmdError::new("invalid_name", "Names cannot contain path separators"));
    }
    Ok(())
}

fn already_exists() -> CmdError {
    CmdError::new("already_exists", "A file or folder with that name already exists")
}

#[tauri::command]
pub fn create_folder(parent: String, name: String) -> Result<String, CmdError> {
    validate_name(&name)?;
    let target = PathBuf::from(&parent).join(&name);
    fs::create_dir(&target)?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_file(parent: String, name: String, contents: String) -> Result<String, CmdError> {
    validate_name(&name)?;
    let target = PathBuf::from(&parent).join(&name);
    fs::write(&target, contents)?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn rename_path(from: String, to_name: String) -> Result<String, CmdError> {
    validate_name(&to_name)?;
    let from_path = PathBuf::from(&from);
    let parent = from_path
        .parent()
        .ok_or_else(|| CmdError::new("invalid_path", format!("No parent directory: {from}")))?;
    let target = parent.join(&to_name);
    if target != from_path && fs::symlink_metadata(&target).is_ok() {
        return Err(already_exists());
    }
    fs::rename(&from_path, &target)?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn move_path(from: String, to_dir: String) -> Result<String, CmdError> {
    let from_path = PathBuf::from(&from);
    let name = from_path
        .file_name()
        .ok_or_else(|| CmdError::new("invalid_path", format!("Bad source path: {from}")))?;
    let target = PathBuf::from(&to_dir).join(name);
    if target != from_path && fs::symlink_metadata(&target).is_ok() {
        return Err(already_exists());
    }
    fs::rename(&from_path, &target)?;
    Ok(target.to_string_lossy().to_string())
}

fn copy_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let dest_path = dst.join(entry.file_name());
            if entry.file_type()?.is_dir() {
                copy_recursive(&entry.path(), &dest_path)?;
            } else {
                fs::copy(entry.path(), &dest_path)?;
            }
        }
    } else {
        fs::copy(src, dst)?;
    }
    Ok(())
}

#[tauri::command]
pub fn copy_path(from: String, to_dir: String, to_name: String) -> Result<String, CmdError> {
    validate_name(&to_name)?;
    let src = PathBuf::from(&from);
    let target = PathBuf::from(&to_dir).join(&to_name);
    copy_recursive(&src, &target)?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn extract_archive(path: String, dest_dir: String, folder_name: String) -> Result<String, CmdError> {
    validate_name(&folder_name)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(kind) = crate::archives::detect(&path) {
            crate::archives::extract(kind, &path, &dest_dir, &folder_name)
        } else {
            extract_zip(&path, &dest_dir, &folder_name)
        }
    })
    .await
    .map_err(|error| CmdError::new("internal", format!("Extraction failed: {error}")))?
}

// Extraction has no legitimate reason to write out more than this — it exists purely
// to bound how much disk a hostile archive (a "zip bomb": a tiny file that expands to
// an enormous one) can consume. Kept in sync with the matching constants in
// archives.rs for the non-ZIP formats.
const MAX_EXTRACT_ENTRIES: usize = 100_000;
const MAX_EXTRACT_TOTAL_BYTES: u64 = 10 * 1024 * 1024 * 1024;

fn extract_zip(path: &str, dest_dir: &str, folder_name: &str) -> Result<String, CmdError> {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension != "zip" {
        return Err(CmdError::new(
            "unsupported_archive",
            format!("{extension} archives are not supported yet; ZIP, TAR (plain/.gz/.bz2/.xz), and 7z can be extracted."),
        ));
    }

    let target_root = PathBuf::from(dest_dir).join(folder_name);
    if target_root.exists() {
        return Err(already_exists());
    }

    let file = fs::File::open(path).map_err(|error| CmdError::from(error).context("Could not open archive"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| CmdError::new("archive_damaged", format!("Could not read ZIP directory: {error}")))?;

    if archive.len() > MAX_EXTRACT_ENTRIES {
        return Err(CmdError::new(
            "archive_too_large",
            format!(
                "Archive has too many entries to extract ({} entries; the limit is {MAX_EXTRACT_ENTRIES})",
                archive.len()
            ),
        ));
    }

    fs::create_dir_all(&target_root)?;

    let mut remaining_budget = MAX_EXTRACT_TOTAL_BYTES;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| CmdError::new("archive_damaged", format!("Could not read ZIP entry {index}: {error}")))?;
        // enclosed_name() rejects absolute paths and ".." components, which is what
        // stops a hostile archive (zip-slip) from writing outside target_root.
        let enclosed = entry.enclosed_name().ok_or_else(|| {
            CmdError::new("unsafe_archive_path", format!("Refusing to extract unsafe entry path: {}", entry.name()))
        })?;
        let out_path = target_root.join(&enclosed);

        if entry.is_dir() {
            fs::create_dir_all(&out_path)?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut out_file = fs::File::create(&out_path)?;
            // Bounded by actual bytes written, not the entry's (attacker-controlled)
            // declared size, so a lying header can't smuggle a bomb past this check.
            let mut limited = (&mut entry).take(remaining_budget.saturating_add(1));
            let copied = std::io::copy(&mut limited, &mut out_file)?;
            if copied > remaining_budget {
                return Err(CmdError::new("archive_too_large", "Archive exceeds the maximum supported extraction size"));
            }
            remaining_budget -= copied;
        }
    }

    Ok(target_root.to_string_lossy().to_string())
}

fn app_trash_dir() -> Result<PathBuf, CmdError> {
    let base = dirs::data_dir().ok_or_else(|| CmdError::new("internal", "Could not determine the user data directory"))?;
    let dir = base.join("geyma").join("trash");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Soft-delete: move into Geyma's own recoverable trash folder (not the OS trash),
/// so the app can offer a first-class Trash view with reliable restore semantics.
#[tauri::command]
pub fn trash_path(path: String) -> Result<String, CmdError> {
    let src = PathBuf::from(&path);
    let name = src
        .file_name()
        .ok_or_else(|| CmdError::new("invalid_path", format!("Bad source path: {path}")))?;
    let trash_dir = app_trash_dir()?;
    let mut target = trash_dir.join(name);
    if target.exists() {
        let stamped = format!(
            "{}.{}",
            name.to_string_lossy(),
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        );
        target = trash_dir.join(stamped);
    }
    fs::rename(&src, &target)?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_path(trashed_path: String, to_dir: String) -> Result<String, CmdError> {
    move_path(trashed_path, to_dir)
}

#[tauri::command]
pub fn delete_permanently(path: String) -> Result<(), CmdError> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p)?;
    if meta.is_dir() {
        fs::remove_dir_all(&p)?;
    } else {
        fs::remove_file(&p)?;
    }
    Ok(())
}

#[tauri::command]
pub fn trash_dir_path() -> Result<String, CmdError> {
    app_trash_dir().map(|p| p.to_string_lossy().to_string())
}

#[derive(Serialize, Clone)]
pub struct DiskUsage {
    pub total: u64,
    pub available: u64,
}

#[tauri::command]
pub fn disk_usage(path: String) -> Result<DiskUsage, CmdError> {
    let p = Path::new(&path);
    let total = fs4::total_space(p)?;
    let available = fs4::available_space(p)?;
    Ok(DiskUsage { total, available })
}

#[derive(Serialize, Clone)]
pub struct PathPermissions {
    pub mode: u32,
    pub uid: u32,
    pub gid: u32,
    pub owner: String,
    pub group: String,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
}

/// /etc/passwd and /etc/group are plain colon-separated text on every Linux distro Geyma
/// targets, so a name lookup doesn't need a new dependency (there's no libc/users crate here).
#[cfg(unix)]
fn id_to_name(passwd_like_file: &str, id: u32) -> Option<String> {
    let content = fs::read_to_string(passwd_like_file).ok()?;
    content.lines().find_map(|line| {
        let fields: Vec<&str> = line.split(':').collect();
        let matches = fields.get(2).and_then(|v| v.parse::<u32>().ok()) == Some(id);
        matches.then(|| fields.first().map(|n| n.to_string())).flatten()
    })
}

#[tauri::command]
pub fn get_path_permissions(path: String) -> Result<PathPermissions, CmdError> {
    let p = Path::new(&path);
    let symlink_meta = fs::symlink_metadata(p)?;
    let is_symlink = symlink_meta.file_type().is_symlink();
    let symlink_target = if is_symlink {
        fs::read_link(p).ok().map(|t| t.to_string_lossy().to_string())
    } else {
        None
    };
    let meta = fs::metadata(p)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let uid = meta.uid();
        let gid = meta.gid();
        Ok(PathPermissions {
            mode: meta.mode() & 0o777,
            uid,
            gid,
            owner: id_to_name("/etc/passwd", uid).unwrap_or_else(|| uid.to_string()),
            group: id_to_name("/etc/group", gid).unwrap_or_else(|| gid.to_string()),
            is_symlink,
            symlink_target,
        })
    }
    #[cfg(not(unix))]
    {
        Ok(PathPermissions {
            mode: 0,
            uid: 0,
            gid: 0,
            owner: String::new(),
            group: String::new(),
            is_symlink,
            symlink_target,
        })
    }
}

#[tauri::command]
pub fn set_path_mode(path: String, mode: u32) -> Result<(), CmdError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(mode & 0o777))?;
        Ok(())
    }
    #[cfg(not(unix))]
    {
        let _ = (path, mode);
        Err(CmdError::new("unsupported", "Changing permissions is only supported on Unix"))
    }
}

#[tauri::command]
pub fn create_symlink(target: String, link_dir: String, link_name: String) -> Result<String, CmdError> {
    validate_name(&link_name)?;
    let link_path = PathBuf::from(&link_dir).join(&link_name);
    if fs::symlink_metadata(&link_path).is_ok() {
        return Err(already_exists());
    }
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&target, &link_path)?;
    }
    #[cfg(not(unix))]
    {
        let _ = target;
        return Err(CmdError::new("unsupported", "Creating symlinks is only supported on Unix"));
    }
    Ok(link_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_archive(paths: Vec<String>, dest_dir: String, archive_name: String) -> Result<String, CmdError> {
    validate_name(&archive_name)?;
    tauri::async_runtime::spawn_blocking(move || zip_paths(&paths, &dest_dir, &archive_name))
        .await
        .map_err(|error| CmdError::new("internal", format!("Compression failed: {error}")))?
}

fn zip_paths(paths: &[String], dest_dir: &str, archive_name: &str) -> Result<String, CmdError> {
    if paths.is_empty() {
        return Err(CmdError::new("nothing_selected", "Nothing selected to compress"));
    }
    let name = if archive_name.to_ascii_lowercase().ends_with(".zip") {
        archive_name.to_string()
    } else {
        format!("{archive_name}.zip")
    };
    let target = PathBuf::from(dest_dir).join(&name);
    if target.exists() {
        return Err(already_exists());
    }

    let file = fs::File::create(&target)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for raw in paths {
        let src = PathBuf::from(raw);
        let root_name = src
            .file_name()
            .ok_or_else(|| CmdError::new("invalid_path", format!("Bad source path: {raw}")))?
            .to_string_lossy()
            .to_string();
        add_to_zip(&mut zip, &src, Path::new(&root_name), options)?;
    }

    zip.finish()
        .map_err(|error| CmdError::from(error.to_string()).context("Could not finish writing the archive"))?;
    Ok(target.to_string_lossy().to_string())
}

fn add_to_zip<W: std::io::Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    src: &Path,
    rel: &Path,
    options: zip::write::SimpleFileOptions,
) -> Result<(), CmdError> {
    let rel_str = rel.to_string_lossy().replace('\\', "/");
    if src.is_dir() {
        zip.add_directory(format!("{rel_str}/"), options)
            .map_err(|error| CmdError::from(error.to_string()).context("Could not write archive entry"))?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            add_to_zip(zip, &entry.path(), &rel.join(entry.file_name()), options)?;
        }
    } else {
        zip.start_file(rel_str, options)
            .map_err(|error| CmdError::from(error.to_string()).context("Could not write archive entry"))?;
        let mut f = fs::File::open(src)?;
        std::io::copy(&mut f, zip)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_workdir(tag: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("geyma-fsops-{tag}-{nonce}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
        use std::io::Write;
        use zip::write::SimpleFileOptions;
        let file = fs::File::create(path).unwrap();
        let mut writer = zip::ZipWriter::new(file);
        for (name, contents) in entries {
            writer.start_file(*name, SimpleFileOptions::default()).unwrap();
            writer.write_all(contents).unwrap();
        }
        writer.finish().unwrap();
    }

    #[test]
    fn validate_name_rejects_traversal_and_separators() {
        assert!(validate_name("notes.txt").is_ok());
        assert!(validate_name("weird but fine ~!@#$%^&()").is_ok());
        assert!(validate_name("..hidden-ish").is_ok());
        assert!(validate_name("").is_err());
        assert!(validate_name(".").is_err());
        assert!(validate_name("..").is_err());
        assert!(validate_name("../escape").is_err());
        assert!(validate_name("nested/child").is_err());
        assert!(validate_name("back\\slash").is_err());
        assert!(validate_name("nul\0byte").is_err());
    }

    #[test]
    fn create_folder_refuses_names_that_escape_the_parent() {
        let root = temp_workdir("traversal");
        let parent = root.join("inbox");
        fs::create_dir(&parent).unwrap();

        let result = create_folder(
            parent.to_string_lossy().to_string(),
            "../escaped".to_string(),
        );
        assert!(result.is_err());
        assert!(!root.join("escaped").exists());
    }

    #[test]
    fn list_dir_reports_dirs_files_and_hidden_entries() {
        let root = temp_workdir("list");
        fs::write(root.join("visible.txt"), b"hi").unwrap();
        fs::write(root.join(".hidden"), b"hi").unwrap();
        fs::create_dir(root.join("sub")).unwrap();

        let mut entries = list_dir(root.to_string_lossy().to_string()).unwrap();
        entries.sort_by(|a, b| a.name.cmp(&b.name));

        assert_eq!(entries.len(), 3);
        let hidden = entries.iter().find(|e| e.name == ".hidden").unwrap();
        assert!(hidden.is_hidden);
        let file = entries.iter().find(|e| e.name == "visible.txt").unwrap();
        assert!(!file.is_dir);
        assert_eq!(file.size, 2);
        let dir = entries.iter().find(|e| e.name == "sub").unwrap();
        assert!(dir.is_dir);

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn create_folder_and_file_write_into_parent() {
        let root = temp_workdir("create");

        let folder_path = create_folder(root.to_string_lossy().to_string(), "kids".to_string()).unwrap();
        assert!(Path::new(&folder_path).is_dir());

        let file_path = create_file(
            root.to_string_lossy().to_string(),
            "note.txt".to_string(),
            "hello".to_string(),
        )
        .unwrap();
        assert_eq!(fs::read_to_string(&file_path).unwrap(), "hello");

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn rename_path_renames_within_same_directory() {
        let root = temp_workdir("rename");
        let original = root.join("old.txt");
        fs::write(&original, b"data").unwrap();

        let renamed = rename_path(original.to_string_lossy().to_string(), "new.txt".to_string()).unwrap();

        assert!(!original.exists());
        assert_eq!(Path::new(&renamed), root.join("new.txt"));
        assert_eq!(fs::read_to_string(&renamed).unwrap(), "data");

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn move_path_relocates_into_target_directory() {
        let root = temp_workdir("move");
        let src_dir = root.join("src");
        let dst_dir = root.join("dst");
        fs::create_dir_all(&src_dir).unwrap();
        fs::create_dir_all(&dst_dir).unwrap();
        let src_file = src_dir.join("file.txt");
        fs::write(&src_file, b"payload").unwrap();

        let moved = move_path(
            src_file.to_string_lossy().to_string(),
            dst_dir.to_string_lossy().to_string(),
        )
        .unwrap();

        assert!(!src_file.exists());
        assert_eq!(Path::new(&moved), dst_dir.join("file.txt"));
        assert_eq!(fs::read_to_string(&moved).unwrap(), "payload");

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn copy_path_recursively_copies_a_directory_tree() {
        let root = temp_workdir("copy");
        let src_dir = root.join("src");
        fs::create_dir_all(src_dir.join("nested")).unwrap();
        fs::write(src_dir.join("top.txt"), b"top").unwrap();
        fs::write(src_dir.join("nested/deep.txt"), b"deep").unwrap();

        let copied = copy_path(
            src_dir.to_string_lossy().to_string(),
            root.to_string_lossy().to_string(),
            "copy-of-src".to_string(),
        )
        .unwrap();
        let copied = PathBuf::from(copied);

        // Original tree is untouched by a copy.
        assert!(src_dir.join("top.txt").exists());
        assert!(src_dir.join("nested/deep.txt").exists());
        // Copy reproduces both the file at the top level and the nested one.
        assert_eq!(fs::read_to_string(copied.join("top.txt")).unwrap(), "top");
        assert_eq!(
            fs::read_to_string(copied.join("nested/deep.txt")).unwrap(),
            "deep"
        );

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn trash_and_restore_round_trip_a_file() {
        let root = temp_workdir("trash-restore");
        let original = root.join("keepsake.txt");
        fs::write(&original, b"remember me").unwrap();

        let trashed = trash_path(original.to_string_lossy().to_string()).unwrap();
        assert!(!original.exists());
        assert!(Path::new(&trashed).exists());

        let restored = restore_path(trashed, root.to_string_lossy().to_string()).unwrap();
        assert_eq!(Path::new(&restored), original);
        assert_eq!(fs::read_to_string(&restored).unwrap(), "remember me");

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn trash_path_disambiguates_name_collisions() {
        let root_a = temp_workdir("trash-collide-a");
        let root_b = temp_workdir("trash-collide-b");
        let file_a = root_a.join("dup.txt");
        let file_b = root_b.join("dup.txt");
        fs::write(&file_a, b"from a").unwrap();
        fs::write(&file_b, b"from b").unwrap();

        let trashed_a = trash_path(file_a.to_string_lossy().to_string()).unwrap();
        let trashed_b = trash_path(file_b.to_string_lossy().to_string()).unwrap();

        assert_ne!(trashed_a, trashed_b, "colliding names must not overwrite each other");
        assert_eq!(fs::read_to_string(&trashed_a).unwrap(), "from a");
        assert_eq!(fs::read_to_string(&trashed_b).unwrap(), "from b");

        fs::remove_file(&trashed_a).unwrap();
        fs::remove_file(&trashed_b).unwrap();
        fs::remove_dir_all(&root_a).unwrap();
        fs::remove_dir_all(&root_b).unwrap();
    }

    #[test]
    fn extract_zip_recreates_nested_entries_under_a_new_folder() {
        let root = temp_workdir("extract");
        let archive_path = root.join("bundle.zip");
        write_zip(
            &archive_path,
            &[("top.txt", b"top" as &[u8]), ("nested/deep.txt", b"deep")],
        );

        let extracted = extract_zip(
            archive_path.to_str().unwrap(),
            root.to_str().unwrap(),
            "bundle",
        )
        .unwrap();
        let extracted = PathBuf::from(extracted);

        assert_eq!(extracted, root.join("bundle"));
        assert_eq!(fs::read_to_string(extracted.join("top.txt")).unwrap(), "top");
        assert_eq!(
            fs::read_to_string(extracted.join("nested/deep.txt")).unwrap(),
            "deep"
        );

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn extract_zip_refuses_to_overwrite_an_existing_folder() {
        let root = temp_workdir("extract-collide");
        let archive_path = root.join("bundle.zip");
        write_zip(&archive_path, &[("file.txt", b"data" as &[u8])]);
        fs::create_dir_all(root.join("bundle")).unwrap();

        let result = extract_zip(archive_path.to_str().unwrap(), root.to_str().unwrap(), "bundle");

        assert!(result.is_err());
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn extract_zip_rejects_path_traversal_entries() {
        let root = temp_workdir("extract-slip");
        let archive_path = root.join("evil.zip");
        write_zip(
            &archive_path,
            &[("../../escaped.txt", b"pwned" as &[u8])],
        );

        let result = extract_zip(archive_path.to_str().unwrap(), root.to_str().unwrap(), "evil");

        assert!(result.is_err());
        assert!(!root.join("../escaped.txt").exists());
        assert!(!std::env::temp_dir().join("escaped.txt").exists());

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn delete_permanently_removes_files_and_directory_trees() {
        let root = temp_workdir("delete");
        let file = root.join("gone.txt");
        fs::write(&file, b"bye").unwrap();
        let dir_tree = root.join("tree");
        fs::create_dir_all(dir_tree.join("nested")).unwrap();
        fs::write(dir_tree.join("nested/inner.txt"), b"bye").unwrap();

        delete_permanently(file.to_string_lossy().to_string()).unwrap();
        assert!(!file.exists());

        delete_permanently(dir_tree.to_string_lossy().to_string()).unwrap();
        assert!(!dir_tree.exists());

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn get_and_set_path_mode_round_trip_permission_bits() {
        use std::os::unix::fs::PermissionsExt;

        let root = temp_workdir("perms");
        let file = root.join("script.sh");
        fs::write(&file, b"#!/bin/sh").unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o644)).unwrap();

        let before = get_path_permissions(file.to_string_lossy().to_string()).unwrap();
        assert_eq!(before.mode, 0o644);
        assert!(!before.is_symlink);
        assert!(before.symlink_target.is_none());

        set_path_mode(file.to_string_lossy().to_string(), 0o755).unwrap();
        let after = get_path_permissions(file.to_string_lossy().to_string()).unwrap();
        assert_eq!(after.mode, 0o755);

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn get_path_permissions_reports_symlink_target() {
        let root = temp_workdir("perms-symlink");
        let target = root.join("original.txt");
        fs::write(&target, b"data").unwrap();
        let link = root.join("alias.txt");
        std::os::unix::fs::symlink(&target, &link).unwrap();

        let info = get_path_permissions(link.to_string_lossy().to_string()).unwrap();
        assert!(info.is_symlink);
        assert_eq!(info.symlink_target, Some(target.to_string_lossy().to_string()));

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn create_symlink_points_back_at_the_original() {
        let root = temp_workdir("symlink-create");
        let target = root.join("original.txt");
        fs::write(&target, b"data").unwrap();

        let link_path = create_symlink(
            target.to_string_lossy().to_string(),
            root.to_string_lossy().to_string(),
            "alias.txt".to_string(),
        )
        .unwrap();

        assert_eq!(fs::read_link(&link_path).unwrap(), target);
        assert_eq!(fs::read_to_string(&link_path).unwrap(), "data");

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn create_symlink_refuses_to_overwrite_an_existing_entry() {
        let root = temp_workdir("symlink-collide");
        let target = root.join("original.txt");
        fs::write(&target, b"data").unwrap();
        fs::write(root.join("alias.txt"), b"already here").unwrap();

        let result = create_symlink(
            target.to_string_lossy().to_string(),
            root.to_string_lossy().to_string(),
            "alias.txt".to_string(),
        );

        assert!(result.is_err());
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn rename_path_refuses_to_overwrite_an_existing_entry() {
        let root = temp_workdir("rename-collide");
        let original = root.join("old.txt");
        fs::write(&original, b"data").unwrap();
        fs::write(root.join("new.txt"), b"already here").unwrap();

        let result = rename_path(original.to_string_lossy().to_string(), "new.txt".to_string());

        assert!(result.is_err());
        assert!(original.exists());
        assert_eq!(fs::read_to_string(root.join("new.txt")).unwrap(), "already here");
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn move_path_refuses_to_overwrite_an_existing_entry() {
        let root = temp_workdir("move-collide");
        let src_dir = root.join("src");
        let dst_dir = root.join("dst");
        fs::create_dir_all(&src_dir).unwrap();
        fs::create_dir_all(&dst_dir).unwrap();
        let src_file = src_dir.join("file.txt");
        fs::write(&src_file, b"payload").unwrap();
        fs::write(dst_dir.join("file.txt"), b"already here").unwrap();

        let result = move_path(
            src_file.to_string_lossy().to_string(),
            dst_dir.to_string_lossy().to_string(),
        );

        assert!(result.is_err());
        assert!(src_file.exists());
        assert_eq!(fs::read_to_string(dst_dir.join("file.txt")).unwrap(), "already here");
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn zip_paths_compresses_a_file_and_a_nested_directory() {
        let root = temp_workdir("zip-create");
        fs::write(root.join("top.txt"), b"top").unwrap();
        fs::create_dir_all(root.join("folder/nested")).unwrap();
        fs::write(root.join("folder/nested/deep.txt"), b"deep").unwrap();

        let archive_path = zip_paths(
            &[
                root.join("top.txt").to_string_lossy().to_string(),
                root.join("folder").to_string_lossy().to_string(),
            ],
            root.to_str().unwrap(),
            "bundle",
        )
        .unwrap();
        assert_eq!(Path::new(&archive_path), root.join("bundle.zip"));

        let file = fs::File::open(&archive_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let mut names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .collect();
        names.sort();
        assert_eq!(names, vec!["folder/", "folder/nested/", "folder/nested/deep.txt", "top.txt"]);

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn zip_paths_refuses_to_overwrite_an_existing_archive() {
        let root = temp_workdir("zip-collide");
        fs::write(root.join("top.txt"), b"top").unwrap();
        fs::write(root.join("bundle.zip"), b"already here").unwrap();

        let result = zip_paths(
            &[root.join("top.txt").to_string_lossy().to_string()],
            root.to_str().unwrap(),
            "bundle",
        );

        assert!(result.is_err());
        fs::remove_dir_all(&root).unwrap();
    }
}

#[tauri::command]
pub fn list_devices() -> Vec<DeviceEntry> {
    let mut out = vec![];
    for base in ["/run/media", "/media"] {
        let base_path = Path::new(base);
        if !base_path.exists() {
            continue;
        }
        if let Ok(users) = fs::read_dir(base_path) {
            for user in users.flatten() {
                let user_path = user.path();
                if !user_path.is_dir() {
                    continue;
                }
                if let Ok(mounts) = fs::read_dir(&user_path) {
                    for mount in mounts.flatten() {
                        let mount_path = mount.path();
                        if mount_path.is_dir() {
                            out.push(DeviceEntry {
                                label: mount_path
                                    .file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default(),
                                path: mount_path.to_string_lossy().to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
    out
}
