export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
  createdMs: number;
  isHidden: boolean;
}

export interface DeviceEntry {
  label: string;
  path: string;
}

export interface DiskUsage {
  total: number;
  available: number;
}

export interface FsBackend {
  kind: "tauri" | "mock";
  sep: string;
  homeDir(): Promise<string>;
  listDir(path: string): Promise<FsEntry[]>;
  stat(path: string): Promise<FsEntry>;
  readTextFile(path: string): Promise<string>;
  createFolder(parent: string, name: string): Promise<string>;
  createFile(parent: string, name: string, contents: string): Promise<string>;
  renamePath(from: string, toName: string): Promise<string>;
  movePath(from: string, toDir: string): Promise<string>;
  trashPath(path: string): Promise<string>;
  restorePath(trashedPath: string, toDir: string): Promise<string>;
  deletePermanently(path: string): Promise<void>;
  trashDirPath(): Promise<string>;
  diskUsage(path: string): Promise<DiskUsage>;
  listDevices(): Promise<DeviceEntry[]>;
  join(...parts: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
}
