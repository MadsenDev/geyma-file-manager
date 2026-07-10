//! SFTP backend for network places. Connects via `russh` (SSH transport) and drives
//! the SFTP subsystem with `russh-sftp`, which does the actual file protocol work.

use std::sync::{Arc, Mutex as StdMutex};

use russh::client::{Config, Handle, Handler};
use russh::keys::ssh_key::{HashAlg, PublicKey};
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::OpenFlags;

use crate::error::CmdError;
use crate::fsops::FsEntry;

use super::{hostkeys, sftp_child_uri, to_ms};

/// What the server presented during the handshake, recorded by `check_server_key` so
/// `connect` can pin a first-seen key once the handshake succeeds, or turn a rejected
/// changed key into a `host_key_mismatch` error (russh itself only surfaces a generic
/// "unknown key" failure that would classify as `connect_failed`).
struct PresentedKey {
    fingerprint: String,
    algorithm: String,
    accepted: bool,
}

struct SshHandler {
    /// Fingerprint pinned by a previous connect, if any (TOFU: absent on first contact).
    expected_fingerprint: Option<String>,
    presented: Arc<StdMutex<Option<PresentedKey>>>,
}

impl Handler for SshHandler {
    type Error = russh::Error;

    // Trust-on-first-use (see remote/hostkeys.rs): with no pinned fingerprint any key is
    // accepted here and pinned by `connect` after the handshake completes; with one, only
    // the identical key is accepted. Weaker than known_hosts-style pre-verification on
    // the very first contact, but every later connect detects a swapped server.
    async fn check_server_key(&mut self, server_public_key: &PublicKey) -> Result<bool, Self::Error> {
        let fingerprint = server_public_key.fingerprint(HashAlg::Sha256).to_string();
        let accepted = match &self.expected_fingerprint {
            Some(expected) => *expected == fingerprint,
            None => true,
        };
        *self.presented.lock().unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(PresentedKey {
            fingerprint,
            algorithm: server_public_key.algorithm().to_string(),
            accepted,
        });
        Ok(accepted)
    }
}

pub struct SftpConnection {
    // Kept alive only to hold the underlying SSH session/channel open; never read after
    // construction, but dropping it would close the SFTP subsystem out from under `sftp`.
    _session: Handle<SshHandler>,
    sftp: SftpSession,
}

pub async fn connect(host: &str, port: u16, username: &str, password: &str) -> Result<SftpConnection, CmdError> {
    let store = hostkeys::store_path()?;
    let pinned = hostkeys::pinned(&store, host, port)?;
    let presented = Arc::new(StdMutex::new(None));
    let handler = SshHandler {
        expected_fingerprint: pinned.as_ref().map(|key| key.fingerprint.clone()),
        presented: presented.clone(),
    };
    let config = Arc::new(Config::default());
    let mut session = match russh::client::connect(config, (host, port), handler).await {
        Ok(session) => session,
        Err(error) => {
            let seen = presented.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).take();
            if let (Some(seen), Some(pinned)) = (&seen, &pinned) {
                if !seen.accepted {
                    return Err(hostkeys::mismatch_error(host, port, &pinned.fingerprint, &seen.fingerprint, &seen.algorithm));
                }
            }
            return Err(CmdError::new("connect_failed", format!("Could not connect to {host}:{port}: {error}")));
        }
    };
    if pinned.is_none() {
        // First contact: pin what the handshake accepted. Pinned before auth, like ssh's
        // known_hosts write, so a wrong-password attempt still records the server identity.
        if let Some(seen) = presented.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).take() {
            hostkeys::pin(&store, host, port, &seen.fingerprint, &seen.algorithm)?;
        }
    }
    let authed = session
        .authenticate_password(username, password)
        .await
        .map_err(|error| CmdError::new("auth_failed", format!("Authentication failed: {error}")))?;
    if !authed.success() {
        return Err(CmdError::new("auth_failed", "Authentication failed: incorrect username or password"));
    }
    let channel = session
        .channel_open_session()
        .await
        .map_err(|error| CmdError::from(format!("Could not open channel: {error}")))?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|error| CmdError::from(format!("Could not start the SFTP subsystem: {error}")))?;
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|error| CmdError::from(format!("Could not start SFTP session: {error}")))?;
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

