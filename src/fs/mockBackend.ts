import type { DeviceEntry, FsBackend, FsEntry, PathPermissions, RemoteConnectInput, RemoteDisconnectInput } from "./types";
import { basenamePosix, dirnamePosix, joinPosix } from "./pathUtil";
import { isRemotePath, parseRemotePath, remoteBasename, remoteDirname, remoteJoin } from "./remotePath";

interface MockNode {
  name: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
  createdMs: number;
  isSymlink?: boolean;
  symlinkTarget?: string;
}

function day(y: number, m: number, d: number, h = 12, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime();
}

/** Mirrors src-tauri/src/archives.rs's extension detection, kept local since the mock
 * backend has no dependency on the Rust side or on lib/format.ts's frontend helpers. */
function archiveFormatLabel(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "TAR.GZ";
  if (lower.endsWith(".tar.bz2") || lower.endsWith(".tbz2") || lower.endsWith(".tbz")) return "TAR.BZ2";
  if (lower.endsWith(".tar.xz") || lower.endsWith(".txz")) return "TAR.XZ";
  if (lower.endsWith(".tar")) return "TAR";
  if (lower.endsWith(".7z")) return "7Z";
  return "ZIP";
}

// Generic path helpers used by the tree-manipulation functions below, so the same mock
// TREE can hold both local paths and sftp://.../smb://... demo entries — mirrors how
// tauriBackend.ts branches between the plain POSIX helpers and the remote-aware ones.
function dirOf(path: string): string {
  return isRemotePath(path) ? remoteDirname(path) : dirnamePosix(path);
}
function baseOf(path: string): string {
  return isRemotePath(path) ? remoteBasename(path) : basenamePosix(path);
}
function joinOf(base: string, ...names: string[]): string {
  return isRemotePath(base) ? remoteJoin(base, ...names) : joinPosix(base, ...names);
}

function file(name: string, size: number, modified: number, created?: number): MockNode {
  return { name, isDir: false, size, modifiedMs: modified, createdMs: created ?? modified };
}

function folder(name: string, modified: number): MockNode {
  return { name, isDir: true, size: 0, modifiedMs: modified, createdMs: modified };
}

const HOME = "/home/chris";

