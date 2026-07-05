import { create } from "zustand";
import type { FsBackend, FsEntry } from "../fs/types";
import { getFsBackend } from "../fs";
import {
  ALL_MODULES,
  defaultLayout,
  isPanelModule,
  mergeLayout,
  type Layout,
  type ModuleId,
  type ZoneId,
} from "./layout";
import type {
  ClipboardState,
  ContextMenuState,
  FileEvent,
  Filters,
  Ghost,
  SearchScope,
  SortDir,
  SortKey,
  UndoAction,
  ViewMode,
  WorkingSet,
} from "./types";
import type { SkinOverrides } from "../theme/skins";
import { kindOf } from "../lib/format";

const STORAGE_KEY = "geyma-v1";

interface ModOptionValue {
  [key: string]: string | number | boolean;
}

interface PersistedShape {
  skin?: string;
  ov?: SkinOverrides;
  motion?: "full" | "subtle" | "off";
  glow?: boolean;
  view?: ViewMode;
  columns?: string[];
  showStatus?: boolean;
  layout?: Layout;
  railW?: { left: number; right: number };
  centerSplit?: boolean;
  centerRatio?: number;
  path2?: string;
  modCfg?: Record<string, ModOptionValue>;
  setDefs?: WorkingSet[];
  starred?: string[];
  fileEvents?: Record<string, FileEvent[]>;
  trashOrigins?: Record<string, string>;
}

function loadPersisted(): PersistedShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function seedSets(): WorkingSet[] {
  return [
    { id: "smart-week", name: "Fresh this week", smart: true, rule: { minMt: Date.now() - 7 * 86400000 }, items: [] },
    { id: "smart-starred", name: "Starred", smart: true, rule: { starred: true }, items: [] },
  ];
}

interface AppState {
  backend: FsBackend | null;
  home: string;

  // navigation
  path: string;
  hist: string[];
  hi: number;
  path2: string;

  // dir cache
  dirs: Record<string, FsEntry[]>;
  loading: Record<string, boolean>;
  devices: { label: string; path: string }[];

  // selection
  selected: string[];
  anchor: string | null;
  selected2: string[];

  // view
  view: ViewMode;
  sortKey: SortKey;
  sortDir: SortDir;
  columns: string[];

  // search
  query: string;
  searchScope: SearchScope;
  filters: Filters;

  // starred / tags
  starred: Set<string>;

  // trash
  trashView: boolean;
  trashDir: string;

  // quick look
  preview: string | null;

  // rename
  renaming: string | null;
  renameVal: string;

  // clipboard
  clip: ClipboardState | null;

  // memory
  fileEvents: Record<string, FileEvent[]>;
  globalFeed: FileEvent[];
  ghosts: Record<string, Ghost[]>;
  trashOrigins: Record<string, string>;
  undoStack: UndoAction[];

  // sets
  setDefs: WorkingSet[];
  activeSetId: string | null;

  // appearance
  skin: string;
  ov: SkinOverrides;
  motion: "full" | "subtle" | "off";
  glow: boolean;

  // layout
  layout: Layout;
  editMode: boolean;
  railW: { left: number; right: number };
  centerSplit: boolean;
  centerRatio: number;
  modCfg: Record<string, ModOptionValue>;
  apTab: "skins" | "style" | "layout";

  // ui chrome
  menu: ContextMenuState | null;
  modMenuId: ModuleId | null;
  toast: string;
  showHidden: boolean;
  pendingPermanentDelete: string | null;
  pendingPermanentAt: number;

  // actions
  init(): Promise<void>;
  loadDir(path: string, force?: boolean): Promise<void>;
  entriesFor(path: string): FsEntry[];
  goPath(path: string): void;
  goPlace(path: string): void;
  goBack(): void;
  goForward(): void;
  goUp(): void;
  canBack(): boolean;
  canForward(): boolean;
  canUp(): boolean;
  goPath2(path: string): void;
  goUp2(): void;

