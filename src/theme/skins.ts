export type SkinMode = "light" | "dark";
export type TileStyle = "flat" | "card";
export type BackgroundPattern = "none" | "dots" | "grid";
export type FontKey = "grotesk" | "serif" | "mono" | "system";

export interface Skin {
  name: string;
  mode: SkinMode;
  tag: string;
  bg: string;
  surface: string;
  main: string;
  card: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  border: string;
  accent: string;
  font: FontKey;
  radius: number;
  tile: TileStyle;
  iconMono: boolean;
  pattern: BackgroundPattern;
}

export interface SkinOverrides {
  accent?: string;
  fontKey?: FontKey;
  radius?: number;
  tile?: TileStyle;
  iconMono?: boolean;
  bg?: BackgroundPattern;
}

export interface ResolvedTheme {
  name: string;
  mode: SkinMode;
  tag: string;
  isDark: boolean;
  bg: string;
  surface: string;
  main: string;
  card: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  border: string;
  accent: string;
  radius: number;
  tile: TileStyle;
  iconMono: boolean;
  backdrop: BackgroundPattern;
  body: string;
  mono: string;
  fontKey: FontKey;
}

export const FONTS: Record<FontKey, string> = {
  grotesk: "'Hanken Grotesk',system-ui,sans-serif",
  serif: "'Spectral',Georgia,serif",
  mono: "'JetBrains Mono',ui-monospace,monospace",
  system: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
};

export const FONT_LABELS: { v: FontKey; l: string }[] = [
  { v: "grotesk", l: "Grotesk" },
  { v: "serif", l: "Serif" },
  { v: "mono", l: "Mono" },
  { v: "system", l: "System" },
];

export const SKINS: Record<string, Skin> = {
  parchment: { name: "Parchment", mode: "light", tag: "THE KEEPER", bg: "#EFE9DE", surface: "#E7E0D2", main: "#F3EEE4", card: "#FBF8F2", ink: "#211D17", inkSoft: "#5F5849", inkFaint: "#7E7359", border: "rgba(33,29,23,.10)", accent: "#2C6E49", font: "grotesk", radius: 14, tile: "flat", iconMono: false, pattern: "none" },
  obsidian: { name: "Obsidian", mode: "dark", tag: "MIDNIGHT", bg: "#0B0D10", surface: "#101318", main: "#0E1114", card: "#171B21", ink: "#E8ECF1", inkSoft: "#9AA4B0", inkFaint: "#5C6672", border: "rgba(255,255,255,.09)", accent: "#35D0C0", font: "grotesk", radius: 14, tile: "card", iconMono: false, pattern: "none" },
  phosphor: { name: "Phosphor", mode: "dark", tag: "TERMINAL", bg: "#050A06", surface: "#08110A", main: "#060D08", card: "#0C160E", ink: "#8CF5A6", inkSoft: "#4A9E63", inkFaint: "#2E6440", border: "rgba(56,229,106,.16)", accent: "#38E56A", font: "mono", radius: 2, tile: "flat", iconMono: true, pattern: "grid" },
  nord: { name: "Nord", mode: "dark", tag: "FROST", bg: "#2E3440", surface: "#2B303B", main: "#333A47", card: "#3B4252", ink: "#ECEFF4", inkSoft: "#AEB6C6", inkFaint: "#6D7488", border: "rgba(236,239,244,.10)", accent: "#88C0D0", font: "grotesk", radius: 10, tile: "card", iconMono: false, pattern: "none" },
  amber: { name: "Amber CRT", mode: "dark", tag: "PHOSPHOR", bg: "#140F08", surface: "#1A130A", main: "#120D06", card: "#20180F", ink: "#F5C877", inkSoft: "#B0812F", inkFaint: "#9A7B36", border: "rgba(255,178,62,.16)", accent: "#FFB23E", font: "mono", radius: 4, tile: "flat", iconMono: true, pattern: "grid" },
  plasma: { name: "Plasma", mode: "light", tag: "BREEZE", bg: "#EEF1F6", surface: "#E5EAF3", main: "#F5F7FB", card: "#FFFFFF", ink: "#1D2733", inkSoft: "#566072", inkFaint: "#98A2B3", border: "rgba(29,39,51,.11)", accent: "#2C7DD6", font: "system", radius: 8, tile: "card", iconMono: false, pattern: "none" },
  synthwave: { name: "Synthwave", mode: "dark", tag: "OUTRUN", bg: "#17091F", surface: "#1F0C2B", main: "#1A0A23", card: "#2A1139", ink: "#F6E7FF", inkSoft: "#BC93D8", inkFaint: "#7C5C97", border: "rgba(255,79,163,.18)", accent: "#FF4FA3", font: "grotesk", radius: 12, tile: "card", iconMono: false, pattern: "dots" },
  paper: { name: "Paper", mode: "light", tag: "MINIMAL", bg: "#FFFFFF", surface: "#FAFAF9", main: "#FFFFFF", card: "#FFFFFF", ink: "#141414", inkSoft: "#5F5F5F", inkFaint: "#ADADAD", border: "rgba(0,0,0,.11)", accent: "#141414", font: "serif", radius: 5, tile: "flat", iconMono: true, pattern: "none" },
};

