//! Local AI, via a user-installed Ollama (https://ollama.com) instance — never bundled.
//!
//! This module owns the whole lifecycle: detect the `ollama` binary, install it (Linux
//! only — Ollama's own install script has no macOS/Windows path, those ship a downloadable
//! app instead) via `pkexec` so privilege escalation goes through the desktop's own
//! authentication dialog rather than a terminal prompt nobody can answer, start/stop
//! `ollama serve` as a child process, and manage models, all talking to Ollama's REST API
//! on localhost. `ai_generate` is a single generic prompt-in/text-out entrypoint — every
//! capability (NL search parsing, rename suggestions, folder summaries) builds its own
//! prompt on the frontend and is gated behind its own opt-in toggle there; this module has
//! no feature-specific logic.
//!
//! Every model download and generate call only ever talks to `http://127.0.0.1:11434`,
//! so the `reqwest` dependency below is built with no TLS backend at all.

use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

const OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434";

#[derive(Default)]
pub struct AiState {
    /// Only `Some` while a `serve` process we spawned ourselves is alive — an
    /// externally-running Ollama (started outside Geyma) is never tracked here, which is
    /// what makes `ai_stop_server` naturally a no-op for it instead of killing someone
    /// else's process.
    server: Mutex<Option<Child>>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatus {
    installed: bool,
    running: bool,
}

#[derive(serde::Serialize)]
pub struct AiModel {
    name: String,
    size: u64,
}

fn client() -> reqwest::Client {
    reqwest::Client::new()
}

async fn ping() -> bool {
    client()
        .get(format!("{OLLAMA_BASE_URL}/api/tags"))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

async fn ollama_binary_present() -> bool {
    Command::new("ollama")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|status| status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn ai_status() -> AiStatus {
    AiStatus { installed: ollama_binary_present().await, running: ping().await }
}

async fn is_root() -> bool {
    Command::new("id")
        .arg("-u")
        .output()
        .await
        .ok()
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .map(|s| s.trim() == "0")
        .unwrap_or(false)
}

/// Runs Ollama's official install script and streams its output back as `ai-install-log`
/// events so Settings can show live progress instead of a bare spinner. Only reachable
/// from an explicit "Install" button press in Settings — this never runs on its own.
///
/// The script calls `sudo` itself, separately, for several unrelated steps (installing the
/// binary, creating the `ollama` system user, enabling the systemd service) rather than
/// once up front. Piping a password into the first `sudo` prompt wouldn't reliably cover
/// the later ones from a non-interactive child process with no controlling terminal, and
/// there's no terminal here for the user to answer a prompt in anyway. So instead the
/// *entire* script is elevated once via `pkexec`, which raises the desktop's own native
/// authentication dialog (not a terminal prompt) — the script then sees `id -u` == 0 from
/// the start and never invokes `sudo` internally at all. If no polkit agent is running,
/// `pkexec` fails fast with a clear error instead of hanging, which still surfaces in the
/// install log below rather than silently stalling.
#[tauri::command]
pub async fn ai_install(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
        return Err(
            "Automatic install is only supported on Linux. Download Ollama from https://ollama.com/download and try again.".to_string(),
        );
    }

    #[cfg(target_os = "linux")]
    {
        use tauri::Emitter;

        const INSTALL_CMD: &str = "curl -fsSL https://ollama.com/install.sh | sh";
        let (program, args): (&str, Vec<&str>) = if is_root().await {
            ("sh", vec!["-c", INSTALL_CMD])
        } else {
            ("pkexec", vec!["sh", "-c", INSTALL_CMD])
        };

        let mut child = Command::new(program)
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| {
                format!(
                    "Could not start installer via {program}: {error}. If PolicyKit (pkexec) isn't \
                     installed, install Ollama manually from https://ollama.com/download instead."
                )
            })?;

        let stdout = child.stdout.take().expect("piped stdout");
        let stderr = child.stderr.take().expect("piped stderr");
        let app_out = app.clone();
        let app_err = app.clone();

        let out_task = tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_out.emit("ai-install-log", line);
            }
        });
        let err_task = tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_err.emit("ai-install-log", line);
            }
        });

        let status = child.wait().await.map_err(|error| format!("Installer failed: {error}"))?;
        let _ = out_task.await;
        let _ = err_task.await;

        if status.success() {
            Ok(())
        } else {
            Err(format!("Installer exited with status {status}"))
        }
    }
}

