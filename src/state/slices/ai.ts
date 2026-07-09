import type { StateCreator } from "zustand";
import { tr } from "@/i18n";
import { aiDeleteModel, aiListModels, aiStartServer, aiStatus, aiStopServer, type AiModel } from "../../ai/ollama";
import type { AppState } from "../store";

// Local AI (Ollama) — status/models reflect the real daemon, refreshed on demand;
// the three "enabled" flags are the per-capability opt-ins each feature checks.
export interface AiSlice {
  aiInstalled: boolean;
  aiRunning: boolean;
  aiModels: AiModel[];
  aiSelectedModel: string;
  aiSearchEnabled: boolean;
  aiRenameEnabled: boolean;
  aiSummaryEnabled: boolean;

  refreshAiStatus(): Promise<void>;
  startAiServer(): Promise<void>;
  stopAiServer(): Promise<void>;
  deleteAiModel(name: string): Promise<void>;
  setAiSelectedModel(name: string): void;
  toggleAiSearchEnabled(): void;
  toggleAiRenameEnabled(): void;
  toggleAiSummaryEnabled(): void;
}

export const createAiSlice: StateCreator<AppState, [], [], AiSlice> = (set, get) => ({
  aiInstalled: false,
  aiRunning: false,
  aiModels: [],
  aiSelectedModel: "",
  aiSearchEnabled: false,
  aiRenameEnabled: false,
  aiSummaryEnabled: false,

  async refreshAiStatus() {
    const status = await aiStatus();
    const models = status.running ? await aiListModels().catch(() => []) : [];
    const { aiSelectedModel } = get();
    set({
      aiInstalled: status.installed,
      aiRunning: status.running,
      aiModels: models,
      aiSelectedModel: aiSelectedModel || models[0]?.name || "",
    });
  },
  async startAiServer() {
    try {
      await aiStartServer();
      await get().refreshAiStatus();
    } catch (e) {
      get().showError(tr("toast.ollama_start_failed"), e);
    }
  },
  async stopAiServer() {
    try {
      await aiStopServer();
    } catch (e) {
      get().showError(tr("toast.ollama_stop_failed"), e);
    }
    await get().refreshAiStatus();
  },
  async deleteAiModel(name) {
    try {
      await aiDeleteModel(name);
      await get().refreshAiStatus();
    } catch (e) {
      get().showError(tr("toast.ollama_delete_model_failed"), e);
    }
  },
  setAiSelectedModel(name) {
    set({ aiSelectedModel: name });
    get().persist();
  },
  toggleAiSearchEnabled() {
    set({ aiSearchEnabled: !get().aiSearchEnabled });
    get().persist();
  },
  toggleAiRenameEnabled() {
    set({ aiRenameEnabled: !get().aiRenameEnabled });
    get().persist();
  },
  toggleAiSummaryEnabled() {
    set({ aiSummaryEnabled: !get().aiSummaryEnabled });
    get().persist();
  },
});
