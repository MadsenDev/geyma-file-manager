import { tr } from "@/i18n";
import { useState } from "react";
import { Icon } from "../../icons/Icon";
import { ICONS } from "../../icons/paths";
import { useStore } from "../../state/store";
import type { SetItemRef, WorkingSet } from "../../state/types";
import { hexA } from "../../theme/skins";
import { useTheme } from "../../theme/ThemeContext";

const MISSING_AMBER = "#c98a2b";

// A working set holds references, so a ref whose folder is listed but whose name is
// gone is provably missing — surface it instead of silently shrinking the set. The
// Locate action walks the portable-matching ladder: exact path already failed, so try
// same-filename across browsed/scanned folders, and ask via menu when it's ambiguous.
export function MissingItemsBanner({ set: setDef, missing }: { set: WorkingSet; missing: SetItemRef[] }) {
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
