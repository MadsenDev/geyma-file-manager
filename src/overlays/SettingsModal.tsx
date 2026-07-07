import { Appearance } from "../modules/Appearance";
import { ConfirmationsSettings, GeneralSettings } from "../modules/Settings";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";

const TABS = [
  { id: "appearance", label: "Appearance" },
  { id: "confirmations", label: "Confirmations" },
  { id: "general", label: "General" },
] as const;

export function SettingsModal() {
  const t = useTheme();
  const open = useStore((s) => s.settingsOpen);
  const close = useStore((s) => s.closeSettings);
  const tab = useStore((s) => s.settingsTab);
  const setTab = useStore((s) => s.setSettingsTab);

  if (!open) return null;

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: hexA("#000000", t.isDark ? 0.5 : 0.28), zIndex: 300 }} />
      <div
        role="dialog"
        aria-label="Settings"
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
            Settings
          </div>
          <button onClick={close} title="Close" className="gy-soft" style={{ width: 28, height: 28, display: "grid", placeItems: "center", border: 0, borderRadius: 8, background: "transparent", color: t.inkFaint, cursor: "pointer" }}>
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <div style={{ display: "flex", padding: "8px 10px 0" }}>
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              style={{
                flex: 1,
                padding: "7px 0",
                border: 0,
                borderBottom: `2px solid ${tab === tb.id ? t.accent : "transparent"}`,
                background: "transparent",
                color: tab === tb.id ? t.ink : t.inkFaint,
                fontWeight: tab === tb.id ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div style={{ overflow: "auto" }}>
          {tab === "appearance" && <Appearance />}
          {tab === "confirmations" && (
            <div style={{ padding: 12 }}>
              <ConfirmationsSettings />
            </div>
          )}
          {tab === "general" && (
            <div style={{ padding: 12 }}>
              <GeneralSettings />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