#[tauri::command]
pub async fn ai_start_server(state: tauri::State<'_, AiState>) -> Result<(), String> {
    if ping().await {
        return Ok(()); // already running, ours or external — nothing to do
    }

    let mut guard = state.server.lock().await;
    let needs_spawn = match guard.as_mut() {
        Some(child) => matches!(child.try_wait(), Ok(Some(_)) | Err(_)), // our old process died
        None => true,
    };
    if needs_spawn {
        let child = Command::new("ollama")
            .arg("serve")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Could not start Ollama: {error}"))?;
        *guard = Some(child);
    }
    drop(guard);

    for _ in 0..30 {
        if ping().await {
            return Ok(());
        }
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    }
    Err("Ollama did not respond after starting".to_string())
}

#[tauri::command]
pub async fn ai_stop_server(state: tauri::State<'_, AiState>) -> Result<(), String> {
    let mut guard = state.server.lock().await;
    if let Some(mut child) = guard.take() {
        child.kill().await.map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[derive(serde::Deserialize)]
struct TagsResponse {
    models: Vec<TagModel>,
}

#[derive(serde::Deserialize)]
struct TagModel {
    name: String,
    #[serde(default)]
    size: u64,
}

#[tauri::command]
pub async fn ai_list_models() -> Result<Vec<AiModel>, String> {
    let resp = client()
        .get(format!("{OLLAMA_BASE_URL}/api/tags"))
        .send()
        .await
        .map_err(|error| format!("Could not reach Ollama: {error}"))?
        .json::<TagsResponse>()
        .await
        .map_err(|error| error.to_string())?;
    Ok(resp.models.into_iter().map(|m| AiModel { name: m.name, size: m.size }).collect())
}

/// Streams Ollama's newline-delimited pull progress back as `ai-pull-progress` events —
/// model pulls are multi-GB, so Settings needs live progress rather than a spinner.
#[tauri::command]
pub async fn ai_pull_model(app: tauri::AppHandle, name: String) -> Result<(), String> {
    use futures_util::StreamExt;
    use tauri::Emitter;

    let resp = client()
        .post(format!("{OLLAMA_BASE_URL}/api/pull"))
        .json(&serde_json::json!({ "name": name, "stream": true }))
        .send()
        .await
        .map_err(|error| format!("Could not reach Ollama: {error}"))?;

    if !resp.status().is_success() {
        return Err(format!("Pull failed with status {}", resp.status()));
    }

    let mut stream = resp.bytes_stream();
    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| error.to_string())?;
        buf.extend_from_slice(&chunk);
        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buf.drain(..=pos).collect();
            let line = &line[..line.len().saturating_sub(1)];
            if line.is_empty() {
                continue;
            }
            if let Ok(value) = serde_json::from_slice::<serde_json::Value>(line) {
                if let Some(err) = value.get("error").and_then(|e| e.as_str()) {
                    return Err(err.to_string());
                }
                let _ = app.emit("ai-pull-progress", &value);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_delete_model(name: String) -> Result<(), String> {
    let resp = client()
        .delete(format!("{OLLAMA_BASE_URL}/api/delete"))
        .json(&serde_json::json!({ "name": name }))
        .send()
        .await
        .map_err(|error| format!("Could not reach Ollama: {error}"))?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("Delete failed with status {}", resp.status()))
    }
}

#[derive(serde::Deserialize)]
struct GenerateResponse {
    response: String,
}

/// Generic prompt-in/text-out call used by every AI-backed feature (NL search parsing,
/// rename suggestions, folder summaries) — each builds its own prompt and parses the
/// result on the frontend; there's no per-feature logic on this side.
#[tauri::command]
pub async fn ai_generate(model: String, prompt: String) -> Result<String, String> {
    let resp = client()
        .post(format!("{OLLAMA_BASE_URL}/api/generate"))
        .json(&serde_json::json!({ "model": model, "prompt": prompt, "stream": false }))
        .send()
        .await
        .map_err(|error| format!("Could not reach Ollama: {error}"))?;
    if !resp.status().is_success() {
        return Err(format!("Generate failed with status {}", resp.status()));
    }
    let parsed = resp.json::<GenerateResponse>().await.map_err(|error| error.to_string())?;
    Ok(parsed.response)
}
