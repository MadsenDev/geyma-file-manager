import { useStore } from "../state/store";
import type { ToastItem } from "../state/types";
import { useTheme } from "../theme/ThemeContext";
import type { ResolvedTheme } from "../theme/skins";
import { DANGER, hexA } from "../theme/skins";

// Shared clamp so an unexpectedly long error message (raw paths, protocol noise)
// wraps a few lines and then ellipsizes instead of stretching the pill off-screen.
function clampStyle(lines: number): React.CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
    overflowWrap: "anywhere",
  };
}

function ToastCard({ toast, t }: { toast: ToastItem; t: ResolvedTheme }) {
  const dismissToast = useStore((s) => s.dismissToast);
  const isError = toast.kind === "error";
  return (
    <div
      className="gy-anim"
      onClick={() => dismissToast(toast.id)}
      role={isError ? "alert" : "status"}
      style={{
        padding: toast.detail ? "10px 16px" : "9px 16px",
        borderRadius: toast.detail ? 14 : 99,
        background: t.ink,
        color: t.bg,
        fontSize: 12.5,
        fontWeight: 600,
        boxShadow: `0 12px 30px ${hexA("#000000", 0.3)}`,
        border: isError ? `1.5px solid ${DANGER}` : "1.5px solid transparent",
        maxWidth: "min(90vw, 440px)",
        textAlign: toast.detail ? "left" : "center",
        cursor: "pointer",
        pointerEvents: "auto",
      }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, justifyContent: toast.detail ? "flex-start" : "center" }}>
        {isError && <span aria-hidden style={{ color: DANGER, fontWeight: 800, flex: "none" }}>!</span>}
        <span style={clampStyle(3)}>{toast.message}</span>
      </div>
      {toast.detail && (
        <div
          style={{
            marginTop: 3,
            fontSize: 11.5,
            fontWeight: 500,
            opacity: 0.85,
            ...clampStyle(3),
          }}>
          {toast.detail}
        </div>
      )}
    </div>
  );
}

export function Toast() {
  const t = useTheme();
  const toasts = useStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 74,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 210,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        // Clicks between toasts fall through to the app; the cards re-enable them.
        pointerEvents: "none",
        maxWidth: "90vw",
      }}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} t={t} />
      ))}
    </div>
  );
}
