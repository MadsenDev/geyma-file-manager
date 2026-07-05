import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { formatSize } from "../lib/format";

export function Status() {
  const t = useTheme();
  const path = useStore((s) => s.path);
  const trashView = useStore((s) => s.trashView);
  const trashDir = useStore((s) => s.trashDir);
  const entries = useStore((s) => s.entriesFor(trashView ? trashDir : path));
  const selected = useStore((s) => s.selected);
  const clip = useStore((s) => s.clip);

  const selectedEntries = entries.filter((e) => selected.includes(e.path));
  const totalSize = selectedEntries.reduce((sum, e) => sum + e.size, 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 12px", fontSize: 11.5, color: t.inkSoft, width: "100%" }}>
      <span>{entries.length} item{entries.length === 1 ? "" : "s"}</span>
      {selected.length > 0 && (
        <span style={{ color: t.accent, fontWeight: 600 }}>
          {selected.length} selected{totalSize > 0 ? ` · ${formatSize(totalSize)}` : ""}
        </span>
      )}
      {clip && (
        <span style={{ color: t.inkFaint }}>
          {clip.mode === "cut" ? "Cut" : "Copied"}: {clip.items.length} item{clip.items.length === 1 ? "" : "s"}
        </span>
      )}
      <span style={{ marginLeft: "auto", fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>{path}</span>
    </div>
  );
}
