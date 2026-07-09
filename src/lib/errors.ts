import i18next, { tr } from "@/i18n";

/**
 * The one shape every caught error is normalized into before it reaches the UI.
 *
 * - `code` is a stable identifier ("permission_denied", "disk_full", ...). Every code with
 *   an `errors.<code>` key in en.json gets a translated, human explanation; anything else
 *   falls through as `"unknown"`.
 * - `message` is always safe to show a user: the translated explanation when the code is
 *   known, otherwise the raw underlying message.
 * - `detail` is the raw underlying message, only set when it differs from `message` —
 *   surfaces the low-level cause ("os error 13", an SFTP status, ...) without making it
 *   the headline.
 */
export type AppError = {
  code: string;
  message: string;
  detail?: string;
};

// Errno → code, for errors that arrive as strings with std::io::Error's
// locale-independent "(os error N)" suffix (e.g. via a Tauri plugin, or a context
// message wrapped around an io error). Mirrors `code_for_errno` in
// src-tauri/src/error.rs — keep the two in sync.
const OS_ERROR_CODES: Record<number, string> = {
  1: "not_permitted",
  2: "gone",
  5: "io_failed",
  13: "permission_denied",
  16: "in_use",
  17: "already_exists",
  18: "cross_device",
  20: "expected_folder",
  21: "expected_file",
  22: "invalid_input",
  24: "too_many_open",
  26: "in_use",
  28: "disk_full",
  30: "read_only",
  32: "connection_lost",
  36: "name_too_long",
  39: "not_empty",
  40: "symlink_loop",
  101: "host_unreachable",
  104: "connection_lost",
  110: "timed_out",
  111: "connection_refused",
  113: "host_unreachable",
  116: "gone",
  122: "disk_full",
};

function hasExplanation(code: string): boolean {
  return code !== "unknown" && i18next.exists(`errors.${code}`);
}

function isCodedError(raw: unknown): raw is { code: string; message: string } {
  return (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { code?: unknown }).code === "string" &&
    typeof (raw as { message?: unknown }).message === "string"
  );
}

/** A `fetch()` that never reached the server rejects with a TypeError whose message
 * varies by engine — recognize the common ones so they read as a network problem. */
function isNetworkFailure(raw: unknown): boolean {
  return (
    raw instanceof TypeError &&
    /failed to fetch|networkerror|load failed|network request failed/i.test(raw.message)
  );
}

function fromCode(code: string, rawMessage: string): AppError {
  if (hasExplanation(code)) {
    return {
      code,
      message: tr(`errors.${code}`),
      detail: rawMessage && rawMessage !== tr(`errors.${code}`) ? rawMessage : undefined,
    };
  }
  return { code, message: rawMessage || tr("errors.unknown") };
}

/**
 * Normalizes anything a backend call, fetch, or plain bug can throw into an [`AppError`].
 * Handles, in order: the structured `{ code, message }` payloads every Rust command
 * rejects with (and the mock backend mirrors), fetch-level network failures, strings and
 * Errors carrying an "(os error N)" suffix, and — as the final fallback — any stringable
 * value with code `"unknown"`.
 */
export function classifyError(raw: unknown): AppError {
  if (isCodedError(raw)) {
    return fromCode(raw.code, raw.message);
  }
  if (isNetworkFailure(raw)) {
    return fromCode("network", raw instanceof Error ? raw.message : String(raw));
  }
  const message =
    raw instanceof Error ? raw.message : raw === undefined || raw === null ? "" : String(raw);
  const codeMatch = message.match(/os error (\d+)/);
  const errnoCode = codeMatch ? OS_ERROR_CODES[Number(codeMatch[1])] : undefined;
  if (errnoCode) {
    return fromCode(errnoCode, message);
  }
  return { code: "unknown", message: message || tr("errors.unknown") };
}

/** The single user-facing line for an error — `classifyError(raw).message`. */
export function explainError(raw: unknown): string {
  return classifyError(raw).message;
}

/**
 * An Error carrying a stable code, for frontend-raised failures (backend guards, the
 * mock filesystem) so they classify exactly like the Rust side's `{ code, message }`
 * rejections. With no explicit message, the code's own `errors.<code>` text is used.
 */
export function codedError(code: string, message?: string): Error {
  return Object.assign(new Error(message ?? tr(`errors.${code}`)), { code });
}
