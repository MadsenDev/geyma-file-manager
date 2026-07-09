import { create } from "zustand";
import { tr, trEventAction } from "@/i18n";
import type { FsBackend, FsEntry, SmbDevice, SmbShare } from "../fs/types";
import { getFsBackend } from "../fs";
import {
  ALL_MODULES,
  defaultLayout,
  isPanelModule,
  mergeLayout,
  moduleMinWidth,
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
  RemoteConnection,
  RemoteStatus,
  SearchScope,
  PreviewState,
  SetItemRef,
  SetRule,
  SortDir,
  SortKey,
  TabState,
  UndoAction,
  ViewMode,
  WorkingSet,
} from "./types";
import { buildGysetPayload, encodeGysetFile, parseGysetText } from "../lib/gyset";
import type { SkinOverrides } from "../theme/skins";
import { archiveStem, extOf, kindOf } from "../lib/format";
import { computeBatchNames } from "../lib/batchRename";
import { explainError } from "../lib/explainError";
import { aiDeleteModel, aiListModels, aiStartServer, aiStatus, aiStopServer, type AiModel } from "../ai/ollama";

const STORAGE_KEY = "geyma-v1";

/** Key for per-device SMB discovery state (share listings, in-memory credentials). */
export function smbDeviceKey(device: SmbDevice): string {
  return `${device.host}:${device.port}`;
}

export interface SmbShareListing {
  status: "loading" | "loaded" | "error";
  shares: SmbShare[];
  error: string | null;
  /** The credentials the listing was made with, kept only in memory so clicking a
   *  listed share connects without prompting again. Empty username means guest. */
  username: string;
  password: string;
  /** Whether a connection made from this listing should keep its password in the OS keyring. */
  remember: boolean;
}

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
  moduleWidths?: Partial<Record<ModuleId, number>>;
  centerSplit?: boolean;
  centerRatio?: number;
  path2?: string;
  modCfg?: Record<string, ModOptionValue>;
  setDefs?: WorkingSet[];
  starred?: string[];
  fileEvents?: Record<string, FileEvent[]>;
  globalFeed?: FileEvent[];
  trashOrigins?: Record<string, string>;
  trashOriginNames?: Record<string, string>;
  tabs?: TabState[];
  activeTabId?: string;
  remoteConnections?: RemoteConnection[];
  aiSelectedModel?: string;
  aiSearchEnabled?: boolean;
  aiRenameEnabled?: boolean;
  aiSummaryEnabled?: boolean;
  showHidden?: boolean;
  sortKey?: SortKey;
  sortDir?: SortDir;
  confirmPermanentDelete?: boolean;
  confirmTrash?: boolean;
  confirmWindowMs?: number;
  newTabAtHome?: boolean;
  startupMode?: "resume" | "home";
  searchScope?: SearchScope;
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
    { id: "smart-week", name: tr("names.smart_week"), smart: true, rule: { withinDays: 7 }, items: [], createdMs: Date.now() },
    { id: "smart-starred", name: tr("names.smart_starred"), smart: true, rule: { starred: true }, items: [], createdMs: Date.now() },
  ];
}

function isUnderRoot(dir: string, root: string): boolean {
  if (!root) return false;
  const r = root.endsWith("/") ? root.slice(0, -1) : root;
  return dir === r || dir.startsWith(`${r}/`);
}

// Every defined field is one condition; match "all" (default) ANDs them, "any" ORs them.
// roots is scope rather than a condition, so it always constrains regardless of match mode.
// A rule with no conditions matches everything under its scope in "all" mode (vacuous
// truth — preserves the behavior of old persisted `{}` rules) and nothing in "any" mode.
function entryMatchesRule(e: FsEntry, dir: string, rule: SetRule, starred: Set<string>): boolean {
  if (rule.roots && rule.roots.length && !rule.roots.some((r) => isUnderRoot(dir, r))) return false;
  const checks: boolean[] = [];
  if (rule.kind) checks.push(kindOf(e.name, e.isDir) === rule.kind);
  if (rule.ext) {
    const wanted = rule.ext
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((x) => x.replace(/^\./, "").toUpperCase());
    checks.push(wanted.length === 0 || wanted.includes(extOf(e.name)));
  }
  if (rule.nameContains) checks.push(e.name.toLowerCase().includes(rule.nameContains.toLowerCase()));
  if (rule.starred) checks.push(starred.has(e.path));
  if (rule.minMt) checks.push(e.modifiedMs >= rule.minMt);
  if (rule.withinDays) checks.push(e.modifiedMs >= Date.now() - rule.withinDays * 86400000);
  if (rule.minBytes != null) checks.push(!e.isDir && e.size >= rule.minBytes);
  if (rule.maxBytes != null) checks.push(!e.isDir && e.size <= rule.maxBytes);
  if (checks.length === 0) return rule.match !== "any";
  return rule.match === "any" ? checks.some(Boolean) : checks.every(Boolean);
}

interface AppState {
  backend: FsBackend | null;
  home: string;

  // navigation
  path: string;
  hist: string[];
  hi: number;
  path2: string;

  // tabs
  tabs: TabState[];
  activeTabId: string;

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
  preview: PreviewState | null;

  // rename
  renaming: string | null;
  renameVal: string;

