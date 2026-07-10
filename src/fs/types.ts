export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
  createdMs: number;
  isHidden: boolean;
}

export interface DeviceEntry {
  label: string;
  path: string;
}

export interface DiskUsage {
  total: number;
  available: number;
}

export interface MediaPlaybackSupport {
  available: boolean;
  title: string;
  message: string;
  details: string | null;
  installCommand: string | null;
}

export interface ArchiveEntry {
  path: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
}

export interface ArchivePreview {
  format: string;
  entries: ArchiveEntry[];
  totalEntries: number;
  truncated: boolean;
}

export interface TextPreview {
  content: string;
  truncated: boolean;
}

export interface PathPermissions {
  /** Unix permission bits, e.g. 0o755. */
  mode: number;
  uid: number;
  gid: number;
  owner: string;
  group: string;
  isSymlink: boolean;
  symlinkTarget: string | null;
}

/** An SMB host discovered on the local network via mDNS/DNS-SD (`_smb._tcp`). */
export interface SmbDevice {
  /** Advertised instance name, e.g. "Office NAS". */
  name: string;
  /** Advertised hostname, e.g. "office-nas.local". */
  hostname: string;
  /** Best address to connect to (IPv4 when advertised, otherwise the hostname). */
  host: string;
  port: number;
}

/** A browseable disk share enumerated on an SMB host. */
export interface SmbShare {
  name: string;
  comment: string;
}

export interface RemoteConnectInput {
  protocol: "sftp" | "smb";
  host: string;
  port: number;
  username: string;
  /** SMB only. */
  share?: string;
  password: string;
}

export interface RemoteDisconnectInput {
  protocol: "sftp" | "smb";
  host: string;
  port: number;
  username: string;
  /** SMB only. */
  share?: string;
}

export interface FsBackend {
  kind: "tauri" | "mock";
  sep: string;
  homeDir(): Promise<string>;
  listDir(path: string): Promise<FsEntry[]>;
  stat(path: string): Promise<FsEntry>;
  /** URL the webview can load for images/audio/video, or null if unavailable. */
  fileUrl(path: string): Promise<string | null>;
  /** Checks native audio/video prerequisites before WebKit creates a media element. */
  mediaPlaybackSupport(): Promise<MediaPlaybackSupport>;
  previewArchive(path: string): Promise<ArchivePreview>;
  extractArchive(path: string, destDir: string, folderName: string): Promise<string>;
  createArchive(paths: string[], destDir: string, archiveName: string): Promise<string>;
  previewTextFile(path: string): Promise<TextPreview | null>;
  createFolder(parent: string, name: string): Promise<string>;
  createFile(parent: string, name: string, contents: string): Promise<string>;
  renamePath(from: string, toName: string): Promise<string>;
  movePath(from: string, toDir: string): Promise<string>;
  copyPath(from: string, toDir: string, toName: string): Promise<string>;
  trashPath(path: string): Promise<string>;
  restorePath(trashedPath: string, toDir: string): Promise<string>;
  deletePermanently(path: string): Promise<void>;
  trashDirPath(): Promise<string>;
  diskUsage(path: string): Promise<DiskUsage>;
  listDevices(): Promise<DeviceEntry[]>;
  getPathPermissions(path: string): Promise<PathPermissions>;
  setPathMode(path: string, mode: number): Promise<void>;
  createSymlink(target: string, linkDir: string, linkName: string): Promise<string>;
  join(...parts: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;

  /** Scans the local network for hosts advertising SMB file sharing over mDNS. */
  discoverSmbDevices(): Promise<SmbDevice[]>;
  /** Lists browseable disk shares on an SMB host. An empty username browses as guest. */
  listSmbShares(host: string, port: number, username: string, password: string): Promise<SmbShare[]>;
  /** Returns the connection's root path (e.g. "sftp://user@host:22/" or "smb://user@host:445/Share"). */
  connectRemote(input: RemoteConnectInput): Promise<string>;
  disconnectRemote(input: RemoteDisconnectInput): Promise<void>;
  keyringSavePassword(connectionId: string, password: string): Promise<void>;
  keyringLoadPassword(connectionId: string): Promise<string | null>;
  keyringDeletePassword(connectionId: string): Promise<void>;
  /** Drops the pinned SFTP server key for host:port so the next connect re-pins it
   *  (trust-on-first-use — the explicit "trust the new key" action after a mismatch). */
  sftpForgetHostKey(host: string, port: number): Promise<void>;
}
