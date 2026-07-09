//! SMB backend for network places, via the pure-Rust `smb` crate (SMB2/3, no system
//! libsmbclient dependency). One [`SmbConnection`] wraps one dedicated `Client` and a
//! fixed share root — kept one-per-login (rather than sharing a `Client` across logins)
//! since the crate's own connection cache is keyed by server/share, not by identity, so
//! reusing one `Client` across two different usernames against the same share could
//! reuse the wrong session.

use std::str::FromStr;
use std::sync::Arc;

use futures_util::StreamExt;
use smb::{Client, ClientConfig, Directory, FileCreateArgs, GetLen, ReadAt, UncPath, WriteAt};
use smb_fscc::{
    DirAccessMask, FileAccessMask, FileAttributes as SmbFileAttributes, FileDirectoryInformation,
    FileDispositionInformation, FileRenameInformation,
};
use smb_msg::CreateOptions;

use crate::error::CmdError;
use crate::fsops::FsEntry;

use super::{smb_child_uri, to_ms};

pub struct SmbConnection {
    client: Client,
    root: UncPath,
}

pub async fn connect(host: &str, port: u16, username: &str, password: &str, share: &str) -> Result<SmbConnection, CmdError> {
    let server = format!("{host}:{port}");
    let client = Client::new(ClientConfig::default());
    let root = UncPath::from_str(&format!(r"\\{server}\{share}"))
        .map_err(|error| CmdError::new("invalid_input", format!("Invalid server/share: {error}")))?;
    client
        .share_connect(&root, username, password.to_string())
        .await
        .map_err(|error| CmdError::new("connect_failed", format!(r"Could not connect to \\{host}\{share}: {error}")))?;
    Ok(SmbConnection { client, root })
}

fn entry_from_info(name: String, path: String, info: &FileDirectoryInformation) -> FsEntry {
    let modified_ms = to_ms(info.last_write_time.into());
    FsEntry {
        is_hidden: info.file_attributes.hidden() || name.starts_with('.'),
        is_dir: info.file_attributes.directory(),
        size: if info.file_attributes.directory() { 0 } else { info.end_of_file },
        modified_ms,
        created_ms: to_ms(info.creation_time.into()),
        name,
        path,
    }
}

fn list_access() -> FileAccessMask {
    DirAccessMask::new().with_list_directory(true).into()
}

pub async fn list_dir(conn: &SmbConnection, host: &str, port: u16, username: &str, share: &str, remote_path: &str) -> Result<Vec<FsEntry>, CmdError> {
    let dir_path = conn.root.clone().with_path(remote_path);
    let resource = conn
        .client
        .create_file(&dir_path, &FileCreateArgs::make_open_existing(list_access()))
        .await
        .map_err(|error| CmdError::from(format!("Could not open directory: {error}")))?;
    let directory = Arc::new(resource.unwrap_dir());

    let mut stream = Directory::query::<FileDirectoryInformation>(&directory, "*")
        .await
        .map_err(|error| CmdError::from(format!("Could not list directory: {error}")))?;

    let mut out = vec![];
    while let Some(item) = stream.next().await {
        let info = item.map_err(|error| CmdError::from(format!("Could not read directory entry: {error}")))?;
        let name = info.file_name.to_string();
        if name == "." || name == ".." {
            continue;
        }
        let path = smb_child_uri(host, port, username, share, remote_path, &name);
        out.push(entry_from_info(name, path, &info));
    }
    drop(stream);
    directory.close().await.map_err(|error| CmdError::from(format!("Could not close directory handle: {error}")))?;
    Ok(out)
}

pub async fn stat(conn: &SmbConnection, full_path: &str, share: &str, remote_path: &str) -> Result<FsEntry, CmdError> {
    let (parent, name) = match remote_path.rsplit_once('/') {
        Some((p, n)) => (p, n),
        None => ("", remote_path),
    };
    if name.is_empty() {
        // Share root: report it as an empty, otherwise-unremarkable directory.
        return Ok(FsEntry {
            name: share.to_string(),
            path: full_path.to_string(),
            is_dir: true,
            size: 0,
            modified_ms: 0,
            created_ms: 0,
            is_hidden: false,
        });
    }
    let entries = list_dir_raw(conn, parent).await?;
    entries
        .into_iter()
        .find(|(entry_name, _)| entry_name == name)
        .map(|(entry_name, info)| entry_from_info(entry_name, full_path.to_string(), &info))
        .ok_or_else(|| CmdError::new("gone", format!("Not found: {remote_path}")))
}

