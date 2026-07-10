//! Network places: SFTP and SMB, addressed as `sftp://user@host:port/abs/path`
//! and `smb://user@host:port/Share/sub/path` respectively. These URIs flow through
//! the same `path: String` used everywhere else in the app (FsEntry.path, the
//! frontend's navigation state, working sets, ...) — `fsops::extract_archive`-style
//! per-format dispatch, but for whole filesystem backends instead of archive kinds.
//!
//! Scope: browse, rename, copy/move within a connection, delete (permanently — there's
//! no remote Trash), and transfer files to/from local disk. Deliberately NOT supported
//! over the network: symlinks, chmod/ownership, and archive extract-in-place — none of
//! those map cleanly onto SMB, and doing them "properly" per-protocol is out of scope
//! for this first pass.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::error::CmdError;
use crate::fsops::FsEntry;

pub mod discovery;
pub mod hostkeys;
pub mod sftp;
pub mod smb;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteAddr {
    Sftp {
        host: String,
        port: u16,
        username: String,
        /// Absolute path on the SFTP server, e.g. "/home/alice/docs". Always starts with '/'.
        path: String,
    },
    Smb {
        host: String,
        port: u16,
        username: String,
        share: String,
        /// Path within the share, using '/' separators, no leading slash. Empty string
        /// means the share root.
        path: String,
    },
}

impl RemoteAddr {
    /// The connection identity this address routes to, ignoring the path-within-connection —
    /// used as the session-cache key so browsing around a connection reuses one session.
    fn connection_key(&self) -> String {
        match self {
            RemoteAddr::Sftp { host, port, username, .. } => {
                format!("sftp://{username}@{host}:{port}")
            }
            RemoteAddr::Smb { host, port, username, share, .. } => {
                format!("smb://{username}@{host}:{port}/{share}")
            }
        }
    }
}

pub fn parse(path: &str) -> Option<RemoteAddr> {
    let url = url::Url::parse(path).ok()?;
    let host = url.host_str()?.to_string();
    let username = url.username();
    if username.is_empty() {
        return None;
    }
    let username = username.to_string();

    match url.scheme() {
        "sftp" => {
            let port = url.port().unwrap_or(22);
            let path = url.path().to_string();
            Some(RemoteAddr::Sftp { host, port, username, path })
        }
        "smb" => {
            let port = url.port().unwrap_or(445);
            let mut segments = url.path_segments()?;
            let share = segments.next().unwrap_or_default().to_string();
            if share.is_empty() {
                return None;
            }
            let path = segments.collect::<Vec<_>>().join("/");
            Some(RemoteAddr::Smb { host, port, username, share, path })
        }
        _ => None,
    }
}

/// Builds the sftp:// URI for a child of a listed directory, so entries returned from
/// `list_dir` carry a path the rest of the app can navigate into or operate on directly.
fn sftp_child_uri(host: &str, port: u16, username: &str, parent_path: &str, name: &str) -> String {
    let base = parent_path.trim_end_matches('/');
    format!("sftp://{username}@{host}:{port}{base}/{name}")
}

fn smb_child_uri(host: &str, port: u16, username: &str, share: &str, parent_path: &str, name: &str) -> String {
    if parent_path.is_empty() {
        format!("smb://{username}@{host}:{port}/{share}/{name}")
    } else {
        format!("smb://{username}@{host}:{port}/{share}/{parent_path}/{name}")
    }
}

const KEYRING_SERVICE: &str = "geyma-remote";

fn keyring_entry(connection_id: &str) -> Result<keyring::Entry, CmdError> {
    keyring::Entry::new(KEYRING_SERVICE, connection_id)
        .map_err(|error| CmdError::new("keyring_failed", error.to_string()))
}

/// Runs a blocking call (keyring, host-key store file IO) off the async runtime
/// thread — matches the `spawn_blocking` pattern already used for archive/extraction
/// work in fsops.rs.
async fn run_blocking<F, T>(f: F) -> Result<T, CmdError>
where
    F: FnOnce() -> Result<T, CmdError> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|error| CmdError::new("internal", format!("Background task failed: {error}")))?
}

#[tauri::command]
pub async fn keyring_save_password(connection_id: String, password: String) -> Result<(), CmdError> {
    run_blocking(move || {
        keyring_entry(&connection_id)?
            .set_password(&password)
            .map_err(|error| CmdError::new("keyring_failed", error.to_string()))
    })
    .await
}