pub async fn list_dir(conn: &SftpConnection, host: &str, port: u16, username: &str, remote_path: &str) -> Result<Vec<FsEntry>, CmdError> {
    let entries = conn
        .sftp
        .read_dir(remote_path)
        .await
        .map_err(|error| CmdError::from(format!("Could not list directory: {error}")))?;
    Ok(entries
        .map(|entry| {
            let name = entry.file_name();
            let path = sftp_child_uri(host, port, username, remote_path, &name);
            entry_from_metadata(name, path, &entry.metadata())
        })
        .collect())
}

pub async fn stat(conn: &SftpConnection, full_path: &str, remote_path: &str) -> Result<FsEntry, CmdError> {
    let metadata = conn.sftp.metadata(remote_path).await.map_err(|error| CmdError::from(format!("Could not stat {remote_path}: {error}")))?;
    let name = remote_path.rsplit('/').next().filter(|s| !s.is_empty()).unwrap_or(remote_path).to_string();
    Ok(entry_from_metadata(name, full_path.to_string(), &metadata))
}

pub async fn create_folder(conn: &SftpConnection, parent: &str, name: &str) -> Result<(), CmdError> {
    let target = join(parent, name);
    conn.sftp.create_dir(&target).await.map_err(|error| CmdError::from(format!("Could not create folder: {error}")))
}

pub async fn write_file(conn: &SftpConnection, parent: &str, name: &str, contents: Vec<u8>) -> Result<(), CmdError> {
    let target = join(parent, name);
    let mut file = conn
        .sftp
        .open_with_flags(&target, OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE)
        .await
        .map_err(|error| CmdError::from(format!("Could not open {target} for writing: {error}")))?;
    use tokio::io::AsyncWriteExt;
    file.write_all(&contents).await.map_err(|error| CmdError::from(format!("Could not write {target}: {error}")))?;
    file.shutdown().await.map_err(|error| CmdError::from(format!("Could not finish writing {target}: {error}")))
}

pub async fn read_file(conn: &SftpConnection, remote_path: &str) -> Result<Vec<u8>, CmdError> {
    conn.sftp.read(remote_path).await.map_err(|error| CmdError::from(format!("Could not read {remote_path}: {error}")))
}

pub async fn rename(conn: &SftpConnection, from: &str, parent: &str, to_name: &str) -> Result<(), CmdError> {
    let target = join(parent, to_name);
    conn.sftp.rename(from, &target).await.map_err(|error| CmdError::from(format!("Could not rename: {error}")))
}

pub async fn delete(conn: &SftpConnection, remote_path: &str) -> Result<(), CmdError> {
    let metadata = conn.sftp.metadata(remote_path).await.map_err(|error| CmdError::from(format!("Could not stat {remote_path}: {error}")))?;
    if metadata.is_dir() {
        delete_dir_recursive(conn, remote_path).await
    } else {
        conn.sftp.remove_file(remote_path).await.map_err(|error| CmdError::from(format!("Could not delete {remote_path}: {error}")))
    }
}

fn delete_dir_recursive<'a>(conn: &'a SftpConnection, remote_path: &'a str) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), CmdError>> + Send + 'a>> {
    Box::pin(async move {
        let entries = conn
            .sftp
            .read_dir(remote_path)
            .await
            .map_err(|error| CmdError::from(format!("Could not list {remote_path}: {error}")))?;
        for entry in entries {
            let name = entry.file_name();
            if name == "." || name == ".." {
                continue;
            }
            let child = join(remote_path, &name);
            if entry.metadata().is_dir() {
                delete_dir_recursive(conn, &child).await?;
            } else {
                conn.sftp.remove_file(&child).await.map_err(|error| CmdError::from(format!("Could not delete {child}: {error}")))?;
            }
        }
        conn.sftp.remove_dir(remote_path).await.map_err(|error| CmdError::from(format!("Could not remove directory {remote_path}: {error}")))
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
