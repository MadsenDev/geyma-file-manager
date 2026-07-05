import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { ALL_MODULES, MODULE_NAMES, type ModuleId } from "../state/layout";

function hiddenModules(layout: Record<string, ModuleId[]>): ModuleId[] {
  const placed = new Set<ModuleId>();
  Object.values(layout).forEach((list) => list.forEach((id) => placed.add(id)));
  return ALL_MODULES.filter((id) => !placed.has(id));
}

export function EditBar() {
  const t = useTheme();
  const layout = useStore((s) => s.layout);
  const showModule = useStore((s) => s.showModule);
  const resetLayout = useStore((s) => s.resetLayout);
  const toggleEditMode = useStore((s) => s.toggleEditMode);
  const hidden = hiddenModules(layout);

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 120,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderRadius: 14,
        background: t.card,
        border: `1px solid ${t.border}`,
        boxShadow: `0 16px 44px ${hexA("#000000", t.isDark ? 0.5 : 0.2)}`,
      }}
      className="gy-anim"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, flex: "none" }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: t.accent, animation: "gy-pulse 1.4s ease-in-out infinite" }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Editing layout</span>
      </div>
      <div style={{ width: 1, height: 22, background: t.border, flex: "none" }} />
      <span style={{ fontFamily: t.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: t.inkFaint, flex: "none" }}>
        Hidden
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", flex: 1, minWidth: 0, overflowX: "auto", paddingBottom: 2 }}>
        {hidden.map((id) => (
          <button
            key={id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", id)}
            onClick={() => showModule(id, "left")}
            title="Drag into a zone, or click to add"
            style={{
              flex: "none",
              padding: "4px 10px",
              borderRadius: 99,
              border: `1px solid ${t.border}`,
              background: "transparent",
              color: t.inkSoft,
              fontFamily: t.mono,
              fontSize: 11,
              cursor: "grab",
              whiteSpace: "nowrap",
            }}
          >
            + {MODULE_NAMES[id]}
          </button>
        ))}
        {hidden.length === 0 && <span style={{ fontSize: 11.5, color: t.inkFaint }}>All modules placed</span>}
      </div>
      <button
        onClick={resetLayout}
        className="gy-soft"
        style={{ flex: "none", padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.inkSoft, fontSize: 12, cursor: "pointer" }}
      >
        Reset
      </button>
      <button
        onClick={toggleEditMode}
        className="gy-prim"
        style={{ flex: "none", padding: "6px 14px", borderRadius: 8, border: "none", background: t.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        Done
      </button>
    </div>
  );
}
