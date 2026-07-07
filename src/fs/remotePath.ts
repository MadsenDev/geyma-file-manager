// Parsing/manipulation for the sftp:// and smb:// URIs network places use as paths —
// mirrors src-tauri/src/remote.rs's RemoteAddr so both sides agree on the shape:
//   sftp://user@host:port/abs/path
//   smb://user@host:port/Share/sub/path
// These flow through the same `path: string` used everywhere else (FsEntry.path, nav
// state, working sets), so dirname/basename/join have to understand them the same way
// the Rust side's list/rename/etc. commands do.
import { basenamePosix, dirnamePosix, joinPosix } from "./pathUtil";

export interface ParsedRemotePath {
  protocol: "sftp" | "smb";
  authority: string;
  /** SMB only. */
  share?: string;
  /** SFTP: absolute path on the server, always starting with "/". SMB: path within the
   * share using "/" separators, no leading slash — "" means the share root. */
  path: string;
}

export function isRemotePath(path: string): boolean {
  return path.startsWith("sftp://") || path.startsWith("smb://");
}

export function parseRemotePath(path: string): ParsedRemotePath | null {
  const match = /^(sftp|smb):\/\/([^/]+)(\/.*)?$/.exec(path);
  if (!match) return null;
  const protocol = match[1] as "sftp" | "smb";
  const authority = match[2];
  const rest = match[3] ?? "";

  if (protocol === "sftp") {
    return { protocol, authority, path: rest || "/" };
  }

  const segments = rest.replace(/^\//, "").split("/").filter((s) => s.length > 0);
  const share = segments[0];
  if (!share) return null;
  return { protocol, authority, share, path: segments.slice(1).join("/") };
}

function buildRemotePath(base: ParsedRemotePath, path: string): string {
  if (base.protocol === "sftp") return `sftp://${base.authority}${path}`;
  return `smb://${base.authority}/${base.share}${path ? `/${path}` : ""}`;
}

/** Same contract as dirnamePosix: parent of the given path. Floors at the SMB share
 * root (dirname(shareRoot) === shareRoot) the same way dirnamePosix floors at "/", which
 * is what lets the existing canUp() check (`dirname(path) !== path`) disable "Up" there
 * for free. */
export function remoteDirname(path: string): string {
  const parsed = parseRemotePath(path);
  if (!parsed) return path;
  if (parsed.protocol === "sftp") return buildRemotePath(parsed, dirnamePosix(parsed.path));
  if (!parsed.path) return path;
  const parent = dirnamePosix(`/${parsed.path}`).slice(1);
  return buildRemotePath(parsed, parent);
}

export function remoteBasename(path: string): string {
  const parsed = parseRemotePath(path);
  if (!parsed) return path;
  if (parsed.protocol === "sftp") return basenamePosix(parsed.path) || parsed.authority;
  if (!parsed.path) return parsed.share ?? parsed.authority;
  return basenamePosix(parsed.path);
}

export function remoteJoin(base: string, ...names: string[]): string {
  const parsed = parseRemotePath(base);
  if (!parsed) return joinPosix(base, ...names);
  const joinedSub = names.reduce((acc, name) => (acc ? joinPosix(acc, name) : name), parsed.path);
  return buildRemotePath(parsed, parsed.protocol === "sftp" ? (joinedSub.startsWith("/") ? joinedSub : `/${joinedSub}`) : joinedSub);
}

/** Two paths are on the same live connection (same protocol/authority/share) — used to
 * decide whether a "move" can be a real server-side rename or has to be copy+delete. */
export function sameRemoteConnection(a: string, b: string): boolean {
  const pa = parseRemotePath(a);
  const pb = parseRemotePath(b);
  if (!pa || !pb) return false;
  return pa.protocol === pb.protocol && pa.authority === pb.authority && pa.share === pb.share;
}
