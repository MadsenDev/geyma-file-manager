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
}

export interface Ghost {
  name: string;
  fromPath: string;
  toDir: string;
  toName: string;
  atMs: number;
}

export interface SetRule {
  ext?: string;
  kind?: string;
  starred?: boolean;
  minMt?: number;
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
  smart?: boolean;
  rule?: SetRule;
  snap?: EnvironmentSnapshot;
  items: SetItemRef[];
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
