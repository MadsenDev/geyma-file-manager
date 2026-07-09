import { tr } from "@/i18n";
import { useState } from "react";
import type { MediaPlaybackSupport } from "../../fs";
import { hexA } from "../../theme/skins";
import { useTheme } from "../../theme/ThemeContext";

export function MediaUnavailable({ support, onRetry }: { support: MediaPlaybackSupport; onRetry: () => void }) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);
  const copyCommand = () => {
    if (!support.installCommand) return;
    navigator.clipboard
      ?.writeText(support.installCommand)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };
  return (
    <div role="alert" style={{ minHeight: 260, display: "grid", placeItems: "center", padding: 28 }}>
      <div style={{ width: "100%", maxWidth: 460, display: "grid", gap: 14, justifyItems: "start" }}>
        <span
          style={{
            width: 40,
            height: 40,
            display: "grid",
            placeItems: "center",
            borderRadius: 12,
            background: hexA(t.accent, 0.12),
            color: t.accent,
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          !
        </span>
        <div>
          <div style={{ color: t.ink, fontSize: 16, fontWeight: 750, marginBottom: 6 }}>{support.title}</div>
          <div style={{ color: t.inkSoft, fontSize: 12.5, lineHeight: 1.55 }}>{support.message}</div>
        </div>
        {support.installCommand && (
          <div style={{ width: "100%", display: "grid", gap: 7 }}>
            <span style={{ color: t.inkFaint, fontSize: 10, fontFamily: t.mono }}>
              {tr("ui.quick_look.install_the_missing_component_then_retry")}
            </span>
            <button
              type="button"
              onClick={copyCommand}
              title={tr("ui.quick_look.copy_install_command")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                border: `1px solid ${t.border}`,
                borderRadius: 9,
                background: t.main,
                color: t.ink,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: t.mono,
                fontSize: 10.5,
              }}
            >
              <code style={{ overflowWrap: "anywhere" }}>{support.installCommand}</code>
              <span style={{ color: t.accent, flex: "none" }}>
                {copied ? tr("ui.quick_look.copied") : tr("ui.quick_look.copy")}
              </span>
            </button>
          </div>
        )}
        {support.details && (
          <details style={{ width: "100%", color: t.inkFaint, fontFamily: t.mono, fontSize: 9.5 }}>
            <summary style={{ cursor: "pointer" }}>{tr("ui.quick_look.technical_details")}</summary>
            <div
              style={{
                marginTop: 7,
                padding: 9,
                borderRadius: 7,
                background: t.main,
                overflowWrap: "anywhere",
                lineHeight: 1.5,
              }}
            >
              {support.details}
            </div>
          </details>
        )}
        <button
          type="button"
          onClick={onRetry}
          style={{
            border: 0,
            borderRadius: 8,
            padding: "8px 14px",
            background: t.accent,
            color: t.card,
            cursor: "pointer",
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          {tr("ui.quick_look.retry_preview")}
        </button>
      </div>
    </div>
  );
}
