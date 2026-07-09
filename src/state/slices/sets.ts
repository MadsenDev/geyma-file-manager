import type { StateCreator } from "zustand";
import { tr } from "@/i18n";
import type { FsEntry } from "../../fs/types";
import { extOf, kindOf } from "../../lib/format";
import { buildGysetPayload, encodeGysetFile, parseGysetText } from "../../lib/gyset";
import { syncActiveTab, uniqueNameFor } from "../helpers";
import type { AppState } from "../store";
import type { SetItemRef, SetRule, WorkingSet } from "../types";

export function seedSets(): WorkingSet[] {
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

export interface SetsSlice {
  setDefs: WorkingSet[];
  activeSetId: string | null;
  /** Count of in-flight rule-root scans, so the UI can show a "scanning" hint. */
  ruleScansActive: number;

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
  setEntriesFor(set: WorkingSet): FsEntry[];
  setResolutionFor(set: WorkingSet): { present: FsEntry[]; missing: SetItemRef[]; pending: SetItemRef[] };
  scanRuleRoots(roots: string[]): Promise<void>;
}

export const createSetsSlice: StateCreator<AppState, [], [], SetsSlice> = (set, get) => ({
  setDefs: seedSets(),
  activeSetId: null,
  ruleScansActive: 0,

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
      get().showToast(tr("toast.set_exported", { name: fileName }), "success");
    } catch (e) {
      get().showError(tr("toast.export_failed"), e);
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
});
