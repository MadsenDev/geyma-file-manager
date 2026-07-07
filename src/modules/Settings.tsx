import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { panelTitleStyle, ToggleRow } from "./common";
import type { SortKey } from "../state/types";
import { formatSize } from "../lib/format";
import { explainError } from "../lib/explainError";
import { aiInstall, aiPullModel, type AiPullProgress } from "../ai/ollama";

const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "kind", label: "Kind" },
  { key: "size", label: "Size" },
  { key: "modified", label: "Modified" },
];

const CONFIRM_WINDOWS = [2000, 4000, 6000];

function hintStyle(t: ReturnType<typeof useTheme>): React.CSSProperties {
  return { fontSize: 11, color: t.inkFaint, marginTop: 4, lineHeight: 1.4 };
}

function Segmented<T extends string>({ options, value, onChange, t }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; t: ReturnType<typeof useTheme> }) {
  return (
    <div style={{ display: "flex", gap: 4, background: t.isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", borderRadius: 8, padding: 3 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{ flex: 1, height: 28, border: 0, borderRadius: 6, background: value === opt.value ? t.card : "transparent", color: value === opt.value ? t.ink : t.inkSoft, fontWeight: value === opt.value ? 700 : 500, fontSize: 11.5, cursor: "pointer" }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ConfirmationsSettings() {
  const t = useTheme();
  const confirmTrash = useStore((s) => s.confirmTrash);
  const toggleConfirmTrash = useStore((s) => s.toggleConfirmTrash);
  const confirmPermanentDelete = useStore((s) => s.confirmPermanentDelete);
  const toggleConfirmPermanentDelete = useStore((s) => s.toggleConfirmPermanentDelete);
  const confirmWindowMs = useStore((s) => s.confirmWindowMs);
  const setConfirmWindowMs = useStore((s) => s.setConfirmWindowMs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <ToggleRow label="Confirm before moving to Trash" value={confirmTrash} onChange={toggleConfirmTrash} t={t} />
        <div style={hintStyle(t)}>Off by default — Trash is reversible from the Trash view or Undo.</div>
      </div>
      <div>
        <ToggleRow label="Confirm before permanent delete" value={confirmPermanentDelete} onChange={toggleConfirmPermanentDelete} t={t} />
        <div style={hintStyle(t)}>When on, press Delete twice within the window below. When off, permanent delete (including Empty Trash) happens immediately — this cannot be undone.</div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>Confirmation window</div>
        <Segmented
          options={CONFIRM_WINDOWS.map((ms) => ({ value: String(ms), label: `${ms / 1000}s` }))}
          value={String(confirmWindowMs)}
          onChange={(v) => setConfirmWindowMs(Number(v))}
          t={t}
        />
        <div style={hintStyle(t)}>How long the second press has to land, for both confirmations above.</div>
      </div>
    </div>
  );
}

export function GeneralSettings() {
  const t = useTheme();
  const showHidden = useStore((s) => s.showHidden);
  const toggleShowHidden = useStore((s) => s.toggleShowHidden);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const sortKey = useStore((s) => s.sortKey);
  const sortDir = useStore((s) => s.sortDir);
  const setSort = useStore((s) => s.setSort);
  const searchScope = useStore((s) => s.searchScope);
  const setSearchScope = useStore((s) => s.setSearchScope);
  const newTabAtHome = useStore((s) => s.newTabAtHome);
  const toggleNewTabAtHome = useStore((s) => s.toggleNewTabAtHome);
  const startupMode = useStore((s) => s.startupMode);
  const setStartupMode = useStore((s) => s.setStartupMode);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <ToggleRow label="Show hidden files" value={showHidden} onChange={toggleShowHidden} t={t} />
        <div style={hintStyle(t)}>Remembered between restarts.</div>
      </div>
      <div>
        <ToggleRow label="New tabs open at Home" value={newTabAtHome} onChange={toggleNewTabAtHome} t={t} />
        <div style={hintStyle(t)}>Off opens new tabs at the current folder instead. Doesn't affect "Open in new tab" on a specific folder.</div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>On startup</div>
        <Segmented
          options={[{ value: "resume", label: "Reopen last session" }, { value: "home", label: "Always start at Home" }]}
          value={startupMode}
          onChange={setStartupMode}
          t={t}
        />
      </div>
      <div>
        <div style={panelTitleStyle(t)}>Default view</div>
        <Segmented options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]} value={view} onChange={setView} t={t} />
      </div>
      <div>
        <div style={panelTitleStyle(t)}>Default search scope</div>
        <Segmented options={[{ value: "folder", label: "This folder" }, { value: "all", label: "Everywhere" }]} value={searchScope} onChange={setSearchScope} t={t} />
        <div style={hintStyle(t)}>Remembered between restarts.</div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>Default sort</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SORT_KEYS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              style={{
                padding: "5px 10px",
                borderRadius: 99,
                border: `1px solid ${sortKey === s.key ? t.accent : t.border}`,
                background: sortKey === s.key ? t.card : "transparent",
                color: sortKey === s.key ? t.ink : t.inkSoft,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {s.label}
              {sortKey === s.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          ))}
        </div>
        <div style={hintStyle(t)}>Remembered between restarts.</div>
      </div>
    </div>
  );
}

