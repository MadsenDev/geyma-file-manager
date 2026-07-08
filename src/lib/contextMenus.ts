import type React from "react";
import { tr } from "@/i18n";
import { useStore } from "../state/store";

type ContextEvent = Pick<React.MouseEvent, "preventDefault" | "stopPropagation" | "clientX" | "clientY">;

function copyPath(path: string) {
  navigator.clipboard?.writeText(path).then(
    () => useStore.getState().showToast(tr("menu.path_copied")),
    () => useStore.getState().showToast(tr("menu.copy_path_failed")),
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
      { label: tr("menu.open"), onClick: () => store.goPlace(path) },
      { label: tr("menu.open_in_new_tab"), onClick: () => store.newTab(path) },
      {
        label: tr("menu.open_in_lower_pane"),
        onClick: () => {
          store.showModule("files2", "center2");
          store.goPath2(path);
        },
      },
      { divider: true },
      { label: tr("menu.copy_path"), onClick: () => copyPath(path) },
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
      { label: tr("menu.quick_look"), onClick: () => revealReferencedPath(path, true) },
      { label: tr("menu.show_in_folder"), onClick: () => revealReferencedPath(path) },
      { label: starred ? tr("menu.remove_star") : tr("menu.star"), onClick: () => store.toggleStar([path]) },
      { divider: true },
      { label: tr("menu.copy_path"), onClick: () => copyPath(path) },
    ],
  });
}
