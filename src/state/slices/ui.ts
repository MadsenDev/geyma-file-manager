import type { StateCreator } from "zustand";
import { classifyError } from "../../lib/errors";
import type { GetState, SetState } from "../helpers";
import type { ModuleId } from "../layout";
import type { AppState } from "../store";
import type { ContextMenuState, ToastItem, ToastKind } from "../types";

// Toasts: a small queue instead of a single replaceable string, so an error isn't
// wiped out by the next info toast. Errors linger long enough to read; identical
// messages refresh in place instead of stacking duplicates.
const TOAST_LIMIT = 3;
const TOAST_DURATION_MS: Record<ToastKind, number> = { info: 2600, success: 2600, error: 7000 };
let toastSeq = 0;

function pushToast(set: SetState, get: GetState, input: { kind: ToastKind; message: string; detail?: string }) {
  const duplicate = get().toasts.find(
    (t) => t.kind === input.kind && t.message === input.message && t.detail === input.detail,
  );
  const kept = duplicate ? get().toasts.filter((t) => t.id !== duplicate.id) : get().toasts;
  const id = ++toastSeq;
  set({ toasts: [...kept, { id, ...input }].slice(-TOAST_LIMIT) });
  setTimeout(() => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  }, TOAST_DURATION_MS[input.kind]);
}

export interface UiSlice {
  // ui chrome
  menu: ContextMenuState | null;
  modMenu: { id: ModuleId; x: number; y: number } | null;
  toasts: ToastItem[];

  // settings
  settingsOpen: boolean;
  settingsTab: "appearance" | "confirmations" | "general" | "ai";
  confirmPermanentDelete: boolean;
  confirmTrash: boolean;
  confirmWindowMs: number;
  newTabAtHome: boolean;
  startupMode: "resume" | "home";

  openMenu(state: ContextMenuState): void;
  closeMenu(): void;
  openModMenu(id: ModuleId, x: number, y: number): void;
  closeModMenu(): void;
  openSettings(): void;
  closeSettings(): void;
  setSettingsTab(tab: UiSlice["settingsTab"]): void;
  toggleConfirmPermanentDelete(): void;
  toggleConfirmTrash(): void;
  setConfirmWindowMs(ms: number): void;
  toggleNewTabAtHome(): void;
  setStartupMode(mode: UiSlice["startupMode"]): void;
  showToast(msg: string, kind?: ToastKind): void;
  showError(context: string, raw?: unknown): void;
  dismissToast(id: number): void;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set, get) => ({
  menu: null,
  modMenu: null,
  toasts: [],

  settingsOpen: false,
  settingsTab: "appearance",
  confirmPermanentDelete: true,
  confirmTrash: false,
  confirmWindowMs: 4000,
  newTabAtHome: true,
  startupMode: "resume",

  openMenu(state) {
    set({ menu: state, modMenu: null });
  },
  closeMenu() {
    set({ menu: null });
  },
  openModMenu(id, x, y) {
    set({ modMenu: { id, x, y }, menu: null });
  },
  closeModMenu() {
    set({ modMenu: null });
  },
  openSettings() {
    set({ settingsOpen: true, menu: null, modMenu: null });
  },
  closeSettings() {
    set({ settingsOpen: false });
  },
  setSettingsTab(tab) {
    set({ settingsTab: tab });
  },
  toggleConfirmPermanentDelete() {
    set({ confirmPermanentDelete: !get().confirmPermanentDelete });
    get().persist();
  },
  toggleConfirmTrash() {
    set({ confirmTrash: !get().confirmTrash });
    get().persist();
  },
  setConfirmWindowMs(ms) {
    set({ confirmWindowMs: ms });
    get().persist();
  },
  toggleNewTabAtHome() {
    set({ newTabAtHome: !get().newTabAtHome });
    get().persist();
  },
  setStartupMode(mode) {
    set({ startupMode: mode });
    get().persist();
  },
  showToast(msg, kind = "info") {
    pushToast(set, get, { kind, message: msg });
  },
  // One consistent shape for every failure toast: `context` is the short, translated
  // headline ("Rename failed"), and the classified explanation of `raw` becomes the
  // detail line underneath. Errors stay up longer than info toasts and can be clicked
  // away; Toast.tsx clamps both lines so an unexpected message can't distort the layout.
  showError(context, raw) {
    const err = raw === undefined ? null : classifyError(raw);
    const detail = err && err.message !== context ? err.message : undefined;
    pushToast(set, get, { kind: "error", message: context, detail });
    if (err) console.error(`[geyma] ${context}:`, raw);
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
});
