import { useEffect, useRef } from "react";
import { useStore } from "./state/store";
import { useTheme } from "./theme/ThemeContext";
import { hexA } from "./theme/skins";
import { Zone } from "./layout/Zone";
import { EditBar } from "./layout/EditBar";
import { Titlebar } from "./layout/Titlebar";
import { Icon } from "./icons/Icon";
import { ICONS } from "./icons/paths";
import { QuickLook } from "./overlays/QuickLook";
import { ContextMenu } from "./overlays/ContextMenu";
import { ModuleOptions } from "./overlays/ModuleOptions";
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
  const openMenu = useStore((s) => s.openMenu);
  const closeMenu = useStore((s) => s.closeMenu);
  const centerWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const suppressNativeMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("contextmenu", suppressNativeMenu);
    return () => document.removeEventListener("contextmenu", suppressNativeMenu);
  }, []);

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
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: t.bg, color: t.inkFaint, fontFamily: t.body }}>
        <Titlebar />
        <div style={{ flex: 1, display: "grid", placeItems: "center" }}>Loading Geyma…</div>
      </div>
    );
  }

  return (
    <div
      className={`gy-motion-${motion}`}
      onContextMenu={(event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          openTextContextMenu(event, target, openMenu);
        } else {
          closeMenu();
        }
      }}
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
      <Titlebar />
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
      <ModuleOptions />
      <Toast />
    </div>
  );
}

function openTextContextMenu(
  event: React.MouseEvent,
  target: HTMLInputElement | HTMLTextAreaElement,
  openMenu: ReturnType<typeof useStore.getState>["openMenu"],
) {
  const start = target.selectionStart ?? 0;
  const end = target.selectionEnd ?? start;
  const selectedText = target.value.slice(start, end);
  const editable = !target.readOnly && !target.disabled;

  const replaceSelection = (text: string) => {
    target.focus();
    target.setRangeText(text, start, end, "end");
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  };
  const copy = () => {
    if (selectedText) navigator.clipboard?.writeText(selectedText).catch(() => {});
  };

  openMenu({
    x: event.clientX,
    y: event.clientY,
    items: [
      editable && selectedText ? { label: "Cut", onClick: () => { copy(); replaceSelection(""); } } : undefined,
      selectedText ? { label: "Copy", onClick: copy } : undefined,
      editable ? {
        label: "Paste",
        onClick: () => navigator.clipboard?.readText().then(replaceSelection).catch(() => useStore.getState().showToast("Clipboard access was denied")),
      } : undefined,
      { divider: true },
      { label: "Select all", onClick: () => { target.focus(); target.select(); } },
    ].filter(Boolean) as { label?: string; divider?: boolean; onClick?: () => void }[],
  });
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