async fn list_dir_raw(conn: &SmbConnection, remote_path: &str) -> Result<Vec<(String, FileDirectoryInformation)>, CmdError> {
    let dir_path = conn.root.clone().with_path(remote_path);
    let resource = conn
        .client
        .create_file(&dir_path, &FileCreateArgs::make_open_existing(list_access()))
        .await
        .map_err(|error| CmdError::from(format!("Could not open directory: {error}")))?;
    let directory = Arc::new(resource.unwrap_dir());
    let mut stream = Directory::query::<FileDirectoryInformation>(&directory, "*")
        .await
        .map_err(|error| CmdError::from(format!("Could not list directory: {error}")))?;
    let mut out = vec![];
    while let Some(item) = stream.next().await {
        let info = item.map_err(|error| CmdError::from(format!("Could not read directory entry: {error}")))?;
        let name = info.file_name.to_string();
        if name == "." || name == ".." {
            continue;
        }
        out.push((name, info));
    }
    drop(stream);
    directory.close().await.map_err(|error| CmdError::from(format!("Could not close directory handle: {error}")))?;
    Ok(out)
}

pub async fn create_folder(conn: &SmbConnection, parent: &str, name: &str) -> Result<(), CmdError> {
    let target = join(parent, name);
    let path = conn.root.clone().with_path(&target);
    let args = FileCreateArgs::make_create_new(
        SmbFileAttributes::new().with_directory(true),
        CreateOptions::new().with_directory_file(true),
    );
    let resource = conn.client.create_file(&path, &args).await.map_err(|error| CmdError::from(format!("Could not create folder: {error}")))?;
    resource.unwrap_dir().close().await.map_err(|error| CmdError::from(format!("Could not close new folder handle: {error}")))
}

pub async fn write_file(conn: &SmbConnection, parent: &str, name: &str, contents: Vec<u8>) -> Result<(), CmdError> {
    let target = join(parent, name);
    let path = conn.root.clone().with_path(&target);
    let args = FileCreateArgs::make_overwrite(SmbFileAttributes::new().with_archive(true), CreateOptions::new());
    let resource = conn.client.create_file(&path, &args).await.map_err(|error| CmdError::from(format!("Could not open {target} for writing: {error}")))?;
    let file = resource.unwrap_file();

    let mut offset = 0u64;
    while (offset as usize) < contents.len() {
        let written = file
            .write_at(&contents[offset as usize..], offset)
            .await
            .map_err(|error| CmdError::from(format!("Could not write {target}: {error}")))?;
        if written == 0 {
            return Err(CmdError::from(format!("Write to {target} stalled")));
        }
        offset += written as u64;
    }
    file.close().await.map_err(|error| CmdError::from(format!("Could not finish writing {target}: {error}")))
}

pub async fn read_file(conn: &SmbConnection, share: &str, remote_path: &str) -> Result<Vec<u8>, CmdError> {
    let path = conn.root.clone().with_path(remote_path);
    let resource = conn
        .client
        .create_file(&path, &FileCreateArgs::make_open_existing(FileAccessMask::new().with_generic_read(true)))
        .await
        .map_err(|error| CmdError::from(format!(r"Could not open \\{share}\{remote_path}: {error}")))?;
    let file = resource.unwrap_file();

    let len = file.get_len().await.map_err(|error| CmdError::from(format!("Could not read file size: {error}")))? as usize;
    let mut buf = vec![0u8; len];
    let mut offset = 0usize;
    while offset < len {
        let read = file
            .read_at(&mut buf[offset..], offset as u64)
            .await
            .map_err(|error| CmdError::from(format!("Could not read {remote_path}: {error}")))?;
        if read == 0 {
            break;
        }
        offset += read;
    }
    buf.truncate(offset);
    file.close().await.map_err(|error| CmdError::from(format!("Could not close file handle: {error}")))?;
    Ok(buf)
}

