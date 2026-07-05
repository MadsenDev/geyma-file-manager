import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA, itemColors } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { extOf, formatSize, formatWhen, kindOf } from "../lib/format";
import type { FsEntry } from "../fs/types";
import { getFsBackend } from "../fs";
import type { Ghost } from "../state/types";
import { joinPosix } from "../fs/pathUtil";

async function searchAll(root: string, query: string, cap = 1500): Promise<FsEntry[]> {
  const backend = await getFsBackend();
  const out: FsEntry[] = [];
  const q = query.toLowerCase();
  async function walk(dir: string, depth: number) {
    if (out.length >= cap || depth > 8) return;
    let list: FsEntry[] = [];
    try {
      list = await backend.listDir(dir);
    } catch {
      return;
    }
    for (const e of list) {
      if (e.isHidden) continue;
      if (e.name.toLowerCase().includes(q)) out.push(e);
      if (e.isDir) await walk(e.path, depth + 1);
      if (out.length >= cap) return;
    }
  }
  await walk(root, 0);
  return out;
}

export function Files() {
  const t = useTheme();
  const view = useStore((s) => s.view);
  const path = useStore((s) => s.path);
  const home = useStore((s) => s.home);
  const trashView = useStore((s) => s.trashView);
  const trashDir = useStore((s) => s.trashDir);
  const activeSetId = useStore((s) => s.activeSetId);
  const setDefs = useStore((s) => s.setDefs);
  const setEntriesFor = useStore((s) => s.setEntriesFor);
  const dirEntries = useStore((s) => s.entriesFor(trashView ? trashDir : path));
  const query = useStore((s) => s.query);
  const searchScope = useStore((s) => s.searchScope);
  const filters = useStore((s) => s.filters);
  const showHidden = useStore((s) => s.showHidden);
  const sortKey = useStore((s) => s.sortKey);
  const sortDir = useStore((s) => s.sortDir);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const goPath = useStore((s) => s.goPath);
  const openPreview = useStore((s) => s.openPreview);
  const starred = useStore((s) => s.starred);
  const toggleStar = useStore((s) => s.toggleStar);
  const renaming = useStore((s) => s.renaming);
  const renameVal = useStore((s) => s.renameVal);
  const startRename = useStore((s) => s.startRename);
  const commitRename = useStore((s) => s.commitRename);
  const cancelRename = useStore((s) => s.cancelRename);
  const moveEntries = useStore((s) => s.moveEntries);
  const trashEntries = useStore((s) => s.trashEntries);
  const restoreEntries = useStore((s) => s.restoreEntries);
  const requestPermanentDelete = useStore((s) => s.requestPermanentDelete);
  const openMenu = useStore((s) => s.openMenu);
  const setClip = useStore((s) => s.setClip);
  const pasteClip = useStore((s) => s.pasteClip);
  const createFolder = useStore((s) => s.createFolder);
  const createTextFile = useStore((s) => s.createTextFile);
  const addToSet = useStore((s) => s.addToSet);
  const ghostsForDir = useStore((s) => s.ghosts[path] || []);
  const showModule = useStore((s) => s.showModule);
  const goPath2 = useStore((s) => s.goPath2);
  const backend = useStore((s) => s.backend);

  const [allResults, setAllResults] = useState<FsEntry[] | null>(null);

  useEffect(() => {
    if (searchScope !== "all" || !query.trim()) {
      setAllResults(null);
      return;
    }
    let cancelled = false;
    searchAll(home, query.trim()).then((r) => {
      if (!cancelled) setAllResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [searchScope, query, home]);

  const activeSet = activeSetId ? setDefs.find((s) => s.id === activeSetId) : null;

  const baseEntries: FsEntry[] = activeSet
    ? setEntriesFor(activeSet)
    : searchScope === "all" && query.trim() && allResults
      ? allResults
      : dirEntries;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseEntries.filter((e) => {
      if (!showHidden && e.isHidden && !trashView) return false;
      const kind = kindOf(e.name, e.isDir);
      if (filters.kind && kind !== filters.kind) return false;
      if (filters.starred && !starred.has(e.path)) return false;
      if (q && searchScope === "folder") {
        const ext = extOf(e.name).toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !kind.includes(q) && !ext.includes(q)) return false;
      }
      return true;
    });
  }, [baseEntries, showHidden, filters, starred, query, searchScope, trashView]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "kind") cmp = kindOf(a.name, a.isDir).localeCompare(kindOf(b.name, b.isDir));
      else if (sortKey === "size") cmp = a.size - b.size;
      else if (sortKey === "modified") cmp = a.modifiedMs - b.modifiedMs;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const showGhosts = !trashView && !activeSet && !query.trim();

  function onDragStartItem(e: React.DragEvent, entryPath: string) {
    const paths = selected.includes(entryPath) ? selected : [entryPath];
    if (!selected.includes(entryPath)) select(entryPath);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-geyma-paths", JSON.stringify(paths));
    e.dataTransfer.setData("text/plain", paths.join("\n"));
  }

  function onOpen(entry: FsEntry) {
    if (entry.isDir) goPath(entry.path);
    else openPreview(entry.path);
  }

  function itemMenu(entry: FsEntry, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!selected.includes(entry.path)) select(entry.path);
    const isStarred = starred.has(entry.path);
    if (trashView) {
      openMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: "Restore", onClick: () => restoreEntries([entry.path]) },
          { divider: true },
          { label: "Delete permanently", danger: true, onClick: () => requestPermanentDelete([entry.path]) },
        ],
      });
      return;
    }
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Open", onClick: () => onOpen(entry) },
        !entry.isDir ? { label: "Quick Look", onClick: () => openPreview(entry.path) } : undefined,
        { label: isStarred ? "Remove star" : "Star", onClick: () => toggleStar([entry.path]) },
        entry.isDir
          ? {
              label: "Open in lower pane",
              onClick: () => {
                showModule("files2", "center2");
                goPath2(entry.path);
              },
            }
          : undefined,
        { divider: true },
        { label: "Cut", onClick: () => setClip("cut", [entry.path]) },
        { label: "Add to set…", onClick: () => addToSetPrompt(entry) },
        { divider: true },
        { label: "Rename", onClick: () => startRename(entry.path) },
        { label: "Trash", danger: true, onClick: () => trashEntries([entry.path]) },
      ].filter(Boolean) as { label: string; onClick?: () => void; danger?: boolean; divider?: boolean }[],
    });
  }

  function addToSetPrompt(entry: FsEntry) {
    const manualSets = useStore.getState().setDefs.filter((s) => !s.smart);
    if (manualSets.length === 0) {
      useStore.getState().showToast("Create a working set first from the Sets module.");
      return;
    }
    addToSet(manualSets[0].id, [{ dir: backend?.dirname(entry.path) || path, name: entry.name }]);
    useStore.getState().showToast(`Added to "${manualSets[0].name}"`);
  }

  function onBlankMenu(e: React.MouseEvent) {
    e.preventDefault();
    const clip = useStore.getState().clip;
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "New Folder", onClick: () => void createFolder() },
        { label: "New Text File", onClick: () => void createTextFile("text") },
        { label: "New Markdown Note", onClick: () => void createTextFile("markdown") },
        { divider: true },
        clip ? { label: "Paste", onClick: () => void pasteClip() } : undefined,
        { label: "Select all", onClick: () => useStore.getState().selectAll() },
      ].filter(Boolean) as { label: string; onClick?: () => void; divider?: boolean }[],
    });
  }

  if (sorted.length === 0 && showGhosts && ghostsForDir.length === 0) {
    return (
      <div onContextMenu={onBlankMenu} style={{ flex: 1, display: "grid", placeItems: "center", padding: 40 }}>
        <span style={{ fontSize: 12.5, color: t.inkFaint }}>
          {query.trim() ? "No matches" : trashView ? "Trash is empty" : "Empty folder"}
        </span>
      </div>
    );
  }

  return (
    <div onContextMenu={onBlankMenu} style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 10 }} className="gy-list">
      {view === "grid" ? (
        <div
          data-files-grid
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}
        >
          {sorted.map((entry) => (
            <FileTile
              key={entry.path}
              entry={entry}
              selected={selected.includes(entry.path)}
              starred={starred.has(entry.path)}
              renaming={renaming === entry.path}
              renameVal={renameVal}
              onRenameChange={(v) => useStore.setState({ renameVal: v })}
              onRenameCommit={commitRename}
              onRenameCancel={cancelRename}
              onSelect={(e) => select(entry.path, { ctrl: e.metaKey || e.ctrlKey, shift: e.shiftKey })}
              onOpen={() => onOpen(entry)}
              onContextMenu={(e) => itemMenu(entry, e)}
              onDragStart={(e) => onDragStartItem(e, entry.path)}
              onDropFiles={(paths) => (entry.isDir ? void moveEntries(paths, entry.path) : undefined)}
            />
          ))}
          {showGhosts &&
            ghostsForDir.map((g) => <GhostTile key={g.name + g.atMs} ghost={g} />)}
        </div>
      ) : (
        <ListView
          entries={sorted}
          ghosts={showGhosts ? ghostsForDir : []}
          selected={selected}
          starred={starred}
          renaming={renaming}
          renameVal={renameVal}
          onRenameChange={(v) => useStore.setState({ renameVal: v })}
          onRenameCommit={commitRename}
          onRenameCancel={cancelRename}
          onSelect={select}
          onOpen={onOpen}
          onContextMenu={itemMenu}
          onDragStart={onDragStartItem}
          onDropFiles={(dir, paths) => void moveEntries(paths, dir)}
        />
      )}
    </div>
  );
}

