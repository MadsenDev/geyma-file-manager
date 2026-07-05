import type { FsBackend } from "./types";
import { mockBackend } from "./mockBackend";

export * from "./types";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let backendPromise: Promise<FsBackend> | null = null;

export function getFsBackend(): Promise<FsBackend> {
  if (!backendPromise) {
    backendPromise = isTauri()
      ? import("./tauriBackend").then((m) => m.tauriBackend)
      : Promise.resolve(mockBackend);
  }
  return backendPromise;
}
