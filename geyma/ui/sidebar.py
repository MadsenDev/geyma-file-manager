from __future__ import annotations

from pathlib import Path
import os

from PySide6.QtCore import Qt, Signal, QSize
from PySide6.QtGui import QColor
from PySide6.QtWidgets import QMenu, QTreeWidget, QTreeWidgetItem

from geyma.ui.icons import themed_icon
from geyma.utils.config import ConfigStore
from PySide6.QtWidgets import QStyle


class PlacesSidebar(QTreeWidget):
    pathActivated = Signal(str)
    openInNewWindow = Signal(str)
    showProperties = Signal(str)
    workingSetActivated = Signal(str)
    workingSetRenameRequested = Signal(str)
    workingSetDeleteRequested = Signal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._place_items: dict[str, QTreeWidgetItem] = {}
        self._device_paths: set[str] = set()
        self._working_sets: list[dict] = []
        self._config = ConfigStore()
        self.setObjectName("Sidebar")
        self.setMaximumWidth(220)
        self.setIconSize(QSize(18, 18))
        self.setHeaderHidden(True)
        self.setIndentation(12)
        self.setRootIsDecorated(False)
        self.setItemsExpandable(False)
        self.setUniformRowHeights(True)
        self.setSelectionBehavior(QTreeWidget.SelectRows)
        self.setContextMenuPolicy(Qt.CustomContextMenu)
        self.itemClicked.connect(self._on_item_clicked)
        self.customContextMenuRequested.connect(self._on_context_menu)
        self.refresh()

    def refresh(self) -> None:
        self.clear()
        self._place_items.clear()
        home = Path.home()
        media_root = Path("/run/media") / home.name
        gvfs_root = Path("/run/user") / str(os.getuid()) / "gvfs"
        show_places = self._config.get_bool("sidebar_show_places", True)
        show_devices = self._config.get_bool("sidebar_show_devices", True)
        show_trash = self._config.get_bool("sidebar_show_trash", True)
        show_network = self._config.get_bool("sidebar_show_network", True)
        bookmarks = self._config.get("bookmarks", [])

        places = [
            ("Home", home, "user-home"),
            ("Desktop", home / "Desktop", "user-desktop"),
            ("Documents", home / "Documents", "folder-documents"),
            ("Downloads", home / "Downloads", "folder-download"),
            ("Pictures", home / "Pictures", "folder-pictures"),
            ("Videos", home / "Videos", "folder-videos"),
            ("Music", home / "Music", "folder-music"),
            ("Root", Path("/"), "drive-harddisk"),
        ]
        if show_trash:
            places.append(("Trash", home / ".local/share/Trash/files", "user-trash"))

        devices: list[tuple[str, Path, str]] = []
        if show_devices and media_root.exists():
            for device in sorted(media_root.iterdir()):
                if device.is_dir():
                    devices.append((device.name, device, "drive-removable-media"))
        self._device_paths = {str(path) for _, path, _ in devices}
        network: list[tuple[str, Path, str]] = []
        if show_network and gvfs_root.exists():
            for entry in sorted(gvfs_root.iterdir()):
                if entry.is_dir():
                    label = entry.name.replace(" ", " ")
                    network.append((label, entry, "network-server"))

        if show_places:
            group = self._add_header("Places")
            self._add_items(group, places)
            if bookmarks:
                group = self._add_header("Bookmarks")
                self._add_bookmarks(group, bookmarks)
        if self._working_sets:
            group = self._add_header("Working Sets")
            self._add_working_sets(group, self._working_sets)
        if devices:
            group = self._add_header("Devices")
            self._add_items(group, devices)
        if network:
            group = self._add_header("Network")
            self._add_items(group, network)
        self.expandAll()

    def sync_selection(self, path: str) -> None:
        best_path = ""
        for candidate in self._place_items.keys():
            if path == candidate or path.startswith(candidate.rstrip("/") + "/"):
                if len(candidate) > len(best_path):
                    best_path = candidate
        if best_path:
            self.setCurrentItem(self._place_items[best_path])

    def _add_header(self, title: str) -> QTreeWidgetItem:
        item = QTreeWidgetItem([title])
        font = item.font(0)
        font.setBold(True)
        item.setFont(0, font)
        item.setForeground(0, QColor("#7f8c9a"))
        item.setFlags(Qt.ItemIsEnabled)
        item.setData(0, Qt.UserRole, "")
        item.setData(0, Qt.UserRole + 1, "header")
        self.addTopLevelItem(item)
        return item

    def _add_items(self, parent: QTreeWidgetItem, entries: list[tuple[str, Path, str]]) -> None:
        for label, path, icon_name in entries:
            if path.exists():
                item = QTreeWidgetItem([label])
                item.setData(0, Qt.UserRole, str(path))
                icon = themed_icon(icon_name, QStyle.SP_DirIcon)
                if not icon.isNull():
                    item.setIcon(0, icon)
                parent.addChild(item)
                self._place_items[str(path)] = item

    def _add_bookmarks(self, parent: QTreeWidgetItem, bookmarks: list[dict]) -> None:
        for entry in bookmarks:
            path = entry.get("path")
            label = entry.get("label") or path
            if not path:
                continue
            item = QTreeWidgetItem([label])
            item.setData(0, Qt.UserRole, str(path))
            icon = themed_icon(["folder-favorites", "bookmark-new"], QStyle.SP_DirLinkIcon)
            if not icon.isNull():
                item.setIcon(0, icon)
            parent.addChild(item)
            self._place_items[str(path)] = item

    def _add_working_sets(self, parent: QTreeWidgetItem, sets: list[dict]) -> None:
        for entry in sets:
            name = entry.get("name") or "Working Set"
            set_id = entry.get("id", "")
            item = QTreeWidgetItem([name])
            item.setData(0, Qt.UserRole, set_id)
            item.setData(0, Qt.UserRole + 1, "working_set")
            icon = themed_icon(["folder-saved-search", "system-search"], QStyle.SP_FileDialogContentsView)
            if not icon.isNull():
                item.setIcon(0, icon)
            parent.addChild(item)

    def _on_item_clicked(self, item: QTreeWidgetItem) -> None:
        path = item.data(0, Qt.UserRole)
        item_type = item.data(0, Qt.UserRole + 1)
        if item_type == "working_set" and path:
            self.workingSetActivated.emit(path)
            return
        if path:
            self.pathActivated.emit(path)

    def _on_context_menu(self, position) -> None:
        item = self.itemAt(position)
        if item is None:
            return
        path = item.data(0, Qt.UserRole)
        item_type = item.data(0, Qt.UserRole + 1)
        if item_type == "working_set":
            menu = QMenu(self)
            open_action = menu.addAction("Open")
            rename_action = menu.addAction("Rename")
            delete_action = menu.addAction("Delete")
            open_action.triggered.connect(lambda: self.workingSetActivated.emit(path))
            rename_action.triggered.connect(lambda: self.workingSetRenameRequested.emit(path))
            delete_action.triggered.connect(lambda: self.workingSetDeleteRequested.emit(path))
            menu.exec(self.viewport().mapToGlobal(position))
            return
        if not path:
            return
        menu = QMenu(self)
        open_action = menu.addAction("Open")
        open_window_action = menu.addAction("Open in New Window")
        is_device = path in self._device_paths
        mount_actions_enabled = self._config.get_bool("enable_mount_actions", True)
        if is_device and mount_actions_enabled:
            unmount_action = menu.addAction("Unmount")
        else:
            unmount_action = None
        edit_bookmarks_action = menu.addAction("Edit Bookmarks…")
        properties_action = menu.addAction("Properties")

        open_action.triggered.connect(lambda: self.pathActivated.emit(path))
        open_window_action.triggered.connect(lambda: self.openInNewWindow.emit(path))
        if unmount_action is not None:
            unmount_action.triggered.connect(lambda: self._unmount_device(path))
        edit_bookmarks_action.triggered.connect(self._edit_bookmarks)
        properties_action.triggered.connect(lambda: self.showProperties.emit(path))

        menu.exec(self.viewport().mapToGlobal(position))

    def set_working_sets(self, sets: list[dict]) -> None:
        self._working_sets = sets
        self.refresh()

    def _edit_bookmarks(self) -> None:
        from geyma.ui.bookmarks_dialog import BookmarksDialog

        dialog = BookmarksDialog(self._config.get("bookmarks", []), self)
        dialog.changed.connect(self._save_bookmarks)
        dialog.exec()

    def _save_bookmarks(self, bookmarks: list[dict]) -> None:
        self._config.set("bookmarks", bookmarks)
        self._config.save()
        self.refresh()

    def _mount_device(self, path: str) -> None:
        from geyma.ops.devices import mount_device

        mount_device(path)

    def _unmount_device(self, path: str) -> None:
        from geyma.ops.devices import unmount_device

        unmount_device(path)
