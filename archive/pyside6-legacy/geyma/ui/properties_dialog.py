from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import shutil
import stat
from typing import Callable

from PySide6.QtCore import QDateTime, QObject, QRunnable, QThreadPool, Signal, Qt
from PySide6.QtCore import QLocale, QProcess
from PySide6.QtCore import QMimeDatabase
from PySide6.QtGui import QGuiApplication
from PySide6.QtWidgets import (
    QCheckBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QTabWidget,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from geyma.ui.dialog_utils import apply_dialog_titlebar
from geyma.ui.error_dialog import show_error
try:
    import grp
    import pwd
except ImportError:  # pragma: no cover - platform-specific
    grp = None
    pwd = None


class _FolderSizeSignals(QObject):
    finished = Signal(int, int, int)
    canceled = Signal()


class _FolderSizeWorker(QRunnable):
    def __init__(self, root: Path, should_cancel: Callable[[], bool]) -> None:
        super().__init__()
        self._root = root
        self._should_cancel = should_cancel
        self.signals = _FolderSizeSignals()

    def run(self) -> None:
        total = 0
        file_count = 0
        folder_count = 0
        stack = [self._root]
        while stack:
            if self._should_cancel():
                self.signals.canceled.emit()
                return
            current = stack.pop()
            try:
                with os.scandir(current) as entries:
                    for entry in entries:
                        if self._should_cancel():
                            self.signals.canceled.emit()
                            return
                        try:
                            if entry.is_symlink():
                                continue
                            if entry.is_dir(follow_symlinks=False):
                                folder_count += 1
                                stack.append(Path(entry.path))
                            elif entry.is_file(follow_symlinks=False):
                                total += entry.stat(follow_symlinks=False).st_size
                                file_count += 1
                        except OSError:
                            continue
            except OSError:
                continue

        self.signals.finished.emit(total, file_count, folder_count)


@dataclass
class _PropertiesData:
    name: str
    path: str
    kind: str
    size_text: str
    contents_text: str
    modified: str
    created: str
    accessed: str
    permissions: str
    owner: str
    group: str


class PropertiesDialog(QDialog):
    def __init__(self, path: Path, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Properties")
        self._path = path
        self._cancel_size = False
        self._current_mode = 0
        self._perm_boxes: dict[str, QCheckBox] = {}

        self._size_label = QLabel("--")
        self._contents_label = QLabel("--")
        self._build_ui()
        self._load_data()

    def closeEvent(self, event) -> None:
        self._cancel_size = True
        super().closeEvent(event)

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        self._tabs = QTabWidget()
        self._permissions_enabled = True

        self._name_label = QLabel()
        self._path_label = QLabel()
        self._type_label = QLabel()
        self._modified_label = QLabel()
        self._created_label = QLabel()
        self._accessed_label = QLabel()
        self._permissions_label = QLabel()
        self._owner_label = QLabel()
        self._group_label = QLabel()

        general_widget = QWidget()
        general_layout = QVBoxLayout(general_widget)
        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignRight)
        form.addRow("Name:", self._name_label)
        form.addRow("Path:", self._path_label)
        form.addRow("Type:", self._type_label)
        form.addRow("Size:", self._size_label)
        form.addRow("Contents:", self._contents_label)
        form.addRow("Modified:", self._modified_label)
        form.addRow("Created:", self._created_label)
        form.addRow("Accessed:", self._accessed_label)
        form.addRow("Permissions:", self._permissions_label)
        form.addRow("Owner:", self._owner_label)
        form.addRow("Group:", self._group_label)

        button_row = QHBoxLayout()
        open_button = QPushButton("Open")
        show_button = QPushButton("Open Containing Folder")
        copy_button = QPushButton("Copy Path")
        button_row.addWidget(open_button)
        button_row.addWidget(show_button)
        button_row.addWidget(copy_button)
        button_row.addStretch(1)

        buttons = QDialogButtonBox(QDialogButtonBox.Close)
        buttons.rejected.connect(self.close)

        open_button.clicked.connect(self._open_current)
        show_button.clicked.connect(self._open_containing_folder)
        copy_button.clicked.connect(self._copy_path)

        general_layout.addLayout(form)
        general_layout.addLayout(button_row)
        general_layout.addStretch(1)

        permissions_widget = QWidget()
        permissions_layout = QVBoxLayout(permissions_widget)
        permissions_layout.addWidget(QLabel("Permissions"))
        self._permissions_editor = self._build_permissions_editor()
        permissions_layout.addLayout(self._permissions_editor)
        permissions_layout.addStretch(1)

        security_widget = QWidget()
        security_layout = QVBoxLayout(security_widget)
        security_layout.addWidget(QLabel("Security"))
        security_layout.addWidget(QLabel("No additional security details available."))
        security_layout.addStretch(1)

        self._tabs.addTab(general_widget, "General")
        self._tabs.addTab(permissions_widget, "Permissions")
        self._tabs.addTab(security_widget, "Security")

        layout.addWidget(self._tabs)
        layout.addWidget(buttons)
        apply_dialog_titlebar(self)

    def _load_data(self) -> None:
        try:
            info = self._path.stat()
        except OSError:
            data = _PropertiesData(
                name=self._path.name,
                path=str(self._path),
                kind="Folder" if self._path.is_dir() else "File",
                size_text="--",
                contents_text="--",
                modified="--",
                created="--",
                accessed="--",
                permissions="--",
                owner="--",
                group="--",
            )
            self._apply_data(data)
            return

        try:
            from geyma.utils.config import ConfigStore

            self._permissions_enabled = ConfigStore().get_bool("permissions_editor_enabled", True)
        except Exception:
            self._permissions_enabled = True

        self._current_mode = info.st_mode
        data = _PropertiesData(
            name=self._path.name,
            path=str(self._path),
            kind=self._detect_kind(),
            size_text=self._format_bytes(info.st_size) if self._path.is_file() else "Calculating...",
            contents_text="--" if self._path.is_file() else "Calculating...",
            modified=self._format_time(info.st_mtime),
            created=self._format_time(info.st_ctime),
            accessed=self._format_time(info.st_atime),
            permissions=self._format_permissions(info.st_mode),
            owner=self._lookup_owner(info.st_uid),
            group=self._lookup_group(info.st_gid),
        )
        self._apply_data(data)
        self._set_permissions_from_mode(info.st_mode)
        if not self._permissions_enabled:
            self._disable_permissions_editor()

        if self._path.is_dir():
            self._start_folder_size()

    def _apply_data(self, data: _PropertiesData) -> None:
        self._name_label.setText(data.name)
        self._path_label.setText(data.path)
        self._type_label.setText(data.kind)
        self._size_label.setText(data.size_text)
        self._contents_label.setText(data.contents_text)
        self._modified_label.setText(data.modified)
        self._created_label.setText(data.created)
        self._accessed_label.setText(data.accessed)
        self._permissions_label.setText(data.permissions)
        self._owner_label.setText(data.owner)
        self._group_label.setText(data.group)

    def _start_folder_size(self) -> None:
        worker = _FolderSizeWorker(self._path, lambda: self._cancel_size)
        worker.signals.finished.connect(self._on_folder_size)
        worker.signals.canceled.connect(self._on_folder_size_canceled)
        QThreadPool.globalInstance().start(worker)

    def _detect_kind(self) -> str:
        if self._path.is_dir():
            return "Folder"
        if self._path.is_file():
            db = QMimeDatabase()
            mime = db.mimeTypeForFile(str(self._path), QMimeDatabase.MatchContent)
            if mime.isValid():
                return f"File ({mime.comment()})"
        return "File"

    def _open_current(self) -> None:
        if not self._open_path(self._path):
            show_error(self, "Open", "Failed to open path.")

    def _open_containing_folder(self) -> None:
        target = self._path if self._path.is_dir() else self._path.parent
        if not self._open_path(target):
            show_error(self, "Open Containing Folder", "Failed to open folder.")

    def _copy_path(self) -> None:
        clipboard = QGuiApplication.clipboard()
        clipboard.setText(str(self._path))

    def _build_permissions_editor(self) -> QHBoxLayout:
        layout = QHBoxLayout()
        for label, prefix in (("Owner", "u"), ("Group", "g"), ("Others", "o")):
            column = QVBoxLayout()
            column.addWidget(QLabel(label))
            for perm_label, suffix in (("Read", "r"), ("Write", "w"), ("Execute", "x")):
                key = f"{prefix}{suffix}"
                box = QCheckBox(perm_label)
                self._perm_boxes[key] = box
                column.addWidget(box)
            layout.addLayout(column)
        apply_button = QPushButton("Apply Permissions")
        apply_button.clicked.connect(self._apply_permissions)
        self._permissions_apply_button = apply_button
        layout.addStretch(1)
        layout.addWidget(apply_button)
        return layout

    def _set_permissions_from_mode(self, mode: int) -> None:
        mapping = {
            "ur": stat.S_IRUSR,
            "uw": stat.S_IWUSR,
            "ux": stat.S_IXUSR,
            "gr": stat.S_IRGRP,
            "gw": stat.S_IWGRP,
            "gx": stat.S_IXGRP,
            "or": stat.S_IROTH,
            "ow": stat.S_IWOTH,
            "ox": stat.S_IXOTH,
        }
        for key, mask in mapping.items():
            box = self._perm_boxes.get(key)
            if box is not None:
                box.setChecked(bool(mode & mask))

    def _apply_permissions(self) -> None:
        if not self._perm_boxes:
            return
        if not self._permissions_enabled:
            show_error(self, "Permissions", "Permissions editor is disabled in settings.")
            return
        mode = stat.S_IMODE(self._current_mode)
        mapping = {
            "ur": stat.S_IRUSR,
            "uw": stat.S_IWUSR,
            "ux": stat.S_IXUSR,
            "gr": stat.S_IRGRP,
            "gw": stat.S_IWGRP,
            "gx": stat.S_IXGRP,
            "or": stat.S_IROTH,
            "ow": stat.S_IWOTH,
            "ox": stat.S_IXOTH,
        }
        for key, mask in mapping.items():
            box = self._perm_boxes.get(key)
            if box is None:
                continue
            if box.isChecked():
                mode |= mask
            else:
                mode &= ~mask
        try:
            os.chmod(self._path, mode)
            self._current_mode = mode
            self._permissions_label.setText(self._format_permissions(mode))
        except OSError as exc:
            show_error(self, "Permissions", str(exc))

    def _disable_permissions_editor(self) -> None:
        for box in self._perm_boxes.values():
            box.setEnabled(False)
        if hasattr(self, "_permissions_apply_button"):
            self._permissions_apply_button.setEnabled(False)

    @staticmethod
    def _open_path(path: Path) -> bool:
        try:
            from geyma.utils.config import ConfigStore

            preferred = ConfigStore().get_str("open_backend", "auto").lower()
        except Exception:
            preferred = "auto"
        candidates = PropertiesDialog._open_candidates(str(path), preferred)
        for command, args in candidates:
            if shutil.which(command) and QProcess.startDetached(command, args):
                return True
        return False

    @staticmethod
    def _open_candidates(path: str, preferred: str) -> list[tuple[str, list[str]]]:
        kde = [
            ("kioclient6", ["exec", path]),
            ("kioclient5", ["exec", path]),
            ("kde-open5", [path]),
        ]
        gio = [("gio", ["open", path])]
        xdg = [("xdg-open", [path])]
        if preferred == "kde":
            return kde + gio + xdg
        if preferred == "gio":
            return gio + kde + xdg
        if preferred == "xdg":
            return xdg + kde + gio
        return kde + gio + xdg

    def _on_folder_size(self, total: int, files: int, folders: int) -> None:
        self._size_label.setText(self._format_bytes(total))
        self._contents_label.setText(f"{files} files, {folders} folders")

    def _on_folder_size_canceled(self) -> None:
        self._size_label.setText("--")
        self._contents_label.setText("--")

    def _format_time(self, value: float) -> str:
        timestamp = QDateTime.fromSecsSinceEpoch(int(value))
        try:
            from geyma.utils.config import ConfigStore

            preferred = ConfigStore().get_str("date_format", "locale")
        except Exception:
            preferred = "locale"
        if preferred and preferred.lower() not in {"locale", "system"}:
            return timestamp.toString(preferred)
        return QLocale().toString(timestamp, QLocale.ShortFormat)

    def _format_bytes(self, value: int) -> str:
        units = ["B", "KB", "MB", "GB", "TB"]
        try:
            from geyma.utils.config import ConfigStore

            preferred = str(ConfigStore().get("size_units", "auto")).upper()
        except Exception:
            preferred = "AUTO"
        size = float(value)
        for unit in units:
            if preferred != "AUTO" and unit != preferred:
                size /= 1024
                continue
            if size < 1024 or unit == units[-1] or preferred != "AUTO":
                return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} {unit}"
            size /= 1024
        return f"{int(size)} B"

    @staticmethod
    def _format_permissions(mode: int) -> str:
        def triad(mask_r, mask_w, mask_x) -> str:
            return (
                ("r" if mode & mask_r else "-")
                + ("w" if mode & mask_w else "-")
                + ("x" if mode & mask_x else "-")
            )

        return "".join(
            [
                triad(stat.S_IRUSR, stat.S_IWUSR, stat.S_IXUSR),
                triad(stat.S_IRGRP, stat.S_IWGRP, stat.S_IXGRP),
                triad(stat.S_IROTH, stat.S_IWOTH, stat.S_IXOTH),
            ]
        )

    @staticmethod
    def _lookup_owner(uid: int) -> str:
        if pwd is None:
            return str(uid)
        try:
            return pwd.getpwuid(uid).pw_name
        except KeyError:
            return str(uid)

    @staticmethod
    def _lookup_group(gid: int) -> str:
        if grp is None:
            return str(gid)
        try:
            return grp.getgrgid(gid).gr_name
        except KeyError:
            return str(gid)
