import { tr } from "@/i18n";
import { useState, type ReactNode } from "react";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}
export function Modal({ title, onClose, children }: ModalProps) {
  const t = useTheme();
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: hexA("#000000", t.isDark ? 0.5 : 0.28),
          zIndex: 300
        }} />
      
      <div
        className="gy-anim"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(380px, 100vw - 48px)",
          background: t.card,
          border: `1px solid ${
          t.border}`,

          borderRadius: 12,
          boxShadow: `0 24px 64px ${hexA("#000000", t.isDark ? 0.6 : 0.28)}`,
          zIndex: 301,
          padding: 16
        }}>
        
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            color: t.inkFaint,
            marginBottom: 10,
            fontWeight: 700
          }}>
          
          {title}
        </div>
        {children}
      </div>
    </>);

}
interface PromptModalProps {
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
  multiline?: boolean;
  onConfirm: (value: string) => void;
  onClose: () => void;
}
export function PromptModal({
  title,
  label,
  initial = "",
  confirmLabel = tr("ui.modal.save"),
  multiline,
  onConfirm,
  onClose
}: PromptModalProps) {
  const t = useTheme();
  const [value, setValue] = useState(initial);
  return (
    <Modal title={title} onClose={onClose}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: t.inkSoft,
          marginBottom: 6
        }}>
        
        {label}
      </label>
      {multiline ?
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          border: `1px solid ${
          t.border}`,

          borderRadius: 8,
          padding: 8,
          fontFamily: t.mono,
          fontSize: 12.5,
          resize: "vertical",
          background: t.main,
          color: t.ink
        }} /> :


      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirm(value);
        }}
        style={{
          width: "100%",
          height: 34,
          border: `1px solid ${
          t.border}`,

          borderRadius: 8,
          padding: "0 10px",
          fontSize: 13,
          background: t.main,
          color: t.ink
        }} />

      }
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
          
          {tr("ui.modal.cancel")}
        </button>
        <button
          onClick={() => onConfirm(value)}
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
          
          {confirmLabel}
        </button>
      </div>
    </Modal>);

}