// Demo network places, purely for dev-mode (browser) testing of the Network module —
// the real protocol work only exists in src-tauri/src/remote.rs, so this is just enough
// simulated state to click through connect/browse/copy/disconnect without a real server.
// Everything here (connections, discovery, share listings, the remote TREE entries it
// seeds) is the SFTP/SMB fixture layer on top of the engine in mockTree.ts.
import { codedError } from "../lib/errors";
import { day, file, folder, joinOf, TREE } from "./mockTree";
import { isRemotePath, parseRemotePath } from "./remotePath";
import type { RemoteConnectInput, RemoteDisconnectInput, SmbDevice, SmbShare } from "./types";

const MOCK_SFTP_ROOT = "sftp://demo@filepile.local:22/";
const MOCK_SMB_ROOT = "smb://demo@office-nas:445/Shared";
const MOCK_REMOTE_PASSWORD = "demo";
const connectedKeys = new Set<string>();

function connectionKeyForPath(path: string): string | null {
  const parsed = parseRemotePath(path);
  if (!parsed) return null;
  return `${parsed.protocol}://${parsed.authority}${parsed.share ? `/${parsed.share}` : ""}`;
}

function connectionKeyForInput(input: { protocol: string; host: string; port: number; username: string; share?: string }): string {
  return `${input.protocol}://${input.username}@${input.host}:${input.port}${input.share ? `/${input.share}` : ""}`;
}

TREE[MOCK_SFTP_ROOT] = [
  folder("backups", day(2026, 6, 20)),
  file("readme.txt", 512, day(2026, 6, 18)),
];
TREE[joinOf(MOCK_SFTP_ROOT, "backups")] = [file("weekly.tar.gz", 884736, day(2026, 6, 20))];
TREE[MOCK_SMB_ROOT] = [
  folder("Invoices", day(2026, 6, 27)),
  file("team-notes.md", 2048, day(2026, 6, 29)),
];
TREE[joinOf(MOCK_SMB_ROOT, "Invoices")] = [file("2026-q2.pdf", 154624, day(2026, 6, 27))];

// Demo SMB discovery: the devices a "network scan" finds in the browser, and the shares
// each one enumerates. office-nas matches MOCK_SMB_ROOT so connecting its "Shared" share
// (username/password "demo") lands in the populated tree above.
const MOCK_SMB_DEVICES: SmbDevice[] = [
  { name: "Office NAS", hostname: "office-nas.local", host: "office-nas", port: 445 },
  { name: "Studio Pi", hostname: "studio-pi.local", host: "studio-pi.local", port: 445 },
];
const MOCK_SMB_SHARES: Record<string, SmbShare[]> = {
  "office-nas": [
    { name: "Media", comment: "Movies and music" },
    { name: "Shared", comment: "Team documents" },
  ],
  "studio-pi.local": [{ name: "Public", comment: "" }],
};
TREE["smb://demo@office-nas:445/Media"] = [file("intro-cut.mp4", 52428800, day(2026, 6, 24))];
TREE["smb://demo@studio-pi.local:445/Public"] = [file("print-queue.txt", 1024, day(2026, 6, 30))];

/** Guard every mock op that touches a remote path: like the real backend, browsing a
 *  disconnected place fails with a "reconnect from the Network panel" error. */
export function requireConnected(path: string) {
  if (!isRemotePath(path)) return;
  const key = connectionKeyForPath(path);
  if (!key || !connectedKeys.has(key)) {
    throw codedError("remote_not_connected", "Not connected — reconnect from the Network panel");
  }
}

export async function mockDiscoverSmbDevices(): Promise<SmbDevice[]> {
  // A real scan listens for a couple of seconds; simulate that.
  await new Promise((resolve) => setTimeout(resolve, 900));
  return MOCK_SMB_DEVICES.map((d) => ({ ...d }));
}

export async function mockListSmbShares(host: string, _port: number, _username: string, password: string): Promise<SmbShare[]> {
  if (password !== MOCK_REMOTE_PASSWORD) {
    throw codedError("auth_failed", "Authentication failed: incorrect username or password");
  }
  const shares = MOCK_SMB_SHARES[host];
  if (!shares) throw codedError("connect_failed", `Could not connect to ${host}`);
  return shares.map((s) => ({ ...s }));
}

export async function mockConnectRemote(input: RemoteConnectInput): Promise<string> {
  if (input.password !== MOCK_REMOTE_PASSWORD) {
    throw codedError("auth_failed", "Authentication failed: incorrect username or password");
  }
  connectedKeys.add(connectionKeyForInput(input));
  if (input.protocol === "sftp") return `sftp://${input.username}@${input.host}:${input.port}/`;
  return `smb://${input.username}@${input.host}:${input.port}/${input.share ?? ""}`;
}

export async function mockDisconnectRemote(input: RemoteDisconnectInput): Promise<void> {
  connectedKeys.delete(connectionKeyForInput(input));
}
