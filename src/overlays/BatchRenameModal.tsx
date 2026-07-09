import { tr } from "@/i18n";
import { useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import { Modal } from "./Modal";
import { computeBatchNames } from "../lib/batchRename";
import { useStore } from "../state/store";
import { aiGenerate } from "../ai/ollama";
import type { FsEntry } from "../fs/types";
interface BatchRenameModalProps {
  entries: FsEntry[];
  onConfirm: (template: string, startAt: number) => void;
  onClose: () => void;
}
function buildRenamePrompt(names: string[]): string {
  return `You suggest a rename template for a batch-rename tool in a file manager. The template
supports two placeholders: {name} (the file's original base name, without extension) and one or
more consecutive # characters (a zero-padded sequence number, e.g. ## becomes 01, 02, ...).
Respond with ONLY the template string, nothing else — no quotes, no explanation.

Files to rename (${names.length}):
${names.slice(0, 25).join("\n")}`;
}
export function BatchRenameModal({
  entries,
  onConfirm,
  onClose
}: BatchRenameModalProps) {
  const t = useTheme();
  const [template, setTemplate] = useState("{name}");
  const [startAt, setStartAt] = useState(1);
  const aiRenameEnabled = useStore((s) => s.aiRenameEnabled);
  const aiRunning = useStore((s) => s.aiRunning);
  const aiSelectedModel = useStore((s) => s.aiSelectedModel);
  const showError = useStore((s) => s.showError);
  const [suggesting, setSuggesting] = useState(false);
  const aiAvailable = aiRenameEnabled && aiRunning && !!aiSelectedModel;
  async function handleSuggest() {
    setSuggesting(true);
    try {
      const raw = await aiGenerate(
        aiSelectedModel,
        buildRenamePrompt(entries.map((e) => e.name))
      );
      const suggestion = raw.
      trim().
      replace(/^["'`]+|["'`]+$/g, "").
      split("\n")[0].
      trim();
      if (!suggestion)
      throw new Error(tr("ui.batch_rename_modal.empty_suggestion"));
      setTemplate(suggestion);
    } catch (e) {
      showError(tr("toast.ai_suggestion_failed"), e);
    } finally {
      setSuggesting(false);
    }
  }
  const preview = computeBatchNames(entries, template, startAt);
  const inputStyle = {
    width: "100%",
    height: 34,
    border: `1px solid ${
    t.border}`,

    borderRadius: 8,
    padding: "0 10px",
    fontSize: 13,
    background: t.main,
    color: t.ink
  };
  return (
    <Modal
      title={tr("ui.batch_rename_modal.batch_rename_length_items", {
        length: entries.length
      })}
      onClose={onClose}>
      
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6
        }}>
        
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: t.inkSoft
          }}>
          
          {tr("ui.batch_rename_modal.pattern_help")}
        </label>
        {aiAvailable &&
        <button
          onClick={handleSuggest}
          disabled={suggesting}
          className="gy-soft"
          style={{
            flex: "none",
            border: `1px solid ${
            t.border}`,

            background: "transparent",
            color: t.inkSoft,
            borderRadius: 7,
            padding: "3px 9px",
            fontSize: 11,
            cursor: "pointer"
          }}>
          
            {suggesting ?
          tr("ui.batch_rename_modal.asking_ai") :
          tr("ui.batch_rename_modal.suggest_ai")}
          </button>
        }
      </div>
      <input
        autoFocus
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        style={inputStyle} />
      

      <label
        style={{
          display: "block",
          fontSize: 12,
          color: t.inkSoft,
          margin: "10px 0 6px"
        }}>
        
        {tr("ui.batch_rename_modal.start_number")}
      </label>
      <input
        type="number"
        value={startAt}
        onChange={(e) => setStartAt(Number(e.target.value) || 0)}
        style={{
          ...inputStyle,
          width: 90
        }} />
      

      <div
        style={{
          marginTop: 12,
          maxHeight: 160,
          overflow: "auto",
          border: `1px solid ${
          t.border}`,

          borderRadius: 8
        }}>
        
        {entries.map((entry, i) =>
        <div
          key={entry.path}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "5px 8px",
            fontSize: 11.5,
            fontFamily: t.mono,
            borderBottom:
            i < entries.length - 1 ? `1px solid ${

            t.border}` :

            "none"
          }}>
          
            <span
            style={{
              flex: 1,
              color: t.inkFaint,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
            
              {entry.name}
            </span>
            <span
            style={{
              color: t.inkFaint
            }}>
            
              →
            </span>
            <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
            
              {preview[i]}
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 14
        }}>
        
        <button
          onClick={onClose}
          className="gy-soft"
          style={{
            border: `1px solid ${
            t.border}`,

            background: "transparent",
            color: t.inkSoft,
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5
          }}>
          
          {tr("ui.batch_rename_modal.cancel")}
        </button>
        <button
          onClick={() => onConfirm(template, startAt)}
          className="gy-prim"
          style={{
            border: "none",
            background: t.accent,
            color: "#fff",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 700
          }}>
          
          {tr("ui.batch_rename_modal.rename")}
        </button>
      </div>
    </Modal>);

}