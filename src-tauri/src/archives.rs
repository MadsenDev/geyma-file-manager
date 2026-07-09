//! Read-only support for archive formats beyond ZIP: tar (plain, or gzip/bzip2/xz
//! compressed) and 7z. Mirrors fsops.rs's ZIP handling — the same zip-slip guard on
//! extraction (reject absolute paths and ".." components) and the same bounded
//! listing shape for previews.
//!
//! RAR is deliberately not supported here: there's no mature pure-Rust RAR reader.
//! The one dependency-free option on crates.io (`rar`) only understands RAR5 (not the
//! still-common RAR4), and its only entry point extracts to disk while parsing, so
//! even a read-only preview would mean silently extracting to a temp dir first. The
//! alternative, the `unrar` crate, wraps the official non-free "freeware"-licensed
//! unrar source and needs a C++ toolchain at build time. Revisit if RAR turns out to
//! matter enough to users to justify one of those tradeoffs.

use crate::error::CmdError;
use std::fs::File;
use std::io::{BufReader, Read, Write};
use std::path::{Component, Path, PathBuf};

use sevenz_rust::{Password, SevenZReader};

/// Ceiling on the in-memory buffer used to hold a fully-decompressed .tar.xz stream
/// (see the comment in `tar_reader` on why XZ can't be streamed like the other tar
/// variants). Without this, a small hostile XZ stream with an extreme compression
/// ratio can exhaust memory during `list()` (Quick Look preview) or `extract()`.
const MAX_XZ_DECOMPRESSED_BYTES: usize = 512 * 1024 * 1024;

/// Caps on tar/7z extraction, kept in sync with the matching constants in fsops.rs's
/// ZIP path — a defense against a hostile archive that's tiny on disk but expands to
/// an enormous number of files or bytes ("archive bomb").
const MAX_EXTRACT_ENTRIES: usize = 100_000;
const MAX_EXTRACT_TOTAL_BYTES: u64 = 10 * 1024 * 1024 * 1024;

/// A `Write` sink that errors out once more than `limit` bytes have been written,
/// instead of growing an unbounded `Vec<u8>` for the lifetime of the decompression.
struct BoundedBuffer {
    data: Vec<u8>,
    limit: usize,
}

impl Write for BoundedBuffer {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        if self.data.len() + buf.len() > self.limit {
            return Err(std::io::Error::other(
                "XZ stream exceeds the maximum supported decompressed size",
            ));
        }
        self.data.extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ArchiveKind {
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    SevenZ,
}

/// Detects one of our non-ZIP archive kinds from a file name. Compound extensions
/// (.tar.gz and friends) have to be matched before the single trailing extension,
/// since `Path::extension()` alone would only see the ".gz"/".bz2"/".xz" part.
pub fn detect(path: &str) -> Option<ArchiveKind> {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") {
        Some(ArchiveKind::TarGz)
    } else if lower.ends_with(".tar.bz2") || lower.ends_with(".tbz2") || lower.ends_with(".tbz") {
        Some(ArchiveKind::TarBz2)
    } else if lower.ends_with(".tar.xz") || lower.ends_with(".txz") {
        Some(ArchiveKind::TarXz)
    } else if lower.ends_with(".tar") {
        Some(ArchiveKind::Tar)
    } else if lower.ends_with(".7z") {
        Some(ArchiveKind::SevenZ)
    } else {
        None
    }
}

pub fn format_label(kind: ArchiveKind) -> &'static str {
    match kind {
        ArchiveKind::Tar => "TAR",
        ArchiveKind::TarGz => "TAR.GZ",
        ArchiveKind::TarBz2 => "TAR.BZ2",
        ArchiveKind::TarXz => "TAR.XZ",
        ArchiveKind::SevenZ => "7Z",
    }
}

pub struct ListedEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

fn tar_reader(kind: ArchiveKind, path: &str) -> Result<Box<dyn Read>, CmdError> {
    let file = File::open(path).map_err(|error| CmdError::from(error).context("Could not open archive"))?;
    let reader: Box<dyn Read> = match kind {
        ArchiveKind::Tar => Box::new(file),
        ArchiveKind::TarGz => Box::new(flate2::read::GzDecoder::new(file)),
        ArchiveKind::TarBz2 => Box::new(bzip2_rs::DecoderReader::new(file)),
        ArchiveKind::TarXz => {
            // lzma-rs only exposes a run-to-completion decompressor (no incremental
            // Read adapter), so .tar.xz is buffered fully in memory before the tar
            // reader ever sees it. Fine for the file sizes this app deals with; the
            // other tar variants above stream instead.
            let mut decompressed = BoundedBuffer {
                data: Vec::new(),
                limit: MAX_XZ_DECOMPRESSED_BYTES,
            };
            lzma_rs::xz_decompress(&mut BufReader::new(file), &mut decompressed)
                .map_err(|error| CmdError::new("archive_damaged", format!("Could not decompress XZ stream: {error}")))?;
            Box::new(std::io::Cursor::new(decompressed.data))
        }
        ArchiveKind::SevenZ => unreachable!("7z has its own reader path, not the tar one"),
    };
    Ok(reader)
}

