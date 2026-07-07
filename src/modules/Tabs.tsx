import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { iconButtonStyle } from "./common";
import type { TabState } from "../state/types";

export function Tabs() {
  const t = useTheme();
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const home = useStore((s) => s.home);
  const backend = useStore((s) => s.backend);
  const setDefs = useStore((s) => s.setDefs);
  const newTab = useStore((s) => s.newTab);
  const switchTab = useStore((s) => s.switchTab);
  const closeTab = useStore((s) => s.closeTab);
  const closeOtherTabs = useStore((s) => s.closeOtherTabs);
  const closeTabsToRight = useStore((s) => s.closeTabsToRight);
  const duplicateTab = useStore((s) => s.duplicateTab);
  const reorderTab = useStore((s) => s.reorderTab);
  const openMenu = useStore((s) => s.openMenu);
  const [dragId, setDragId] = useState<string | null>(null);

  function labelFor(tab: TabState): { icon: string; text: string } {
    if (tab.trashView) return { icon: ICONS.trash, text: "Trash" };
    if (tab.activeSetId) {
      const set = setDefs.find((s) => s.id === tab.activeSetId);
      return { icon: ICONS.star, text: set?.name || "Set" };
    }
    const text = tab.path === home ? "Home" : backend?.basename(tab.path) || tab.path;
    return { icon: ICONS.folder, text };
  }

  function tabMenu(tab: TabState, index: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "New Tab", onClick: () => newTab() },
        { label: "Duplicate Tab", onClick: () => duplicateTab(tab.id) },
        { divider: true },
        { label: "Close Tab", onClick: () => closeTab(tab.id) },
        tabs.length > 1 ? { label: "Close Other Tabs", onClick: () => closeOtherTabs(tab.id) } : undefined,
        index < tabs.length - 1 ? { label: "Close Tabs to the Right", onClick: () => closeTabsToRight(tab.id) } : undefined,
        { divider: true },
        {
          label: "Copy path",
          onClick: () => {
            void navigator.clipboard.writeText(tab.path);
          },
        },
      ].filter(Boolean) as { label: string; onClick?: () => void; divider?: boolean }[],
    });
  }

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, overflowX: "auto" }}
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) newTab();
      }}
    >
      {tabs.map((tab, i) => {
        const active = tab.id === activeTabId;
        const { icon, text } = labelFor(tab);
        return (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              setDragId(tab.id);
            }}
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== tab.id) reorderTab(dragId, i);
              setDragId(null);
            }}
            onDragEnd={() => setDragId(null)}
            onClick={() => !active && switchTab(tab.id)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                closeTab(tab.id);
              }
            }}
            onContextMenu={(e) => tabMenu(tab, i, e)}
            title={tab.path}
            className="gy-soft"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 6px 5px 10px",
              borderRadius: 8,
              cursor: "pointer",
              flex: "none",
              maxWidth: 180,
              minWidth: 0,
              background: active ? hexA(t.accent, t.isDark ? 0.2 : 0.14) : "transparent",
              color: active ? t.accent : t.inkSoft,
              border: `1px solid ${active ? hexA(t.accent, 0.35) : "transparent"}`,
              fontWeight: active ? 700 : 500,
              fontSize: 12,
            }}
          >
            <Icon d={icon} size={12} color={active ? t.accent : t.inkFaint} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{text}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                title="Close tab"
                style={{
                  width: 16,
                  height: 16,
                  display: "grid",
                  placeItems: "center",
                  border: 0,
                  background: "transparent",
                  borderRadius: 5,
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                  flex: "none",
                }}
              >
                <Icon d={ICONS.close} size={9} />
              </button>
            )}
          </div>
        );
      })}
      <button onClick={() => newTab()} title="New tab" className="gy-soft" style={{ ...iconButtonStyle(t), width: 24, height: 24, flex: "none" }}>
        <Icon d={ICONS.plus} size={13} />
      </button>
    </div>
  );
}
