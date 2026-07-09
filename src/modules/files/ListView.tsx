import { tr } from "@/i18n";
import { useState } from "react";
import type { FsEntry } from "../../fs/types";
import { Icon } from "../../icons/Icon";
import { ICONS } from "../../icons/paths";
import { extOf, formatSize, formatWhen, kindOf } from "../../lib/format";
import { useStore } from "../../state/store";
import { hexA, itemColors } from "../../theme/skins";
import { useTheme } from "../../theme/ThemeContext";
import type { TileProps } from "./FileTile";
import { GhostRow, type DisplayRow } from "./ghosts";

interface ListProps {
  rows: DisplayRow[];
  selected: string[];
  starred: Set<string>;
  renaming: string | null;
  renameVal: string;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onSelect: (path: string, opts?: { ctrl?: boolean; shift?: boolean }) => void;
  onOpen: (entry: FsEntry) => void;
  onOpenInNewTab: (entry: FsEntry) => void;
  onContextMenu: (entry: FsEntry, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, path: string) => void;
  onDropFiles: (dir: string, paths: string[]) => void;
}

export function ListView({
  rows,
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
}: ListProps) {
  const t = useTheme();
  const columns = useStore((s) => s.columns);
  const sortKey = useStore((s) => s.sortKey);
  const sortDir = useStore((s) => s.sortDir);
  const setSort = useStore((s) => s.setSort);
  return (
    <div>
      <div
        style={{
          display: "flex",
          padding: "4px 8px",
          fontFamily: t.mono,
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          color: t.inkFaint,
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <HeaderCell grow active={sortKey === "name"} dir={sortDir} onClick={() => setSort("name")}>
          {tr("ui.files.name")}
        </HeaderCell>
        {columns.includes("kind") && (
          <HeaderCell className="gy-c-kind" width={100} active={sortKey === "kind"} dir={sortDir} onClick={() => setSort("kind")}>
            {tr("ui.files.kind")}
          </HeaderCell>
        )}
        {columns.includes("size") && (
          <HeaderCell className="gy-c-size" width={90} active={sortKey === "size"} dir={sortDir} onClick={() => setSort("size")}>
            {tr("ui.files.size")}
          </HeaderCell>
        )}
        {columns.includes("modified") && (
          <HeaderCell className="gy-c-modified" width={138} active={sortKey === "modified"} dir={sortDir} onClick={() => setSort("modified")}>
            {tr("ui.files.modified")}
          </HeaderCell>
        )}
      </div>
      {rows.map((row) =>
        row.kind === "ghost" ? (
          <GhostRow key={row.ghost.name + row.ghost.atMs} ghost={row.ghost} />
        ) : (
          <FileRow
            key={row.entry.path}
            entry={row.entry}
            columns={columns}
            selected={selected.includes(row.entry.path)}
            starred={starred.has(row.entry.path)}
            renaming={renaming === row.entry.path}
            renameVal={renameVal}
            onRenameChange={onRenameChange}
            onRenameCommit={onRenameCommit}
            onRenameCancel={onRenameCancel}
            onSelect={(e) =>
              onSelect(row.entry.path, {
                ctrl: e.metaKey || e.ctrlKey,
                shift: e.shiftKey,
              })
            }
            onOpen={() => onOpen(row.entry)}
            onOpenInNewTab={() => onOpenInNewTab(row.entry)}
            onContextMenu={(e) => onContextMenu(row.entry, e)}
            onDragStart={(e) => onDragStart(e, row.entry.path)}
            onDropFiles={(paths) => (row.entry.isDir ? onDropFiles(row.entry.path, paths) : undefined)}
          />
        ),
      )}
    </div>
  );
}

function HeaderCell({
  width,
  grow,
  active,
  dir,
  onClick,
  children,
  className,
}: {
  width?: number;
  grow?: boolean;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTheme();
  return (
    <button
      onClick={onClick}
      className={className}
      style={{
        width,
        flex: grow ? 1 : undefined,
        padding: grow ? 0 : undefined,
        textAlign: grow ? "left" : "right",
        border: 0,
        background: "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        color: active ? t.accent : t.inkFaint,
        fontWeight: active ? 700 : 500,
        fontSize: "inherit",
        textTransform: "inherit",
        letterSpacing: "inherit",
      }}
    >
      {children}
      {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

function FileRow({
  entry,
  columns,
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
}: TileProps & { columns: string[] }) {
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
      className="gy-row"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "6px 8px",
        fontSize: 13,
        borderBottom: `1px solid ${t.border}`,
        background: selected
          ? hexA(t.accent, t.isDark ? 0.16 : 0.09)
          : dragOver
            ? hexA(t.accent, 0.1)
            : "transparent",
        outline: dragOver ? `2px solid ${t.accent}` : "none",
        outlineOffset: -2,
        cursor: "default",
        userSelect: "none",
      }}
    >
      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: colors.bg,
            color: colors.tint,
            display: "grid",
            placeItems: "center",
            flex: "none",
          }}
        >
          {entry.isDir ? (
            <Icon d={ICONS.folder} size={13} color={colors.tint} />
          ) : (
            <span style={{ fontFamily: t.mono, fontSize: 7, fontWeight: 700 }}>{ext.slice(0, 3) || "•"}</span>
          )}
        </span>
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
              fontSize: 13,
              border: `1px solid ${t.accent}`,
              borderRadius: 6,
              padding: "1px 4px",
              minWidth: 0,
            }}
          />
        ) : (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
        )}
        {starred && <span style={{ color: "#D89B2B", fontSize: 11 }}>★</span>}
      </span>
      {columns.includes("kind") && (
        <span
          className="gy-c-kind"
          style={{ width: 100, textAlign: "right", fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}
        >
          {entry.isDir ? tr("ui.files.folder") : tr(`kind.${kind}`)}
        </span>
      )}
      {columns.includes("size") && (
        <span
          className="gy-c-size"
          style={{ width: 90, textAlign: "right", fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}
        >
          {entry.isDir ? "—" : formatSize(entry.size)}
        </span>
      )}
      {columns.includes("modified") && (
        <span
          className="gy-c-modified"
          style={{ width: 138, textAlign: "right", fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}
        >
          {formatWhen(entry.modifiedMs)}
        </span>
      )}
    </div>
  );
}
