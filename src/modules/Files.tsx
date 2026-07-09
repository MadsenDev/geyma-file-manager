import { tr } from "@/i18n";
import { useEffect, useState } from "react";
import { compareEntries, useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA, itemColors } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import {
  extOf,
  formatSize,
  formatWhen,
  isExtractableArchive,
  kindOf } from
"../lib/format";
import type { FsEntry } from "../fs/types";
import { getFsBackend } from "../fs";
import { isRemotePath, remoteBasename } from "../fs/remotePath";
import type { Ghost, SetItemRef, WorkingSet } from "../state/types";
import { basenamePosix, joinPosix } from "../fs/pathUtil";
import { openWithDefaultApp } from "../lib/openDefault";
import { isGysetFileName } from "../lib/gyset";
import { explainError } from "../lib/explainError";
import { BatchRenameModal } from "../overlays/BatchRenameModal";
import { PropertiesModal } from "../overlays/PropertiesModal";
async function searchAll(
root: string,
query: string,
cap = 1500)
: Promise<FsEntry[]> {
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
function fileOrigin(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return undefined;
  const rect = target.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}
export function Files() {
  const t = useTheme();
  const toolbarView = useStore((s) => s.view);
  const configuredView = useStore((s) =>
  s.mcfg<"follow" | "grid" | "list">("files", "view", "follow")
  );
  const view = configuredView === "follow" ? toolbarView : configuredView;
  const path = useStore((s) => s.path);
  const home = useStore((s) => s.home);
  const trashView = useStore((s) => s.trashView);
  const activeSetId = useStore((s) => s.activeSetId);
  const setDefs = useStore((s) => s.setDefs);
  const query = useStore((s) => s.query);
  const searchScope = useStore((s) => s.searchScope);
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
  const duplicateEntries = useStore((s) => s.duplicateEntries);
  const extractHere = useStore((s) => s.extractHere);
  const compressEntries = useStore((s) => s.compressEntries);
  const createSymlinkFor = useStore((s) => s.createSymlinkFor);
  const batchRename = useStore((s) => s.batchRename);
  const [batchTargets, setBatchTargets] = useState<string[] | null>(null);
  const [propertiesTarget, setPropertiesTarget] = useState<FsEntry | null>(
    null
  );
  const showToast = useStore((s) => s.showToast);
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
  const newTab = useStore((s) => s.newTab);
  const setSearchAllResults = useStore((s) => s.setSearchAllResults);
  useEffect(() => {
    if (searchScope !== "all" || !query.trim()) {
      setSearchAllResults(null);
      return;
    }
    let cancelled = false;
    searchAll(home, query.trim()).then((r) => {
      if (!cancelled) setSearchAllResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [searchScope, query, home, setSearchAllResults]);
  const activeSet = activeSetId ?
  setDefs.find((s) => s.id === activeSetId) :
  null;
  const setResolutionFor = useStore((s) => s.setResolutionFor);
  const ruleScansActive = useStore((s) => s.ruleScansActive);
  const resolution = activeSet && !activeSet.smart ? setResolutionFor(activeSet) : null;

  // Kept in sync with the store's visibleEntries() — same filter/sort logic drives
  // the grid here, the Title item count, keyboard nav, select-all, and Quick Look.
  const sorted = useStore((s) => s.visibleEntries());
  const sortKey = useStore((s) => s.sortKey);
  const sortDir = useStore((s) => s.sortDir);
  const showGhosts = !trashView && !activeSet && !query.trim();

  // Ghosts sit exactly where the departed file used to sort. Both inputs are already
  // ordered by compareEntries and Array#sort is stable, so real entries keep the
  // visibleEntries() order that keyboard nav and item counts rely on.
  const displayRows: DisplayRow[] = [
  ...sorted.map((entry) => ({
    kind: "entry" as const,
    entry
  })),
  ...(showGhosts ? ghostsForDir : []).map((ghost) => ({
    kind: "ghost" as const,
    ghost,
    entry: ghostSortEntry(ghost)
  }))].
  sort((a, b) => compareEntries(a.entry, b.entry, sortKey, sortDir));
  function onDragStartItem(e: React.DragEvent, entryPath: string) {
    const paths = selected.includes(entryPath) ? selected : [entryPath];
    if (!selected.includes(entryPath)) select(entryPath);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-geyma-paths", JSON.stringify(paths));
    e.dataTransfer.setData("text/plain", paths.join("\n"));
  }
  function onOpen(entry: FsEntry) {
    if (entry.isDir) {
      goPath(entry.path);
      return;
    }
    if (isGysetFileName(entry.name)) {
      void importGysetFile(entry);
      return;
    }
    void openWithDefaultApp(entry.path);
  }
  async function importGysetFile(entry: FsEntry) {
    const st = useStore.getState();
    if (!st.backend) return;
    try {
      const text = await st.backend.previewTextFile(entry.path);
      const name = text && !text.truncated ? st.importSetFromText(text.content) : null;
      showToast(name ? tr("ui.sets.imported", { name }) : tr("ui.sets.bad_code"));
    } catch (e) {
      showToast(explainError(e));
    }
  }
  function itemMenu(entry: FsEntry, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const wasSelected = selected.includes(entry.path);
    if (!wasSelected) select(entry.path);
    const targets = wasSelected ? selected : [entry.path];
    const multi = targets.length > 1;
    const isStarred = starred.has(entry.path);
    const remote = isRemotePath(entry.path);
    if (trashView) {
      openMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
        {
          label: multi ?
          tr("ui.files.restore_length_items", {
            length: targets.length
          }) :
          tr("ui.files.restore"),
          onClick: () => restoreEntries(targets)
        },
        {
          divider: true
        },
        {
          label: multi ?
          tr("ui.files.delete_length_items_permanently", {
            length: targets.length
          }) :
          tr("ui.files.delete_permanently"),
          danger: true,
          onClick: () => requestPermanentDelete(targets)
        }]

      });
      return;
    }
    const manualSets = useStore.getState().setDefs.filter((s) => !s.smart);
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
      !multi ?
      {
        label: tr("ui.files.open"),
        onClick: () => onOpen(entry)
      } :
      undefined,
      !multi ?
      {
        label: tr("ui.files.quick_look"),
        onClick: () =>
        openPreview(entry.path, fileOrigin(e.currentTarget))
      } :
      undefined,
      {
        label: isStarred ? tr("ui.files.remove_star") : tr("ui.files.star"),
        onClick: () => toggleStar(targets)
      },
      !multi && entry.isDir ?
      {
        label: tr("ui.files.open_in_new_tab"),
        onClick: () => newTab(entry.path)
      } :
      undefined,
      !multi && entry.isDir ?
      {
        label: tr("ui.files.open_in_lower_pane"),
        onClick: () => {
          showModule("files2", "center2");
          goPath2(entry.path);
        }
      } :
      undefined,
      !multi && !remote && isExtractableArchive(entry.name) ?
      {
        label: tr("ui.files.extract_here"),
        onClick: () => void extractHere(entry.path)
      } :
      undefined,
      !multi && !remote ?
      {
        label: tr("ui.files.create_symlink_here"),
        onClick: () => void createSymlinkFor(entry.path)
      } :
      undefined,
      {
        divider: true
      },
      {
        label: tr("ui.files.cut"),
        onClick: () => setClip("cut", targets)
      },
      {
        label: tr("ui.files.copy"),
        onClick: () => setClip("copy", targets)
      },
      {
        label: multi ?
        tr("ui.files.duplicate_length_items", {
          length: targets.length
        }) :
        tr("ui.files.duplicate"),
        onClick: () => duplicateEntries(targets)
      },
      multi ?
      {
        label: tr("ui.files.batch_rename_length_items", {
          length: targets.length
        }),
        onClick: () => setBatchTargets(targets)
      } :
      undefined,
      remote ?
      undefined :
      {
        label: multi ?
        tr("ui.files.compress_length_items_to_zip", {
          length: targets.length
        }) :
        tr("ui.files.compress_name_to_zip", {
          name: entry.name
        }),
        onClick: () =>
        void compressEntries(
          targets,
          multi ?
          tr("ui.files.archive") : `${

          entry.name}.zip`

        )
      },
      {
        label: multi ? tr("ui.files.copy_paths") : tr("ui.files.copy_path"),
        onClick: () => {
          void navigator.clipboard.writeText(targets.join("\n"));
          showToast(
            multi ? tr("ui.files.paths_copied") : tr("ui.files.path_copied")
          );
        }
      },
      ...manualSets.map((s) => ({
        label: tr("ui.files.add_to_name", {
          name: s.name
        }),
        onClick: () =>
        addToSet(
          s.id,
          targets.map((p) => ({
            dir: backend?.dirname(p) || path,
            name: backend?.basename(p) || p
          }))
        )
      })),
      {
        divider: true
      },
      !multi ?
      {
        label: tr("ui.files.rename"),
        onClick: () => startRename(entry.path)
      } :
      undefined,
      !multi ?
      {
        label: tr("ui.files.properties"),
        onClick: () => setPropertiesTarget(entry)
      } :
      undefined,
      remote ?
      {
        label: multi ?
        tr("ui.files.delete_length_items_permanently", {
          length: targets.length
        }) :
        tr("ui.files.delete_permanently"),
        danger: true,
        onClick: () => requestPermanentDelete(targets)
      } :
      {
        label: multi ?
        tr("ui.files.trash_length_items", {
          length: targets.length
        }) :
        tr("ui.files.trash"),
        danger: true,
        onClick: () => trashEntries(targets)
      }].
      filter(Boolean) as {
        label: string;
        onClick?: () => void;
        danger?: boolean;
        divider?: boolean;
      }[]
    });
  }
  function onBlankMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const clip = useStore.getState().clip;
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
      {
        label: tr("ui.files.new_folder"),
        onClick: () => void createFolder()
      },
      {
        label: tr("ui.files.new_text_file"),
        onClick: () => void createTextFile("text")
      },
      {
        label: tr("ui.files.new_markdown_note"),
        onClick: () => void createTextFile("markdown")
      },
      {
        divider: true
      },
      clip ?
      {
        label: tr("ui.files.paste"),
        onClick: () => void pasteClip()
      } :
      undefined,
      {
        label: tr("ui.files.select_all"),
        onClick: () => useStore.getState().selectAll()
      }].
      filter(Boolean) as {
        label: string;
        onClick?: () => void;
        divider?: boolean;
      }[]
    });
  }
  const batchModal = batchTargets &&
  <BatchRenameModal
    entries={sorted.filter((e) => batchTargets.includes(e.path))}
    onClose={() => setBatchTargets(null)}
    onConfirm={(template, startAt) => {
      void batchRename(batchTargets, template, startAt);
      setBatchTargets(null);
    }} />;


  const propertiesModal = propertiesTarget &&
  <PropertiesModal
    entry={propertiesTarget}
    onClose={() => setPropertiesTarget(null)} />;


  if (sorted.length === 0 && showGhosts && ghostsForDir.length === 0) {
    return (
      <div
        onContextMenu={onBlankMenu}
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 40
        }}>
        
        <span
          style={{
            fontSize: 12.5,
            color: t.inkFaint
          }}>
          
          {query.trim() ?
          tr("ui.files.no_matches") :
          trashView ?
          tr("ui.files.trash_is_empty") :
          tr("ui.files.empty_folder")}
        </span>
        {batchModal}
        {propertiesModal}
      </div>);

  }
  return (
    <div
      onContextMenu={onBlankMenu}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        padding: 10
      }}
      className="gy-list">

      {activeSet && ruleScansActive > 0 && !!activeSet.rule &&
      <div
        style={{
          fontSize: 11,
          color: t.inkFaint,
          padding: "2px 4px 8px"
        }}>
        {tr("ui.files.scanning_rule_roots")}
      </div>
      }
      {activeSet && resolution && resolution.missing.length > 0 &&
      <MissingItemsBanner set={activeSet} missing={resolution.missing} />
      }
      {view === "grid" ?
      <div
        data-files-grid
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 10
        }}>
        
          {displayRows.map((row) =>
        row.kind === "ghost" ?
        <GhostTile
          key={row.ghost.name + row.ghost.atMs}
          ghost={row.ghost} /> :


        <FileTile
          key={row.entry.path}
          entry={row.entry}
          selected={selected.includes(row.entry.path)}
          starred={starred.has(row.entry.path)}
          renaming={renaming === row.entry.path}
          renameVal={renameVal}
          onRenameChange={(v) =>
          useStore.setState({
            renameVal: v
          })
          }
          onRenameCommit={commitRename}
          onRenameCancel={cancelRename}
          onSelect={(e) =>
          select(row.entry.path, {
            ctrl: e.metaKey || e.ctrlKey,
            shift: e.shiftKey
          })
          }
          onOpen={() => onOpen(row.entry)}
          onOpenInNewTab={() =>
          row.entry.isDir ? newTab(row.entry.path) : undefined
          }
          onContextMenu={(e) => itemMenu(row.entry, e)}
          onDragStart={(e) => onDragStartItem(e, row.entry.path)}
          onDropFiles={(paths) =>
          row.entry.isDir ?
          void moveEntries(paths, row.entry.path) :
          undefined
          } />


        )}
        </div> :

      <ListView
        rows={displayRows}
        selected={selected}
        starred={starred}
        renaming={renaming}
        renameVal={renameVal}
        onRenameChange={(v) =>
        useStore.setState({
          renameVal: v
        })
        }
        onRenameCommit={commitRename}
        onRenameCancel={cancelRename}
        onSelect={select}
        onOpen={onOpen}
        onOpenInNewTab={(entry) =>
        entry.isDir ? newTab(entry.path) : undefined
        }
        onContextMenu={itemMenu}
        onDragStart={onDragStartItem}
        onDropFiles={(dir, paths) => void moveEntries(paths, dir)} />

      }
      {batchModal}
      {propertiesModal}
    </div>);

}
const MISSING_AMBER = "#c98a2b";
// A working set holds references, so a ref whose folder is listed but whose name is
// gone is provably missing — surface it instead of silently shrinking the set. The
// Locate action walks the portable-matching ladder: exact path already failed, so try
// same-filename across browsed/scanned folders, and ask via menu when it's ambiguous.
function MissingItemsBanner({ set: setDef, missing }: { set: WorkingSet; missing: SetItemRef[] }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const showToast = useStore((s) => s.showToast);
  const removeFromSet = useStore((s) => s.removeFromSet);

  function locate(ref: SetItemRef, e: React.MouseEvent) {
    const st = useStore.getState();
    const candidates = Object.entries(st.dirs)
      .filter(([dir, entries]) => dir !== st.trashDir && dir !== ref.dir && entries.some((en) => en.name === ref.name))
      .map(([dir]) => dir);
    if (candidates.length === 0) {
      showToast(tr("ui.files.missing_no_candidates", { name: ref.name }));
      return;
    }
    if (candidates.length === 1) {
      st.relinkSetItem(setDef.id, ref, candidates[0]);
      showToast(tr("ui.files.missing_relinked", { dir: candidates[0] }));
      return;
    }
    st.openMenu({
      x: e.clientX,
      y: e.clientY,
      items: candidates.slice(0, 12).map((dir) => ({
        label: dir,
        onClick: () => {
          st.relinkSetItem(setDef.id, ref, dir);
          showToast(tr("ui.files.missing_relinked", { dir }));
        },
      })),
    });
  }

  const actionStyle = {
    border: `1px solid ${t.border}`,
    background: "transparent",
    color: t.inkSoft,
    borderRadius: 6,
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: 11,
  } as const;

  return (
    <div
      style={{
        border: `1px solid ${hexA(MISSING_AMBER, 0.4)}`,
        background: hexA(MISSING_AMBER, 0.08),
        borderRadius: 10,
        padding: "8px 12px",
        marginBottom: 10,
        fontSize: 12,
        color: t.ink,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          border: 0,
          background: "transparent",
          color: t.ink,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: 0,
          fontSize: 12,
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", color: MISSING_AMBER }}>
          <Icon d={ICONS.warning} size={14} />
        </span>
        <span style={{ flex: 1 }}>{tr("ui.files.missing_banner", { count: missing.length })}</span>
        <span style={{ color: t.inkFaint, fontFamily: t.mono, fontSize: 10 }}>
          {expanded ? tr("ui.files.missing_hide") : tr("ui.files.missing_show")}
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {missing.map((ref) => (
            <div
              key={`${ref.dir}/${ref.name}`}
              style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ref.name}</div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: t.inkFaint,
                    fontFamily: t.mono,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tr("ui.files.missing_last_seen", { dir: ref.dir })}
                </div>
              </div>
              <button className="gy-soft" style={actionStyle} onClick={(e) => locate(ref, e)}>
                {tr("ui.files.missing_locate")}
              </button>
              <button
                className="gy-soft"
                style={{ ...actionStyle, color: t.inkFaint }}
                onClick={() => removeFromSet(setDef.id, ref.dir, ref.name)}
              >
                {tr("ui.files.missing_remove")}
              </button>
            </div>
          ))}
        </div>
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
  onOpenInNewTab: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDropFiles: (paths: string[]) => void;
}
function FileTile({
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
  onDropFiles
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
        boxShadow: selected ? `0 0 0 1.5px ${

        t.accent}` :

        "none",
        background: selected ?
        hexA(t.accent, t.isDark ? 0.14 : 0.08) :
        dragOver ?
        hexA(t.accent, 0.1) :
        "transparent",
        outline: dragOver ? `2px solid ${

        t.accent}` :

        "none",
        outlineOffset: -2
      }}>
      
      <div
        style={{
          position: "relative"
        }}>
        
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 10,
            background: colors.bg,
            color: colors.tint,
            display: "grid",
            placeItems: "center"
          }}>
          
          {entry.isDir ?
          <Icon d={ICONS.folder} size={22} color={colors.tint} /> :

          <span
            style={{
              fontFamily: t.mono,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: ".02em"
            }}>
            
              {ext || "•"}
            </span>
          }
        </div>
        {starred &&
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            color: "#D89B2B",
            fontSize: 12
          }}>
          
            ★
          </span>
        }
      </div>
      {renaming ?
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
          border: `1px solid ${
          t.accent}`,

          borderRadius: 6,
          padding: "1px 4px"
        }} /> :


      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          textAlign: "center",
          wordBreak: "break-word",
          lineHeight: 1.25
        }}>
        
          {entry.name}
        </span>
      }
      <span
        style={{
          fontFamily: t.mono,
          fontSize: 9.5,
          color: t.inkFaint
        }}>
        
        {entry.isDir ?
        formatWhen(entry.modifiedMs) :
        `${formatSize(entry.size)}`}
      </span>
    </div>);

}
type DisplayRow =
{
  kind: "entry";
  entry: FsEntry;
} |
{
  kind: "ghost";
  ghost: Ghost;
  entry: FsEntry;
};

