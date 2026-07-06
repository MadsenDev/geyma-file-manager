import type { ModuleId } from "../state/layout";

export type ModuleOption =
  | { key: string; type: "toggle"; label: string; defaultValue: boolean }
  | { key: string; type: "segment"; label: string; defaultValue: string | number; options: { value: string | number; label: string }[] };

/** Module options from the authoritative design handoff. */
export const MODULE_OPTIONS: Partial<Record<ModuleId, ModuleOption[]>> = {
  title: [
    { key: "kicker", type: "toggle", label: "Show path", defaultValue: true },
    { key: "summary", type: "toggle", label: "Show summary line", defaultValue: true },
  ],
  files: [
    {
      key: "view",
      type: "segment",
      label: "Default view",
      defaultValue: "follow",
      options: [
        { value: "follow", label: "Follow toolbar" },
        { value: "grid", label: "Grid" },
        { value: "list", label: "List" },
      ],
    },
  ],
  clock: [
    { key: "h24", type: "toggle", label: "24-hour time", defaultValue: false },
    { key: "seconds", type: "toggle", label: "Show seconds", defaultValue: false },
    { key: "date", type: "toggle", label: "Show date", defaultValue: true },
  ],
  recent: [
    {
      key: "count",
      type: "segment",
      label: "Items shown",
      defaultValue: 6,
      options: [
        { value: 3, label: "3" },
        { value: 6, label: "6" },
        { value: 10, label: "10" },
      ],
    },
  ],
  places: [{ key: "showTrash", type: "toggle", label: "Show Trash entry", defaultValue: true }],
  viewswitch: [
    { key: "chrome", type: "toggle", label: "Appearance & Edit buttons", defaultValue: true },
    { key: "sort", type: "toggle", label: "Sort controls", defaultValue: true },
    { key: "hidden", type: "toggle", label: "Hidden-files button", defaultValue: true },
  ],
  visualizer: [
    {
      key: "bars",
      type: "segment",
      label: "Bar count",
      defaultValue: 18,
      options: [
        { value: 8, label: "8" },
        { value: 14, label: "14" },
        { value: 18, label: "18" },
      ],
    },
  ],
  details: [
    { key: "preview", type: "toggle", label: "Content preview", defaultValue: true },
    { key: "memory", type: "toggle", label: "Memory & story", defaultValue: true },
    { key: "activity", type: "toggle", label: "Show activity timeline", defaultValue: true },
  ],
};
