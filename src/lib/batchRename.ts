export function splitBaseExt(name: string): { base: string; ext: string } {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, idx), ext: name.slice(idx) };
}

/** Expands {name} to the original base name and any run of #'s to a zero-padded sequence number. */
export function applyRenameTemplate(template: string, base: string, index: number): string {
  return template.replace(/\{name\}/g, base).replace(/#+/g, (run) => String(index).padStart(run.length, "0"));
}

export function computeBatchNames(
  entries: { name: string; isDir: boolean }[],
  template: string,
  startAt: number,
): string[] {
  return entries.map((entry, i) => {
    const { base, ext } = splitBaseExt(entry.name);
    const newBase = applyRenameTemplate(template, base, startAt + i);
    return entry.isDir ? newBase : `${newBase}${ext}`;
  });
}
