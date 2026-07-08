import { tr } from "@/i18n";
import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { navItemStyle, panelTitleStyle } from "./common";
import { joinPosix } from "../fs/pathUtil";
import { openLocationMenu } from "../lib/contextMenus";
const PLACE_DEFS: {
  label: string;
  sub: string;
  icon: string;
}[] = [
  {
    label: tr("ui.places.home"),
    sub: "",
    icon: ICONS.home,
  },
  {
    label: tr("ui.places.desktop"),
    sub: "Desktop",
    icon: ICONS.desktop,
  },
  {
    label: tr("ui.places.documents"),
    sub: "Documents",
    icon: ICONS.documents,
  },
  {
    label: tr("ui.places.downloads"),
    sub: "Downloads",
    icon: ICONS.downloads,
  },
  {
    label: tr("ui.places.pictures"),
    sub: "Pictures",
    icon: ICONS.pictures,
  },
  {
    label: tr("ui.places.videos"),
    sub: "Videos",
    icon: ICONS.videos,
  },
  {
    label: tr("ui.places.music"),
    sub: "Music",
    icon: ICONS.music,
  },
];
export function Places() {
  const t = useTheme();
  const home = useStore((s) => s.home);
  const path = useStore((s) => s.path);
  const trashView = useStore((s) => s.trashView);
  const goPlace = useStore((s) => s.goPlace);
  const moveEntries = useStore((s) => s.moveEntries);
  const openTrash = useStore((s) => s.openTrash);
  const trashCount = useStore((s) => s.entriesFor(s.trashDir).length);
  const showTrash = useStore((s) => s.mcfg("places", "showTrash", true));
  const [dragOver, setDragOver] = useState<string | null>(null);
  return (
    <div>
      <div style={panelTitleStyle(t)}>{tr("ui.places.places")}</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "0 6px 8px",
        }}
      >
        {PLACE_DEFS.map((p) => {
          const full = p.sub ? joinPosix(home, p.sub) : home;
          const active = !trashView && path === full;
          return (
            <button
              key={p.label}
              className="gy-item"
              onClick={() => goPlace(full)}
              onContextMenu={(event) => openLocationMenu(event, full)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(full);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const raw = e.dataTransfer.getData("application/x-geyma-paths");
                if (raw) void moveEntries(JSON.parse(raw), full);
              }}
              style={navItemStyle(t, active, dragOver === full)}
            >
              <Icon d={p.icon} size={15} />
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "left",
                }}
              >
                {p.label}
              </span>
            </button>
          );
        })}
        {showTrash && (
          <button
            className="gy-item"
            onClick={openTrash}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const store = useStore.getState();
              const trashed = store
                .entriesFor(store.trashDir)
                .map((entry) => entry.path);
              store.openMenu({
                x: event.clientX,
                y: event.clientY,
                items: [
                  {
                    label: "Open Trash",
                    onClick: openTrash,
                  },
                  trashed.length > 0
                    ? {
                        label: "Empty Trash…",
                        danger: true,
                        onClick: () => store.requestPermanentDelete(trashed),
                      }
                    : undefined,
                ].filter(Boolean) as {
                  label: string;
                  danger?: boolean;
                  onClick?: () => void;
                }[],
              });
            }}
            style={navItemStyle(t, trashView, false)}
          >
            <Icon d={ICONS.trash} size={15} />
            <span
              style={{
                flex: 1,
                textAlign: "left",
              }}
            >
              {tr("ui.places.trash")}
            </span>
            {trashCount > 0 && (
              <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 10.5,
                  color: t.inkFaint,
                }}
              >
                {trashCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
