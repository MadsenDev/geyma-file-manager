import type { StateCreator } from "zustand";
import { tr } from "@/i18n";
import { addGhost, finishRestore, logEvent, migrateFileEvents, updateSetRefs, type GetState, type SetState } from "../helpers";
import type { AppState } from "../store";

export interface TrashSlice {
  // origin bookkeeping: where each trashed path came from, and what it was called
  // before any collision-dodging rename inside the Trash folder
  trashOrigins: Record<string, string>;
  trashOriginNames: Record<string, string>;

  // double-press-to-confirm state shared by trash and permanent delete
  pendingConfirm: { kind: "trash" | "permanent"; key: string; at: number } | null;

  trashEntries(paths: string[]): Promise<void>;
  restoreEntries(paths: string[]): Promise<void>;
  requestPermanentDelete(paths: string[]): void;
}

export const createTrashSlice: StateCreator<AppState, [], [], TrashSlice> = (set, get) => ({
  trashOrigins: {},
  trashOriginNames: {},

  pendingConfirm: null,

  async trashEntries(paths) {
    const { backend, confirmTrash, pendingConfirm, confirmWindowMs } = get();
    if (!backend || paths.length === 0) return;
    if (!confirmTrash) {
      await doTrash(get, set, paths);
      return;
    }
    const key = paths.join("|");
    const now = Date.now();
    if (pendingConfirm && pendingConfirm.kind === "trash" && pendingConfirm.key === key && now - pendingConfirm.at < confirmWindowMs) {
      set({ pendingConfirm: null });
      await doTrash(get, set, paths);
    } else {
      set({ pendingConfirm: { kind: "trash", key, at: now } });
      get().showToast(tr("toast.confirm_trash", { seconds: Math.round(confirmWindowMs / 1000) }));
    }
  },

  async restoreEntries(paths) {
    const { backend, trashOrigins, trashOriginNames, home, trashDir } = get();
    if (!backend) return;
    const origins = { ...trashOrigins };
    const originNames = { ...trashOriginNames };
    const restored: { toDir: string; finalPath: string; trashedName: string; origName: string }[] = [];
    for (const p of paths) {
      const toDir = origins[p] || home;
      const trashedName = backend.basename(p);
      const desiredName = originNames[p] || trashedName;
      try {
        const movedPath = await backend.restorePath(p, toDir);
        const finalPath = await finishRestore(backend, get, toDir, movedPath, desiredName);
        logEvent(get, set, finalPath, "Restored", "from Trash", "app", p);
        updateSetRefs(get, set, trashDir, trashedName, toDir, backend.basename(finalPath));
        migrateFileEvents(get, set, p, finalPath);
        restored.push({ toDir, finalPath, trashedName, origName: desiredName });
        delete origins[p];
        delete originNames[p];
        await get().loadDir(toDir, true);
      } catch (e) {
        get().showError(tr("toast.restore_failed"), e);
      }
    }
    if (restored.length) {
      get().pushUndo({
        label: tr("undo.restore", { count: restored.length }),
        undo: async () => {
          for (const r of restored) {
            const trashedAgain = await backend.trashPath(r.finalPath);
            const trashedAgainName = backend.basename(trashedAgain);
            updateSetRefs(get, set, r.toDir, backend.basename(r.finalPath), trashDir, trashedAgainName);
            migrateFileEvents(get, set, r.finalPath, trashedAgain);
            set({
              trashOrigins: { ...get().trashOrigins, [trashedAgain]: r.toDir },
              trashOriginNames: { ...get().trashOriginNames, [trashedAgain]: r.origName },
            });
            get().persist();
          }
          await get().loadDir(trashDir, true);
          restored.forEach((r) => get().loadDir(r.toDir, true));
        },
      });
    }
    set({ trashOrigins: origins, trashOriginNames: originNames });
    get().persist();
    await get().loadDir(get().trashDir, true);
    set({ selected: [] });
  },

  requestPermanentDelete(paths) {
    const { backend, confirmPermanentDelete, pendingConfirm, confirmWindowMs } = get();
    if (!backend || paths.length === 0) return;
    if (!confirmPermanentDelete) {
      void doPermanentDelete(get, set, paths);
      return;
    }
    const key = paths.join("|");
    const now = Date.now();
    if (pendingConfirm && pendingConfirm.kind === "permanent" && pendingConfirm.key === key && now - pendingConfirm.at < confirmWindowMs) {
      set({ pendingConfirm: null });
      void doPermanentDelete(get, set, paths);
    } else {
      set({ pendingConfirm: { kind: "permanent", key, at: now } });
      get().showToast(tr("toast.confirm_permanent_delete", { seconds: Math.round(confirmWindowMs / 1000) }));
    }
  },
});

