import type { StateCreator } from "zustand";
import { tr, trEventAction } from "@/i18n";
import { logEvent, migrateFileEvents, updateSetRefs } from "../helpers";
import type { AppState } from "../store";
import type { FileEvent, Ghost, UndoAction } from "../types";
import { doTrash } from "./trash";

// Three different logs for three different UI surfaces: fileEvents is the per-file
// activity timeline (Journey), globalFeed is the disk-wide Timeline module, and
// ghosts are the capped-at-3-per-folder "a file that just left went to X" breadcrumbs.
export interface JournalSlice {
  fileEvents: Record<string, FileEvent[]>;
  globalFeed: FileEvent[];
  ghosts: Record<string, Ghost[]>;
  undoStack: UndoAction[];

  dismissGhost(ghost: Ghost): void;
  pushUndo(action: UndoAction): void;
  undo(): Promise<void>;
  undoFileEvent(path: string, eventId: string): Promise<void>;
}

export const createJournalSlice: StateCreator<AppState, [], [], JournalSlice> = (set, get) => ({
  fileEvents: {},
  globalFeed: [],
  ghosts: {},
  undoStack: [],

  dismissGhost(ghost) {
    const ghosts = { ...get().ghosts };
    let changed = false;
    for (const dir of Object.keys(ghosts)) {
      const next = ghosts[dir].filter((g) => !(g.fromPath === ghost.fromPath && g.atMs === ghost.atMs));
      if (next.length !== ghosts[dir].length) {
        ghosts[dir] = next;
        changed = true;
      }
    }
    if (changed) set({ ghosts });
  },

  pushUndo(action) {
    const stack = get().undoStack.concat(action).slice(-20);
    set({ undoStack: stack });
  },
  async undo() {
    const stack = get().undoStack.slice();
    const action = stack.pop();
    if (!action) return;
    set({ undoStack: stack });
    try {
      await action.undo();
      get().showToast(tr("toast.undid", { action: action.label }), "success");
    } catch (e) {
      get().showError(tr("toast.undo_failed"), e);
    }
  },
  // Undoes a single past Journey entry independent of the global undo stack — resolves
  // the file's *current* location (fileEvents is always keyed by that, see
  // migrateFileEvents) and reverses just this one step, regardless of what happened to
  // the file afterward. Only steps that changed the file's location are reversible here.
  async undoFileEvent(path, eventId) {
    const { backend, fileEvents } = get();
    if (!backend) return;
    const ev = (fileEvents[path] || []).find((e) => e.id === eventId);
    if (!ev || !ev.prevPath) {
      get().showToast(tr("toast.step_not_undoable"));
      return;
    }
    try {
      if (ev.action === "Renamed") {
        const dir = backend.dirname(path);
        const oldName = backend.basename(path);
        const newName = backend.basename(ev.prevPath);
        const newPath = await backend.renamePath(path, newName);
        updateSetRefs(get, set, dir, oldName, dir, newName);
        migrateFileEvents(get, set, path, newPath);
        logEvent(get, set, newPath, "Renamed", `from "${oldName}"`, "archive", path);
        await get().loadDir(dir, true);
        set({ selected: [newPath] });
      } else if (ev.action === "Moved here") {
        const srcDir = backend.dirname(path);
        const destDir = backend.dirname(ev.prevPath);
        const name = backend.basename(path);
        const newPath = await backend.movePath(path, destDir);
        updateSetRefs(get, set, srcDir, name, destDir);
        migrateFileEvents(get, set, path, newPath);
        logEvent(get, set, newPath, "Moved here", `from ${srcDir}`, "video", path);
        await get().loadDir(srcDir, true);
        await get().loadDir(destDir, true);
        set({ selected: [newPath] });
      } else if (ev.action === "Deleted") {
        await get().restoreEntries([path]);
      } else if (ev.action === "Restored") {
        await doTrash(get, set, [path]);
      } else {
        get().showToast(tr("toast.step_not_undoable"));
        return;
      }
      get().showToast(tr("toast.undid", { action: trEventAction(ev.action).toLowerCase() }), "success");
    } catch (e) {
      get().showError(tr("toast.undo_failed"), e);
    }
  },
});
