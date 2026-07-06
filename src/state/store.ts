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
  SetItemRef,
  SortDir,
  SortKey,
  UndoAction,
  ViewMode,
  WorkingSet,
} from "./types";
import type { SkinOverrides } from "../theme/skins";
import { extOf, kindOf } from "../lib/format";
import { computeBatchNames } from "../lib/batchRename";

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
  trashOriginNames?: Record<string, string>;
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
  searchAllResults: FsEntry[] | null;

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
  trashOriginNames: Record<string, string>;
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
  modMenu: { id: ModuleId; x: number; y: number } | null;
  toast: string;
  showHidden: boolean;
  pendingPermanentDelete: string | null;
  pendingPermanentAt: number;

  // actions
  init(): Promise<void>;
  loadDir(path: string, force?: boolean): Promise<void>;
  entriesFor(path: string): FsEntry[];
  visibleEntries(): FsEntry[];
  setSearchAllResults(results: FsEntry[] | null): void;
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
  duplicateEntries(paths: string[]): Promise<void>;
  extractHere(path: string): Promise<void>;
  compressEntries(paths: string[], archiveName: string): Promise<void>;
  createSymlinkFor(path: string): Promise<void>;
  setPathMode(path: string, mode: number): Promise<void>;
  batchRename(paths: string[], template: string, startAt: number): Promise<void>;
  trashEntries(paths: string[]): Promise<void>;
  restoreEntries(paths: string[]): Promise<void>;
  requestPermanentDelete(paths: string[]): void;

  pushUndo(action: UndoAction): void;
  undo(): Promise<void>;

  openMenu(state: ContextMenuState): void;
  closeMenu(): void;
  openModMenu(id: ModuleId, x: number, y: number): void;
  closeModMenu(): void;
  showToast(msg: string): void;

  createManualSet(name: string): void;
  createSmartSet(name: string, rule: WorkingSet["rule"]): void;
  importSet(data: { name?: string; note?: string; smart?: boolean; rule?: WorkingSet["rule"]; items?: SetItemRef[] }): void;
  addToSet(setId: string, refs: { dir: string; name: string }[]): void;
  removeFromSet(setId: string, dir: string, name: string): void;
  renameSet(setId: string, name: string): void;
  setNote(setId: string, note: string): void;
  duplicateSet(setId: string): void;
  removeSet(setId: string): void;
  openSet(setId: string | null): void;
  openTrash(): void;
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
  searchAllResults: null,

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
  trashOriginNames: {},
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
  modMenu: null,
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
      trashOriginNames: persisted.trashOriginNames || {},
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

  setSearchAllResults(results) {
    set({ searchAllResults: results });
  },

  // The single source of truth for "what the Files module currently shows": same
  // filtering/sorting must drive the grid, the item count, keyboard navigation,
  // select-all, and Quick Look stepping, or they silently disagree with each other.
  visibleEntries() {
    const st = get();
    const activeSet = st.activeSetId ? st.setDefs.find((s) => s.id === st.activeSetId) : null;
    const dirEntries = st.entriesFor(st.trashView ? st.trashDir : st.path);
    const baseEntries: FsEntry[] = activeSet
      ? st.setEntriesFor(activeSet)
      : st.searchScope === "all" && st.query.trim() && st.searchAllResults
        ? st.searchAllResults
        : dirEntries;

    const q = st.query.trim().toLowerCase();
    const filtered = baseEntries.filter((e) => {
      if (!st.showHidden && e.isHidden && !st.trashView) return false;
      const kind = kindOf(e.name, e.isDir);
      if (st.filters.kind && kind !== st.filters.kind) return false;
      if (st.filters.starred && !st.starred.has(e.path)) return false;
      if (q && st.searchScope === "folder") {
        const ext = extOf(e.name).toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !kind.includes(q) && !ext.includes(q)) return false;
      }
      return true;
    });

    const sorted = filtered.slice().sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      if (st.sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (st.sortKey === "kind") cmp = kindOf(a.name, a.isDir).localeCompare(kindOf(b.name, b.isDir));
      else if (st.sortKey === "size") cmp = a.size - b.size;
      else if (st.sortKey === "modified") cmp = a.modifiedMs - b.modifiedMs;
      return st.sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  },

  goPath(path: string) {
    const { hist, hi } = get();
    const newHist = hist.slice(0, hi + 1).concat(path);
    set({ path, hist: newHist, hi: newHist.length - 1, selected: [], anchor: null, trashView: false, activeSetId: null, query: "" });
    void get().loadDir(path);
  },
  goPlace(path: string) {
    get().goPath(path);
  },
  goBack() {
    const { hi, hist } = get();
    if (hi <= 0) return;
    const path = hist[hi - 1];
    set({ hi: hi - 1, path, selected: [], anchor: null, trashView: false, activeSetId: null, query: "" });
    void get().loadDir(path);
  },
  goForward() {
    const { hi, hist } = get();
    if (hi >= hist.length - 1) return;
    const path = hist[hi + 1];
    set({ hi: hi + 1, path, selected: [], anchor: null, trashView: false, activeSetId: null, query: "" });
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
    const entries = get().visibleEntries().map((e) => e.path);
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
    set({ selected: get().visibleEntries().map((e) => e.path) });
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
    const { preview } = get();
    if (!preview) return;
    const entries = get().visibleEntries();
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
    const dir = backend.dirname(renaming);
    const newName = renameVal.trim();
    if (newName === oldName) {
      set({ renaming: null });
      return;
    }
    try {
      const newPath = await backend.renamePath(renaming, newName);
      updateSetRefs(get, set, dir, oldName, dir, newName);
      get().pushUndo({
        label: `Rename ${oldName}`,
        undo: async () => {
          await backend.renamePath(newPath, oldName);
          updateSetRefs(get, set, dir, newName, dir, oldName);
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
        get().showToast(`Copy failed: ${e}`);
      }
    }
    if (copied.length) {
      get().pushUndo({
        label: `Paste ${copied.length} item${copied.length > 1 ? "s" : ""}`,
        undo: async () => {
          for (const c of copied) {
            try {
              await backend.trashPath(c);
            } catch (e) {
              get().showToast(`Undo failed: ${e}`);
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
    const srcDir = backend.dirname(paths[0]);
    const moved: { from: string; to: string }[] = [];
    for (const p of paths) {
      try {
        const to = await backend.movePath(p, destDir);
        moved.push({ from: p, to });
        const name = backend.basename(p);
        logEvent(get, set, to, "Moved here", `from ${srcDir}`, "video");
        addGhost(get, set, srcDir, { name, fromPath: p, toDir: destDir, toName: name, atMs: Date.now() });
        updateSetRefs(get, set, srcDir, name, destDir);
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
            updateSetRefs(get, set, destDir, backend.basename(m.to), srcDir);
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
        get().showToast(`Duplicate failed: ${e}`);
      }
    }
    if (copied.length) {
      get().pushUndo({
        label: `Duplicate ${copied.length} item${copied.length > 1 ? "s" : ""}`,
        undo: async () => {
          const dirs = new Set(copied.map((c) => backend.dirname(c)));
          for (const c of copied) {
            try {
              await backend.trashPath(c);
            } catch (e) {
              get().showToast(`Undo failed: ${e}`);
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
    const stem = backend.basename(archivePath).replace(/\.[^./]+$/, "");
    const existing = new Set(get().entriesFor(dir).map((e) => e.name));
    const folderName = uniqueNameFor(existing, stem || "archive");
    try {
      const newPath = await backend.extractArchive(archivePath, dir, folderName);
      logEvent(get, set, newPath, "Extracted", `from "${backend.basename(archivePath)}"`, "archive");
      get().pushUndo({
        label: `Extract ${folderName}`,
        undo: async () => {
          await backend.trashPath(newPath);
          await get().loadDir(dir, true);
        },
      });
      await get().loadDir(dir, true);
      set({ selected: [newPath] });
    } catch (e) {
      get().showToast(`Extract failed: ${e}`);
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
        label: `Compress to ${finalName}`,
        undo: async () => {
          await backend.trashPath(newPath);
          await get().loadDir(dir, true);
        },
      });
      await get().loadDir(dir, true);
      set({ selected: [newPath] });
    } catch (e) {
      get().showToast(`Compress failed: ${e}`);
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
        label: `Create symlink to ${origName}`,
        undo: async () => {
          await backend.trashPath(newPath);
          await get().loadDir(dir, true);
        },
      });
      await get().loadDir(dir, true);
      set({ selected: [newPath] });
    } catch (e) {
      get().showToast(`Create symlink failed: ${e}`);
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
        label: `Change permissions of ${backend.basename(path)}`,
        undo: async () => {
          await backend.setPathMode(path, before.mode);
        },
      });
    } catch (e) {
      get().showToast(`Permission change failed: ${e}`);
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
      get().showToast("Batch rename failed: selection changed, try again");
      return;
    }

    const newNames = computeBatchNames(targets, template, startAt);
    const targetPaths = new Set(targets.map((e) => e.path));
    const staticNames = new Set(dirEntries.filter((e) => !targetPaths.has(e.path)).map((e) => e.name));
    const seen = new Set<string>();
    for (const name of newNames) {
      if (!name.trim() || staticNames.has(name) || seen.has(name)) {
        get().showToast(`Batch rename failed: name collision on "${name || "(empty)"}"`);
        return;
      }
      seen.add(name);
    }

    const renamed: { to: string; oldName: string; newName: string }[] = [];
    for (let i = 0; i < targets.length; i++) {
      const entry = targets[i];
      const newName = newNames[i];
      if (newName === entry.name) continue;
      try {
        const newPath = await backend.renamePath(entry.path, newName);
        updateSetRefs(get, set, dir, entry.name, dir, newName);
        logEvent(get, set, newPath, "Renamed", `from "${entry.name}"`, "archive");
        renamed.push({ to: newPath, oldName: entry.name, newName });
      } catch (e) {
        get().showToast(`Rename failed for "${entry.name}": ${e}`);
      }
    }
    if (renamed.length) {
      get().pushUndo({
        label: `Batch rename ${renamed.length} item${renamed.length > 1 ? "s" : ""}`,
        undo: async () => {
          for (const r of renamed) {
            await backend.renamePath(r.to, r.oldName);
            updateSetRefs(get, set, dir, r.newName, dir, r.oldName);
          }
          await get().loadDir(dir, true);
        },
      });
    }
    await get().loadDir(dir, true);
    set({ selected: renamed.map((r) => r.to) });
  },

  async trashEntries(paths) {
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
        logEvent(get, set, trashedPath, "Deleted", "to Trash", "document");
        addGhost(get, set, origin, { name, fromPath: p, toDir: trashDir, toName: name, atMs: Date.now() });
        updateSetRefs(get, set, origin, name, trashDir, trashedName);
        set({
          trashOrigins: { ...get().trashOrigins, [trashedPath]: origin },
          trashOriginNames: { ...get().trashOriginNames, [trashedPath]: name },
        });
      } catch (e) {
        get().showToast(`Trash failed: ${e}`);
      }
    }
    if (trashed.length) {
      get().pushUndo({
        label: `Trash ${trashed.length} item${trashed.length > 1 ? "s" : ""}`,
        undo: async () => {
          for (const t of trashed) {
            const restoredPath = await backend.restorePath(t.trashedPath, t.origin);
            const finalPath = await finishRestore(backend, get, t.origin, restoredPath, t.name);
            updateSetRefs(get, set, trashDir, t.trashedName, t.origin, backend.basename(finalPath));
            const origins = { ...get().trashOrigins };
            const originNames = { ...get().trashOriginNames };
            delete origins[t.trashedPath];
            delete originNames[t.trashedPath];
            set({ trashOrigins: origins, trashOriginNames: originNames });
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
        logEvent(get, set, finalPath, "Restored", "from Trash", "app");
        updateSetRefs(get, set, trashDir, trashedName, toDir, backend.basename(finalPath));
        restored.push({ toDir, finalPath, trashedName, origName: desiredName });
        delete origins[p];
        delete originNames[p];
        await get().loadDir(toDir, true);
      } catch (e) {
        get().showToast(`Restore failed: ${e}`);
      }
    }
    if (restored.length) {
      get().pushUndo({
        label: `Restore ${restored.length} item${restored.length > 1 ? "s" : ""}`,
        undo: async () => {
          for (const r of restored) {
            const trashedAgain = await backend.trashPath(r.finalPath);
            const trashedAgainName = backend.basename(trashedAgain);
            updateSetRefs(get, set, r.toDir, backend.basename(r.finalPath), trashDir, trashedAgainName);
            set({
              trashOrigins: { ...get().trashOrigins, [trashedAgain]: r.toDir },
              trashOriginNames: { ...get().trashOriginNames, [trashedAgain]: r.origName },
            });
          }
          await get().loadDir(trashDir, true);
          restored.forEach((r) => get().loadDir(r.toDir, true));
        },
      });
    }
    set({ trashOrigins: origins, trashOriginNames: originNames });
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
        const origins = { ...get().trashOrigins };
        const originNames = { ...get().trashOriginNames };
        for (const p of paths) {
          try {
            await backend.deletePermanently(p);
            updateSetRefs(get, set, backend.dirname(p), backend.basename(p), null);
            delete origins[p];
            delete originNames[p];
          } catch (e) {
            get().showToast(`Delete failed: ${e}`);
          }
        }
        set({ trashOrigins: origins, trashOriginNames: originNames });
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
    set({ menu: state, modMenu: null });
  },
  closeMenu() {
    set({ menu: null });
  },
  openModMenu(id, x, y) {
    set({ modMenu: { id, x, y }, menu: null });
  },
  closeModMenu() {
    set({ modMenu: null });
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
  importSet(data) {
    const id = `set-${Date.now()}`;
    const items = Array.isArray(data.items)
      ? data.items.filter((it): it is SetItemRef => !!it && typeof it.dir === "string" && typeof it.name === "string")
      : [];
    const def: WorkingSet = {
      id,
      name: data.name?.trim() || "Imported set",
      items,
    };
    if (data.note) def.note = data.note;
    if (data.smart) def.smart = true;
    if (data.rule) def.rule = data.rule;
    set({ setDefs: [...get().setDefs, def] });
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
    set({ activeSetId: setId, trashView: false, selected: [], anchor: null, query: "" });
  },
  openTrash() {
    const { trashDir } = get();
    set({ trashView: true, path: trashDir, activeSetId: null, selected: [], anchor: null, query: "" });
    void get().loadDir(trashDir);
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
      trashOriginNames: st.trashOriginNames,
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

// Working-set items are references ({dir, name}), never copies — every operation
// that moves/renames/removes a file must keep those refs pointing at the file.
// toDir === null means the file is gone for good (permanent delete): drop the ref.
function updateSetRefs(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
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

function appendSuffix(name: string, n: number): string {
  const idx = name.lastIndexOf(".");
  if (idx > 0) return `${name.slice(0, idx)} ${n}${name.slice(idx)}`;
  return `${name} ${n}`;
}

function uniqueNameFor(existingNames: Set<string>, desired: string): string {
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
async function finishRestore(
  backend: FsBackend,
  get: () => AppState,
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

export const ALL_MODULE_IDS = ALL_MODULES;
export { isPanelModule };