interface TileProps {
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
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDropFiles: (paths: string[]) => void;
}

function FileTile({ entry, selected, starred, renaming, renameVal, onRenameChange, onRenameCommit, onRenameCancel, onSelect, onOpen, onContextMenu, onDragStart, onDropFiles }: TileProps) {
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
        boxShadow: selected ? `0 0 0 1.5px ${t.accent}` : "none",
        background: selected ? hexA(t.accent, t.isDark ? 0.14 : 0.08) : dragOver ? hexA(t.accent, 0.1) : "transparent",
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
          {entry.isDir ? <Icon d={ICONS.folder} size={22} color={colors.tint} /> : (
            <span style={{ fontFamily: t.mono, fontSize: 8, fontWeight: 700, letterSpacing: ".02em" }}>{ext || "•"}</span>
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
          style={{ width: "100%", fontSize: 12.5, textAlign: "center", border: `1px solid ${t.accent}`, borderRadius: 6, padding: "1px 4px" }}
        />
      ) : (
        <span style={{ fontSize: 13, fontWeight: 600, textAlign: "center", wordBreak: "break-word", lineHeight: 1.25 }}>{entry.name}</span>
      )}
      <span style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint }}>
        {entry.isDir ? formatWhen(entry.modifiedMs) : `${formatSize(entry.size)}`}
      </span>
    </div>
  );
}

