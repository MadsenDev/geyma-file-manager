// Context-menu builders for the Files module. Menus are constructed at click time,
// so store state/actions are read through useStore.getState() (same pattern as
// lib/contextMenus.ts); only Files-local callbacks come in through `local`.
import { tr } from "@/i18n";
import type { FsEntry } from "../../fs/types";
import { isRemotePath } from "../../fs/remotePath";
import { isExtractableArchive } from "../../lib/format";
import { useStore } from "../../state/store";

export function fileOrigin(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return undefined;
  const rect = target.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export interface FilesMenuLocal {
  onOpen: (entry: FsEntry) => void;
  onBatchRename: (targets: string[]) => void;
  onProperties: (entry: FsEntry) => void;
}

export function openFilesItemMenu(entry: FsEntry, e: React.MouseEvent, local: FilesMenuLocal) {
  e.preventDefault();
  e.stopPropagation();
  const st = useStore.getState();
  const wasSelected = st.selected.includes(entry.path);
  if (!wasSelected) st.select(entry.path);
  const targets = wasSelected ? st.selected : [entry.path];
  const multi = targets.length > 1;
  const isStarred = st.starred.has(entry.path);
  const remote = isRemotePath(entry.path);
  if (st.trashView) {
    st.openMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: multi
            ? tr("ui.files.restore_length_items", { length: targets.length })
            : tr("ui.files.restore"),
          onClick: () => st.restoreEntries(targets),
        },
        { divider: true },
        {
          label: multi
            ? tr("ui.files.delete_length_items_permanently", { length: targets.length })
            : tr("ui.files.delete_permanently"),
          danger: true,
          onClick: () => st.requestPermanentDelete(targets),
        },
      ],
    });
    return;
  }
  const manualSets = st.setDefs.filter((s) => !s.smart);
  st.openMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      !multi
        ? {
            label: tr("ui.files.open"),
            onClick: () => local.onOpen(entry),
          }
        : undefined,
      !multi
        ? {
            label: tr("ui.files.quick_look"),
            onClick: () => st.openPreview(entry.path, fileOrigin(e.currentTarget)),
          }
        : undefined,
      {
        label: isStarred ? tr("ui.files.remove_star") : tr("ui.files.star"),
        onClick: () => st.toggleStar(targets),
      },
      !multi && entry.isDir
        ? {
            label: tr("ui.files.open_in_new_tab"),
            onClick: () => st.newTab(entry.path),
          }
        : undefined,
      !multi && entry.isDir
        ? {
            label: tr("ui.files.open_in_lower_pane"),
            onClick: () => {
              st.showModule("files2", "center2");
              st.goPath2(entry.path);
            },
          }
        : undefined,
      !multi && !remote && isExtractableArchive(entry.name)
        ? {
            label: tr("ui.files.extract_here"),
            onClick: () => void st.extractHere(entry.path),
          }
        : undefined,
      !multi && !remote
        ? {
            label: tr("ui.files.create_symlink_here"),
            onClick: () => void st.createSymlinkFor(entry.path),
          }
        : undefined,
      { divider: true },
      {
        label: tr("ui.files.cut"),
        onClick: () => st.setClip("cut", targets),
      },
      {
        label: tr("ui.files.copy"),
        onClick: () => st.setClip("copy", targets),
      },
      {
        label: multi
          ? tr("ui.files.duplicate_length_items", { length: targets.length })
          : tr("ui.files.duplicate"),
        onClick: () => st.duplicateEntries(targets),
      },
      multi
        ? {
            label: tr("ui.files.batch_rename_length_items", { length: targets.length }),
            onClick: () => local.onBatchRename(targets),
          }
        : undefined,
      remote
        ? undefined
        : {
            label: multi
              ? tr("ui.files.compress_length_items_to_zip", { length: targets.length })
              : tr("ui.files.compress_name_to_zip", { name: entry.name }),
            onClick: () =>
              void st.compressEntries(targets, multi ? tr("ui.files.archive") : `${entry.name}.zip`),
          },
      {
        label: multi ? tr("ui.files.copy_paths") : tr("ui.files.copy_path"),
        onClick: () => {
          void navigator.clipboard.writeText(targets.join("\n"));
          st.showToast(multi ? tr("ui.files.paths_copied") : tr("ui.files.path_copied"));
        },
      },
      ...manualSets.map((s) => ({
        label: tr("ui.files.add_to_name", { name: s.name }),
        onClick: () =>
          st.addToSet(
            s.id,
            targets.map((p) => ({
              dir: st.backend?.dirname(p) || st.path,
              name: st.backend?.basename(p) || p,
            })),
          ),
      })),
      { divider: true },
      !multi
        ? {
            label: tr("ui.files.rename"),
            onClick: () => st.startRename(entry.path),
          }
        : undefined,
      !multi
        ? {
            label: tr("ui.files.properties"),
            onClick: () => local.onProperties(entry),
          }
        : undefined,
      remote
        ? {
            label: multi
              ? tr("ui.files.delete_length_items_permanently", { length: targets.length })
              : tr("ui.files.delete_permanently"),
            danger: true,
            onClick: () => st.requestPermanentDelete(targets),
          }
        : {
            label: multi
              ? tr("ui.files.trash_length_items", { length: targets.length })
              : tr("ui.files.trash"),
            danger: true,
            onClick: () => st.trashEntries(targets),
          },
    ].filter(Boolean) as {
      label: string;
      onClick?: () => void;
      danger?: boolean;
      divider?: boolean;
    }[],
  });
}

export function openFilesBlankMenu(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  const st = useStore.getState();
  st.openMenu({
    x: e.clientX,
    y: e.clientY,
    items: [
      {
        label: tr("ui.files.new_folder"),
        onClick: () => void st.createFolder(),
      },
      {
        label: tr("ui.files.new_text_file"),
        onClick: () => void st.createTextFile("text"),
      },
      {
        label: tr("ui.files.new_markdown_note"),
        onClick: () => void st.createTextFile("markdown"),
      },
      { divider: true },
      st.clip
        ? {
            label: tr("ui.files.paste"),
            onClick: () => void st.pasteClip(),
          }
        : undefined,
      {
        label: tr("ui.files.select_all"),
        onClick: () => useStore.getState().selectAll(),
      },
    ].filter(Boolean) as {
      label: string;
      onClick?: () => void;
      divider?: boolean;
    }[],
  });
}
