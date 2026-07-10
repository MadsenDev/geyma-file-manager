// The mock FsBackend used whenever the app runs outside the Tauri webview (plain
// browser dev). The in-memory tree engine + local demo content live in mockTree.ts,
// the SFTP/SMB demo fixtures in mockRemote.ts; this file wires them into FsBackend.
import { codedError } from "../lib/errors";
import {
  cloneSubtree,
  delay,
  dirOf,
  baseOf,
  ensureDir,
  file,
  findNode,
  folder,
  HOME,
  insertNode,
  joinOf,
  removeFromTree,
  toEntry,
  TRASH_DIR,
  TREE,
  type MockNode,
} from "./mockTree";
import {
  mockConnectRemote,
  mockDisconnectRemote,
  mockDiscoverSmbDevices,
  mockListSmbShares,
  requireConnected,
} from "./mockRemote";
import { dirnamePosix, joinPosix } from "./pathUtil";
import { isRemotePath, remoteJoin } from "./remotePath";
import type { DeviceEntry, FsBackend, PathPermissions, RemoteConnectInput, RemoteDisconnectInput } from "./types";

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

let trashCounter = 0;
const trashNodes: Map<string, { origin: string; node: MockNode }> = new Map();
const modeOverrides: Map<string, number> = new Map();

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
    if (!found) throw codedError("gone", `not found: ${path}`);
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
    if (isRemotePath(path)) throw codedError("archive_preview_remote");
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
    if (isRemotePath(path) || isRemotePath(destDir)) throw codedError("extract_remote");
    ensureDir(destDir);
    if ((TREE[destDir] || []).some((n) => n.name === folderName)) {
      throw codedError("already_exists", "A file or folder with that name already exists");
    }
    insertNode(destDir, folder(folderName, Date.now()));
    const target = joinPosix(destDir, folderName);
    insertNode(target, folder("Documents", Date.now()));
    insertNode(joinPosix(target, "Documents"), file("readme.txt", 1840, Date.now()));
    insertNode(target, file("preview.png", 245760, Date.now()));
    return delay(target);
  },
  async createArchive(paths: string[], destDir: string, archiveName: string) {
    if (isRemotePath(destDir) || paths.some(isRemotePath)) throw codedError("compress_remote");
    ensureDir(destDir);
    const name = archiveName.toLowerCase().endsWith(".zip") ? archiveName : `${archiveName}.zip`;
    if ((TREE[destDir] || []).some((n) => n.name === name)) {
      throw codedError("already_exists", "A file or folder with that name already exists");
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
    if (found?.node.contents != null) {
      return { content: found.node.contents, truncated: false };
    }
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
    const node = file(name, contents.length, Date.now());
    node.contents = contents;
    insertNode(parent, node);
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
    if (!found) throw codedError("gone", `not found: ${from}`);
    const clone: MockNode = { ...found.node, name: toName, modifiedMs: Date.now() };
    insertNode(toDir, clone);
    if (clone.isDir) cloneSubtree(joinOf(found.dir, found.node.name), joinOf(toDir, toName));
    return delay(joinOf(toDir, toName));
  },
  async trashPath(path: string) {
    if (isRemotePath(path)) throw codedError("no_remote_trash");
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
    if (isRemotePath(path)) throw codedError("disk_usage_remote");
    const total = 512 * 1024 * 1024 * 1024;
    return delay({ total, available: Math.round(total * 0.42) });
  },
  async listDevices() {
    const devices: DeviceEntry[] = [{ label: "FIELD", path: "/run/media/chris/FIELD" }];
    return delay(devices);
  },
  async getPathPermissions(path: string) {
    if (isRemotePath(path)) throw codedError("permissions_remote");
    const found = findNode(path);
    if (!found) throw codedError("gone", `not found: ${path}`);
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
    if (isRemotePath(path)) throw codedError("permissions_remote");
    modeOverrides.set(path, mode & 0o777);
    return delay(undefined);
  },
  async createSymlink(target: string, linkDir: string, linkName: string) {
    if (isRemotePath(target) || isRemotePath(linkDir)) throw codedError("symlinks_remote");
    ensureDir(linkDir);
    if ((TREE[linkDir] || []).some((n) => n.name === linkName)) {
      throw codedError("already_exists", "A file or folder with that name already exists");
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
  async discoverSmbDevices() {
    return delay(await mockDiscoverSmbDevices());
  },
  async listSmbShares(host: string, port: number, username: string, password: string) {
    await delay(undefined);
    return mockListSmbShares(host, port, username, password);
  },
  async connectRemote(input: RemoteConnectInput) {
    await delay(undefined);
    return mockConnectRemote(input);
  },
  async disconnectRemote(input: RemoteDisconnectInput) {
    await delay(undefined);
    return mockDisconnectRemote(input);
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
  // The mock's simulated servers never change identity, so there's no key to forget.
  async sftpForgetHostKey() {
    await delay(undefined);
  },
};

ensureDir(TRASH_DIR);
