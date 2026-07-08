import { tr } from "@/i18n";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { iconButtonStyle } from "./common";
import type { SortKey } from "../state/types";
const SORT_KEYS: {
  key: SortKey;
  label: string;
}[] = [
{
  key: "name",
  label: tr("ui.view_switch.name")
},
{
  key: "kind",
  label: tr("ui.view_switch.kind")
},
{
  key: "size",
  label: tr("ui.view_switch.size")
},
{
  key: "modified",
  label: tr("ui.view_switch.modified")
}];

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
  const showModule = useStore((s) => s.showModule);
  const showChrome = useStore((s) => s.mcfg("viewswitch", "chrome", true));
  const showSort = useStore((s) => s.mcfg("viewswitch", "sort", true));
  const showHiddenButton = useStore((s) =>
  s.mcfg("viewswitch", "hidden", true)
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6
      }}>
      
      {showSort &&
      <select
        value={sortKey}
        onChange={(e) => setSort(e.target.value as SortKey)}
        style={{
          height: 28,
          borderRadius: 8,
          border: `1px solid ${
          t.border}`,

          background: t.card,
          color: t.inkSoft,
          fontSize: 11.5,
          padding: "0 6px"
        }}>
        
          {SORT_KEYS.map((s) =>
        <option key={s.key} value={s.key}>
              {tr("ui.view_switch.sort_label", {
            label: s.label
          })}
            </option>
        )}
        </select>
      }
      {showSort &&
      <button
        onClick={() => setSort(sortKey)}
        title={tr("ui.view_switch.toggle_direction")}
        className="gy-soft"
        style={iconButtonStyle(t)}>
        
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
      }
      {showSort &&
      <div
        style={{
          width: 1,
          height: 20,
          background: t.border
        }} />

      }
      <button
        onClick={() => setView("grid")}
        title={tr("ui.view_switch.grid_view")}
        className="gy-soft"
        style={iconButtonStyle(t, view === "grid")}>
        
        <Icon d={ICONS.grid} size={14} />
      </button>
      <button
        onClick={() => setView("list")}
        title={tr("ui.view_switch.list_view")}
        className="gy-soft"
        style={iconButtonStyle(t, view === "list")}>
        
        <Icon d={ICONS.list} size={14} />
      </button>
      {showHiddenButton &&
      <button
        onClick={toggleShowHidden}
        title={tr("ui.view_switch.show_hidden_files")}
        className="gy-soft"
        style={iconButtonStyle(t, showHidden)}>
        
          .*
        </button>
      }
      {showChrome &&
      <>
          <button
          onClick={() => showModule("settings", "right")}
          title={tr("ui.view_switch.settings")}
          className="gy-soft"
          style={iconButtonStyle(t)}>
          
            <Icon d={ICONS.gear} size={14} />
          </button>
          <button
          onClick={toggleEditMode}
          title={tr("ui.view_switch.edit_layout")}
          className="gy-soft"
          style={iconButtonStyle(t, editMode)}>
          
            <Icon d={ICONS.pencil} size={14} />
          </button>
        </>
      }
    </div>);

}