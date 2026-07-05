import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { chipStyle } from "./common";
import type { Filters } from "../state/types";

const KIND_CHIPS: { key: NonNullable<Filters["kind"]>; label: string }[] = [
  { key: "document", label: "Docs" },
  { key: "image", label: "Images" },
  { key: "audio", label: "Audio" },
  { key: "code", label: "Code" },
];

export function Search() {
  const t = useTheme();
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const searchScope = useStore((s) => s.searchScope);
  const setSearchScope = useStore((s) => s.setSearchScope);
  const filters = useStore((s) => s.filters);
  const toggleKindFilter = useStore((s) => s.toggleKindFilter);
  const toggleStarredFilter = useStore((s) => s.toggleStarredFilter);

  const active = !!query || filters.kind || filters.starred;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 220 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{ position: "absolute", left: 9, color: t.inkFaint, display: "flex" }}>
          <Icon d={ICONS.search} size={14} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this folder…"
          style={{
            width: "100%",
            height: 30,
            padding: "0 74px 0 30px",
            borderRadius: 9,
            border: `1px solid ${t.border}`,
            background: t.card,
            color: t.ink,
            fontSize: 12.5,
            fontFamily: "inherit",
          }}
        />
        <div style={{ position: "absolute", right: 3, display: "flex", background: "transparent", borderRadius: 7, overflow: "hidden" }}>
          {(["folder", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSearchScope(s)}
              style={{
                border: 0,
                padding: "4px 8px",
                fontSize: 9.5,
                fontFamily: t.mono,
                fontWeight: 700,
                textTransform: "uppercase",
                cursor: "pointer",
                background: searchScope === s ? t.accent : "transparent",
                color: searchScope === s ? "#fff" : t.inkFaint,
                borderRadius: 6,
              }}
            >
              {s === "folder" ? "Here" : "All"}
            </button>
          ))}
        </div>
      </div>
      {active && (
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 }}>
          {KIND_CHIPS.map((c) => (
            <button key={c.key} onClick={() => toggleKindFilter(c.key)} style={chipStyle(t, filters.kind === c.key)}>
              {c.label}
            </button>
          ))}
          <button onClick={toggleStarredFilter} style={chipStyle(t, filters.starred)}>
            ★ Starred
          </button>
        </div>
      )}
    </div>
  );
}
