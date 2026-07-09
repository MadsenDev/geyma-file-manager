import { tr } from "@/i18n";
import { useState } from "react";
import { formatSize } from "../../lib/format";
import { useTheme } from "../../theme/ThemeContext";

export interface ListingEntry {
  name: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
}

export function EntryListing({
  label,
  entries,
  totalEntries,
  truncated,
  showCompressed = false,
}: {
  label: string;
  entries: ListingEntry[];
  totalEntries: number;
  truncated: boolean;
  showCompressed?: boolean;
}) {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = normalized
    ? entries.filter((entry) => entry.name.toLocaleLowerCase().includes(normalized))
    : entries;
  const visible = filtered.slice(0, 500);
  return (
    <div style={{ minHeight: 260, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          borderBottom: `1px solid ${t.border}`,
          background: t.main,
        }}
      >
        <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint, flex: 1 }}>
          {label} · {tr("ui.quick_look.entry_count", { count: totalEntries, formatted: totalEntries.toLocaleString() })}
          {truncated ? ` · ${tr("ui.quick_look.first_indexed", { count: entries.length.toLocaleString() })}` : ""}
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tr("ui.quick_look.filter_contents")}
          aria-label={tr("ui.quick_look.filter_preview_contents")}
          style={{
            width: 220,
            maxWidth: "45%",
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            background: t.card,
            color: t.ink,
            padding: "7px 9px",
            outline: "none",
            fontFamily: t.mono,
            fontSize: 10.5,
          }}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showCompressed ? "minmax(0, 1fr) 90px 90px" : "minmax(0, 1fr) 90px",
          gap: 10,
          padding: "8px 14px",
          borderBottom: `1px solid ${t.border}`,
          color: t.inkFaint,
          fontFamily: t.mono,
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: ".06em",
        }}
      >
        <span>{tr("ui.quick_look.name")}</span>
        <span style={{ textAlign: "right" }}>{tr("ui.quick_look.size")}</span>
        {showCompressed && <span style={{ textAlign: "right" }}>{tr("ui.quick_look.packed")}</span>}
      </div>
      <div style={{ overflow: "auto", maxHeight: "min(56vh, 500px)" }}>
        {visible.map((item, index) => (
          <div
            key={tr("ui.quick_look.name_index", { name: item.name, index })}
            style={{
              display: "grid",
              gridTemplateColumns: showCompressed ? "minmax(0, 1fr) 90px 90px" : "minmax(0, 1fr) 90px",
              gap: 10,
              alignItems: "center",
              padding: "7px 14px",
              borderBottom: `1px solid ${t.border}`,
              fontSize: 11.5,
            }}
          >
            <span
              title={item.name}
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: item.isDir ? t.accent : t.ink,
              }}
            >
              <span
                aria-hidden="true"
                style={{ display: "inline-block", width: 18, color: item.isDir ? t.accent : t.inkFaint }}
              >
                {item.isDir ? "▸" : "·"}
              </span>
              {item.name}
            </span>
            <span style={{ textAlign: "right", color: t.inkFaint, fontFamily: t.mono, fontSize: 10 }}>
              {item.isDir ? "—" : formatSize(item.size)}
            </span>
            {showCompressed && (
              <span style={{ textAlign: "right", color: t.inkFaint, fontFamily: t.mono, fontSize: 10 }}>
                {item.isDir ? "—" : formatSize(item.compressedSize)}
              </span>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <div
            style={{
              height: 140,
              display: "grid",
              placeItems: "center",
              color: t.inkFaint,
              fontFamily: t.mono,
              fontSize: 10.5,
            }}
          >
            {tr("ui.quick_look.no_matching_items")}
          </div>
        )}
        {filtered.length > visible.length && (
          <div
            style={{
              padding: 12,
              textAlign: "center",
              color: t.inkFaint,
              fontFamily: t.mono,
              fontSize: 9.5,
            }}
          >
            {tr("ui.quick_look.matches_capped", { total: filtered.length.toLocaleString() })}
          </div>
        )}
      </div>
    </div>
  );
}
