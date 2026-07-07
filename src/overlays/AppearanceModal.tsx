import { Appearance } from "../modules/Appearance";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";

export function AppearanceModal() {
  const t = useTheme();
  const open = useStore((s) => s.appearanceOpen);
  const close = useStore((s) => s.closeAppearance);

  if (!open) return null;

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: hexA("#000000", t.isDark ? 0.5 : 0.28), zIndex: 300 }} />
      <div
        role="dialog"
        aria-label="Appearance"
        className="gy-dialog-anim"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(560px, 100vw - 48px)",
          maxHeight: "min(82vh, 760px)",
          display: "flex",
          flexDirection: "column",
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          boxShadow: `0 24px 64px ${hexA("#000000", t.isDark ? 0.6 : 0.28)}`,
          zIndex: 301,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ flex: 1, minWidth: 0, fontFamily: t.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: t.inkFaint, fontWeight: 700 }}>
            Appearance
          </div>
          <button onClick={close} title="Close" className="gy-soft" style={{ width: 28, height: 28, display: "grid", placeItems: "center", border: 0, borderRadius: 8, background: "transparent", color: t.inkFaint, cursor: "pointer" }}>
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <div style={{ overflow: "auto" }}>
          <Appearance />
        </div>
      </div>
    </>
  );
}
