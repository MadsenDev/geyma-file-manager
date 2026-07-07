import { invoke } from "@tauri-apps/api/core";
import type {
  ArchivePreview,
  DeviceEntry,
  DiskUsage,
  FsBackend,
  FsEntry,
  MediaPlaybackSupport,
  PathPermissions,
  RemoteConnectInput,
  RemoteDisconnectInput,
  TextPreview,
} from "./types";
import { basenamePosix, dirnamePosix, joinPosix } from "./pathUtil";
import { isRemotePath, remoteBasename, remoteDirname, remoteJoin, sameRemoteConnection } from "./remotePath";

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
    if (isRemotePath(path)) {
      const raw = await invoke<RawFsEntry[]>("remote_list_dir", { path });
      return raw.map(fromRaw);
    }
    const raw = await invoke<RawFsEntry[]>("list_dir", { path });
    return raw.map(fromRaw);
  },
  async stat(path: string) {
    if (isRemotePath(path)) {
      const raw = await invoke<RawFsEntry>("remote_stat", { path });
      return fromRaw(raw);
    }
    const raw = await invoke<RawFsEntry>("stat_path", { path });
    return fromRaw(raw);
  },
  async readTextFile(path: string) {
    if (isRemotePath(path)) return invoke<string>("remote_read_text_file", { path });
    return invoke<string>("read_text_file", { path });
  },
  async fileUrl(path: string) {
    // The local media server only ever reads from local disk, so a network place's
    // path string would just 404 there — same "not available yet" outcome as the
    // explicit throws elsewhere, but skips the doomed round-trip.
    if (isRemotePath(path)) return null;
    const { port, token } = await getMediaServerInfo();
    return `http://127.0.0.1:${port}/media?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}`;
  },
  async mediaPlaybackSupport() {
    return invoke<MediaPlaybackSupport>("media_playback_support");
  },
  async previewArchive(path: string) {
    if (isRemotePath(path)) throw new Error("Archive previews aren't available for network locations yet");
    return invoke<ArchivePreview>("preview_archive", { path });
  },
  async extractArchive(path: string, destDir: string, folderName: string) {
    if (isRemotePath(path) || isRemotePath(destDir)) throw new Error("Extracting archives isn't available for network locations yet");
    return invoke<string>("extract_archive", { path, destDir, folderName });
  },
  async createArchive(paths: string[], destDir: string, archiveName: string) {
    if (isRemotePath(destDir) || paths.some(isRemotePath)) throw new Error("Compressing to an archive isn't available for network locations yet");
    return invoke<string>("create_archive", { paths, destDir, archiveName });
  },
  async previewTextFile(path: string) {
    if (isRemotePath(path)) {
      try {
        const content = await invoke<string>("remote_read_text_file", { path });
        return { content, truncated: false } satisfies TextPreview;
      } catch {
        return null;
      }
    }
    return invoke<TextPreview | null>("preview_text_file", { path });
  },
  async createFolder(parent: string, name: string) {
    if (isRemotePath(parent)) return invoke<string>("remote_create_folder", { parent, name });
    return invoke<string>("create_folder", { parent, name });
  },
  async createFile(parent: string, name: string, contents: string) {
    if (isRemotePath(parent)) return invoke<string>("remote_create_file", { parent, name, contents });
    return invoke<string>("create_file", { parent, name, contents });
  },
  async renamePath(from: string, toName: string) {
    if (isRemotePath(from)) return invoke<string>("remote_rename_path", { from, toName });
    return invoke<string>("rename_path", { from, toName });
  },
  async movePath(from: string, toDir: string) {
    const fromRemote = isRemotePath(from);
    const toRemote = isRemotePath(toDir);
    if (!fromRemote && !toRemote) return invoke<string>("move_path", { from, toDir });
    if (fromRemote && toRemote && sameRemoteConnection(from, toDir)) {
      return invoke<string>("remote_move_path", { from, toDir });
    }
    throw new Error("Can't move directly between these locations — copy the item across, then delete the original.");
  },
  async copyPath(from: string, toDir: string, toName: string) {
    const fromRemote = isRemotePath(from);
    const toRemote = isRemotePath(toDir);
    if (!fromRemote && !toRemote) return invoke<string>("copy_path", { from, toDir, toName });
    if (fromRemote && toRemote) return invoke<string>("remote_copy_path", { from, toDir, toName });
    if (fromRemote) return invoke<string>("download_from_remote", { remotePath: from, localDestDir: toDir, localName: toName });
    return invoke<string>("upload_to_remote", { localPath: from, remoteDestDir: toDir, remoteName: toName });
  },
  async trashPath(path: string) {
    if (isRemotePath(path)) throw new Error("Network locations have no Trash — delete permanently instead");
    return invoke<string>("trash_path", { path });
  },
  async restorePath(trashedPath: string, toDir: string) {
    return invoke<string>("restore_path", { trashedPath, toDir });
  },
  async deletePermanently(path: string) {
    if (isRemotePath(path)) {
      await invoke<void>("remote_delete_permanently", { path });
      return;
    }
    await invoke<void>("delete_permanently", { path });
  },
  async trashDirPath() {
    return invoke<string>("trash_dir_path");
  },
  async diskUsage(path: string) {
    if (isRemotePath(path)) throw new Error("Disk usage isn't available for network locations");
    return invoke<DiskUsage>("disk_usage", { path });
  },
  async listDevices() {
    return invoke<DeviceEntry[]>("list_devices");
  },
  async getPathPermissions(path: string) {
    if (isRemotePath(path)) throw new Error("Permissions aren't available for network locations");
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
    if (isRemotePath(path)) throw new Error("Permissions aren't available for network locations");
    await invoke<void>("set_path_mode", { path, mode });
  },
  async createSymlink(target: string, linkDir: string, linkName: string) {
    if (isRemotePath(target) || isRemotePath(linkDir)) throw new Error("Symlinks aren't available for network locations");
    return invoke<string>("create_symlink", { target, linkDir, linkName });
  },
  join(...parts: string[]) {
    if (parts.length > 0 && isRemotePath(parts[0])) return remoteJoin(parts[0], ...parts.slice(1));
    return joinPosix(...parts);
  },
  dirname(path: string) {
    if (isRemotePath(path)) return remoteDirname(path);
    return dirnamePosix(path);
  },
  basename(path: string) {
    if (isRemotePath(path)) return remoteBasename(path);
    return basenamePosix(path);
  },
  async connectRemote(input: RemoteConnectInput) {
    return invoke<string>("remote_connect", { ...input });
  },
  async disconnectRemote(input: RemoteDisconnectInput) {
    await invoke<void>("remote_disconnect", { ...input });
  },
  async keyringSavePassword(connectionId: string, password: string) {
    await invoke<void>("keyring_save_password", { connectionId, password });
  },
  async keyringLoadPassword(connectionId: string) {
    return invoke<string | null>("keyring_load_password", { connectionId });
  },
  async keyringDeletePassword(connectionId: string) {
    await invoke<void>("keyring_delete_password", { connectionId });
  },
};
