import { getFsBackend } from "../../fs";
import type { FsEntry } from "../../fs/types";

/** Recursive name search under `root` for the "All" search scope — bounded by result
 *  cap and depth so a huge tree can't hang the UI. */
export async function searchAll(root: string, query: string, cap = 1500): Promise<FsEntry[]> {
  const backend = await getFsBackend();
  const out: FsEntry[] = [];
  const q = query.toLowerCase();
  async function walk(dir: string, depth: number) {
    if (out.length >= cap || depth > 8) return;
    let list: FsEntry[] = [];
    try {
      list = await backend.listDir(dir);
    } catch {
      return;
    }
    for (const e of list) {
      if (e.isHidden) continue;
      if (e.name.toLowerCase().includes(q)) out.push(e);
      if (e.isDir) await walk(e.path, depth + 1);
      if (out.length >= cap) return;
    }
  }
  await walk(root, 0);
  return out;
}
