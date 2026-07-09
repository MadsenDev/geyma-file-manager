import type { ModuleId } from "./layout";

export type ViewMode = "grid" | "list";
export type SortKey = "name" | "kind" | "size" | "modified";
export type SortDir = "asc" | "desc";
export type SearchScope = "folder" | "all";
export type KindFilter = "document" | "image" | "audio" | "code" | null;

export interface Filters {
  kind: KindFilter;
  starred: boolean;
}

export interface FileEvent {
  id: string;
  path: string;
  action: string;
  detail?: string;
  whenMs: number;
  kind: "accent" | "video" | "archive" | "document" | "app" | "muted";
  /** The file's path immediately before this event, for rename/move/trash/restore — lets an
   *  undo-this-event action compute its inverse without parsing the free-text `detail`. */
  prevPath?: string;
}

export interface Ghost {
  name: string;
  fromPath: string;
  toDir: string;
  toName: string;
  atMs: number;
  /** Snapshot of the departed entry, taken from the cached dir listing when the ghost is
   *  created, so the ghost can keep sorting exactly where the file used to sit. */
  isDir?: boolean;
  size?: number;
  modifiedMs?: number;
}

export type SetRuleMatch = "all" | "any";

export interface SetRule {
  /** Comma/space-separated extension list, matched case-insensitively ("pdf, docx"). */
  ext?: string;
  kind?: string;
  starred?: boolean;
  /** Legacy absolute threshold (epoch ms) from older persisted sets — frozen at creation
   *  time. New rules use withinDays, which rolls with the clock. */
  minMt?: number;
  /** Modified within the last N days, evaluated at read time. */
  withinDays?: number;
  nameContains?: string;
  minBytes?: number;
  maxBytes?: number;
  /** "all" (default) = every condition must pass; "any" = at least one. */
  match?: SetRuleMatch;
  /** Folders this rule is scoped to. They're scanned (recursively, bounded) when the set
   *  opens, and matches outside them are excluded. Empty/absent = any browsed folder. */
  roots?: string[];
}

export interface SetItemRef {
  dir: string;
  name: string;
}

export interface EnvironmentSnapshot {
  skin: string;
  ov: Record<string, unknown>;
  layout: Record<ModuleId, never> | unknown;
  railW: { left: number; right: number };
  centerSplit: boolean;
  centerRatio: number;
}

export interface WorkingSet {
  id: string;
  name: string;
  note?: string;
  /** Rule-only set: items are ignored and refs aren't maintained by updateSetRefs.
   *  A non-smart set with a rule is a hybrid — it shows items ∪ rule matches. */
  smart?: boolean;
  rule?: SetRule;
  snap?: EnvironmentSnapshot;
  items: SetItemRef[];
  /** Accent color (hex) shown in the Sets sidebar; also tints the set icon. */
  color?: string;
  /** ICONS key overriding the default folder/lightning glyph. */
  icon?: string;
  pinned?: boolean;
  archived?: boolean;
  createdMs?: number;
  lastUsedMs?: number;
}

export interface Workspace {
  id: string;
  name: string;
  snap: EnvironmentSnapshot;
}

export interface ClipboardState {
  mode: "cut" | "copy";
  items: string[];
}

export interface ContextMenuItem {
  label?: string;
  divider?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export interface PreviewState {
  path: string;
  origin?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface UndoAction {
  label: string;
  undo: () => Promise<void> | void;
}

export interface TabState {
  id: string;
  path: string;
  hist: string[];
  hi: number;
  trashView: boolean;
  activeSetId: string | null;
}

export interface RemoteConnection {
  id: string;
  protocol: "sftp" | "smb";
  label: string;
  host: string;
  port: number;
  username: string;
  /** SMB only. */
  share?: string;
  /** Whether the password is (or should be) saved in the OS keyring, keyed by `id`. */
  savePassword: boolean;
}

export type RemoteStatus = "disconnected" | "connecting" | "connected" | "error";

/** Per-module option bag (see `modCfg`/`mcfg` in the store). */
export interface ModOptionValue {
  [key: string]: string | number | boolean;
}

export type ToastKind = "info" | "success" | "error";

/** One entry in the toast queue. `message` is the headline; `detail` is the optional
 * classified explanation rendered underneath (see `showError` in store.ts). */
export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
}