function GhostTile({ ghost }: { ghost: Ghost }) {
  const t = useTheme();
  const goPath = useStore((s) => s.goPath);
  const select = useStore((s) => s.select);
  return (
    <div
      onClick={() => {
        goPath(ghost.toDir);
        setTimeout(() => select(joinPosix(ghost.toDir, ghost.toName)), 0);
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "10px 6px",
        borderRadius: 12,
        border: `1.5px dashed ${hexA(t.ink, 0.28)}`,
        opacity: 0.55,
        cursor: "pointer",
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 10, border: `1.5px dashed ${hexA(t.ink, 0.28)}` }} />
      <span style={{ fontSize: 12.5, fontStyle: "italic", textAlign: "center" }}>{ghost.name}</span>
      <span style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint }}>→ {ghost.toDir}</span>
    </div>
  );
}

interface ListProps {
  entries: FsEntry[];
  ghosts: Ghost[];
  selected: string[];
  starred: Set<string>;
  renaming: string | null;
  renameVal: string;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onSelect: (path: string, opts?: { ctrl?: boolean; shift?: boolean }) => void;
  onOpen: (entry: FsEntry) => void;
  onContextMenu: (entry: FsEntry, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, path: string) => void;
  onDropFiles: (dir: string, paths: string[]) => void;
}

