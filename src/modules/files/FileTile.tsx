import { useState } from "react";
import type { FsEntry } from "../../fs/types";
import { Icon } from "../../icons/Icon";
import { ICONS } from "../../icons/paths";
import { extOf, formatSize, formatWhen, kindOf } from "../../lib/format";
import { hexA, itemColors } from "../../theme/skins";
import { useTheme } from "../../theme/ThemeContext";

export interface TileProps {
  entry: FsEntry;
  selected: boolean;
  starred: boolean;
  renaming: boolean;
  renameVal: string;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onOpenInNewTab: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDropFiles: (paths: string[]) => void;
}

export function FileTile({
  entry,
  selected,
  starred,
  renaming,
  renameVal,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onSelect,
  onOpen,
  onOpenInNewTab,
  onContextMenu,
  onDragStart,
  onDropFiles,
}: TileProps) {
  const t = useTheme();
  const [dragOver, setDragOver] = useState(false);
  const kind = kindOf(entry.name, entry.isDir);
  const colors = itemColors(kind, t);
  const ext = extOf(entry.name);
  return (
    <div
      data-file={entry.path}
      draggable
      onDragStart={onDragStart}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onOpenInNewTab();
        }
      }}
      onDragOver={(e) => {
        if (!entry.isDir) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const raw = e.dataTransfer.getData("application/x-geyma-paths");
        if (raw) onDropFiles(JSON.parse(raw));
      }}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "10px 6px",
        borderRadius: t.radius > 10 ? 12 : t.radius,
        cursor: "default",
        userSelect: "none",
        boxShadow: selected ? `0 0 0 1.5px ${t.accent}` : "none",
        background: selected
          ? hexA(t.accent, t.isDark ? 0.14 : 0.08)
          : dragOver
            ? hexA(t.accent, 0.1)
            : "transparent",
        outline: dragOver ? `2px solid ${t.accent}` : "none",
        outlineOffset: -2,
      }}
    >
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 10,
            background: colors.bg,
            color: colors.tint,
            display: "grid",
            placeItems: "center",
          }}
        >
          {entry.isDir ? (
            <Icon d={ICONS.folder} size={22} color={colors.tint} />
          ) : (
            <span style={{ fontFamily: t.mono, fontSize: 8, fontWeight: 700, letterSpacing: ".02em" }}>
              {ext || "•"}
            </span>
          )}
        </div>
        {starred && (
          <span style={{ position: "absolute", top: -4, right: -4, color: "#D89B2B", fontSize: 12 }}>★</span>
        )}
      </div>
      {renaming ? (
        <input
          autoFocus
          value={renameVal}
          onChange={(e) => onRenameChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameCommit();
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={onRenameCommit}
          style={{
            width: "100%",
            fontSize: 12.5,
            textAlign: "center",
            border: `1px solid ${t.accent}`,
            borderRadius: 6,
            padding: "1px 4px",
          }}
        />
      ) : (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            wordBreak: "break-word",
            lineHeight: 1.25,
          }}
        >
          {entry.name}
        </span>
      )}
      <span style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint }}>
        {entry.isDir ? formatWhen(entry.modifiedMs) : `${formatSize(entry.size)}`}
      </span>
    </div>
  );
}