  // clipboard
  clip: ClipboardState | null;

  // memory
  fileEvents: Record<string, FileEvent[]>;
  globalFeed: FileEvent[];
  ghosts: Record<string, Ghost[]>;
  dismissGhost(ghost: Ghost): void;
  trashOrigins: Record<string, string>;
  trashOriginNames: Record<string, string>;
  undoStack: UndoAction[];

  // sets
  setDefs: WorkingSet[];
  activeSetId: string | null;
  /** Count of in-flight rule-root scans, so the UI can show a "scanning" hint. */
  ruleScansActive: number;

  // appearance
  skin: string;
  ov: SkinOverrides;
  motion: "full" | "subtle" | "off";
  glow: boolean;

  // layout
  layout: Layout;
  editMode: boolean;
  railW: { left: number; right: number };
  moduleWidths: Partial<Record<ModuleId, number>>;
  centerSplit: boolean;
  centerRatio: number;
  modCfg: Record<string, ModOptionValue>;
  apTab: "skins" | "style" | "layout";

  // settings
  settingsOpen: boolean;
  settingsTab: "appearance" | "confirmations" | "general" | "ai";
  confirmPermanentDelete: boolean;
  confirmTrash: boolean;
  confirmWindowMs: number;
  newTabAtHome: boolean;
  startupMode: "resume" | "home";

  // ui chrome
  menu: ContextMenuState | null;
  modMenu: { id: ModuleId; x: number; y: number } | null;
  toast: string;
  showHidden: boolean;
  pendingConfirm: { kind: "trash" | "permanent"; key: string; at: number } | null;

  // network places
  remoteConnections: RemoteConnection[];
  remoteStatus: Record<string, RemoteStatus>;
  pendingRemotePasswordPromptId: string | null;

  // SMB discovery (ephemeral — devices found by the last scan, never persisted)
  smbDevices: SmbDevice[];
  smbScan: "idle" | "scanning" | "done" | "error";
  smbShares: Record<string, SmbShareListing>;

  // local AI (Ollama) — status/models reflect the real daemon, refreshed on demand;
  // the three "enabled" flags are the per-capability opt-ins each feature checks
  aiInstalled: boolean;
  aiRunning: boolean;
  aiModels: AiModel[];
  aiSelectedModel: string;
  aiSearchEnabled: boolean;
  aiRenameEnabled: boolean;
  aiSummaryEnabled: boolean;

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

  newTab(path?: string): void;
  switchTab(id: string): void;
  closeTab(id: string): void;
  closeOtherTabs(id: string): void;
  closeTabsToRight(id: string): void;
  duplicateTab(id: string): void;
  reorderTab(id: string, toIndex: number): void;
  cycleTab(dir: 1 | -1): void;
  goToTabIndex(index: number): void;

  addRemoteConnection(input: Omit<RemoteConnection, "id">): string;
  updateRemoteConnection(id: string, patch: Partial<Omit<RemoteConnection, "id">>): void;
  removeRemoteConnection(id: string): void;
  connectRemoteConnection(id: string, password?: string): Promise<void>;
  disconnectRemoteConnection(id: string): Promise<void>;
  dismissRemotePasswordPrompt(): void;
  discoverSmbDevices(): Promise<void>;
  loadSmbShares(device: SmbDevice, username: string, password: string, remember: boolean): Promise<boolean>;
  forgetSmbShares(device: SmbDevice): void;
  connectDiscoveredShare(device: SmbDevice, shareName: string): Promise<void>;

  refreshAiStatus(): Promise<void>;
  startAiServer(): Promise<void>;
  stopAiServer(): Promise<void>;
  deleteAiModel(name: string): Promise<void>;
  setAiSelectedModel(name: string): void;
  toggleAiSearchEnabled(): void;
  toggleAiRenameEnabled(): void;
  toggleAiSummaryEnabled(): void;

  select(path: string, opts?: { ctrl?: boolean; shift?: boolean }): void;
  selectAll(): void;
  clearSelection(): void;
  setSelected(paths: string[]): void;

  setView(v: ViewMode): void;
  setSort(key: SortKey): void;
  toggleColumn(key: string): void;

  setQuery(q: string): void;
  applyAiSearch(result: { query: string; kind: Filters["kind"]; starred: boolean }): void;
  setSearchScope(s: SearchScope): void;
  toggleKindFilter(k: Filters["kind"]): void;
  toggleStarredFilter(): void;
  toggleShowHidden(): void;

  toggleStar(paths: string[]): void;

  openPreview(path: string, origin?: PreviewState["origin"]): void;
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
  undoFileEvent(path: string, eventId: string): Promise<void>;

  openMenu(state: ContextMenuState): void;
  closeMenu(): void;
  openModMenu(id: ModuleId, x: number, y: number): void;
  closeModMenu(): void;
  openSettings(): void;
  closeSettings(): void;
  setSettingsTab(tab: AppState["settingsTab"]): void;
  toggleConfirmPermanentDelete(): void;
  toggleConfirmTrash(): void;
  setConfirmWindowMs(ms: number): void;
  toggleNewTabAtHome(): void;
  setStartupMode(mode: AppState["startupMode"]): void;
  showToast(msg: string): void;

