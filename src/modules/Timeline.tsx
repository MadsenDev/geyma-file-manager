import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { panelTitleStyle } from "./common";
import type { FileEvent } from "../state/types";
import { openReferencedPathMenu, revealReferencedPath } from "../lib/contextMenus";

const KIND_DOT: Record<string, string> = {
  accent: "#2C6E49",
  video: "#3B82C4",
  archive: "#D19A3A",
  document: "#E4572E",
  app: "#5CA95A",
  muted: "#8A8172",
};

function groupLabel(ms: number): string {
  const now = new Date();
  const d = new Date(ms);
  if (d.toDateString() === now.toDateString()) return "TODAY";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "YESTERDAY";
  const daysAgo = Math.round((now.getTime() - ms) / 86400000);
  if (daysAgo < 7) return "THIS WEEK";
  return "EARLIER";
}

export function Timeline() {
  const t = useTheme();
  const feed = useStore((s) => s.globalFeed);

  const groups = new Map<string, FileEvent[]>();
  feed.forEach((ev) => {
    const label = groupLabel(ev.whenMs);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(ev);
  });

  return (
    <div>
      <div style={panelTitleStyle(t)}>Timeline</div>
      <div style={{ padding: "0 8px 8px" }}>
        {Array.from(groups.entries()).map(([label, evs]) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: t.mono, fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: ".08em", marginBottom: 4 }}>{label}</div>
            {evs.map((ev) => (
              <button
                key={ev.id}
                onClick={() => revealReferencedPath(ev.path, true)}
                onContextMenu={(event) => openReferencedPathMenu(event, ev.path)}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: 0, background: "transparent", padding: "4px 2px", cursor: "pointer", textAlign: "left" }}
                className="gy-row"
              >
                <span style={{ width: 7, height: 7, borderRadius: 99, background: KIND_DOT[ev.kind] || t.accent, flex: "none" }} />
                <span style={{ flex: 1, fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <b>{ev.action}</b> <span style={{ color: t.inkSoft }}>{ev.path.split("/").pop()}</span>
                </span>
                <span style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint }}>
                  {new Date(ev.whenMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
        ))}
        {feed.length === 0 && <div style={{ fontSize: 11.5, color: t.inkFaint }}>Nothing recorded yet.</div>}
      </div>
    </div>
  );
}
