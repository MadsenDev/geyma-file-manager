import type { ModuleId } from "../state/layout";
import { tr } from "@/i18n";

export type ModuleOption =
  | { key: string; type: "toggle"; label: string; defaultValue: boolean }
  | { key: string; type: "segment"; label: string; defaultValue: string | number; options: { value: string | number; label: string }[] };

/** Module options from the authoritative design handoff. */
export const MODULE_OPTIONS: Partial<Record<ModuleId, ModuleOption[]>> = {
  title: [
    { key: "kicker", type: "toggle", label: tr("options.title_kicker"), defaultValue: true },
    { key: "summary", type: "toggle", label: tr("options.title_summary"), defaultValue: true },
  ],
  files: [
    {
      key: "view",
      type: "segment",
      label: tr("options.files_view"),
      defaultValue: "follow",
      options: [
        { value: "follow", label: tr("options.files_view_follow") },
        { value: "grid", label: tr("options.files_view_grid") },
        { value: "list", label: tr("options.files_view_list") },
      ],
    },
  ],
  clock: [
    { key: "h24", type: "toggle", label: tr("options.clock_h24"), defaultValue: false },
    { key: "seconds", type: "toggle", label: tr("options.clock_seconds"), defaultValue: false },
    { key: "date", type: "toggle", label: tr("options.clock_date"), defaultValue: true },
  ],
  recent: [
    {
      key: "count",
      type: "segment",
      label: tr("options.recent_count"),
      defaultValue: 6,
      options: [
        { value: 3, label: "3" },
        { value: 6, label: "6" },
        { value: 10, label: "10" },
      ],
    },
  ],
  places: [{ key: "showTrash", type: "toggle", label: tr("options.places_show_trash"), defaultValue: true }],
  viewswitch: [
    { key: "chrome", type: "toggle", label: tr("options.viewswitch_chrome"), defaultValue: true },
    { key: "sort", type: "toggle", label: tr("options.viewswitch_sort"), defaultValue: true },
    { key: "hidden", type: "toggle", label: tr("options.viewswitch_hidden"), defaultValue: true },
  ],
  visualizer: [
    {
      key: "bars",
      type: "segment",
      label: tr("options.visualizer_bars"),
      defaultValue: 18,
      options: [
        { value: 8, label: "8" },
        { value: 14, label: "14" },
        { value: 18, label: "18" },
      ],
    },
  ],
  details: [
    { key: "preview", type: "toggle", label: tr("options.details_preview"), defaultValue: true },
    { key: "memory", type: "toggle", label: tr("options.details_memory"), defaultValue: true },
    { key: "activity", type: "toggle", label: tr("options.details_activity"), defaultValue: true },
  ],
};
