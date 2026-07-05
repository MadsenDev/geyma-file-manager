import { useRef, type ReactNode } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { MODULE_NAMES, type ModuleId, type ZoneId } from "../state/layout";
import { isStretchModule } from "../state/layout";

interface ModuleShellProps {
  id: ModuleId;
  zone: ZoneId;
  index: number;
  isPanel: boolean;
  onDragStart: (id: ModuleId, fromZone: ZoneId) => void;
  onDragEnd: () => void;
  children: ReactNode;
}

export function ModuleShell({ id, zone, index, isPanel, onDragStart, onDragEnd, children }: ModuleShellProps) {
  const t = useTheme();
  const editMode = useStore((s) => s.editMode);
  const hideModule = useStore((s) => s.hideModule);
  const openModMenu = useStore((s) => s.openMenu);
  const ref = useRef<HTMLDivElement>(null);
  const stretch = isStretchModule(id);

  return (
    <div
      ref={ref}
      data-mod={id}
      data-zone-index={index}
      draggable={editMode}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        onDragStart(id, zone);
      }}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => {
        if (!editMode) return;
        e.preventDefault();
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: stretch ? "1 1 0" : "none",
        minHeight: stretch ? (id === "files" || id === "files2" ? 200 : 140) : undefined,
        minWidth: 0,
        background: isPanel ? t.card : "transparent",
        border: isPanel ? `1px solid ${t.border}` : "none",
        borderRadius: isPanel ? t.radius : 0,
        boxShadow: editMode ? `0 0 0 1px ${hexA(t.ink, 0.08)}` : "none",
        cursor: editMode ? "grab" : "default",
        overflow: stretch ? "hidden" : "visible",
      }}
    >
      {editMode && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 8px",
            gap: 8,
            borderBottom: `1px solid ${t.border}`,
            flex: "none",
          }}
        >
          <span style={{ fontFamily: t.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: t.inkFaint, fontWeight: 700 }}>
            {MODULE_NAMES[id]}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => openModMenu({ x: e.clientX, y: e.clientY, items: [] })}
              title="Module settings"
              style={iconBtnStyle(t.inkFaint)}
            >
              <Icon d={ICONS.gear} size={13} />
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => hideModule(id)}
              title="Hide module"
              style={iconBtnStyle(t.inkFaint)}
            >
              <Icon d={ICONS.close} size={13} />
            </button>
          </span>
        </div>
      )}
      <div style={{ flex: stretch ? "1 1 0" : "none", minHeight: 0, display: "flex", flexDirection: "column", overflow: stretch ? "auto" : "visible" }}>
        {children}
      </div>
    </div>
  );
}

function iconBtnStyle(color: string): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    display: "grid",
    placeItems: "center",
    border: 0,
    background: "transparent",
    borderRadius: 5,
    color,
    cursor: "pointer",
    padding: 0,
  };
}
