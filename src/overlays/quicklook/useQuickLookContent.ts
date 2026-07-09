import { tr } from "@/i18n";
import { useEffect, useState } from "react";
import { getFsBackend } from "../../fs";
import type { ArchivePreview, FsEntry, MediaPlaybackSupport } from "../../fs";
import { explainError } from "../../lib/errors";

export type MediaState =
  | { status: "idle" | "loading" }
  | { status: "ready"; url: string }
  | { status: "unavailable"; support: MediaPlaybackSupport };

export type InspectionState =
  | { status: "idle" | "loading" }
  | { status: "archive"; preview: ArchivePreview }
  | { status: "directory"; entries: FsEntry[] }
  | { status: "unavailable"; support: MediaPlaybackSupport };

export function loadFailure(message: string, details: string | null = null): MediaPlaybackSupport {
  return {
    available: false,
    title: tr("ui.quick_look.preview_unavailable"),
    message,
    details,
    installCommand: null,
  };
}

/** Loads whatever the previewed entry needs: a dir listing for folders, an archive
 *  index for archives, a served file URL for media/PDF, or text content otherwise. */
export function useQuickLookContent(entry: FsEntry | undefined, kind: string, usesFileUrl: boolean) {
  const [content, setContent] = useState<string | null>(null);
  const [contentTruncated, setContentTruncated] = useState(false);
  const [mediaState, setMediaState] = useState<MediaState>({ status: "idle" });
  const [inspectionState, setInspectionState] = useState<InspectionState>({ status: "idle" });
  const [previewRetry, setPreviewRetry] = useState(0);

  useEffect(() => {
    setContent(null);
    setContentTruncated(false);
    setMediaState({ status: usesFileUrl ? "loading" : "idle" });
    setInspectionState({ status: "idle" });
    if (!entry) return;
    let cancelled = false;
    if (entry.isDir) {
      setInspectionState({ status: "loading" });
      getFsBackend()
        .then((backend) => backend.listDir(entry.path))
        .then((items) => {
          if (!cancelled) setInspectionState({ status: "directory", entries: items });
        })
        .catch((error) => {
          if (!cancelled)
            setInspectionState({
              status: "unavailable",
              support: loadFailure(tr("ui.quick_look.folder_inspect_failed"), explainError(error)),
            });
        });
      return () => {
        cancelled = true;
      };
    }
    if (kind === "archive") {
      setInspectionState({ status: "loading" });
      getFsBackend()
        .then((backend) => backend.previewArchive(entry.path))
        .then((archive) => {
          if (!cancelled) setInspectionState({ status: "archive", preview: archive });
        })
        .catch((error) => {
          if (!cancelled)
            setInspectionState({
              status: "unavailable",
              support: loadFailure(tr("ui.quick_look.archive_uninspectable"), explainError(error)),
            });
        });
      return () => {
        cancelled = true;
      };
    }
    if (usesFileUrl) {
      getFsBackend()
        .then(async (backend) => {
          if (kind === "audio" || kind === "video") {
            const support = await backend.mediaPlaybackSupport();
            if (!support.available) return { status: "unavailable", support } as const;
          }
          return { status: "ready", url: await backend.fileUrl(entry.path) } as const;
        })
        .then((result) => {
          if (cancelled) return;
          if (result.status === "unavailable") {
            setMediaState({ status: "unavailable", support: result.support });
          } else if (result.url) {
            setMediaState({ status: "ready", url: result.url });
          } else {
            setMediaState({
              status: "unavailable",
              support: loadFailure(tr("ui.quick_look.preview_unavailable")),
            });
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setMediaState({
              status: "unavailable",
              support: loadFailure(tr("ui.quick_look.media_prepare_failed"), explainError(error)),
            });
          }
        });
      return () => {
        cancelled = true;
      };
    }
    setInspectionState({ status: "loading" });
    getFsBackend()
      .then((backend) => backend.previewTextFile(entry.path))
      .then((text) => {
        if (!cancelled) {
          setContent(text?.content ?? null);
          setContentTruncated(text?.truncated ?? false);
          setInspectionState({ status: "idle" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent(null);
          setInspectionState({ status: "idle" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entry?.path, previewRetry]);

  return {
    content,
    contentTruncated,
    mediaState,
    setMediaState,
    inspectionState,
    retry: () => setPreviewRetry((value) => value + 1),
  };
}
