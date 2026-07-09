import type { StateCreator } from "zustand";
import { tr } from "@/i18n";
import type { FsEntry } from "../../fs/types";
import { computeBatchNames } from "../../lib/batchRename";
import { archiveStem } from "../../lib/format";
import { addGhost, logEvent, migrateFileEvents, uniqueNameFor, updateSetRefs } from "../helpers";
import type { AppState } from "../store";
import type { ClipboardState } from "../types";

export interface FileOpsSlice {
  // rename
  renaming: string | null;
  renameVal: string;

  // clipboard
  clip: ClipboardState | null;

  startRename(path: string): void;
  commitRename(): Promise<void>;
  cancelRename(): void;

  createFolder(): Promise<void>;
  createTextFile(kind: "text" | "markdown"): Promise<void>;

  setClip(mode: "cut" | "copy", items: string[]): void;
  pasteClip(): Promise<void>;

  moveEntries(paths: string[], destDir: string): Promise<void>;
  duplicateEntries(paths: string[]): Promise<void>;
  extractHere(path: string): Promise<void>;
  compressEntries(paths: string[], archiveName: string): Promise<void>;
  createSymlinkFor(path: string): Promise<void>;
  setPathMode(path: string, mode: number): Promise<void>;
  batchRename(paths: string[], template: string, startAt: number): Promise<void>;
}

