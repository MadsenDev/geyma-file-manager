import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA, DANGER } from "../theme/skins";
export function ContextMenu() {
  const t = useTheme();
  const menu = useStore((s) => s.menu);
  const closeMenu = useStore((s) => s.closeMenu);
  if (!menu) return null;
  const width = 230;
  const x = Math.min(menu.x, window.innerWidth - width - 8);
  const estHeight = 40 + menu.items.length * 34;
  const y = Math.min(menu.y, window.innerHeight - estHeight - 8);
  return (
    <>
      <div
        onMouseDown={closeMenu}
        onContextMenu={(e) => {
          e.preventDefault();
          closeMenu();
        }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 118
        }} />
      
      <div
        className="gy-anim"
        style={{
          position: "fixed",
          left: Math.max(6, x),
          top: Math.max(6, y),
          zIndex: 119,
          width,
          padding: 6,
          borderRadius: 12,
          background: t.card,
          border: `1px solid ${
          t.border}`,

          boxShadow: `0 16px 44px ${hexA("#000000", t.isDark ? 0.55 : 0.24)}`
        }}>
        
        {menu.items.map((item, i) =>
        item.divider ?
        <div
          key={i}
          style={{
            height: 1,
            background: t.border,
            margin: "5px 4px"
          }} /> :


        <button
          key={i}
          onClick={() => {
            item.onClick?.();
            closeMenu();
          }}
          className="gy-soft"
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            border: 0,
            background: "transparent",
            padding: "8px 10px",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12.5,
            color: item.danger ? DANGER : t.ink
          }}>
          
              {item.label}
            </button>

        )}
      </div>
    </>);

}