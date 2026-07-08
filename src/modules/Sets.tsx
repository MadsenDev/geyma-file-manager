import { tr } from "@/i18n";
import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { navItemStyle, iconButtonStyle } from "./common";
import { PromptModal } from "../overlays/Modal";
function toBase64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
function fromBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
type DialogState =
  | {
      kind: "new-set";
    }
  | {
      kind: "new-smart";
    }
  | {
      kind: "note";
      setId: string;
      initial: string;
    }
  | {
      kind: "rename";
      setId: string;
      initial: string;
    }
  | {
      kind: "import";
    }
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
  const duplicateSet = useStore((s) => s.duplicateSet);
  const removeSet = useStore((s) => s.removeSet);
  const setEntriesFor = useStore((s) => s.setEntriesFor);
  const importSet = useStore((s) => s.importSet);
  const backend = useStore((s) => s.backend);
  const showToast = useStore((s) => s.showToast);
  const [dialog, setDialog] = useState<DialogState>(null);
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
                {
                  label: tr("ui.sets.menu_new_set"),
                  onClick: () =>
                    setDialog({
                      kind: "new-set",
                    }),
                },
                {
                  label: tr("ui.sets.menu_new_smart_set"),
                  onClick: () =>
                    setDialog({
                      kind: "new-smart",
                    }),
                },
                {
                  label: tr("ui.sets.menu_import_set"),
                  onClick: () =>
                    setDialog({
                      kind: "import",
                    }),
                },
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
        {setDefs.map((s) => {
          const count = setEntriesFor(s).length;
          return (
            <button
              key={s.id}
              className="gy-item"
              onClick={() => openSet(s.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: [
                    {
                      label: tr("ui.sets.menu_open"),
                      onClick: () => openSet(s.id),
                    },
                    {
                      label: s.note ? tr("ui.sets.menu_edit_note") : tr("ui.sets.menu_add_note"),
                      onClick: () =>
                        setDialog({
                          kind: "note",
                          setId: s.id,
                          initial: s.note || "",
                        }),
                    },
                    {
                      label: tr("ui.sets.menu_rename"),
                      onClick: () =>
                        setDialog({
                          kind: "rename",
                          setId: s.id,
                          initial: s.name,
                        }),
                    },
                    {
                      label: tr("ui.sets.menu_duplicate"),
                      onClick: () => duplicateSet(s.id),
                    },
                    {
                      label: tr("ui.sets.menu_copy_code"),
                      onClick: () => {
                        const items = setEntriesFor(s).map((e) => ({
                          dir: backend?.dirname(e.path) ?? "",
                          name: e.name,
                        }));
                        const payload = {
                          name: s.name,
                          note: s.note || "",
                          smart: !!s.smart,
                          rule: s.rule || null,
                          items,
                        };
                        const code =
                          "GYSET." + toBase64Utf8(JSON.stringify(payload));
                        navigator.clipboard?.writeText(code).catch(() => {});
                        showToast(tr("ui.sets.code_copied"));
                      },
                    },
                    {
                      divider: true,
                    },
                    {
                      label: tr("ui.sets.menu_remove"),
                      danger: true,
                      onClick: () => removeSet(s.id),
                    },
                  ],
                });
              }}
              style={{
                ...navItemStyle(t, activeSetId === s.id, false),
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 1,
                padding: "6px 9px",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                }}
              >
                <Icon d={s.smart ? ICONS.lightning : ICONS.folder} size={14} />
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
                <span
                  style={{
                    fontFamily: t.mono,
                    fontSize: 10.5,
                    color: t.inkFaint,
                  }}
                >
                  {count}
                </span>
              </span>
              {(s.note || s.smart) && (
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
                  {s.note || tr("ui.sets.smart_badge")}
                </span>
              )}
            </button>
          );
        })}
        {setDefs.length === 0 && (
          <div
            style={{
              padding: "6px 9px",
              fontSize: 11.5,
              color: t.inkFaint,
            }}
          >
            {tr("ui.sets.no_sets_yet_create_one_above")}
          </div>
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
      {dialog?.kind === "new-smart" && (
        <PromptModal
          title={tr("ui.sets.new_smart_set")}
          label={tr("ui.sets.name_rule_starred_items")}
          confirmLabel={tr("common.create")}
          onClose={() => setDialog(null)}
          onConfirm={(name) => {
            if (name.trim())
              createSmartSet(name.trim(), {
                starred: true,
              });
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
      {dialog?.kind === "import" && (
        <PromptModal
          title={tr("ui.sets.import_set_code")}
          label={tr("ui.sets.paste_a_gyset_code")}
          confirmLabel={tr("common.import")}
          onClose={() => setDialog(null)}
          onConfirm={(code) => {
            try {
              const json = fromBase64Utf8(code.trim().replace(/^GYSET\./, ""));
              const parsed = JSON.parse(json);
              importSet({
                name: parsed.name,
                note: parsed.note || undefined,
                smart: !!parsed.smart,
                rule: parsed.rule || undefined,
                items: Array.isArray(parsed.items) ? parsed.items : [],
              });
              showToast(tr("ui.sets.imported", { name: parsed.name || tr("ui.sets.fallback_name") }));
            } catch {
              showToast(tr("ui.sets.bad_code"));
            }
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
