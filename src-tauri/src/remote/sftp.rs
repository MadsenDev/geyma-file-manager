//! SFTP backend for network places. Connects via `russh` (SSH transport) and drives
//! the SFTP subsystem with `russh-sftp`, which does the actual file protocol work.

use std::sync::Arc;

use russh::client::{Config, Handle, Handler};
use russh::keys::ssh_key::PublicKey;
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::OpenFlags;

use crate::fsops::FsEntry;

use super::{sftp_child_uri, to_ms};

struct SshHandler;

impl Handler for SshHandler {
    type Error = russh::Error;

    // NOTE: accepts every server host key unconditionally — there is no known_hosts
    // store backing this, so this does not protect against man-in-the-middle attacks.
    // Acceptable for a first pass aimed at trusted home/office servers; revisit with a
    // real host-key trust store before treating this as hardened.
    async fn check_server_key(&mut self, _server_public_key: &PublicKey) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

pub struct SftpConnection {
    // Kept alive only to hold the underlying SSH session/channel open; never read after
    // construction, but dropping it would close the SFTP subsystem out from under `sftp`.
    _session: Handle<SshHandler>,
    sftp: SftpSession,
}

pub async fn connect(host: &str, port: u16, username: &str, password: &str) -> Result<SftpConnection, String> {
    let config = Arc::new(Config::default());
    let mut session = russh::client::connect(config, (host, port), SshHandler)
        .await
        .map_err(|error| format!("Could not connect to {host}:{port}: {error}"))?;
    let authed = session
        .authenticate_password(username, password)
        .await
        .map_err(|error| format!("Authentication failed: {error}"))?;
    if !authed.success() {
        return Err("Authentication failed: incorrect username or password".to_string());
    }
    let channel = session
        .channel_open_session()
        .await
        .map_err(|error| format!("Could not open channel: {error}"))?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|error| format!("Could not start the SFTP subsystem: {error}"))?;
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|error| format!("Could not start SFTP session: {error}"))?;
    Ok(SftpConnection { _session: session, sftp })
}

fn entry_from_metadata(name: String, path: String, metadata: &russh_sftp::protocol::FileAttributes) -> FsEntry {
    let modified_ms = metadata.modified().map(to_ms).unwrap_or(0);
    FsEntry {
        is_hidden: name.starts_with('.'),
        is_dir: metadata.is_dir(),
        size: if metadata.is_dir() { 0 } else { metadata.len() },
        modified_ms,
        // SFTP has no separate "created" time — mirror modified, same fallback used
        // for tar/7z's missing per-entry compressed size in archives.rs.
        created_ms: modified_ms,
        name,
        path,
    }
}

pub async fn list_dir(conn: &SftpConnection, host: &str, port: u16, username: &str, remote_path: &str) -> Result<Vec<FsEntry>, String> {
    let entries = conn
        .sftp
        .read_dir(remote_path)
        .await
        .map_err(|error| format!("Could not list directory: {error}"))?;
    Ok(entries
        .map(|entry| {
            let name = entry.file_name();
            let path = sftp_child_uri(host, port, username, remote_path, &name);
            entry_from_metadata(name, path, &entry.metadata())
        })
        .collect())
}

pub async fn stat(conn: &SftpConnection, full_path: &str, remote_path: &str) -> Result<FsEntry, String> {
    let metadata = conn.sftp.metadata(remote_path).await.map_err(|error| format!("Could not stat {remote_path}: {error}"))?;
    let name = remote_path.rsplit('/').next().filter(|s| !s.is_empty()).unwrap_or(remote_path).to_string();
    Ok(entry_from_metadata(name, full_path.to_string(), &metadata))
}

pub async fn create_folder(conn: &SftpConnection, parent: &str, name: &str) -> Result<(), String> {
    let target = join(parent, name);
    conn.sftp.create_dir(&target).await.map_err(|error| format!("Could not create folder: {error}"))
}

pub async fn write_file(conn: &SftpConnection, parent: &str, name: &str, contents: Vec<u8>) -> Result<(), String> {
    let target = join(parent, name);
    let mut file = conn
        .sftp
        .open_with_flags(&target, OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE)
        .await
        .map_err(|error| format!("Could not open {target} for writing: {error}"))?;
    use tokio::io::AsyncWriteExt;
    file.write_all(&contents).await.map_err(|error| format!("Could not write {target}: {error}"))?;
    file.shutdown().await.map_err(|error| format!("Could not finish writing {target}: {error}"))
}

pub async fn read_file(conn: &SftpConnection, remote_path: &str) -> Result<Vec<u8>, String> {
    conn.sftp.read(remote_path).await.map_err(|error| format!("Could not read {remote_path}: {error}"))
}

pub async fn rename(conn: &SftpConnection, from: &str, parent: &str, to_name: &str) -> Result<(), String> {
    let target = join(parent, to_name);
    conn.sftp.rename(from, &target).await.map_err(|error| format!("Could not rename: {error}"))
}

pub async fn delete(conn: &SftpConnection, remote_path: &str) -> Result<(), String> {
    let metadata = conn.sftp.metadata(remote_path).await.map_err(|error| format!("Could not stat {remote_path}: {error}"))?;
    if metadata.is_dir() {
        delete_dir_recursive(conn, remote_path).await
    } else {
        conn.sftp.remove_file(remote_path).await.map_err(|error| format!("Could not delete {remote_path}: {error}"))
    }
}

fn delete_dir_recursive<'a>(conn: &'a SftpConnection, remote_path: &'a str) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), String>> + Send + 'a>> {
    Box::pin(async move {
        let entries = conn
            .sftp
            .read_dir(remote_path)
            .await
            .map_err(|error| format!("Could not list {remote_path}: {error}"))?;
        for entry in entries {
            let name = entry.file_name();
            if name == "." || name == ".." {
                continue;
            }
            let child = join(remote_path, &name);
            if entry.metadata().is_dir() {
                delete_dir_recursive(conn, &child).await?;
            } else {
                conn.sftp.remove_file(&child).await.map_err(|error| format!("Could not delete {child}: {error}"))?;
            }
        }
        conn.sftp.remove_dir(remote_path).await.map_err(|error| format!("Could not remove directory {remote_path}: {error}"))
    })
}

fn join(parent: &str, name: &str) -> String {
    let base = parent.trim_end_matches('/');
    if base.is_empty() {
        format!("/{name}")
    } else {
        format!("{base}/{name}")
    }
}
