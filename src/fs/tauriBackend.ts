import { invoke } from "@tauri-apps/api/core";
import type { ArchivePreview, DeviceEntry, DiskUsage, FsBackend, FsEntry, MediaPlaybackSupport, PathPermissions, TextPreview } from "./types";
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

interface MediaServerInfo {
  port: number;
  token: string;
}

interface RawPathPermissions {
  mode: number;
  uid: number;
  gid: number;
  owner: string;
  group: string;
  is_symlink: boolean;
  symlink_target: string | null;
}

let mediaServerInfo: Promise<MediaServerInfo> | null = null;

function getMediaServerInfo(): Promise<MediaServerInfo> {
  mediaServerInfo ??= invoke<MediaServerInfo>("media_server_info");
  return mediaServerInfo;
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
  async fileUrl(path: string) {
    const { port, token } = await getMediaServerInfo();
    return `http://127.0.0.1:${port}/media?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}`;
  },
  async mediaPlaybackSupport() {
    return invoke<MediaPlaybackSupport>("media_playback_support");
  },
  async previewArchive(path: string) {
    return invoke<ArchivePreview>("preview_archive", { path });
  },
  async extractArchive(path: string, destDir: string, folderName: string) {
    return invoke<string>("extract_archive", { path, destDir, folderName });
  },
  async createArchive(paths: string[], destDir: string, archiveName: string) {
    return invoke<string>("create_archive", { paths, destDir, archiveName });
  },
  async previewTextFile(path: string) {
    return invoke<TextPreview | null>("preview_text_file", { path });
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
  async getPathPermissions(path: string) {
    const raw = await invoke<RawPathPermissions>("get_path_permissions", { path });
    return {
      mode: raw.mode,
      uid: raw.uid,
      gid: raw.gid,
      owner: raw.owner,
      group: raw.group,
      isSymlink: raw.is_symlink,
      symlinkTarget: raw.symlink_target,
    } satisfies PathPermissions;
  },
  async setPathMode(path: string, mode: number) {
    await invoke<void>("set_path_mode", { path, mode });
  },
  async createSymlink(target: string, linkDir: string, linkName: string) {
    return invoke<string>("create_symlink", { target, linkDir, linkName });
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