/** Stand-in FsEntry used only to sort a ghost into the spot its file occupied. */
function ghostSortEntry(g: Ghost): FsEntry {
  return {
    name: g.name,
    path: g.fromPath,
    isDir: g.isDir ?? false,
    size: g.size ?? 0,
    modifiedMs: g.modifiedMs ?? g.atMs,
    createdMs: g.modifiedMs ?? g.atMs,
    isHidden: false
  };
}
function ghostDestName(toDir: string): string {
  const name = isRemotePath(toDir) ?
  remoteBasename(toDir) :
  basenamePosix(toDir);
  return name || toDir;
}
function ghostAgo(atMs: number): string {
  const s = Math.max(0, Math.round((Date.now() - atMs) / 1000));
  if (s < 45) return tr("time.just_now");
  const m = Math.round(s / 60);
  if (m < 60)
  return tr("ui.files.m_m_ago", {
    m
  });
  const h = Math.round(m / 60);
  return h < 24 ?
  tr("ui.files.h_h_ago", {
    h
  }) :
  tr("ui.files.d_d_ago", { d: Math.round(h / 24) });
}
function useFollowGhost(ghost: Ghost) {
  const goPath = useStore((s) => s.goPath);
  const select = useStore((s) => s.select);
  return () => {
    goPath(ghost.toDir);
    setTimeout(() => select(joinPosix(ghost.toDir, ghost.toName)), 0);
  };
}
function GhostDismiss({
  ghost,
  visible,
  style




}: {ghost: Ghost;visible: boolean;style?: React.CSSProperties;}) {
  const t = useTheme();
  const dismissGhost = useStore((s) => s.dismissGhost);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        dismissGhost(ghost);
      }}
      title={tr("ui.files.dismiss")}
      className="gy-soft"
      style={{
        display: "grid",
        placeItems: "center",
        width: 18,
        height: 18,
        padding: 0,
        borderRadius: 99,
        border: "none",
        background: hexA(t.ink, 0.1),
        color: t.inkSoft,
        cursor: "pointer",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity .15s ease",
        ...style
      }}>
      
      <Icon d={ICONS.close} size={9} strokeWidth={2.4} />
    </button>);

}
function GhostDestChip({ ghost, hover }: {ghost: Ghost;hover: boolean;}) {
  const t = useTheme();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        maxWidth: "100%",
        padding: "2px 8px",
        borderRadius: 99,
        background: hexA(t.accent, hover ? 0.18 : 0.1),
        color: t.accent,
        fontSize: 10,
        fontWeight: 650,
        transition: "background .15s ease"
      }}>
      
      <Icon d={ICONS.chevronRight} size={9} strokeWidth={2.4} />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>
        
        {ghostDestName(ghost.toDir)}
      </span>
    </span>);

}
function GhostTile({ ghost }: {ghost: Ghost;}) {
  const t = useTheme();
  const follow = useFollowGhost(ghost);
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={follow}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={tr("ui.files.name_moved_to_to_dir_click_to_follow", {
        name: ghost.name,
        toDir: ghost.toDir
      })}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "10px 6px",
        borderRadius: 12,
        border: `1.5px dashed ${hover ? hexA(t.accent, 0.55) : hexA(t.ink, 0.22)}`,
        background: hover ? hexA(t.accent, 0.07) : "transparent",
        opacity: hover ? 1 : 0.65,
        cursor: "pointer",
        userSelect: "none",
        transition:
        "opacity .15s ease, border-color .15s ease, background .15s ease"
      }}>
      
      <GhostDismiss
        ghost={ghost}
        visible={hover}
        style={{
          position: "absolute",
          top: 5,
          right: 5
        }} />
      
      <div
        style={{
          position: "relative",
          width: 46,
          height: 46,
          display: "grid",
          placeItems: "center"
        }}>
        
        <span
          className="gy-ghost-bob"
          style={{
            display: "grid",
            placeItems: "center",
            color: hover ? t.accent : hexA(t.ink, 0.5),
            transition: "color .15s ease"
          }}>
          
          <Icon d={ICONS.ghost} size={30} strokeWidth={1.6} />
        </span>
        <span
          className="gy-ghost-shadow"
          style={{
            position: "absolute",
            bottom: 2,
            width: 18,
            height: 4,
            borderRadius: 99,
            background: hexA(t.ink, 0.35),
            opacity: 0.5
          }} />
        
      </div>
      <span
        style={{
          fontSize: 12.5,
          fontStyle: "italic",
          textAlign: "center",
          wordBreak: "break-word",
          lineHeight: 1.25,
          color: t.inkSoft
        }}>
        
        {ghost.name}
      </span>
      <GhostDestChip ghost={ghost} hover={hover} />
      <span
        style={{
          fontFamily: t.mono,
          fontSize: 9,
          color: hover ? t.accent : t.inkFaint,
          transition: "color .15s ease"
        }}>
        
        {hover ? tr("ui.files.click_to_follow") : tr("ui.files.moved_ago", { ago: ghostAgo(ghost.atMs) })}
      </span>
    </div>);

}
function GhostRow({ ghost }: {ghost: Ghost;}) {
  const t = useTheme();
  const follow = useFollowGhost(ghost);
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={follow}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={tr("ui.files.name_moved_to_to_dir_click_to_follow", {
        name: ghost.name,
        toDir: ghost.toDir
      })}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 8px",
        borderBottom: `1px solid ${
        t.border}`,

        cursor: "pointer",
        userSelect: "none",
        opacity: hover ? 1 : 0.62,
        background: hover ? hexA(t.accent, 0.06) : "transparent",
        transition: "opacity .15s ease, background .15s ease"
      }}>
      
      <span
        className="gy-ghost-bob"
        style={{
          display: "grid",
          placeItems: "center",
          color: hover ? t.accent : hexA(t.ink, 0.45),
          transition: "color .15s ease"
        }}>
        
        <Icon d={ICONS.ghost} size={15} strokeWidth={1.6} />
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontStyle: "italic",
          fontSize: 12.5,
          color: t.inkSoft,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>
        
        {ghost.name}
      </span>
      <GhostDestChip ghost={ghost} hover={hover} />
      <span
        style={{
          flex: "none",
          fontFamily: t.mono,
          fontSize: 9.5,
          color: hover ? t.accent : t.inkFaint,
          transition: "color .15s ease"
        }}>
        
        {hover ? "follow" : ghostAgo(ghost.atMs)}
      </span>
      <GhostDismiss
        ghost={ghost}
        visible={hover}
        style={{
          flex: "none"
        }} />
      
    </div>);

}
interface ListProps {
  rows: DisplayRow[];
  selected: string[];
  starred: Set<string>;
  renaming: string | null;
  renameVal: string;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onSelect: (
  path: string,
  opts?: {
    ctrl?: boolean;
    shift?: boolean;
  })
  => void;
  onOpen: (entry: FsEntry) => void;
  onOpenInNewTab: (entry: FsEntry) => void;
  onContextMenu: (entry: FsEntry, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, path: string) => void;
  onDropFiles: (dir: string, paths: string[]) => void;
}
function ListView({
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
  onDropFiles
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
          borderBottom: `1px solid ${
          t.border}`

        }}>
        
        <HeaderCell
          grow
          active={sortKey === "name"}
          dir={sortDir}
          onClick={() => setSort("name")}>
          
          {tr("ui.files.name")}
        </HeaderCell>
        {columns.includes("kind") &&
        <HeaderCell
          className="gy-c-kind"
          width={100}
          active={sortKey === "kind"}
          dir={sortDir}
          onClick={() => setSort("kind")}>
          
            {tr("ui.files.kind")}
          </HeaderCell>
        }
        {columns.includes("size") &&
        <HeaderCell
          className="gy-c-size"
          width={90}
          active={sortKey === "size"}
          dir={sortDir}
          onClick={() => setSort("size")}>
          
            {tr("ui.files.size")}
          </HeaderCell>
        }
        {columns.includes("modified") &&
        <HeaderCell
          className="gy-c-modified"
          width={138}
          active={sortKey === "modified"}
          dir={sortDir}
          onClick={() => setSort("modified")}>
          
            {tr("ui.files.modified")}
          </HeaderCell>
        }
      </div>
      {rows.map((row) =>
      row.kind === "ghost" ?
      <GhostRow key={row.ghost.name + row.ghost.atMs} ghost={row.ghost} /> :

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
          shift: e.shiftKey
        })
        }
        onOpen={() => onOpen(row.entry)}
        onOpenInNewTab={() => onOpenInNewTab(row.entry)}
        onContextMenu={(e) => onContextMenu(row.entry, e)}
        onDragStart={(e) => onDragStart(e, row.entry.path)}
        onDropFiles={(paths) =>
        row.entry.isDir ? onDropFiles(row.entry.path, paths) : undefined
        } />


      )}
    </div>);

}
function HeaderCell({
  width,
  grow,
  active,
  dir,
  onClick,
  children,
  className








}: {width?: number;grow?: boolean;active: boolean;dir: "asc" | "desc";onClick: () => void;children: React.ReactNode;className?: string;}) {
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
        letterSpacing: "inherit"
      }}>
      
      {children}
      {active ? dir === "asc" ? " ↑" : " ↓" : ""}
    </button>);

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
  onDropFiles


}: TileProps & {columns: string[];}) {
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
        borderBottom: `1px solid ${
        t.border}`,

        background: selected ?
        hexA(t.accent, t.isDark ? 0.16 : 0.09) :
        dragOver ?
        hexA(t.accent, 0.1) :
        "transparent",
        outline: dragOver ? `2px solid ${

        t.accent}` :

        "none",
        outlineOffset: -2,
        cursor: "default",
        userSelect: "none"
      }}>
      
      <span
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0
        }}>
        
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: colors.bg,
            color: colors.tint,
            display: "grid",
            placeItems: "center",
            flex: "none"
          }}>
          
          {entry.isDir ?
          <Icon d={ICONS.folder} size={13} color={colors.tint} /> :

          <span
            style={{
              fontFamily: t.mono,
              fontSize: 7,
              fontWeight: 700
            }}>
            
              {ext.slice(0, 3) || "•"}
            </span>
          }
        </span>
        {renaming ?
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
            border: `1px solid ${
            t.accent}`,

            borderRadius: 6,
            padding: "1px 4px",
            minWidth: 0
          }} /> :


        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
          
            {entry.name}
          </span>
        }
        {starred &&
        <span
          style={{
            color: "#D89B2B",
            fontSize: 11
          }}>
          
            ★
          </span>
        }
      </span>
      {columns.includes("kind") &&
      <span
        className="gy-c-kind"
        style={{
          width: 100,
          textAlign: "right",
          fontFamily: t.mono,
          fontSize: 10.5,
          color: t.inkFaint
        }}>
        
          {entry.isDir ? tr("ui.files.folder") : tr(`kind.${kind}`)}
        </span>
      }
      {columns.includes("size") &&
      <span
        className="gy-c-size"
        style={{
          width: 90,
          textAlign: "right",
          fontFamily: t.mono,
          fontSize: 10.5,
          color: t.inkFaint
        }}>
        
          {entry.isDir ? "—" : formatSize(entry.size)}
        </span>
      }
      {columns.includes("modified") &&
      <span
        className="gy-c-modified"
        style={{
          width: 138,
          textAlign: "right",
          fontFamily: t.mono,
          fontSize: 10.5,
          color: t.inkFaint
        }}>
        
          {formatWhen(entry.modifiedMs)}
        </span>
      }
    </div>);

}