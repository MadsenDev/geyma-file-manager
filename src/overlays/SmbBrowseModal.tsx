import { tr } from "@/i18n";
import { useState } from "react";
import { useStore, smbDeviceKey } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Modal } from "./Modal";
import type { SmbDevice } from "../fs/types";

interface SmbBrowseModalProps {
  /** The discovered device whose shares should be enumerated. */
  device: SmbDevice;
  onClose: () => void;
}

/** Credentials prompt for enumerating shares on a discovered SMB device. Successful
 *  submits close the modal and leave the share list in the store (rendered as children
 *  of the device row in the Network panel); failures keep it open and show the error. */
export function SmbBrowseModal({ device, onClose }: SmbBrowseModalProps) {
  const t = useTheme();
  const loadSmbShares = useStore((s) => s.loadSmbShares);
  const listing = useStore((s) => s.smbShares[smbDeviceKey(device)]);
  const [username, setUsername] = useState(listing?.username ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(listing?.remember ?? true);
  const [error, setError] = useState<string | null>(null);
  const busy = listing?.status === "loading";

  async function submit(asGuest: boolean) {
    if (busy) return;
    setError(null);
    const ok = await loadSmbShares(
      device,
      asGuest ? "" : username.trim(),
      asGuest ? "" : password,
      asGuest ? false : remember
    );
    if (ok) onClose();
    else setError(useStore.getState().smbShares[smbDeviceKey(device)]?.error ?? null);
  }

  return (
    <Modal title={tr("ui.smb_browse_modal.title", { name: device.name })} onClose={onClose}>
      <div style={{ fontSize: 12, color: t.inkSoft, marginBottom: 12 }}>
        {tr("ui.smb_browse_modal.hint", { host: device.hostname })}
      </div>
      <FormField label={tr("ui.smb_browse_modal.username")}>
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={tr("ui.smb_browse_modal.guest")}
          style={inputStyle(t)}
        />
      </FormField>
      <FormField label={tr("ui.smb_browse_modal.password")}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit(false)}
          style={inputStyle(t)}
        />
      </FormField>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          fontSize: 12.5,
          color: t.inkSoft,
          cursor: "pointer",
        }}
      >
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {tr("ui.smb_browse_modal.remember_password")}
      </label>
      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#C24444" }}>{error}</div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button
          onClick={onClose}
          className="gy-soft"
          style={{
            border: `1px solid ${t.border}`,
            background: "transparent",
            color: t.inkSoft,
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5,
          }}
        >
          {tr("ui.smb_browse_modal.cancel")}
        </button>
        <button
          onClick={() => void submit(true)}
          disabled={busy}
          className="gy-soft"
          style={{
            border: `1px solid ${t.border}`,
            background: "transparent",
            color: t.inkSoft,
            borderRadius: 8,
            padding: "7px 14px",
            cursor: busy ? "default" : "pointer",
            fontSize: 12.5,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {tr("ui.smb_browse_modal.browse_as_guest")}
        </button>
        <button
          onClick={() => void submit(false)}
          disabled={busy}
          className="gy-prim"
          style={{
            border: "none",
            background: t.accent,
            color: "#fff",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: busy ? "default" : "pointer",
            fontSize: 12.5,
            fontWeight: 700,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {tr("ui.smb_browse_modal.list_shares")}
        </button>
      </div>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11.5, color: t.inkFaint, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function inputStyle(t: ReturnType<typeof useTheme>): React.CSSProperties {
  return {
    width: "100%",
    height: 32,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "0 10px",
    fontSize: 12.5,
    background: t.main,
    color: t.ink,
    fontFamily: "inherit",
  };
}
