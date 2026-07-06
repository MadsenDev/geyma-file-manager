import { useEffect } from "react";
import { useStore } from "../state/store";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const store = useStore.getState();

      if (store.preview) {
        if (e.key === " " || e.key === "Escape") {
          e.preventDefault();
          store.closePreview();
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          store.stepPreview(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          store.stepPreview(-1);
        }
        return;
      }

      if (store.renaming) {
        return;
      }

      if (isTypingTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === " ") {
        e.preventDefault();
        if (store.selected.length === 1) store.openPreview(store.selected[0]);
        return;
      }
      if (e.key === "s" || e.key === "S") {
        if (store.selected.length) {
          e.preventDefault();
          store.toggleStar(store.selected);
        }
        return;
      }
      if (e.key === "Enter") {
        if (store.selected.length === 1) {
          const entry = store.visibleEntries().find((x) => x.path === store.selected[0]);
          if (entry?.isDir) store.goPath(entry.path);
          else store.openPreview(store.selected[0]);
        }
        return;
      }
      if (e.key === "F2") {
        if (store.selected.length === 1) {
          e.preventDefault();
          store.startRename(store.selected[0]);
        }
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        store.goUp();
        return;
      }
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        void store.undo();
        return;
      }
      if (mod && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        store.selectAll();
        return;
      }
      if (mod && (e.key === "x" || e.key === "X")) {
        if (store.selected.length) store.setClip("cut", store.selected);
        return;
      }
      if (mod && (e.key === "c" || e.key === "C")) {
        if (store.selected.length) store.setClip("copy", store.selected);
        return;
      }
      if (mod && (e.key === "v" || e.key === "V")) {
        void store.pasteClip();
        return;
      }
      if (e.key === "Delete") {
        if (!store.selected.length) return;
        e.preventDefault();
        if (store.trashView) store.requestPermanentDelete(store.selected);
        else void store.trashEntries(store.selected);
        return;
      }
      if (e.key === "Escape") {
        if (store.menu) store.closeMenu();
        else if (store.selected.length) store.clearSelection();
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        const entries = store.visibleEntries();
        if (!entries.length) return;
        e.preventDefault();
        const cols = computeColumns();
        const currentPath = store.selected[store.selected.length - 1];
        let idx = entries.findIndex((x) => x.path === currentPath);
        if (idx < 0) idx = 0;
        let next = idx;
        if (e.key === "ArrowRight") next = Math.min(entries.length - 1, idx + 1);
        else if (e.key === "ArrowLeft") next = Math.max(0, idx - 1);
        else if (e.key === "ArrowDown") next = Math.min(entries.length - 1, idx + cols);
        else if (e.key === "ArrowUp") next = Math.max(0, idx - cols);
        const target = entries[next].path;
        if (e.shiftKey && store.anchor) {
          const ai = entries.findIndex((x) => x.path === store.anchor);
          const [lo, hi] = ai < next ? [ai, next] : [next, ai];
          store.setSelected(entries.slice(lo, hi + 1).map((x) => x.path));
        } else {
          store.select(target);
        }
        const el = document.querySelector<HTMLElement>(`[data-file="${CSS.escape(target)}"]`);
        el?.scrollIntoView({ block: "nearest" });
      }
    }

    function computeColumns(): number {
      const grid = document.querySelector<HTMLElement>("[data-files-grid]");
      if (!grid) return 1;
      const first = grid.querySelector<HTMLElement>("[data-file]");
      if (!first) return 1;
      const rowY = first.offsetTop;
      const children = Array.from(grid.querySelectorAll<HTMLElement>("[data-file]"));
      let count = 0;
      for (const c of children) {
        if (c.offsetTop === rowY) count++;
        else break;
      }
      return Math.max(1, count);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