  select(path: string, opts?: { ctrl?: boolean; shift?: boolean }): void;
  selectAll(): void;
  clearSelection(): void;
  setSelected(paths: string[]): void;

  setView(v: ViewMode): void;
  setSort(key: SortKey): void;
  toggleColumn(key: string): void;

  setQuery(q: string): void;
  setSearchScope(s: SearchScope): void;
  toggleKindFilter(k: Filters["kind"]): void;
  toggleStarredFilter(): void;
  toggleShowHidden(): void;

  toggleStar(paths: string[]): void;

  openPreview(path: string): void;
  closePreview(): void;
  stepPreview(dir: 1 | -1): void;

  startRename(path: string): void;
  commitRename(): Promise<void>;
  cancelRename(): void;

  createFolder(): Promise<void>;
  createTextFile(kind: "text" | "markdown"): Promise<void>;

  setClip(mode: "cut" | "copy", items: string[]): void;
  pasteClip(): Promise<void>;

  moveEntries(paths: string[], destDir: string): Promise<void>;
  trashEntries(paths: string[]): Promise<void>;
  restoreEntries(paths: string[]): Promise<void>;
  requestPermanentDelete(paths: string[]): void;

  pushUndo(action: UndoAction): void;
  undo(): Promise<void>;

  openMenu(state: ContextMenuState): void;
  closeMenu(): void;
  showToast(msg: string): void;

  createManualSet(name: string): void;
  createSmartSet(name: string, rule: WorkingSet["rule"]): void;
  addToSet(setId: string, refs: { dir: string; name: string }[]): void;
  removeFromSet(setId: string, dir: string, name: string): void;
  renameSet(setId: string, name: string): void;
  setNote(setId: string, note: string): void;
  duplicateSet(setId: string): void;
  removeSet(setId: string): void;
  openSet(setId: string | null): void;
  setEntriesFor(set: WorkingSet): FsEntry[];

  setSkin(skin: string): void;
  setOverride(patch: SkinOverrides): void;
  resetOverrides(): void;
  setMotion(m: AppState["motion"]): void;
  toggleGlow(): void;

  toggleEditMode(): void;
  moveModule(id: ModuleId, toZone: ZoneId, index: number): void;
  hideModule(id: ModuleId): void;
  showModule(id: ModuleId, zone: ZoneId): void;
  setRailWidth(side: "left" | "right", w: number): void;
  setCenterRatio(r: number): void;
  toggleCenterSplit(): void;
  applyPreset(layout: Partial<Layout>): void;
  resetLayout(): void;
  setModCfg(id: string, key: string, val: string | number | boolean): void;
  resetModCfg(id: string): void;
  mcfg<T>(id: string, key: string, def: T): T;
  setApTab(tab: AppState["apTab"]): void;

  persist(): void;
}

function nowEvent(path: string, action: string, detail: string | undefined, kind: FileEvent["kind"]): FileEvent {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, path, action, detail, whenMs: Date.now(), kind };
}

