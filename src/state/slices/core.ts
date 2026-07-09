import type { StateCreator } from "zustand";
import { getFsBackend } from "../../fs";
import type { FsBackend, FsEntry } from "../../fs/types";
import { classifyError, type AppError } from "../../lib/errors";
import { extOf, kindOf } from "../../lib/format";
import { compareEntries } from "../helpers";
import { defaultLayout, mergeLayout } from "../layout";
import { buildPersistPayload, loadPersisted, STORAGE_KEY } from "../persistence";
import type { AppState } from "../store";
import { seedSets } from "./sets";

export interface CoreSlice {
  backend: FsBackend | null;
  home: string;

  // dir cache
  dirs: Record<string, FsEntry[]>;
  loading: Record<string, boolean>;
  devices: { label: string; path: string }[];

  // per-path listing failures (cleared on a successful reload) — what lets the Files
  // module distinguish "empty folder" from "couldn't read this folder"
  dirErrors: Record<string, AppError>;

  init(): Promise<void>;
  loadDir(path: string, force?: boolean): Promise<void>;
  entriesFor(path: string): FsEntry[];
  visibleEntries(): FsEntry[];
  persist(): void;
}

export const createCoreSlice: StateCreator<AppState, [], [], CoreSlice> = (set, get) => ({
  backend: null,
  home: "/home",

  dirs: {},
  loading: {},
  devices: [],

  dirErrors: {},

  async init() {
    const backend = await getFsBackend();
    const persisted = loadPersisted();
    // Independent IPC calls — issue them together so startup pays one round
    // trip, not three in a row.
    const [home, trashDir, devices] = await Promise.all([
      backend.homeDir(),
      backend.trashDirPath(),
      backend.listDevices(),
    ]);
    const startupMode = persisted.startupMode || "resume";
    const tabs = startupMode === "resume" && persisted.tabs && persisted.tabs.length
      ? persisted.tabs
      : [{ id: "tab-1", path: home, hist: [home], hi: 0, trashView: false, activeSetId: null }];
    const activeTab = tabs.find((tb) => tb.id === persisted.activeTabId) || tabs[0];
    set({
      backend,
      home,
      path: activeTab.path,
      hist: activeTab.hist,
      hi: activeTab.hi,
      trashView: activeTab.trashView,
      activeSetId: activeTab.activeSetId,
      tabs,
      activeTabId: activeTab.id,
      path2: persisted.path2 || home,
      trashDir,
      devices,
      skin: persisted.skin || "parchment",
      ov: persisted.ov || {},
      motion: persisted.motion || "full",
      glow: persisted.glow ?? true,
      view: persisted.view || "grid",
      columns: persisted.columns || ["kind", "size", "modified"],
      showHidden: persisted.showHidden ?? false,
      sortKey: persisted.sortKey || "name",
      sortDir: persisted.sortDir || "asc",
      confirmPermanentDelete: persisted.confirmPermanentDelete ?? true,
      confirmTrash: persisted.confirmTrash ?? false,
      confirmWindowMs: persisted.confirmWindowMs ?? 4000,
      newTabAtHome: persisted.newTabAtHome ?? true,
      startupMode,
      searchScope: persisted.searchScope || "folder",
      layout: persisted.layout ? mergeLayout(persisted.layout) : defaultLayout(),
      railW: persisted.railW || { left: 270, right: 340 },
      moduleWidths: persisted.moduleWidths || {},
      centerSplit: !!persisted.centerSplit,
      centerRatio: persisted.centerRatio ?? 0.6,
      modCfg: persisted.modCfg || {},
      setDefs: persisted.setDefs && persisted.setDefs.length ? persisted.setDefs : seedSets(),
      starred: new Set(persisted.starred || []),
      fileEvents: persisted.fileEvents || {},
      globalFeed: persisted.globalFeed || [],
      trashOrigins: persisted.trashOrigins || {},
      trashOriginNames: persisted.trashOriginNames || {},
      remoteConnections: persisted.remoteConnections || [],
      aiSelectedModel: persisted.aiSelectedModel || "",
      aiSearchEnabled: persisted.aiSearchEnabled ?? false,
      aiRenameEnabled: persisted.aiRenameEnabled ?? false,
      aiSummaryEnabled: persisted.aiSummaryEnabled ?? false,
    });
    await Promise.all([get().loadDir(get().path), get().loadDir(get().path2)]);
    void get().refreshAiStatus();
  },

  async loadDir(path: string, force = false) {
    const { backend, dirs, loading } = get();
    if (!backend) return;
    if (!force && dirs[path] && !loading[path]) return;
    set({ loading: { ...get().loading, [path]: true } });
    try {
      const entries = await backend.listDir(path);
      const dirErrors = { ...get().dirErrors };
      delete dirErrors[path];
      set({ dirs: { ...get().dirs, [path]: entries }, dirErrors });
    } catch (e) {
      // The listing still becomes [] so counts and navigation stay sane, but the
      // failure is recorded so Files can show "couldn't load" + Retry instead of
      // passing the folder off as empty.
      set({
        dirs: { ...get().dirs, [path]: [] },
        dirErrors: { ...get().dirErrors, [path]: classifyError(e) },
      });
    } finally {
      set({ loading: { ...get().loading, [path]: false } });
    }
  },

  entriesFor(path: string) {
    return get().dirs[path] || [];
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

    const sorted = filtered.slice().sort((a, b) => compareEntries(a, b, st.sortKey, st.sortDir));
    return sorted;
  },

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistPayload(get())));
    } catch {
      // storage unavailable — ignore
    }
  },
});
