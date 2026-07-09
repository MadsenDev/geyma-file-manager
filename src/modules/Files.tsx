import { tr } from "@/i18n";
import { useEffect, useState } from "react";
import type { FsEntry } from "../fs/types";
import { isGysetFileName } from "../lib/gyset";
import { openWithDefaultApp } from "../lib/openDefault";
import { BatchRenameModal } from "../overlays/BatchRenameModal";
import { PropertiesModal } from "../overlays/PropertiesModal";
import { compareEntries, useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { ErrorNotice } from "./common";
import { FileTile } from "./files/FileTile";
import { ghostSortEntry, GhostTile, type DisplayRow } from "./files/ghosts";
import { ListView } from "./files/ListView";
import { openFilesBlankMenu, openFilesItemMenu } from "./files/menus";
import { MissingItemsBanner } from "./files/MissingItemsBanner";
import { searchAll } from "./files/search";

export function Files() {
  const t = useTheme();
  const toolbarView = useStore((s) => s.view);
  const configuredView = useStore((s) => s.mcfg<"follow" | "grid" | "list">("files", "view", "follow"));
  const view = configuredView === "follow" ? toolbarView : configuredView;
  const path = useStore((s) => s.path);
  const home = useStore((s) => s.home);
  const trashView = useStore((s) => s.trashView);
  const trashDir = useStore((s) => s.trashDir);
  const loadDir = useStore((s) => s.loadDir);
  const dirError = useStore((s) => s.dirErrors[s.trashView ? s.trashDir : s.path]);
  const activeSetId = useStore((s) => s.activeSetId);
  const setDefs = useStore((s) => s.setDefs);
  const query = useStore((s) => s.query);
  const searchScope = useStore((s) => s.searchScope);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const goPath = useStore((s) => s.goPath);
  const starred = useStore((s) => s.starred);
  const renaming = useStore((s) => s.renaming);
  const renameVal = useStore((s) => s.renameVal);
  const commitRename = useStore((s) => s.commitRename);
  const cancelRename = useStore((s) => s.cancelRename);
  const moveEntries = useStore((s) => s.moveEntries);
  const batchRename = useStore((s) => s.batchRename);
  const [batchTargets, setBatchTargets] = useState<string[] | null>(null);
  const [propertiesTarget, setPropertiesTarget] = useState<FsEntry | null>(null);
  const showToast = useStore((s) => s.showToast);
  const showError = useStore((s) => s.showError);
  const ghostsForDir = useStore((s) => s.ghosts[path] || []);
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
  const activeSet = activeSetId ? setDefs.find((s) => s.id === activeSetId) : null;
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
      entry,
    })),
    ...(showGhosts ? ghostsForDir : []).map((ghost) => ({
      kind: "ghost" as const,
      ghost,
      entry: ghostSortEntry(ghost),
    })),
  ].sort((a, b) => compareEntries(a.entry, b.entry, sortKey, sortDir));

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
      showError(tr("ui.sets.import_failed"), e);
    }
  }
  function itemMenu(entry: FsEntry, e: React.MouseEvent) {
    openFilesItemMenu(entry, e, {
      onOpen,
      onBatchRename: setBatchTargets,
      onProperties: setPropertiesTarget,
    });
  }

  const batchModal = batchTargets && (
    <BatchRenameModal
      entries={sorted.filter((e) => batchTargets.includes(e.path))}
      onClose={() => setBatchTargets(null)}
      onConfirm={(template, startAt) => {
        void batchRename(batchTargets, template, startAt);
        setBatchTargets(null);
      }}
    />
  );

  const propertiesModal = propertiesTarget && (
    <PropertiesModal entry={propertiesTarget} onClose={() => setPropertiesTarget(null)} />
  );

  // A failed listing must not masquerade as an empty folder: when the current dir's
  // load errored, the "empty" slot shows what went wrong and offers a retry instead.
  if (dirError && !activeSet && sorted.length === 0) {
    const dir = trashView ? trashDir : path;
    return (
      <div
        onContextMenu={openFilesBlankMenu}
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 40,
        }}
      >
        <ErrorNotice
          t={t}
          message={tr("ui.files.load_failed")}
          detail={dirError.message}
          onRetry={() => void loadDir(dir, true)}
        />
        {batchModal}
        {propertiesModal}
      </div>
    );
  }
  if (sorted.length === 0 && showGhosts && ghostsForDir.length === 0) {
    return (
      <div
        onContextMenu={openFilesBlankMenu}
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 40,
        }}
      >
        <span style={{ fontSize: 12.5, color: t.inkFaint }}>
          {query.trim()
            ? tr("ui.files.no_matches")
            : trashView
              ? tr("ui.files.trash_is_empty")
              : tr("ui.files.empty_folder")}
        </span>
        {batchModal}
        {propertiesModal}
      </div>
    );
  }
  return (
    <div
      onContextMenu={openFilesBlankMenu}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        padding: 10,
      }}
      className="gy-list"
    >
      {activeSet && ruleScansActive > 0 && !!activeSet.rule && (
        <div style={{ fontSize: 11, color: t.inkFaint, padding: "2px 4px 8px" }}>
          {tr("ui.files.scanning_rule_roots")}
        </div>
      )}
      {activeSet && resolution && resolution.missing.length > 0 && (
        <MissingItemsBanner set={activeSet} missing={resolution.missing} />
      )}
      {view === "grid" ? (
        <div
          data-files-grid
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          {displayRows.map((row) =>
            row.kind === "ghost" ? (
              <GhostTile key={row.ghost.name + row.ghost.atMs} ghost={row.ghost} />
            ) : (
              <FileTile
                key={row.entry.path}
                entry={row.entry}
                selected={selected.includes(row.entry.path)}
                starred={starred.has(row.entry.path)}
                renaming={renaming === row.entry.path}
                renameVal={renameVal}
                onRenameChange={(v) => useStore.setState({ renameVal: v })}
                onRenameCommit={commitRename}
                onRenameCancel={cancelRename}
                onSelect={(e) =>
                  select(row.entry.path, {
                    ctrl: e.metaKey || e.ctrlKey,
                    shift: e.shiftKey,
                  })
                }
                onOpen={() => onOpen(row.entry)}
                onOpenInNewTab={() => (row.entry.isDir ? newTab(row.entry.path) : undefined)}
                onContextMenu={(e) => itemMenu(row.entry, e)}
                onDragStart={(e) => onDragStartItem(e, row.entry.path)}
                onDropFiles={(paths) => (row.entry.isDir ? void moveEntries(paths, row.entry.path) : undefined)}
              />
            ),
          )}
        </div>
      ) : (
        <ListView
          rows={displayRows}
          selected={selected}
          starred={starred}
          renaming={renaming}
          renameVal={renameVal}
          onRenameChange={(v) => useStore.setState({ renameVal: v })}
          onRenameCommit={commitRename}
          onRenameCancel={cancelRename}
          onSelect={select}
          onOpen={onOpen}
          onOpenInNewTab={(entry) => (entry.isDir ? newTab(entry.path) : undefined)}
          onContextMenu={itemMenu}
          onDragStart={onDragStartItem}
          onDropFiles={(dir, paths) => void moveEntries(paths, dir)}
        />
      )}
      {batchModal}
      {propertiesModal}
    </div>
  );
}