#[tauri::command]
pub async fn keyring_load_password(connection_id: String) -> Result<Option<String>, CmdError> {
    run_blocking(move || match keyring_entry(&connection_id)?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(CmdError::new("keyring_failed", error.to_string())),
    })
    .await
}

#[tauri::command]
pub async fn keyring_delete_password(connection_id: String) -> Result<(), CmdError> {
    run_blocking(move || match keyring_entry(&connection_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(CmdError::new("keyring_failed", error.to_string())),
    })
    .await
}

/// Drops the pinned SFTP host key for `host:port` so the next connect re-pins whatever
/// the server presents (see remote/hostkeys.rs). The explicit "trust the new key" action
/// behind the host-key-mismatch prompt in the Network panel.
#[tauri::command]
pub async fn sftp_forget_host_key(host: String, port: u16) -> Result<(), CmdError> {
    run_blocking(move || {
        let store = hostkeys::store_path()?;
        hostkeys::forget(&store, &host, port)
    })
    .await
}

/// Live sessions, keyed by [`RemoteAddr::connection_key`]. Kept as app-managed Tauri
/// state so a session survives across command invocations; there is deliberately no
/// automatic reconnect-on-drop — a failed operation surfaces as an error and the user
/// reconnects from the Network panel, same as any other "connection lost" case.
#[derive(Default)]
pub struct RemoteSessions {
    pub sftp: Mutex<HashMap<String, Arc<sftp::SftpConnection>>>,
    pub smb: Mutex<HashMap<String, Arc<smb::SmbConnection>>>,
}

