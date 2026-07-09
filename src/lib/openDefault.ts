import { openPath } from "@tauri-apps/plugin-opener";
import { tr } from "@/i18n";
import { useStore } from "../state/store";

/** Opens a filesystem path through the operating system's default handler. */
export async function openWithDefaultApp(path: string): Promise<void> {
  try {
    await openPath(path);
  } catch (error) {
    useStore.getState().showError(tr("toast.open_failed"), error);
  }
}
