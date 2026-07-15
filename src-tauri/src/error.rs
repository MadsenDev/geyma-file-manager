//! The one error type every `#[tauri::command]` rejects with.
//!
//! A [`CmdError`] serializes as `{ code, message }`: `code` is a stable, locale-independent
//! identifier the frontend maps to a translated, user-facing explanation (see
//! `src/lib/errors.ts` and the `errors.*` group in `src/i18n/en.json` — the two code lists
//! must stay in sync), and `message` is the raw English detail, shown verbatim only when
//! the frontend has no translation for the code.
//!
//! Three ways a `CmdError` gets made:
//! - `From<std::io::Error>` — the precise path: maps the OS errno (or `ErrorKind` when
//!   there is no errno) to a code. Command bodies use plain `?` on `std::io` results.
//! - `CmdError::new(code, message)` — for named sentinel errors ("already exists",
//!   "not connected", auth failures, ...) raised by our own checks.
//! - `From<String>` — the fallback for helper modules that still produce string errors:
//!   recovers the errno from the "(os error N)" suffix `std::io::Error`'s Display always
//!   embeds, otherwise passes the message through with code `unknown`.

use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct CmdError {
    pub code: String,
    pub message: String,
}

impl CmdError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        CmdError { code: code.to_string(), message: message.into() }
    }

    /// Prepends human context to the message, keeping the code:
    /// `CmdError::from(io_error).context("Could not open archive")`.
    pub fn context(mut self, prefix: &str) -> Self {
        self.message = format!("{prefix}: {}", self.message);
        self
    }

    /// Replaces an `unknown` code with a caller-supplied one, keeping any more specific
    /// classification `From<String>` already made. For failure sites where the operation
    /// itself implies a decent default ("connecting failed") but the underlying message
    /// may reveal the real cause (an SMB `STATUS_LOGON_FAILURE` is a sign-in problem,
    /// not a network one).
    pub fn or_code(mut self, code: &str) -> Self {
        if self.code == "unknown" {
            self.code = code.to_string();
        }
        self
    }
}

impl std::fmt::Display for CmdError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.message, self.code)
    }
}

impl std::error::Error for CmdError {}

/// Linux errno → code. The list mirrors `OS_ERROR_CODES` in `src/lib/errors.ts`;
/// keep the two in sync when adding entries.
fn code_for_errno(errno: i32) -> Option<&'static str> {
    Some(match errno {
        1 => "not_permitted",
        2 => "gone",
        5 => "io_failed",
        13 => "permission_denied",
        16 | 26 => "in_use",
        17 => "already_exists",
        18 => "cross_device",
        20 => "expected_folder",
        21 => "expected_file",
        22 => "invalid_input",
        24 => "too_many_open",
        28 | 122 => "disk_full",
        30 => "read_only",
        36 => "name_too_long",
        39 => "not_empty",
        40 => "symlink_loop",
        101 => "host_unreachable",
        104 | 32 => "connection_lost",
        110 => "timed_out",
        111 => "connection_refused",
        113 => "host_unreachable",
        116 => "gone", // ESTALE: the handle's file is no longer reachable
        _ => return None,
    })
}

fn code_for_kind(kind: std::io::ErrorKind) -> &'static str {
    use std::io::ErrorKind as K;
    match kind {
        K::NotFound => "gone",
        K::PermissionDenied => "permission_denied",
        K::AlreadyExists => "already_exists",
        K::DirectoryNotEmpty => "not_empty",
        K::IsADirectory => "expected_file",
        K::NotADirectory => "expected_folder",
        K::StorageFull | K::QuotaExceeded => "disk_full",
        K::ReadOnlyFilesystem => "read_only",
        K::CrossesDevices => "cross_device",
        K::ResourceBusy | K::ExecutableFileBusy => "in_use",
        K::InvalidFilename => "invalid_name",
        K::InvalidInput => "invalid_input",
        K::TimedOut => "timed_out",
        K::ConnectionRefused => "connection_refused",
        K::ConnectionReset | K::ConnectionAborted | K::BrokenPipe => "connection_lost",
        K::HostUnreachable | K::NetworkUnreachable | K::NetworkDown => "host_unreachable",
        K::StaleNetworkFileHandle => "gone",
        K::Unsupported => "unsupported",
        _ => "io_failed",
    }
}

impl From<std::io::Error> for CmdError {
    fn from(error: std::io::Error) -> Self {
        let code = error
            .raw_os_error()
            .and_then(code_for_errno)
            .unwrap_or_else(|| code_for_kind(error.kind()));
        CmdError::new(code, error.to_string())
    }
}