fn to_ms(t: std::time::SystemTime) -> i64 {
    t.duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn not_connected(addr: &RemoteAddr) -> CmdError {
    CmdError::new(
        "remote_not_connected",
        format!("Not connected to {} — reconnect from the Network panel", addr.connection_key()),
    )
}

fn not_remote(path: &str) -> CmdError {
    CmdError::new("invalid_path", format!("Not a remote path: {path}"))
}

#[tauri::command]
pub async fn remote_connect(
    protocol: String,
    host: String,
    port: u16,
    username: String,
    share: Option<String>,
    password: String,
    sessions: tauri::State<'_, RemoteSessions>,
) -> Result<String, CmdError> {
    match protocol.as_str() {
        "sftp" => {
            let addr = RemoteAddr::Sftp { host: host.clone(), port, username: username.clone(), path: "/".to_string() };
            let conn = sftp::connect(&host, port, &username, &password).await?;
            sessions.sftp.lock().await.insert(addr.connection_key(), Arc::new(conn));
            Ok(format!("sftp://{username}@{host}:{port}/"))
        }
        "smb" => {
            let share = share.ok_or_else(|| CmdError::new("invalid_input", "SMB connections require a share name"))?;
            let addr = RemoteAddr::Smb { host: host.clone(), port, username: username.clone(), share: share.clone(), path: String::new() };
            let conn = smb::connect(&host, port, &username, &password, &share).await?;
            sessions.smb.lock().await.insert(addr.connection_key(), Arc::new(conn));
            Ok(format!("smb://{username}@{host}:{port}/{share}"))
        }
        other => Err(CmdError::new("invalid_input", format!("Unknown protocol: {other}"))),
    }
}

#[tauri::command]
pub async fn remote_disconnect(
    protocol: String,
    host: String,
    port: u16,
    username: String,
    share: Option<String>,
    sessions: tauri::State<'_, RemoteSessions>,
) -> Result<(), CmdError> {
    match protocol.as_str() {
        "sftp" => {
            let addr = RemoteAddr::Sftp { host, port, username, path: "/".to_string() };
            sessions.sftp.lock().await.remove(&addr.connection_key());
        }
        "smb" => {
            let share = share.unwrap_or_default();
            let addr = RemoteAddr::Smb { host, port, username, share, path: String::new() };
            sessions.smb.lock().await.remove(&addr.connection_key());
        }
        other => return Err(CmdError::new("invalid_input", format!("Unknown protocol: {other}"))),
    }
    Ok(())
}

#[tauri::command]
pub async fn remote_list_dir(path: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<Vec<FsEntry>, CmdError> {
    let addr = parse(&path).ok_or_else(|| not_remote(&path))?;
    match &addr {
        RemoteAddr::Sftp { host, port, username, path: remote_path } => {
            let conn = sessions.sftp.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            sftp::list_dir(&conn, host, *port, username, remote_path).await
        }
        RemoteAddr::Smb { host, port, username, share, path: remote_path } => {
            let conn = sessions.smb.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            smb::list_dir(&conn, host, *port, username, share, remote_path).await
        }
    }
}

#[tauri::command]
pub async fn remote_stat(path: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<FsEntry, CmdError> {
    let addr = parse(&path).ok_or_else(|| not_remote(&path))?;
    match &addr {
        RemoteAddr::Sftp { path: remote_path, .. } => {
            let conn = sessions.sftp.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            sftp::stat(&conn, &path, remote_path).await
        }
        RemoteAddr::Smb { share, path: remote_path, .. } => {
            let conn = sessions.smb.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            smb::stat(&conn, &path, share, remote_path).await
        }
    }
}

#[tauri::command]
pub async fn remote_create_folder(parent: String, name: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<String, CmdError> {
    crate::fsops::validate_name(&name)?;
    let addr = parse(&parent).ok_or_else(|| not_remote(&parent))?;
    match &addr {
        RemoteAddr::Sftp { host, port, username, path: remote_path } => {
            let conn = sessions.sftp.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            sftp::create_folder(&conn, remote_path, &name).await?;
            Ok(sftp_child_uri(host, *port, username, remote_path, &name))
        }
        RemoteAddr::Smb { host, port, username, share, path: remote_path } => {
            let conn = sessions.smb.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            smb::create_folder(&conn, remote_path, &name).await?;
            Ok(smb_child_uri(host, *port, username, share, remote_path, &name))
        }
    }
}

#[tauri::command]
pub async fn remote_create_file(parent: String, name: String, contents: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<String, CmdError> {
    crate::fsops::validate_name(&name)?;
    let addr = parse(&parent).ok_or_else(|| not_remote(&parent))?;
    match &addr {
        RemoteAddr::Sftp { host, port, username, path: remote_path } => {
            let conn = sessions.sftp.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            sftp::write_file(&conn, remote_path, &name, contents.into_bytes()).await?;
            Ok(sftp_child_uri(host, *port, username, remote_path, &name))
        }
        RemoteAddr::Smb { host, port, username, share, path: remote_path } => {
            let conn = sessions.smb.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            smb::write_file(&conn, remote_path, &name, contents.into_bytes()).await?;
            Ok(smb_child_uri(host, *port, username, share, remote_path, &name))
        }
    }
}

#[tauri::command]
pub async fn remote_rename_path(from: String, to_name: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<String, CmdError> {
    crate::fsops::validate_name(&to_name)?;
    let addr = parse(&from).ok_or_else(|| not_remote(&from))?;
    match &addr {
        RemoteAddr::Sftp { host, port, username, path: remote_path } => {
            let conn = sessions.sftp.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            let parent = remote_path.rsplit_once('/').map(|(p, _)| if p.is_empty() { "/" } else { p }).unwrap_or("/");
            sftp::rename(&conn, remote_path, parent, &to_name).await?;
            Ok(sftp_child_uri(host, *port, username, parent, &to_name))
        }
        RemoteAddr::Smb { host, port, username, share, path: remote_path } => {
            let conn = sessions.smb.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            let parent = remote_path.rsplit_once('/').map(|(p, _)| p).unwrap_or("");
            smb::rename(&conn, remote_path, parent, &to_name).await?;
            Ok(smb_child_uri(host, *port, username, share, parent, &to_name))
        }
    }
}

/// Moves an entry to a different directory on the SAME connection (a rename with a new
/// parent, same as `remote_rename_path` but the caller supplies the destination directory
/// instead of just a new name in place). Moving between two different connections, or
/// between local disk and a remote one, goes through copy+delete instead — see
/// `remote_copy_path`/`upload_to_remote`/`download_from_remote`.
#[tauri::command]
pub async fn remote_move_path(from: String, to_dir: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<String, CmdError> {
    let from_addr = parse(&from).ok_or_else(|| not_remote(&from))?;
    let to_addr = parse(&to_dir).ok_or_else(|| not_remote(&to_dir))?;
    if from_addr.connection_key() != to_addr.connection_key() {
        return Err(CmdError::new("move_between_locations", "Source and destination are on different connections"));
    }
    match (&from_addr, &to_addr) {
        (RemoteAddr::Sftp { host, port, username, path: from_path, .. }, RemoteAddr::Sftp { path: to_parent, .. }) => {
            let conn = sessions.sftp.lock().await.get(&from_addr.connection_key()).cloned().ok_or_else(|| not_connected(&from_addr))?;
            let name = from_path.rsplit('/').next().filter(|s| !s.is_empty()).ok_or_else(|| CmdError::new("invalid_path", format!("Bad source path: {from}")))?;
            sftp::rename(&conn, from_path, to_parent, name).await?;
            Ok(sftp_child_uri(host, *port, username, to_parent, name))
        }
        (RemoteAddr::Smb { host, port, username, share, path: from_path, .. }, RemoteAddr::Smb { path: to_parent, .. }) => {
            let conn = sessions.smb.lock().await.get(&from_addr.connection_key()).cloned().ok_or_else(|| not_connected(&from_addr))?;
            let name = from_path.rsplit('/').next().filter(|s| !s.is_empty()).ok_or_else(|| CmdError::new("invalid_path", format!("Bad source path: {from}")))?;
            smb::rename(&conn, from_path, to_parent, name).await?;
            Ok(smb_child_uri(host, *port, username, share, to_parent, name))
        }
        _ => Err(CmdError::new("move_between_locations", "Source and destination use different protocols")),
    }
}

#[tauri::command]
pub async fn remote_delete_permanently(path: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<(), CmdError> {
    let addr = parse(&path).ok_or_else(|| not_remote(&path))?;
    match &addr {
        RemoteAddr::Sftp { path: remote_path, .. } => {
            let conn = sessions.sftp.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            sftp::delete(&conn, remote_path).await
        }
        RemoteAddr::Smb { share, path: remote_path, .. } => {
            let conn = sessions.smb.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            smb::delete(&conn, share, remote_path).await
        }
    }
}

/// Kept in sync with `preview::MAX_TEXT_BYTES`, the cap local text previews already
/// enforce. Unlike the local path, `sftp::read_file`/`smb::read_file` have no partial-read
/// support to stream up to a limit, so this checks the remote size via `stat` first and
/// refuses outright rather than pulling an arbitrarily large file into memory just to
/// preview it — a malicious or compromised server could otherwise OOM the client by
/// serving one huge file to `remote_read_text_file`.
const MAX_REMOTE_TEXT_BYTES: u64 = 1024 * 1024;

#[tauri::command]
pub async fn remote_read_text_file(path: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<String, CmdError> {
    let size = remote_stat(path.clone(), sessions.clone()).await?.size;
    if size > MAX_REMOTE_TEXT_BYTES {
        return Err(CmdError::new(
            "preview_too_large",
            format!("File is too large to preview ({size} bytes; the limit is {MAX_REMOTE_TEXT_BYTES} bytes)"),
        ));
    }
    let bytes = read_remote_bytes(&path, &sessions).await?;
    String::from_utf8(bytes).map_err(|error| CmdError::new("not_text", format!("File is not UTF-8 text: {error}")))
}

async fn read_remote_bytes(path: &str, sessions: &tauri::State<'_, RemoteSessions>) -> Result<Vec<u8>, CmdError> {
    let addr = parse(path).ok_or_else(|| not_remote(&path))?;
    match &addr {
        RemoteAddr::Sftp { path: remote_path, .. } => {
            let conn = sessions.sftp.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            sftp::read_file(&conn, remote_path).await
        }
        RemoteAddr::Smb { share, path: remote_path, .. } => {
            let conn = sessions.smb.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            smb::read_file(&conn, share, remote_path).await
        }
    }
}

/// Copies a file from local disk to a remote directory (used for uploads and for the
/// "copy into a remote folder" side of drag-and-drop / paste).
#[tauri::command]
pub async fn upload_to_remote(local_path: String, remote_dest_dir: String, remote_name: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<String, CmdError> {
    crate::fsops::validate_name(&remote_name)?;
    let bytes = tokio::fs::read(&local_path).await.map_err(|error| CmdError::from(error).context("Could not read local file"))?;
    let addr = parse(&remote_dest_dir).ok_or_else(|| not_remote(&remote_dest_dir))?;
    match &addr {
        RemoteAddr::Sftp { host, port, username, path: remote_path } => {
            let conn = sessions.sftp.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            sftp::write_file(&conn, remote_path, &remote_name, bytes).await?;
            Ok(sftp_child_uri(host, *port, username, remote_path, &remote_name))
        }
        RemoteAddr::Smb { host, port, username, share, path: remote_path } => {
            let conn = sessions.smb.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            smb::write_file(&conn, remote_path, &remote_name, bytes).await?;
            Ok(smb_child_uri(host, *port, username, share, remote_path, &remote_name))
        }
    }
}

/// Copies a file from a remote server to local disk (downloads, and the "copy out of a
/// remote folder" side of drag-and-drop / paste).
#[tauri::command]
pub async fn download_from_remote(remote_path: String, local_dest_dir: String, local_name: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<String, CmdError> {
    crate::fsops::validate_name(&local_name)?;
    let bytes = read_remote_bytes(&remote_path, &sessions).await?;
    let target = std::path::PathBuf::from(&local_dest_dir).join(&local_name);
    tokio::fs::write(&target, bytes).await.map_err(|error| CmdError::from(error).context("Could not write local file"))?;
    Ok(target.to_string_lossy().to_string())
}

/// Copies a file between two remote locations. If they're on the same connection this
/// still round-trips through memory rather than asking the server to copy server-side
/// (SFTP has no portable server-side copy; keeping one code path for both protocols
/// keeps this simple) — fine for the file sizes a file manager's copy/paste deals with.
#[tauri::command]
pub async fn remote_copy_path(from: String, to_dir: String, to_name: String, sessions: tauri::State<'_, RemoteSessions>) -> Result<String, CmdError> {
    crate::fsops::validate_name(&to_name)?;
    let bytes = read_remote_bytes(&from, &sessions).await?;
    let addr = parse(&to_dir).ok_or_else(|| not_remote(&to_dir))?;
    match &addr {
        RemoteAddr::Sftp { host, port, username, path: remote_path } => {
            let conn = sessions.sftp.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            sftp::write_file(&conn, remote_path, &to_name, bytes).await?;
            Ok(sftp_child_uri(host, *port, username, remote_path, &to_name))
        }
        RemoteAddr::Smb { host, port, username, share, path: remote_path } => {
            let conn = sessions.smb.lock().await.get(&addr.connection_key()).cloned().ok_or_else(|| not_connected(&addr))?;
            smb::write_file(&conn, remote_path, &to_name, bytes).await?;
            Ok(smb_child_uri(host, *port, username, share, remote_path, &to_name))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_sftp_uris() {
        let addr = parse("sftp://alice@nas.local:2222/home/alice/docs").unwrap();
        assert_eq!(
            addr,
            RemoteAddr::Sftp { host: "nas.local".into(), port: 2222, username: "alice".into(), path: "/home/alice/docs".into() }
        );
    }

    #[test]
    fn defaults_sftp_port_to_22() {
        let addr = parse("sftp://alice@nas.local/").unwrap();
        assert_eq!(addr, RemoteAddr::Sftp { host: "nas.local".into(), port: 22, username: "alice".into(), path: "/".into() });
    }

    #[test]
    fn parses_smb_uris_with_share_and_subpath() {
        let addr = parse("smb://bob@nas.local:445/Media/Movies/2020").unwrap();
        assert_eq!(
            addr,
            RemoteAddr::Smb { host: "nas.local".into(), port: 445, username: "bob".into(), share: "Media".into(), path: "Movies/2020".into() }
        );
    }

    #[test]
    fn parses_smb_share_root() {
        let addr = parse("smb://bob@nas.local/Media").unwrap();
        assert_eq!(
            addr,
            RemoteAddr::Smb { host: "nas.local".into(), port: 445, username: "bob".into(), share: "Media".into(), path: "".into() }
        );
    }

    #[test]
    fn rejects_uris_without_a_username() {
        assert!(parse("sftp://nas.local/path").is_none());
        assert!(parse("smb://nas.local/Share").is_none());
    }

    #[test]
    fn rejects_non_remote_schemes_and_plain_paths() {
        assert!(parse("/home/user/docs").is_none());
        assert!(parse("file:///home/user").is_none());
        assert!(parse("sftp://a@b/c").is_some());
        assert!(parse("smb://a@b/c").is_some());
    }

    #[test]
    fn connection_key_ignores_the_path_within_connection() {
        let a = parse("sftp://alice@nas.local:22/dir/a").unwrap();
        let b = parse("sftp://alice@nas.local:22/dir/b/c").unwrap();
        assert_eq!(a.connection_key(), b.connection_key());
    }
}

