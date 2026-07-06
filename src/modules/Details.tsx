import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { itemColors } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { extOf, formatSize, formatWhen, kindOf, formatAgo } from "../lib/format";
import { panelTitleStyle } from "./common";
import { openReferencedPathMenu } from "../lib/contextMenus";
import { getFsBackend, type FsEntry } from "../fs";

export function Details() {
  const t = useTheme();
  const entries = useStore((s) => s.visibleEntries());
  const selected = useStore((s) => s.selected);
  const starred = useStore((s) => s.starred);
  const fileEvents = useStore((s) => s.fileEvents);
  const showPreview = useStore((s) => s.mcfg("details", "preview", true));
  const showMemory = useStore((s) => s.mcfg("details", "memory", true));
  const showActivity = useStore((s) => s.mcfg("details", "activity", true));

  const selectedEntries = entries.filter((e) => selected.includes(e.path));

  if (selectedEntries.length === 0) {
    const folders = entries.filter((e) => e.isDir).length;
    const files = entries.length - folders;
    const totalSize = entries.filter((e) => !e.isDir).reduce((s, e) => s + e.size, 0);
    return (
      <div style={{ padding: 12 }}>
        <div style={panelTitleStyle(t)}>Details</div>
        <div style={{ padding: "0 4px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Folder summary</div>
          <Row label="Items" value={`${entries.length}`} t={t} />
          <Row label="Folders" value={`${folders}`} t={t} />
          <Row label="Files" value={`${files}`} t={t} />
          <Row label="Size" value={formatSize(totalSize)} t={t} />
        </div>
      </div>
    );
  }

  if (selectedEntries.length > 1) {
    const totalSize = selectedEntries.reduce((s, e) => s + e.size, 0);
    return (
      <div style={{ padding: 12 }}>
        <div style={panelTitleStyle(t)}>Details</div>
        <div style={{ padding: "0 4px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{selectedEntries.length} items selected</div>
          <Row label="Total size" value={formatSize(totalSize)} t={t} />
        </div>
      </div>
    );
  }

  const entry = selectedEntries[0];
  const kind = kindOf(entry.name, entry.isDir);
  const colors = itemColors(kind, t);
  const ext = extOf(entry.name);
  const events = fileEvents[entry.path] || [];

  return (
    <div onContextMenu={(event) => openReferencedPathMenu(event, entry.path)} style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
        <div style={{ width: 70, height: 70, borderRadius: 16, background: colors.bg, color: colors.tint, display: "grid", placeItems: "center" }}>
          {entry.isDir ? <Icon d={ICONS.folder} size={32} color={colors.tint} /> : <span style={{ fontFamily: t.mono, fontSize: 12, fontWeight: 700 }}>{ext}</span>}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {entry.name} {starred.has(entry.path) && <span style={{ color: "#D89B2B" }}>★</span>}
          </div>
          <div style={{ fontSize: 11.5, color: t.inkFaint, marginTop: 2 }}>{entry.isDir ? "Folder" : kind}</div>
        </div>
      </div>
      <div>
        {!entry.isDir && <Row label="Size" value={formatSize(entry.size)} t={t} />}
        <Row label="Modified" value={formatWhen(entry.modifiedMs)} t={t} />
        <Row label="Created" value={formatWhen(entry.createdMs)} t={t} />
        <Row label="Path" value={entry.path} t={t} mono />
      </div>
      {showPreview && !entry.isDir && <DetailsContentPreview entry={entry} />}
      {showMemory && (
        <div>
          <div style={panelTitleStyle(t)}>Memory</div>
          <div style={{ padding: "0 4px" }}>
            <Row label="Events" value={`${events.length}`} t={t} />
            <Row label="Starred" value={starred.has(entry.path) ? "Yes" : "No"} t={t} />
          </div>
        </div>
      )}
      {showActivity && events.length > 0 && (
        <div>
          <div style={panelTitleStyle(t)}>What this file remembers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5 }}>
                <span>
                  <b style={{ color: t.ink }}>{ev.action}</b> {ev.detail && <span style={{ color: t.inkSoft }}>{ev.detail}</span>}
                </span>
                <span style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint, flex: "none" }}>{formatAgo(ev.whenMs)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailsContentPreview({ entry }: { entry: FsEntry }) {
  const t = useTheme();
  const kind = kindOf(entry.name, false);
  const [preview, setPreview] = useState<{ type: "text"; content: string } | { type: "image"; url: string } | { type: "none" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    getFsBackend()
      .then(async (backend) => {
        if (kind === "image") {
          const url = await backend.fileUrl(entry.path);
          return url ? { type: "image", url } as const : { type: "none" } as const;
        }
        const text = await backend.previewTextFile(entry.path);
        return text ? { type: "text", content: text.content.slice(0, 1600) } as const : { type: "none" } as const;
      })
      .then((value) => {
        if (!cancelled) setPreview(value);
      })
      .catch(() => {
        if (!cancelled) setPreview({ type: "none" });
      });
    return () => { cancelled = true; };
  }, [entry.path, kind]);

  return (
    <div>
      <div style={panelTitleStyle(t)}>Preview</div>
      {preview?.type === "text" ? (
        <pre style={{ margin: 0, padding: "11px 12px", maxHeight: 168, overflow: "auto", border: `1px solid ${t.border}`, borderRadius: 10, background: t.bg, color: t.inkSoft, fontFamily: t.mono, fontSize: 10.5, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {preview.content}
        </pre>
      ) : preview?.type === "image" ? (
        <div style={{ height: 150, display: "grid", placeItems: "center", overflow: "hidden", border: `1px solid ${t.border}`, borderRadius: 10, background: t.bg }}>
          <img src={preview.url} alt="" onError={() => setPreview({ type: "none" })} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      ) : (
        <div style={{ padding: "12px", border: `1px solid ${t.border}`, borderRadius: 10, background: t.bg, color: t.inkFaint, fontSize: 11.5 }}>
          {preview ? "No inline preview available for this format." : "Preparing preview…"}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, t, mono }: { label: string; value: string; t: ReturnType<typeof useTheme>; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 4px", fontSize: 12 }}>
      <span style={{ color: t.inkFaint, fontFamily: t.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      <span style={{ color: t.inkSoft, textAlign: "right", wordBreak: mono ? "break-all" : "normal", fontFamily: mono ? t.mono : "inherit", fontSize: mono ? 10.5 : 12 }}>{value}</span>
    </div>
  );
}
