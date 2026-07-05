import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { navItemStyle, iconButtonStyle } from "./common";
import { PromptModal } from "../overlays/Modal";

type DialogState =
  | { kind: "new-set" }
  | { kind: "new-smart" }
  | { kind: "note"; setId: string; initial: string }
  | { kind: "rename"; setId: string; initial: string }
  | { kind: "import" }
  | null;

export function Sets() {
  const t = useTheme();
  const setDefs = useStore((s) => s.setDefs);
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
  const showToast = useStore((s) => s.showToast);
  const [dialog, setDialog] = useState<DialogState>(null);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 6px" }}>
        <span style={{ fontFamily: t.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700, color: t.inkFaint }}>Working Sets</span>
        <button
          className="gy-soft"
          style={iconButtonStyle(t)}
          onClick={(e) =>
            openMenu({
              x: e.clientX,
              y: e.clientY,
              items: [
                { label: "New working set…", onClick: () => setDialog({ kind: "new-set" }) },
                { label: "New smart set…", onClick: () => setDialog({ kind: "new-smart" }) },
                { label: "Import set code…", onClick: () => setDialog({ kind: "import" }) },
              ],
            })
          }
        >
          <Icon d={ICONS.plus} size={13} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 6px 8px" }}>
        {setDefs.map((s) => {
          const count = setEntriesFor(s).length;
          return (
            <button
              key={s.id}
              className="gy-item"
              onClick={() => openSet(s.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                openMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: [
                    { label: "Open", onClick: () => openSet(s.id) },
                    { label: s.note ? "Edit note…" : "Add note…", onClick: () => setDialog({ kind: "note", setId: s.id, initial: s.note || "" }) },
                    { label: "Rename", onClick: () => setDialog({ kind: "rename", setId: s.id, initial: s.name }) },
                    { label: "Duplicate", onClick: () => duplicateSet(s.id) },
                    {
                      label: "Copy set code",
                      onClick: () => {
                        const code = "GYSET." + btoa(JSON.stringify(s));
                        navigator.clipboard?.writeText(code).catch(() => {});
                        showToast("Set code copied to clipboard");
                      },
                    },
                    { divider: true },
                    { label: "Remove", danger: true, onClick: () => removeSet(s.id) },
                  ],
                });
              }}
              style={{ ...navItemStyle(t, activeSetId === s.id, false), flexDirection: "column", alignItems: "flex-start", gap: 1, padding: "6px 9px" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                <Icon d={s.smart ? ICONS.lightning : ICONS.folder} size={14} />
                <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}>{count}</span>
              </span>
              {(s.note || s.smart) && (
                <span style={{ fontSize: 10, color: t.inkFaint, paddingLeft: 22, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "left" }}>
                  {s.note || "smart · fills itself"}
                </span>
              )}
            </button>
          );
        })}
        {setDefs.length === 0 && <div style={{ padding: "6px 9px", fontSize: 11.5, color: t.inkFaint }}>No sets yet — create one above.</div>}
      </div>

      {dialog?.kind === "new-set" && (
        <PromptModal
          title="New working set"
          label="Name"
          confirmLabel="Create"
          onClose={() => setDialog(null)}
          onConfirm={(name) => {
            if (name.trim()) createManualSet(name.trim());
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "new-smart" && (
        <PromptModal
          title="New smart set"
          label="Name (rule: starred items)"
          confirmLabel="Create"
          onClose={() => setDialog(null)}
          onConfirm={(name) => {
            if (name.trim()) createSmartSet(name.trim(), { starred: true });
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "note" && (
        <PromptModal
          title="Set note"
          label="Note"
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
          title="Rename set"
          label="Name"
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
          title="Import set code"
          label="Paste a GYSET. code"
          confirmLabel="Import"
          onClose={() => setDialog(null)}
          onConfirm={(code) => {
            try {
              const json = atob(code.replace(/^GYSET\./, ""));
              const parsed = JSON.parse(json);
              createManualSet(parsed.name || "Imported set");
              showToast("Set imported");
            } catch {
              showToast("Invalid set code");
            }
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
