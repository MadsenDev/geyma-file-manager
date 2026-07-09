// The single Zustand store driving the whole app — by design there is one `useStore`
// and no separate service/controller layer (modules call store actions directly).
// The implementation is split into domain slices under ./slices; they all share this
// one flat AppState, so cross-domain actions (init, goPath clearing selection, ...)
// can still set any field. Cross-slice helper functions live in ./helpers, the
// localStorage schema in ./persistence.
import { create } from "zustand";
import { createAiSlice, type AiSlice } from "./slices/ai";
import { createAppearanceSlice, type AppearanceSlice } from "./slices/appearance";
import { createCoreSlice, type CoreSlice } from "./slices/core";
import { createFileOpsSlice, type FileOpsSlice } from "./slices/fileOps";
import { createJournalSlice, type JournalSlice } from "./slices/journal";
import { createNavSlice, type NavSlice } from "./slices/nav";
import { createRemoteSlice, type RemoteSlice } from "./slices/remote";
import { createSetsSlice, type SetsSlice } from "./slices/sets";
import { createTrashSlice, type TrashSlice } from "./slices/trash";
import { createUiSlice, type UiSlice } from "./slices/ui";
import { createViewSlice, type ViewSlice } from "./slices/view";

export type AppState = CoreSlice &
  NavSlice &
  ViewSlice &
  FileOpsSlice &
  TrashSlice &
  JournalSlice &
  SetsSlice &
  RemoteSlice &
  AiSlice &
  UiSlice &
  AppearanceSlice;

export const useStore = create<AppState>()((...a) => ({
  ...createCoreSlice(...a),
  ...createNavSlice(...a),
  ...createViewSlice(...a),
  ...createFileOpsSlice(...a),
  ...createTrashSlice(...a),
  ...createJournalSlice(...a),
  ...createSetsSlice(...a),
  ...createRemoteSlice(...a),
  ...createAiSlice(...a),
  ...createUiSlice(...a),
  ...createAppearanceSlice(...a),
}));

export { compareEntries } from "./helpers";
export { smbDeviceKey, type SmbShareListing } from "./slices/remote";
