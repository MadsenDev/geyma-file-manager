import { tr } from "@/i18n";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA, itemColors } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { extOf, formatSize, formatWhen, kindOf } from "../lib/format";
import { highlightCode, highlightCss } from "../lib/highlight";
import { getFsBackend } from "../fs";
import type { ArchivePreview, FsEntry, MediaPlaybackSupport } from "../fs";
type MediaState =
{
  status: "idle" | "loading";
} |
{
  status: "ready";
  url: string;
} |
{
  status: "unavailable";
  support: MediaPlaybackSupport;
};
type InspectionState =
{
  status: "idle" | "loading";
} |
{
  status: "archive";
  preview: ArchivePreview;
} |
{
  status: "directory";
  entries: FsEntry[];
} |
{
  status: "unavailable";
  support: MediaPlaybackSupport;
};
export function QuickLook() {
  const t = useTheme();
  const preview = useStore((s) => s.preview);
  const entries = useStore((s) => s.visibleEntries());
  const closePreview = useStore((s) => s.closePreview);
  const stepPreview = useStore((s) => s.stepPreview);
  const [content, setContent] = useState<string | null>(null);
  const [contentTruncated, setContentTruncated] = useState(false);
  const [mediaState, setMediaState] = useState<MediaState>({
    status: "idle"
  });
  const [inspectionState, setInspectionState] = useState<InspectionState>({
    status: "idle"
  });
  const [previewRetry, setPreviewRetry] = useState(0);
  const previewPath = preview?.path ?? null;
  const entry = entries.find((e) => e.path === previewPath);
  const idx = entries.findIndex((e) => e.path === previewPath);
  const ext = entry ? extOf(entry.name) || (entry.isDir ? "DIR" : "") : "";
  const kind = entry ? kindOf(entry.name, entry.isDir) : "document";
  const isMedia = kind === "audio" || kind === "video" || kind === "image";
  const isPdf = ext === "PDF";
  const usesFileUrl = isMedia || isPdf;
  useEffect(() => {
    setContent(null);
    setContentTruncated(false);
    setMediaState({
      status: usesFileUrl ? "loading" : "idle"
    });
    setInspectionState({
      status: "idle"
    });
    if (!entry) return;
    let cancelled = false;
    if (entry.isDir) {
      setInspectionState({
        status: "loading"
      });
      getFsBackend().
      then((backend) => backend.listDir(entry.path)).
      then((items) => {
        if (!cancelled)
        setInspectionState({
          status: "directory",
          entries: items
        });
      }).
      catch((error) => {
        if (!cancelled)
        setInspectionState({
          status: "unavailable",
          support: loadFailure(
            "This folder could not be inspected.",
            String(error)
          )
        });
      });
      return () => {
        cancelled = true;
      };
    }
    if (kind === "archive") {
      setInspectionState({
        status: "loading"
      });
      getFsBackend().
      then((backend) => backend.previewArchive(entry.path)).
      then((archive) => {
        if (!cancelled)
        setInspectionState({
          status: "archive",
          preview: archive
        });
      }).
      catch((error) => {
        if (!cancelled)
        setInspectionState({
          status: "unavailable",
          support: loadFailure(
            "This archive format cannot be inspected yet.",
            String(error)
          )
        });
      });
      return () => {
        cancelled = true;
      };
    }
    if (usesFileUrl) {
      getFsBackend().
      then(async (backend) => {
        if (kind === "audio" || kind === "video") {
          const support = await backend.mediaPlaybackSupport();
          if (!support.available)
          return {
            status: "unavailable",
            support
          } as const;
        }
        return {
          status: "ready",
          url: await backend.fileUrl(entry.path)
        } as const;
      }).
      then((result) => {
        if (cancelled) return;
        if (result.status === "unavailable") {
          setMediaState({
            status: "unavailable",
            support: result.support
          });
        } else if (result.url) {
          setMediaState({
            status: "ready",
            url: result.url
          });
        } else {
          setMediaState({
            status: "unavailable",
            support: loadFailure(
              "This file cannot be previewed in the current environment."
            )
          });
        }
      }).
      catch((error) => {
        if (!cancelled) {
          setMediaState({
            status: "unavailable",
            support: loadFailure(
              "Geyma could not prepare this media preview.",
              String(error)
            )
          });
        }
      });
      return () => {
        cancelled = true;
      };
    }
    setInspectionState({
      status: "loading"
    });
    getFsBackend().
    then((backend) => backend.previewTextFile(entry.path)).
    then((text) => {
      if (!cancelled) {
        setContent(text?.content ?? null);
        setContentTruncated(text?.truncated ?? false);
        setInspectionState({
          status: "idle"
        });
      }
    }).
    catch(() => {
      if (!cancelled) {
        setContent(null);
        setInspectionState({
          status: "idle"
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entry?.path, previewRetry]);
  const highlighted = useMemo(
    () => content != null ? highlightCode(content, ext) : null,
    [content, ext]
  );
  if (!previewPath || !entry) return null;
  const origin = preview?.origin;
  const colors = itemColors(kind, t);
  const showText = content != null;
  const showFileUrl = usesFileUrl && mediaState.status === "ready";
  const showInspection =
  inspectionState.status === "archive" ||
  inspectionState.status === "directory";
  const wide = kind === "video" || kind === "image" || isPdf || showInspection;
  return (
    <>
      <div
        onClick={closePreview}
        style={{
          position: "fixed",
          inset: 0,
          background: hexA("#000000", t.isDark ? 0.5 : 0.28),
          zIndex: 200
        }} />
      
      <div
        role="dialog"
        aria-label={tr("ui.quick_look.quick_look")}
        className={origin ? "gy-preview-anim" : "gy-dialog-anim"}
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          transformOrigin: origin ?
          `${origin.left + origin.width / 2}px ${origin.top + origin.height / 2}px` :
          "center",
          ["--gy-preview-x" as string]: origin ?
          `${origin.left + origin.width / 2 - window.innerWidth / 2}px` :
          "0px",
          ["--gy-preview-y" as string]: origin ?
          `${origin.top + origin.height / 2 - window.innerHeight / 2}px` :
          "0px",
          ["--gy-preview-scale" as string]: origin ?
          Math.max(0.12, Math.min(0.55, origin.width / 560)).toString() :
          "0.92",
          width:
          (showFileUrl || showInspection) && wide ?
          "min(880px, 100vw - 48px)" :
          "min(560px, 100vw - 48px)",
          maxHeight: "min(80vh, 720px)",
          display: "flex",
          flexDirection: "column",
          background: t.card,
          border: `1px solid ${
          t.border}`,

          borderRadius: 18,
          boxShadow: `0 24px 64px ${hexA("#000000", t.isDark ? 0.6 : 0.28)}`,
          zIndex: 201,
          overflow: "hidden"
        }}>
        
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: `1px solid ${
            t.border}`

          }}>
          
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: colors.bg,
              color: colors.tint,
              display: "grid",
              placeItems: "center",
              fontFamily: t.mono,
              fontSize: 8,
              fontWeight: 700,
              flex: "none"
            }}>
            
            {ext.slice(0, 4)}
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13.5,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
            
            {entry.name}
          </span>
          <NavBtn
            onClick={() => stepPreview(-1)}
            title={tr("ui.quick_look.previous")}>
            
            <Icon d={ICONS.chevronLeft} size={14} />
          </NavBtn>
          <NavBtn
            onClick={() => stepPreview(1)}
            title={tr("ui.quick_look.next")}>
            
            <Icon d={ICONS.chevronRight} size={14} />
          </NavBtn>
          <NavBtn
            onClick={closePreview}
            title={tr("ui.quick_look.close_space")}>
            
            <Icon d={ICONS.close} size={14} />
          </NavBtn>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: showText || showFileUrl || showInspection ? 0 : 20
          }}>
          
          {showFileUrl ?
          <MediaPreview
            kind={isPdf ? "pdf" : kind}
            url={mediaState.url}
            name={entry.name}
            tileBg={colors.bg}
            tileTint={colors.tint}
            extLabel={ext}
            onError={(support) =>
            setMediaState({
              status: "unavailable",
              support
            })
            } /> :

          usesFileUrl && mediaState.status === "unavailable" ?
          <MediaUnavailable
            support={mediaState.support}
            onRetry={() => setPreviewRetry((value) => value + 1)} /> :

          inspectionState.status === "archive" ?
          <EntryListing
            label={inspectionState.preview.format}
            entries={inspectionState.preview.entries.map((item) => ({
              ...item,
              name: item.path
            }))}
            totalEntries={inspectionState.preview.totalEntries}
            truncated={inspectionState.preview.truncated}
            showCompressed={inspectionState.preview.format === "ZIP"} /> :

          inspectionState.status === "directory" ?
          <EntryListing
            label={tr("ui.quick_look.folder")}
            entries={inspectionState.entries.map((item) => ({
              name: item.name,
              isDir: item.isDir,
              size: item.size,
              compressedSize: 0
            }))}
            totalEntries={inspectionState.entries.length}
            truncated={false} /> :

          inspectionState.status === "unavailable" ?
          <MediaUnavailable
            support={inspectionState.support}
            onRetry={() => setPreviewRetry((value) => value + 1)} /> :

          usesFileUrl && mediaState.status === "loading" ||
          inspectionState.status === "loading" ?
          <div
            style={{
              height: 220,
              display: "grid",
              placeItems: "center",
              color: t.inkFaint,
              fontFamily: t.mono,
              fontSize: 11
            }}>
            
              {tr("ui.quick_look.preparing_preview")}
            </div> :
          showText ?
          highlighted != null ?
          <>
                {contentTruncated &&
            <PreviewNotice>
                    {tr("ui.quick_look.showing_the_first")}
                    {formatSize(1024 * 1024)}
                    {tr("ui.quick_look.of_this_file")}
                  </PreviewNotice>
            }
                <style>{highlightCss(t)}</style>
                <pre
              className="gy-hl"
              style={{
                margin: 0,
                padding: 16,
                fontFamily: t.mono,
                fontSize: 12.5,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}
              dangerouslySetInnerHTML={{
                __html: highlighted
              }} />
            
              </> :

          <>
                {contentTruncated &&
            <PreviewNotice>
                    {tr("ui.quick_look.showing_the_first")}
                    {formatSize(1024 * 1024)}
                    {tr("ui.quick_look.of_this_file")}
                  </PreviewNotice>
            }
                <pre
              style={{
                margin: 0,
                padding: 16,
                fontFamily: t.mono,
                fontSize: 12.5,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
              
                  {content}
                </pre>
              </> :


          <MetadataPreview
            entry={entry}
            ext={ext}
            tileBg={colors.bg}
            tileTint={colors.tint} />

          }
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderTop: `1px solid ${
            t.border}`,

            fontFamily: t.mono,
            fontSize: 10,
            color: t.inkFaint
          }}>
          
          <span>
            {entry.isDir ?
            tr("ui.quick_look.folder") :
            `${formatSize(entry.size)} · ${formatWhen(entry.modifiedMs)}`}
          </span>
          <span>
            {idx + 1}
            {tr("ui.quick_look.of")}
            {entries.length}
            {tr("ui.quick_look.space_to_close")}
          </span>
        </div>
      </div>
    </>);

}
function PreviewNotice({ children }: {children: React.ReactNode;}) {
  const t = useTheme();
  return (
    <div
      style={{
        padding: "7px 16px",
        borderBottom: `1px solid ${
        t.border}`,

        background: t.main,
        color: t.inkFaint,
        fontFamily: t.mono,
        fontSize: 9.5
      }}>
      
      {children}
    </div>);

}
function MetadataPreview({
  entry,
  ext,
  tileBg,
  tileTint





}: {entry: FsEntry;ext: string;tileBg: string;tileTint: string;}) {
  const t = useTheme();
  const rows = [
  [
  tr("ui.quick_look.kind"),
  entry.isDir ?
  tr("ui.quick_look.folder") :
  ext || tr("ui.quick_look.unknown_file")],

  [tr("ui.quick_look.size"), entry.isDir ? "—" : formatSize(entry.size)],
  [tr("ui.quick_look.modified"), formatWhen(entry.modifiedMs)],
  [tr("ui.quick_look.created"), formatWhen(entry.createdMs)],
  [tr("ui.quick_look.location"), entry.path]];

  return (
    <div
      style={{
        minHeight: 260,
        display: "grid",
        gridTemplateColumns: "120px minmax(0, 1fr)",
        gap: 24,
        alignItems: "center",
        padding: 28
      }}>
      
      <span
        style={{
          width: 112,
          height: 112,
          borderRadius: 16,
          background: tileBg,
          color: tileTint,
          display: "grid",
          placeItems: "center",
          fontFamily: t.mono,
          fontSize: 13,
          fontWeight: 700
        }}>
        
        {ext || (entry.isDir ? "DIR" : "—")}
      </span>
      <dl
        style={{
          margin: 0,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "72px minmax(0, 1fr)",
          gap: "9px 12px",
          fontSize: 11.5
        }}>
        
        {rows.map(([label, value]) =>
        <div
          key={label}
          style={{
            display: "contents"
          }}>
          
            <dt
            style={{
              color: t.inkFaint,
              fontFamily: t.mono,
              fontSize: 9.5
            }}>
            
              {label}
            </dt>
            <dd
            title={value}
            style={{
              margin: 0,
              minWidth: 0,
              color: t.inkSoft,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
            
              {value}
            </dd>
          </div>
        )}
      </dl>
    </div>);

}
function loadFailure(
message: string,
details: string | null = null)
: MediaPlaybackSupport {
  return {
    available: false,
    title: tr("ui.quick_look.preview_unavailable"),
    message,
    details,
    installCommand: null
  };
}
interface ListingEntry {
  name: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
}
function EntryListing({
  label,
  entries,
  totalEntries,
  truncated,
  showCompressed = false






}: {label: string;entries: ListingEntry[];totalEntries: number;truncated: boolean;showCompressed?: boolean;}) {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = normalized ?
  entries.filter((entry) =>
  entry.name.toLocaleLowerCase().includes(normalized)
  ) :
  entries;
  const visible = filtered.slice(0, 500);
  return (
    <div
      style={{
        minHeight: 260,
        display: "flex",
        flexDirection: "column"
      }}>
      
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          borderBottom: `1px solid ${
          t.border}`,

          background: t.main
        }}>
        
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            color: t.inkFaint,
            flex: 1
          }}>
          
          {label} · {totalEntries.toLocaleString()}{" "}
          {totalEntries === 1 ? "item" : "items"}
          {truncated ?
          ` · first ${entries.length.toLocaleString()} indexed` :
          ""}
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tr("ui.quick_look.filter_contents")}
          aria-label={tr("ui.quick_look.filter_preview_contents")}
          style={{
            width: 220,
            maxWidth: "45%",
            border: `1px solid ${
            t.border}`,

            borderRadius: 8,
            background: t.card,
            color: t.ink,
            padding: "7px 9px",
            outline: "none",
            fontFamily: t.mono,
            fontSize: 10.5
          }} />
        
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showCompressed ?
          "minmax(0, 1fr) 90px 90px" :
          "minmax(0, 1fr) 90px",
          gap: 10,
          padding: "8px 14px",
          borderBottom: `1px solid ${
          t.border}`,

          color: t.inkFaint,
          fontFamily: t.mono,
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: ".06em"
        }}>
        
        <span>{tr("ui.quick_look.name")}</span>
        <span
          style={{
            textAlign: "right"
          }}>
          
          {tr("ui.quick_look.size")}
        </span>
        {showCompressed &&
        <span
          style={{
            textAlign: "right"
          }}>
          
            {tr("ui.quick_look.packed")}
          </span>
        }
      </div>
      <div
        style={{
          overflow: "auto",
          maxHeight: "min(56vh, 500px)"
        }}>
        
        {visible.map((item, index) =>
        <div
          key={tr("ui.quick_look.name_index", {
            name: item.name,
            index
          })}
          style={{
            display: "grid",
            gridTemplateColumns: showCompressed ?
            "minmax(0, 1fr) 90px 90px" :
            "minmax(0, 1fr) 90px",
            gap: 10,
            alignItems: "center",
            padding: "7px 14px",
            borderBottom: `1px solid ${
            t.border}`,

            fontSize: 11.5
          }}>
          
            <span
            title={item.name}
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: item.isDir ? t.accent : t.ink
            }}>
            
              <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 18,
                color: item.isDir ? t.accent : t.inkFaint
              }}>
              
                {item.isDir ? "▸" : "·"}
              </span>
              {item.name}
            </span>
            <span
            style={{
              textAlign: "right",
              color: t.inkFaint,
              fontFamily: t.mono,
              fontSize: 10
            }}>
            
              {item.isDir ? "—" : formatSize(item.size)}
            </span>
            {showCompressed &&
          <span
            style={{
              textAlign: "right",
              color: t.inkFaint,
              fontFamily: t.mono,
              fontSize: 10
            }}>
            
                {item.isDir ? "—" : formatSize(item.compressedSize)}
              </span>
          }
          </div>
        )}
        {visible.length === 0 &&
        <div
          style={{
            height: 140,
            display: "grid",
            placeItems: "center",
            color: t.inkFaint,
            fontFamily: t.mono,
            fontSize: 10.5
          }}>
          
            {tr("ui.quick_look.no_matching_items")}
          </div>
        }
        {filtered.length > visible.length &&
        <div
          style={{
            padding: 12,
            textAlign: "center",
            color: t.inkFaint,
            fontFamily: t.mono,
            fontSize: 9.5
          }}>
          
            {tr("ui.quick_look.showing_500_of")}
            {filtered.length.toLocaleString()}
            {tr("ui.quick_look.matches")}
          </div>
        }
      </div>
    </div>);

}
function MediaUnavailable({
  support,
  onRetry



}: {support: MediaPlaybackSupport;onRetry: () => void;}) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);
  const copyCommand = () => {
    if (!support.installCommand) return;
    navigator.clipboard?.
    writeText(support.installCommand).
    then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }).
    catch(() => {});
  };
  return (
    <div
      role="alert"
      style={{
        minHeight: 260,
        display: "grid",
        placeItems: "center",
        padding: 28
      }}>
      
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          display: "grid",
          gap: 14,
          justifyItems: "start"
        }}>
        
        <span
          style={{
            width: 40,
            height: 40,
            display: "grid",
            placeItems: "center",
            borderRadius: 12,
            background: hexA(t.accent, 0.12),
            color: t.accent,
            fontSize: 20,
            fontWeight: 800
          }}>
          
          !
        </span>
        <div>
          <div
            style={{
              color: t.ink,
              fontSize: 16,
              fontWeight: 750,
              marginBottom: 6
            }}>
            
            {support.title}
          </div>
          <div
            style={{
              color: t.inkSoft,
              fontSize: 12.5,
              lineHeight: 1.55
            }}>
            
            {support.message}
          </div>
        </div>
        {support.installCommand &&
        <div
          style={{
            width: "100%",
            display: "grid",
            gap: 7
          }}>
          
            <span
            style={{
              color: t.inkFaint,
              fontSize: 10,
              fontFamily: t.mono
            }}>
            
              {tr("ui.quick_look.install_the_missing_component_then_retry")}
            </span>
            <button
            type="button"
            onClick={copyCommand}
            title={tr("ui.quick_look.copy_install_command")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              border: `1px solid ${
              t.border}`,

              borderRadius: 9,
              background: t.main,
              color: t.ink,
              cursor: "pointer",
              textAlign: "left",
              fontFamily: t.mono,
              fontSize: 10.5
            }}>
            
              <code
              style={{
                overflowWrap: "anywhere"
              }}>
              
                {support.installCommand}
              </code>
              <span
              style={{
                color: t.accent,
                flex: "none"
              }}>
              
                {copied ? tr("ui.quick_look.copied") : tr("ui.quick_look.copy")}
              </span>
            </button>
          </div>
        }
        {support.details &&
        <details
          style={{
            width: "100%",
            color: t.inkFaint,
            fontFamily: t.mono,
            fontSize: 9.5
          }}>
          
            <summary
            style={{
              cursor: "pointer"
            }}>
            
              {tr("ui.quick_look.technical_details")}
            </summary>
            <div
            style={{
              marginTop: 7,
              padding: 9,
              borderRadius: 7,
              background: t.main,
              overflowWrap: "anywhere",
              lineHeight: 1.5
            }}>
            
              {support.details}
            </div>
          </details>
        }
        <button
          type="button"
          onClick={onRetry}
          style={{
            border: 0,
            borderRadius: 8,
            padding: "8px 14px",
            background: t.accent,
            color: t.card,
            cursor: "pointer",
            fontSize: 11.5,
            fontWeight: 700
          }}>
          
          {tr("ui.quick_look.retry_preview")}
        </button>
      </div>
    </div>);

}
function MediaPreview({
  kind,
  url,
  name,
  tileBg,
  tileTint,
  extLabel,
  onError








}: {kind: string;url: string;name: string;tileBg: string;tileTint: string;extLabel: string;onError: (support: MediaPlaybackSupport) => void;}) {
  const t = useTheme();
  const playbackError = (element: HTMLMediaElement) => {
    const code = element.error?.code;
    const reasons: Record<number, string> = {
      1: tr("ui.quick_look.playback_was_aborted"),
      2: tr("ui.quick_look.the_local_media_stream_could_not_be_read"),
      3: tr("ui.quick_look.the_file_could_not_be_decoded_its_codec_may_not_"),
      4: tr("ui.quick_look.this_media_format_or_codec_is_not_supported")
    };
    onError(
      loadFailure(
        reasons[code || 0] ||
        tr("ui.quick_look.the_native_media_engine_could_not_play_this_file"),
        code ?
        `WebKit media error code ${code}${
        element.error?.message ?
        tr("ui.quick_look.message", {
          message: element.error.message
        }) :
        "."}` :

        null
      )
    );
  };
  if (kind === "pdf") {
    return (
      <iframe
        key={url}
        src={url}
        title={tr("ui.quick_look.preview_of_name", {
          name
        })}
        onError={() =>
        onError(
          loadFailure(
            "This PDF could not be rendered by the system webview."
          )
        )
        }
        style={{
          display: "block",
          width: "100%",
          height: "min(66vh, 620px)",
          border: 0,
          background: "#fff"
        }} />);


  }
  if (kind === "video") {
    return (
      <video
        key={url}
        src={url}
        controls
        autoPlay
        onError={(event) => playbackError(event.currentTarget)}
        style={{
          display: "block",
          width: "100%",
          maxHeight: "min(62vh, 560px)",
          background: "#000"
        }} />);


  }
  if (kind === "audio") {
    return (
      <div
        style={{
          display: "grid",
          gap: 18,
          justifyItems: "center",
          padding: "36px 24px 28px"
        }}>
        
        <span
          style={{
            width: 120,
            height: 120,
            borderRadius: 16,
            background: tileBg,
            color: tileTint,
            display: "grid",
            placeItems: "center",
            fontFamily: t.mono,
            fontSize: 13,
            fontWeight: 700
          }}>
          
          {extLabel}
        </span>
        <audio
          key={url}
          src={url}
          controls
          autoPlay
          onError={(event) => playbackError(event.currentTarget)}
          style={{
            width: "100%",
            maxWidth: 420,
            accentColor: t.accent
          }} />
        
      </div>);

  }
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        padding: 16,
        minHeight: 220
      }}>
      
      <img
        key={url}
        src={url}
        alt={name}
        onError={() =>
        onError(loadFailure("This image could not be decoded or read."))
        }
        style={{
          maxWidth: "100%",
          maxHeight: "min(62vh, 560px)",
          borderRadius: 8,
          objectFit: "contain"
        }} />
      
    </div>);

}
function NavBtn({
  onClick,
  title,
  children




}: {onClick: () => void;title: string;children: React.ReactNode;}) {
  const t = useTheme();
  return (
    <button
      onClick={onClick}
      title={title}
      className="gy-soft"
      style={{
        width: 26,
        height: 26,
        display: "grid",
        placeItems: "center",
        border: `1px solid ${
        t.border}`,

        borderRadius: 8,
        background: "transparent",
        color: t.inkSoft,
        cursor: "pointer",
        flex: "none"
      }}>
      
      {children}
    </button>);

}