export const useStore = create<AppState>()((set, get) => ({
  backend: null,
  home: "/home",

  path: "/home",
  hist: ["/home"],
  hi: 0,
  path2: "/home",

  dirs: {},
  loading: {},
  devices: [],

  selected: [],
  anchor: null,
  selected2: [],

  view: "grid",
  sortKey: "name",
  sortDir: "asc",
  columns: ["kind", "size", "modified"],

  query: "",
  searchScope: "folder",
  filters: { kind: null, starred: false },

  starred: new Set<string>(),

  trashView: false,
  trashDir: "/trash",

  preview: null,

  renaming: null,
  renameVal: "",

  clip: null,

  fileEvents: {},
  globalFeed: [],
  ghosts: {},
  trashOrigins: {},
  undoStack: [],

  setDefs: seedSets(),
  activeSetId: null,

  skin: "parchment",
  ov: {},
  motion: "full",
  glow: true,

  layout: defaultLayout(),
  editMode: false,
  railW: { left: 270, right: 340 },
  centerSplit: false,
  centerRatio: 0.6,
  modCfg: {},
  apTab: "skins",

  menu: null,
  modMenuId: null,
  toast: "",
  showHidden: false,
  pendingPermanentDelete: null,
  pendingPermanentAt: 0,

  async init() {
    const backend = await getFsBackend();
    const persisted = loadPersisted();
    const home = await backend.homeDir();
    const trashDir = await backend.trashDirPath();
    const devices = await backend.listDevices();
    set({
      backend,
      home,
      path: home,
      hist: [home],
      hi: 0,
      path2: persisted.path2 || home,
      trashDir,
      devices,
      skin: persisted.skin || "parchment",
      ov: persisted.ov || {},
      motion: persisted.motion || "full",
      glow: persisted.glow ?? true,
      view: persisted.view || "grid",
      columns: persisted.columns || ["kind", "size", "modified"],
      layout: persisted.layout ? mergeLayout(persisted.layout) : defaultLayout(),
      railW: persisted.railW || { left: 270, right: 340 },
      centerSplit: !!persisted.centerSplit,
      centerRatio: persisted.centerRatio ?? 0.6,
      modCfg: persisted.modCfg || {},
      setDefs: persisted.setDefs && persisted.setDefs.length ? persisted.setDefs : seedSets(),
      starred: new Set(persisted.starred || []),
      fileEvents: persisted.fileEvents || {},
      trashOrigins: persisted.trashOrigins || {},
    });
    await get().loadDir(home);
    await get().loadDir(get().path2);
  },

  async loadDir(path: string, force = false) {
    const { backend, dirs, loading } = get();
    if (!backend) return;
    if (!force && dirs[path] && !loading[path]) return;
    set({ loading: { ...get().loading, [path]: true } });
    try {
      const entries = path === get().trashDir
        ? await backend.listDir(path)
        : await backend.listDir(path);
      set({ dirs: { ...get().dirs, [path]: entries } });
    } catch {
      set({ dirs: { ...get().dirs, [path]: [] } });
    } finally {
      set({ loading: { ...get().loading, [path]: false } });
    }
  },

  entriesFor(path: string) {
    return get().dirs[path] || [];
  },

  goPath(path: string) {
    const { hist, hi } = get();
    const newHist = hist.slice(0, hi + 1).concat(path);
    set({ path, hist: newHist, hi: newHist.length - 1, selected: [], anchor: null, trashView: false });
    void get().loadDir(path);
  },
  goPlace(path: string) {
    get().goPath(path);
  },
  goBack() {
    const { hi, hist } = get();
    if (hi <= 0) return;
    const path = hist[hi - 1];
    set({ hi: hi - 1, path, selected: [], anchor: null });
    void get().loadDir(path);
  },
  goForward() {
    const { hi, hist } = get();
    if (hi >= hist.length - 1) return;
    const path = hist[hi + 1];
    set({ hi: hi + 1, path, selected: [], anchor: null });
    void get().loadDir(path);
  },
  goUp() {
    const { backend, path } = get();
    if (!backend || !get().canUp()) return;
    get().goPath(backend.dirname(path));
  },
  canBack() {
    return get().hi > 0;
  },
  canForward() {
    const { hi, hist } = get();
    return hi < hist.length - 1;
  },
  canUp() {
    const { backend, path } = get();
    if (!backend) return false;
    return backend.dirname(path) !== path;
  },
  goPath2(path: string) {
    set({ path2: path, selected2: [] });
    void get().loadDir(path);
    get().persist();
  },
  goUp2() {
    const { backend, path2 } = get();
    if (!backend) return;
    get().goPath2(backend.dirname(path2));
  },

  select(path: string, opts) {
    const { selected, anchor } = get();
    const entries = get().entriesFor(get().path).map((e) => e.path);
    if (opts?.shift && anchor) {
      const ai = entries.indexOf(anchor);
      const bi = entries.indexOf(path);
      if (ai >= 0 && bi >= 0) {
        const [lo, hi] = ai < bi ? [ai, bi] : [bi, ai];
        set({ selected: entries.slice(lo, hi + 1) });
        return;
      }
    }
    if (opts?.ctrl) {
      const has = selected.includes(path);
      set({ selected: has ? selected.filter((p) => p !== path) : [...selected, path], anchor: path });
      return;
    }
    set({ selected: [path], anchor: path });
  },
  selectAll() {
    set({ selected: get().entriesFor(get().path).map((e) => e.path) });
  },
  clearSelection() {
    set({ selected: [], anchor: null });
  },
  setSelected(paths: string[]) {
    set({ selected: paths });
  },

  setView(v) {
    set({ view: v });
    get().persist();
  },
  setSort(key) {
    const { sortKey, sortDir } = get();
    if (sortKey === key) {
      set({ sortDir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      set({ sortKey: key, sortDir: "asc" });
    }
  },
  toggleColumn(key) {
    const { columns } = get();
    const next = columns.includes(key) ? columns.filter((c) => c !== key) : [...columns, key];
    set({ columns: next });
    get().persist();
  },

  setQuery(q) {
    set({ query: q });
  },
  setSearchScope(s) {
    set({ searchScope: s });
  },
  toggleKindFilter(k) {
    const { filters } = get();
    set({ filters: { ...filters, kind: filters.kind === k ? null : k } });
  },
  toggleStarredFilter() {
    const { filters } = get();
    set({ filters: { ...filters, starred: !filters.starred } });
  },
  toggleShowHidden() {
    set({ showHidden: !get().showHidden });
  },

  toggleStar(paths) {
    const { starred } = get();
    const next = new Set(starred);
    const allStarred = paths.every((p) => next.has(p));
    paths.forEach((p) => {
      if (allStarred) next.delete(p);
      else next.add(p);
    });
    set({ starred: next });
    get().persist();
  },

  openPreview(path) {
    set({ preview: path });
  },
  closePreview() {
    set({ preview: null });
  },
  stepPreview(dir) {
    const { preview, path } = get();
    if (!preview) return;
    const entries = get().entriesFor(path).filter((e) => !e.isDir);
    const idx = entries.findIndex((e) => e.path === preview);
    if (idx < 0) return;
    const next = (idx + dir + entries.length) % entries.length;
    set({ preview: entries[next].path, selected: [entries[next].path], anchor: entries[next].path });
  },

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
    if (renameVal === oldName) {
      set({ renaming: null });
      return;
    }
    try {
      const newPath = await backend.renamePath(renaming, renameVal.trim());
      get().pushUndo({
        label: `Rename ${oldName}`,
        undo: async () => {
          await backend.renamePath(newPath, oldName);
          await get().loadDir(path, true);
        },
      });
      logEvent(get, set, newPath, "Renamed", `from "${oldName}"`, "archive");
      set({ renaming: null, selected: [newPath] });
      await get().loadDir(path, true);
    } catch (e) {
      get().showToast(`Rename failed: ${e}`);
      set({ renaming: null });
    }
  },
  cancelRename() {
    set({ renaming: null });
  },

  async createFolder() {
    const { backend, path } = get();
    if (!backend) return;
    let name = "New Folder";
    const existing = new Set(get().entriesFor(path).map((e) => e.name));
    let i = 2;
    while (existing.has(name)) {
      name = `New Folder ${i++}`;
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
    let name = `New Note.${ext}`;
    const existing = new Set(get().entriesFor(path).map((e) => e.name));
    let i = 2;
    while (existing.has(name)) {
      name = `New Note ${i++}.${ext}`;
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
    const { clip, path } = get();
    if (!clip || clip.items.length === 0) return;
    if (clip.mode === "cut") {
      await get().moveEntries(clip.items, path);
      set({ clip: null });
    } else {
      get().showToast("Copy is not yet implemented for real files — cut/move works today.");
    }
  },

  async moveEntries(paths, destDir) {
    const { backend } = get();
    if (!backend) return;
    const srcDir = backend.dirname(paths[0]);
    const moved: { from: string; to: string }[] = [];
    for (const p of paths) {
      try {
        const to = await backend.movePath(p, destDir);
        moved.push({ from: p, to });
        const name = backend.basename(p);
        logEvent(get, set, to, "Moved here", `from ${srcDir}`, "video");
        addGhost(get, set, srcDir, { name, fromPath: p, toDir: destDir, toName: name, atMs: Date.now() });
        updateSetRefsOnMove(get, set, srcDir, name, destDir);
      } catch (e) {
        get().showToast(`Move failed: ${e}`);
      }
    }
    if (moved.length) {
      get().pushUndo({
        label: `Move ${moved.length} item${moved.length > 1 ? "s" : ""}`,
        undo: async () => {
          for (const m of moved) {
            await backend.movePath(m.to, srcDir);
            updateSetRefsOnMove(get, set, destDir, backend.basename(m.to), srcDir);
          }
          await get().loadDir(srcDir, true);
          await get().loadDir(destDir, true);
        },
      });
    }
    await get().loadDir(srcDir, true);
    await get().loadDir(destDir, true);
    set({ selected: [] });
  },

  async trashEntries(paths) {
    const { backend, trashDir } = get();
    if (!backend) return;
    const trashed: { origin: string; name: string; trashedPath: string }[] = [];
    for (const p of paths) {
      const origin = backend.dirname(p);
      const name = backend.basename(p);
      try {
        const trashedPath = await backend.trashPath(p);
        trashed.push({ origin, name, trashedPath });
        logEvent(get, set, trashedPath, "Deleted", "to Trash", "document");
        addGhost(get, set, origin, { name, fromPath: p, toDir: trashDir, toName: name, atMs: Date.now() });
        set({ trashOrigins: { ...get().trashOrigins, [trashedPath]: origin } });
      } catch (e) {
        get().showToast(`Trash failed: ${e}`);
      }
    }
    if (trashed.length) {
      get().pushUndo({
        label: `Trash ${trashed.length} item${trashed.length > 1 ? "s" : ""}`,
        undo: async () => {
          for (const t of trashed) {
            await backend.restorePath(t.trashedPath, t.origin);
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
  },

  async restoreEntries(paths) {
    const { backend, trashOrigins, home } = get();
    if (!backend) return;
    const origins = { ...trashOrigins };
    for (const p of paths) {
      const toDir = origins[p] || home;
      try {
        const restored = await backend.restorePath(p, toDir);
        logEvent(get, set, restored, "Restored", "from Trash", "app");
        delete origins[p];
        await get().loadDir(toDir, true);
      } catch (e) {
        get().showToast(`Restore failed: ${e}`);
      }
    }
    set({ trashOrigins: origins });
    await get().loadDir(get().trashDir, true);
    set({ selected: [] });
  },

  requestPermanentDelete(paths) {
    const { backend, pendingPermanentDelete, pendingPermanentAt } = get();
    if (!backend || paths.length === 0) return;
    const key = paths.join("|");
    const now = Date.now();
    if (pendingPermanentDelete === key && now - pendingPermanentAt < 4000) {
      (async () => {
        for (const p of paths) {
          try {
            await backend.deletePermanently(p);
          } catch (e) {
            get().showToast(`Delete failed: ${e}`);
          }
        }
        await get().loadDir(get().trashDir, true);
        set({ selected: [], pendingPermanentDelete: null });
      })();
    } else {
      set({ pendingPermanentDelete: key, pendingPermanentAt: now });
      get().showToast("Press Delete again within 4s to permanently delete — this cannot be undone.");
    }
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
      get().showToast(`Undid: ${action.label}`);
    } catch (e) {
      get().showToast(`Undo failed: ${e}`);
    }
  },

  openMenu(state) {
    set({ menu: state });
  },
  closeMenu() {
    set({ menu: null });
  },
  showToast(msg) {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: "" });
    }, 2600);
  },

  createManualSet(name) {
    const id = `set-${Date.now()}`;
    set({ setDefs: [...get().setDefs, { id, name, items: [] }] });
    get().persist();
  },
  createSmartSet(name, rule) {
    const id = `smart-${Date.now()}`;
    set({ setDefs: [...get().setDefs, { id, name, smart: true, rule, items: [] }] });
    get().persist();
  },
  addToSet(setId, refs) {
    set({
      setDefs: get().setDefs.map((s) =>
        s.id === setId ? { ...s, items: [...s.items, ...refs.filter((r) => !s.items.some((i) => i.dir === r.dir && i.name === r.name))] } : s,
      ),
    });
    get().persist();
  },
  removeFromSet(setId, dir, name) {
    set({
      setDefs: get().setDefs.map((s) => (s.id === setId ? { ...s, items: s.items.filter((i) => !(i.dir === dir && i.name === name)) } : s)),
    });
    get().persist();
  },
  renameSet(setId, name) {
    set({ setDefs: get().setDefs.map((s) => (s.id === setId ? { ...s, name } : s)) });
    get().persist();
  },
  setNote(setId, note) {
    set({ setDefs: get().setDefs.map((s) => (s.id === setId ? { ...s, note } : s)) });
    get().persist();
  },
  duplicateSet(setId) {
    const src = get().setDefs.find((s) => s.id === setId);
    if (!src) return;
    const copy: WorkingSet = { ...src, id: `set-${Date.now()}`, name: `${src.name} copy` };
    set({ setDefs: [...get().setDefs, copy] });
    get().persist();
  },
  removeSet(setId) {
    set({ setDefs: get().setDefs.filter((s) => s.id !== setId), activeSetId: get().activeSetId === setId ? null : get().activeSetId });
    get().persist();
  },
  openSet(setId) {
    set({ activeSetId: setId });
  },
  setEntriesFor(setDef) {
    if (setDef.smart) {
      const all = Object.entries(get().dirs).flatMap(([dir, entries]) => entries.map((e) => ({ dir, e })));
      return all
        .filter(({ dir, e }) => {
          if (dir === get().trashDir) return false;
          if (e.isHidden) return false;
          const rule = setDef.rule || {};
          if (rule.starred && !get().starred.has(e.path)) return false;
          if (rule.kind && kindOf(e.name, e.isDir) !== rule.kind) return false;
          if (rule.minMt && e.modifiedMs < rule.minMt) return false;
          return true;
        })
        .map(({ e }) => e);
    }
    return setDef.items
      .map((ref) => {
        const dirEntries = get().dirs[ref.dir] || [];
        return dirEntries.find((e) => e.name === ref.name);
      })
      .filter((e): e is FsEntry => !!e);
  },

  setSkin(skin) {
    set({ skin });
    get().persist();
  },
  setOverride(patch) {
    set({ ov: { ...get().ov, ...patch } });
    get().persist();
  },
  resetOverrides() {
    set({ ov: {} });
    get().persist();
  },
  setMotion(m) {
    set({ motion: m });
    get().persist();
  },
  toggleGlow() {
    set({ glow: !get().glow });
    get().persist();
  },

  toggleEditMode() {
    set({ editMode: !get().editMode });
  },
  moveModule(id, toZone, index) {
    const layout = get().layout;
    const next: Layout = { ...layout };
    (Object.keys(next) as ZoneId[]).forEach((z) => {
      next[z] = next[z].filter((m) => m !== id);
    });
    const arr = next[toZone].slice();
    arr.splice(Math.max(0, Math.min(index, arr.length)), 0, id);
    next[toZone] = arr;
    set({ layout: next });
    get().persist();
  },
  hideModule(id) {
    const layout = get().layout;
    const next: Layout = { ...layout };
    (Object.keys(next) as ZoneId[]).forEach((z) => {
      next[z] = next[z].filter((m) => m !== id);
    });
    set({ layout: next });
    get().persist();
  },
  showModule(id, zone) {
    get().moveModule(id, zone, get().layout[zone].length);
  },
  setRailWidth(side, w) {
    set({ railW: { ...get().railW, [side]: Math.max(200, Math.min(520, w)) } });
    get().persist();
  },
  setCenterRatio(r) {
    set({ centerRatio: Math.max(0.2, Math.min(0.8, r)) });
    get().persist();
  },
  toggleCenterSplit() {
    const on = !get().centerSplit;
    const L = { ...get().layout, center: get().layout.center.slice(), center2: get().layout.center2.slice() };
    if (on) {
      if (L.center2.length === 0 && L.center.length > 1) {
        const popped = L.center.pop();
        if (popped) L.center2.push(popped);
      }
    } else {
      L.center = L.center.concat(L.center2);
      L.center2 = [];
    }
    set({ centerSplit: on, layout: L });
    get().persist();
  },
  applyPreset(layout) {
    const merged = mergeLayout(layout);
    set({ layout: merged, centerSplit: merged.center2.length > 0 });
    get().persist();
  },
  resetLayout() {
    set({ layout: defaultLayout(), centerSplit: false });
    get().persist();
  },
  setModCfg(id, key, val) {
    const mc = { ...get().modCfg };
    mc[id] = { ...mc[id], [key]: val };
    set({ modCfg: mc });
    get().persist();
  },
  resetModCfg(id) {
    const mc = { ...get().modCfg };
    delete mc[id];
    set({ modCfg: mc });
    get().persist();
  },
  mcfg(id, key, def) {
    const c = get().modCfg[id];
    const v = c ? c[key] : undefined;
    return (v === undefined ? def : v) as typeof def;
  },
  setApTab(tab) {
    set({ apTab: tab });
  },

  persist() {
    const st = get();
    const payload: PersistedShape = {
      skin: st.skin,
      ov: st.ov,
      motion: st.motion,
      glow: st.glow,
      view: st.view,
      columns: st.columns,
      layout: st.layout,
      railW: st.railW,
      centerSplit: st.centerSplit,
      centerRatio: st.centerRatio,
      path2: st.path2,
      modCfg: st.modCfg,
      setDefs: st.setDefs,
      starred: Array.from(st.starred),
      fileEvents: st.fileEvents,
      trashOrigins: st.trashOrigins,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage unavailable — ignore
    }
  },
}));

function logEvent(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  path: string,
  action: string,
  detail: string | undefined,
  kind: FileEvent["kind"],
) {
  const ev = nowEvent(path, action, detail, kind);
  const fileEvents = { ...get().fileEvents };
  fileEvents[path] = [ev, ...(fileEvents[path] || [])].slice(0, 30);
  const globalFeed = [ev, ...get().globalFeed].slice(0, 60);
  set({ fileEvents, globalFeed });
  get().persist();
}

function addGhost(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  dir: string,
  ghost: Ghost,
) {
  const ghosts = { ...get().ghosts };
  ghosts[dir] = [ghost, ...(ghosts[dir] || [])].slice(0, 3);
  set({ ghosts });
  removeGhostOnReturn(get, set, ghost.toDir, ghost.name);
}

function removeGhostOnReturn(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  dir: string,
  name: string,
) {
  const existing = get().ghosts[dir];
  if (!existing || !existing.some((g) => g.name === name)) return;
  const ghosts = { ...get().ghosts, [dir]: existing.filter((g) => g.name !== name) };
  set({ ghosts });
}

function updateSetRefsOnMove(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  fromDir: string,
  name: string,
  toDir: string,
) {
  const setDefs = get().setDefs.map((s) => ({
    ...s,
    items: s.items.map((i) => (i.dir === fromDir && i.name === name ? { dir: toDir, name } : i)),
  }));
  set({ setDefs });
  get().persist();
}

export const ALL_MODULE_IDS = ALL_MODULES;
export { isPanelModule };