const TREE: Record<string, MockNode[]> = {
  [HOME]: [
    folder("Desktop", day(2026, 6, 15)),
    folder("Documents", day(2026, 7, 2, 11, 8)),
    folder("Downloads", day(2026, 7, 1)),
    folder("Pictures", day(2026, 6, 30)),
    folder("Videos", day(2026, 6, 20)),
    folder("Music", day(2026, 6, 10)),
    folder("Projects", day(2026, 7, 2, 10, 15)),
    file("notes.txt", 4096, day(2026, 7, 2, 9, 12), day(2026, 1, 4)),
    file("todo.md", 2048, day(2026, 7, 1), day(2026, 3, 2)),
  ],
  [joinPosix(HOME, "Documents")]: [
    folder("Geyma", day(2026, 7, 2, 11, 8)),
    folder("Invoices", day(2026, 6, 25)),
    file("contract-2026.pdf", 524288, day(2026, 6, 29), day(2026, 6, 12)),
    file("tax-return-2025.pdf", 1258291, day(2026, 4, 10)),
    file("reading-list.md", 6144, day(2026, 6, 27), day(2026, 2, 1)),
  ],
  [joinPosix(HOME, "Documents/Geyma")]: [
    folder("mockups", day(2026, 7, 2, 11, 2)),
    file("roadmap.pdf", 2516582, day(2026, 7, 2, 11, 8), day(2026, 5, 9)),
    file("brand-notes.md", 12288, day(2026, 7, 1), day(2026, 4, 20)),
    file("ledger-spec.pdf", 901120, day(2026, 6, 30), day(2026, 6, 18)),
    file("palette.png", 327680, day(2026, 6, 28)),
    file("changelog.md", 9216, day(2026, 7, 2, 10, 55), day(2026, 5, 9)),
  ],
  [joinPosix(HOME, "Documents/Geyma/mockups")]: [
    file("browse-v3.png", 4299161, day(2026, 7, 1), day(2026, 6, 24)),
    file("preview-panel.png", 2936012, day(2026, 6, 30), day(2026, 6, 25)),
    file("sidebar-explore.fig", 6501171, day(2026, 6, 29), day(2026, 6, 22)),
    file("icon-sheet.svg", 43008, day(2026, 6, 28), day(2026, 6, 20)),
  ],
  [joinPosix(HOME, "Documents/Invoices")]: [
    file("invoice-0421.pdf", 215040, day(2026, 4, 21)),
    file("invoice-0509.pdf", 237568, day(2026, 5, 9)),
  ],
  [joinPosix(HOME, "Downloads")]: [
    folder("photo-batch", day(2026, 6, 22)),
    file("geyma-0.4.0.tar.gz", 1427005, day(2026, 6, 26)),
    file("project-assets.zip", 8421376, day(2026, 6, 25)),
    file("backup-snapshot.7z", 3145728, day(2026, 6, 24, 9)),
    file("Ferdium.AppImage", 96468992, day(2026, 6, 24)),
    file("invoice-scan.pdf", 3774873, day(2026, 6, 23, 18)),
    file("kernel-6.9.patch", 90112, day(2026, 6, 20)),
  ],
  [joinPosix(HOME, "Downloads/photo-batch")]: [
    file("IMG_0431.jpg", 4404019, day(2026, 6, 22)),
    file("IMG_0432.jpg", 4089446, day(2026, 6, 22)),
    file("IMG_0433.jpg", 4718592, day(2026, 6, 22)),
  ],
  [joinPosix(HOME, "Pictures")]: [
    folder("Screenshots", day(2026, 7, 2, 9, 40)),
    file("ridge-wallpaper.jpg", 8178892, day(2026, 6, 18)),
    file("desktop-preview.png", 5347737, day(2026, 6, 29)),
    file("avatar.png", 184320, day(2026, 4, 15)),
  ],
  [joinPosix(HOME, "Pictures/Screenshots")]: [
    file("Screenshot_2026-06-30.png", 1153433, day(2026, 6, 30)),
    file("Screenshot_2026-07-01.png", 1003520, day(2026, 7, 1)),
    file("Screenshot_2026-07-02.png", 1258291, day(2026, 7, 2, 9, 40)),
  ],
  [joinPosix(HOME, "Videos")]: [
    file("capture-rename-flow.mp4", 192937984, day(2026, 6, 28)),
    file("screen-record.webm", 44040192, day(2026, 6, 21)),
  ],
  [joinPosix(HOME, "Music")]: [
    folder("album", day(2026, 6, 5)),
    file("meeting-snippet.flac", 44040192, day(2026, 4, 20)),
    file("focus-loop.mp3", 8808038, day(2026, 6, 1)),
  ],
  [joinPosix(HOME, "Music/album")]: [
    file("track-01.flac", 39845888, day(2026, 6, 5, 12, 12)),
    file("track-02.flac", 42991616, day(2026, 6, 5, 12, 6)),
  ],
  [joinPosix(HOME, "Projects")]: [
    folder("geyma-file-manager", day(2026, 7, 2, 10, 15)),
    folder("dotfiles", day(2026, 6, 10)),
    file("scratch.ts", 6144, day(2026, 6, 29)),
  ],
  [joinPosix(HOME, "Projects/geyma-file-manager")]: [
    folder("src", day(2026, 7, 2, 10, 15)),
    file("README.md", 3072, day(2026, 6, 28)),
    file("package.json", 1024, day(2026, 6, 28)),
    file("index.html", 2048, day(2026, 6, 28)),
  ],
  [joinPosix(HOME, "Projects/geyma-file-manager/src")]: [],
  [joinPosix(HOME, "Desktop")]: [
    folder("Sandbox", day(2026, 6, 15)),
    file("welcome.txt", 1024, day(2026, 1, 1)),
  ],
  [joinPosix(HOME, "Projects/dotfiles")]: [],
  [joinPosix(HOME, "Desktop/Sandbox")]: [],
  [joinPosix(HOME, ".config")]: [],
  "/run/media/chris/FIELD": [
    file("field-notes.md", 18432, day(2026, 6, 26)),
    file("capture-001.raw", 25165824, day(2026, 6, 26, 12, 12)),
    file("capture-002.raw", 25165824, day(2026, 6, 26, 12, 6)),
  ],
};

