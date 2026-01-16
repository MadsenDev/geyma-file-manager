from __future__ import annotations

from pathlib import Path
import platform
from shutil import which

from PySide6.QtCore import QObject, QProcess, QRunnable, Qt, QTimer, Signal, QThreadPool
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QGridLayout,
    QHBoxLayout,
    QListWidget,
    QListWidgetItem,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
    QFrame,
)

from geyma.ai.connection_test import test_connection
import logging

from geyma.ai.keystore import KeyStoreError, get_api_key_info, set_api_key
from geyma.ai.provider_registry import available_providers
from geyma.ui.ai_disclosure_dialog import AIDisclosureDialog
from geyma.ui.bookmarks_dialog import BookmarksDialog
from geyma.ui.dialog_utils import apply_dialog_titlebar
from geyma.utils.config import ConfigStore


class _SettingsRow(QWidget):
    def __init__(
        self,
        title: str,
        description: str,
        control: QWidget,
        *,
        keywords: str = "",
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self._keywords = (keywords or "").strip()
        self._title = (title or "").strip()
        self._description = (description or "").strip()

        if not self._title and not self._description:
            self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
            layout = QHBoxLayout(self)
            layout.setContentsMargins(10, 8, 10, 8)
            layout.setSpacing(10)
            control.setMinimumWidth(0)
            control.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
            if isinstance(control, QLabel):
                control.setAlignment(Qt.AlignLeft | Qt.AlignTop)
            layout.addWidget(control, 1, Qt.AlignLeft | Qt.AlignTop)
            return

        left = QWidget()
        left.setMinimumWidth(0)
        left_layout = QVBoxLayout(left)
        left_layout.setContentsMargins(0, 0, 0, 0)
        left_layout.setSpacing(2)

        title_label = QLabel(self._title)
        title_font = title_label.font()
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setVisible(bool(self._title))
        title_label.setMinimumWidth(0)

        desc_label = QLabel(self._description)
        desc_label.setWordWrap(True)
        desc_label.setVisible(bool(self._description))
        desc_label.setMinimumWidth(0)
        desc_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)

        left_layout.addWidget(title_label)
        left_layout.addWidget(desc_label)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 8, 10, 8)
        layout.setSpacing(10)
        layout.addWidget(left, 1)
        control.setMinimumWidth(0)
        layout.addWidget(control, 0, Qt.AlignRight | Qt.AlignVCenter)

    def matches(self, query: str) -> bool:
        q = (query or "").strip().lower()
        if not q:
            return True
        haystack = " ".join([self._title, self._description, self._keywords]).lower()
        return q in haystack


class _SettingsCard(QFrame):
    def __init__(self, title: str, description: str = "", parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setFrameShape(QFrame.StyledPanel)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)

        header = QLabel(title)
        font = header.font()
        font.setBold(True)
        header.setFont(font)
        layout.addWidget(header)

        if description:
            desc = QLabel(description)
            desc.setWordWrap(True)
            layout.addWidget(desc)

        self._rows_layout = QVBoxLayout()
        self._rows_layout.setContentsMargins(0, 0, 0, 0)
        self._rows_layout.setSpacing(0)
        layout.addLayout(self._rows_layout)

    def add_row(
        self,
        title: str,
        description: str,
        control: QWidget,
        *,
        keywords: str = "",
    ) -> _SettingsRow:
        if not title and isinstance(control, QCheckBox):
            title = control.text().strip()
            if title:
                control.setText("")
        row = _SettingsRow(title, description, control, keywords=keywords, parent=self)
        self._rows_layout.addWidget(row)
        return row


class _KeyStoreSignals(QObject):
    finished = Signal(bool, str)


class _KeyStoreWorker(QRunnable):
    def __init__(self, provider: str, key: str, mode: str) -> None:
        super().__init__()
        self._provider = provider
        self._key = key
        self._mode = mode
        self.signals = _KeyStoreSignals()

    def run(self) -> None:
        if self._mode == "save":
            try:
                set_api_key(self._provider, self._key)
            except KeyStoreError as exc:
                self.signals.finished.emit(False, str(exc))
                return
            self.signals.finished.emit(True, "Saved.")
            return
        if self._mode == "test":
            ok, message = test_connection(self._provider)
            self.signals.finished.emit(ok, message)
            return
        self.signals.finished.emit(False, "Unknown operation.")


class _KeyInfoSignals(QObject):
    finished = Signal(str, str, str, str)


class _KeyInfoWorker(QRunnable):
    def __init__(self, provider: str) -> None:
        super().__init__()
        self._provider = provider
        self.signals = _KeyInfoSignals()

    def run(self) -> None:
        key, source, error = get_api_key_info(self._provider)
        self.signals.finished.emit(self._provider, key or "", source, error)


