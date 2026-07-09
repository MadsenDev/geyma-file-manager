// Cross-slice internals shared by the store's slices — not part of the store's
// public surface (components import from ./store, not from here).
import type { FsBackend, FsEntry } from "../fs/types";
import { kindOf } from "../lib/format";
import type { AppState } from "./store";
import type { FileEvent, Ghost, SortKey } from "./types";

export type GetState = () => AppState;
export type SetState = (partial: Partial<AppState>) => void;

export function nowEvent(
  path: string,
  action: string,
  detail: string | undefined,
  kind: FileEvent["kind"],
  prevPath?: string,
): FileEvent {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, path, action, detail, whenMs: Date.now(), kind, prevPath };
}

// Tabs mirror the live nav fields (path/hist/hi/trashView/activeSetId) for the active
// tab only — call this after any action that mutates those fields directly, so the tab
// bar and tab-switching always see up-to-date state for the tab currently in view.
export function syncActiveTab(get: GetState, set: SetState) {
  const st = get();
  set({
    tabs: st.tabs.map((tab) =>
      tab.id === st.activeTabId
        ? { ...tab, path: st.path, hist: st.hist, hi: st.hi, trashView: st.trashView, activeSetId: st.activeSetId }
        : tab,
    ),
  });
}

export function logEvent(
  get: GetState,
  set: SetState,
  path: string,
  action: string,
  detail: string | undefined,
  kind: FileEvent["kind"],
  prevPath?: string,
) {
  const ev = nowEvent(path, action, detail, kind, prevPath);
  const fileEvents = { ...get().fileEvents };
  fileEvents[path] = [ev, ...(fileEvents[path] || [])].slice(0, 200);
  const globalFeed = [ev, ...get().globalFeed].slice(0, 60);
  set({ fileEvents, globalFeed });
  get().persist();
}

/** The one sort order for file listings — visibleEntries() and the ghost tiles that
 *  interleave with it in Files must agree, so both go through this comparator. */
export function compareEntries(a: FsEntry, b: FsEntry, sortKey: SortKey, sortDir: "asc" | "desc"): number {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
  let cmp = 0;
  if (sortKey === "name") cmp = a.name.localeCompare(b.name);
  else if (sortKey === "kind") cmp = kindOf(a.name, a.isDir).localeCompare(kindOf(b.name, b.isDir));
  else if (sortKey === "size") cmp = a.size - b.size;
  else if (sortKey === "modified") cmp = a.modifiedMs - b.modifiedMs;
  return sortDir === "asc" ? cmp : -cmp;
}

export function addGhost(get: GetState, set: SetState, dir: string, ghost: Ghost) {
  // The cached listing still holds the departed entry at this point (reloads happen
  // after the op loop), so snapshot what the ghost needs to sort in the file's place.
  const orig = get().entriesFor(dir).find((e) => e.path === ghost.fromPath);
  const enriched: Ghost = orig
    ? { ...ghost, isDir: orig.isDir, size: orig.size, modifiedMs: orig.modifiedMs }
    : ghost;
  const ghosts = { ...get().ghosts };
  ghosts[dir] = [enriched, ...(ghosts[dir] || [])].slice(0, 3);
  set({ ghosts });
  removeGhostOnReturn(get, set, ghost.toDir, ghost.name);
}

export function removeGhostOnReturn(get: GetState, set: SetState, dir: string, name: string) {
  const existing = get().ghosts[dir];
  if (!existing || !existing.some((g) => g.name === name)) return;
  const ghosts = { ...get().ghosts, [dir]: existing.filter((g) => g.name !== name) };
  set({ ghosts });
}

// Working-set items are references ({dir, name}), never copies — every operation
// that moves/renames/removes a file must keep those refs pointing at the file.
// toDir === null means the file is gone for good (permanent delete): drop the ref.
export function updateSetRefs(
  get: GetState,
  set: SetState,
  fromDir: string,
  fromName: string,
  toDir: string | null,
  toName?: string,
) {
  const setDefs = get().setDefs.map((s) => {
    if (s.smart) return s;
    if (toDir === null) {
      if (!s.items.some((i) => i.dir === fromDir && i.name === fromName)) return s;
      return { ...s, items: s.items.filter((i) => !(i.dir === fromDir && i.name === fromName)) };
    }
    return {
      ...s,
      items: s.items.map((i) => (i.dir === fromDir && i.name === fromName ? { dir: toDir, name: toName ?? fromName } : i)),
    };
  });
  set({ setDefs });
  get().persist();
}

// fileEvents is keyed by a file's current path, so a file's Journey stays a single
// continuous timeline across renames/moves instead of fragmenting into a dead entry
// under the old path and a fresh one under the new path — call this alongside every
// updateSetRefs(...) call that has a real destination (not permanent delete, which
// leaves the entry frozen under its last known path as the file's final record).
export function migrateFileEvents(get: GetState, set: SetState, fromPath: string, toPath: string) {
  if (fromPath === toPath) return;
  const existing = get().fileEvents[fromPath];
  if (!existing || existing.length === 0) return;
  const fileEvents = { ...get().fileEvents };
  delete fileEvents[fromPath];
  const merged = [...(fileEvents[toPath] || []), ...existing].sort((a, b) => b.whenMs - a.whenMs).slice(0, 200);
  fileEvents[toPath] = merged;
  set({ fileEvents });
}

function appendSuffix(name: string, n: number): string {
  const idx = name.lastIndexOf(".");
  if (idx > 0) return `${name.slice(0, idx)} ${n}${name.slice(idx)}`;
  return `${name} ${n}`;
}

export function uniqueNameFor(existingNames: Set<string>, desired: string): string {
  if (!existingNames.has(desired)) return desired;
  let i = 2;
  let candidate = appendSuffix(desired, i);
  while (existingNames.has(candidate)) {
    i++;
    candidate = appendSuffix(desired, i);
  }
  return candidate;
}

// Trashing a file may rename it to dodge a collision inside the Trash folder; restoring
// it should give the user their original filename back whenever the origin folder allows it.
export async function finishRestore(
  backend: FsBackend,
  get: GetState,
  toDir: string,
  restoredPath: string,
  desiredName: string,
): Promise<string> {
  const currentName = backend.basename(restoredPath);
  if (currentName === desiredName) return restoredPath;
  const existing = new Set(get().entriesFor(toDir).map((e) => e.name));
  let finalName = desiredName;
  let i = 2;
  while (existing.has(finalName) && finalName !== currentName) {
    finalName = appendSuffix(desiredName, i++);
  }
  if (finalName === currentName) return restoredPath;
  try {
    return await backend.renamePath(restoredPath, finalName);
  } catch {
    return restoredPath;
  }
}
