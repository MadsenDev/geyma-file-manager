import type { StateCreator } from "zustand";
import type { FsEntry } from "../../fs/types";
import type { AppState } from "../store";
import type { Filters, PreviewState, SearchScope, SortDir, SortKey, ViewMode } from "../types";

export interface ViewSlice {
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

  showHidden: boolean;

  // quick look
  preview: PreviewState | null;

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
  setSearchAllResults(results: FsEntry[] | null): void;
  toggleKindFilter(k: Filters["kind"]): void;
  toggleStarredFilter(): void;
  toggleShowHidden(): void;

  toggleStar(paths: string[]): void;

  openPreview(path: string, origin?: PreviewState["origin"]): void;
  closePreview(): void;
  stepPreview(dir: 1 | -1): void;
}

export const createViewSlice: StateCreator<AppState, [], [], ViewSlice> = (set, get) => ({
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

  showHidden: false,

  preview: null,

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
  setSearchAllResults(results) {
    set({ searchAllResults: results });
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
});
