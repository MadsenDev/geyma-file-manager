import { tr } from "@/i18n";
import { useEffect, useState } from "react";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
const isTauri =
typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
type ResizeDirection = Parameters<Window["startResizeDragging"]>[0];
const GLYPH = {
  minimize: tr("ui.titlebar.m6_12h12"),
  maximize: tr("ui.titlebar.m6_5_6_5h11v11h_11z"),
  restore: tr("ui.titlebar.m6_5_9_5h8v8h_8z_m9_5_9_5v_3h8v8h_3")
};
export function Titlebar() {
  const t = useTheme();
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!isTauri) return;
    const win = getCurrentWindow();
    void win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setMaximized);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);
  if (!isTauri) return null;
  const win = getCurrentWindow();
  return (
    <>
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          height: 34,
          flex: "none",
          background: t.surface,
          borderBottom: `1px solid ${
          t.border}`,

          paddingLeft: 12,
          userSelect: "none"
        }}>
        
        <img
          src="/geyma.svg"
          alt=""
          width={16}
          height={16}
          style={{
            pointerEvents: "none",
            borderRadius: 4,
            marginRight: 8
          }} />
        
        <span
          style={{
            pointerEvents: "none",
            fontFamily: t.mono,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".18em",
            color: t.inkFaint
          }}>
          
          {tr("ui.titlebar.geyma")}
        </span>
        <span
          data-tauri-drag-region
          style={{
            flex: 1,
            alignSelf: "stretch"
          }} />
        
        <WindowButton
          title={tr("ui.titlebar.minimize")}
          onClick={() => void win.minimize()}>
          
          <Icon d={GLYPH.minimize} size={13} />
        </WindowButton>
        <WindowButton
          title={maximized ? "Restore" : "Maximize"}
          onClick={() => void win.toggleMaximize()}>
          
          <Icon d={maximized ? GLYPH.restore : GLYPH.maximize} size={13} />
        </WindowButton>
        <WindowButton
          title={tr("ui.titlebar.close")}
          danger
          onClick={() => void win.close()}>
          
          <Icon d={ICONS.close} size={13} />
        </WindowButton>
      </div>
      {!maximized && <ResizeHandles />}
    </>);

}
function WindowButton({
  title,
  danger,
  onClick,
  children





}: {title: string;danger?: boolean;onClick: () => void;children: React.ReactNode;}) {
  const t = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 44,
        height: 34,
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: "default",
        background: hover ?
        danger ?
        "#E5484D" :
        hexA(t.ink, t.isDark ? 0.1 : 0.07) :
        "transparent",
        color: hover && danger ? "#FFFFFF" : t.inkSoft
      }}>
      
      {children}
    </button>);

}

// WebKitGTK gives undecorated windows no resize borders, so provide our own edge handles.
function ResizeHandles() {
  const start = (dir: ResizeDirection) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    void getCurrentWindow().startResizeDragging(dir);
  };
  const E = 5; // edge thickness
  const C = 12; // corner size
  const base: React.CSSProperties = {
    position: "fixed",
    zIndex: 200
  };
  return (
    <>
      <div
        onMouseDown={start("North")}
        style={{
          ...base,
          top: 0,
          left: C,
          right: C,
          height: E,
          cursor: "n-resize"
        }} />
      
      <div
        onMouseDown={start("South")}
        style={{
          ...base,
          bottom: 0,
          left: C,
          right: C,
          height: E,
          cursor: "s-resize"
        }} />
      
      <div
        onMouseDown={start("West")}
        style={{
          ...base,
          top: C,
          bottom: C,
          left: 0,
          width: E,
          cursor: "w-resize"
        }} />
      
      <div
        onMouseDown={start("East")}
        style={{
          ...base,
          top: C,
          bottom: C,
          right: 0,
          width: E,
          cursor: "e-resize"
        }} />
      
      <div
        onMouseDown={start("NorthWest")}
        style={{
          ...base,
          top: 0,
          left: 0,
          width: C,
          height: C,
          cursor: "nw-resize"
        }} />
      
      <div
        onMouseDown={start("NorthEast")}
        style={{
          ...base,
          top: 0,
          right: 0,
          width: C,
          height: C,
          cursor: "ne-resize"
        }} />
      
      <div
        onMouseDown={start("SouthWest")}
        style={{
          ...base,
          bottom: 0,
          left: 0,
          width: C,
          height: C,
          cursor: "sw-resize"
        }} />
      
      <div
        onMouseDown={start("SouthEast")}
        style={{
          ...base,
          bottom: 0,
          right: 0,
          width: C,
          height: C,
          cursor: "se-resize"
        }} />
      
    </>);

}