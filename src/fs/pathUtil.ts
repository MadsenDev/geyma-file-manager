export function joinPosix(...parts: string[]): string {
  const filtered = parts.filter((p) => p !== "");
  if (filtered.length === 0) return "/";
  let out = filtered[0];
  for (let i = 1; i < filtered.length; i++) {
    const seg = filtered[i].replace(/^\/+/, "");
    out = out.replace(/\/+$/, "") + "/" + seg;
  }
  return out || "/";
}

export function dirnamePosix(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  return trimmed.slice(0, idx);
}

export function basenamePosix(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}
