import { tr } from "@/i18n";
import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA, itemColors } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { extOf, formatSize, formatWhen, kindOf } from "../lib/format";
import { openLocationMenu, revealReferencedPath } from "../lib/contextMenus";
import { openWithDefaultApp } from "../lib/openDefault";
export function Files2() {
  const t = useTheme();
  const path2 = useStore((s) => s.path2);
  const backend = useStore((s) => s.backend);
  const showHidden = useStore((s) => s.showHidden);
  const rawEntries = useStore((s) => s.entriesFor(path2));
  const entries = rawEntries.
  filter((e) => showHidden || !e.isHidden).
  slice().
  sort((a, b) =>
  a.isDir !== b.isDir ? a.isDir ? -1 : 1 : a.name.localeCompare(b.name)
  );
  const goUp2 = useStore((s) => s.goUp2);
  const goPath2 = useStore((s) => s.goPath2);
  const moveEntries = useStore((s) => s.moveEntries);
  const selected2 = useStore((s) => s.selected2);
  const openMenu = useStore((s) => s.openMenu);
  const starred = useStore((s) => s.starred);
  const toggleStar = useStore((s) => s.toggleStar);
  const setClip = useStore((s) => s.setClip);
  const duplicateEntries = useStore((s) => s.duplicateEntries);
  const trashEntries = useStore((s) => s.trashEntries);
  const [dragOver, setDragOver] = useState(false);
  const canUp = backend ? backend.dirname(path2) !== path2 : false;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%"
      }}>
      
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderBottom: `1px solid ${
          t.border}`

        }}>
        
        <button
          onClick={goUp2}
          disabled={!canUp}
          className="gy-soft"
          title={tr("ui.files2.up")}
          style={{
            width: 24,
            height: 24,
            display: "grid",
            placeItems: "center",
            border: `1px solid ${
            t.border}`,

            borderRadius: 7,
            background: "transparent",
            color: t.inkSoft,
            opacity: canUp ? 1 : 0.35
          }}>
          
          <Icon d={ICONS.chevronUp} size={13} />
        </button>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700
          }}>
          
          {backend?.basename(path2) || path2}
        </span>
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 9.5,
            color: t.inkFaint,
            marginLeft: "auto"
          }}>
          
          {tr("ui.files2.length_items_lower_pane", {
            length: entries.length
          })}
        </span>
      </div>
      <div
        onContextMenu={(event) => openLocationMenu(event, path2)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const raw = e.dataTransfer.getData("application/x-geyma-paths");
          if (raw) void moveEntries(JSON.parse(raw), path2);
        }}
        style={{
          flex: 1,
          overflow: "auto",
          padding: 10,
          border:
          entries.length === 0 ? `1.5px dashed ${hexA(t.ink, 0.25)}` : "none",
          borderRadius: 10,
          margin: entries.length === 0 ? 10 : 0,
          display: entries.length === 0 ? "grid" : "grid",
          placeItems: entries.length === 0 ? "center" : undefined,
          gridTemplateColumns:
          entries.length > 0 ?
          "repeat(auto-fill, minmax(110px, 1fr))" :
          undefined,
          gap: 8,
          background: dragOver ? hexA(t.accent, 0.06) : "transparent"
        }}>
        
        {entries.length === 0 ?
        <span
          style={{
            fontSize: 12,
            color: t.inkFaint
          }}>
          
            {tr("ui.files2.empty_drop_files_here")}
          </span> :

        entries.map((entry) => {
          const kind = kindOf(entry.name, entry.isDir);
          const colors = itemColors(kind, t);
          const ext = extOf(entry.name);
          const selected = selected2.includes(entry.path);
          return (
            <div
              key={entry.path}
              onClick={(event) => {
                const multi = event.metaKey || event.ctrlKey;
                useStore.setState({
                  selected2: multi ?
                  selected ?
                  selected2.filter((path) => path !== entry.path) :
                  [...selected2, entry.path] :
                  [entry.path]
                });
              }}
              onDoubleClick={() =>
              entry.isDir ?
              goPath2(entry.path) :
              void openWithDefaultApp(entry.path)
              }
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const targets = selected ? selected2 : [entry.path];
                if (!selected)
                useStore.setState({
                  selected2: [entry.path]
                });
                const multi = targets.length > 1;
                const allStarred = targets.every((path) => starred.has(path));
                openMenu({
                  x: event.clientX,
                  y: event.clientY,
                  items: [
                  !multi ?
                  {
                    label: tr("ui.files2.open"),
                    onClick: () =>
                    entry.isDir ?
                    goPath2(entry.path) :
                    void openWithDefaultApp(entry.path)
                  } :
                  undefined,
                  !multi ?
                  {
                    label: tr("ui.files2.show_in_upper_pane"),
                    onClick: () => revealReferencedPath(entry.path)
                  } :
                  undefined,
                  {
                    label: allStarred ? tr("ui.files2.remove_star") : tr("ui.files2.star"),
                    onClick: () => toggleStar(targets)
                  },
                  {
                    divider: true
                  },
                  {
                    label: tr("ui.files2.cut"),
                    onClick: () => setClip("cut", targets)
                  },
                  {
                    label: tr("ui.files2.copy"),
                    onClick: () => setClip("copy", targets)
                  },
                  {
                    label: multi ?
                    tr("ui.files2.duplicate_length_items", {
                      length: targets.length
                    }) :
                    tr("ui.files2.duplicate"),
                    onClick: () => duplicateEntries(targets)
                  },
                  {
                    divider: true
                  },
                  {
                    label: multi ?
                    tr("ui.files2.trash_length_items", {
                      length: targets.length
                    }) :
                    tr("ui.files2.trash"),
                    danger: true,
                    onClick: () => trashEntries(targets)
                  }].
                  filter(Boolean) as {
                    label?: string;
                    divider?: boolean;
                    danger?: boolean;
                    onClick?: () => void;
                  }[]
                });
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/x-geyma-paths",
                  JSON.stringify([entry.path])
                );
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                padding: 8,
                borderRadius: 10,
                boxShadow: selected ? `0 0 0 1.5px ${

                t.accent}` :

                "none",
                background: selected ? hexA(t.accent, 0.1) : "transparent",
                userSelect: "none"
              }}>
              
                <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: colors.bg,
                  color: colors.tint,
                  display: "grid",
                  placeItems: "center"
                }}>
                
                  {entry.isDir ?
                <Icon d={ICONS.folder} size={17} color={colors.tint} /> :

                <span
                  style={{
                    fontFamily: t.mono,
                    fontSize: 7,
                    fontWeight: 700
                  }}>
                  
                      {ext}
                    </span>
                }
                </span>
                <span
                style={{
                  fontSize: 11.5,
                  textAlign: "center",
                  wordBreak: "break-word"
                }}>
                
                  {entry.name}
                </span>
                <span
                style={{
                  fontFamily: t.mono,
                  fontSize: 8.5,
                  color: t.inkFaint
                }}>
                
                  {entry.isDir ?
                formatWhen(entry.modifiedMs) :
                formatSize(entry.size)}
                </span>
              </div>);

        })
        }
      </div>
    </div>);

}