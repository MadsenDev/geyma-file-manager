//! Localhost HTTP server for streaming media into the webview.
//!
//! webkit2gtk deadlocks when <audio>/<video> elements stream through Tauri's
//! asset:// custom protocol (the media backend issues blocking range requests
//! on the UI process), so media is served over plain HTTP with Range support
//! instead. The server binds 127.0.0.1 on an ephemeral port and requires a
//! per-session random token so other local processes/pages can't read files
//! through it. Defense in depth on top of the token: the token comparison is
//! constant-time, the Host header must be the server's own 127.0.0.1 origin
//! (which defeats DNS-rebinding pages, whose requests carry the attacker's
//! hostname), and only extensions the previewer actually renders are served —
//! this is a media server, not a general file-read endpoint.

use std::fs::File;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::time::Duration;

pub struct MediaServer {
    pub port: u16,
    pub token: String,
}

#[derive(serde::Serialize)]
pub struct MediaServerInfo {
    port: u16,
    token: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaPlaybackSupport {
    available: bool,
    title: String,
    message: String,
    details: Option<String>,
    install_command: Option<String>,
}

#[tauri::command]
pub fn media_server_info(state: tauri::State<'_, MediaServer>) -> MediaServerInfo {
    MediaServerInfo {
        port: state.port,
        token: state.token.clone(),
    }
}

/// Checks the native media prerequisite before the frontend creates an
/// `<audio>` or `<video>` element. On affected WebKitGTK versions, creating the
/// element without an audio sink can hang the web process before JavaScript
/// receives an error event, so this must be a preflight rather than an
/// after-the-fact playback error handler.
#[tauri::command]
pub async fn media_playback_support() -> Result<MediaPlaybackSupport, String> {
    #[cfg(target_os = "linux")]
    {
        tauri::async_runtime::spawn_blocking(check_linux_media_playback)
            .await
            .map_err(|error| format!("Media support check failed: {error}"))
    }
    #[cfg(not(target_os = "linux"))]
    {
        Ok(MediaPlaybackSupport {
            available: true,
            title: String::new(),
            message: String::new(),
            details: None,
            install_command: None,
        })
    }
}

#[cfg(target_os = "linux")]
fn check_linux_media_playback() -> MediaPlaybackSupport {
    match probe_gstreamer_audio_sink() {
        Ok(true) => MediaPlaybackSupport {
            available: true,
            title: String::new(),
            message: String::new(),
            details: None,
            install_command: None,
        },
        Ok(false) => MediaPlaybackSupport {
            available: false,
            title: "Audio output support is missing".to_string(),
            message: "Geyma stopped the preview before opening Linux's media pipeline because the required GStreamer audio output component is not installed. This prevents WebKit from freezing.".to_string(),
            details: Some("GStreamer could not find the autoaudiosink element in its active plugin registry.".to_string()),
            install_command: linux_install_command(),
        },
        Err(error) => MediaPlaybackSupport {
            available: false,
            title: "Media support could not be verified".to_string(),
            message: "Geyma did not start the preview because the Linux media runtime could not be verified. This safety check prevents a known WebKit freeze on incomplete media installations.".to_string(),
            details: Some(error),
            install_command: linux_install_command(),
        },
    }
}

/// Queries the GStreamer registry through its stable C ABI. Loading it at
/// runtime avoids a build-time dependency on distro-specific development
/// packages and also sees plugins bundled inside an AppImage.
#[cfg(target_os = "linux")]
fn probe_gstreamer_audio_sink() -> Result<bool, String> {
    use std::ffi::{c_char, c_int, c_void};
    use std::ptr;

    type GstInitCheck =
        unsafe extern "C" fn(*mut c_int, *mut *mut *mut c_char, *mut *mut c_void) -> c_int;
    type GstElementFactoryFind = unsafe extern "C" fn(*const c_char) -> *mut c_void;
    type GstObjectUnref = unsafe extern "C" fn(*mut c_void);
    type GstUpdateRegistry = unsafe extern "C" fn() -> c_int;

    // SAFETY: these functions are loaded from GStreamer's stable ABI using
    // their documented signatures. The factory reference is released before
    // the library handle is dropped, and no pointers escape this function.
    unsafe {
        let library = libloading::Library::new("libgstreamer-1.0.so.0")
            .map_err(|error| format!("Could not load libgstreamer-1.0.so.0: {error}"))?;
        let init: libloading::Symbol<'_, GstInitCheck> = library
            .get(b"gst_init_check\0")
            .map_err(|error| format!("Could not load gst_init_check: {error}"))?;
        let find: libloading::Symbol<'_, GstElementFactoryFind> = library
            .get(b"gst_element_factory_find\0")
            .map_err(|error| format!("Could not load gst_element_factory_find: {error}"))?;
        let unref: libloading::Symbol<'_, GstObjectUnref> = library
            .get(b"gst_object_unref\0")
            .map_err(|error| format!("Could not load gst_object_unref: {error}"))?;

        if init(ptr::null_mut(), ptr::null_mut(), ptr::null_mut()) == 0 {
            return Err("GStreamer failed to initialize.".to_string());
        }
        let name = c"autoaudiosink".as_ptr();
        let mut factory = find(name);
        if factory.is_null() {
            // Refresh only after a miss. This makes the Retry action work when
            // the user installs the plugin while Geyma remains open, without
            // paying for a registry scan on every successful preview.
            if let Ok(update_registry) = library.get::<GstUpdateRegistry>(b"gst_update_registry\0")
            {
                update_registry();
                factory = find(name);
            }
        }
        if factory.is_null() {
            return Ok(false);
        }
        unref(factory);
        Ok(true)
    }
}

#[cfg(target_os = "linux")]
fn linux_install_command() -> Option<String> {
    let os_release = std::fs::read_to_string("/etc/os-release").unwrap_or_default();
    let id = os_release_value(&os_release, "ID").unwrap_or_default();
    let like = os_release_value(&os_release, "ID_LIKE").unwrap_or_default();
    let family = format!("{id} {like}").to_ascii_lowercase();

    let command = if family.contains("arch") || family.contains("cachyos") {
        "sudo pacman -Syu gst-plugins-good"
    } else if family.contains("debian") || family.contains("ubuntu") {
        "sudo apt update && sudo apt install gstreamer1.0-plugins-good gstreamer1.0-tools"
    } else if family.contains("fedora") || family.contains("rhel") {
        "sudo dnf install gstreamer1-plugins-good"
    } else if family.contains("suse") {
        "sudo zypper install gstreamer-plugins-good"
    } else {
        return None;
    };
    Some(command.to_string())
}

#[cfg(target_os = "linux")]
fn os_release_value(contents: &str, key: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let (name, value) = line.split_once('=')?;
        (name == key).then(|| value.trim().trim_matches(['\'', '"']).to_string())
    })
}