  createManualSet(name: string): void;
  createSmartSet(name: string, rule: WorkingSet["rule"]): void;
  importSet(data: {
    name?: string;
    note?: string;
    smart?: boolean;
    rule?: WorkingSet["rule"];
    items?: SetItemRef[];
    color?: string;
    icon?: string;
  }): void;
  importSetFromText(text: string): string | null;
  exportSetToFile(setId: string): Promise<void>;
  addToSet(setId: string, refs: { dir: string; name: string }[]): void;
  removeFromSet(setId: string, dir: string, name: string): void;
  relinkSetItem(setId: string, ref: SetItemRef, newDir: string): void;
  renameSet(setId: string, name: string): void;
  setNote(setId: string, note: string): void;
  setSetRule(setId: string, rule: SetRule | undefined): void;
  setSetMeta(setId: string, patch: Partial<Pick<WorkingSet, "color" | "icon" | "pinned" | "archived">>): void;
  duplicateSet(setId: string): void;
  removeSet(setId: string): void;
  openSet(setId: string | null): void;
  openTrash(): void;
  setEntriesFor(set: WorkingSet): FsEntry[];
  setResolutionFor(set: WorkingSet): { present: FsEntry[]; missing: SetItemRef[]; pending: SetItemRef[] };
  scanRuleRoots(roots: string[]): Promise<void>;

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
  setModuleWidths(patch: Partial<Record<ModuleId, number>>): void;
  resetModuleWidths(ids: ModuleId[]): void;
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

function nowEvent(path: string, action: string, detail: string | undefined, kind: FileEvent["kind"], prevPath?: string): FileEvent {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, path, action, detail, whenMs: Date.now(), kind, prevPath };
}

