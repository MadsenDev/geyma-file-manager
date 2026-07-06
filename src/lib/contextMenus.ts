import type React from "react";
import { useStore } from "../state/store";

type ContextEvent = Pick<React.MouseEvent, "preventDefault" | "stopPropagation" | "clientX" | "clientY">;

function copyPath(path: string) {
  navigator.clipboard?.writeText(path).then(
    () => useStore.getState().showToast("Path copied to clipboard"),
    () => useStore.getState().showToast("Could not copy path"),
  );
}

export function openLocationMenu(event: ContextEvent, path: string) {
  event.preventDefault();
  event.stopPropagation();
  const store = useStore.getState();
  store.openMenu({
    x: event.clientX,
    y: event.clientY,
    items: [
      { label: "Open", onClick: () => store.goPlace(path) },
      {
        label: "Open in lower pane",
        onClick: () => {
          store.showModule("files2", "center2");
          store.goPath2(path);
        },
      },
      { divider: true },
      { label: "Copy path", onClick: () => copyPath(path) },
    ],
  });
}

export function revealReferencedPath(path: string, preview = false) {
  const store = useStore.getState();
  const parent = store.backend?.dirname(path);
  if (parent) store.goPath(parent);
  store.select(path);
  if (preview) store.openPreview(path);
}

export function openReferencedPathMenu(event: ContextEvent, path: string) {
  event.preventDefault();
  event.stopPropagation();
  const store = useStore.getState();
  const starred = store.starred.has(path);
  store.openMenu({
    x: event.clientX,
    y: event.clientY,
    items: [
      { label: "Quick Look", onClick: () => revealReferencedPath(path, true) },
      { label: "Show in folder", onClick: () => revealReferencedPath(path) },
      { label: starred ? "Remove star" : "Star", onClick: () => store.toggleStar([path]) },
      { divider: true },
      { label: "Copy path", onClick: () => copyPath(path) },
    ],
  });
}
