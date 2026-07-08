import { tr } from "@/i18n";
import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { Modal } from "./Modal";
import type { RemoteConnection } from "../state/types";
const DEFAULT_PORT: Record<RemoteConnection["protocol"], number> = {
  sftp: 22,
  smb: 445
};
interface ConnectionModalProps {
  /** null adds a new connection; otherwise edits (and re-authenticates) this one. */
  initial: RemoteConnection | null;
  onClose: () => void;
}
export function ConnectionModal({ initial, onClose }: ConnectionModalProps) {
  const t = useTheme();
  const addRemoteConnection = useStore((s) => s.addRemoteConnection);
  const updateRemoteConnection = useStore((s) => s.updateRemoteConnection);
  const connectRemoteConnection = useStore((s) => s.connectRemoteConnection);
  const showToast = useStore((s) => s.showToast);
  const [protocol, setProtocol] = useState<RemoteConnection["protocol"]>(
    initial?.protocol ?? "sftp"
  );
  const [label, setLabel] = useState(initial?.label ?? "");
  const [host, setHost] = useState(initial?.host ?? "");
  const [port, setPort] = useState(String(initial?.port ?? DEFAULT_PORT.sftp));
  const [username, setUsername] = useState(initial?.username ?? "");
  const [share, setShare] = useState(initial?.share ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(initial?.savePassword ?? true);
  function switchProtocol(next: RemoteConnection["protocol"]) {
    if (next === protocol) return;
    if (Number(port) === DEFAULT_PORT[protocol])
    setPort(String(DEFAULT_PORT[next]));
    setProtocol(next);
  }
  function handleSubmit() {
    const trimmedHost = host.trim();
    const trimmedUser = username.trim();
    const trimmedShare = share.trim();
    if (!trimmedHost || !trimmedUser || protocol === "smb" && !trimmedShare) {
      showToast(
        protocol === "smb" ? tr("ui.connection_modal.fill_in_smb") : tr("ui.connection_modal.fill_in")
      );
      return;
    }
    const portNum = Number(port) || DEFAULT_PORT[protocol];
    const fields = {
      protocol,
      label: label.trim() || trimmedHost,
      host: trimmedHost,
      port: portNum,
      username: trimmedUser,
      share: protocol === "smb" ? trimmedShare : undefined,
      savePassword: remember
    };
    const id = initial ? initial.id : addRemoteConnection(fields);
    if (initial) updateRemoteConnection(initial.id, fields);
    if (password.trim()) void connectRemoteConnection(id, password.trim());
    onClose();
  }
  return (
    <Modal
      title={initial ? tr("ui.connection_modal.edit_title") : tr("ui.connection_modal.new_title")}
      onClose={onClose}>
      
      <div
        style={{
          display: "flex",
          gap: 3,
          background: hexA(t.ink, t.isDark ? 0.14 : 0.06),
          borderRadius: 8,
          padding: 3,
          marginBottom: 12
        }}>
        
        {(["sftp", "smb"] as const).map((p) =>
        <button
          key={p}
          type="button"
          onClick={() => switchProtocol(p)}
          style={{
            flex: 1,
            height: 28,
            border: 0,
            borderRadius: 6,
            background: protocol === p ? t.card : "transparent",
            color: protocol === p ? t.ink : t.inkSoft,
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: protocol === p ? 700 : 500,
            cursor: "pointer",
            boxShadow: protocol === p ? "0 1px 3px rgba(0,0,0,.12)" : "none",
            textTransform: "uppercase"
          }}>
          
            {p}
          </button>
        )}
      </div>

      <FormField label={tr("ui.connection_modal.label_optional")}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={host || "e.g. Home NAS"}
          style={inputStyle(t)} />
        
      </FormField>
      <div
        style={{
          display: "flex",
          gap: 8
        }}>
        
        <div
          style={{
            flex: 1
          }}>
          
          <FormField label={tr("ui.connection_modal.host")}>
            <input
              autoFocus
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={tr("ui.connection_modal.nas_local_or_192_168_1_10")}
              style={inputStyle(t)} />
            
          </FormField>
        </div>
        <div
          style={{
            width: 84
          }}>
          
          <FormField label={tr("ui.connection_modal.port")}>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
              style={inputStyle(t)} />
            
          </FormField>
        </div>
      </div>
      <FormField label={tr("ui.connection_modal.username")}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle(t)} />
        
      </FormField>
      {protocol === "smb" &&
      <FormField label={tr("ui.connection_modal.share")}>
          <input
          value={share}
          onChange={(e) => setShare(e.target.value)}
          placeholder={tr("ui.connection_modal.e_g_media")}
          style={inputStyle(t)} />
        
        </FormField>
      }
      <FormField
        label={
        initial ?
        tr("ui.connection_modal.password_keep") :
        tr("ui.connection_modal.password")
        }>
        
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          style={inputStyle(t)} />
        
      </FormField>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          fontSize: 12.5,
          color: t.inkSoft,
          cursor: "pointer"
        }}>
        
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)} />
        
        {tr("ui.connection_modal.remember_password_stored_in_your_os_keyring")}
      </label>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 14
        }}>
        
        <button
          onClick={onClose}
          className="gy-soft"
          style={{
            border: `1px solid ${
            t.border}`,

            background: "transparent",
            color: t.inkSoft,
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5
          }}>
          
          {tr("ui.connection_modal.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          className="gy-prim"
          style={{
            border: "none",
            background: t.accent,
            color: "#fff",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 700
          }}>
          
          {initial ?
          tr("ui.connection_modal.save_connect") :
          tr("ui.connection_modal.add_connect")}
        </button>
      </div>
    </Modal>);

}
function FormField({
  label,
  children



}: {label: string;children: React.ReactNode;}) {
  const t = useTheme();
  return (
    <div
      style={{
        marginBottom: 10
      }}>
      
      <label
        style={{
          display: "block",
          fontSize: 11.5,
          color: t.inkFaint,
          marginBottom: 4
        }}>
        
        {label}
      </label>
      {children}
    </div>);

}
function inputStyle(t: ReturnType<typeof useTheme>): React.CSSProperties {
  return {
    width: "100%",
    height: 32,
    border: `1px solid ${
    t.border}`,

    borderRadius: 8,
    padding: "0 10px",
    fontSize: 12.5,
    background: t.main,
    color: t.ink,
    fontFamily: "inherit"
  };
}