#[cfg(target_os = "linux")]
pub fn start() -> std::io::Result<MediaServer> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let token = new_token();
    let expected = token.clone();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let expected = expected.clone();
            std::thread::spawn(move || {
                let _ = handle(stream, &expected, port);
            });
        }
    });
    Ok(MediaServer { port, token })
}

fn new_token() -> String {
    let mut buf = [0u8; 16];
    getrandom::getrandom(&mut buf).expect("failed to read system RNG");
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

/// Compares the presented token against the expected one without an early exit,
/// so response timing doesn't leak how many leading characters matched.
fn token_matches(presented: &str, expected: &str) -> bool {
    let presented = presented.as_bytes();
    let expected = expected.as_bytes();
    if presented.len() != expected.len() {
        return false;
    }
    presented
        .iter()
        .zip(expected)
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

fn handle(stream: TcpStream, expected_token: &str, port: u16) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(30)))?;
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;

    let mut range_header: Option<String> = None;
    let mut host_header: Option<String> = None;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line)? == 0 || line.trim().is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            if name.eq_ignore_ascii_case("range") {
                range_header = Some(value.trim().to_string());
            } else if name.eq_ignore_ascii_case("host") {
                host_header = Some(value.trim().to_string());
            }
        }
    }

    // A browser reaches this server through the attacker's hostname when doing
    // DNS rebinding, and the Host header faithfully carries that hostname —
    // requiring our own loopback origin shuts that vector down.
    let own_origin = format!("127.0.0.1:{port}");
    if host_header.as_deref() != Some(own_origin.as_str()) {
        return respond_status(stream, "403 Forbidden");
    }

    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("");
    if method != "GET" && method != "HEAD" {
        return respond_status(stream, "405 Method Not Allowed");
    }
    if !target.starts_with("/media?") {
        return respond_status(stream, "404 Not Found");
    }

    let query = target.split_once('?').map(|(_, query)| query).unwrap_or("");
    let mut path: Option<String> = None;
    let mut token: Option<String> = None;
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        match (kv.next(), kv.next()) {
            (Some("path"), Some(v)) => path = percent_decode(v),
            (Some("token"), Some(v)) => token = Some(v.to_string()),
            _ => {}
        }
    }

    if !token.as_deref().is_some_and(|t| token_matches(t, expected_token)) {
        return respond_status(stream, "403 Forbidden");
    }
    let Some(path) = path else {
        return respond_status(stream, "400 Bad Request");
    };
    // Only serve what QuickLook/Details actually preview through this server.
    // Anything else (dotfiles, keys, arbitrary documents) stays unreachable even
    // with a valid token.
    let Some(mime) = mime_for(&path) else {
        return respond_status(stream, "403 Forbidden");
    };

    let Ok(mut file) = File::open(&path) else {
        return respond_status(stream, "404 Not Found");
    };
    let total = file.metadata()?.len();

    let (start, end) = match range_header.as_deref() {
        Some(value) => match parse_range(value, total) {
            Some(range) => range,
            None => return respond_unsatisfiable(stream, total),
        },
        None => (0, total.saturating_sub(1)),
    };
    let len = if total == 0 { 0 } else { end - start + 1 };

    let mut out = stream;
    let head = if range_header.is_some() {
        format!(
            "HTTP/1.1 206 Partial Content\r\nContent-Type: {mime}\r\nContent-Length: {len}\r\nContent-Range: bytes {start}-{end}/{total}\r\nAccept-Ranges: bytes\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
        )
    } else {
        format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {len}\r\nAccept-Ranges: bytes\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
        )
    };
    out.write_all(head.as_bytes())?;
    if method == "HEAD" {
        return Ok(());
    }

    file.seek(SeekFrom::Start(start))?;
    let mut remaining = len;
    let mut buf = [0u8; 64 * 1024];
    while remaining > 0 {
        let want = buf.len().min(remaining as usize);
        let n = file.read(&mut buf[..want])?;
        if n == 0 {
            break;
        }
        out.write_all(&buf[..n])?;
        remaining -= n as u64;
    }
    Ok(())
}