export const useStore = create<AppState>()((set, get) => ({
  backend: null,
  home: "/home",

  path: "/home",
  hist: ["/home"],
  hi: 0,
  path2: "/home",

  tabs: [{ id: "tab-1", path: "/home", hist: ["/home"], hi: 0, trashView: false, activeSetId: null }],
  activeTabId: "tab-1",

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
  ruleScansActive: 0,

  skin: "parchment",
  ov: {},
  motion: "full",
  glow: true,

  layout: defaultLayout(),
  editMode: false,
  railW: { left: 270, right: 340 },
  moduleWidths: {},
  centerSplit: false,
  centerRatio: 0.6,
  modCfg: {},
  apTab: "skins",

  settingsOpen: false,
  settingsTab: "appearance",
  confirmPermanentDelete: true,
  confirmTrash: false,
  confirmWindowMs: 4000,
  newTabAtHome: true,
  startupMode: "resume",

  menu: null,
  modMenu: null,
  toast: "",
  showHidden: false,
  pendingConfirm: null,

  remoteConnections: [],
  remoteStatus: {},
  pendingRemotePasswordPromptId: null,
  smbDevices: [],
  smbScan: "idle",
  smbShares: {},

  aiInstalled: false,
  aiRunning: false,
  aiModels: [],
  aiSelectedModel: "",
  aiSearchEnabled: false,
  aiRenameEnabled: false,
  aiSummaryEnabled: false,

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

    const sorted = filtered.slice().sort((a, b) => compareEntries(a, b, st.sortKey, st.sortDir));
    return sorted;
  },

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

  goPath(path: string) {
    const { hist, hi } = get();
    const newHist = hist.slice(0, hi + 1).concat(path);
    set({ path, hist: newHist, hi: newHist.length - 1, selected: [], anchor: null, trashView: false, activeSetId: null, query: "" });
    syncActiveTab(get, set);
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
    syncActiveTab(get, set);
    void get().loadDir(path);
  },
  goForward() {
    const { hi, hist } = get();
    if (hi >= hist.length - 1) return;
    const path = hist[hi + 1];
    set({ hi: hi + 1, path, selected: [], anchor: null, trashView: false, activeSetId: null, query: "" });
    syncActiveTab(get, set);
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

  newTab(path) {
    syncActiveTab(get, set);
    const st = get();
    const startPath = path ?? (st.newTabAtHome ? st.home : st.path);
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const tab: TabState = { id, path: startPath, hist: [startPath], hi: 0, trashView: false, activeSetId: null };
    set({
      tabs: [...st.tabs, tab],
      activeTabId: id,
      path: startPath,
      hist: [startPath],
      hi: 0,
      trashView: false,
      activeSetId: null,
      selected: [],
      anchor: null,
      query: "",
    });
    void get().loadDir(startPath);
    get().persist();
  },
  switchTab(id) {
    const st = get();
    if (id === st.activeTabId) return;
    const target = st.tabs.find((tb) => tb.id === id);
    if (!target) return;
    syncActiveTab(get, set);
    set({
      activeTabId: target.id,
      path: target.path,
      hist: target.hist,
      hi: target.hi,
      trashView: target.trashView,
      activeSetId: target.activeSetId,
      selected: [],
      anchor: null,
      query: "",
    });
    void get().loadDir(target.path);
    get().persist();
  },
  closeTab(id) {
    const st = get();
    if (st.tabs.length <= 1) return;
    const idx = st.tabs.findIndex((tb) => tb.id === id);
    if (idx < 0) return;
    const remaining = st.tabs.filter((tb) => tb.id !== id);
    if (id !== st.activeTabId) {
      set({ tabs: remaining });
      get().persist();
      return;
    }
    const next = remaining[Math.min(idx, remaining.length - 1)];
    set({
      tabs: remaining,
      activeTabId: next.id,
      path: next.path,
      hist: next.hist,
      hi: next.hi,
      trashView: next.trashView,
      activeSetId: next.activeSetId,
      selected: [],
      anchor: null,
      query: "",
    });
    void get().loadDir(next.path);
    get().persist();
  },
  closeOtherTabs(id) {
    const st = get();
    const target = id === st.activeTabId
      ? { ...st.tabs.find((tb) => tb.id === id)!, path: st.path, hist: st.hist, hi: st.hi, trashView: st.trashView, activeSetId: st.activeSetId }
      : st.tabs.find((tb) => tb.id === id);
    if (!target) return;
    set({
      tabs: [target],
      activeTabId: target.id,
      path: target.path,
      hist: target.hist,
      hi: target.hi,
      trashView: target.trashView,
      activeSetId: target.activeSetId,
      selected: [],
      anchor: null,
      query: "",
    });
    void get().loadDir(target.path);
    get().persist();
  },
  closeTabsToRight(id) {
    syncActiveTab(get, set);
    const st = get();
    const idx = st.tabs.findIndex((tb) => tb.id === id);
    if (idx < 0) return;
    const kept = st.tabs.slice(0, idx + 1);
    if (kept.some((tb) => tb.id === st.activeTabId)) {
      set({ tabs: kept });
      get().persist();
      return;
    }
    const target = kept[kept.length - 1];
    set({
      tabs: kept,
      activeTabId: target.id,
      path: target.path,
      hist: target.hist,
      hi: target.hi,
      trashView: target.trashView,
      activeSetId: target.activeSetId,
      selected: [],
      anchor: null,
      query: "",
    });
    void get().loadDir(target.path);
    get().persist();
  },
  duplicateTab(id) {
    syncActiveTab(get, set);
    const st = get();
    const src = st.tabs.find((tb) => tb.id === id);
    if (!src) return;
    const newId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const clone: TabState = { ...src, id: newId, hist: [...src.hist] };
    const idx = st.tabs.findIndex((tb) => tb.id === id);
    const tabs = st.tabs.slice();
    tabs.splice(idx + 1, 0, clone);
    set({
      tabs,
      activeTabId: clone.id,
      path: clone.path,
      hist: clone.hist,
      hi: clone.hi,
      trashView: clone.trashView,
      activeSetId: clone.activeSetId,
      selected: [],
      anchor: null,
      query: "",
    });
    void get().loadDir(clone.path);
    get().persist();
  },
  reorderTab(id, toIndex) {
    syncActiveTab(get, set);
    const tabs = get().tabs.slice();
    const from = tabs.findIndex((tb) => tb.id === id);
    if (from < 0) return;
    const [moved] = tabs.splice(from, 1);
    tabs.splice(Math.max(0, Math.min(toIndex, tabs.length)), 0, moved);
    set({ tabs });
    get().persist();
  },
  cycleTab(dir) {
    const st = get();
    if (st.tabs.length <= 1) return;
    const idx = st.tabs.findIndex((tb) => tb.id === st.activeTabId);
    const next = (idx + dir + st.tabs.length) % st.tabs.length;
    get().switchTab(st.tabs[next].id);
  },
  goToTabIndex(index) {
    const tab = get().tabs[index];
    if (tab) get().switchTab(tab.id);
  },

  addRemoteConnection(input) {
    const id = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set({ remoteConnections: [...get().remoteConnections, { ...input, id }] });
    get().persist();
    return id;
  },
  updateRemoteConnection(id, patch) {
    set({ remoteConnections: get().remoteConnections.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
    get().persist();
  },
  removeRemoteConnection(id) {
    const conn = get().remoteConnections.find((c) => c.id === id);
    if (conn && get().remoteStatus[id] === "connected") void get().disconnectRemoteConnection(id);
    get().backend?.keyringDeletePassword(id).catch(() => {});
    const status = { ...get().remoteStatus };
    delete status[id];
    set({
      remoteConnections: get().remoteConnections.filter((c) => c.id !== id),
      remoteStatus: status,
    });
    get().persist();
  },
  async connectRemoteConnection(id, password) {
    const { backend } = get();
    const conn = get().remoteConnections.find((c) => c.id === id);
    if (!backend || !conn) return;
    set({ remoteStatus: { ...get().remoteStatus, [id]: "connecting" }, pendingRemotePasswordPromptId: null });
    try {
      // An explicitly-passed empty string is a real credential (guest login from the
      // discovery tree); only a missing password falls back to keyring/prompt.
      let usedPassword = password;
      if (usedPassword == null && conn.savePassword) {
        usedPassword = (await backend.keyringLoadPassword(id)) ?? undefined;
      }
      if (usedPassword == null) {
        set({ remoteStatus: { ...get().remoteStatus, [id]: "disconnected" }, pendingRemotePasswordPromptId: id });
        return;
      }
      const root = await backend.connectRemote({
        protocol: conn.protocol,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        share: conn.share,
        password: usedPassword,
      });
      if (conn.savePassword) await backend.keyringSavePassword(id, usedPassword).catch(() => {});
      set({ remoteStatus: { ...get().remoteStatus, [id]: "connected" } });
      get().newTab(root);
    } catch (e) {
      set({ remoteStatus: { ...get().remoteStatus, [id]: "error" }, pendingRemotePasswordPromptId: id });
      get().showToast(tr("toast.connection_failed", { error: explainError(e) }));
    }
  },
  async disconnectRemoteConnection(id) {
    const { backend } = get();
    const conn = get().remoteConnections.find((c) => c.id === id);
    if (!backend || !conn) return;
    try {
      await backend.disconnectRemote({ protocol: conn.protocol, host: conn.host, port: conn.port, username: conn.username, share: conn.share });
    } catch (e) {
      get().showToast(tr("toast.disconnect_failed", { error: explainError(e) }));
    }
    set({ remoteStatus: { ...get().remoteStatus, [id]: "disconnected" } });
  },
  dismissRemotePasswordPrompt() {
    set({ pendingRemotePasswordPromptId: null });
  },
  async discoverSmbDevices() {
    const { backend } = get();
    if (!backend || get().smbScan === "scanning") return;
    set({ smbScan: "scanning" });
    try {
      const devices = await backend.discoverSmbDevices();
      set({ smbDevices: devices, smbScan: "done" });
    } catch (e) {
      set({ smbScan: "error" });
      get().showToast(tr("toast.smb_scan_failed", { error: explainError(e) }));
    }
  },
  async loadSmbShares(device, username, password, remember) {
    const { backend } = get();
    if (!backend) return false;
    const key = smbDeviceKey(device);
    set({ smbShares: { ...get().smbShares, [key]: { status: "loading", shares: [], error: null, username, password, remember } } });
    try {
      const shares = await backend.listSmbShares(device.host, device.port, username, password);
      set({ smbShares: { ...get().smbShares, [key]: { status: "loaded", shares, error: null, username, password, remember } } });
      return true;
    } catch (e) {
      set({ smbShares: { ...get().smbShares, [key]: { status: "error", shares: [], error: explainError(e), username, password, remember } } });
      return false;
    }
  },
  forgetSmbShares(device) {
    const next = { ...get().smbShares };
    delete next[smbDeviceKey(device)];
    set({ smbShares: next });
  },
  async connectDiscoveredShare(device, shareName) {
    const listing = get().smbShares[smbDeviceKey(device)];
    if (!listing || listing.status !== "loaded") return;
    const savePassword = listing.remember;
    // Mirrors smb_list_shares on the Rust side: an empty username browsed as guest, so
    // the saved connection authenticates the same way.
    const username = listing.username.trim() || "Guest";
    const existing = get().remoteConnections.find(
      (c) =>
        c.protocol === "smb" &&
        c.host === device.host &&
        c.port === device.port &&
        c.share === shareName &&
        c.username === username
    );
    const id = existing
      ? existing.id
      : get().addRemoteConnection({
          protocol: "smb",
          label: `${device.name} · ${shareName}`,
          host: device.host,
          port: device.port,
          username,
          share: shareName,
          savePassword,
        });
    if (existing && savePassword && !existing.savePassword) get().updateRemoteConnection(id, { savePassword: true });
    await get().connectRemoteConnection(id, listing.password);
  },

  async refreshAiStatus() {
    const status = await aiStatus();
    const models = status.running ? await aiListModels().catch(() => []) : [];
    const { aiSelectedModel } = get();
    set({
      aiInstalled: status.installed,
      aiRunning: status.running,
      aiModels: models,
      aiSelectedModel: aiSelectedModel || models[0]?.name || "",
    });
  },
  async startAiServer() {
    try {
      await aiStartServer();
      await get().refreshAiStatus();
    } catch (e) {
      get().showToast(tr("toast.ollama_start_failed", { error: explainError(e) }));
    }
  },
  async stopAiServer() {
    try {
      await aiStopServer();
    } catch (e) {
      get().showToast(tr("toast.ollama_stop_failed", { error: explainError(e) }));
    }
    await get().refreshAiStatus();
  },
  async deleteAiModel(name) {
    try {
      await aiDeleteModel(name);
      await get().refreshAiStatus();
    } catch (e) {
      get().showToast(tr("toast.ollama_delete_model_failed", { error: explainError(e) }));
    }
  },
  setAiSelectedModel(name) {
    set({ aiSelectedModel: name });
    get().persist();
  },
  toggleAiSearchEnabled() {
    set({ aiSearchEnabled: !get().aiSearchEnabled });
    get().persist();
  },
  toggleAiRenameEnabled() {
    set({ aiRenameEnabled: !get().aiRenameEnabled });
    get().persist();
  },
  toggleAiSummaryEnabled() {
    set({ aiSummaryEnabled: !get().aiSummaryEnabled });
    get().persist();
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
    get().persist();
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
  applyAiSearch(result) {
    set({ query: result.query, filters: { kind: result.kind, starred: result.starred } });
  },
  setSearchScope(s) {
    set({ searchScope: s });
    get().persist();
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
    get().persist();
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

  openPreview(path, origin) {
    set({ preview: { path, origin } });
  },
  closePreview() {
    set({ preview: null });
  },
  stepPreview(dir) {
    const { preview } = get();
    if (!preview) return;
    const entries = get().visibleEntries();
    const idx = entries.findIndex((e) => e.path === preview.path);
    if (idx < 0) return;
    const next = (idx + dir + entries.length) % entries.length;
    set({ preview: { path: entries[next].path }, selected: [entries[next].path], anchor: entries[next].path });
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
      get().showToast(tr("toast.rename_failed", { error: explainError(e) }));
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
        get().showToast(tr("toast.copy_failed", { error: explainError(e) }));
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
              get().showToast(tr("toast.undo_failed", { error: explainError(e) }));
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
        get().showToast(tr("toast.move_failed", { error: explainError(e) }));
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
        get().showToast(tr("toast.duplicate_failed", { error: explainError(e) }));
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
              get().showToast(tr("toast.undo_failed", { error: explainError(e) }));
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
      get().showToast(tr("toast.extract_failed", { error: explainError(e) }));
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
      get().showToast(tr("toast.compress_failed", { error: explainError(e) }));
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
      get().showToast(tr("toast.symlink_failed", { error: explainError(e) }));
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
      get().showToast(tr("toast.permission_change_failed", { error: explainError(e) }));
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
      get().showToast(tr("toast.batch_rename_selection_changed"));
      return;
    }

    const newNames = computeBatchNames(targets, template, startAt);
    const targetPaths = new Set(targets.map((e) => e.path));
    const staticNames = new Set(dirEntries.filter((e) => !targetPaths.has(e.path)).map((e) => e.name));
    const seen = new Set<string>();
    for (const name of newNames) {
      if (!name.trim() || staticNames.has(name) || seen.has(name)) {
        get().showToast(tr("toast.batch_rename_collision", { name: name || tr("names.empty_name") }));
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
        get().showToast(tr("toast.rename_failed_for", { name: entry.name, error: explainError(e) }));
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
        get().showToast(tr("toast.restore_failed", { error: explainError(e) }));
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
      get().showToast(tr("toast.undid", { action: action.label }));
    } catch (e) {
      get().showToast(tr("toast.undo_failed", { error: explainError(e) }));
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
      get().showToast(tr("toast.undid", { action: trEventAction(ev.action).toLowerCase() }));
    } catch (e) {
      get().showToast(tr("toast.undo_failed", { error: explainError(e) }));
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
  openSettings() {
    set({ settingsOpen: true, menu: null, modMenu: null });
  },
  closeSettings() {
    set({ settingsOpen: false });
  },
  setSettingsTab(tab) {
    set({ settingsTab: tab });
  },
  toggleConfirmPermanentDelete() {
    set({ confirmPermanentDelete: !get().confirmPermanentDelete });
    get().persist();
  },
  toggleConfirmTrash() {
    set({ confirmTrash: !get().confirmTrash });
    get().persist();
  },
  setConfirmWindowMs(ms) {
    set({ confirmWindowMs: ms });
    get().persist();
  },
  toggleNewTabAtHome() {
    set({ newTabAtHome: !get().newTabAtHome });
    get().persist();
  },
  setStartupMode(mode) {
    set({ startupMode: mode });
    get().persist();
  },
  showToast(msg) {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: "" });
    }, 2600);
  },

  createManualSet(name) {
    const id = `set-${Date.now()}`;
    set({ setDefs: [...get().setDefs, { id, name, items: [], createdMs: Date.now() }] });
    get().persist();
  },
  createSmartSet(name, rule) {
    const id = `smart-${Date.now()}`;
    set({ setDefs: [...get().setDefs, { id, name, smart: true, rule, items: [], createdMs: Date.now() }] });
    get().persist();
    if (rule?.roots?.length) void get().scanRuleRoots(rule.roots);
  },
  importSet(data) {
    const id = `set-${Date.now()}`;
    const items = Array.isArray(data.items)
      ? data.items.filter((it): it is SetItemRef => !!it && typeof it.dir === "string" && typeof it.name === "string")
      : [];
    const def: WorkingSet = {
      id,
      name: data.name?.trim() || tr("names.imported_set"),
      items,
      createdMs: Date.now(),
    };
    if (data.note) def.note = data.note;
    if (data.smart) def.smart = true;
    if (data.rule) def.rule = data.rule;
    if (data.color) def.color = data.color;
    if (data.icon) def.icon = data.icon;
    set({ setDefs: [...get().setDefs, def] });
    get().persist();
    // Warm the caches the imported refs point at, so resolution (and the missing-items
    // panel's exact-path rung of the matching ladder) reflects reality immediately.
    for (const dir of new Set(items.map((i) => i.dir))) void get().loadDir(dir);
  },
  importSetFromText(text) {
    const parsed = parseGysetText(text);
    if (!parsed) return null;
    get().importSet({
      name: parsed.name,
      note: parsed.note,
      smart: parsed.smart,
      rule: parsed.rule || undefined,
      items: parsed.items,
      color: parsed.color,
      icon: parsed.icon,
    });
    return parsed.name || tr("names.imported_set");
  },
  async exportSetToFile(setId) {
    const { backend, home } = get();
    const def = get().setDefs.find((s) => s.id === setId);
    if (!backend || !def) return;
    const payload = buildGysetPayload(def);
    await get().loadDir(home);
    const existing = new Set(get().entriesFor(home).map((e) => e.name));
    const safeName = def.name.replace(/[/\\:]/g, "-").trim() || "set";
    const fileName = uniqueNameFor(existing, `${safeName}.gyset`);
    try {
      await backend.createFile(home, fileName, encodeGysetFile(payload));
      await get().loadDir(home, true);
      get().showToast(tr("toast.set_exported", { name: fileName }));
    } catch (e) {
      get().showToast(explainError(e));
    }
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
  relinkSetItem(setId, ref, newDir) {
    set({
      setDefs: get().setDefs.map((s) =>
        s.id === setId
          ? { ...s, items: s.items.map((i) => (i.dir === ref.dir && i.name === ref.name ? { dir: newDir, name: ref.name } : i)) }
          : s,
      ),
    });
    get().persist();
    void get().loadDir(newDir);
  },
  renameSet(setId, name) {
    set({ setDefs: get().setDefs.map((s) => (s.id === setId ? { ...s, name } : s)) });
    get().persist();
  },
  setNote(setId, note) {
    set({ setDefs: get().setDefs.map((s) => (s.id === setId ? { ...s, note } : s)) });
    get().persist();
  },
  setSetRule(setId, rule) {
    set({
      setDefs: get().setDefs.map((s) => {
        if (s.id !== setId) return s;
        const next = { ...s };
        if (rule) next.rule = rule;
        else {
          delete next.rule;
          // A smart set without a rule would show nothing and can't hold items — make
          // removing the rule turn it into an ordinary (empty) manual set.
          delete next.smart;
        }
        return next;
      }),
    });
    get().persist();
    if (rule?.roots?.length) void get().scanRuleRoots(rule.roots);
  },
  setSetMeta(setId, patch) {
    set({ setDefs: get().setDefs.map((s) => (s.id === setId ? { ...s, ...patch } : s)) });
    get().persist();
  },
  duplicateSet(setId) {
    const src = get().setDefs.find((s) => s.id === setId);
    if (!src) return;
    const copy: WorkingSet = { ...src, id: `set-${Date.now()}`, name: tr("names.set_copy", { name: src.name }), createdMs: Date.now() };
    set({ setDefs: [...get().setDefs, copy] });
    get().persist();
  },
  removeSet(setId) {
    set({ setDefs: get().setDefs.filter((s) => s.id !== setId), activeSetId: get().activeSetId === setId ? null : get().activeSetId });
    get().persist();
  },
  openSet(setId) {
    set({ activeSetId: setId, trashView: false, selected: [], anchor: null, query: "" });
    syncActiveTab(get, set);
    if (!setId) return;
    const def = get().setDefs.find((s) => s.id === setId);
    if (!def) return;
    set({ setDefs: get().setDefs.map((s) => (s.id === setId ? { ...s, lastUsedMs: Date.now() } : s)) });
    get().persist();
    // Resolve every ref's directory so items show up (and missing ones are provable —
    // "not in a loaded listing" only means "missing" once the listing has loaded).
    if (!def.smart) {
      for (const dir of new Set(def.items.map((i) => i.dir))) void get().loadDir(dir);
    }
    if (def.rule?.roots?.length) void get().scanRuleRoots(def.rule.roots);
  },
  openTrash() {
    const { trashDir } = get();
    set({ trashView: true, path: trashDir, activeSetId: null, selected: [], anchor: null, query: "" });
    syncActiveTab(get, set);
    void get().loadDir(trashDir);
  },
  // Smart sets show rule matches, manual sets show resolved refs, and hybrid sets
  // (a manual set that also has a rule) show the union — manual items first, deduped
  // by path so a hand-picked file the rule also matches appears once.
  setEntriesFor(setDef) {
    const st = get();
    const rule = setDef.rule;
    const ruleMatches: FsEntry[] = rule
      ? Object.entries(st.dirs).flatMap(([dir, entries]) =>
          dir === st.trashDir ? [] : entries.filter((e) => !e.isHidden && entryMatchesRule(e, dir, rule, st.starred)),
        )
      : [];
    if (setDef.smart) return ruleMatches;
    const manual = setDef.items
      .map((ref) => (st.dirs[ref.dir] || []).find((e) => e.name === ref.name))
      .filter((e): e is FsEntry => !!e);
    if (!rule) return manual;
    const seen = new Set(manual.map((e) => e.path));
    return [...manual, ...ruleMatches.filter((e) => !seen.has(e.path))];
  },
  // Splits a set's manual refs into resolved entries, provably missing refs (their dir
  // listing is loaded but the name isn't in it), and pending refs (dir not listed yet).
  setResolutionFor(setDef) {
    const st = get();
    const present: FsEntry[] = [];
    const missing: SetItemRef[] = [];
    const pending: SetItemRef[] = [];
    if (setDef.smart) return { present, missing, pending };
    for (const ref of setDef.items) {
      const listed = st.dirs[ref.dir];
      if (!listed) {
        pending.push(ref);
        continue;
      }
      const entry = listed.find((e) => e.name === ref.name);
      if (entry) present.push(entry);
      else missing.push(ref);
    }
    return { present, missing, pending };
  },
  // Breadth-first walk of a rule's scope roots into the dirs cache, so the rule sees
  // their contents without the user having browsed there. Bounded (dir count and depth)
  // because this is an on-open scan, not a background indexer.
  async scanRuleRoots(roots) {
    const backend = get().backend;
    if (!backend) return;
    const MAX_DIRS = 400;
    const MAX_DEPTH = 5;
    const CONCURRENCY = 8;
    set({ ruleScansActive: get().ruleScansActive + 1 });
    try {
      const seen = new Set<string>();
      let frontier = roots.filter(Boolean);
      let listed = 0;
      for (let depth = 0; depth <= MAX_DEPTH && frontier.length && listed < MAX_DIRS; depth++) {
        const next: string[] = [];
        for (let i = 0; i < frontier.length && listed < MAX_DIRS; i += CONCURRENCY) {
          const batch = frontier
            .slice(i, i + CONCURRENCY)
            .filter((p) => !seen.has(p) && p !== get().trashDir)
            .slice(0, MAX_DIRS - listed);
          if (batch.length === 0) continue;
          batch.forEach((p) => seen.add(p));
          listed += batch.length;
          await Promise.all(batch.map((p) => get().loadDir(p)));
          for (const p of batch) {
            for (const e of get().dirs[p] || []) {
              if (e.isDir && !e.isHidden) next.push(e.path);
            }
          }
        }
        frontier = next;
      }
    } finally {
      set({ ruleScansActive: Math.max(0, get().ruleScansActive - 1) });
    }
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
    // center2 only renders while centerSplit is on, so placing a module there implies the split
    set(toZone === "center2" && !get().centerSplit ? { layout: next, centerSplit: true } : { layout: next });
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
    if (id === "settings") {
      get().openSettings();
      return;
    }
    get().moveModule(id, zone, get().layout[zone].length);
  },
  setRailWidth(side, w) {
    set({ railW: { ...get().railW, [side]: Math.max(200, Math.min(520, w)) } });
    get().persist();
  },
  setModuleWidths(patch) {
    const next = { ...get().moduleWidths };
    (Object.entries(patch) as [ModuleId, number][]).forEach(([id, w]) => {
      next[id] = Math.max(moduleMinWidth(id), Math.round(w));
    });
    set({ moduleWidths: next });
    get().persist();
  },
  resetModuleWidths(ids) {
    const next = { ...get().moduleWidths };
    ids.forEach((id) => delete next[id]);
    set({ moduleWidths: next });
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
    set({ layout: defaultLayout(), centerSplit: false, moduleWidths: {} });
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
      showHidden: st.showHidden,
      sortKey: st.sortKey,
      sortDir: st.sortDir,
      confirmPermanentDelete: st.confirmPermanentDelete,
      confirmTrash: st.confirmTrash,
      confirmWindowMs: st.confirmWindowMs,
      newTabAtHome: st.newTabAtHome,
      startupMode: st.startupMode,
      searchScope: st.searchScope,
      layout: st.layout,
      railW: st.railW,
      moduleWidths: st.moduleWidths,
      centerSplit: st.centerSplit,
      centerRatio: st.centerRatio,
      path2: st.path2,
      modCfg: st.modCfg,
      setDefs: st.setDefs,
      starred: Array.from(st.starred),
      fileEvents: st.fileEvents,
      globalFeed: st.globalFeed,
      trashOrigins: st.trashOrigins,
      trashOriginNames: st.trashOriginNames,
      tabs: st.tabs,
      activeTabId: st.activeTabId,
      remoteConnections: st.remoteConnections,
      aiSelectedModel: st.aiSelectedModel,
      aiSearchEnabled: st.aiSearchEnabled,
      aiRenameEnabled: st.aiRenameEnabled,
      aiSummaryEnabled: st.aiSummaryEnabled,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage unavailable — ignore
    }
  },
}));

// Tabs mirror the live nav fields (path/hist/hi/trashView/activeSetId) for the active
// tab only — call this after any action that mutates those fields directly, so the tab
// bar and tab-switching always see up-to-date state for the tab currently in view.
function syncActiveTab(get: () => AppState, set: (partial: Partial<AppState>) => void) {
  const st = get();
  set({
    tabs: st.tabs.map((tab) =>
      tab.id === st.activeTabId
        ? { ...tab, path: st.path, hist: st.hist, hi: st.hi, trashView: st.trashView, activeSetId: st.activeSetId }
        : tab,
    ),
  });
}

function logEvent(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
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

async function doTrash(get: () => AppState, set: (partial: Partial<AppState>) => void, paths: string[]) {
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
      get().showToast(tr("toast.trash_failed", { error: explainError(e) }));
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

async function doPermanentDelete(get: () => AppState, set: (partial: Partial<AppState>) => void, paths: string[]) {
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
      get().showToast(tr("toast.delete_failed", { error: explainError(e) }));
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

function addGhost(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  dir: string,
  ghost: Ghost,
) {
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

// fileEvents is keyed by a file's current path, so a file's Journey stays a single
// continuous timeline across renames/moves instead of fragmenting into a dead entry
// under the old path and a fresh one under the new path — call this alongside every
// updateSetRefs(...) call that has a real destination (not permanent delete, which
// leaves the entry frozen under its last known path as the file's final record).
function migrateFileEvents(get: () => AppState, set: (partial: Partial<AppState>) => void, fromPath: string, toPath: string) {
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
