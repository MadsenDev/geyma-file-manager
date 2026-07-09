import { tr } from "@/i18n";
import type { FsEntry } from "../../fs";
import { formatSize, formatWhen } from "../../lib/format";
import { useTheme } from "../../theme/ThemeContext";

export function MetadataPreview({
  entry,
  ext,
  tileBg,
  tileTint,
}: {
  entry: FsEntry;
  ext: string;
  tileBg: string;
  tileTint: string;
}) {
  const t = useTheme();
  const rows = [
    [tr("ui.quick_look.kind"), entry.isDir ? tr("ui.quick_look.folder") : ext || tr("ui.quick_look.unknown_file")],
    [tr("ui.quick_look.size"), entry.isDir ? "—" : formatSize(entry.size)],
    [tr("ui.quick_look.modified"), formatWhen(entry.modifiedMs)],
    [tr("ui.quick_look.created"), formatWhen(entry.createdMs)],
    [tr("ui.quick_look.location"), entry.path],
  ];
  return (
    <div
      style={{
        minHeight: 260,
        display: "grid",
        gridTemplateColumns: "120px minmax(0, 1fr)",
        gap: 24,
        alignItems: "center",
        padding: 28,
      }}
    >
      <span
        style={{
          width: 112,
          height: 112,
          borderRadius: 16,
          background: tileBg,
          color: tileTint,
          display: "grid",
          placeItems: "center",
          fontFamily: t.mono,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {ext || (entry.isDir ? "DIR" : "—")}
      </span>
      <dl
        style={{
          margin: 0,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "72px minmax(0, 1fr)",
          gap: "9px 12px",
          fontSize: 11.5,
        }}
      >
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt style={{ color: t.inkFaint, fontFamily: t.mono, fontSize: 9.5 }}>{label}</dt>
            <dd
              title={value}
              style={{
                margin: 0,
                minWidth: 0,
                color: t.inkSoft,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