/// Classifies a stringly-typed error from a helper module. `std::io::Error`'s Display
/// always ends in a locale-independent "(os error N)" even when the message text is
/// localized, so an errno buried in a context-wrapped string ("Could not open archive:
/// ... (os error 13)") still gets a precise code.
impl From<String> for CmdError {
    fn from(message: String) -> Self {
        let errno_code = message
            .rsplit_once("(os error ")
            .and_then(|(_, tail)| tail.strip_suffix(')'))
            .and_then(|digits| digits.parse::<i32>().ok())
            .and_then(code_for_errno);
        let code = errno_code.unwrap_or_else(|| {
            // Remote-protocol (SFTP/SMB) errors carry no errno; recognize the handful of
            // stable English status phrases (and SMB NT_STATUS names) the protocol
            // crates embed in their messages.
            let lower = message.to_ascii_lowercase();
            if lower.contains("logon_failure") || lower.contains("logon failure") || lower.contains("password_expired") || lower.contains("account_disabled") || lower.contains("account_locked_out") {
                "auth_failed"
            } else if lower.contains("permission denied") || lower.contains("access denied") || lower.contains("access is denied") || lower.contains("access_denied") {
                "permission_denied"
            } else if lower.contains("no such file") || lower.contains("not found") || lower.contains("object_name_not_found") || lower.contains("object_path_not_found") || lower.contains("bad_network_name") {
                "gone"
            } else if lower.contains("already exists") || lower.contains("file exists") || lower.contains("name collision") || lower.contains("object_name_collision") {
                "already_exists"
            } else if lower.contains("connection reset") || lower.contains("connection closed") || lower.contains("broken pipe") || lower.contains("connection_reset") {
                "connection_lost"
            } else if lower.contains("timed out") || lower.contains("timeout") {
                "timed_out"
            } else {
                "unknown"
            }
        });
        CmdError::new(code, message)
    }
}

impl From<&str> for CmdError {
    fn from(message: &str) -> Self {
        CmdError::from(message.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn io_errors_map_errno_to_a_stable_code() {
        let err = CmdError::from(std::io::Error::from_raw_os_error(13));
        assert_eq!(err.code, "permission_denied");
        assert!(err.message.contains("os error 13"));
        assert_eq!(CmdError::from(std::io::Error::from_raw_os_error(28)).code, "disk_full");
        assert_eq!(CmdError::from(std::io::Error::from_raw_os_error(2)).code, "gone");
    }

    #[test]
    fn io_errors_without_an_errno_fall_back_to_the_kind() {
        let err = CmdError::from(std::io::Error::new(std::io::ErrorKind::NotFound, "made up"));
        assert_eq!(err.code, "gone");
        let err = CmdError::from(std::io::Error::other("made up"));
        assert_eq!(err.code, "io_failed");
    }

    #[test]
    fn string_errors_recover_the_embedded_errno() {
        let err = CmdError::from("Could not open archive: denied (os error 13)".to_string());
        assert_eq!(err.code, "permission_denied");
        assert_eq!(err.message, "Could not open archive: denied (os error 13)");
    }

    #[test]
    fn string_errors_without_an_errno_stay_unknown() {
        let err = CmdError::from("Could not rename: SFTP failure".to_string());
        assert_eq!(err.code, "unknown");
    }

    #[test]
    fn smb_nt_status_names_classify_to_specific_codes() {
        let auth = CmdError::from(r"Could not connect to \\nas\Media: Server returned STATUS_LOGON_FAILURE".to_string());
        assert_eq!(auth.code, "auth_failed");
        let denied = CmdError::from("Could not list shares on nas: STATUS_ACCESS_DENIED".to_string());
        assert_eq!(denied.code, "permission_denied");
        let missing = CmdError::from("Could not open directory: STATUS_OBJECT_NAME_NOT_FOUND".to_string());
        assert_eq!(missing.code, "gone");
    }

    #[test]
    fn or_code_only_replaces_unknown() {
        let generic = CmdError::from("some opaque transport failure".to_string()).or_code("connect_failed");
        assert_eq!(generic.code, "connect_failed");
        let auth = CmdError::from("STATUS_LOGON_FAILURE".to_string()).or_code("connect_failed");
        assert_eq!(auth.code, "auth_failed");
    }

    #[test]
    fn serializes_as_code_and_message() {
        let json = serde_json::to_string(&CmdError::new("already_exists", "taken")).unwrap();
        assert_eq!(json, r#"{"code":"already_exists","message":"taken"}"#);
    }
}
