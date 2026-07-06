import { openPath } from "@tauri-apps/plugin-opener";
import { useStore } from "../state/store";

/** Opens a filesystem path through the operating system's default handler. */
export async function openWithDefaultApp(path: string): Promise<void> {
  try {
    await openPath(path);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    useStore.getState().showToast(`Could not open file${detail ? `: ${detail}` : ""}`);
  }
}
