import { tr } from "@/i18n";
import { useRef, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { ALL_MODULES, MODULE_NAMES, type ModuleId } from "../state/layout";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { ModulePreview } from "./ModulePreview";
const MODULE_DRAG_TYPE = "application/x-geyma-module";

// Remembered across mount/unmount so the palette stays where the user dragged it
// for the whole app session (toggling edit mode doesn't reset it). Not persisted.
let sessionPos: {
  x: number;
  y: number;
} | null = null;
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
  const [pos, setPos] = useState(sessionPos);
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const grab = useRef<{
    dx: number;
    dy: number;
  } | null>(null);
  function startDrag(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    grab.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function moveDrag(e: React.PointerEvent) {
    if (!grab.current || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const next = {
      x: Math.min(
        Math.max(8, e.clientX - grab.current.dx),
        Math.max(8, window.innerWidth - rect.width - 8)
      ),
      y: Math.min(
        Math.max(8, e.clientY - grab.current.dy),
        Math.max(8, window.innerHeight - rect.height - 8)
      )
    };
    sessionPos = next;
    setPos(next);
  }
  function endDrag() {
    grab.current = null;
  }
  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        ...(pos ?
        {
          left: pos.x,
          top: pos.y
        } :
        {
          left: "50%",
          bottom: 12,
          transform: "translateX(-50%)"
        }),
        zIndex: 120,
        width: "min(680px, calc(100vw - 24px))",
        borderRadius: 14,
        background: t.card,
        border: `1px solid ${
        t.border}`,

        boxShadow: `0 16px 44px ${hexA("#000000", t.isDark ? 0.5 : 0.2)}`,
        overflow: "hidden"
      }}
      className="gy-anim">
      
      <div
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          cursor: "grab",
          touchAction: "none",
          userSelect: "none"
        }}
        title={tr("ui.edit_bar.drag_to_move_this_panel")}>
        
        <svg
          width="10"
          height="14"
          viewBox="0 0 10 14"
          fill={t.inkFaint}
          aria-hidden="true"
          style={{
            flex: "none"
          }}>
          
          {[2, 7, 12].map((y) =>
          [2.5, 7.5].map((x) =>
          <circle
            key={tr("ui.edit_bar.x_y", {
              x,
              y
            })}
            cx={x}
            cy={y}
            r="1.2" />

          )
          )}
        </svg>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: t.accent,
            animation: "gy-pulse 1.4s ease-in-out infinite",
            flex: "none"
          }} />
        
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: t.ink,
            flex: "none"
          }}>
          
          {tr("ui.edit_bar.editing_layout")}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "right",
            fontFamily: t.mono,
            fontSize: 9.5,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: t.inkFaint,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
          
          {hidden.length > 0 ?
          tr("ui.edit_bar.length_hidden", {
            length: hidden.length
          }) :
          "all placed"}
        </span>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="gy-soft"
          title={collapsed ? "Show hidden modules" : "Collapse panel"}
          style={{
            flex: "none",
            display: "grid",
            placeItems: "center",
            width: 26,
            height: 26,
            borderRadius: 8,
            border: `1px solid ${
            t.border}`,

            background: "transparent",
            color: t.inkSoft,
            cursor: "pointer"
          }}>
          
          <Icon
            d={ICONS.chevronRight}
            size={12}
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
              transition: "transform .15s ease"
            }} />
          
        </button>
        <button
          onClick={resetLayout}
          className="gy-soft"
          style={{
            flex: "none",
            padding: "5px 12px",
            borderRadius: 8,
            border: `1px solid ${
            t.border}`,

            background: "transparent",
            color: t.inkSoft,
            fontSize: 12,
            cursor: "pointer"
          }}>
          
          {tr("ui.edit_bar.reset")}
        </button>
        <button
          onClick={toggleEditMode}
          className="gy-prim"
          style={{
            flex: "none",
            padding: "5px 14px",
            borderRadius: 8,
            border: "none",
            background: t.accent,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer"
          }}>
          
          {tr("ui.edit_bar.done")}
        </button>
      </div>
      {!collapsed &&
      <div
        style={{
          borderTop: `1px solid ${
          t.border}`,

          padding: "8px 12px 10px"
        }}>
        
          <div
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            color: t.inkFaint,
            marginBottom: 7
          }}>
          
            {tr("ui.edit_bar.hidden_modules_drag_into_a_zone_or_click_to_add")}
          </div>
          {hidden.length > 0 ?
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 2
          }}>
          
              {hidden.map((id) =>
          <button
            key={id}
            draggable
            onDragStart={(e) =>
            e.dataTransfer.setData(MODULE_DRAG_TYPE, id)
            }
            onClick={() => showModule(id, "left")}
            title={`${MODULE_NAMES[id]} — drag into a zone, or click to add`}
            className="gy-soft"
            style={{
              flex: "none",
              width: 92,
              display: "flex",
              flexDirection: "column",
              gap: 5,
              padding: 6,
              borderRadius: 10,
              border: `1px solid ${
              t.border}`,

              background: "transparent",
              cursor: "grab"
            }}>
            
                  <span
              style={{
                display: "block",
                borderRadius: 7,
                background: hexA(t.ink, t.isDark ? 0.07 : 0.045),
                overflow: "hidden"
              }}>
              
                    <ModulePreview id={id} />
                  </span>
                  <span
              style={{
                fontFamily: t.mono,
                fontSize: 9.5,
                color: t.inkSoft,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
              
                    {MODULE_NAMES[id]}
                  </span>
                </button>
          )}
            </div> :

        <span
          style={{
            fontSize: 11.5,
            color: t.inkFaint
          }}>
          
              {tr("ui.edit_bar.all_modules_placed")}
            </span>
        }
        </div>
      }
    </div>);

}