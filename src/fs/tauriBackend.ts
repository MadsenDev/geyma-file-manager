import { invoke } from "@tauri-apps/api/core";
import type { DeviceEntry, DiskUsage, FsBackend, FsEntry } from "./types";
import { basenamePosix, dirnamePosix, joinPosix } from "./pathUtil";

interface RawFsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_ms: number;
  created_ms: number;
  is_hidden: boolean;
}

function fromRaw(e: RawFsEntry): FsEntry {
  return {
    name: e.name,
    path: e.path,
    isDir: e.is_dir,
    size: e.size,
    modifiedMs: e.modified_ms,
    createdMs: e.created_ms,
    isHidden: e.is_hidden,
  };
}

export const tauriBackend: FsBackend = {
  kind: "tauri",
  sep: "/",
  async homeDir() {
    return invoke<string>("home_dir");
  },
  async listDir(path: string) {
    const raw = await invoke<RawFsEntry[]>("list_dir", { path });
    return raw.map(fromRaw);
  },
  async stat(path: string) {
    const raw = await invoke<RawFsEntry>("stat_path", { path });
    return fromRaw(raw);
  },
  async readTextFile(path: string) {
    return invoke<string>("read_text_file", { path });
  },
  async createFolder(parent: string, name: string) {
    return invoke<string>("create_folder", { parent, name });
  },
  async createFile(parent: string, name: string, contents: string) {
    return invoke<string>("create_file", { parent, name, contents });
  },
  async renamePath(from: string, toName: string) {
    return invoke<string>("rename_path", { from, toName });
  },
  async movePath(from: string, toDir: string) {
    return invoke<string>("move_path", { from, toDir });
  },
  async copyPath(from: string, toDir: string, toName: string) {
    return invoke<string>("copy_path", { from, toDir, toName });
  },
  async trashPath(path: string) {
    return invoke<string>("trash_path", { path });
  },
  async restorePath(trashedPath: string, toDir: string) {
    return invoke<string>("restore_path", { trashedPath, toDir });
  },
  async deletePermanently(path: string) {
    await invoke<void>("delete_permanently", { path });
  },
  async trashDirPath() {
    return invoke<string>("trash_dir_path");
  },
  async diskUsage(path: string) {
    return invoke<DiskUsage>("disk_usage", { path });
  },
  async listDevices() {
    return invoke<DeviceEntry[]>("list_devices");
  },
  join(...parts: string[]) {
    return joinPosix(...parts);
  },
  dirname(path: string) {
    return dirnamePosix(path);
  },
  basename(path: string) {
    return basenamePosix(path);
  },
};