const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";

export function AiSettings() {
  const t = useTheme();
  const installed = useStore((s) => s.aiInstalled);
  const running = useStore((s) => s.aiRunning);
  const models = useStore((s) => s.aiModels);
  const selectedModel = useStore((s) => s.aiSelectedModel);
  const setAiSelectedModel = useStore((s) => s.setAiSelectedModel);
  const startAiServer = useStore((s) => s.startAiServer);
  const stopAiServer = useStore((s) => s.stopAiServer);
  const deleteAiModel = useStore((s) => s.deleteAiModel);
  const refreshAiStatus = useStore((s) => s.refreshAiStatus);
  const showToast = useStore((s) => s.showToast);
  const searchEnabled = useStore((s) => s.aiSearchEnabled);
  const toggleSearchEnabled = useStore((s) => s.toggleAiSearchEnabled);
  const renameEnabled = useStore((s) => s.aiRenameEnabled);
  const toggleRenameEnabled = useStore((s) => s.toggleAiRenameEnabled);
  const summaryEnabled = useStore((s) => s.aiSummaryEnabled);
  const toggleSummaryEnabled = useStore((s) => s.toggleAiSummaryEnabled);

  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<AiPullProgress | null>(null);

  const inputStyle: React.CSSProperties = {
    height: 30,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "0 10px",
    fontSize: 12,
    background: t.main,
    color: t.ink,
  };
  const buttonStyle: React.CSSProperties = {
    border: "none",
    background: t.accent,
    color: "#fff",
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  };
  const softButtonStyle: React.CSSProperties = {
    border: `1px solid ${t.border}`,
    background: "transparent",
    color: t.inkSoft,
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
  };

  async function handleInstall() {
    setInstalling(true);
    setInstallLog([]);
    try {
      await aiInstall((line) => setInstallLog((log) => [...log.slice(-199), line]));
      await refreshAiStatus();
    } catch (e) {
      showToast(`Install failed: ${explainError(e)}`);
    } finally {
      setInstalling(false);
    }
  }

  async function handleStart() {
    setStarting(true);
    try {
      await startAiServer();
    } finally {
      setStarting(false);
    }
  }

  async function handlePull() {
    const name = pullName.trim();
    if (!name) return;
    setPulling(name);
    setPullProgress(null);
    try {
      await aiPullModel(name, setPullProgress);
      setPullName("");
      await refreshAiStatus();
    } catch (e) {
      showToast(`Pull failed: ${explainError(e)}`);
    } finally {
      setPulling(null);
      setPullProgress(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={panelTitleStyle(t)}>Local AI</div>
        <div style={hintStyle(t)}>
          Runs entirely on your machine through Ollama — nothing is bundled and nothing leaves this computer. Every
          feature below is off by default; turn on only what you want.
        </div>
      </div>

      {!installed ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: t.ink }}>Ollama isn't installed</span>
            <button onClick={handleInstall} disabled={installing} style={{ ...buttonStyle, opacity: installing ? 0.6 : 1 }}>
              {installing ? "Installing…" : "Install Ollama"}
            </button>
          </div>
          <div style={hintStyle(t)}>
            Linux only — runs the official install script from ollama.com. It needs admin rights, so your desktop's
            own authentication dialog will pop up to ask for your password (not a terminal — if that dialog never
            appears, your system may be missing a PolicyKit agent, and installing manually from{" "}
            <span style={{ fontFamily: t.mono }}>{OLLAMA_DOWNLOAD_URL}</span> is the fallback). On other platforms,
            download it manually from the same link and reopen this panel.
          </div>
          {(installing || installLog.length > 0) && (
            <pre
              style={{
                marginTop: 8,
                padding: "8px 10px",
                maxHeight: 140,
                overflow: "auto",
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                background: t.bg,
                color: t.inkFaint,
                fontFamily: t.mono,
                fontSize: 10.5,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {installLog.join("\n") || "Starting installer…"}
            </pre>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: t.ink }}>
              Ollama {running ? "is running" : "is installed, not running"}
            </span>
            {running ? (
              <button onClick={stopAiServer} style={softButtonStyle}>
                Stop server
              </button>
            ) : (
              <button onClick={handleStart} disabled={starting} style={{ ...buttonStyle, opacity: starting ? 0.6 : 1 }}>
                {starting ? "Starting…" : "Start server"}
              </button>
            )}
          </div>
        </div>
      )}

      {installed && running && (
        <div>
          <div style={panelTitleStyle(t)}>Models</div>
          {models.length === 0 ? (
            <div style={hintStyle(t)}>No models pulled yet — pull one below (try "llama3.2" or "mistral").</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {models.map((m) => (
                <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="radio"
                    name="ai-model"
                    checked={selectedModel === m.name}
                    onChange={() => setAiSelectedModel(m.name)}
                  />
                  <span style={{ flex: 1, fontFamily: t.mono }}>{m.name}</span>
                  <span style={{ color: t.inkFaint, fontSize: 11 }}>{formatSize(m.size)}</span>
                  <button onClick={() => deleteAiModel(m.name)} style={{ ...softButtonStyle, padding: "3px 8px", fontSize: 11 }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={pullName}
              onChange={(e) => setPullName(e.target.value)}
              placeholder="Model name, e.g. llama3.2"
              disabled={!!pulling}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={handlePull} disabled={!!pulling || !pullName.trim()} style={{ ...buttonStyle, opacity: pulling ? 0.6 : 1 }}>
              {pulling ? "Pulling…" : "Pull"}
            </button>
          </div>
          {pulling && (
            <div style={hintStyle(t)}>
              {pullProgress?.status || "Starting…"}
              {pullProgress?.total ? ` — ${formatSize(pullProgress.completed || 0)} / ${formatSize(pullProgress.total)}` : ""}
            </div>
          )}
        </div>
      )}

      <div>
        <div style={panelTitleStyle(t)}>Use AI for</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ToggleRow label="Natural-language search" value={searchEnabled} onChange={toggleSearchEnabled} t={t} />
          <ToggleRow label="Rename suggestions" value={renameEnabled} onChange={toggleRenameEnabled} t={t} />
          <ToggleRow label="Folder summaries" value={summaryEnabled} onChange={toggleSummaryEnabled} t={t} />
        </div>
        <div style={hintStyle(t)}>Each is independent — turning one off never affects the others.</div>
      </div>
    </div>
  );
}
