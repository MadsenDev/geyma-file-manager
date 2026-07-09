import type { StateCreator } from "zustand";
import { tr } from "@/i18n";
import type { SmbDevice, SmbShare } from "../../fs/types";
import { classifyError, type AppError } from "../../lib/errors";
import type { AppState } from "../store";
import type { RemoteConnection, RemoteStatus } from "../types";

/** Key for per-device SMB discovery state (share listings, in-memory credentials). */
export function smbDeviceKey(device: SmbDevice): string {
  return `${device.host}:${device.port}`;
}

export interface SmbShareListing {
  status: "loading" | "loaded" | "error";
  shares: SmbShare[];
  /** Classified listing failure — kept whole (not just the message) so the modal and
   *  device tree can show the translated headline with the raw cause underneath. */
  error: AppError | null;
  /** The credentials the listing was made with, kept only in memory so clicking a
   *  listed share connects without prompting again. Empty username means guest. */
  username: string;
  password: string;
  /** Whether a connection made from this listing should keep its password in the OS keyring. */
  remember: boolean;
}

export interface RemoteSlice {
  remoteConnections: RemoteConnection[];
  remoteStatus: Record<string, RemoteStatus>;
  pendingRemotePasswordPromptId: string | null;

  // SMB discovery (ephemeral — devices found by the last scan, never persisted)
  smbDevices: SmbDevice[];
  smbScan: "idle" | "scanning" | "done" | "error";
  smbShares: Record<string, SmbShareListing>;

  addRemoteConnection(input: Omit<RemoteConnection, "id">): string;
  updateRemoteConnection(id: string, patch: Partial<Omit<RemoteConnection, "id">>): void;
  removeRemoteConnection(id: string): void;
  connectRemoteConnection(id: string, password?: string): Promise<void>;
  disconnectRemoteConnection(id: string): Promise<void>;
  dismissRemotePasswordPrompt(): void;
  discoverSmbDevices(): Promise<void>;
  loadSmbShares(device: SmbDevice, username: string, password: string, remember: boolean): Promise<boolean>;
  forgetSmbShares(device: SmbDevice): void;
  connectDiscoveredShare(device: SmbDevice, shareName: string): Promise<void>;
}

export const createRemoteSlice: StateCreator<AppState, [], [], RemoteSlice> = (set, get) => ({
  remoteConnections: [],
  remoteStatus: {},
  pendingRemotePasswordPromptId: null,

  smbDevices: [],
  smbScan: "idle",
  smbShares: {},

  addRemoteConnection(input) {
    const id = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set({ remoteConnections: [...get().remoteConnections, { ...input, id }] });
    get().persist();
    return id;
  },
  updateRemoteConnection(id, patch) {
    set({ remoteConnections: get().remoteConnections.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
    get().persist();
  },
  removeRemoteConnection(id) {
    const conn = get().remoteConnections.find((c) => c.id === id);
    if (conn && get().remoteStatus[id] === "connected") void get().disconnectRemoteConnection(id);
    get().backend?.keyringDeletePassword(id).catch(() => {});
    const status = { ...get().remoteStatus };
    delete status[id];
    set({
      remoteConnections: get().remoteConnections.filter((c) => c.id !== id),
      remoteStatus: status,
    });
    get().persist();
  },
  async connectRemoteConnection(id, password) {
    const { backend } = get();
    const conn = get().remoteConnections.find((c) => c.id === id);
    if (!backend || !conn) return;
    set({ remoteStatus: { ...get().remoteStatus, [id]: "connecting" }, pendingRemotePasswordPromptId: null });
    try {
      // An explicitly-passed empty string is a real credential (guest login from the
      // discovery tree); only a missing password falls back to keyring/prompt.
      let usedPassword = password;
      if (usedPassword == null && conn.savePassword) {
        usedPassword = (await backend.keyringLoadPassword(id)) ?? undefined;
      }
      if (usedPassword == null) {
        set({ remoteStatus: { ...get().remoteStatus, [id]: "disconnected" }, pendingRemotePasswordPromptId: id });
        return;
      }
      const root = await backend.connectRemote({
        protocol: conn.protocol,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        share: conn.share,
        password: usedPassword,
      });
      if (conn.savePassword) await backend.keyringSavePassword(id, usedPassword).catch((e) => get().showError(tr("toast.keyring_save_failed"), e));
      set({ remoteStatus: { ...get().remoteStatus, [id]: "connected" } });
      get().newTab(root);
    } catch (e) {
      set({ remoteStatus: { ...get().remoteStatus, [id]: "error" }, pendingRemotePasswordPromptId: id });
      get().showError(tr("toast.connection_failed"), e);
    }
  },
  async disconnectRemoteConnection(id) {
    const { backend } = get();
    const conn = get().remoteConnections.find((c) => c.id === id);
    if (!backend || !conn) return;
    try {
      await backend.disconnectRemote({ protocol: conn.protocol, host: conn.host, port: conn.port, username: conn.username, share: conn.share });
    } catch (e) {
      get().showError(tr("toast.disconnect_failed"), e);
    }
    set({ remoteStatus: { ...get().remoteStatus, [id]: "disconnected" } });
  },
  dismissRemotePasswordPrompt() {
    set({ pendingRemotePasswordPromptId: null });
  },
  async discoverSmbDevices() {
    const { backend } = get();
    if (!backend || get().smbScan === "scanning") return;
    set({ smbScan: "scanning" });
    try {
      const devices = await backend.discoverSmbDevices();
      set({ smbDevices: devices, smbScan: "done" });
    } catch (e) {
      set({ smbScan: "error" });
      get().showError(tr("toast.smb_scan_failed"), e);
    }
  },
  async loadSmbShares(device, username, password, remember) {
    const { backend } = get();
    if (!backend) return false;
    const key = smbDeviceKey(device);
    set({ smbShares: { ...get().smbShares, [key]: { status: "loading", shares: [], error: null, username, password, remember } } });
    try {
      const shares = await backend.listSmbShares(device.host, device.port, username, password);
      set({ smbShares: { ...get().smbShares, [key]: { status: "loaded", shares, error: null, username, password, remember } } });
      return true;
    } catch (e) {
      set({ smbShares: { ...get().smbShares, [key]: { status: "error", shares: [], error: classifyError(e), username, password, remember } } });
      return false;
    }
  },
  forgetSmbShares(device) {
    const next = { ...get().smbShares };
    delete next[smbDeviceKey(device)];
    set({ smbShares: next });
  },
  async connectDiscoveredShare(device, shareName) {
    const listing = get().smbShares[smbDeviceKey(device)];
    if (!listing || listing.status !== "loaded") return;
    const savePassword = listing.remember;
    // Mirrors smb_list_shares on the Rust side: an empty username browsed as guest, so
    // the saved connection authenticates the same way.
    const username = listing.username.trim() || "Guest";
    const existing = get().remoteConnections.find(
      (c) =>
        c.protocol === "smb" &&
        c.host === device.host &&
        c.port === device.port &&
        c.share === shareName &&
        c.username === username
    );
    const id = existing
      ? existing.id
      : get().addRemoteConnection({
          protocol: "smb",
          label: `${device.name} · ${shareName}`,
          host: device.host,
          port: device.port,
          username,
          share: shareName,
          savePassword,
        });
    if (existing && savePassword && !existing.savePassword) get().updateRemoteConnection(id, { savePassword: true });
    await get().connectRemoteConnection(id, listing.password);
  },
});
