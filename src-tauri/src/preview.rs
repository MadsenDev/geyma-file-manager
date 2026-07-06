//! Safe, read-only file inspection used by Quick Look providers.
//!
//! Preview commands return bounded metadata rather than file contents. This
//! keeps large or hostile files from producing unbounded frontend payloads and
//! gives future formats a single place to add native inspection.

use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::Path;

const MAX_ARCHIVE_ENTRIES: usize = 2_000;
const MAX_TEXT_BYTES: usize = 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    path: String,
    is_dir: bool,
    size: u64,
    compressed_size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchivePreview {
    format: String,
    entries: Vec<ArchiveEntry>,
    total_entries: usize,
    truncated: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextPreview {
    content: String,
    truncated: bool,
}

#[tauri::command]
pub async fn preview_text_file(path: String) -> Result<Option<TextPreview>, String> {
    tauri::async_runtime::spawn_blocking(move || inspect_text(&path))
        .await
        .map_err(|error| format!("Text inspection failed: {error}"))?
}

fn inspect_text(path: &str) -> Result<Option<TextPreview>, String> {
    let mut file = File::open(path).map_err(|error| format!("Could not open file: {error}"))?;
    let mut bytes = Vec::with_capacity(MAX_TEXT_BYTES + 1);
    file.by_ref()
        .take((MAX_TEXT_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read file: {error}"))?;

    if bytes.contains(&0) {
        return Ok(None);
    }
    let truncated = bytes.len() > MAX_TEXT_BYTES;
    bytes.truncate(MAX_TEXT_BYTES);
    let content = match String::from_utf8(bytes) {
        Ok(content) => content,
        Err(error) if error.utf8_error().error_len().is_none() => {
            let valid = error.utf8_error().valid_up_to();
            String::from_utf8(error.into_bytes()[..valid].to_vec()).unwrap_or_default()
        }
        Err(_) => return Ok(None),
    };
    let control_chars = content
        .chars()
        .filter(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
        .count();
    if control_chars > content.chars().count().div_ceil(100) {
        return Ok(None);
    }

    Ok(Some(TextPreview { content, truncated }))
}

#[tauri::command]
pub async fn preview_archive(path: String) -> Result<ArchivePreview, String> {
    tauri::async_runtime::spawn_blocking(move || inspect_archive(&path))
        .await
        .map_err(|error| format!("Archive inspection failed: {error}"))?
}

fn inspect_archive(path: &str) -> Result<ArchivePreview, String> {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "zip" => preview_zip(path),
        _ => Err(format!(
            "{extension} archive previews are not supported yet; ZIP archives are supported."
        )),
    }
}

fn preview_zip(path: &str) -> Result<ArchivePreview, String> {
    let file = File::open(path).map_err(|error| format!("Could not open archive: {error}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| format!("Could not read ZIP directory: {error}"))?;
    let total_entries = archive.len();
    let listed_entries = total_entries.min(MAX_ARCHIVE_ENTRIES);
    let mut entries = Vec::with_capacity(listed_entries);

    for index in 0..listed_entries {
        let entry = archive
            .by_index(index)
            .map_err(|error| format!("Could not read ZIP entry {index}: {error}"))?;
        entries.push(ArchiveEntry {
            path: entry.name().to_string(),
            is_dir: entry.is_dir(),
            size: entry.size(),
            compressed_size: entry.compressed_size(),
        });
    }

    Ok(ArchivePreview {
        format: "ZIP".to_string(),
        entries,
        total_entries,
        truncated: total_entries > listed_entries,
    })
}

#[cfg(test)]
mod tests {
    use super::{inspect_text, preview_zip, MAX_TEXT_BYTES};
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};
    use zip::write::SimpleFileOptions;

    #[test]
    fn lists_zip_entries_without_extracting_them() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("geyma-preview-{nonce}.zip"));
        let file = std::fs::File::create(&path).unwrap();
        let mut writer = zip::ZipWriter::new(file);
        writer
            .add_directory("docs/", SimpleFileOptions::default())
            .unwrap();
        writer
            .start_file("docs/readme.txt", SimpleFileOptions::default())
            .unwrap();
        writer.write_all(b"hello preview").unwrap();
        writer.finish().unwrap();

        let preview = preview_zip(path.to_str().unwrap()).unwrap();
        std::fs::remove_file(path).unwrap();

        assert_eq!(preview.format, "ZIP");
        assert_eq!(preview.total_entries, 2);
        assert!(!preview.truncated);
        assert_eq!(preview.entries[0].path, "docs/");
        assert!(preview.entries[0].is_dir);
        assert_eq!(preview.entries[1].path, "docs/readme.txt");
        assert_eq!(preview.entries[1].size, 13);
    }

    #[test]
    fn detects_text_and_rejects_binary_data() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let text_path = std::env::temp_dir().join(format!("geyma-text-{nonce}"));
        let binary_path = std::env::temp_dir().join(format!("geyma-binary-{nonce}"));
        std::fs::write(&text_path, "extensionless UTF-8 text\n").unwrap();
        std::fs::write(&binary_path, [1, 2, 0, 4]).unwrap();

        let text = inspect_text(text_path.to_str().unwrap()).unwrap().unwrap();
        let binary = inspect_text(binary_path.to_str().unwrap()).unwrap();
        std::fs::remove_file(text_path).unwrap();
        std::fs::remove_file(binary_path).unwrap();

        assert_eq!(text.content, "extensionless UTF-8 text\n");
        assert!(!text.truncated);
        assert!(binary.is_none());
        assert_eq!(MAX_TEXT_BYTES, 1024 * 1024);
    }
}
