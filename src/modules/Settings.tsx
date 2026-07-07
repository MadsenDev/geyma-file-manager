import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { panelTitleStyle, ToggleRow } from "./common";
import type { SortKey } from "../state/types";

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
