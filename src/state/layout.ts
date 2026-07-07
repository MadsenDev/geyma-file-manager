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
  tabs: "Tabs",
  nav: "Navigation",
  location: "Location bar",
  search: "Search",
  viewswitch: "View & sort",
  title: "Folder title",
  files: "Files",
  files2: "Second pane",
  details: "Details",
  settings: "Settings",
  places: "Places",
  devices: "Devices",
  network: "Network",
  sets: "Working Sets",
  disk: "Disk usage",
  recent: "Recent activity",
  timeline: "Timeline",
  dupes: "Duplicates",
  clock: "Clock",
  visualizer: "Visualizer",
  mood: "Folder mood",
  status: "Status bar",
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
  { id: "classic", name: "Classic", layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: ["places", "devices", "sets", "disk"], center: ["title", "files"], right: ["details"], bottom: ["status"] } },
  { id: "focus", name: "Focus", layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: [], center: ["title", "files"], right: [], bottom: ["status"] } },
  { id: "minimal", name: "Minimal", layout: { top: ["location", "search"], left: [], center: ["files"], right: [], bottom: [] } },
  { id: "commander", name: "Commander", layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: ["places", "devices", "sets"], center: ["files"], right: ["details"], bottom: ["status"] } },
  { id: "righthand", name: "Right rail", layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: [], center: ["title", "files"], right: ["places", "devices", "details"], bottom: ["status"] } },
  { id: "dashboard", name: "Dashboard", layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: ["places", "clock", "recent", "visualizer"], center: ["title", "files"], right: ["details", "disk"], bottom: ["status"] } },
  { id: "bottombar", name: "Bottom dock", layout: { top: ["title"], left: ["places", "devices", "sets"], center: ["files"], right: ["details"], bottom: ["tabs", "nav", "location", "search", "viewswitch"] } },
  { id: "stack", name: "Stacked", layout: { top: ["tabs", "nav", "location", "search", "viewswitch"], left: [], center: ["title", "files", "details"], right: [], bottom: ["status"] } },
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
