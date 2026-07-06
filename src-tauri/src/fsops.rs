use serde::Serialize;
use std::fs;
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
pub fn list_dir(path: String) -> Result<Vec<FsEntry>, String> {
    let dir = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut out = vec![];
    for item in dir {
        let item = item.map_err(|e| e.to_string())?;
        if let Some(entry) = entry_from_path(&item.path()) {
            out.push(entry);
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn stat_path(path: String) -> Result<FsEntry, String> {
    entry_from_path(Path::new(&path)).ok_or_else(|| "not found".to_string())
}

#[tauri::command]
pub fn home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "no home directory".to_string())
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_folder(parent: String, name: String) -> Result<String, String> {
    let target = PathBuf::from(&parent).join(&name);
    fs::create_dir(&target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_file(parent: String, name: String, contents: String) -> Result<String, String> {
    let target = PathBuf::from(&parent).join(&name);
    fs::write(&target, contents).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn rename_path(from: String, to_name: String) -> Result<String, String> {
    let from_path = PathBuf::from(&from);
    let parent = from_path.parent().ok_or("no parent")?;
    let target = parent.join(&to_name);
    fs::rename(&from_path, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn move_path(from: String, to_dir: String) -> Result<String, String> {
    let from_path = PathBuf::from(&from);
    let name = from_path.file_name().ok_or("bad source name")?;
    let target = PathBuf::from(&to_dir).join(name);
    fs::rename(&from_path, &target).map_err(|e| e.to_string())?;
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
pub fn copy_path(from: String, to_dir: String, to_name: String) -> Result<String, String> {
    let src = PathBuf::from(&from);
    let target = PathBuf::from(&to_dir).join(&to_name);
    copy_recursive(&src, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn extract_archive(path: String, dest_dir: String, folder_name: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || extract_zip(&path, &dest_dir, &folder_name))
        .await
        .map_err(|error| format!("Extraction failed: {error}"))?
}

fn extract_zip(path: &str, dest_dir: &str, folder_name: &str) -> Result<String, String> {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension != "zip" {
        return Err(format!(
            "{extension} archives are not supported yet; only ZIP can be extracted."
        ));
    }

    let target_root = PathBuf::from(dest_dir).join(folder_name);
    if target_root.exists() {
        return Err("A file or folder with that name already exists".to_string());
    }

    let file = fs::File::open(path).map_err(|error| format!("Could not open archive: {error}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| format!("Could not read ZIP directory: {error}"))?;

    fs::create_dir_all(&target_root).map_err(|error| error.to_string())?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Could not read ZIP entry {index}: {error}"))?;
        // enclosed_name() rejects absolute paths and ".." components, which is what
        // stops a hostile archive (zip-slip) from writing outside target_root.
        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| format!("Refusing to extract unsafe entry path: {}", entry.name()))?;
        let out_path = target_root.join(&enclosed);

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|error| error.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let mut out_file = fs::File::create(&out_path).map_err(|error| error.to_string())?;
            std::io::copy(&mut entry, &mut out_file).map_err(|error| error.to_string())?;
        }
    }

    Ok(target_root.to_string_lossy().to_string())
}

fn app_trash_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or("no data dir")?;
    let dir = base.join("geyma").join("trash");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Soft-delete: move into Geyma's own recoverable trash folder (not the OS trash),
/// so the app can offer a first-class Trash view with reliable restore semantics.
#[tauri::command]
pub fn trash_path(path: String) -> Result<String, String> {
    let src = PathBuf::from(&path);
    let name = src.file_name().ok_or("bad source name")?;
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
    fs::rename(&src, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_path(trashed_path: String, to_dir: String) -> Result<String, String> {
    move_path(trashed_path, to_dir)
}

#[tauri::command]
pub fn delete_permanently(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn trash_dir_path() -> Result<String, String> {
    app_trash_dir().map(|p| p.to_string_lossy().to_string())
}

#[derive(Serialize, Clone)]
pub struct DiskUsage {
    pub total: u64,
    pub available: u64,
}

#[tauri::command]
pub fn disk_usage(path: String) -> Result<DiskUsage, String> {
    let p = Path::new(&path);
    let total = fs4::total_space(p).map_err(|e| e.to_string())?;
    let available = fs4::available_space(p).map_err(|e| e.to_string())?;
    Ok(DiskUsage { total, available })
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
