//! Trust-on-first-use (TOFU) host-key store for SFTP connections.
//!
//! The first successful handshake with a host pins the server's public-key fingerprint
//! (SHA-256, the same `SHA256:...` form OpenSSH prints) in a JSON file under the app
//! data dir. Later connections require the same fingerprint: a changed key fails with
//! code `host_key_mismatch` instead of silently trusting the new key, since a changed
//! key means either a reinstalled/rotated server or a man-in-the-middle. "Trust the new
//! key" is an explicit user action (the `sftp_forget_host_key` command) that drops the
//! pin so the next connect re-pins — mirroring `ssh`'s remove-from-known_hosts flow.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::error::CmdError;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PinnedKey {
    /// "SHA256:<base64>" fingerprint of the server's public key.
    pub fingerprint: String,
    /// Key algorithm name as presented, e.g. "ssh-ed25519" — shown in the mismatch
    /// message so the user can compare against what the server admin reports.
    pub algorithm: String,
    pub added_ms: i64,
}

type Store = HashMap<String, PinnedKey>;

/// Serializes read-modify-write cycles on the store file so two concurrent connects
/// can't drop each other's freshly pinned entries.
static STORE_LOCK: Mutex<()> = Mutex::new(());

fn lock() -> std::sync::MutexGuard<'static, ()> {
    STORE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Store key for a host — hostname is case-insensitive in practice, so normalize it.
pub fn host_id(host: &str, port: u16) -> String {
    format!("{}:{port}", host.to_ascii_lowercase())
}

/// Production store location; tests pass their own path into the functions below.
/// Same `dirs::data_dir()/geyma/` base the app trash uses (see `fsops::app_trash_dir`).
pub fn store_path() -> Result<PathBuf, CmdError> {
    let base = dirs::data_dir().ok_or_else(|| CmdError::new("internal", "Could not determine the user data directory"))?;
    Ok(base.join("geyma").join("sftp_known_hosts.json"))
}

fn load(path: &Path) -> Result<Store, CmdError> {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|error| {
            // Fail closed: an unreadable store means keys can't be verified, so refuse
            // to connect rather than silently re-trusting whatever the server presents.
            CmdError::new(
                "internal",
                format!("The saved server keys file is damaged ({}) — fix or delete it and reconnect: {error}", path.display()),
            )
        }),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Store::new()),
        Err(error) => Err(CmdError::from(error).context("Could not read the saved server keys")),
    }
}

fn save(path: &Path, store: &Store) -> Result<(), CmdError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_vec_pretty(store).map_err(|error| CmdError::new("internal", error.to_string()))?;
    std::fs::write(path, json).map_err(|error| CmdError::from(error).context("Could not save the server key"))
}

pub fn pinned(path: &Path, host: &str, port: u16) -> Result<Option<PinnedKey>, CmdError> {
    let _guard = lock();
    Ok(load(path)?.remove(&host_id(host, port)))
}

pub fn pin(path: &Path, host: &str, port: u16, fingerprint: &str, algorithm: &str) -> Result<(), CmdError> {
    let _guard = lock();
    let mut store = load(path)?;
    store.insert(
        host_id(host, port),
        PinnedKey {
            fingerprint: fingerprint.to_string(),
            algorithm: algorithm.to_string(),
            added_ms: super::to_ms(std::time::SystemTime::now()),
        },
    );
    save(path, &store)
}

pub fn forget(path: &Path, host: &str, port: u16) -> Result<(), CmdError> {
    let _guard = lock();
    let mut store = load(path)?;
    if store.remove(&host_id(host, port)).is_some() {
        save(path, &store)?;
    }
    Ok(())
}

/// The `host_key_mismatch` error `sftp::connect` raises when a pinned host presents a
/// different key. Lives here (rather than inline in connect) so the copy is unit-testable.
pub fn mismatch_error(host: &str, port: u16, pinned: &str, presented: &str, algorithm: &str) -> CmdError {
    CmdError::new(
        "host_key_mismatch",
        format!(
            "The server key for {host}:{port} has changed: expected {pinned} but the server presented {presented} ({algorithm}). \
             If the server was reinstalled or its key rotated, trust the new key from the Network panel and reconnect; \
             otherwise the connection may be intercepted."
        ),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_store(tag: &str) -> PathBuf {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("geyma-hostkeys-{tag}-{nonce}")).join("sftp_known_hosts.json")
    }

    #[test]
    fn missing_store_means_no_pin() {
        let path = temp_store("missing");
        assert!(pinned(&path, "nas.local", 22).unwrap().is_none());
    }

    #[test]
    fn pin_then_lookup_roundtrips() {
        let path = temp_store("roundtrip");
        pin(&path, "nas.local", 22, "SHA256:abc", "ssh-ed25519").unwrap();
        let found = pinned(&path, "nas.local", 22).unwrap().unwrap();
        assert_eq!(found.fingerprint, "SHA256:abc");
        assert_eq!(found.algorithm, "ssh-ed25519");
        assert!(found.added_ms > 0);
        // Different port is a different identity.
        assert!(pinned(&path, "nas.local", 2222).unwrap().is_none());
    }

    #[test]
    fn host_lookup_is_case_insensitive() {
        let path = temp_store("case");
        pin(&path, "NAS.Local", 22, "SHA256:abc", "ssh-ed25519").unwrap();
        assert!(pinned(&path, "nas.local", 22).unwrap().is_some());
    }

    #[test]
    fn repin_overwrites() {
        let path = temp_store("repin");
        pin(&path, "nas.local", 22, "SHA256:old", "ssh-rsa").unwrap();
        pin(&path, "nas.local", 22, "SHA256:new", "ssh-ed25519").unwrap();
        assert_eq!(pinned(&path, "nas.local", 22).unwrap().unwrap().fingerprint, "SHA256:new");
    }

    #[test]
    fn forget_drops_only_that_host() {
        let path = temp_store("forget");
        pin(&path, "a.local", 22, "SHA256:a", "ssh-ed25519").unwrap();
        pin(&path, "b.local", 22, "SHA256:b", "ssh-ed25519").unwrap();
        forget(&path, "a.local", 22).unwrap();
        assert!(pinned(&path, "a.local", 22).unwrap().is_none());
        assert!(pinned(&path, "b.local", 22).unwrap().is_some());
        // Forgetting an unknown host is a no-op, not an error.
        forget(&path, "c.local", 22).unwrap();
    }

    #[test]
    fn corrupt_store_fails_closed() {
        let path = temp_store("corrupt");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, b"not json").unwrap();
        let err = pinned(&path, "nas.local", 22).unwrap_err();
        assert_eq!(err.code, "internal");
        assert!(err.message.contains("damaged"));
    }

    #[test]
    fn mismatch_error_carries_the_stable_code_and_both_fingerprints() {
        let err = mismatch_error("nas.local", 22, "SHA256:old", "SHA256:new", "ssh-ed25519");
        assert_eq!(err.code, "host_key_mismatch");
        assert!(err.message.contains("SHA256:old"));
        assert!(err.message.contains("SHA256:new"));
    }
}