/// Rejects absolute paths and ".." components, the tar/7z equivalent of ZIP's
/// `enclosed_name()` guard against zip-slip.
fn safe_join(target_root: &Path, entry_path: &Path) -> Option<PathBuf> {
    if entry_path.is_absolute() {
        return None;
    }
    let mut out = target_root.to_path_buf();
    for component in entry_path.components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return None,
        }
    }
    Some(out)
}

pub fn list(kind: ArchiveKind, path: &str, cap: usize) -> Result<(Vec<ListedEntry>, usize), CmdError> {
    if kind == ArchiveKind::SevenZ {
        return list_7z(path, cap);
    }

    let reader = tar_reader(kind, path)?;
    let mut archive = tar::Archive::new(reader);
    let mut entries = vec![];
    let mut total = 0usize;
    for entry in archive
        .entries()
        .map_err(|error| CmdError::new("archive_damaged", format!("Could not read TAR directory: {error}")))?
    {
        let entry = entry.map_err(|error| CmdError::new("archive_damaged", format!("Could not read TAR entry: {error}")))?;
        total += 1;
        if entries.len() < cap {
            let name = entry
                .path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            entries.push(ListedEntry {
                name,
                is_dir: entry.header().entry_type().is_dir(),
                size: entry.size(),
            });
        }
    }
    Ok((entries, total))
}

fn list_7z(path: &str, cap: usize) -> Result<(Vec<ListedEntry>, usize), CmdError> {
    let file = File::open(path).map_err(|error| CmdError::from(error).context("Could not open archive"))?;
    let len = file.metadata()?.len();
    let reader = SevenZReader::new(file, len, Password::empty())
        .map_err(|error| CmdError::new("archive_damaged", format!("Could not read 7z directory: {error}")))?;
    let files = &reader.archive().files;
    let total = files.len();
    let entries = files
        .iter()
        .take(cap)
        .map(|entry| ListedEntry {
            name: entry.name.clone(),
            is_dir: entry.is_directory(),
            size: entry.size(),
        })
        .collect();
    Ok((entries, total))
}

pub fn extract(kind: ArchiveKind, path: &str, dest_dir: &str, folder_name: &str) -> Result<String, CmdError> {
    let target_root = PathBuf::from(dest_dir).join(folder_name);
    if target_root.exists() {
        return Err(CmdError::new("already_exists", "A file or folder with that name already exists"));
    }
    std::fs::create_dir_all(&target_root)?;

    if kind == ArchiveKind::SevenZ {
        extract_7z(path, &target_root)?;
    } else {
        extract_tar(kind, path, &target_root)?;
    }
    Ok(target_root.to_string_lossy().to_string())
}

fn extract_tar(kind: ArchiveKind, path: &str, target_root: &Path) -> Result<(), CmdError> {
    let reader = tar_reader(kind, path)?;
    let mut archive = tar::Archive::new(reader);
    let mut remaining_budget = MAX_EXTRACT_TOTAL_BYTES;
    let mut entry_count = 0usize;
    for entry in archive
        .entries()
        .map_err(|error| CmdError::new("archive_damaged", format!("Could not read TAR directory: {error}")))?
    {
        entry_count += 1;
        if entry_count > MAX_EXTRACT_ENTRIES {
            return Err(CmdError::new(
                "archive_too_large",
                format!("Archive has too many entries to extract (the limit is {MAX_EXTRACT_ENTRIES})"),
            ));
        }
        let mut entry = entry.map_err(|error| CmdError::new("archive_damaged", format!("Could not read TAR entry: {error}")))?;
        let entry_path = entry
            .path()
            .map_err(|error| CmdError::new("archive_damaged", format!("Could not read TAR entry path: {error}")))?
            .to_path_buf();
        let out_path = safe_join(target_root, &entry_path).ok_or_else(|| {
            CmdError::new("unsafe_archive_path", format!("Refusing to extract unsafe entry path: {}", entry_path.display()))
        })?;

        if entry.header().entry_type().is_dir() {
            std::fs::create_dir_all(&out_path)?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut out_file = std::fs::File::create(&out_path)?;
            // Bounded by actual bytes written, not the header's (attacker-controlled)
            // declared size, so a lying header can't smuggle a bomb past this check.
            let mut limited = (&mut entry).take(remaining_budget.saturating_add(1));
            let copied = std::io::copy(&mut limited, &mut out_file)?;
            if copied > remaining_budget {
                return Err(CmdError::new("archive_too_large", "Archive exceeds the maximum supported extraction size"));
            }
            remaining_budget -= copied;
        }
    }
    Ok(())
}

