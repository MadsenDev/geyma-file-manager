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

function hintStyle(t: ReturnType<typeof useTheme>): React.CSSProperties {
  return { fontSize: 11, color: t.inkFaint, marginTop: 4, lineHeight: 1.4 };
}

export function ConfirmationsSettings() {
  const t = useTheme();
  const confirmTrash = useStore((s) => s.confirmTrash);
  const toggleConfirmTrash = useStore((s) => s.toggleConfirmTrash);
  const confirmPermanentDelete = useStore((s) => s.confirmPermanentDelete);
  const toggleConfirmPermanentDelete = useStore((s) => s.toggleConfirmPermanentDelete);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <ToggleRow label="Confirm before moving to Trash" value={confirmTrash} onChange={toggleConfirmTrash} t={t} />
        <div style={hintStyle(t)}>Off by default — Trash is reversible from the Trash view or Undo.</div>
      </div>
      <div>
        <ToggleRow label="Confirm before permanent delete" value={confirmPermanentDelete} onChange={toggleConfirmPermanentDelete} t={t} />
        <div style={hintStyle(t)}>When on, press Delete twice within 4 seconds. When off, permanent delete (including Empty Trash) happens immediately — this cannot be undone.</div>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <ToggleRow label="Show hidden files" value={showHidden} onChange={toggleShowHidden} t={t} />
        <div style={hintStyle(t)}>Remembered between restarts.</div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>Default view</div>
        <div style={{ display: "flex", gap: 4, background: t.isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", borderRadius: 8, padding: 3 }}>
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{ flex: 1, height: 28, border: 0, borderRadius: 6, background: view === v ? t.card : "transparent", color: view === v ? t.ink : t.inkSoft, fontWeight: view === v ? 700 : 500, fontSize: 11.5, cursor: "pointer", textTransform: "capitalize" }}
            >
              {v}
            </button>
          ))}
        </div>
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
