import { tr } from "@/i18n";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { openLocationMenu } from "../lib/contextMenus";
export function Location() {
  const t = useTheme();
  const path = useStore((s) => s.path);
  const home = useStore((s) => s.home);
  const goPath = useStore((s) => s.goPath);
  const rel = path.startsWith(home) ? path.slice(home.length) : path;
  const label = path === home ? tr("ui.location.home") : rel;
  const parts = label.split("/").filter(Boolean);
  const crumbs = [
    {
      name: tr("ui.location.home"),
      full: home,
    },
    ...parts.map((_, i) => ({
      name: parts[i],
      full: home + "/" + parts.slice(0, i + 1).join("/"),
    })),
  ];
  const realCrumbs =
    path === home
      ? [
          {
            name: tr("ui.location.home"),
            full: home,
          },
        ]
      : crumbs;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        minWidth: 0,
        flex: 1,
        overflow: "hidden",
      }}
    >
      {realCrumbs.map((c, i) => (
        <span
          key={c.full}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            minWidth: 0,
          }}
        >
          {i > 0 && (
            <span
              style={{
                color: t.inkFaint,
                fontSize: 11,
              }}
            >
              /
            </span>
          )}
          <button
            onClick={() => goPath(c.full)}
            onContextMenu={(event) => openLocationMenu(event, c.full)}
            className="gy-soft"
            style={{
              border: 0,
              background: "transparent",
              padding: "4px 6px",
              borderRadius: 7,
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: i === realCrumbs.length - 1 ? 700 : 500,
              color: i === realCrumbs.length - 1 ? t.ink : t.inkSoft,
              maxWidth: 190,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.name}
          </button>
        </span>
      ))}
      <div
        style={{
          width: 1,
          height: 16,
          background: hexA(t.ink, 0.08),
          margin: "0 4px",
          flex: "none",
        }}
      />
    </div>
  );
}
