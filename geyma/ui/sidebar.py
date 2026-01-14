from __future__ import annotations

from pathlib import Path
import os

from PySide6.QtCore import Qt, Signal, QSize
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QListWidget, QListWidgetItem, QMenu

from geyma.utils.config import ConfigStore


class PlacesSidebar(QListWidget):
    pathActivated = Signal(str)
    openInNewWindow = Signal(str)
    showProperties = Signal(str)
    workingSetActivated = Signal(str)
    workingSetRenameRequested = Signal(str)
    workingSetDeleteRequested = Signal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._place_items: dict[str, QListWidgetItem] = {}
        self._device_paths: set[str] = set()
        self._working_sets: list[dict] = []
        self._config = ConfigStore()
        self.setObjectName("Sidebar")
        self.setMaximumWidth(220)
        self.setIconSize(QSize(18, 18))
        self.setSpacing(2)
        self.setSelectionBehavior(QListWidget.SelectRows)
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
            self._add_header("Places")
            self._add_items(places)
            if bookmarks:
                self._add_header("Bookmarks")
                self._add_bookmarks(bookmarks)
        if self._working_sets:
            self._add_header("Working Sets")
            self._add_working_sets(self._working_sets)
        if devices:
            self._add_header("Devices")
            self._add_items(devices)
        if network:
            self._add_header("Network")
            self._add_items(network)

    def sync_selection(self, path: str) -> None:
        best_path = ""
        for candidate in self._place_items.keys():
            if path == candidate or path.startswith(candidate.rstrip("/") + "/"):
                if len(candidate) > len(best_path):
                    best_path = candidate
        if best_path:
            self.setCurrentItem(self._place_items[best_path])

    def _add_header(self, title: str) -> None:
        item = QListWidgetItem(title)
        font = item.font()
        font.setBold(True)
        item.setFont(font)
        item.setFlags(Qt.ItemIsEnabled)
        item.setData(Qt.UserRole, "")
        self.addItem(item)

    def _add_items(self, entries: list[tuple[str, Path, str]]) -> None:
        for label, path, icon_name in entries:
            if path.exists():
                item = QListWidgetItem(label)
                item.setData(Qt.UserRole, str(path))
                icon = QIcon.fromTheme(icon_name)
                if not icon.isNull():
                    item.setIcon(icon)
                self.addItem(item)
                self._place_items[str(path)] = item

    def _add_bookmarks(self, bookmarks: list[dict]) -> None:
        for entry in bookmarks:
            path = entry.get("path")
            label = entry.get("label") or path
            if not path:
                continue
            item = QListWidgetItem(label)
            item.setData(Qt.UserRole, str(path))
            icon = QIcon.fromTheme("folder-favorites")
            if not icon.isNull():
                item.setIcon(icon)
            self.addItem(item)
            self._place_items[str(path)] = item

    def _add_working_sets(self, sets: list[dict]) -> None:
        for entry in sets:
            name = entry.get("name") or "Working Set"
            set_id = entry.get("id", "")
            item = QListWidgetItem(name)
            item.setData(Qt.UserRole, set_id)
            item.setData(Qt.UserRole + 1, "working_set")
            icon = QIcon.fromTheme("folder-saved-search")
            if not icon.isNull():
                item.setIcon(icon)
            self.addItem(item)

    def _on_item_clicked(self, item: QListWidgetItem) -> None:
        path = item.data(Qt.UserRole)
        item_type = item.data(Qt.UserRole + 1)
        if item_type == "working_set" and path:
            self.workingSetActivated.emit(path)
            return
        if path:
            self.pathActivated.emit(path)

    def _on_context_menu(self, position) -> None:
        item = self.itemAt(position)
        if item is None:
            return
        path = item.data(Qt.UserRole)
        item_type = item.data(Qt.UserRole + 1)
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
        mount_action = menu.addAction("Mount")
        unmount_action = menu.addAction("Unmount")
        edit_bookmarks_action = menu.addAction("Edit Bookmarks…")
        properties_action = menu.addAction("Properties")

        open_action.triggered.connect(lambda: self.pathActivated.emit(path))
        open_window_action.triggered.connect(lambda: self.openInNewWindow.emit(path))
        mount_action.triggered.connect(lambda: self._mount_device(path))
        unmount_action.triggered.connect(lambda: self._unmount_device(path))
        edit_bookmarks_action.triggered.connect(self._edit_bookmarks)
        properties_action.triggered.connect(lambda: self.showProperties.emit(path))

        is_device = path in self._device_paths
        mount_action.setEnabled(is_device)
        unmount_action.setEnabled(is_device)

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