class SettingsDialog(QDialog):
    settingsChanged = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Settings")
        self._config = ConfigStore()
        self._logger = logging.getLogger(__name__)
        self._dirty = False
        self._search_rows: dict[str, list[_SettingsRow]] = {}
        self._search_cards: dict[str, list[tuple[QFrame, list[_SettingsRow]]]] = {}
        self._page_builders: dict[str, callable] = {}
        self._page_built: set[str] = set()
        self._page_containers: dict[str, QWidget] = {}
        # Pages are built lazily on navigation to avoid freezing the UI.

        self._nav = QListWidget()
        self._nav.setObjectName("SettingsNav")
        self._nav.setFixedWidth(220)
        self._nav.setSpacing(2)
        self._nav.setSelectionMode(QListWidget.SingleSelection)
        self._nav.setSelectionBehavior(QListWidget.SelectRows)
        self._nav.setFocusPolicy(Qt.NoFocus)

        self._stack = QStackedWidget()

        self._search = QLineEdit()
        self._search.setPlaceholderText("Search settings…")
        self._search.setClearButtonEnabled(True)
        self._search.textChanged.connect(self._apply_search_filter)

        self._status = QLabel("")
        self._status.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)

        top_row = QHBoxLayout()
        top_row.addWidget(self._search, 1)
        top_row.addWidget(self._status)

        right = QVBoxLayout()
        right.addLayout(top_row)
        right.addWidget(self._stack, 1)

        body = QHBoxLayout()
        body.addWidget(self._nav)
        body.addLayout(right, 1)

        buttons = QDialogButtonBox(QDialogButtonBox.Apply | QDialogButtonBox.Close)
        self._apply_button = buttons.button(QDialogButtonBox.Apply)
        if self._apply_button is not None:
            self._apply_button.setEnabled(False)
        buttons.rejected.connect(self.reject)
        if self._apply_button is not None:
            self._apply_button.clicked.connect(self._apply)

        layout = QVBoxLayout(self)
        layout.addLayout(body, 1)
        layout.addWidget(buttons)

        self._init_pages()
        self._nav.currentRowChanged.connect(self._on_nav_changed)
        if self._nav.count():
            self._nav.setCurrentRow(0)
            first_key = self._nav.item(0).data(Qt.UserRole)
            self._ensure_page_built(str(first_key))

        apply_dialog_titlebar(self)

    def reject(self) -> None:
        if self._dirty:
            reply = QMessageBox.question(
                self,
                "Discard Changes",
                "Close settings without applying changes?",
                QMessageBox.Yes | QMessageBox.No,
            )
            if reply != QMessageBox.Yes:
                return
        super().reject()

    def _init_pages(self) -> None:
        pages: list[tuple[str, str, callable]] = [
            ("general", "General", self._build_general_page),
            ("display", "Display", self._build_display_page),
            ("sidebar", "Sidebar", self._build_sidebar_page),
            ("navigation", "Navigation", self._build_navigation_page),
            ("file_ops", "File Operations", self._build_file_ops_page),
            ("search", "Search", self._build_search_page),
            ("privacy", "Privacy & Security", self._build_privacy_page),
            ("performance", "Performance", self._build_performance_page),
            ("integrations", "Integrations", self._build_integrations_page),
            ("ai", "AI", self._build_ai_page),
            ("advanced", "Advanced", self._build_advanced_page),
        ]
        for key, title, builder in pages:
            self._add_page_placeholder(key, title, builder)

    def _add_page_placeholder(self, key: str, title: str, builder: callable) -> None:
        item = QListWidgetItem(title)
        item.setData(Qt.UserRole, key)
        self._nav.addItem(item)
        placeholder = QWidget()
        placeholder.setObjectName(f"SettingsPage_{key}")
        placeholder_layout = QVBoxLayout(placeholder)
        placeholder_layout.setContentsMargins(0, 0, 0, 0)
        placeholder_layout.addWidget(QLabel("Loading…"))
        self._stack.addWidget(placeholder)
        self._page_builders[key] = builder
        self._page_containers[key] = placeholder

    def _on_nav_changed(self, row: int) -> None:
        self._stack.setCurrentIndex(row)
        item = self._nav.item(row)
        if item is None:
            return
        key = str(item.data(Qt.UserRole))
        self._ensure_page_built(key)

    def _ensure_page_built(self, key: str) -> None:
        if key in self._page_built:
            return
        builder = self._page_builders.get(key)
        container = self._page_containers.get(key)
        if builder is None or container is None:
            return
        page = builder()
        layout = container.layout()
        if layout is None:
            layout = QVBoxLayout(container)
            layout.setContentsMargins(0, 0, 0, 0)
        while layout.count():
            item = layout.takeAt(0)
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()
        layout.addWidget(page)
        self._page_built.add(key)
        if self._search.text().strip():
            self._apply_search_filter(self._search.text())

    def _wrap_page(self, key: str, title: str, cards: list[tuple[QFrame, list[_SettingsRow]]]) -> QWidget:
        self._search_cards[key] = cards
        self._search_rows[key] = [row for _card, rows in cards for row in rows]

        content = QWidget()
        layout = QVBoxLayout(content)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(10)

        header = QLabel(title)
        font = header.font()
        font.setPointSize(max(font.pointSize() + 2, 12))
        font.setBold(True)
        header.setFont(font)
        layout.addWidget(header)

        for card, _rows in cards:
            layout.addWidget(card)
        layout.addStretch(1)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setWidget(content)
        return scroll

    def _set_dirty(self, dirty: bool) -> None:
        self._dirty = dirty
        if self._apply_button is not None:
            self._apply_button.setEnabled(dirty)
        if not dirty:
            self._status.setText("")

    def _touch(self) -> None:
        if not self._dirty:
            self._set_dirty(True)
        self._status.setText("")

    def _track(self, widget: QWidget) -> None:
        if isinstance(widget, QCheckBox):
            widget.toggled.connect(lambda *_: self._touch())
            return
        if isinstance(widget, QLineEdit):
            widget.textChanged.connect(lambda *_: self._touch())
            return
        if isinstance(widget, QComboBox):
            widget.currentIndexChanged.connect(lambda *_: self._touch())
            return
        if isinstance(widget, QSpinBox):
            widget.valueChanged.connect(lambda *_: self._touch())
            return

    def _apply_search_filter(self, text: str) -> None:
        query = text.strip().lower()
        for idx in range(self._nav.count()):
            item = self._nav.item(idx)
            key = item.data(Qt.UserRole)
            if key not in self._page_built:
                item.setHidden(False)
                continue
            cards = self._search_cards.get(key, [])
            any_match = False
            for card, rows in cards:
                card_match = False
                for row in rows:
                    visible = not query or row.matches(query)
                    row.setVisible(visible)
                    if visible:
                        card_match = True
                        any_match = True
                card.setVisible(card_match or not query)
            item.setHidden(bool(query) and not any_match)

    def _build_general_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._startup_mode = QComboBox()
        self._startup_mode.addItems(["last", "home", "custom"])
        self._startup_mode.setCurrentText(self._config.get_str("startup_mode", "last"))
        self._track(self._startup_mode)

        self._startup_path = QLineEdit(self._config.get_str("startup_path", ""))
        self._track(self._startup_path)
        browse = QPushButton("Browse")
        browse.clicked.connect(self._browse_startup_path)
        startup_path_control = QWidget()
        startup_path_layout = QHBoxLayout(startup_path_control)
        startup_path_layout.setContentsMargins(0, 0, 0, 0)
        startup_path_layout.setSpacing(6)
        startup_path_layout.addWidget(self._startup_path, 1)
        startup_path_layout.addWidget(browse)

        self._restore_windows = QCheckBox("Restore tabs/windows on launch")
        self._restore_windows.setChecked(self._config.get_bool("restore_windows", False))
        self._track(self._restore_windows)

        self._remember_window = QCheckBox("Remember window size/position")
        self._remember_window.setChecked(self._config.get_bool("remember_window", True))
        self._track(self._remember_window)

        card = _SettingsCard("Startup")
        rows = [
            card.add_row("Startup folder", "Which folder opens when the app starts.", self._startup_mode),
            card.add_row("Custom path", "Used when startup folder is set to custom.", startup_path_control),
            card.add_row("", "", self._restore_windows, keywords="restore tabs windows launch"),
            card.add_row("", "", self._remember_window, keywords="remember window geometry"),
        ]
        cards.append((card, rows))
        return self._wrap_page("general", "General", cards)

    def _build_display_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._show_hidden = QCheckBox("Show hidden files by default")
        self._show_hidden.setChecked(self._config.get_bool("show_hidden", False))
        self._track(self._show_hidden)

        self._list_icon_size = QSpinBox()
        self._list_icon_size.setRange(12, 64)
        self._list_icon_size.setValue(int(self._config.get("list_icon_size", 20)))
        self._track(self._list_icon_size)

        self._grid_icon_size = QSpinBox()
        self._grid_icon_size.setRange(32, 256)
        self._grid_icon_size.setValue(int(self._config.get("grid_icon_size", 64)))
        self._track(self._grid_icon_size)

        self._row_padding = QSpinBox()
        self._row_padding.setRange(0, 20)
        self._row_padding.setValue(int(self._config.get("row_padding", 6)))
        self._track(self._row_padding)

        self._grid_spacing = QSpinBox()
        self._grid_spacing.setRange(0, 40)
        self._grid_spacing.setValue(int(self._config.get("grid_spacing", 12)))
        self._track(self._grid_spacing)

        self._thumbnail_mode = QComboBox()
        self._thumbnail_mode.addItems(["off", "minimal", "full"])
        self._thumbnail_mode.setCurrentText(self._config.get_str("thumbnail_mode", "minimal"))
        self._track(self._thumbnail_mode)

        self._thumbnail_max_bytes = QSpinBox()
        self._thumbnail_max_bytes.setRange(1, 1024)
        self._thumbnail_max_bytes.setValue(
            int(int(self._config.get("thumbnail_max_bytes", 10 * 1024 * 1024)) / (1024 * 1024))
        )
        self._thumbnail_max_bytes.setSuffix(" MB")
        self._track(self._thumbnail_max_bytes)

        self._size_units = QComboBox()
        self._size_units.addItems(["auto", "B", "KB", "MB", "GB", "TB"])
        self._size_units.setCurrentText(self._config.get_str("size_units", "auto"))
        self._track(self._size_units)

        self._date_format = QLineEdit(self._config.get_str("date_format", "locale"))
        self._track(self._date_format)

        self._folders_first_mode = QComboBox()
        self._folders_first_mode.addItem("Auto (like Windows Explorer)", "auto")
        self._folders_first_mode.addItem("Always keep folders first", "always")
        self._folders_first_mode.addItem("Mix folders and files", "never")
        current_mode = self._config.get_str("sort_folders_first", "auto")
        index = self._folders_first_mode.findData(current_mode)
        if index >= 0:
            self._folders_first_mode.setCurrentIndex(index)
        self._track(self._folders_first_mode)

        self._show_breadcrumbs = QCheckBox("Show breadcrumbs")
        self._show_breadcrumbs.setChecked(self._config.get_bool("show_breadcrumbs", True))
        self._track(self._show_breadcrumbs)

        self._status_details = QCheckBox("Show status bar selection details")
        self._status_details.setChecked(self._config.get_bool("status_bar_details", True))
        self._track(self._status_details)

        card = _SettingsCard("Display")
        rows = [
            card.add_row("", "", self._show_hidden),
            card.add_row("List icon size", "Icon size in list view.", self._list_icon_size),
            card.add_row("Grid icon size", "Icon size in grid view.", self._grid_icon_size),
            card.add_row("Row padding", "Vertical padding in list rows.", self._row_padding),
            card.add_row("Grid spacing", "Spacing between items in grid view.", self._grid_spacing),
            card.add_row("Thumbnail mode", "Controls thumbnail generation.", self._thumbnail_mode),
            card.add_row("Max thumbnail size", "Skip thumbnails larger than this.", self._thumbnail_max_bytes),
            card.add_row("File size units", "Preferred size unit display.", self._size_units),
            card.add_row("Date format", "Use 'locale' or an ISO-like format.", self._date_format),
            card.add_row("Folder sorting", "How folders sort relative to files.", self._folders_first_mode),
            card.add_row("", "", self._show_breadcrumbs),
            card.add_row("", "", self._status_details),
        ]
        cards.append((card, rows))
        return self._wrap_page("display", "Display", cards)

    def _build_sidebar_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._show_places = QCheckBox("Show Places section")
        self._show_places.setChecked(self._config.get_bool("sidebar_show_places", True))
        self._track(self._show_places)

        self._show_devices = QCheckBox("Show Devices section")
        self._show_devices.setChecked(self._config.get_bool("sidebar_show_devices", True))
        self._track(self._show_devices)

        self._show_trash = QCheckBox("Show Trash")
        self._show_trash.setChecked(self._config.get_bool("sidebar_show_trash", True))
        self._track(self._show_trash)

        self._show_network = QCheckBox("Show mounted network locations")
        self._show_network.setChecked(self._config.get_bool("sidebar_show_network", True))
        self._track(self._show_network)

        edit_bookmarks = QPushButton("Edit Bookmarks…")
        edit_bookmarks.clicked.connect(self._edit_bookmarks)

        card = _SettingsCard("Sidebar")
        rows = [
            card.add_row("", "", self._show_places),
            card.add_row("", "", self._show_devices),
            card.add_row("", "", self._show_trash),
            card.add_row("", "", self._show_network),
            card.add_row("Bookmarks", "Manage quick-access bookmark entries.", edit_bookmarks),
        ]
        cards.append((card, rows))
        return self._wrap_page("sidebar", "Sidebar", cards)

    def _build_navigation_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._default_view = QComboBox()
        self._default_view.addItems(["list", "icon"])
        self._default_view.setCurrentText(self._config.get_str("view_mode", "list"))
        self._track(self._default_view)

        self._sort_column = QComboBox()
        self._sort_column.addItems(["Name", "Size", "Type", "Modified"])
        self._sort_column.setCurrentIndex(int(self._config.get("sort_column", 0)))
        self._track(self._sort_column)

        self._sort_order = QComboBox()
        self._sort_order.addItems(["asc", "desc"])
        self._sort_order.setCurrentText(self._config.get_str("sort_order", "asc"))
        self._track(self._sort_order)

        self._single_click = QCheckBox("Single-click to open")
        self._single_click.setChecked(self._config.get_bool("single_click_open", False))
        self._track(self._single_click)

        self._open_folders_new_window = QCheckBox("Open folders in a new window")
        self._open_folders_new_window.setChecked(self._config.get_bool("open_folders_new_window", False))
        self._track(self._open_folders_new_window)

        self._open_default_app = QCheckBox("Open files in default app")
        self._open_default_app.setChecked(self._config.get_bool("open_default_app", True))
        self._track(self._open_default_app)

        self._open_with_last = QCheckBox("Enable open with last-used app")
        self._open_with_last.setChecked(self._config.get_bool("enable_open_with_last", True))
        self._track(self._open_with_last)

        self._middle_click_tab = QCheckBox("Middle-click opens new tab (not implemented)")
        self._middle_click_tab.setChecked(self._config.get_bool("middle_click_tab", False))
        self._middle_click_tab.setEnabled(False)

        card = _SettingsCard("Navigation")
        rows = [
            card.add_row("Default view", "List or grid view on startup.", self._default_view),
            card.add_row("Default sort column", "Initial sort column for list view.", self._sort_column),
            card.add_row("Default sort order", "Initial sort direction.", self._sort_order),
            card.add_row("", "", self._single_click),
            card.add_row("", "", self._open_folders_new_window),
            card.add_row("", "", self._open_default_app),
            card.add_row("", "", self._open_with_last),
            card.add_row("", "", self._middle_click_tab),
        ]
        cards.append((card, rows))
        return self._wrap_page("navigation", "Navigation", cards)

    def _build_file_ops_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._conflict_default = QComboBox()
        self._conflict_default.addItems(["ask", "replace", "skip", "rename"])
        self._conflict_default.setCurrentText(self._config.get_str("conflict_default", "ask"))
        self._track(self._conflict_default)

        self._preserve_metadata = QCheckBox("Preserve timestamps and permissions")
        self._preserve_metadata.setChecked(self._config.get_bool("preserve_metadata", True))
        self._track(self._preserve_metadata)

        self._delete_behavior = QComboBox()
        self._delete_behavior.addItems(["trash", "delete"])
        self._delete_behavior.setCurrentText(self._config.get_str("delete_behavior", "trash"))
        self._track(self._delete_behavior)

        self._secure_delete_warning = QCheckBox("Warn that secure delete is not supported")
        self._secure_delete_warning.setChecked(self._config.get_bool("secure_delete_warning", True))
        self._track(self._secure_delete_warning)

        self._undo_redo = QCheckBox("Enable undo/redo (v2)")
        self._undo_redo.setEnabled(False)

        self._background_ops = QCheckBox("Enable background operations queue")
        self._background_ops.setEnabled(False)

        card = _SettingsCard("File Operations")
        rows = [
            card.add_row("Conflict default", "What happens when a destination exists.", self._conflict_default),
            card.add_row("", "", self._preserve_metadata),
            card.add_row("Delete behavior", "Move to trash or permanently delete.", self._delete_behavior),
            card.add_row("", "", self._secure_delete_warning),
            card.add_row("", "", self._undo_redo),
            card.add_row("", "", self._background_ops),
        ]
        cards.append((card, rows))
        return self._wrap_page("file_ops", "File Operations", cards)

    def _build_search_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._search_scope = QComboBox()
        self._search_scope.addItems(["current", "recursive"])
        self._search_scope.setCurrentText(self._config.get_str("search_scope", "current"))
        self._track(self._search_scope)

        self._search_include_hidden = QCheckBox("Include hidden files by default")
        self._search_include_hidden.setChecked(self._config.get_bool("search_include_hidden", False))
        self._track(self._search_include_hidden)

        self._search_case_sensitive = QCheckBox("Case sensitive search")
        self._search_case_sensitive.setChecked(self._config.get_bool("search_case_sensitive", False))
        self._track(self._search_case_sensitive)

        self._content_search = QCheckBox("Enable content search (ripgrep)")
        self._content_search.setEnabled(False)

        card = _SettingsCard("Search")
        rows = [
            card.add_row("Default search scope", "Current folder or recursive.", self._search_scope),
            card.add_row("", "", self._search_include_hidden),
            card.add_row("", "", self._search_case_sensitive),
            card.add_row("", "", self._content_search),
        ]
        cards.append((card, rows))
        return self._wrap_page("search", "Search", cards)

    def _build_privacy_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._track_recent = QCheckBox("Track recent paths")
        self._track_recent.setChecked(self._config.get_bool("track_recent", False))
        self._track(self._track_recent)

        self._clear_history = QCheckBox("Clear history on exit")
        self._clear_history.setChecked(self._config.get_bool("clear_history_on_exit", False))
        self._track(self._clear_history)

        self._permissions_editor = QCheckBox("Enable permissions editor")
        self._permissions_editor.setChecked(self._config.get_bool("permissions_editor_enabled", True))
        self._track(self._permissions_editor)

        self._warn_exec = QCheckBox("Warn when opening executables")
        self._warn_exec.setChecked(self._config.get_bool("warn_executables", True))
        self._track(self._warn_exec)

        card = _SettingsCard("Privacy & Security")
        rows = [
            card.add_row("", "", self._track_recent),
            card.add_row("", "", self._clear_history),
            card.add_row("", "", self._permissions_editor),
            card.add_row("", "", self._warn_exec),
        ]
        cards.append((card, rows))
        return self._wrap_page("privacy", "Privacy & Security", cards)

    def _build_performance_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._thumbnail_cache_size = QSpinBox()
        self._thumbnail_cache_size.setRange(16, 2048)
        self._thumbnail_cache_size.setValue(int(self._config.get("thumbnail_cache_size", 256)))
        self._track(self._thumbnail_cache_size)

        self._thumbnail_max_bytes_perf = QSpinBox()
        self._thumbnail_max_bytes_perf.setRange(1, 1024)
        self._thumbnail_max_bytes_perf.setValue(
            int(int(self._config.get("thumbnail_max_bytes", 10 * 1024 * 1024)) / (1024 * 1024))
        )
        self._thumbnail_max_bytes_perf.setSuffix(" MB")
        self._track(self._thumbnail_max_bytes_perf)

        self._large_folder_threshold = QSpinBox()
        self._large_folder_threshold.setRange(0, 200000)
        self._large_folder_threshold.setValue(int(self._config.get("large_folder_threshold", 50000)))
        self._track(self._large_folder_threshold)

        card = _SettingsCard("Performance")
        rows = [
            card.add_row("Thumbnail cache size", "Approximate in-memory cache target (MB).", self._thumbnail_cache_size),
            card.add_row("Max thumbnail size", "Skip thumbnails larger than this.", self._thumbnail_max_bytes_perf),
            card.add_row(
                "Large folder warning threshold",
                "Show a warning when opening folders with many items (0 disables).",
                self._large_folder_threshold,
            ),
        ]
        cards.append((card, rows))
        return self._wrap_page("performance", "Performance", cards)

    def _build_integrations_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._open_backend = QComboBox()
        self._open_backend.addItems(["auto", "kde", "gio", "xdg"])
        self._open_backend.setCurrentText(self._config.get_str("open_backend", "auto"))
        self._track(self._open_backend)

        self._trash_write_info = QCheckBox("Write .trashinfo metadata")
        self._trash_write_info.setChecked(self._config.get_bool("trash_write_info", True))
        self._track(self._trash_write_info)

        self._mount_unmount = QCheckBox("Enable mount/unmount actions")
        self._mount_unmount.setChecked(self._config.get_bool("enable_mount_actions", True))
        self._track(self._mount_unmount)

        card = _SettingsCard("Integrations")
        rows = [
            card.add_row("Open backend", "Which system tool handles opening files.", self._open_backend),
            card.add_row("", "", self._trash_write_info),
            card.add_row("", "", self._mount_unmount),
        ]
        cards.append((card, rows))
        return self._wrap_page("integrations", "Integrations", cards)

    def _build_ai_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._ai_enabled = QCheckBox("Enable AI features (BYOK only)")
        self._ai_enabled.setChecked(self._config.get_bool("ai_enabled", False))
        self._track(self._ai_enabled)

        self._ai_provider = QComboBox()
        self._ai_provider.addItems(sorted(available_providers().keys()))
        self._ai_provider.setCurrentText(self._config.get_str("ai_provider", "none"))
        self._track(self._ai_provider)

        self._ai_key = QLineEdit()
        self._ai_key.setEchoMode(QLineEdit.Password)
        self._ai_key.setPlaceholderText("API key")

        self._ai_status = QLabel("")
        self._ai_status.setWordWrap(True)
        self._ai_key_info = QLabel("")
        self._ai_key_info.setWordWrap(True)

        self._ai_allow_plaintext = QCheckBox("Allow insecure key storage in config (not recommended)")
        self._ai_allow_plaintext.setChecked(self._config.get_bool("ai_allow_plaintext_key", False))
        self._track(self._ai_allow_plaintext)

        self._ai_keyring_note = QLabel("Recommended: install keyring for secure storage.")
        self._ai_keyring_note.setWordWrap(True)

        save_key = QPushButton("Save Key")
        test_key = QPushButton("Test Connection")
        install_keyring = QPushButton("Install Keyring")
        save_key.clicked.connect(self._save_ai_key)
        test_key.clicked.connect(self._test_ai_connection)
        install_keyring.clicked.connect(self._install_keyring)
        self._ai_save_button = save_key
        self._ai_test_button = test_key
        self._ai_install_button = install_keyring

        helper = QLabel(
            "AI is optional. Keys are stored in your system keyring when available; otherwise you can opt into "
            "plaintext storage (not recommended)."
        )
        helper.setWordWrap(True)

        key_box = QWidget()
        key_box.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        grid = QGridLayout(key_box)
        grid.setContentsMargins(0, 0, 0, 0)
        grid.setHorizontalSpacing(8)
        grid.setVerticalSpacing(6)
        grid.addWidget(self._ai_key, 0, 0, 1, 3)
        grid.addWidget(save_key, 1, 0)
        grid.addWidget(test_key, 1, 1)
        grid.addWidget(install_keyring, 1, 2)
        grid.setColumnStretch(0, 0)
        grid.setColumnStretch(1, 0)
        grid.setColumnStretch(2, 0)

        card = _SettingsCard("AI")
        rows = [
            card.add_row("", "", helper, keywords="byok key storage privacy"),
            card.add_row("", "", self._ai_enabled),
            card.add_row("Provider", "Choose the AI provider.", self._ai_provider),
        ]
        cards.append((card, rows))

        card2 = _SettingsCard("API Key")
        rows2 = [
            card2.add_row(
                "API key",
                "Save stores the key for the selected provider. Provider and key-storage settings require Apply.",
                key_box,
                keywords="keyring api key save test connection",
            ),
            card2.add_row("Stored key", "Where the key is currently stored.", self._ai_key_info),
            card2.add_row("Status", "", self._ai_status),
        ]
        cards.append((card2, rows2))

        card3 = _SettingsCard("Key Storage")
        rows3 = [
            card3.add_row("", "", self._ai_keyring_note, keywords="keyring secure store"),
            card3.add_row("", "", self._ai_allow_plaintext, keywords="plaintext insecure config"),
        ]
        cards.append((card3, rows3))

        page = self._wrap_page("ai", "AI", cards)
        self._ai_provider.currentTextChanged.connect(self._refresh_ai_key_info_async)
        self._ai_allow_plaintext.toggled.connect(self._refresh_ai_key_info_async)
        self._ai_enabled.toggled.connect(self._update_ai_enabled_state)
        self._update_ai_enabled_state(self._ai_enabled.isChecked())
        self._refresh_ai_key_info_async()
        return page

    def _update_ai_enabled_state(self, enabled: bool) -> None:
        self._ai_provider.setEnabled(enabled)
        self._ai_key.setEnabled(enabled)
        self._ai_allow_plaintext.setEnabled(enabled)
        self._ai_save_button.setEnabled(enabled)
        self._ai_test_button.setEnabled(enabled)
        self._ai_install_button.setEnabled(enabled)

    def _build_advanced_page(self) -> QWidget:
        cards: list[tuple[QFrame, list[_SettingsRow]]] = []

        self._debug_logging = QCheckBox("Enable debug logging")
        self._debug_logging.setChecked(self._config.get_bool("debug_logging", False))
        self._track(self._debug_logging)

        log_path = self._config.get_str("log_path", str(Path.home() / ".cache/geyma/logs/geyma.log"))
        log_label = QLabel(f"Log file: {log_path}")

        self._custom_titlebar = QCheckBox("Use custom title bar (restart window)")
        self._custom_titlebar.setChecked(self._config.get_bool("custom_titlebar", False))
        self._track(self._custom_titlebar)

        self._reset_settings = QCheckBox("Reset settings on apply/close")
        self._reset_settings.setChecked(False)
        self._track(self._reset_settings)

        card = _SettingsCard("Advanced")
        rows = [
            card.add_row("", "", self._debug_logging),
            card.add_row("", "", log_label, keywords="log path file"),
            card.add_row("", "", self._custom_titlebar),
        ]
        cards.append((card, rows))

        card2 = _SettingsCard("Reset")
        rows2 = [
            card2.add_row(
                "",
                "Clears all saved settings and closes the dialog on apply.",
                self._reset_settings,
                keywords="reset defaults clear",
            )
        ]
        cards.append((card2, rows2))
        return self._wrap_page("advanced", "Advanced", cards)

    def _browse_startup_path(self) -> None:
        path = QFileDialog.getExistingDirectory(self, "Startup Folder", str(Path.home()))
        if path:
            self._startup_path.setText(path)

    def _edit_bookmarks(self) -> None:
        dialog = BookmarksDialog(self._config.get("bookmarks", []), self)
        dialog.changed.connect(self._save_bookmarks)
        dialog.exec()

    def _save_bookmarks(self, bookmarks: list[dict]) -> None:
        self._config.set("bookmarks", bookmarks)
        self._config.save()
        self.settingsChanged.emit()
        self._status.setText("Applied.")

    def _apply(self) -> None:
        if self._ai_enabled.isChecked() and not self._config.get_bool("ai_disclosure_seen", False):
            dialog = AIDisclosureDialog(self._ai_provider.currentText(), self)
            if dialog.exec() != QDialog.Accepted:
                return
            self._config.set("ai_disclosure_seen", True)

        if self._reset_settings.isChecked():
            self._config.clear()
            self.settingsChanged.emit()
            self._set_dirty(False)
            self.accept()
            return

        self._config.set("startup_mode", self._startup_mode.currentText())
        self._config.set("startup_path", self._startup_path.text().strip())
        self._config.set("restore_windows", self._restore_windows.isChecked())
        self._config.set("remember_window", self._remember_window.isChecked())

        self._config.set("show_hidden", self._show_hidden.isChecked())
        self._config.set("list_icon_size", self._list_icon_size.value())
        self._config.set("grid_icon_size", self._grid_icon_size.value())
        self._config.set("row_padding", self._row_padding.value())
        self._config.set("grid_spacing", self._grid_spacing.value())
        self._config.set("thumbnail_mode", self._thumbnail_mode.currentText())
        self._config.set("thumbnail_max_bytes", self._thumbnail_max_bytes.value() * 1024 * 1024)
        self._config.set("size_units", self._size_units.currentText())
        self._config.set("date_format", self._date_format.text().strip() or "locale")
        self._config.set("sort_folders_first", self._folders_first_mode.currentData())
        self._config.set("show_breadcrumbs", self._show_breadcrumbs.isChecked())
        self._config.set("status_bar_details", self._status_details.isChecked())

        self._config.set("sidebar_show_places", self._show_places.isChecked())
        self._config.set("sidebar_show_devices", self._show_devices.isChecked())
        self._config.set("sidebar_show_trash", self._show_trash.isChecked())
        self._config.set("sidebar_show_network", self._show_network.isChecked())

        self._config.set("view_mode", self._default_view.currentText())
        self._config.set("sort_column", self._sort_column.currentIndex())
        self._config.set("sort_order", self._sort_order.currentText())
        self._config.set("single_click_open", self._single_click.isChecked())
        self._config.set("open_folders_new_window", self._open_folders_new_window.isChecked())
        self._config.set("open_default_app", self._open_default_app.isChecked())
        self._config.set("enable_open_with_last", self._open_with_last.isChecked())
        self._config.set("middle_click_tab", self._middle_click_tab.isChecked())

        self._config.set("conflict_default", self._conflict_default.currentText())
        self._config.set("preserve_metadata", self._preserve_metadata.isChecked())
        self._config.set("delete_behavior", self._delete_behavior.currentText())
        self._config.set("secure_delete_warning", self._secure_delete_warning.isChecked())

        self._config.set("search_scope", self._search_scope.currentText())
        self._config.set("search_include_hidden", self._search_include_hidden.isChecked())
        self._config.set("search_case_sensitive", self._search_case_sensitive.isChecked())

        self._config.set("track_recent", self._track_recent.isChecked())
        self._config.set("clear_history_on_exit", self._clear_history.isChecked())
        self._config.set("permissions_editor_enabled", self._permissions_editor.isChecked())
        self._config.set("warn_executables", self._warn_exec.isChecked())

        self._config.set("thumbnail_cache_size", self._thumbnail_cache_size.value())
        self._config.set("thumbnail_max_bytes", self._thumbnail_max_bytes_perf.value() * 1024 * 1024)
        self._config.set("large_folder_threshold", self._large_folder_threshold.value())

        self._config.set("open_backend", self._open_backend.currentText())
        self._config.set("trash_write_info", self._trash_write_info.isChecked())
        self._config.set("enable_mount_actions", self._mount_unmount.isChecked())

        self._config.set("ai_enabled", self._ai_enabled.isChecked())
        self._config.set("ai_provider", self._ai_provider.currentText())
        self._config.set("ai_allow_plaintext_key", self._ai_allow_plaintext.isChecked())

        self._config.set("debug_logging", self._debug_logging.isChecked())
        self._config.set("custom_titlebar", self._custom_titlebar.isChecked())
        self._config.save()

        self.settingsChanged.emit()
        self._status.setText("Applied.")
        self._set_dirty(False)

    def _save_ai_key(self) -> None:
        provider = self._ai_provider.currentText()
        self._ai_status.setText("")
        if provider == "none":
            self._ai_key.clear()
            self._ai_status.setText("Select a provider first.")
            return
        raw_key = self._ai_key.text().strip()
        if not raw_key:
            self._ai_status.setText("API key is empty.")
            return
        if self._ai_allow_plaintext.isChecked() and not self._config.get_bool("ai_allow_plaintext_key", False):
            self._ai_status.setText("To allow plaintext storage, enable it and click Apply first.")
            return
        self._pending_ai_key = (provider, raw_key)
        self._set_ai_busy(True, "Saving...")
        worker = _KeyStoreWorker(provider, raw_key, mode="save")
        worker.signals.finished.connect(self._on_key_saved)
        QThreadPool.globalInstance().start(worker)

    def _test_ai_connection(self) -> None:
        provider = self._ai_provider.currentText()
        self._set_ai_busy(True, "Testing...")
        worker = _KeyStoreWorker(provider, "", mode="test")
        worker.signals.finished.connect(self._on_key_tested)
        QThreadPool.globalInstance().start(worker)

    def _on_key_saved(self, ok: bool, message: str) -> None:
        self._set_ai_busy(False, message)
        if ok:
            self._ai_key.clear()
            if getattr(self, "_pending_ai_key", None):
                provider, key = self._pending_ai_key
                if self._ai_allow_plaintext.isChecked() and self._config.get_bool("ai_allow_plaintext_key", False):
                    data = dict(self._config.get("ai_plaintext_keys", {}))
                    data[provider] = key
                    self._config.set("ai_plaintext_keys", data)
                    self._config.save()
        self._pending_ai_key = None
        self._refresh_ai_key_info_async()

    def _on_key_tested(self, ok: bool, message: str) -> None:
        self._set_ai_busy(False, message)
        self._refresh_ai_key_info_async()

    def _set_ai_busy(self, busy: bool, message: str) -> None:
        self._ai_status.setText(message)
        self._ai_save_button.setEnabled(not busy)
        self._ai_test_button.setEnabled(not busy)
        self._ai_key.setEnabled(not busy)
        self._ai_provider.setEnabled(not busy)

    def _refresh_ai_key_info_async(self) -> None:
        provider = self._ai_provider.currentText()
        worker = _KeyInfoWorker(provider)
        worker.signals.finished.connect(self._on_key_info_loaded)
        QThreadPool.globalInstance().start(worker)

    def _on_key_info_loaded(self, provider: str, key: str, source: str, error: str) -> None:
        if provider != self._ai_provider.currentText():
            return
        masked = self._mask_key(key)
        error_text = f" (error: {error})" if error else ""
        self._ai_key_info.setText(f"Stored key: {masked} (source: {source}){error_text}")
        self._logger.debug(
            "AI key info provider=%s source=%s has_key=%s error=%s",
            provider,
            source,
            bool(key),
            error,
        )

    @staticmethod
    def _mask_key(key: str | None) -> str:
        if not key:
            return "none"
        if len(key) <= 6:
            return "*" * len(key)
        return f"{key[:3]}***{key[-3:]}"

    def _show_keyring_install(self) -> None:
        title = "Install keyring (recommended)"
        instructions = self._keyring_install_instructions()
        QMessageBox.information(self, title, instructions)

    def _install_keyring(self) -> None:
        command = self._keyring_install_command()
        if not command:
            self._show_keyring_install()
            return
        reply = QMessageBox.question(
            self,
            "Install keyring",
            f"Run this command with elevated privileges?\n\n{command}",
            QMessageBox.Yes | QMessageBox.No,
        )
        if reply != QMessageBox.Yes:
            return
        if self._run_with_pkexec(command):
            return
        if not self._run_in_terminal(command):
            self._show_keyring_install()

    def _keyring_install_instructions(self) -> str:
        command = self._keyring_install_command()
        if command:
            return f"Install with: {command}"
        return "Install with: python3 -m pip install keyring"

    def _keyring_install_command(self) -> str:
        os_id = self._get_os_id()
        if os_id in {"ubuntu", "debian", "linuxmint", "pop"}:
            return "sudo apt install python3-keyring"
        if os_id in {"fedora", "rhel", "centos", "rocky", "almalinux"}:
            return "sudo dnf install python3-keyring"
        if os_id in {"arch", "manjaro"}:
            return "sudo pacman -S python-keyring"
        if os_id in {"opensuse", "suse"}:
            return "sudo zypper install python3-keyring"
        if os_id in {"gentoo"}:
            return "sudo emerge dev-python/keyring"
        if platform.system().lower() == "darwin":
            return "python3 -m pip install keyring"
        return "python3 -m pip install keyring"

    def _run_with_pkexec(self, command: str) -> bool:
        if not which("pkexec"):
            return False
        if command.startswith("sudo "):
            command = command[len("sudo ") :]
        return QProcess.startDetached("pkexec", ["sh", "-c", command])

    def _run_in_terminal(self, command: str) -> bool:
        terminal = self._detect_terminal()
        if not terminal:
            return False
        full_command = f"{command}; echo; read -n 1 -s -r -p 'Press any key to close...'"
        if terminal in {"gnome-terminal", "kgx"}:
            return QProcess.startDetached(terminal, ["--", "bash", "-c", full_command])
        if terminal == "konsole":
            return QProcess.startDetached(terminal, ["-e", "bash", "-c", full_command])
        if terminal in {"xfce4-terminal", "xterm", "kitty", "alacritty"}:
            return QProcess.startDetached(terminal, ["-e", "bash", "-c", full_command])
        if terminal == "x-terminal-emulator":
            return QProcess.startDetached(terminal, ["-e", "bash", "-c", full_command])
        return False

    @staticmethod
    def _detect_terminal() -> str:
        for candidate in (
            "x-terminal-emulator",
            "gnome-terminal",
            "kgx",
            "konsole",
            "xfce4-terminal",
            "kitty",
            "alacritty",
            "xterm",
        ):
            if which(candidate):
                return candidate
        return ""

    @staticmethod
    def _get_os_id() -> str:
        os_release = Path("/etc/os-release")
        if not os_release.exists():
            return ""
        try:
            data = os_release.read_text(encoding="utf-8")
        except OSError:
            return ""
        for line in data.splitlines():
            if line.startswith("ID="):
                return line.split("=", 1)[-1].strip().strip('"').lower()
        return ""
