import { tr } from "@/i18n";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { formatAgo } from "../lib/format";
import { panelTitleStyle } from "./common";
import {
  openReferencedPathMenu,
  revealReferencedPath,
} from "../lib/contextMenus";
const KIND_DOT: Record<string, string> = {
  accent: "#2C6E49",
  video: "#3B82C4",
  archive: "#D19A3A",
  document: "#E4572E",
  app: "#5CA95A",
  muted: "#8A8172",
};
export function Recent() {
  const t = useTheme();
  const feed = useStore((s) => s.globalFeed);
  const mcfg = useStore((s) => s.mcfg);
  const count = mcfg("recent", "count", 6);
  return (
    <div>
      <div style={panelTitleStyle(t)}>{tr("ui.recent.recent_activity")}</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "0 8px 8px",
        }}
      >
        {feed.slice(0, count).map((ev) => (
          <button
            key={ev.id}
            onClick={() => revealReferencedPath(ev.path, true)}
            onContextMenu={(event) => openReferencedPathMenu(event, ev.path)}
            className="gy-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 4px",
              border: 0,
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
              borderRadius: 6,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: KIND_DOT[ev.kind] || t.accent,
                flex: "none",
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 12,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <b
                style={{
                  color: t.ink,
                }}
              >
                {ev.action}
              </b>{" "}
              <span
                style={{
                  color: t.inkSoft,
                }}
              >
                {ev.path.split("/").pop()}
              </span>
            </span>
            <span
              style={{
                fontFamily: t.mono,
                fontSize: 9,
                color: t.inkFaint,
                flex: "none",
              }}
            >
              {formatAgo(ev.whenMs)}
            </span>
          </button>
        ))}
        {feed.length === 0 && (
          <div
            style={{
              padding: "6px 4px",
              fontSize: 11.5,
              color: t.inkFaint,
            }}
          >
            {tr("ui.recent.no_activity_yet_file_changes_will_appear_here")}
          </div>
        )}
      </div>
    </div>
  );
}
