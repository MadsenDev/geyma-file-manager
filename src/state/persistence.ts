import type { SkinOverrides } from "../theme/skins";
import type { Layout, ModuleId } from "./layout";
import type {
  FileEvent,
  ModOptionValue,
  RemoteConnection,
  SearchScope,
  SortDir,
  SortKey,
  TabState,
  ViewMode,
  WorkingSet,
} from "./types";
import type { AppState } from "./store";

export const STORAGE_KEY = "geyma-v1";

export interface PersistedShape {
  skin?: string;
  ov?: SkinOverrides;
  motion?: "full" | "subtle" | "off";
  glow?: boolean;
  view?: ViewMode;
  columns?: string[];
  showStatus?: boolean;
  layout?: Layout;
  railW?: { left: number; right: number };
  moduleWidths?: Partial<Record<ModuleId, number>>;
  centerSplit?: boolean;
  centerRatio?: number;
  path2?: string;
  modCfg?: Record<string, ModOptionValue>;
  setDefs?: WorkingSet[];
  starred?: string[];
  fileEvents?: Record<string, FileEvent[]>;
  globalFeed?: FileEvent[];
  trashOrigins?: Record<string, string>;
  trashOriginNames?: Record<string, string>;
  tabs?: TabState[];
  activeTabId?: string;
  remoteConnections?: RemoteConnection[];
  aiSelectedModel?: string;
  aiSearchEnabled?: boolean;
  aiRenameEnabled?: boolean;
  aiSummaryEnabled?: boolean;
  showHidden?: boolean;
  sortKey?: SortKey;
  sortDir?: SortDir;
  confirmPermanentDelete?: boolean;
  confirmTrash?: boolean;
  confirmWindowMs?: number;
  newTabAtHome?: boolean;
  startupMode?: "resume" | "home";
  searchScope?: SearchScope;
}

export function loadPersisted(): PersistedShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function buildPersistPayload(st: AppState): PersistedShape {
  return {
    skin: st.skin,
    ov: st.ov,
    motion: st.motion,
    glow: st.glow,
    view: st.view,
    columns: st.columns,
    showHidden: st.showHidden,
    sortKey: st.sortKey,
    sortDir: st.sortDir,
    confirmPermanentDelete: st.confirmPermanentDelete,
    confirmTrash: st.confirmTrash,
    confirmWindowMs: st.confirmWindowMs,
    newTabAtHome: st.newTabAtHome,
    startupMode: st.startupMode,
    searchScope: st.searchScope,
    layout: st.layout,
    railW: st.railW,
    moduleWidths: st.moduleWidths,
    centerSplit: st.centerSplit,
    centerRatio: st.centerRatio,
    path2: st.path2,
    modCfg: st.modCfg,
    setDefs: st.setDefs,
    starred: Array.from(st.starred),
    fileEvents: st.fileEvents,
    globalFeed: st.globalFeed,
    trashOrigins: st.trashOrigins,
    trashOriginNames: st.trashOriginNames,
    tabs: st.tabs,
    activeTabId: st.activeTabId,
    remoteConnections: st.remoteConnections,
    aiSelectedModel: st.aiSelectedModel,
    aiSearchEnabled: st.aiSearchEnabled,
    aiRenameEnabled: st.aiRenameEnabled,
    aiSummaryEnabled: st.aiSummaryEnabled,
  };
}
