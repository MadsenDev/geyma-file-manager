import { tr } from "@/i18n";
import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { navItemStyle, iconButtonStyle } from "./common";
import { Modal, PromptModal } from "../overlays/Modal";
import { SetRuleModal } from "../overlays/SetRuleModal";
import { buildGysetPayload, encodeGysetCode } from "../lib/gyset";
import type { WorkingSet } from "../state/types";

const SET_COLORS = ["#e05252", "#e08a3c", "#caa53d", "#58a55c", "#4ab0a6", "#4a90d9", "#7a6ff0", "#d066b1"];
const SET_ICONS = ["folder", "lightning", "star", "documents", "pictures", "videos", "music", "code", "network", "clock"] as const;

type DialogState =
  | { kind: "new-set" }
  | { kind: "rule"; setId?: string }
  | { kind: "note"; setId: string; initial: string }
  | { kind: "rename"; setId: string; initial: string }
  | { kind: "style"; setId: string }
  | { kind: "import" }
  | null;

export function Sets() {
  const t = useTheme();
  const setDefs = useStore((s) => s.setDefs);
  // Subscribed so this re-renders when directory caches refresh — setEntriesFor()
  // resolves refs against s.dirs, but selecting the function alone wouldn't.
  useStore((s) => s.dirs);
  const activeSetId = useStore((s) => s.activeSetId);
  const openSet = useStore((s) => s.openSet);
  const openMenu = useStore((s) => s.openMenu);
  const createManualSet = useStore((s) => s.createManualSet);
  const createSmartSet = useStore((s) => s.createSmartSet);
  const renameSet = useStore((s) => s.renameSet);
  const setNote = useStore((s) => s.setNote);
  const setSetRule = useStore((s) => s.setSetRule);
  const setSetMeta = useStore((s) => s.setSetMeta);
  const duplicateSet = useStore((s) => s.duplicateSet);
  const removeSet = useStore((s) => s.removeSet);
  const setEntriesFor = useStore((s) => s.setEntriesFor);
  const setResolutionFor = useStore((s) => s.setResolutionFor);
  const importSetFromText = useStore((s) => s.importSetFromText);
  const exportSetToFile = useStore((s) => s.exportSetToFile);
  const showToast = useStore((s) => s.showToast);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activeSets = setDefs.filter((s) => !s.archived);
  const archivedSets = setDefs.filter((s) => s.archived);
  const ordered = [...activeSets.filter((s) => s.pinned), ...activeSets.filter((s) => !s.pinned)];

  function setMenu(s: WorkingSet, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const hybrid = !s.smart && !!s.rule;
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: tr("ui.sets.menu_open"), onClick: () => openSet(s.id) },
        {
          label: s.rule ? tr("ui.sets.menu_edit_rule") : tr("ui.sets.menu_add_rule"),
          onClick: () => setDialog({ kind: "rule", setId: s.id }),
        },
        hybrid
          ? {
              label: tr("ui.sets.menu_remove_rule"),
              onClick: () => setSetRule(s.id, undefined),
            }
          : undefined,
        {
          label: s.note ? tr("ui.sets.menu_edit_note") : tr("ui.sets.menu_add_note"),
          onClick: () => setDialog({ kind: "note", setId: s.id, initial: s.note || "" }),
        },
        { label: tr("ui.sets.menu_rename"), onClick: () => setDialog({ kind: "rename", setId: s.id, initial: s.name }) },
        { label: tr("ui.sets.menu_style"), onClick: () => setDialog({ kind: "style", setId: s.id }) },
        {
          label: s.pinned ? tr("ui.sets.menu_unpin") : tr("ui.sets.menu_pin"),
          onClick: () => setSetMeta(s.id, { pinned: !s.pinned }),
        },
        { label: tr("ui.sets.menu_duplicate"), onClick: () => duplicateSet(s.id) },
        { divider: true },
        {
          label: tr("ui.sets.menu_copy_code"),
          onClick: () => {
            const code = encodeGysetCode(buildGysetPayload(s));
            navigator.clipboard?.writeText(code).catch(() => {});
            showToast(tr("ui.sets.code_copied"));
          },
        },
        { label: tr("ui.sets.menu_export_file"), onClick: () => void exportSetToFile(s.id) },
        { divider: true },
        {
          label: s.archived ? tr("ui.sets.menu_unarchive") : tr("ui.sets.menu_archive"),
          onClick: () => setSetMeta(s.id, { archived: !s.archived }),
        },
        { label: tr("ui.sets.menu_remove"), danger: true, onClick: () => removeSet(s.id) },
      ].filter(Boolean) as { label?: string; onClick?: () => void; danger?: boolean; divider?: boolean }[],
    });
  }

  function renderSetRow(s: WorkingSet) {
    const count = setEntriesFor(s).length;
    const missing = setResolutionFor(s).missing.length;
    const hybrid = !s.smart && !!s.rule;
    const glyph = (s.icon && ICONS[s.icon as keyof typeof ICONS]) || (s.smart ? ICONS.lightning : ICONS.folder);
    const sub = s.note || (s.smart ? tr("ui.sets.smart_badge") : hybrid ? tr("ui.sets.hybrid_badge") : "");
    return (
      <button
        key={s.id}
        className="gy-item"
        onClick={() => openSet(s.id)}
        onContextMenu={(e) => setMenu(s, e)}
        title={s.lastUsedMs ? tr("ui.sets.last_used", { when: new Date(s.lastUsedMs).toLocaleString() }) : undefined}
        style={{
          ...navItemStyle(t, activeSetId === s.id, false),
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 1,
          padding: "6px 9px",
          opacity: s.archived ? 0.65 : 1,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <span style={{ display: "flex", color: s.color || undefined }}>
            <Icon d={glyph} size={14} />
          </span>
          <span
            style={{
              flex: 1,
              textAlign: "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {s.name}
          </span>
          {s.pinned && (
            <span style={{ display: "flex", color: t.inkFaint }}>
              <Icon d={ICONS.pin} size={11} />
            </span>
          )}
          {missing > 0 && (
            <span
              title={tr("ui.sets.missing_count", { count: missing })}
              style={{ fontFamily: t.mono, fontSize: 10.5, color: "#c98a2b", fontWeight: 700 }}
            >
              !{missing}
            </span>
          )}
          <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}>{count}</span>
        </span>
        {sub && (
          <span
            style={{
              fontSize: 10,
              color: t.inkFaint,
              paddingLeft: 22,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              width: "100%",
              textAlign: "left",
            }}
          >
            {sub}
          </span>
        )}
      </button>
    );
  }

  const dialogSet = dialog && "setId" in dialog && dialog.setId ? setDefs.find((s) => s.id === dialog.setId) : undefined;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px 6px",
        }}
      >
        <span
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".12em",
            fontWeight: 700,
            color: t.inkFaint,
          }}
        >
          {tr("ui.sets.working_sets")}
        </span>
        <button
          className="gy-soft"
          style={iconButtonStyle(t)}
          onClick={(e) =>
            openMenu({
              x: e.clientX,
              y: e.clientY,
              items: [
                { label: tr("ui.sets.menu_new_set"), onClick: () => setDialog({ kind: "new-set" }) },
                { label: tr("ui.sets.menu_new_smart_set"), onClick: () => setDialog({ kind: "rule" }) },
                { label: tr("ui.sets.menu_import_set"), onClick: () => setDialog({ kind: "import" }) },
              ],
            })
          }
        >
          <Icon d={ICONS.plus} size={13} />
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "0 6px 8px",
        }}
      >
        {ordered.map(renderSetRow)}
        {ordered.length === 0 && archivedSets.length === 0 && (
          <div style={{ padding: "6px 9px", fontSize: 11.5, color: t.inkFaint }}>{tr("ui.sets.no_sets_yet_create_one_above")}</div>
        )}
        {archivedSets.length > 0 && (
          <>
            <button
              className="gy-soft"
              onClick={() => setShowArchived(!showArchived)}
              style={{
                border: 0,
                background: "transparent",
                color: t.inkFaint,
                cursor: "pointer",
                textAlign: "left",
                padding: "6px 9px 2px",
                fontFamily: t.mono,
                fontSize: 9.5,
                textTransform: "uppercase",
                letterSpacing: ".1em",
                fontWeight: 700,
              }}
            >
              {showArchived
                ? tr("ui.sets.archived_hide", { count: archivedSets.length })
                : tr("ui.sets.archived_show", { count: archivedSets.length })}
            </button>
            {showArchived && archivedSets.map(renderSetRow)}
          </>
        )}
      </div>

      {dialog?.kind === "new-set" && (
        <PromptModal
          title={tr("ui.sets.new_working_set")}
          label={tr("ui.sets.name")}
          confirmLabel={tr("common.create")}
          onClose={() => setDialog(null)}
          onConfirm={(name) => {
            if (name.trim()) createManualSet(name.trim());
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "rule" && (
        <SetRuleModal
          title={dialogSet ? tr("ui.rule.title_edit") : tr("ui.sets.new_smart_set")}
          initialName={dialogSet?.name}
          initialRule={dialogSet?.rule}
          confirmLabel={dialogSet ? tr("ui.modal.save") : tr("common.create")}
          onClose={() => setDialog(null)}
          onConfirm={(name, rule) => {
            if (dialogSet) {
              setSetRule(dialogSet.id, rule);
              if (name && name !== dialogSet.name) renameSet(dialogSet.id, name);
            } else if (name) {
              createSmartSet(name, rule);
            }
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "note" && (
        <PromptModal
          title={tr("ui.sets.set_note")}
          label={tr("ui.sets.note")}
          multiline
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onConfirm={(note) => {
            setNote(dialog.setId, note);
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "rename" && (
        <PromptModal
          title={tr("ui.sets.rename_set")}
          label={tr("ui.sets.name")}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onConfirm={(name) => {
            if (name.trim()) renameSet(dialog.setId, name.trim());
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "style" && dialogSet && (
        <SetStyleModal
          set={dialogSet}
          onClose={() => setDialog(null)}
          onApply={(patch) => setSetMeta(dialogSet.id, patch)}
        />
      )}
      {dialog?.kind === "import" && (
        <PromptModal
          title={tr("ui.sets.import_set_code")}
          label={tr("ui.sets.paste_a_gyset_code")}
          confirmLabel={tr("common.import")}
          multiline
          onClose={() => setDialog(null)}
          onConfirm={(code) => {
            const name = importSetFromText(code);
            showToast(name ? tr("ui.sets.imported", { name }) : tr("ui.sets.bad_code"));
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function SetStyleModal({
  set: s,
  onClose,
  onApply,
}: {
  set: WorkingSet;
  onClose: () => void;
  onApply: (patch: { color?: string; icon?: string }) => void;
}) {
  const t = useTheme();
  return (
    <Modal title={tr("ui.sets.style_title")} onClose={onClose}>
      <div style={{ fontSize: 11.5, color: t.inkSoft, marginBottom: 6 }}>{tr("ui.sets.style_color")}</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        <button
          onClick={() => onApply({ color: undefined })}
          title={tr("ui.sets.style_none")}
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: `2px solid ${!s.color ? t.accent : t.border}`,
            background: "transparent",
            cursor: "pointer",
          }}
        />
        {SET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onApply({ color: c })}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: `2px solid ${s.color === c ? t.ink : "transparent"}`,
              background: c,
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: t.inkSoft, marginBottom: 6 }}>{tr("ui.sets.style_icon")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        <button
          onClick={() => onApply({ icon: undefined })}
          title={tr("ui.sets.style_default")}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: `1px solid ${!s.icon ? t.accent : t.border}`,
            background: "transparent",
            color: t.inkFaint,
            cursor: "pointer",
            fontSize: 10,
          }}
        >
          —
        </button>
        {SET_ICONS.map((key) => (
          <button
            key={key}
            onClick={() => onApply({ icon: key })}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              border: `1px solid ${s.icon === key ? t.accent : t.border}`,
              background: "transparent",
              color: s.color || t.inkSoft,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon d={ICONS[key]} size={14} />
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button
          onClick={onClose}
          className="gy-prim"
          style={{
            border: "none",
            background: t.accent,
            color: "#fff",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {tr("ui.modal.done")}
        </button>
      </div>
    </Modal>
  );
}
