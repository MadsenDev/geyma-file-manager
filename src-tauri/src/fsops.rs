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
