import { tr } from "@/i18n";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { DANGER } from "../theme/skins";
import { Modal } from "./Modal";

/** Shown when an SFTP connect was refused because the server's key no longer matches
 *  the one pinned on first connect (see src-tauri/src/remote/hostkeys.rs). Trusting is
 *  an explicit action that forgets the old pin and reconnects. */
export function HostKeyMismatchPrompt() {
  const t = useTheme();
  const pending = useStore((s) => s.pendingHostKeyMismatch);
  const connections = useStore((s) => s.remoteConnections);
  const trustNewHostKey = useStore((s) => s.trustNewHostKey);
  const dismiss = useStore((s) => s.dismissHostKeyMismatch);
  if (!pending) return null;
  const conn = connections.find((c) => c.id === pending.connectionId);
  if (!conn) return null;
  return (
    <Modal title={tr("ui.host_key_prompt.title")} onClose={dismiss}>
      <div style={{ fontSize: 12.5, color: t.inkSoft, lineHeight: 1.5 }}>
        {tr("ui.host_key_prompt.explanation", { host: conn.host, port: conn.port })}
      </div>
      {pending.detail && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 10px",
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            fontFamily: t.mono,
            fontSize: 10.5,
            color: t.inkFaint,
            overflowWrap: "anywhere",
          }}>
          {pending.detail}
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 14,
        }}>
        <button
          onClick={dismiss}
          className="gy-soft"
          style={{
            border: `1px solid ${t.border}`,
            background: "transparent",
            color: t.inkSoft,
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5,
          }}>
          {tr("ui.host_key_prompt.cancel")}
        </button>
        <button
          onClick={() => void trustNewHostKey(conn.id)}
          className="gy-prim"
          style={{
            border: "none",
            background: DANGER,
            color: "#fff",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 700,
          }}>
          {tr("ui.host_key_prompt.trust")}
        </button>
      </div>
    </Modal>
  );
}