pub async fn rename(conn: &SmbConnection, from: &str, parent: &str, to_name: &str) -> Result<(), CmdError> {
    let path = conn.root.clone().with_path(from);
    let resource = conn
        .client
        .create_file(&path, &FileCreateArgs::make_open_existing(FileAccessMask::new().with_delete(true).with_generic_write(true)))
        .await
        .map_err(|error| CmdError::from(format!("Could not open {from} for renaming: {error}")))?;
    let target = join(parent, to_name);
    let info = FileRenameInformation { replace_if_exists: false.into(), root_directory: 0, file_name: target.into() };
    match resource {
        smb::Resource::File(file) => {
            file.set_info(info).await.map_err(|error| CmdError::from(format!("Could not rename: {error}")))?;
            file.close().await.map_err(|error| CmdError::from(format!("Could not close handle after rename: {error}")))
        }
        smb::Resource::Directory(dir) => {
            dir.set_info(info).await.map_err(|error| CmdError::from(format!("Could not rename: {error}")))?;
            dir.close().await.map_err(|error| CmdError::from(format!("Could not close handle after rename: {error}")))
        }
        smb::Resource::Pipe(_) => Err(CmdError::new("unsupported", format!("Cannot rename a pipe resource: {from}"))),
    }
}

pub async fn delete(conn: &SmbConnection, share: &str, remote_path: &str) -> Result<(), CmdError> {
    let (parent, name) = match remote_path.rsplit_once('/') {
        Some((p, n)) => (p, n),
        None => ("", remote_path),
    };
    let entries = list_dir_raw(conn, parent).await?;
    let is_dir = entries
        .iter()
        .find(|(entry_name, _)| entry_name == name)
        .map(|(_, info)| info.file_attributes.directory())
        .ok_or_else(|| CmdError::new("gone", format!("Not found: {remote_path}")))?;
    if is_dir {
        delete_dir_recursive(conn, share, remote_path).await?;
    }
    delete_one(conn, share, remote_path).await
}

/// Deletes a single file or (already-emptied) directory in place.
async fn delete_one(conn: &SmbConnection, share: &str, remote_path: &str) -> Result<(), CmdError> {
    let path = conn.root.clone().with_path(remote_path);
    let resource = conn
        .client
        .create_file(&path, &FileCreateArgs::make_open_existing(FileAccessMask::new().with_delete(true)))
        .await
        .map_err(|error| CmdError::from(format!(r"Could not open \\{share}\{remote_path}: {error}")))?;
    match resource {
        smb::Resource::File(file) => {
            file.set_info(FileDispositionInformation::default())
                .await
                .map_err(|error| CmdError::from(format!("Could not mark {remote_path} for deletion: {error}")))?;
            file.close().await.map_err(|error| CmdError::from(format!("Could not close handle after delete: {error}")))
        }
        smb::Resource::Directory(dir) => {
            dir.set_info(FileDispositionInformation::default())
                .await
                .map_err(|error| CmdError::from(format!("Could not mark {remote_path} for deletion: {error}")))?;
            dir.close().await.map_err(|error| CmdError::from(format!("Could not close handle after delete: {error}")))
        }
        smb::Resource::Pipe(_) => Err(CmdError::new("unsupported", format!("Cannot delete a pipe resource: {remote_path}"))),
    }
}

fn delete_dir_recursive<'a>(conn: &'a SmbConnection, share: &'a str, remote_path: &'a str) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), CmdError>> + Send + 'a>> {
    Box::pin(async move {
        let entries = list_dir_raw(conn, remote_path).await?;
        for (name, info) in entries {
            let child = join(remote_path, &name);
            if info.file_attributes.directory() {
                delete_dir_recursive(conn, share, &child).await?;
            } else {
                delete_one(conn, share, &child).await?;
            }
        }
        Ok(())
    })
}

fn join(parent: &str, name: &str) -> String {
    if parent.is_empty() {
        name.to_string()
    } else {
        format!("{}/{}", parent.trim_end_matches('/'), name)
    }
}
