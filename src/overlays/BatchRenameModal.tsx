import { useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import { Modal } from "./Modal";
import { computeBatchNames } from "../lib/batchRename";
import type { FsEntry } from "../fs/types";

interface BatchRenameModalProps {
  entries: FsEntry[];
  onConfirm: (template: string, startAt: number) => void;
  onClose: () => void;
}

export function BatchRenameModal({ entries, onConfirm, onClose }: BatchRenameModalProps) {
  const t = useTheme();
  const [template, setTemplate] = useState("{name}");
  const [startAt, setStartAt] = useState(1);

  const preview = computeBatchNames(entries, template, startAt);
  const inputStyle = {
    width: "100%",
    height: 34,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "0 10px",
    fontSize: 13,
    background: t.main,
    color: t.ink,
  };

  return (
    <Modal title={`Batch rename ${entries.length} items`} onClose={onClose}>
      <label style={{ display: "block", fontSize: 12, color: t.inkSoft, marginBottom: 6 }}>
        Pattern — {"{name}"} keeps the original name, # runs become a zero-padded number
      </label>
      <input autoFocus value={template} onChange={(e) => setTemplate(e.target.value)} style={inputStyle} />

      <label style={{ display: "block", fontSize: 12, color: t.inkSoft, margin: "10px 0 6px" }}>Start number</label>
      <input
        type="number"
        value={startAt}
        onChange={(e) => setStartAt(Number(e.target.value) || 0)}
        style={{ ...inputStyle, width: 90 }}
      />

      <div style={{ marginTop: 12, maxHeight: 160, overflow: "auto", border: `1px solid ${t.border}`, borderRadius: 8 }}>
        {entries.map((entry, i) => (
          <div
            key={entry.path}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              padding: "5px 8px",
              fontSize: 11.5,
              fontFamily: t.mono,
              borderBottom: i < entries.length - 1 ? `1px solid ${t.border}` : "none",
            }}
          >
            <span style={{ flex: 1, color: t.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.name}
            </span>
            <span style={{ color: t.inkFaint }}>→</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview[i]}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button onClick={onClose} className="gy-soft" style={{ border: `1px solid ${t.border}`, background: "transparent", color: t.inkSoft, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12.5 }}>
          Cancel
        </button>
        <button
          onClick={() => onConfirm(template, startAt)}
          className="gy-prim"
          style={{ border: "none", background: t.accent, color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}
        >
          Rename
        </button>
      </div>
    </Modal>
  );
}
