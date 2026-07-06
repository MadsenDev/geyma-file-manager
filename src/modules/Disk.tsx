import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { formatSize } from "../lib/format";
import { panelTitleStyle } from "./common";
import type { DiskUsage } from "../fs/types";
import { openLocationMenu } from "../lib/contextMenus";

export function Disk() {
  const t = useTheme();
  const backend = useStore((s) => s.backend);
  const path = useStore((s) => s.path);
  const [usage, setUsage] = useState<DiskUsage | null>(null);

  useEffect(() => {
    if (!backend) return;
    let cancelled = false;
    backend.diskUsage(path).then((u) => {
      if (!cancelled) setUsage(u);
    }).catch(() => setUsage(null));
    return () => {
      cancelled = true;
    };
  }, [backend, path]);

  if (!usage) return null;

  const used = usage.total - usage.available;
  const pct = usage.total > 0 ? (used / usage.total) * 100 : 0;

  return (
    <div onContextMenu={(event) => openLocationMenu(event, path)}>
      <div style={panelTitleStyle(t)}>Disk usage</div>
      <div style={{ padding: "0 12px 12px" }}>
        <div style={{ height: 8, borderRadius: 99, background: hexA(t.ink, t.isDark ? 0.14 : 0.08), overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: t.accent }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: t.inkFaint, fontFamily: t.mono }}>
          <span>{formatSize(used)} used</span>
          <span>{formatSize(usage.total)} total</span>
        </div>
      </div>
    </div>
  );
}
