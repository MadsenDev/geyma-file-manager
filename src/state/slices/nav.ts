import type { StateCreator } from "zustand";
import { syncActiveTab } from "../helpers";
import type { AppState } from "../store";
import type { TabState } from "../types";

export interface NavSlice {
  // navigation
  path: string;
  hist: string[];
  hi: number;
  path2: string;

  // tabs
  tabs: TabState[];
  activeTabId: string;

  // trash
  trashView: boolean;
  trashDir: string;

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
  openTrash(): void;

  newTab(path?: string): void;
  switchTab(id: string): void;
  closeTab(id: string): void;
  closeOtherTabs(id: string): void;
  closeTabsToRight(id: string): void;
  duplicateTab(id: string): void;
  reorderTab(id: string, toIndex: number): void;
  cycleTab(dir: 1 | -1): void;
  goToTabIndex(index: number): void;
}

export const createNavSlice: StateCreator<AppState, [], [], NavSlice> = (set, get) => ({
  path: "/home",
  hist: ["/home"],
  hi: 0,
  path2: "/home",

  tabs: [{ id: "tab-1", path: "/home", hist: ["/home"], hi: 0, trashView: false, activeSetId: null }],
  activeTabId: "tab-1",

  trashView: false,
  trashDir: "/trash",

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
  openTrash() {
    const { trashDir } = get();
    set({ trashView: true, path: trashDir, activeSetId: null, selected: [], anchor: null, query: "" });
    syncActiveTab(get, set);
    void get().loadDir(trashDir);
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
});
