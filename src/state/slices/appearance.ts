import type { StateCreator } from "zustand";
import type { SkinOverrides } from "../../theme/skins";
import {
  defaultLayout,
  mergeLayout,
  moduleMinWidth,
  type Layout,
  type ModuleId,
  type ZoneId,
} from "../layout";
import type { AppState } from "../store";
import type { ModOptionValue } from "../types";

export interface AppearanceSlice {
  // appearance
  skin: string;
  ov: SkinOverrides;
  motion: "full" | "subtle" | "off";
  glow: boolean;
  apTab: "skins" | "style" | "layout";

  // layout
  layout: Layout;
  editMode: boolean;
  railW: { left: number; right: number };
  moduleWidths: Partial<Record<ModuleId, number>>;
  centerSplit: boolean;
  centerRatio: number;
  modCfg: Record<string, ModOptionValue>;

  setSkin(skin: string): void;
  setOverride(patch: SkinOverrides): void;
  resetOverrides(): void;
  setMotion(m: AppearanceSlice["motion"]): void;
  toggleGlow(): void;
  setApTab(tab: AppearanceSlice["apTab"]): void;

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
}

export const createAppearanceSlice: StateCreator<AppState, [], [], AppearanceSlice> = (set, get) => ({
  skin: "parchment",
  ov: {},
  motion: "full",
  glow: true,
  apTab: "skins",

  layout: defaultLayout(),
  editMode: false,
  railW: { left: 270, right: 340 },
  moduleWidths: {},
  centerSplit: false,
  centerRatio: 0.6,
  modCfg: {},

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
  setApTab(tab) {
    set({ apTab: tab });
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
});