fn respond_status(mut stream: TcpStream, status: &str) -> std::io::Result<()> {
    stream.write_all(
        format!("HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").as_bytes(),
    )
}

fn respond_unsatisfiable(mut stream: TcpStream, total: u64) -> std::io::Result<()> {
    stream.write_all(
        format!(
            "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{total}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        )
        .as_bytes(),
    )
}

/// Resolves a single HTTP byte range. Multi-range responses are deliberately
/// unsupported because media elements only require one range at a time.
fn parse_range(v: &str, total: u64) -> Option<(u64, u64)> {
    if total == 0 {
        return None;
    }
    let (unit, spec) = v.split_once('=')?;
    if !unit.eq_ignore_ascii_case("bytes") {
        return None;
    }
    if spec.contains(',') {
        return None;
    }
    let mut ends = spec.splitn(2, '-');
    let start_text = ends.next()?.trim();
    let end_text = ends.next()?.trim();

    if start_text.is_empty() {
        let suffix: u64 = end_text.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let start = total.saturating_sub(suffix);
        return Some((start, total - 1));
    }

    let start: u64 = start_text.parse().ok()?;
    if start >= total {
        return None;
    }
    let end = if end_text.is_empty() {
        total - 1
    } else {
        end_text.parse::<u64>().ok()?.min(total - 1)
    };
    (start <= end).then_some((start, end))
}

fn percent_decode(s: &str) -> Option<String> {
    let mut out = Vec::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' => {
                let hex = s.get(i + 1..i + 3)?;
                out.push(u8::from_str_radix(hex, 16).ok()?);
                i += 3;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8(out).ok()
}

/// The closed set of types this server will serve — doubling as the access-control
/// list for which files are reachable at all (an unknown extension is refused, not
/// served as octet-stream).
fn mime_for(path: &str) -> Option<&'static str> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "mp3" => Some("audio/mpeg"),
        "flac" => Some("audio/flac"),
        "wav" => Some("audio/wav"),
        "ogg" | "oga" => Some("audio/ogg"),
        "m4a" => Some("audio/mp4"),
        "mp4" | "m4v" => Some("video/mp4"),
        "webm" => Some("video/webm"),
        "mov" => Some("video/quicktime"),
        "mkv" => Some("video/x-matroska"),
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        "pdf" => Some("application/pdf"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{handle, parse_range, percent_decode};
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn resolves_http_ranges() {
        assert_eq!(parse_range("bytes=10-19", 100), Some((10, 19)));
        assert_eq!(parse_range("bytes=90-", 100), Some((90, 99)));
        assert_eq!(parse_range("bytes=-10", 100), Some((90, 99)));
        assert_eq!(parse_range("bytes=-200", 100), Some((0, 99)));
        assert_eq!(parse_range("bytes=90-200", 100), Some((90, 99)));
    }

    #[test]
    fn rejects_unsatisfiable_or_multiple_ranges() {
        assert_eq!(parse_range("bytes=100-", 100), None);
        assert_eq!(parse_range("bytes=20-10", 100), None);
        assert_eq!(parse_range("bytes=0-1,4-5", 100), None);
        assert_eq!(parse_range("bytes=0-", 0), None);
    }

    #[test]
    fn decodes_utf8_paths() {
        assert_eq!(
            percent_decode("%2Ftmp%2FM%C3%BAsica%20file.mp3").as_deref(),
            Some("/tmp/Música file.mp3")
        );
        assert_eq!(percent_decode("%zz"), None);
    }

    fn percent_encode(text: &str) -> String {
        text.bytes()
            .map(|byte| match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    (byte as char).to_string()
                }
                _ => format!("%{byte:02X}"),
            })
            .collect()
    }

    /// Spins up one `handle()` invocation and returns the raw HTTP response for
    /// `request_for(port)` — Host and other headers are the caller's to choose.
    fn roundtrip(request_for: impl FnOnce(u16) -> String) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let port = address.port();
        let server = std::thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            handle(stream, "test-token", port).unwrap();
        });

        let mut client = TcpStream::connect(address).unwrap();
        write!(client, "{}", request_for(port)).unwrap();
        let mut response = Vec::new();
        client.read_to_end(&mut response).unwrap();
        server.join().unwrap();
        String::from_utf8(response).unwrap()
    }

    fn temp_media_file(ext: &str, contents: &[u8]) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("geyma-media-{nonce}.{ext}"));
        std::fs::write(&path, contents).unwrap();
        path
    }

    #[test]
    fn serves_a_partial_response() {
        let path = temp_media_file("mp3", b"0123456789");
        let encoded_path = percent_encode(&path.to_string_lossy());
        let response = roundtrip(|port| {
            format!(
                "GET /media?token=test-token&path={encoded_path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nRange: bytes=2-5\r\n\r\n"
            )
        });
        std::fs::remove_file(path).unwrap();

        assert!(response.starts_with("HTTP/1.1 206 Partial Content\r\n"));
        assert!(response.contains("Content-Range: bytes 2-5/10\r\n"));
        assert!(response.ends_with("\r\n\r\n2345"));
    }

    #[test]
    fn refuses_a_rebound_host_header() {
        let path = temp_media_file("mp3", b"0123456789");
        let encoded_path = percent_encode(&path.to_string_lossy());
        let response = roundtrip(|port| {
            format!(
                "GET /media?token=test-token&path={encoded_path} HTTP/1.1\r\nHost: attacker.example:{port}\r\n\r\n"
            )
        });
        std::fs::remove_file(path).unwrap();
        assert!(response.starts_with("HTTP/1.1 403 Forbidden\r\n"));
    }

    #[test]
    fn refuses_a_wrong_token() {
        let path = temp_media_file("mp3", b"0123456789");
        let encoded_path = percent_encode(&path.to_string_lossy());
        let response = roundtrip(|port| {
            format!(
                "GET /media?token=wrong-token&path={encoded_path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n\r\n"
            )
        });
        std::fs::remove_file(path).unwrap();
        assert!(response.starts_with("HTTP/1.1 403 Forbidden\r\n"));
    }

    #[test]
    fn refuses_non_media_extensions() {
        let path = temp_media_file("txt", b"secret contents");
        let encoded_path = percent_encode(&path.to_string_lossy());
        let response = roundtrip(|port| {
            format!(
                "GET /media?token=test-token&path={encoded_path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n\r\n"
            )
        });
        std::fs::remove_file(path).unwrap();
        assert!(response.starts_with("HTTP/1.1 403 Forbidden\r\n"));
        assert!(!response.contains("secret contents"));
    }

    #[test]
    fn token_comparison_requires_exact_match() {
        assert!(super::token_matches("abc123", "abc123"));
        assert!(!super::token_matches("abc124", "abc123"));
        assert!(!super::token_matches("abc12", "abc123"));
        assert!(!super::token_matches("", "abc123"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn probes_gstreamer_without_starting_playback() {
        assert!(super::probe_gstreamer_audio_sink().is_ok());
    }
}