export const createFileOpsSlice: StateCreator<AppState, [], [], FileOpsSlice> = (set, get) => ({
  renaming: null,
  renameVal: "",

  clip: null,

  startRename(path) {
    const { backend } = get();
    if (!backend) return;
    set({ renaming: path, renameVal: backend.basename(path) });
  },
  async commitRename() {
    const { backend, renaming, renameVal, path } = get();
    if (!backend || !renaming || !renameVal.trim()) {
      set({ renaming: null });
      return;
    }
    const oldName = backend.basename(renaming);
    const dir = backend.dirname(renaming);
    const newName = renameVal.trim();
    if (newName === oldName) {
      set({ renaming: null });
      return;
    }
    try {
      const newPath = await backend.renamePath(renaming, newName);
      updateSetRefs(get, set, dir, oldName, dir, newName);
      migrateFileEvents(get, set, renaming, newPath);
      get().pushUndo({
        label: tr("undo.rename", { name: oldName }),
        undo: async () => {
          await backend.renamePath(newPath, oldName);
          updateSetRefs(get, set, dir, newName, dir, oldName);
          migrateFileEvents(get, set, newPath, renaming);
          await get().loadDir(path, true);
        },
      });
      logEvent(get, set, newPath, "Renamed", `from "${oldName}"`, "archive", renaming);
      set({ renaming: null, selected: [newPath] });
      await get().loadDir(path, true);
    } catch (e) {
      get().showError(tr("toast.rename_failed"), e);
      set({ renaming: null });
    }
  },
  cancelRename() {
    set({ renaming: null });
  },

  async createFolder() {
    const { backend, path } = get();
    if (!backend) return;
    const folderBase = tr("names.new_folder");
    let name = folderBase;
    const existing = new Set(get().entriesFor(path).map((e) => e.name));
    let i = 2;
    while (existing.has(name)) {
      name = `${folderBase} ${i++}`;
    }
    const newPath = await backend.createFolder(path, name);
    await get().loadDir(path, true);
    logEvent(get, set, newPath, "Created", undefined, "muted");
    set({ selected: [newPath], anchor: newPath, renaming: newPath, renameVal: name });
  },
  async createTextFile(kind) {
    const { backend, path } = get();
    if (!backend) return;
    const ext = kind === "markdown" ? "md" : "txt";
    const noteBase = tr("names.new_note");
    let name = `${noteBase}.${ext}`;
    const existing = new Set(get().entriesFor(path).map((e) => e.name));
    let i = 2;
    while (existing.has(name)) {
      name = `${noteBase} ${i++}.${ext}`;
    }
    const newPath = await backend.createFile(path, name, "");
    await get().loadDir(path, true);
    logEvent(get, set, newPath, "Created", undefined, "muted");
    set({ selected: [newPath], anchor: newPath, renaming: newPath, renameVal: name });
  },

  setClip(mode, items) {
    set({ clip: { mode, items } });
  },
  async pasteClip() {
    const { clip, path, backend } = get();
    if (!clip || clip.items.length === 0 || !backend) return;
    if (clip.mode === "cut") {
      await get().moveEntries(clip.items, path);
      set({ clip: null });
      return;
    }
    const destDir = path;
    const copied: string[] = [];
    for (const p of clip.items) {
      const origDir = backend.dirname(p);
      const origName = backend.basename(p);
      const existing = new Set(get().entriesFor(destDir).map((e) => e.name));
      const finalName = uniqueNameFor(existing, origName);
      try {
        const newPath = await backend.copyPath(p, destDir, finalName);
        copied.push(newPath);
        logEvent(get, set, newPath, "Copied here", origDir !== destDir ? `from ${origDir}` : undefined, "video");
        await get().loadDir(destDir, true);
      } catch (e) {
        get().showError(tr("toast.copy_failed"), e);
      }
    }
    if (copied.length) {
      get().pushUndo({
        label: tr("undo.paste", { count: copied.length }),
        undo: async () => {
          for (const c of copied) {
            try {
              await backend.trashPath(c);
            } catch (e) {
              get().showError(tr("toast.undo_failed"), e);
            }
          }
          await get().loadDir(destDir, true);
        },
      });
    }
    set({ selected: copied });
  },

  async moveEntries(paths, destDir) {
    const { backend } = get();
    if (!backend) return;
    // Each item keeps its own source dir — a multi-select move can span folders
    // (e.g. dragged out of an "All"-scope search), so one shared srcDir would
    // orphan set refs and undo items back into the wrong folder.
    const moved: { from: string; srcDir: string; to: string }[] = [];
    for (const p of paths) {
      const srcDir = backend.dirname(p);
      try {
        const to = await backend.movePath(p, destDir);
        moved.push({ from: p, srcDir, to });
        const name = backend.basename(p);
        logEvent(get, set, to, "Moved here", `from ${srcDir}`, "video", p);
        addGhost(get, set, srcDir, { name, fromPath: p, toDir: destDir, toName: name, atMs: Date.now() });
        updateSetRefs(get, set, srcDir, name, destDir);
        migrateFileEvents(get, set, p, to);
      } catch (e) {
        get().showError(tr("toast.move_failed"), e);
      }
    }
    if (moved.length) {
      get().pushUndo({
        label: tr("undo.move", { count: moved.length }),
        undo: async () => {
          for (const m of moved) {
            await backend.movePath(m.to, m.srcDir);
            updateSetRefs(get, set, destDir, backend.basename(m.to), m.srcDir);
            migrateFileEvents(get, set, m.to, m.from);
          }
          const reload = new Set([destDir, ...moved.map((m) => m.srcDir)]);
          for (const d of reload) await get().loadDir(d, true);
        },
      });
    }
    const reload = new Set([destDir, ...paths.map((p) => backend.dirname(p))]);
    for (const d of reload) await get().loadDir(d, true);
    set({ selected: [] });
  },

  async duplicateEntries(paths) {
    const { backend } = get();
    if (!backend) return;
    const copied: string[] = [];
    for (const p of paths) {
      const dir = backend.dirname(p);
      const origName = backend.basename(p);
      const existing = new Set(get().entriesFor(dir).map((e) => e.name));
      const finalName = uniqueNameFor(existing, origName);
      try {
        const newPath = await backend.copyPath(p, dir, finalName);
        copied.push(newPath);
        logEvent(get, set, newPath, "Duplicated", `from "${origName}"`, "video");
        await get().loadDir(dir, true);
      } catch (e) {
        get().showError(tr("toast.duplicate_failed"), e);
      }
    }
    if (copied.length) {
      get().pushUndo({
        label: tr("undo.duplicate", { count: copied.length }),
        undo: async () => {
          const dirs = new Set(copied.map((c) => backend.dirname(c)));
          for (const c of copied) {
            try {
              await backend.trashPath(c);
            } catch (e) {
              get().showError(tr("toast.undo_failed"), e);
            }
          }
          for (const d of dirs) await get().loadDir(d, true);
        },
      });
    }
    set({ selected: copied });
  },

  async extractHere(archivePath) {
    const { backend } = get();
    if (!backend) return;
    const dir = backend.dirname(archivePath);
    const stem = archiveStem(backend.basename(archivePath));
    const existing = new Set(get().entriesFor(dir).map((e) => e.name));
    const folderName = uniqueNameFor(existing, stem || "archive");
    try {
      const newPath = await backend.extractArchive(archivePath, dir, folderName);
      logEvent(get, set, newPath, "Extracted", `from "${backend.basename(archivePath)}"`, "archive");
      get().pushUndo({
        label: tr("undo.extract", { name: folderName }),
        undo: async () => {
          await backend.trashPath(newPath);
          await get().loadDir(dir, true);
        },
      });
      await get().loadDir(dir, true);
      set({ selected: [newPath] });
    } catch (e) {
      get().showError(tr("toast.extract_failed"), e);
    }
  },

  async compressEntries(paths, archiveName) {
    const { backend } = get();
    if (!backend || paths.length === 0) return;
    const dir = backend.dirname(paths[0]);
    const existing = new Set(get().entriesFor(dir).map((e) => e.name));
    const desired = archiveName.toLowerCase().endsWith(".zip") ? archiveName : `${archiveName}.zip`;
    const finalName = uniqueNameFor(existing, desired);
    try {
      const newPath = await backend.createArchive(paths, dir, finalName);
      logEvent(get, set, newPath, "Compressed", `${paths.length} item${paths.length > 1 ? "s" : ""}`, "archive");
      get().pushUndo({
        label: tr("undo.compress", { name: finalName }),
        undo: async () => {
          await backend.trashPath(newPath);
          await get().loadDir(dir, true);
        },
      });
      await get().loadDir(dir, true);
      set({ selected: [newPath] });
    } catch (e) {
      get().showError(tr("toast.compress_failed"), e);
    }
  },

  async createSymlinkFor(path) {
    const { backend } = get();
    if (!backend) return;
    const dir = backend.dirname(path);
    const origName = backend.basename(path);
    const existing = new Set(get().entriesFor(dir).map((e) => e.name));
    const linkName = uniqueNameFor(existing, `${origName} (link)`);
    try {
      const newPath = await backend.createSymlink(path, dir, linkName);
      logEvent(get, set, newPath, "Linked", `to "${origName}"`, "archive");
      get().pushUndo({
        label: tr("undo.create_symlink", { name: origName }),
        undo: async () => {
          await backend.trashPath(newPath);
          await get().loadDir(dir, true);
        },
      });
      await get().loadDir(dir, true);
      set({ selected: [newPath] });
    } catch (e) {
      get().showError(tr("toast.symlink_failed"), e);
    }
  },

  async setPathMode(path, mode) {
    const { backend } = get();
    if (!backend) return;
    try {
      const before = await backend.getPathPermissions(path);
      await backend.setPathMode(path, mode);
      logEvent(get, set, path, "Permissions changed", `${before.mode.toString(8)} → ${mode.toString(8)}`, "muted");
      get().pushUndo({
        label: tr("undo.change_permissions", { name: backend.basename(path) }),
        undo: async () => {
          await backend.setPathMode(path, before.mode);
        },
      });
    } catch (e) {
      get().showError(tr("toast.permission_change_failed"), e);
    }
  },

  async batchRename(paths, template, startAt) {
    const { backend } = get();
    if (!backend || paths.length === 0) return;
    const dir = backend.dirname(paths[0]);
    const dirEntries = get().entriesFor(dir);
    const targets = paths
      .map((p) => dirEntries.find((e) => e.path === p))
      .filter((e): e is FsEntry => !!e);
    if (targets.length !== paths.length) {
      get().showToast(tr("toast.batch_rename_selection_changed"), "error");
      return;
    }

    const newNames = computeBatchNames(targets, template, startAt);
    const targetPaths = new Set(targets.map((e) => e.path));
    const staticNames = new Set(dirEntries.filter((e) => !targetPaths.has(e.path)).map((e) => e.name));
    const seen = new Set<string>();
    for (const name of newNames) {
      if (!name.trim() || staticNames.has(name) || seen.has(name)) {
        get().showToast(tr("toast.batch_rename_collision", { name: name || tr("names.empty_name") }), "error");
        return;
      }
      seen.add(name);
    }

    const renamed: { from: string; to: string; oldName: string; newName: string }[] = [];
    for (let i = 0; i < targets.length; i++) {
      const entry = targets[i];
      const newName = newNames[i];
      if (newName === entry.name) continue;
      try {
        const newPath = await backend.renamePath(entry.path, newName);
        updateSetRefs(get, set, dir, entry.name, dir, newName);
        migrateFileEvents(get, set, entry.path, newPath);
        logEvent(get, set, newPath, "Renamed", `from "${entry.name}"`, "archive", entry.path);
        renamed.push({ from: entry.path, to: newPath, oldName: entry.name, newName });
      } catch (e) {
        get().showError(tr("toast.rename_failed_for", { name: entry.name }), e);
      }
    }
    if (renamed.length) {
      get().pushUndo({
        label: tr("undo.batch_rename", { count: renamed.length }),
        undo: async () => {
          for (const r of renamed) {
            await backend.renamePath(r.to, r.oldName);
            updateSetRefs(get, set, dir, r.newName, dir, r.oldName);
            migrateFileEvents(get, set, r.to, r.from);
          }
          await get().loadDir(dir, true);
        },
      });
    }
    await get().loadDir(dir, true);
    set({ selected: renamed.map((r) => r.to) });
  },
});
