export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

export function formatWhen(ms: number): string {
  const now = new Date();
  const d = new Date(ms);
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  const daysAgo = Math.round((now.getTime() - d.getTime()) / 86400000);
  if (daysAgo >= 0 && daysAgo < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

export function formatAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatWhen(ms);
}

export function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return "";
  return name.slice(idx + 1).toUpperCase();
}

const KIND_BY_EXT: Record<string, string> = {
  PDF: "document", DOC: "document", DOCX: "document", ODT: "document",
  TXT: "text", MD: "text", LOG: "text",
  TS: "code", JS: "code", TSX: "code", JSX: "code", JSON: "code", HTML: "code", CSS: "code", RS: "code", PY: "code", PATCH: "code",
  PNG: "image", JPG: "image", JPEG: "image", GIF: "image", SVG: "image", RAW: "image", FIG: "image", WEBP: "image",
  MP4: "video", WEBM: "video", MOV: "video", MKV: "video",
  MP3: "audio", FLAC: "audio", WAV: "audio", OGG: "audio",
  ZIP: "archive", GZ: "archive", TAR: "archive", RAR: "archive", "7Z": "archive",
  APPIMAGE: "app", DEB: "app", RPM: "app", EXE: "app",
};

export function kindOf(name: string, isDir: boolean): string {
  if (isDir) return "folder";
  const ext = extOf(name);
  return KIND_BY_EXT[ext] || "document";
}

export function isTextLike(name: string): boolean {
  const ext = extOf(name);
  return ["TXT", "MD", "LOG", "TS", "JS", "TSX", "JSX", "JSON", "HTML", "CSS", "RS", "PY", "PATCH", "YML", "YAML", "TOML"].includes(ext);
}
