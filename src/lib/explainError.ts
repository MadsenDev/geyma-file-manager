import { tr } from "@/i18n";

// Filesystem commands on the Rust side reject with `e.to_string()` on a std::io::Error,
// which always carries a locale-independent "(os error N)" suffix even though the message
// text itself is OS-locale-dependent — so match on that code rather than the message text.
const CODE_EXPLANATION_KEYS: Record<number, string> = {
  1: "errors.not_permitted",
  2: "errors.gone",
  13: "errors.permission_denied",
  16: "errors.in_use",
  17: "errors.already_exists",
  18: "errors.cross_device",
  20: "errors.expected_folder",
  21: "errors.expected_file",
  26: "errors.in_use",
  28: "errors.disk_full",
  30: "errors.read_only",
  36: "errors.name_too_long",
  39: "errors.not_empty",
};

export function explainError(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw);
  const codeMatch = message.match(/os error (\d+)/);
  const code = codeMatch ? Number(codeMatch[1]) : undefined;
  const key = code !== undefined ? CODE_EXPLANATION_KEYS[code] : undefined;
  return key ? tr(key) : message;
}
