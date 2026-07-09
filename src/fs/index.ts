import type { FsBackend } from "./types";

export * from "./types";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let backendPromise: Promise<FsBackend> | null = null;

export function getFsBackend(): Promise<FsBackend> {
  if (!backendPromise) {
    // Both backends load on demand: inside Tauri the mock (demo tree and all)
    // never ships in the executed bundle, and in a plain browser the Tauri IPC
    // glue never loads.
    backendPromise = isTauri()
      ? import("./tauriBackend").then((m) => m.tauriBackend)
      : import("./mockBackend").then((m) => m.mockBackend);
  }
  return backendPromise;
}
