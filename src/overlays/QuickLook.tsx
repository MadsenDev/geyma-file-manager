import { tr } from "@/i18n";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { extOf, formatSize, formatWhen, kindOf } from "../lib/format";
import { highlightCss, useHighlight } from "../lib/highlight";
import { useStore } from "../state/store";
import { hexA, itemColors } from "../theme/skins";
import { useTheme } from "../theme/ThemeContext";
import { EntryListing } from "./quicklook/EntryListing";
import { MediaPreview } from "./quicklook/MediaPreview";
import { MediaUnavailable } from "./quicklook/MediaUnavailable";
import { MetadataPreview } from "./quicklook/MetadataPreview";
import { useQuickLookContent } from "./quicklook/useQuickLookContent";

export function QuickLook() {
  const t = useTheme();
  const preview = useStore((s) => s.preview);
  const entries = useStore((s) => s.visibleEntries());
  const closePreview = useStore((s) => s.closePreview);
  const stepPreview = useStore((s) => s.stepPreview);
  const previewPath = preview?.path ?? null;
  const entry = entries.find((e) => e.path === previewPath);
  const idx = entries.findIndex((e) => e.path === previewPath);
  const ext = entry ? extOf(entry.name) || (entry.isDir ? "DIR" : "") : "";
  const kind = entry ? kindOf(entry.name, entry.isDir) : "document";
  const isMedia = kind === "audio" || kind === "video" || kind === "image";
  const isPdf = ext === "PDF";
  const usesFileUrl = isMedia || isPdf;
  const { content, contentTruncated, mediaState, setMediaState, inspectionState, retry } =
    useQuickLookContent(entry, kind, usesFileUrl);
  const highlighted = useHighlight(content, ext);
  if (!previewPath || !entry) return null;
  const origin = preview?.origin;
  const colors = itemColors(kind, t);
  const showText = content != null;
  const showFileUrl = usesFileUrl && mediaState.status === "ready";
  const showInspection = inspectionState.status === "archive" || inspectionState.status === "directory";
  const wide = kind === "video" || kind === "image" || isPdf || showInspection;
  return (
    <>
      <div
        onClick={closePreview}
        style={{
          position: "fixed",
          inset: 0,
          background: hexA("#000000", t.isDark ? 0.5 : 0.28),
          zIndex: 200,
        }}
      />
      <div
        role="dialog"
        aria-label={tr("ui.quick_look.quick_look")}
        className={origin ? "gy-preview-anim" : "gy-dialog-anim"}
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          transformOrigin: origin
            ? `${origin.left + origin.width / 2}px ${origin.top + origin.height / 2}px`
            : "center",
          ["--gy-preview-x" as string]: origin
            ? `${origin.left + origin.width / 2 - window.innerWidth / 2}px`
            : "0px",
          ["--gy-preview-y" as string]: origin
            ? `${origin.top + origin.height / 2 - window.innerHeight / 2}px`
            : "0px",
          ["--gy-preview-scale" as string]: origin
            ? Math.max(0.12, Math.min(0.55, origin.width / 560)).toString()
            : "0.92",
          width:
            (showFileUrl || showInspection) && wide ? "min(880px, 100vw - 48px)" : "min(560px, 100vw - 48px)",
          maxHeight: "min(80vh, 720px)",
          display: "flex",
          flexDirection: "column",
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 18,
          boxShadow: `0 24px 64px ${hexA("#000000", t.isDark ? 0.6 : 0.28)}`,
          zIndex: 201,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: `1px solid ${t.border}`,
          }}
        >
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
              flex: "none",
            }}
          >
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
              whiteSpace: "nowrap",
            }}
          >
            {entry.name}
          </span>
          <NavBtn onClick={() => stepPreview(-1)} title={tr("ui.quick_look.previous")}>
            <Icon d={ICONS.chevronLeft} size={14} />
          </NavBtn>
          <NavBtn onClick={() => stepPreview(1)} title={tr("ui.quick_look.next")}>
            <Icon d={ICONS.chevronRight} size={14} />
          </NavBtn>
          <NavBtn onClick={closePreview} title={tr("ui.quick_look.close_space")}>
            <Icon d={ICONS.close} size={14} />
          </NavBtn>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: showText || showFileUrl || showInspection ? 0 : 20,
          }}
        >
          {showFileUrl ? (
            <MediaPreview
              kind={isPdf ? "pdf" : kind}
              url={mediaState.url}
              name={entry.name}
              tileBg={colors.bg}
              tileTint={colors.tint}
              extLabel={ext}
              onError={(support) => setMediaState({ status: "unavailable", support })}
            />
          ) : usesFileUrl && mediaState.status === "unavailable" ? (
            <MediaUnavailable support={mediaState.support} onRetry={retry} />
          ) : inspectionState.status === "archive" ? (
            <EntryListing
              label={inspectionState.preview.format}
              entries={inspectionState.preview.entries.map((item) => ({
                ...item,
                name: item.path,
              }))}
              totalEntries={inspectionState.preview.totalEntries}
              truncated={inspectionState.preview.truncated}
              showCompressed={inspectionState.preview.format === "ZIP"}
            />
          ) : inspectionState.status === "directory" ? (
            <EntryListing
              label={tr("ui.quick_look.folder")}
              entries={inspectionState.entries.map((item) => ({
                name: item.name,
                isDir: item.isDir,
                size: item.size,
                compressedSize: 0,
              }))}
              totalEntries={inspectionState.entries.length}
              truncated={false}
            />
          ) : inspectionState.status === "unavailable" ? (
            <MediaUnavailable support={inspectionState.support} onRetry={retry} />
          ) : (usesFileUrl && mediaState.status === "loading") || inspectionState.status === "loading" ? (
            <div
              style={{
                height: 220,
                display: "grid",
                placeItems: "center",
                color: t.inkFaint,
                fontFamily: t.mono,
                fontSize: 11,
              }}
            >
              {tr("ui.quick_look.preparing_preview")}
            </div>
          ) : showText ? (
            highlighted != null ? (
              <>
                {contentTruncated && (
                  <PreviewNotice>
                    {tr("ui.quick_look.truncated_notice", { size: formatSize(1024 * 1024) })}
                  </PreviewNotice>
                )}
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
                    wordBreak: "break-word",
                  }}
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              </>
            ) : (
              <>
                {contentTruncated && (
                  <PreviewNotice>
                    {tr("ui.quick_look.truncated_notice", { size: formatSize(1024 * 1024) })}
                  </PreviewNotice>
                )}
                <pre
                  style={{
                    margin: 0,
                    padding: 16,
                    fontFamily: t.mono,
                    fontSize: 12.5,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {content}
                </pre>
              </>
            )
          ) : (
            <MetadataPreview entry={entry} ext={ext} tileBg={colors.bg} tileTint={colors.tint} />
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderTop: `1px solid ${t.border}`,
            fontFamily: t.mono,
            fontSize: 10,
            color: t.inkFaint,
          }}
        >
          <span>
            {entry.isDir
              ? tr("ui.quick_look.folder")
              : `${formatSize(entry.size)} · ${formatWhen(entry.modifiedMs)}`}
          </span>
          <span>{tr("ui.quick_look.position", { index: idx + 1, total: entries.length })}</span>
        </div>
      </div>
    </>
  );
}

function PreviewNotice({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <div
      style={{
        padding: "7px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.main,
        color: t.inkFaint,
        fontFamily: t.mono,
        fontSize: 9.5,
      }}
    >
      {children}
    </div>
  );
}

function NavBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
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
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        background: "transparent",
        color: t.inkSoft,
        cursor: "pointer",
        flex: "none",
      }}
    >
      {children}
    </button>
  );
}
