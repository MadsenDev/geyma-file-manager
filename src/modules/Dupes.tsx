import { useMemo } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { DUPE_BADGE } from "../theme/skins";
import { panelTitleStyle } from "./common";
import { openReferencedPathMenu } from "../lib/contextMenus";

export function Dupes() {
  const t = useTheme();
  const dirs = useStore((s) => s.dirs);
  const home = useStore((s) => s.home);
  const trashDir = useStore((s) => s.trashDir);
  const goPath = useStore((s) => s.goPath);
  const select = useStore((s) => s.select);

  const groups = useMemo(() => {
    const byKey = new Map<string, { path: string; dir: string }[]>();
    Object.entries(dirs).forEach(([dir, entries]) => {
      if (dir === trashDir) return;
      entries.forEach((e) => {
        if (e.isDir) return;
        const key = `${e.name}::${e.size}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push({ path: e.path, dir });
      });
    });
    return Array.from(byKey.entries())
      .filter(([, list]) => list.length > 1)
      .slice(0, 8);
  }, [dirs, trashDir]);

  return (
    <div>
      <div style={panelTitleStyle(t)}>Duplicates</div>
      <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
        {groups.map(([key, list]) => {
          const name = key.split("::")[0];
          return (
            <button
              key={key}
              onClick={() => {
                goPath(list[0].dir);
                setTimeout(() => select(list[0].path), 0);
              }}
              onContextMenu={(event) => openReferencedPathMenu(event, list[0].path)}
              style={{ textAlign: "left", border: 0, background: "transparent", padding: "4px 4px", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                <span style={{ fontFamily: t.mono, fontSize: 9.5, fontWeight: 700, color: "#fff", background: DUPE_BADGE, borderRadius: 99, padding: "1px 6px" }}>
                  {list.length}×
                </span>
              </div>
              <div style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint }}>
                {list.map((l) => "~" + l.dir.replace(home, "")).join(" · ")}
              </div>
            </button>
          );
        })}
        {groups.length === 0 && <div style={{ fontSize: 11.5, color: t.inkFaint }}>No duplicates found — the keeper is tidy.</div>}
      </div>
    </div>
  );
}