function ListView({ entries, ghosts, selected, starred, renaming, renameVal, onRenameChange, onRenameCommit, onRenameCancel, onSelect, onOpen, onContextMenu, onDragStart, onDropFiles }: ListProps) {
  const t = useTheme();
  const columns = useStore((s) => s.columns);
  const sortKey = useStore((s) => s.sortKey);
  const sortDir = useStore((s) => s.sortDir);
  const setSort = useStore((s) => s.setSort);

  return (
    <div>
      <div style={{ display: "flex", padding: "4px 8px", fontFamily: t.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: t.inkFaint, borderBottom: `1px solid ${t.border}` }}>
        <span style={{ flex: 1 }}>Name</span>
        {columns.includes("kind") && (
          <HeaderCell className="gy-c-kind" width={100} active={sortKey === "kind"} dir={sortDir} onClick={() => setSort("kind")}>Kind</HeaderCell>
        )}
        {columns.includes("size") && (
          <HeaderCell className="gy-c-size" width={90} active={sortKey === "size"} dir={sortDir} onClick={() => setSort("size")}>Size</HeaderCell>
        )}
        {columns.includes("modified") && (
          <HeaderCell className="gy-c-modified" width={138} active={sortKey === "modified"} dir={sortDir} onClick={() => setSort("modified")}>Modified</HeaderCell>
        )}
      </div>
      {entries.map((entry) => (
        <FileRow
          key={entry.path}
          entry={entry}
          columns={columns}
          selected={selected.includes(entry.path)}
          starred={starred.has(entry.path)}
          renaming={renaming === entry.path}
          renameVal={renameVal}
          onRenameChange={onRenameChange}
          onRenameCommit={onRenameCommit}
          onRenameCancel={onRenameCancel}
          onSelect={(e) => onSelect(entry.path, { ctrl: e.metaKey || e.ctrlKey, shift: e.shiftKey })}
          onOpen={() => onOpen(entry)}
          onContextMenu={(e) => onContextMenu(entry, e)}
          onDragStart={(e) => onDragStart(e, entry.path)}
          onDropFiles={(paths) => (entry.isDir ? onDropFiles(entry.path, paths) : undefined)}
        />
      ))}
      {ghosts.map((g) => (
        <div key={g.name + g.atMs} style={{ display: "flex", padding: "6px 8px", opacity: 0.55, fontStyle: "italic", fontSize: 12.5, borderBottom: `1px solid ${t.border}` }}>
          <span style={{ flex: 1 }}>{g.name}</span>
          <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>→ {g.toDir}</span>
        </div>
      ))}
    </div>
  );
}

function HeaderCell({ width, active, dir, onClick, children, className }: { width: number; active: boolean; dir: "asc" | "desc"; onClick: () => void; children: React.ReactNode; className?: string }) {
  const t = useTheme();
  return (
    <button onClick={onClick} className={className} style={{ width, textAlign: "right", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", color: active ? t.accent : t.inkFaint, fontWeight: active ? 700 : 500, fontSize: "inherit", textTransform: "inherit", letterSpacing: "inherit" }}>
      {children}
      {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

function FileRow({ entry, columns, selected, starred, renaming, renameVal, onRenameChange, onRenameCommit, onRenameCancel, onSelect, onOpen, onContextMenu, onDragStart, onDropFiles }: TileProps & { columns: string[] }) {
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
        background: selected ? hexA(t.accent, t.isDark ? 0.16 : 0.09) : dragOver ? hexA(t.accent, 0.1) : "transparent",
        outline: dragOver ? `2px solid ${t.accent}` : "none",
        outlineOffset: -2,
        cursor: "default",
      }}
    >
      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: colors.bg, color: colors.tint, display: "grid", placeItems: "center", flex: "none" }}>
          {entry.isDir ? <Icon d={ICONS.folder} size={13} color={colors.tint} /> : <span style={{ fontFamily: t.mono, fontSize: 7, fontWeight: 700 }}>{ext.slice(0, 3) || "•"}</span>}
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
            style={{ fontSize: 13, border: `1px solid ${t.accent}`, borderRadius: 6, padding: "1px 4px", minWidth: 0 }}
          />
        ) : (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
        )}
        {starred && <span style={{ color: "#D89B2B", fontSize: 11 }}>★</span>}
      </span>
      {columns.includes("kind") && (
        <span className="gy-c-kind" style={{ width: 100, textAlign: "right", fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}>
          {entry.isDir ? "Folder" : kind}
        </span>
      )}
      {columns.includes("size") && (
        <span className="gy-c-size" style={{ width: 90, textAlign: "right", fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}>
          {entry.isDir ? "—" : formatSize(entry.size)}
        </span>
      )}
      {columns.includes("modified") && (
        <span className="gy-c-modified" style={{ width: 138, textAlign: "right", fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}>
          {formatWhen(entry.modifiedMs)}
        </span>
      )}
    </div>
  );
}
