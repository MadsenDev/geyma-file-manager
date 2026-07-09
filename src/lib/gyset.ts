// Shared codec for portable Working Sets: the clipboard "GYSET." code and the
// .gyset file are the same JSON payload, base64-wrapped for the clipboard form.
import type { SetItemRef, SetRule, WorkingSet } from "../state/types";

export const GYSET_CODE_PREFIX = "GYSET.";
export const GYSET_FILE_EXT = ".gyset";

export interface GysetPayload {
  format: "gyset";
  version: number;
  name: string;
  note?: string;
  smart?: boolean;
  rule?: SetRule | null;
  items: SetItemRef[];
  color?: string;
  icon?: string;
  exportedAt?: string;
}

function toBase64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildGysetPayload(def: WorkingSet, items?: SetItemRef[]): GysetPayload {
  const payload: GysetPayload = {
    format: "gyset",
    version: 2,
    name: def.name,
    items: items ?? def.items,
  };
  if (def.note) payload.note = def.note;
  if (def.smart) payload.smart = true;
  if (def.rule) payload.rule = def.rule;
  if (def.color) payload.color = def.color;
  if (def.icon) payload.icon = def.icon;
  return payload;
}

export function encodeGysetCode(payload: GysetPayload): string {
  return GYSET_CODE_PREFIX + toBase64Utf8(JSON.stringify(payload));
}

export function encodeGysetFile(payload: GysetPayload): string {
  return JSON.stringify({ ...payload, exportedAt: new Date().toISOString() }, null, 2);
}

/** Accepts a "GYSET.<base64>" clipboard code or raw .gyset JSON; null if unparseable. */
export function parseGysetText(text: string): GysetPayload | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const json = raw.startsWith(GYSET_CODE_PREFIX) ? fromBase64Utf8(raw.slice(GYSET_CODE_PREFIX.length)) : raw;
    const parsed = JSON.parse(json) as Partial<GysetPayload>;
    if (typeof parsed !== "object" || parsed === null) return null;
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((it): it is SetItemRef => !!it && typeof it.dir === "string" && typeof it.name === "string")
      : [];
    return {
      format: "gyset",
      version: typeof parsed.version === "number" ? parsed.version : 1,
      name: typeof parsed.name === "string" ? parsed.name : "",
      note: typeof parsed.note === "string" && parsed.note ? parsed.note : undefined,
      smart: !!parsed.smart,
      rule: parsed.rule && typeof parsed.rule === "object" ? (parsed.rule as SetRule) : undefined,
      items,
      color: typeof parsed.color === "string" ? parsed.color : undefined,
      icon: typeof parsed.icon === "string" ? parsed.icon : undefined,
    };
  } catch {
    return null;
  }
}

export function isGysetFileName(name: string): boolean {
  return name.toLowerCase().endsWith(GYSET_FILE_EXT);
}