// Exported for undoFileEvent (journal slice), which re-trashes a file to reverse a
// "Restored" journey step without re-running the double-press confirm flow.
export async function doTrash(get: GetState, set: SetState, paths: string[]) {
  const { backend, trashDir } = get();
  if (!backend) return;
  const trashed: { origin: string; name: string; trashedPath: string; trashedName: string }[] = [];
  for (const p of paths) {
    const origin = backend.dirname(p);
    const name = backend.basename(p);
    try {
      const trashedPath = await backend.trashPath(p);
      const trashedName = backend.basename(trashedPath);
      trashed.push({ origin, name, trashedPath, trashedName });
      logEvent(get, set, trashedPath, "Deleted", "to Trash", "document", p);
      addGhost(get, set, origin, { name, fromPath: p, toDir: trashDir, toName: name, atMs: Date.now() });
      updateSetRefs(get, set, origin, name, trashDir, trashedName);
      migrateFileEvents(get, set, p, trashedPath);
      set({
        trashOrigins: { ...get().trashOrigins, [trashedPath]: origin },
        trashOriginNames: { ...get().trashOriginNames, [trashedPath]: name },
      });
      get().persist();
    } catch (e) {
      get().showError(tr("toast.trash_failed"), e);
    }
  }
  if (trashed.length) {
    get().pushUndo({
      label: tr("undo.trash", { count: trashed.length }),
      undo: async () => {
        for (const t of trashed) {
          const restoredPath = await backend.restorePath(t.trashedPath, t.origin);
          const finalPath = await finishRestore(backend, get, t.origin, restoredPath, t.name);
          updateSetRefs(get, set, trashDir, t.trashedName, t.origin, backend.basename(finalPath));
          migrateFileEvents(get, set, t.trashedPath, finalPath);
          const origins = { ...get().trashOrigins };
          const originNames = { ...get().trashOriginNames };
          delete origins[t.trashedPath];
          delete originNames[t.trashedPath];
          set({ trashOrigins: origins, trashOriginNames: originNames });
          get().persist();
        }
        await get().loadDir(trashDir, true);
        trashed.forEach((t) => get().loadDir(t.origin, true));
      },
    });
  }
  const dirsToRefresh = new Set(trashed.map((t) => t.origin));
  dirsToRefresh.add(trashDir);
  for (const d of dirsToRefresh) await get().loadDir(d, true);
  set({ selected: [] });
}

async function doPermanentDelete(get: GetState, set: SetState, paths: string[]) {
  const { backend } = get();
  if (!backend) return;
  const origins = { ...get().trashOrigins };
  const originNames = { ...get().trashOriginNames };
  for (const p of paths) {
    try {
      await backend.deletePermanently(p);
      updateSetRefs(get, set, backend.dirname(p), backend.basename(p), null);
      // Left in fileEvents under this now-nonexistent path on purpose — a permanently
      // deleted file's Journey is frozen at its last known location as its final record,
      // instead of being dropped like its Working Set refs are.
      logEvent(get, set, p, "Permanently deleted", undefined, "muted");
      delete origins[p];
      delete originNames[p];
    } catch (e) {
      get().showError(tr("toast.delete_failed"), e);
    }
  }
  set({ trashOrigins: origins, trashOriginNames: originNames });
  get().persist();
  await get().loadDir(get().trashDir, true);
  // Also refreshes the current folder — a no-op reload when this ran from the
  // Trash view itself, but required when it ran against a network place, which
  // has no Trash and lands here directly from the normal folder view.
  await get().loadDir(get().path, true);
  set({ selected: [], pendingConfirm: null });
}