fn extract_7z(path: &str, target_root: &Path) -> Result<(), CmdError> {
    let file = File::open(path).map_err(|error| CmdError::from(error).context("Could not open archive"))?;
    let len = file.metadata()?.len();
    let mut reader = SevenZReader::new(file, len, Password::empty())
        .map_err(|error| CmdError::new("archive_damaged", format!("Could not read 7z directory: {error}")))?;

    if reader.archive().files.len() > MAX_EXTRACT_ENTRIES {
        return Err(CmdError::new(
            "archive_too_large",
            format!(
                "Archive has too many entries to extract ({} entries; the limit is {MAX_EXTRACT_ENTRIES})",
                reader.archive().files.len()
            ),
        ));
    }

    let mut remaining_budget = MAX_EXTRACT_TOTAL_BYTES;
    reader
        .for_each_entries(|entry, source| {
            let entry_path = Path::new(entry.name());
            let out_path = safe_join(target_root, entry_path).ok_or_else(|| {
                sevenz_rust::Error::other(format!("Refusing to extract unsafe entry path: {}", entry.name()))
            })?;

            if entry.is_directory() {
                std::fs::create_dir_all(&out_path).map_err(sevenz_rust::Error::io)?;
            } else {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent).map_err(sevenz_rust::Error::io)?;
                }
                let mut out_file = std::fs::File::create(&out_path).map_err(sevenz_rust::Error::io)?;
                // Bounded by actual bytes written, not the entry's (attacker-controlled)
                // declared size, so a lying header can't smuggle a bomb past this check.
                let mut limited = source.take(remaining_budget.saturating_add(1));
                let copied = std::io::copy(&mut limited, &mut out_file).map_err(sevenz_rust::Error::io)?;
                if copied > remaining_budget {
                    return Err(sevenz_rust::Error::other(
                        "Archive exceeds the maximum supported extraction size",
                    ));
                }
                remaining_budget -= copied;
            }
            Ok(true)
        })
        .map_err(|error| CmdError::from(format!("Could not extract 7z archive: {error}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_workdir(label: &str) -> PathBuf {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("geyma-archives-{label}-{nonce}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_tar(path: &Path, entries: &[(&str, &[u8])]) {
        let file = File::create(path).unwrap();
        let mut builder = tar::Builder::new(file);
        for (name, contents) in entries {
            let mut header = tar::Header::new_gnu();
            header.set_size(contents.len() as u64);
            header.set_cksum();
            builder.append_data(&mut header, name, *contents).unwrap();
        }
        builder.finish().unwrap();
    }

    #[test]
    fn detects_compound_and_simple_extensions() {
        assert!(matches!(detect("bundle.tar"), Some(ArchiveKind::Tar)));
        assert!(matches!(detect("bundle.tar.gz"), Some(ArchiveKind::TarGz)));
        assert!(matches!(detect("bundle.tgz"), Some(ArchiveKind::TarGz)));
        assert!(matches!(detect("bundle.tar.bz2"), Some(ArchiveKind::TarBz2)));
        assert!(matches!(detect("bundle.tar.xz"), Some(ArchiveKind::TarXz)));
        assert!(matches!(detect("bundle.7z"), Some(ArchiveKind::SevenZ)));
        assert!(detect("bundle.zip").is_none());
        assert!(detect("notes.txt").is_none());
    }

    #[test]
    fn lists_and_extracts_a_plain_tar() {
        let root = temp_workdir("tar-list-extract");
        let archive_path = root.join("bundle.tar");
        write_tar(&archive_path, &[("docs/readme.txt", b"hello tar" as &[u8])]);

        let (entries, total) = list(ArchiveKind::Tar, archive_path.to_str().unwrap(), 100).unwrap();
        assert_eq!(total, 1);
        assert_eq!(entries[0].name, "docs/readme.txt");
        assert_eq!(entries[0].size, 9);

        let extracted = extract(
            ArchiveKind::Tar,
            archive_path.to_str().unwrap(),
            root.to_str().unwrap(),
            "bundle",
        )
        .unwrap();
        let content = std::fs::read_to_string(Path::new(&extracted).join("docs/readme.txt")).unwrap();
        assert_eq!(content, "hello tar");

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn bounded_buffer_rejects_writes_past_the_limit() {
        let mut buf = BoundedBuffer {
            data: Vec::new(),
            limit: 8,
        };
        assert!(buf.write(b"1234").is_ok());
        assert!(buf.write(b"5678").is_ok());
        assert!(buf.write(b"9").is_err());
        assert_eq!(buf.data, b"12345678");
    }

    #[test]
    fn lists_and_extracts_a_gzip_compressed_tar() {
        let root = temp_workdir("targz-list-extract");
        let plain_path = root.join("plain.tar");
        write_tar(&plain_path, &[("file.txt", b"gzip me" as &[u8])]);

        let archive_path = root.join("bundle.tar.gz");
        let plain_bytes = std::fs::read(&plain_path).unwrap();
        let out_file = File::create(&archive_path).unwrap();
        let mut encoder = flate2::write::GzEncoder::new(out_file, flate2::Compression::default());
        encoder.write_all(&plain_bytes).unwrap();
        encoder.finish().unwrap();

        let (entries, total) = list(ArchiveKind::TarGz, archive_path.to_str().unwrap(), 100).unwrap();
        assert_eq!(total, 1);
        assert_eq!(entries[0].name, "file.txt");

        let extracted = extract(
            ArchiveKind::TarGz,
            archive_path.to_str().unwrap(),
            root.to_str().unwrap(),
            "bundle",
        )
        .unwrap();
        let content = std::fs::read_to_string(Path::new(&extracted).join("file.txt")).unwrap();
        assert_eq!(content, "gzip me");

        std::fs::remove_dir_all(root).unwrap();
    }

    // `tar::Builder::append_data` validates the path and refuses ".." itself, which is
    // exactly what a real hostile archive (built by something other than this crate)
    // would not do — so this writes the raw header bytes to bypass that validation and
    // actually exercise our own safe_join guard.
    fn write_tar_with_raw_name(path: &Path, name: &str, contents: &[u8]) {
        let file = File::create(path).unwrap();
        let mut builder = tar::Builder::new(file);
        let mut header = tar::Header::new_gnu();
        header.set_size(contents.len() as u64);
        header.as_mut_bytes()[0..name.len()].copy_from_slice(name.as_bytes());
        header.set_cksum();
        builder.append(&header, contents).unwrap();
        builder.finish().unwrap();
    }

    #[test]
    fn extract_tar_rejects_path_traversal_entries() {
        let root = temp_workdir("tar-traversal");
        let archive_path = root.join("evil.tar");
        write_tar_with_raw_name(&archive_path, "../escape.txt", b"nope");

        let result = extract(ArchiveKind::Tar, archive_path.to_str().unwrap(), root.to_str().unwrap(), "evil");
        assert!(result.is_err());
        assert!(!root.parent().unwrap().join("escape.txt").exists());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn extract_refuses_to_overwrite_an_existing_folder() {
        let root = temp_workdir("tar-collide");
        let archive_path = root.join("bundle.tar");
        write_tar(&archive_path, &[("file.txt", b"data" as &[u8])]);
        std::fs::create_dir_all(root.join("bundle")).unwrap();

        let result = extract(ArchiveKind::Tar, archive_path.to_str().unwrap(), root.to_str().unwrap(), "bundle");
        assert!(result.is_err());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn lists_and_extracts_a_7z_archive() {
        let root = temp_workdir("7z-list-extract");
        let src_dir = root.join("src");
        std::fs::create_dir_all(src_dir.join("docs")).unwrap();
        std::fs::write(src_dir.join("docs/readme.txt"), b"hello 7z").unwrap();

        let archive_path = root.join("bundle.7z");
        sevenz_rust::compress_to_path(&src_dir, &archive_path).unwrap();

        let (entries, total) = list(ArchiveKind::SevenZ, archive_path.to_str().unwrap(), 100).unwrap();
        assert_eq!(total, entries.len());
        assert!(entries.iter().any(|e| e.name == "docs/readme.txt" && !e.is_dir));

        let extracted = extract(
            ArchiveKind::SevenZ,
            archive_path.to_str().unwrap(),
            root.to_str().unwrap(),
            "bundle",
        )
        .unwrap();
        let content = std::fs::read_to_string(Path::new(&extracted).join("docs/readme.txt")).unwrap();
        assert_eq!(content, "hello 7z");

        std::fs::remove_dir_all(root).unwrap();
    }
}
