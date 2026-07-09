// The in-memory filesystem engine behind the mock backend: one flat TREE mapping a
// directory path to its child nodes, plus the manipulation helpers the backend methods
// use. Local demo content is seeded here; the SFTP/SMB demo fixtures live in
// mockRemote.ts and seed their own TREE entries.
import { codedError } from "../lib/errors";
import { basenamePosix, dirnamePosix, joinPosix } from "./pathUtil";
import { isRemotePath, remoteBasename, remoteDirname, remoteJoin } from "./remotePath";
import type { FsEntry } from "./types";

export interface MockNode {
  name: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
  createdMs: number;
  isSymlink?: boolean;
  symlinkTarget?: string;
  /** Real text contents for files created in-session, so previewTextFile round-trips
   *  (e.g. exporting a .gyset and importing it back) instead of showing the placeholder. */
  contents?: string;
}

export function day(y: number, m: number, d: number, h = 12, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime();
}

// Generic path helpers used by the tree-manipulation functions below, so the same mock
// TREE can hold both local paths and sftp://.../smb://... demo entries — mirrors how
// tauriBackend.ts branches between the plain POSIX helpers and the remote-aware ones.
export function dirOf(path: string): string {
  return isRemotePath(path) ? remoteDirname(path) : dirnamePosix(path);
}
export function baseOf(path: string): string {
  return isRemotePath(path) ? remoteBasename(path) : basenamePosix(path);
}
export function joinOf(base: string, ...names: string[]): string {
  return isRemotePath(base) ? remoteJoin(base, ...names) : joinPosix(base, ...names);
}

export function file(name: string, size: number, modified: number, created?: number): MockNode {
  return { name, isDir: false, size, modifiedMs: modified, createdMs: created ?? modified };
}

export function folder(name: string, modified: number): MockNode {
  return { name, isDir: true, size: 0, modifiedMs: modified, createdMs: modified };
}

export const HOME = "/home/chris";
export const TRASH_DIR = "/trash";

export const TREE: Record<string, MockNode[]> = {
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

export function ensureDir(path: string) {
  if (!TREE[path]) TREE[path] = [];
}

export function toEntry(dir: string, node: MockNode): FsEntry {
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

export function findNode(path: string): { dir: string; node: MockNode } | null {
  const dir = dirOf(path);
  const name = baseOf(path);
  const list = TREE[dir];
  if (!list) return null;
  const node = list.find((n) => n.name === name);
  return node ? { dir, node } : null;
}

export function removeFromTree(path: string): MockNode {
  const dir = dirOf(path);
  const name = baseOf(path);
  const list = TREE[dir] || [];
  const idx = list.findIndex((n) => n.name === name);
  if (idx < 0) throw codedError("gone", `not found: ${path}`);
  const [node] = list.splice(idx, 1);
  return node;
}

export function insertNode(dir: string, node: MockNode) {
  ensureDir(dir);
  TREE[dir].push(node);
}

export function cloneSubtree(oldPath: string, newPath: string) {
  const sub = TREE[oldPath];
  if (!sub) return;
  TREE[newPath] = sub.map((n) => ({ ...n }));
  for (const child of sub) {
    if (child.isDir) cloneSubtree(joinOf(oldPath, child.name), joinOf(newPath, child.name));
  }
}

export async function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 30));
}
