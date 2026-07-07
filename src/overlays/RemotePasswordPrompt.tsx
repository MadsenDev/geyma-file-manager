import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Modal } from "./Modal";

export function RemotePasswordPrompt() {
  const t = useTheme();
  const pendingId = useStore((s) => s.pendingRemotePasswordPromptId);
  const connections = useStore((s) => s.remoteConnections);
  const connectRemoteConnection = useStore((s) => s.connectRemoteConnection);
  const dismiss = useStore((s) => s.dismissRemotePasswordPrompt);
  const [password, setPassword] = useState("");

  if (!pendingId) return null;
  const conn = connections.find((c) => c.id === pendingId);
  if (!conn) return null;

  function submit() {
    if (!password.trim()) return;
    void connectRemoteConnection(pendingId!, password.trim());
    setPassword("");
  }

  return (
    <Modal title={`Connect to ${conn.label}`} onClose={dismiss}>
      <label style={{ display: "block", fontSize: 12, color: t.inkSoft, marginBottom: 6 }}>
        Password for {conn.username}@{conn.host}
      </label>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ width: "100%", height: 34, border: `1px solid ${t.border}`, borderRadius: 8, padding: "0 10px", fontSize: 13, background: t.main, color: t.ink }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button onClick={dismiss} className="gy-soft" style={{ border: `1px solid ${t.border}`, background: "transparent", color: t.inkSoft, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12.5 }}>
          Cancel
        </button>
        <button
          onClick={submit}
          className="gy-prim"
          style={{ border: "none", background: t.accent, color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}
        >
          Connect
        </button>
      </div>
    </Modal>
  );
}
