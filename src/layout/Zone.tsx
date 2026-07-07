import { Fragment, useRef, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { isPanelModule, type ModuleId, type ZoneId } from "../state/layout";
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
      const mid = isHoriz ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
      if (pos < mid) return i;
    }
    return children.length;
  }

  return (
    <div
      ref={containerRef}
      data-zone={zoneId}
      onDragOver={(e) => {
        if (!draggingRef.current && !e.dataTransfer.types.includes(MODULE_DRAG_TYPE)) return;
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
        gap: orientation === "h" ? 6 : 10,
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
          {dragOverIndex === i && (
            <div
              key={`drop-${i}`}
              style={
                orientation === "h"
                  ? { width: 2, alignSelf: "stretch", background: t.accent, borderRadius: 2 }
                  : { height: 2, background: t.accent, borderRadius: 2 }
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
              ? { width: 2, alignSelf: "stretch", background: t.accent, borderRadius: 2 }
              : { height: 2, background: t.accent, borderRadius: 2 }
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
    <ModuleShell id={id} zone={zone} index={index} isPanel={isPanelModule(id)} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <Comp />
    </ModuleShell>
  );
}
