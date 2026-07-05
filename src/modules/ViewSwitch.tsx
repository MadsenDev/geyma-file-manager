import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { iconButtonStyle } from "./common";
import type { SortKey } from "../state/types";

const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "kind", label: "Kind" },
  { key: "size", label: "Size" },
  { key: "modified", label: "Modified" },
];

export function ViewSwitch() {
  const t = useTheme();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const sortKey = useStore((s) => s.sortKey);
  const sortDir = useStore((s) => s.sortDir);
  const setSort = useStore((s) => s.setSort);
  const toggleEditMode = useStore((s) => s.toggleEditMode);
  const editMode = useStore((s) => s.editMode);
  const showHidden = useStore((s) => s.showHidden);
  const toggleShowHidden = useStore((s) => s.toggleShowHidden);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select
        value={sortKey}
        onChange={(e) => setSort(e.target.value as SortKey)}
        style={{ height: 28, borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.inkSoft, fontSize: 11.5, padding: "0 6px" }}
      >
        {SORT_KEYS.map((s) => (
          <option key={s.key} value={s.key}>
            Sort: {s.label}
          </option>
        ))}
      </select>
      <button onClick={() => setSort(sortKey)} title="Toggle direction" className="gy-soft" style={iconButtonStyle(t)}>
        {sortDir === "asc" ? "↑" : "↓"}
      </button>
      <div style={{ width: 1, height: 20, background: t.border }} />
      <button onClick={() => setView("grid")} title="Grid view" className="gy-soft" style={iconButtonStyle(t, view === "grid")}>
        <Icon d={ICONS.grid} size={14} />
      </button>
      <button onClick={() => setView("list")} title="List view" className="gy-soft" style={iconButtonStyle(t, view === "list")}>
        <Icon d={ICONS.list} size={14} />
      </button>
      <button onClick={toggleShowHidden} title="Show hidden files" className="gy-soft" style={iconButtonStyle(t, showHidden)}>
        .*
      </button>
      <button onClick={toggleEditMode} title="Edit layout" className="gy-soft" style={iconButtonStyle(t, editMode)}>
        <Icon d={ICONS.pencil} size={14} />
      </button>
    </div>
  );
}