let trashCounter = 0;
const trashNodes: Map<string, { origin: string; node: MockNode }> = new Map();
const TRASH_DIR = "/trash";
const modeOverrides: Map<string, number> = new Map();

// Demo network places, purely for dev-mode (browser) testing of the Network module —
// the real protocol work only exists in src-tauri/src/remote.rs, so this is just enough
// simulated state to click through connect/browse/copy/disconnect without a real server.
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

function ensureDir(path: string) {
  if (!TREE[path]) TREE[path] = [];
}

function toEntry(dir: string, node: MockNode): FsEntry {
  return {
    name: node.name,
    path: joinOf(dir, node.name),
    isDir: node.isDir,
    size: node.size,
    modifiedMs: node.modifiedMs,
    createdMs: node.createdMs,
    isHidden: node.name.startsWith("."),
  };
}

function findNode(path: string): { dir: string; node: MockNode } | null {
  const dir = dirOf(path);
  const name = baseOf(path);
  const list = TREE[dir];
  if (!list) return null;
  const node = list.find((n) => n.name === name);
  return node ? { dir, node } : null;
}

function removeFromTree(path: string): MockNode {
  const dir = dirOf(path);
  const name = baseOf(path);
  const list = TREE[dir] || [];
  const idx = list.findIndex((n) => n.name === name);
  if (idx < 0) throw new Error(`not found: ${path}`);
  const [node] = list.splice(idx, 1);
  return node;
}

function insertNode(dir: string, node: MockNode) {
  ensureDir(dir);
  TREE[dir].push(node);
}

function cloneSubtree(oldPath: string, newPath: string) {
  const sub = TREE[oldPath];
  if (!sub) return;
  TREE[newPath] = sub.map((n) => ({ ...n }));
  for (const child of sub) {
    if (child.isDir) cloneSubtree(joinOf(oldPath, child.name), joinOf(newPath, child.name));
  }
}

function requireConnected(path: string) {
  if (!isRemotePath(path)) return;
  const key = connectionKeyForPath(path);
  if (!key || !connectedKeys.has(key)) {
    throw new Error("Not connected — reconnect from the Network panel");
  }
}

async function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 30));
}

