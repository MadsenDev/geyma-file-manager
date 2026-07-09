import { tr } from "@/i18n";
import type { ResolvedTheme } from "../theme/skins";
import { DANGER, hexA } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";

/**
 * The one inline error presentation: warning icon, translated headline, optional raw
 * detail, optional Retry. Used anywhere a panel shows a failure in place (folder
 * listings, properties, previews, crashed modules) so errors read the same everywhere
 * and long messages wrap inside the panel instead of stretching it.
 */
export function ErrorNotice({
  message,
  detail,
  onRetry,
  retryLabel,
  t,
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  t: ResolvedTheme;
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "18px 16px",
        maxWidth: 360,
        margin: "0 auto",
        textAlign: "center",
      }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          color: DANGER,
          background: hexA(DANGER, t.isDark ? 0.18 : 0.1),
        }}>
        <Icon d={ICONS.warning} size={17} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, overflowWrap: "anywhere" }}>{message}</span>
      {detail && (
        <span style={{ fontSize: 11, color: t.inkFaint, fontFamily: t.mono, overflowWrap: "anywhere" }}>
          {detail}
        </span>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="gy-soft"
          style={{
            marginTop: 2,
            padding: "5px 14px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: "transparent",
            color: t.inkSoft,
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
          }}>
          {retryLabel ?? tr("common.retry")}
        </button>
      )}
    </div>
  );
}
export function ToggleRow({
  label,
  value,
  onChange,
  t





}: {label: string;value: boolean;onChange: (v: boolean) => void;t: ResolvedTheme;}) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: 0,
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        width: "100%"
      }}>
      
      <span
        style={{
          fontSize: 12.5,
          color: t.ink
        }}>
        
        {label}
      </span>
      <span
        style={{
          width: 34,
          height: 20,
          borderRadius: 99,
          background: value ? t.accent : hexA(t.ink, 0.18),
          position: "relative"
        }}>
        
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: 99,
            background: "#fff",
            transition: "left .15s"
          }} />
        
      </span>
    </button>);

}
export function panelTitleStyle(t: ResolvedTheme): React.CSSProperties {
  return {
    fontFamily: t.mono,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".12em",
    fontWeight: 700,
    color: t.inkFaint,
    padding: "10px 12px 6px"
  };
}
export function navItemStyle(
t: ResolvedTheme,
active: boolean,
dragOver: boolean)
: React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "7px 9px",
    borderRadius: 9,
    border: "1px solid transparent",
    background: active ? hexA(t.accent, t.isDark ? 0.2 : 0.14) : "transparent",
    color: active ? t.accent : t.inkSoft,
    fontWeight: active ? 700 : 500,
    fontSize: 12.5,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    ...(dragOver ?
    {
      outline: `2px solid ${
      t.accent}`,

      outlineOffset: -2,
      background: hexA(t.accent, 0.14)
    } :
    {})
  };
}
export function iconButtonStyle(
t: ResolvedTheme,
active = false)
: React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: "grid",
    placeItems: "center",
    border: `1px solid ${
    t.border}`,

    borderRadius: 8,
    background: active ? hexA(t.accent, 0.16) : "transparent",
    color: active ? t.accent : t.inkSoft,
    cursor: "pointer",
    flex: "none",
    padding: 0
  };
}
export function chipStyle(
t: ResolvedTheme,
active: boolean)
: React.CSSProperties {
  return {
    height: 22,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 10px",
    borderRadius: 99,
    fontFamily: t.mono,
    fontSize: 9.5,
    fontWeight: active ? 700 : 500,
    border: `1px solid ${active ? hexA(t.accent, 0.5) : "transparent"}`,
    background: active ? hexA(t.accent, 0.14) : hexA(t.inkSoft, 0.1),
    color: active ? t.accent : t.inkSoft,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flex: "none"
  };
}