export const SKIN_ORDER = ["parchment", "obsidian", "phosphor", "nord", "amber", "plasma", "synthwave", "paper"];

export const ACCENTS = ["#2C6E49", "#2C7DD6", "#B4562E", "#7A4B8C", "#C6427A", "#D89B2B", "#35D0C0", "#E4572E"];

export const DUPE_BADGE = "#D9773F";

export const KIND_COLORS: Record<string, string> = {
  folder: "#7A7264",
  document: "#E4572E",
  text: "#8A8172",
  code: "#17A398",
  image: "#9B6DE0",
  video: "#3B82C4",
  audio: "#D6559A",
  archive: "#D19A3A",
  app: "#5CA95A",
};

export const KIND_LABELS: Record<string, string> = {
  folder: "Folder",
  document: "Document",
  text: "Text",
  code: "Code",
  image: "Image",
  video: "Video",
  audio: "Audio",
  archive: "Archive",
  app: "Application",
};

export function toRgb(hex: string): [number, number, number] {
  const h = (hex || "#000000").replace("#", "");
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

export function hexA(hex: string, a: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mix(hex: string, hex2: string, t: number): string {
  const a = toRgb(hex);
  const b = toRgb(hex2);
  const m = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

export function lighten(hex: string, t: number): string {
  return mix(hex, "#ffffff", t);
}

export function shade(hex: string, t: number): string {
  return mix(hex, "#000000", t);
}

export function isLightAccent(hex: string): boolean {
  const [r, g, b] = toRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export function resolveTheme(skinId: string, ov: SkinOverrides): ResolvedTheme {
  const base = SKINS[skinId] || SKINS.parchment;
  const accent = ov.accent || base.accent;
  const fontKey = ov.fontKey || base.font;
  const radius = ov.radius != null ? ov.radius : base.radius;
  const tile = ov.tile || base.tile;
  const iconMono = ov.iconMono != null ? ov.iconMono : base.iconMono;
  const backdrop = ov.bg || base.pattern || "none";
  return {
    name: base.name,
    mode: base.mode,
    tag: base.tag,
    isDark: base.mode === "dark",
    bg: base.bg,
    surface: base.surface,
    main: base.main,
    card: base.card,
    ink: base.ink,
    inkSoft: base.inkSoft,
    inkFaint: base.inkFaint,
    border: base.border,
    accent,
    radius,
    tile,
    iconMono,
    backdrop,
    body: FONTS[fontKey],
    mono: FONTS.mono,
    fontKey,
  };
}

export function itemColors(kind: string, t: ResolvedTheme): { tint: string; bg: string } {
  const isFolder = kind === "folder";
  if (t.iconMono) {
    return { tint: isFolder ? t.ink : t.inkSoft, bg: hexA(t.ink, t.isDark ? 0.12 : 0.07) };
  }
  if (isFolder) {
    return { tint: t.accent, bg: hexA(t.accent, t.isDark ? 0.2 : 0.14) };
  }
  const c = KIND_COLORS[kind] || "#8A8172";
  return { tint: t.isDark ? lighten(c, 0.28) : c, bg: hexA(c, t.isDark ? 0.2 : 0.13) };
}
