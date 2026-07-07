// Filesystem commands on the Rust side reject with `e.to_string()` on a std::io::Error,
// which always carries a locale-independent "(os error N)" suffix even though the message
// text itself is OS-locale-dependent — so match on that code rather than the message text.
const CODE_EXPLANATIONS: Record<number, string> = {
  1: "Not permitted — this action isn't allowed on this file, even by its owner.",
  2: "No longer there — it may have been moved, renamed, or deleted since it was listed.",
  13: "Permission denied — this file may be owned by another user, or the folder needs elevated access.",
  16: "In use elsewhere — this file looks like it's open in another program. Close it and try again.",
  17: "Already exists — something with that name is already at the destination.",
  18: "Can't move directly across drives or filesystems — try copying it, then deleting the original.",
  20: "Expected a folder, but this is a file.",
  21: "Expected a file, but this is a folder.",
  26: "In use elsewhere — this file looks like it's open in another program. Close it and try again.",
  28: "The destination is full — free up space and try again.",
  30: "This location is mounted read-only — nothing can be written here right now.",
  36: "That name is too long for this filesystem.",
  39: "This folder still has files in it.",
};

export function explainError(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw);
  const codeMatch = message.match(/os error (\d+)/);
  const code = codeMatch ? Number(codeMatch[1]) : undefined;
  const explanation = code !== undefined ? CODE_EXPLANATIONS[code] : undefined;
  return explanation || message;
}