export const mockBackend: FsBackend = {
  kind: "mock",
  sep: "/",
  async homeDir() {
    return delay(HOME);
  },
  async listDir(path: string) {
    requireConnected(path);
    const list = TREE[path] || [];
    return delay(list.map((n) => toEntry(path, n)));
  },
  async stat(path: string) {
    requireConnected(path);
    const found = findNode(path);
    if (!found) throw new Error(`not found: ${path}`);
    return delay(toEntry(found.dir, found.node));
  },
  async fileUrl() {
    return null;
  },
  async mediaPlaybackSupport() {
    return {
      available: false,
      title: "Desktop playback required",
      message: "Audio and video previews are only available in the Geyma desktop app.",
      details: null,
      installCommand: null,
    };
  },
  async previewArchive(path: string) {
    if (isRemotePath(path)) throw new Error("Archive previews aren't available for network locations yet");
    const format = archiveFormatLabel(path);
    const compressed = format === "ZIP";
    return {
      format,
      entries: [
        { path: "Documents/", isDir: true, size: 0, compressedSize: 0 },
        { path: "Documents/readme.txt", isDir: false, size: 1840, compressedSize: compressed ? 792 : 1840 },
        { path: "preview.png", isDir: false, size: 245760, compressedSize: compressed ? 231420 : 245760 },
      ],
      totalEntries: 3,
      truncated: false,
    };
  },
  async extractArchive(path: string, destDir: string, folderName: string) {
    if (isRemotePath(path) || isRemotePath(destDir)) throw new Error("Extracting archives isn't available for network locations yet");
    ensureDir(destDir);
    if ((TREE[destDir] || []).some((n) => n.name === folderName)) {
      throw new Error("A file or folder with that name already exists");
    }
    insertNode(destDir, folder(folderName, Date.now()));
    const target = joinPosix(destDir, folderName);
    insertNode(target, folder("Documents", Date.now()));
    insertNode(joinPosix(target, "Documents"), file("readme.txt", 1840, Date.now()));
    insertNode(target, file("preview.png", 245760, Date.now()));
    return delay(target);
  },
  async createArchive(paths: string[], destDir: string, archiveName: string) {
    if (isRemotePath(destDir) || paths.some(isRemotePath)) throw new Error("Compressing to an archive isn't available for network locations yet");
    ensureDir(destDir);
    const name = archiveName.toLowerCase().endsWith(".zip") ? archiveName : `${archiveName}.zip`;
    if ((TREE[destDir] || []).some((n) => n.name === name)) {
      throw new Error("A file or folder with that name already exists");
    }
    const totalSize = paths.reduce((sum, p) => {
      const found = findNode(p);
      return sum + (found ? found.node.size || 4096 : 0);
    }, 0);
    insertNode(destDir, file(name, Math.max(totalSize, 1024), Date.now()));
    return delay(joinPosix(destDir, name));
  },
  async previewTextFile(path: string) {
    requireConnected(path);
    const found = findNode(path);
    const name = found?.node.name ?? baseOf(path);
    return {
      content: `# ${name}\n\nThis is placeholder content shown by Geyma's mock filesystem.\n`,
      truncated: false,
    };
  },
  async createFolder(parent: string, name: string) {
    requireConnected(parent);
    insertNode(parent, folder(name, Date.now()));
    ensureDir(joinOf(parent, name));
    return delay(joinOf(parent, name));
  },
  async createFile(parent: string, name: string, contents: string) {
    requireConnected(parent);
    insertNode(parent, file(name, contents.length, Date.now()));
    return delay(joinOf(parent, name));
  },
  async renamePath(from: string, toName: string) {
    requireConnected(from);
    const node = removeFromTree(from);
    node.name = toName;
    node.modifiedMs = Date.now();
    const dir = dirOf(from);
    insertNode(dir, node);
    if (node.isDir) {
      const oldChildPath = joinOf(dir, baseOf(from));
      const newChildPath = joinOf(dir, toName);
      if (TREE[oldChildPath]) {
        TREE[newChildPath] = TREE[oldChildPath];
        delete TREE[oldChildPath];
      }
    }
    return delay(joinOf(dir, toName));
  },
  async movePath(from: string, toDir: string) {
    requireConnected(from);
    requireConnected(toDir);
    const node = removeFromTree(from);
    const oldChildPath = joinOf(dirOf(from), node.name);
    insertNode(toDir, node);
    if (node.isDir && TREE[oldChildPath]) {
      TREE[joinOf(toDir, node.name)] = TREE[oldChildPath];
      delete TREE[oldChildPath];
    }
    return delay(joinOf(toDir, node.name));
  },
  async copyPath(from: string, toDir: string, toName: string) {
    requireConnected(from);
    requireConnected(toDir);
    const found = findNode(from);
    if (!found) throw new Error(`not found: ${from}`);
    const clone: MockNode = { ...found.node, name: toName, modifiedMs: Date.now() };
    insertNode(toDir, clone);
    if (clone.isDir) cloneSubtree(joinOf(found.dir, found.node.name), joinOf(toDir, toName));
    return delay(joinOf(toDir, toName));
  },
  async trashPath(path: string) {
    if (isRemotePath(path)) throw new Error("Network locations have no Trash — delete permanently instead");
    const node = removeFromTree(path);
    const id = `${node.name}.${trashCounter++}`;
    trashNodes.set(id, { origin: dirnamePosix(path), node });
    insertNode(TRASH_DIR, { ...node });
    return delay(joinPosix(TRASH_DIR, node.name));
  },
  async restorePath(trashedPath: string, toDir: string) {
    const node = removeFromTree(trashedPath);
    insertNode(toDir, node);
    return delay(joinPosix(toDir, node.name));
  },
  async deletePermanently(path: string) {
    requireConnected(path);
    removeFromTree(path);
    return delay(undefined);
  },
  async trashDirPath() {
    return delay(TRASH_DIR);
  },
  async diskUsage(path: string) {
    if (isRemotePath(path)) throw new Error("Disk usage isn't available for network locations");
    const total = 512 * 1024 * 1024 * 1024;
    return delay({ total, available: Math.round(total * 0.42) });
  },
  async listDevices() {
    const devices: DeviceEntry[] = [{ label: "FIELD", path: "/run/media/chris/FIELD" }];
    return delay(devices);
  },
  async getPathPermissions(path: string) {
    if (isRemotePath(path)) throw new Error("Permissions aren't available for network locations");
    const found = findNode(path);
    if (!found) throw new Error(`not found: ${path}`);
    const mode = modeOverrides.get(path) ?? (found.node.isDir ? 0o755 : 0o644);
    return delay({
      mode,
      uid: 1000,
      gid: 1000,
      owner: "chris",
      group: "chris",
      isSymlink: !!found.node.isSymlink,
      symlinkTarget: found.node.symlinkTarget ?? null,
    } satisfies PathPermissions);
  },
  async setPathMode(path: string, mode: number) {
    if (isRemotePath(path)) throw new Error("Permissions aren't available for network locations");
    modeOverrides.set(path, mode & 0o777);
    return delay(undefined);
  },
  async createSymlink(target: string, linkDir: string, linkName: string) {
    if (isRemotePath(target) || isRemotePath(linkDir)) throw new Error("Symlinks aren't available for network locations");
    ensureDir(linkDir);
    if ((TREE[linkDir] || []).some((n) => n.name === linkName)) {
      throw new Error("A file or folder with that name already exists");
    }
    insertNode(linkDir, {
      name: linkName,
      isDir: false,
      size: 0,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      isSymlink: true,
      symlinkTarget: target,
    });
    return delay(joinPosix(linkDir, linkName));
  },
  join(...parts: string[]) {
    if (parts.length > 0 && isRemotePath(parts[0])) return remoteJoin(parts[0], ...parts.slice(1));
    return joinPosix(...parts);
  },
  dirname(path: string) {
    return dirOf(path);
  },
  basename(path: string) {
    return baseOf(path);
  },
  async connectRemote(input: RemoteConnectInput) {
    await delay(undefined);
    if (input.password !== MOCK_REMOTE_PASSWORD) {
      throw new Error("Authentication failed: incorrect username or password");
    }
    connectedKeys.add(connectionKeyForInput(input));
    if (input.protocol === "sftp") return `sftp://${input.username}@${input.host}:${input.port}/`;
    return `smb://${input.username}@${input.host}:${input.port}/${input.share ?? ""}`;
  },
  async disconnectRemote(input: RemoteDisconnectInput) {
    await delay(undefined);
    connectedKeys.delete(connectionKeyForInput(input));
  },
  async keyringSavePassword() {
    await delay(undefined);
  },
  async keyringLoadPassword() {
    return delay(null);
  },
  async keyringDeletePassword() {
    await delay(undefined);
  },
};

ensureDir(TRASH_DIR);
