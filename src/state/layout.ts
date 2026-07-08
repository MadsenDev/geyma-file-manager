import { tr } from "@/i18n";

export type ModuleId =
  | "tabs"
  | "nav"
  | "location"
  | "search"
  | "viewswitch"
  | "title"
  | "files"
  | "files2"
  | "details"
  | "settings"
  | "places"
  | "devices"
  | "network"
  | "sets"
  | "disk"
  | "recent"
  | "timeline"
  | "dupes"
  | "clock"
  | "visualizer"
  | "mood"
  | "status";

export type ZoneId = "top" | "left" | "center" | "center2" | "right" | "bottom";

export type Layout = Record<ZoneId, ModuleId[]>;

export const ZONE_IDS: ZoneId[] = ["top", "left", "center", "center2", "right", "bottom"];

export const ALL_MODULES: ModuleId[] = [
  "tabs", "nav", "location", "search", "viewswitch", "title", "files", "files2", "details",
  "places", "devices", "network", "sets", "disk", "recent", "timeline", "dupes",
  "clock", "visualizer", "mood", "status",
];

export const MODULE_NAMES: Record<ModuleId, string> = {
  tabs: tr("modules.tabs"),
  nav: tr("modules.nav"),
  location: tr("modules.location"),
  search: tr("modules.search"),
  viewswitch: tr("modules.viewswitch"),
  title: tr("modules.title"),
  files: tr("modules.files"),
  files2: tr("modules.files2"),
  details: tr("modules.details"),
  settings: tr("modules.settings"),
  places: tr("modules.places"),
  devices: tr("modules.devices"),
  network: tr("modules.network"),
  sets: tr("modules.sets"),
  disk: tr("modules.disk"),
  recent: tr("modules.recent"),
  timeline: tr("modules.timeline"),
  dupes: tr("modules.dupes"),
  clock: tr("modules.clock"),
  visualizer: tr("modules.visualizer"),
  mood: tr("modules.mood"),
  status: tr("modules.status"),
};

export function defaultLayout(): Layout {
  return {
    top: ["tabs", "nav", "location", "search", "viewswitch"],
    left: ["places", "devices", "network", "sets", "disk"],
    center: ["title", "files"],
    center2: [],
    right: ["details"],
    bottom: ["status"],
  };
}

export interface LayoutPreset {
  id: string;
  name: string;
  layout: Partial<Layout>;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: "classic", name: tr("presets.classic"), layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: ["places", "devices", "sets", "disk"], center: ["title", "files"], right: ["details"], bottom: ["status"] } },
  { id: "focus", name: tr("presets.focus"), layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: [], center: ["title", "files"], right: [], bottom: ["status"] } },
  { id: "minimal", name: tr("presets.minimal"), layout: { top: ["location", "search"], left: [], center: ["files"], right: [], bottom: [] } },
  { id: "commander", name: tr("presets.commander"), layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: ["places", "devices", "sets"], center: ["files"], right: ["details"], bottom: ["status"] } },
  { id: "righthand", name: tr("presets.righthand"), layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: [], center: ["title", "files"], right: ["places", "devices", "details"], bottom: ["status"] } },
  { id: "dashboard", name: tr("presets.dashboard"), layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: ["places", "clock", "recent", "visualizer"], center: ["title", "files"], right: ["details", "disk"], bottom: ["status"] } },
  { id: "bottombar", name: tr("presets.bottombar"), layout: { top: ["title"], left: ["places", "devices", "sets"], center: ["files"], right: ["details"], bottom: ["tabs", "nav", "location", "search", "viewswitch"] } },
  { id: "stack", name: tr("presets.stack"), layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: [], center: ["title", "files", "details"], right: [], bottom: ["status"] } },
];

export function mergeLayout(saved: Partial<Layout> | undefined | null): Layout {
  const base: Layout = { top: [], left: [], center: [], center2: [], right: [], bottom: [] };
  if (!saved) return base;
  const seen = new Set<ModuleId>();
  (Object.keys(base) as ZoneId[]).forEach((z) => {
    const list = saved[z];
    if (Array.isArray(list)) {
      list.forEach((id) => {
        if (ALL_MODULES.includes(id) && !seen.has(id)) {
          seen.add(id);
          base[z].push(id);
        }
      });
    }
  });
  return base;
}

export function layoutSignature(l: Layout): string {
  return ZONE_IDS.map((z) => (l[z] || []).join(",")).join("|");
}

const PANEL_MODULES: ModuleId[] = ["places", "devices", "network", "sets", "disk", "recent", "timeline", "dupes", "clock", "visualizer", "mood", "details"];
const STRETCH_MODULES: ModuleId[] = ["files", "files2", "details"];

export function isPanelModule(id: ModuleId): boolean {
  return PANEL_MODULES.includes(id);
}

export function isStretchModule(id: ModuleId): boolean {
  return STRETCH_MODULES.includes(id);
}

// Floor for user-dragged module widths in horizontal zones (top/bottom). Matches the
// minWidth each module's default sizing in ModuleShell already assumes it needs.
const MODULE_MIN_WIDTHS: Partial<Record<ModuleId, number>> = {
  nav: 112,
  location: 180,
  search: 220,
  viewswitch: 160,
  tabs: 180,
};

export function moduleMinWidth(id: ModuleId): number {
  return MODULE_MIN_WIDTHS[id] ?? 64;
}
