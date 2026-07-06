import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { navItemStyle, panelTitleStyle } from "./common";
import { openLocationMenu } from "../lib/contextMenus";

export function Devices() {
  const t = useTheme();
  const path = useStore((s) => s.path);
  const goPlace = useStore((s) => s.goPlace);
  const moveEntries = useStore((s) => s.moveEntries);
  const devices = useStore((s) => s.devices);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const all = [{ label: "System", path: "/", icon: ICONS.system }, ...devices.map((d) => ({ label: d.label, path: d.path, icon: ICONS.usb }))];

  return (
    <div>
      <div style={panelTitleStyle(t)}>Devices</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 6px 8px" }}>
        {all.map((d) => (
          <button
            key={d.path}
            className="gy-item"
            onClick={() => goPlace(d.path)}
            onContextMenu={(event) => openLocationMenu(event, d.path)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(d.path);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const raw = e.dataTransfer.getData("application/x-geyma-paths");
              if (raw) void moveEntries(JSON.parse(raw), d.path);
            }}
            style={navItemStyle(t, path === d.path, dragOver === d.path)}
          >
            <Icon d={d.icon} size={15} />
            <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
          </button>
        ))}
        {all.length === 1 && <div style={{ padding: "6px 9px", fontSize: 11.5, color: t.inkFaint }}>No external devices detected</div>}
      </div>
    </div>
  );
}
