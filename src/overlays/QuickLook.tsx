import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA, itemColors } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { extOf, formatSize, formatWhen, isTextLike, kindOf } from "../lib/format";
import { getFsBackend } from "../fs";

export function QuickLook() {
  const t = useTheme();
  const preview = useStore((s) => s.preview);
  const path = useStore((s) => s.path);
  const trashView = useStore((s) => s.trashView);
  const trashDir = useStore((s) => s.trashDir);
  const entries = useStore((s) => s.entriesFor(trashView ? trashDir : path));
  const closePreview = useStore((s) => s.closePreview);
  const stepPreview = useStore((s) => s.stepPreview);
  const [content, setContent] = useState<string | null>(null);

  const entry = entries.find((e) => e.path === preview);
  const idx = entries.filter((e) => !e.isDir).findIndex((e) => e.path === preview);
  const textFiles = entries.filter((e) => !e.isDir);

  useEffect(() => {
    if (!entry || entry.isDir) {
      setContent(null);
      return;
    }
    if (!isTextLike(entry.name)) {
      setContent(null);
      return;
    }
    let cancelled = false;
    getFsBackend()
      .then((b) => b.readTextFile(entry.path))
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch(() => {
        if (!cancelled) setContent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [entry?.path]);

  if (!preview || !entry) return null;

  const ext = extOf(entry.name) || (entry.isDir ? "DIR" : "");
  const kind = kindOf(entry.name, entry.isDir);
  const colors = itemColors(kind, t);
  const showText = isTextLike(entry.name) && content != null;

  return (
    <>
      <div
        onClick={closePreview}
        style={{ position: "fixed", inset: 0, background: hexA("#000000", t.isDark ? 0.5 : 0.28), zIndex: 200 }}
      />
      <div
        role="dialog"
        aria-label="Quick Look"
        className="gy-anim"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(560px, 100vw - 48px)",
          maxHeight: "min(74vh, 640px)",
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${t.border}` }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: colors.bg, color: colors.tint, display: "grid", placeItems: "center", fontFamily: t.mono, fontSize: 8, fontWeight: 700, flex: "none" }}>
            {ext.slice(0, 4)}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.name}
          </span>
          <NavBtn onClick={() => stepPreview(-1)} title="Previous"><Icon d={ICONS.chevronLeft} size={14} /></NavBtn>
          <NavBtn onClick={() => stepPreview(1)} title="Next"><Icon d={ICONS.chevronRight} size={14} /></NavBtn>
          <NavBtn onClick={closePreview} title="Close (Space)"><Icon d={ICONS.close} size={14} /></NavBtn>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: showText ? 0 : 20 }}>
          {showText ? (
            <pre style={{ margin: 0, padding: 16, fontFamily: t.mono, fontSize: 12.5, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {content}
            </pre>
          ) : (
            <div style={{ height: 220, display: "grid", placeItems: "center" }}>
              <span style={{ width: 120, height: 120, borderRadius: 16, background: colors.bg, color: colors.tint, display: "grid", placeItems: "center", fontFamily: t.mono, fontSize: 13, fontWeight: 700 }}>
                {ext || "—"}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderTop: `1px solid ${t.border}`, fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>
          <span>{entry.isDir ? "Folder" : `${formatSize(entry.size)} · ${formatWhen(entry.modifiedMs)}`}</span>
          <span>{idx + 1} of {textFiles.length} · SPACE to close</span>
        </div>
      </div>
    </>
  );
}

function NavBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <button
      onClick={onClick}
      title={title}
      className="gy-soft"
      style={{ width: 26, height: 26, display: "grid", placeItems: "center", border: `1px solid ${t.border}`, borderRadius: 8, background: "transparent", color: t.inkSoft, cursor: "pointer", flex: "none" }}
    >
      {children}
    </button>
  );
}
