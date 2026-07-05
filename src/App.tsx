import { useEffect, useRef } from "react";
import { useStore } from "./state/store";
import { useTheme } from "./theme/ThemeContext";
import { hexA } from "./theme/skins";
import { Zone } from "./layout/Zone";
import { EditBar } from "./layout/EditBar";
import { Icon } from "./icons/Icon";
import { ICONS } from "./icons/paths";
import { QuickLook } from "./overlays/QuickLook";
import { ContextMenu } from "./overlays/ContextMenu";
import { Toast } from "./overlays/Toast";
import { useKeyboardShortcuts } from "./lib/useKeyboardShortcuts";

export function App() {
  const t = useTheme();
  const init = useStore((s) => s.init);
  const layout = useStore((s) => s.layout);
  const editMode = useStore((s) => s.editMode);
  const toggleEditMode = useStore((s) => s.toggleEditMode);
  const railW = useStore((s) => s.railW);
  const setRailWidth = useStore((s) => s.setRailWidth);
  const centerSplit = useStore((s) => s.centerSplit);
  const centerRatio = useStore((s) => s.centerRatio);
  const setCenterRatio = useStore((s) => s.setCenterRatio);
  const motion = useStore((s) => s.motion);
  const backend = useStore((s) => s.backend);
  const centerWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useKeyboardShortcuts();

  const hasTop = layout.top.length > 0;
  const hasLeft = layout.left.length > 0 || editMode;
  const hasRight = layout.right.length > 0 || editMode;
  const hasBottom = layout.bottom.length > 0 || editMode;

  function startRailDrag(side: "left" | "right", e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = railW[side];
    function onMove(ev: MouseEvent) {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      setRailWidth(side, startW + delta);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startCenterSplitDrag(e: React.MouseEvent) {
    e.preventDefault();
    const wrap = centerWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    function onMove(ev: MouseEvent) {
      let ratio = (ev.clientY - rect.top) / rect.height;
      ratio = Math.max(0.2, Math.min(0.8, ratio));
      setCenterRatio(ratio);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  if (!backend) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", color: t.inkFaint, fontFamily: t.body }}>
        Loading Geyma…
      </div>
    );
  }

  return (
    <div
      className={`gy-motion-${motion}`}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        background: t.bg,
        color: t.ink,
        fontFamily: t.body,
        overflow: "hidden",
      }}
    >
      {hasTop && (
        <Zone zoneId="top" orientation="h" emptyHint="Top zone — drop modules here" style={{ borderBottom: `1px solid ${t.border}`, background: t.surface, flex: "none" }} />
      )}

      <div style={{ display: "flex", flex: "1 1 0", minHeight: 0 }}>
        {hasLeft && (
          <Zone zoneId="left" orientation="v" emptyHint="Left rail — drop here" style={{ width: railW.left, flex: "none", borderRight: `1px solid ${t.border}` }} />
        )}
        {hasLeft && (
          <div onMouseDown={(e) => startRailDrag("left", e)} title="Drag to resize" style={gutterStyle(t.border)}>
            <span style={gripStyle(t.inkFaint)} />
          </div>
        )}

        <div ref={centerWrapRef} style={{ display: "flex", flexDirection: "column", flex: "1 1 0", minWidth: 0 }}>
          <Zone zoneId="center" orientation="v" emptyHint="Center — drop modules here" style={{ flex: centerSplit ? `0 0 ${centerRatio * 100}%` : "1 1 0" }} />
          {centerSplit && (
            <div onMouseDown={startCenterSplitDrag} title="Drag to resize" style={{ ...gutterStyle(t.border), width: "100%", height: 6, cursor: "row-resize" }}>
              <span style={{ ...gripStyle(t.inkFaint), width: 28, height: 3 }} />
            </div>
          )}
          {centerSplit && <Zone zoneId="center2" orientation="v" emptyHint="Lower pane — drop modules here" style={{ flex: "1 1 0", borderTop: `1px solid ${t.border}` }} />}
        </div>

        {hasRight && (
          <div onMouseDown={(e) => startRailDrag("right", e)} title="Drag to resize" style={gutterStyle(t.border)}>
            <span style={gripStyle(t.inkFaint)} />
          </div>
        )}
        {hasRight && (
          <Zone zoneId="right" orientation="v" emptyHint="Right rail — drop here" style={{ width: railW.right, flex: "none", borderLeft: `1px solid ${t.border}` }} />
        )}
      </div>

      {hasBottom && (
        <Zone zoneId="bottom" orientation="h" emptyHint="Bottom zone — drop here" style={{ borderTop: `1px solid ${t.border}`, background: t.surface, flex: "none" }} />
      )}

      {editMode && <EditBar />}

      {!editMode && (
        <button
          onClick={toggleEditMode}
          title="Edit layout"
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            width: 40,
            height: 40,
            borderRadius: 99,
            border: `1px solid ${t.border}`,
            background: t.card,
            color: t.inkSoft,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            boxShadow: `0 8px 24px ${hexA("#000000", t.isDark ? 0.45 : 0.16)}`,
            zIndex: 90,
          }}
        >
          <Icon d={ICONS.pencil} size={17} />
        </button>
      )}

      <QuickLook />
      <ContextMenu />
      <Toast />
    </div>
  );
}

function gutterStyle(border: string): React.CSSProperties {
  return {
    width: 6,
    flex: "none",
    cursor: "col-resize",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    borderLeft: `1px solid ${border}`,
  };
}

function gripStyle(color: string): React.CSSProperties {
  return { width: 3, height: 28, borderRadius: 3, background: hexA(color, 0.4) };
}
