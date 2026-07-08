import { tr } from "@/i18n";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { formatSize } from "../lib/format";
export function Status() {
  const t = useTheme();
  const path = useStore((s) => s.path);
  const entries = useStore((s) => s.visibleEntries());
  const selected = useStore((s) => s.selected);
  const clip = useStore((s) => s.clip);
  const selectedEntries = entries.filter((e) => selected.includes(e.path));
  const totalSize = selectedEntries.reduce((sum, e) => sum + e.size, 0);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 12px",
        fontSize: 11.5,
        color: t.inkSoft,
        width: "100%",
      }}
    >
      <span>
        {tr("ui.status.items", { count: entries.length })}
      </span>
      {selected.length > 0 && (
        <span
          style={{
            color: t.accent,
            fontWeight: 600,
          }}
        >
          {tr("ui.status.selected_count", { count: selected.length })}
          {totalSize > 0 ? ` · ${formatSize(totalSize)}` : ""}
        </span>
      )}
      {clip && (
        <span
          style={{
            color: t.inkFaint,
          }}
        >
          {clip.mode === "cut" ? tr("ui.status.cut") : tr("ui.status.copied")}:{" "}
          {tr("ui.status.items", { count: clip.items.length })}
        </span>
      )}
      <span
        style={{
          marginLeft: "auto",
          fontFamily: t.mono,
          fontSize: 10,
          color: t.inkFaint,
        }}
      >
        {path}
      </span>
    </div>
  );
}
