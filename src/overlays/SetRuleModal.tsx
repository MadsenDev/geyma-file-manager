import { tr } from "@/i18n";
import { useState, type CSSProperties } from "react";
import { Modal } from "./Modal";
import { useTheme } from "../theme/ThemeContext";
import { useStore } from "../state/store";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import type { SetRule, SetRuleMatch } from "../state/types";

const KIND_OPTIONS = ["folder", "document", "text", "code", "image", "video", "audio", "archive", "app"] as const;
const MB = 1048576;

interface SetRuleModalProps {
  title: string;
  initialName?: string;
  initialRule?: SetRule;
  confirmLabel: string;
  onConfirm: (name: string, rule: SetRule) => void;
  onClose: () => void;
}

function daysFromLegacyMinMt(rule: SetRule | undefined): string {
  if (!rule) return "";
  if (rule.withinDays) return String(rule.withinDays);
  if (rule.minMt) {
    const days = Math.ceil((Date.now() - rule.minMt) / 86400000);
    return days > 0 ? String(days) : "";
  }
  return "";
}

/** Visual builder for a set's rule — every field is optional; ALL/ANY picks how the
 *  active conditions combine. Scope roots are handled separately (they always constrain). */
export function SetRuleModal({ title, initialName = "", initialRule, confirmLabel, onConfirm, onClose }: SetRuleModalProps) {
  const t = useTheme();
  const path = useStore((s) => s.path);
  const home = useStore((s) => s.home);
  const [name, setName] = useState(initialName);
  const [match, setMatch] = useState<SetRuleMatch>(initialRule?.match === "any" ? "any" : "all");
  const [kind, setKind] = useState(initialRule?.kind || "");
  const [ext, setExt] = useState(initialRule?.ext || "");
  const [nameContains, setNameContains] = useState(initialRule?.nameContains || "");
  const [withinDays, setWithinDays] = useState(daysFromLegacyMinMt(initialRule));
  const [minMb, setMinMb] = useState(initialRule?.minBytes != null ? String(initialRule.minBytes / MB) : "");
  const [maxMb, setMaxMb] = useState(initialRule?.maxBytes != null ? String(initialRule.maxBytes / MB) : "");
  const [starred, setStarred] = useState(!!initialRule?.starred);
  const [roots, setRoots] = useState<string[]>(initialRule?.roots || []);
  const [rootInput, setRootInput] = useState("");

  const inputStyle: CSSProperties = {
    width: "100%",
    height: 30,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "0 9px",
    fontSize: 12.5,
    background: t.main,
    color: t.ink,
  };
  const labelStyle: CSSProperties = { display: "block", fontSize: 11.5, color: t.inkSoft, marginBottom: 4 };
  const rowStyle: CSSProperties = { marginBottom: 10 };

  function addRoot(dir: string) {
    const trimmed = dir.trim();
    if (!trimmed || roots.includes(trimmed)) return;
    setRoots([...roots, trimmed]);
  }

  function quickAddStyle(): CSSProperties {
    return {
      border: `1px solid ${t.border}`,
      background: "transparent",
      color: t.inkSoft,
      borderRadius: 7,
      padding: "3px 8px",
      cursor: "pointer",
      fontSize: 11,
    };
  }

  function confirm() {
    const rule: SetRule = {};
    if (match === "any") rule.match = "any";
    if (kind) rule.kind = kind;
    if (ext.trim()) rule.ext = ext.trim();
    if (nameContains.trim()) rule.nameContains = nameContains.trim();
    const days = parseFloat(withinDays);
    if (Number.isFinite(days) && days > 0) rule.withinDays = days;
    const min = parseFloat(minMb);
    if (Number.isFinite(min) && min > 0) rule.minBytes = Math.round(min * MB);
    const max = parseFloat(maxMb);
    if (Number.isFinite(max) && max > 0) rule.maxBytes = Math.round(max * MB);
    if (starred) rule.starred = true;
    if (roots.length) rule.roots = roots;
    onConfirm(name.trim(), rule);
  }

  return (
    <Modal title={title} onClose={onClose} width={460}>
      <div style={rowStyle}>
        <label style={labelStyle}>{tr("ui.rule.name")}</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>{tr("ui.rule.match_label")}</label>
        <div style={{ display: "inline-flex", border: `1px solid ${t.border}`, borderRadius: 8, overflow: "hidden" }}>
          {(["all", "any"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMatch(m)}
              style={{
                border: 0,
                padding: "5px 14px",
                fontSize: 11,
                fontFamily: t.mono,
                fontWeight: 700,
                textTransform: "uppercase",
                cursor: "pointer",
                background: match === m ? t.accent : "transparent",
                color: match === m ? "#fff" : t.inkFaint,
              }}
            >
              {m === "all" ? tr("ui.rule.match_all") : tr("ui.rule.match_any")}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>{tr("ui.rule.kind")}</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle, padding: "0 6px" }}>
            <option value="">{tr("ui.rule.kind_any")}</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {tr(`kind.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{tr("ui.rule.extensions")}</label>
          <input value={ext} onChange={(e) => setExt(e.target.value)} placeholder={tr("ui.rule.ext_placeholder")} style={inputStyle} />
        </div>
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>{tr("ui.rule.name_contains")}</label>
        <input value={nameContains} onChange={(e) => setNameContains(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>{tr("ui.rule.modified_within_days")}</label>
          <input value={withinDays} onChange={(e) => setWithinDays(e.target.value)} inputMode="numeric" placeholder="—" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{tr("ui.rule.min_size_mb")}</label>
          <input value={minMb} onChange={(e) => setMinMb(e.target.value)} inputMode="decimal" placeholder="—" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{tr("ui.rule.max_size_mb")}</label>
          <input value={maxMb} onChange={(e) => setMaxMb(e.target.value)} inputMode="decimal" placeholder="—" style={inputStyle} />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: t.ink, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={starred} onChange={(e) => setStarred(e.target.checked)} />
        {tr("ui.rule.starred_only")}
      </label>

      <div style={{ marginBottom: 4 }}>
        <label style={labelStyle}>{tr("ui.rule.search_in")}</label>
        {roots.map((r) => (
          <div
            key={r}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontFamily: t.mono,
              color: t.inkSoft,
              padding: "3px 0",
            }}
          >
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r}</span>
            <button
              onClick={() => setRoots(roots.filter((x) => x !== r))}
              className="gy-soft"
              style={{ border: 0, background: "transparent", color: t.inkFaint, cursor: "pointer", display: "flex", padding: 2 }}
            >
              <Icon d={ICONS.close} size={11} />
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            value={rootInput}
            onChange={(e) => setRootInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addRoot(rootInput);
                setRootInput("");
              }
            }}
            placeholder={tr("ui.rule.add_folder_placeholder")}
            style={{ ...inputStyle, height: 28, fontSize: 12 }}
          />
          <button
            onClick={() => {
              addRoot(rootInput);
              setRootInput("");
            }}
            style={quickAddStyle()}
          >
            {tr("ui.rule.add")}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={() => addRoot(path)} style={quickAddStyle()}>
            {tr("ui.rule.add_current_folder")}
          </button>
          <button onClick={() => addRoot(home)} style={quickAddStyle()}>
            {tr("ui.rule.add_home")}
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: t.inkFaint, marginTop: 6, lineHeight: 1.5 }}>{tr("ui.rule.roots_hint")}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button
          onClick={onClose}
          className="gy-soft"
          style={{
            border: `1px solid ${t.border}`,
            background: "transparent",
            color: t.inkSoft,
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5,
          }}
        >
          {tr("ui.modal.cancel")}
        </button>
        <button
          onClick={confirm}
          disabled={!name.trim()}
          className="gy-prim"
          style={{
            border: "none",
            background: t.accent,
            color: "#fff",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: name.trim() ? "pointer" : "default",
            opacity: name.trim() ? 1 : 0.5,
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
