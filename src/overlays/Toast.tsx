import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";

export function Toast() {
  const t = useTheme();
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      className="gy-anim"
      style={{
        position: "fixed",
        bottom: 74,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 210,
        padding: "9px 16px",
        borderRadius: 99,
        background: t.ink,
        color: t.bg,
        fontSize: 12.5,
        fontWeight: 600,
        boxShadow: `0 12px 30px ${hexA("#000000", 0.3)}`,
        maxWidth: "min(90vw, 420px)",
        textAlign: "center",
      }}
    >
      {toast}
    </div>
  );
}
