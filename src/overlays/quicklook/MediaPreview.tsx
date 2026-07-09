import { tr } from "@/i18n";
import type { MediaPlaybackSupport } from "../../fs";
import { useTheme } from "../../theme/ThemeContext";
import { loadFailure } from "./useQuickLookContent";

export function MediaPreview({
  kind,
  url,
  name,
  tileBg,
  tileTint,
  extLabel,
  onError,
}: {
  kind: string;
  url: string;
  name: string;
  tileBg: string;
  tileTint: string;
  extLabel: string;
  onError: (support: MediaPlaybackSupport) => void;
}) {
  const t = useTheme();
  const playbackError = (element: HTMLMediaElement) => {
    const code = element.error?.code;
    const reasons: Record<number, string> = {
      1: tr("ui.quick_look.playback_was_aborted"),
      2: tr("ui.quick_look.the_local_media_stream_could_not_be_read"),
      3: tr("ui.quick_look.the_file_could_not_be_decoded_its_codec_may_not_"),
      4: tr("ui.quick_look.this_media_format_or_codec_is_not_supported"),
    };
    onError(
      loadFailure(
        reasons[code || 0] || tr("ui.quick_look.the_native_media_engine_could_not_play_this_file"),
        code
          ? `WebKit media error code ${code}${
              element.error?.message ? tr("ui.quick_look.message", { message: element.error.message }) : "."
            }`
          : null,
      ),
    );
  };
  if (kind === "pdf") {
    return (
      <iframe
        key={url}
        src={url}
        title={tr("ui.quick_look.preview_of_name", { name })}
        onError={() => onError(loadFailure(tr("ui.quick_look.pdf_render_failed")))}
        style={{
          display: "block",
          width: "100%",
          height: "min(66vh, 620px)",
          border: 0,
          background: "#fff",
        }}
      />
    );
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
          background: "#000",
        }}
      />
    );
  }
  if (kind === "audio") {
    return (
      <div style={{ display: "grid", gap: 18, justifyItems: "center", padding: "36px 24px 28px" }}>
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
            fontWeight: 700,
          }}
        >
          {extLabel}
        </span>
        <audio
          key={url}
          src={url}
          controls
          autoPlay
          onError={(event) => playbackError(event.currentTarget)}
          style={{ width: "100%", maxWidth: 420, accentColor: t.accent }}
        />
      </div>
    );
  }
  return (
    <div style={{ display: "grid", placeItems: "center", padding: 16, minHeight: 220 }}>
      <img
        key={url}
        src={url}
        alt={name}
        onError={() => onError(loadFailure(tr("ui.quick_look.image_decode_failed")))}
        style={{
          maxWidth: "100%",
          maxHeight: "min(62vh, 560px)",
          borderRadius: 8,
          objectFit: "contain",
        }}
      />
    </div>
  );
}
