import { tr } from "@/i18n";
import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { itemColors } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import {
  extOf,
  formatSize,
  formatWhen,
  kindOf,
  formatAgo } from
"../lib/format";
import { panelTitleStyle } from "./common";
import { openReferencedPathMenu } from "../lib/contextMenus";
import { getFsBackend, type FsEntry } from "../fs";
import { aiGenerate } from "../ai/ollama";
import { explainError } from "../lib/explainError";
import type { FileEvent } from "../state/types";
function buildSummaryPrompt(entries: FsEntry[]): string {
  const lines = entries.
  slice(0, 60).
  map(
    (e) =>
    `${e.isDir ? "[folder] " : ""}${e.name}${e.isDir ? "" : ` (${formatSize(e.size)})`}`
  );
  return `Write a short (2-3 sentence) plain-language summary of what this folder seems to contain, based on its contents. No headings, no lists, just prose.

Contents (${entries.length} items${entries.length > 60 ? ", showing first 60" : ""}):
${lines.join("\n")}`;
}
const UNDOABLE_ACTIONS = new Set(["Renamed", "Moved here", "Deleted", "Restored"]




);
export function Details() {
  const t = useTheme();
  const path = useStore((s) => s.path);
  const entries = useStore((s) => s.visibleEntries());
  const selected = useStore((s) => s.selected);
  const starred = useStore((s) => s.starred);
  const fileEvents = useStore((s) => s.fileEvents);
  const showPreview = useStore((s) => s.mcfg("details", "preview", true));
  const showMemory = useStore((s) => s.mcfg("details", "memory", true));
  const showActivity = useStore((s) => s.mcfg("details", "activity", true));
  const selectedEntries = entries.filter((e) => selected.includes(e.path));
  if (selectedEntries.length === 0) {
    const folders = entries.filter((e) => e.isDir).length;
    const files = entries.length - folders;
    const totalSize = entries.
    filter((e) => !e.isDir).
    reduce((s, e) => s + e.size, 0);
    return (
      <div
        style={{
          padding: 12
        }}>
        
        <div style={panelTitleStyle(t)}>{tr("ui.details.details")}</div>
        <div
          style={{
            padding: "0 4px"
          }}>
          
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 4
            }}>
            
            {tr("ui.details.folder_summary")}
          </div>
          <Row
            label={tr("ui.details.items")}
            value={`${
            entries.length}`
            }
            t={t} />
          
          <Row
            label={tr("ui.details.folders")}
            value={tr("ui.details.folders", {
              folders
            })}
            t={t} />
          
          <Row
            label={tr("ui.details.files")}
            value={tr("ui.details.files", {
              files
            })}
            t={t} />
          
          <Row
            label={tr("ui.details.size")}
            value={formatSize(totalSize)}
            t={t} />
          
        </div>
        <AiFolderSummary path={path} entries={entries} />
      </div>);

  }
  if (selectedEntries.length > 1) {
    const totalSize = selectedEntries.reduce((s, e) => s + e.size, 0);
    return (
      <div
        style={{
          padding: 12
        }}>
        
        <div style={panelTitleStyle(t)}>{tr("ui.details.details")}</div>
        <div
          style={{
            padding: "0 4px"
          }}>
          
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 4
            }}>
            
            {tr("ui.details.length_items_selected", {
              length: selectedEntries.length
            })}
          </div>
          <Row
            label={tr("ui.details.total_size")}
            value={formatSize(totalSize)}
            t={t} />
          
        </div>
      </div>);

  }
  const entry = selectedEntries[0];
  const kind = kindOf(entry.name, entry.isDir);
  const colors = itemColors(kind, t);
  const ext = extOf(entry.name);
  const events = fileEvents[entry.path] || [];
  return (
    <div
      onContextMenu={(event) => openReferencedPathMenu(event, entry.path)}
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}>
      
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          textAlign: "center"
        }}>
        
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: 16,
            background: colors.bg,
            color: colors.tint,
            display: "grid",
            placeItems: "center"
          }}>
          
          {entry.isDir ?
          <Icon d={ICONS.folder} size={32} color={colors.tint} /> :

          <span
            style={{
              fontFamily: t.mono,
              fontSize: 12,
              fontWeight: 700
            }}>
            
              {ext}
            </span>
          }
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700
            }}>
            
            {entry.name}{" "}
            {starred.has(entry.path) &&
            <span
              style={{
                color: "#D89B2B"
              }}>
              
                ★
              </span>
            }
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: t.inkFaint,
              marginTop: 2
            }}>
            
            {entry.isDir ? "Folder" : kind}
          </div>
        </div>
      </div>
      <div>
        {!entry.isDir &&
        <Row
          label={tr("ui.details.size")}
          value={formatSize(entry.size)}
          t={t} />

        }
        <Row
          label={tr("ui.details.modified")}
          value={formatWhen(entry.modifiedMs)}
          t={t} />
        
        <Row
          label={tr("ui.details.created")}
          value={formatWhen(entry.createdMs)}
          t={t} />
        
        <Row label={tr("ui.details.path")} value={entry.path} t={t} mono />
      </div>
      {showPreview && !entry.isDir && <DetailsContentPreview entry={entry} />}
      {showMemory &&
      <div>
          <div style={panelTitleStyle(t)}>{tr("ui.details.memory")}</div>
          <div
          style={{
            padding: "0 4px"
          }}>
          
            <Row
            label={tr("ui.details.events")}
            value={`${
            events.length}`
            }
            t={t} />
          
            <Row
            label={tr("ui.details.starred")}
            value={starred.has(entry.path) ? "Yes" : "No"}
            t={t} />
          
          </div>
        </div>
      }
      {showActivity && events.length > 0 &&
      <div>
          <div style={panelTitleStyle(t)}>
            {tr("ui.details.what_this_file_remembers")}
          </div>
          <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "0 4px"
          }}>
          
            {events.map((ev) =>
          <JourneyRow key={ev.id} ev={ev} path={entry.path} t={t} />
          )}
          </div>
        </div>
      }
    </div>);

}
function AiFolderSummary({
  path,
  entries



}: {path: string;entries: FsEntry[];}) {
  const t = useTheme();
  const aiSummaryEnabled = useStore((s) => s.aiSummaryEnabled);
  const aiRunning = useStore((s) => s.aiRunning);
  const aiSelectedModel = useStore((s) => s.aiSelectedModel);
  const showToast = useStore((s) => s.showToast);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setSummary(null);
  }, [path]);
  if (
  !aiSummaryEnabled ||
  !aiRunning ||
  !aiSelectedModel ||
  entries.length === 0)

  return null;
  async function handleSummarize() {
    setLoading(true);
    try {
      const text = await aiGenerate(
        aiSelectedModel,
        buildSummaryPrompt(entries)
      );
      setSummary(text.trim());
    } catch (e) {
      showToast(`AI summary failed: ${explainError(e)}`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div
      style={{
        marginTop: 4
      }}>
      
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
        
        <div style={panelTitleStyle(t)}>{tr("ui.details.ai_summary")}</div>
        <button
          onClick={handleSummarize}
          disabled={loading}
          className="gy-soft"
          style={{
            flex: "none",
            marginRight: 4,
            border: `1px solid ${
            t.border}`,

            background: "transparent",
            color: t.inkSoft,
            borderRadius: 7,
            padding: "3px 9px",
            fontSize: 11,
            cursor: "pointer"
          }}>
          
          {loading ?
          tr("ui.details.thinking") :
          summary ?
          tr("ui.details.regenerate") :
          tr("ui.details.summarize")}
        </button>
      </div>
      {summary &&
      <div
        style={{
          padding: "0 4px",
          fontSize: 12,
          color: t.inkSoft,
          lineHeight: 1.5
        }}>
        
          {summary}
        </div>
      }
    </div>);

}
function DetailsContentPreview({ entry }: {entry: FsEntry;}) {
  const t = useTheme();
  const kind = kindOf(entry.name, false);
  const [preview, setPreview] = useState<
    {
      type: "text";
      content: string;
    } |
    {
      type: "image";
      url: string;
    } |
    {
      type: "none";
    } |
    null>(
    null);
  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    getFsBackend().
    then(async (backend) => {
      if (kind === "image") {
        const url = await backend.fileUrl(entry.path);
        return url ?
        {
          type: "image",
          url
        } as const :
        {
          type: "none"
        } as const;
      }
      const text = await backend.previewTextFile(entry.path);
      return text ?
      {
        type: "text",
        content: text.content.slice(0, 1600)
      } as const :
      {
        type: "none"
      } as const;
    }).
    then((value) => {
      if (!cancelled) setPreview(value);
    }).
    catch(() => {
      if (!cancelled)
      setPreview({
        type: "none"
      });
    });
    return () => {
      cancelled = true;
    };
  }, [entry.path, kind]);
  return (
    <div>
      <div style={panelTitleStyle(t)}>{tr("ui.details.preview")}</div>
      {preview?.type === "text" ?
      <pre
        style={{
          margin: 0,
          padding: "11px 12px",
          maxHeight: 168,
          overflow: "auto",
          border: `1px solid ${
          t.border}`,

          borderRadius: 10,
          background: t.bg,
          color: t.inkSoft,
          fontFamily: t.mono,
          fontSize: 10.5,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}>
        
          {preview.content}
        </pre> :
      preview?.type === "image" ?
      <div
        style={{
          height: 150,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          border: `1px solid ${
          t.border}`,

          borderRadius: 10,
          background: t.bg
        }}>
        
          <img
          src={preview.url}
          alt=""
          onError={() =>
          setPreview({
            type: "none"
          })
          }
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain"
          }} />
        
        </div> :

      <div
        style={{
          padding: "12px",
          border: `1px solid ${
          t.border}`,

          borderRadius: 10,
          background: t.bg,
          color: t.inkFaint,
          fontSize: 11.5
        }}>
        
          {preview ?
        tr("ui.details.no_inline_preview_available_for_this_format") :
        tr("ui.details.preparing_preview")}
        </div>
      }
    </div>);

}
function JourneyRow({
  ev,
  path,
  t




}: {ev: FileEvent;path: string;t: ReturnType<typeof useTheme>;}) {
  const [hover, setHover] = useState(false);
  const undoFileEvent = useStore((s) => s.undoFileEvent);
  const undoable = UNDOABLE_ACTIONS.has(ev.action) && !!ev.prevPath;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        fontSize: 11.5,
        minHeight: 18
      }}>
      
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>
        
        <b
          style={{
            color: t.ink
          }}>
          
          {ev.action}
        </b>{" "}
        {ev.detail &&
        <span
          style={{
            color: t.inkSoft
          }}>
          
            {ev.detail}
          </span>
        }
      </span>
      {undoable && hover ?
      <button
        onClick={() => undoFileEvent(path, ev.id)}
        title={tr("ui.details.undo_action", {
          action: ev.action
        })}
        className="gy-soft"
        style={{
          flex: "none",
          border: `1px solid ${
          t.border}`,

          background: t.card,
          color: t.inkSoft,
          borderRadius: 6,
          padding: "1px 7px",
          fontSize: 10,
          cursor: "pointer"
        }}>
        
          {tr("ui.details.undo")}
        </button> :

      <span
        style={{
          fontFamily: t.mono,
          fontSize: 9.5,
          color: t.inkFaint,
          flex: "none"
        }}>
        
          {formatAgo(ev.whenMs)}
        </span>
      }
    </div>);

}
function Row({
  label,
  value,
  t,
  mono





}: {label: string;value: string;t: ReturnType<typeof useTheme>;mono?: boolean;}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        padding: "4px 4px",
        fontSize: 12
      }}>
      
      <span
        style={{
          color: t.inkFaint,
          fontFamily: t.mono,
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".06em"
        }}>
        
        {label}
      </span>
      <span
        style={{
          color: t.inkSoft,
          textAlign: "right",
          wordBreak: mono ? "break-all" : "normal",
          fontFamily: mono ? t.mono : "inherit",
          fontSize: mono ? 10.5 : 12
        }}>
        
        {value}
      </span>
    </div>);

}