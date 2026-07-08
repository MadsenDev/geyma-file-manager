import { tr } from "@/i18n";
import { Fragment, useRef, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import {
  isPanelModule,
  moduleMinWidth,
  type ModuleId,
  type ZoneId,
} from "../state/layout";
import { ModuleShell } from "./ModuleShell";
import { MODULE_COMPONENTS } from "../modules/registry";
const MODULE_DRAG_TYPE = "application/x-geyma-module";
interface ZoneProps {
  zoneId: ZoneId;
  orientation: "h" | "v";
  emptyHint: string;
  style?: React.CSSProperties;
}
export function Zone({ zoneId, orientation, emptyHint, style }: ZoneProps) {
  const t = useTheme();
  const modules = useStore((s) => s.layout[zoneId]);
  const editMode = useStore((s) => s.editMode);
  const moveModule = useStore((s) => s.moveModule);
  const setModuleWidths = useStore((s) => s.setModuleWidths);
  const resetModuleWidths = useStore((s) => s.resetModuleWidths);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggingRef = useRef<ModuleId | null>(null);
  function computeIndex(e: React.DragEvent<HTMLDivElement>): number {
    const el = containerRef.current;
    if (!el) return modules.length;
    const children = Array.from(el.querySelectorAll<HTMLElement>("[data-mod]"));
    const isHoriz = orientation === "h";
    const pos = isHoriz ? e.clientX : e.clientY;
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      const mid = isHoriz
        ? rect.left + rect.width / 2
        : rect.top + rect.height / 2;
      if (pos < mid) return i;
    }
    return children.length;
  }

  // Drag between two horizontally adjacent modules: both get pinned to pixel widths so
  // the pair trades space while the rest of the row stays put.
  function startModuleResize(
    e: React.MouseEvent,
    leftId: ModuleId,
    rightId: ModuleId,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const leftEl = el.querySelector<HTMLElement>(
      tr("ui.zone.data_mod_left_id", {
        leftId,
      }),
    );
    const rightEl = el.querySelector<HTMLElement>(
      tr("ui.zone.data_mod_right_id", {
        rightId,
      }),
    );
    if (!leftEl || !rightEl) return;
    const lr = leftEl.getBoundingClientRect();
    const rr = rightEl.getBoundingClientRect();
    if (lr.bottom <= rr.top || rr.bottom <= lr.top) return; // flex-wrap put them on different rows
    const startX = e.clientX;
    const startL = lr.width;
    const startR = rr.width;
    const minL = moduleMinWidth(leftId);
    const minR = moduleMinWidth(rightId);
    function onMove(ev: MouseEvent) {
      const delta = Math.max(
        minL - startL,
        Math.min(startR - minR, ev.clientX - startX),
      );
      setModuleWidths({
        [leftId]: startL + delta,
        [rightId]: startR - delta,
      });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  return (
    <div
      ref={containerRef}
      data-zone={zoneId}
      onDragOver={(e) => {
        if (
          !draggingRef.current &&
          !e.dataTransfer.types.includes(MODULE_DRAG_TYPE)
        )
          return;
        e.preventDefault();
        setDragOverIndex(computeIndex(e));
      }}
      onDragLeave={() => setDragOverIndex(null)}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData(MODULE_DRAG_TYPE) as ModuleId;
        if (id) moveModule(id, zoneId, dragOverIndex ?? modules.length);
        setDragOverIndex(null);
      }}
      style={{
        display: "flex",
        flexDirection: orientation === "h" ? "row" : "column",
        // Horizontal spacing comes from the resize handles between modules, not the gap.
        gap: orientation === "h" ? "6px 0" : 10,
        padding: orientation === "h" ? "8px 12px" : "12px",
        overflow: orientation === "h" ? "visible" : "auto",
        flexWrap: orientation === "h" ? "wrap" : "nowrap",
        alignItems: orientation === "h" ? "center" : "stretch",
        minHeight: modules.length === 0 && editMode ? 56 : undefined,
        position: "relative",
        ...style,
      }}
    >
      {modules.map((id, i) => (
        <Fragment key={id}>
          {orientation === "h" && i > 0 && (
            <div
              onMouseDown={(e) => startModuleResize(e, modules[i - 1], id)}
              onDoubleClick={() => resetModuleWidths([modules[i - 1], id])}
              title={tr("ui.zone.drag_to_resize_double_click_to_reset")}
              style={{
                width: 10,
                flex: "none",
                alignSelf: "stretch",
                cursor: "col-resize",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  width: 3,
                  height: 14,
                  borderRadius: 3,
                  background: hexA(t.inkFaint, 0.35),
                }}
              />
            </div>
          )}
          {dragOverIndex === i && (
            <div
              key={tr("ui.zone.drop_i", {
                i,
              })}
              style={
                orientation === "h"
                  ? {
                      width: 2,
                      margin: "0 2px",
                      alignSelf: "stretch",
                      background: t.accent,
                      borderRadius: 2,
                    }
                  : {
                      height: 2,
                      background: t.accent,
                      borderRadius: 2,
                    }
              }
            />
          )}
          <ModuleShellFor
            id={id}
            zone={zoneId}
            index={i}
            onDragStart={(mid) => {
              draggingRef.current = mid;
            }}
            onDragEnd={() => {
              draggingRef.current = null;
              setDragOverIndex(null);
            }}
          />
        </Fragment>
      ))}
      {dragOverIndex === modules.length && (
        <div
          style={
            orientation === "h"
              ? {
                  width: 2,
                  margin: "0 2px",
                  alignSelf: "stretch",
                  background: t.accent,
                  borderRadius: 2,
                }
              : {
                  height: 2,
                  background: t.accent,
                  borderRadius: 2,
                }
          }
        />
      )}
      {modules.length === 0 && editMode && (
        <div
          style={{
            flex: 1,
            display: "grid",
            placeItems: "center",
            fontSize: 11.5,
            color: t.inkFaint,
            border: `1.5px dashed ${hexA(t.ink, 0.22)}`,
            borderRadius: t.radius,
            minHeight: 48,
          }}
        >
          {emptyHint}
        </div>
      )}
    </div>
  );
}
export { MODULE_DRAG_TYPE };
function ModuleShellFor({
  id,
  zone,
  index,
  onDragStart,
  onDragEnd,
}: {
  id: ModuleId;
  zone: ZoneId;
  index: number;
  onDragStart: (id: ModuleId, zone: ZoneId) => void;
  onDragEnd: () => void;
}) {
  const Comp = MODULE_COMPONENTS[id];
  return (
    <ModuleShell
      id={id}
      zone={zone}
      index={index}
      isPanel={isPanelModule(id)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <Comp />
    </ModuleShell>
  );
}
