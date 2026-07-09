import { tr } from "@/i18n";
import { useState } from "react";
import type { FsEntry } from "../../fs/types";
import { basenamePosix, joinPosix } from "../../fs/pathUtil";
import { isRemotePath, remoteBasename } from "../../fs/remotePath";
import { Icon } from "../../icons/Icon";
import { ICONS } from "../../icons/paths";
import { useStore } from "../../state/store";
import type { Ghost } from "../../state/types";
import { hexA } from "../../theme/skins";
import { useTheme } from "../../theme/ThemeContext";

// The Files grid/list interleaves real entries with ghost breadcrumbs ("a file that
// just left went to X"); both carry an FsEntry so they sort through compareEntries.
export type DisplayRow =
  | { kind: "entry"; entry: FsEntry }
  | { kind: "ghost"; ghost: Ghost; entry: FsEntry };

/** Stand-in FsEntry used only to sort a ghost into the spot its file occupied. */
export function ghostSortEntry(g: Ghost): FsEntry {
  return {
    name: g.name,
    path: g.fromPath,
    isDir: g.isDir ?? false,
    size: g.size ?? 0,
    modifiedMs: g.modifiedMs ?? g.atMs,
    createdMs: g.modifiedMs ?? g.atMs,
    isHidden: false,
  };
}

function ghostDestName(toDir: string): string {
  const name = isRemotePath(toDir) ? remoteBasename(toDir) : basenamePosix(toDir);
  return name || toDir;
}

function ghostAgo(atMs: number): string {
  const s = Math.max(0, Math.round((Date.now() - atMs) / 1000));
  if (s < 45) return tr("time.just_now");
  const m = Math.round(s / 60);
  if (m < 60) return tr("ui.files.m_m_ago", { m });
  const h = Math.round(m / 60);
  return h < 24 ? tr("ui.files.h_h_ago", { h }) : tr("ui.files.d_d_ago", { d: Math.round(h / 24) });
}

function useFollowGhost(ghost: Ghost) {
  const goPath = useStore((s) => s.goPath);
  const select = useStore((s) => s.select);
  return () => {
    goPath(ghost.toDir);
    setTimeout(() => select(joinPosix(ghost.toDir, ghost.toName)), 0);
  };
}

function GhostDismiss({ ghost, visible, style }: { ghost: Ghost; visible: boolean; style?: React.CSSProperties }) {
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
        ...style,
      }}
    >
      <Icon d={ICONS.close} size={9} strokeWidth={2.4} />
    </button>
  );
}

function GhostDestChip({ ghost, hover }: { ghost: Ghost; hover: boolean }) {
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
        transition: "background .15s ease",
      }}
    >
      <Icon d={ICONS.chevronRight} size={9} strokeWidth={2.4} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {ghostDestName(ghost.toDir)}
      </span>
    </span>
  );
}

export function GhostTile({ ghost }: { ghost: Ghost }) {
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
        toDir: ghost.toDir,
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
        transition: "opacity .15s ease, border-color .15s ease, background .15s ease",
      }}
    >
      <GhostDismiss ghost={ghost} visible={hover} style={{ position: "absolute", top: 5, right: 5 }} />
      <div style={{ position: "relative", width: 46, height: 46, display: "grid", placeItems: "center" }}>
        <span
          className="gy-ghost-bob"
          style={{
            display: "grid",
            placeItems: "center",
            color: hover ? t.accent : hexA(t.ink, 0.5),
            transition: "color .15s ease",
          }}
        >
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
            opacity: 0.5,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12.5,
          fontStyle: "italic",
          textAlign: "center",
          wordBreak: "break-word",
          lineHeight: 1.25,
          color: t.inkSoft,
        }}
      >
        {ghost.name}
      </span>
      <GhostDestChip ghost={ghost} hover={hover} />
      <span
        style={{
          fontFamily: t.mono,
          fontSize: 9,
          color: hover ? t.accent : t.inkFaint,
          transition: "color .15s ease",
        }}
      >
        {hover ? tr("ui.files.click_to_follow") : tr("ui.files.moved_ago", { ago: ghostAgo(ghost.atMs) })}
      </span>
    </div>
  );
}

export function GhostRow({ ghost }: { ghost: Ghost }) {
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
        toDir: ghost.toDir,
      })}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 8px",
        borderBottom: `1px solid ${t.border}`,
        cursor: "pointer",
        userSelect: "none",
        opacity: hover ? 1 : 0.62,
        background: hover ? hexA(t.accent, 0.06) : "transparent",
        transition: "opacity .15s ease, background .15s ease",
      }}
    >
      <span
        className="gy-ghost-bob"
        style={{
          display: "grid",
          placeItems: "center",
          color: hover ? t.accent : hexA(t.ink, 0.45),
          transition: "color .15s ease",
        }}
      >
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
          whiteSpace: "nowrap",
        }}
      >
        {ghost.name}
      </span>
      <GhostDestChip ghost={ghost} hover={hover} />
      <span
        style={{
          flex: "none",
          fontFamily: t.mono,
          fontSize: 9.5,
          color: hover ? t.accent : t.inkFaint,
          transition: "color .15s ease",
        }}
      >
        {hover ? "follow" : ghostAgo(ghost.atMs)}
      </span>
      <GhostDismiss ghost={ghost} visible={hover} style={{ flex: "none" }} />
    </div>
  );
}
