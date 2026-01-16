from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
import os
import shutil
import sys
from urllib.parse import quote

from PySide6.QtCore import (
    QByteArray,
    QFileInfo,
    QDir,
    QRegularExpression,
    QSize,
    Qt,
    QTimer,
    QFileSystemWatcher,
    QItemSelectionModel,
    QModelIndex,
)
from PySide6.QtGui import QAction, QFont, QIcon
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QDialog,
    QFileDialog,
    QLineEdit,
    QComboBox,
    QInputDialog,
    QApplication,
    QMainWindow,
    QMenu,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QSplitter,
    QStatusBar,
    QToolButton,
    QToolBar,
    QTreeWidget,
    QTreeWidgetItem,
    QAbstractItemView,
    QVBoxLayout,
    QWidget,
)
from PySide6.QtCore import QProcess, QThreadPool

from geyma.ui.conflict_dialog import ConflictDialog
from geyma.ui.error_dialog import show_error
from geyma.ai.jobs.image_generation import ImageGenerationWorker
from geyma.ui.file_views import FileViewStack
from geyma.ui.folder_summary_dialog import FolderSummaryDialog
from geyma.ui.image_generation_dialog import ImageGenerationDialog
from geyma.ui.icon_provider import ThumbnailIconProvider
from geyma.ai.jobs.text_to_filters import translate_query
from geyma.ui.ai_data_preview_dialog import AIDataPreviewDialog
from geyma.ui.filters_dialog import FiltersDialog
from geyma.ui.models import FilterProxyModel, ValidatingFileSystemModel
from geyma.ui.properties_dialog import PropertiesDialog
from geyma.ui.progress_dialog import OperationProgressDialog
from geyma.ui.sidebar import PlacesSidebar
from geyma.ops.transfer_worker import TransferItem, TransferWorker
from geyma.ops.trash_utils import parse_trash_info
from geyma.utils.config import ConfigStore
from geyma.utils.operation_log import OperationLog
from geyma.utils.working_sets import WorkingSetStore
from geyma.ops.search_worker import SearchWorker
from geyma.ui.rename_suggestions_dialog import RenameSuggestionsDialog
from geyma.ui.settings_dialog import SettingsDialog
from geyma.ui.style import build_stylesheet
from geyma.ui.title_bar import TitleBar


class MainWindow(QMainWindow):
    def __init__(self, start_path: str | None = None) -> None:
        super().__init__()
        self.setWindowTitle("Geyma File Manager")
        self.resize(1100, 720)

        self._config = ConfigStore()
        self._apply_style()
        if start_path:
            initial_path = Path(start_path).expanduser()
        else:
            if self._config.get_bool("restore_windows", False):
                last_path = Path(self._config.get("last_path", str(Path.home())))
                initial_path = last_path if last_path.exists() else Path.home()
            else:
                startup_mode = self._config.get_str("startup_mode", "last")
                if startup_mode == "home":
                    initial_path = Path.home()
                elif startup_mode == "custom":
                    custom = self._config.get_str("startup_path", str(Path.home()))
                    initial_path = Path(custom).expanduser()
                else:
                    initial_path = Path(self._config.get("last_path", str(Path.home())))
        if not initial_path.exists():
            initial_path = Path.home()

        self._sort_column = int(self._config.get("sort_column", 0))
        self._sort_order = (
            Qt.DescendingOrder
            if self._config.get("sort_order", "asc") == "desc"
            else Qt.AscendingOrder
        )

        self._model = ValidatingFileSystemModel(self)
        self._model.setReadOnly(False)
        self._model.setFilter(QDir.AllEntries | QDir.NoDotAndDotDot)
        self._model.renameAttempted.connect(self._log_rename_attempt)
        initial_path_str = str(initial_path.resolve())
        self._model.setRootPath(initial_path_str)
        self._default_icon_provider = self._model.iconProvider()

        self._proxy = FilterProxyModel(self)
        self._proxy.setSourceModel(self._model)
        self._proxy.setFilterCaseSensitivity(Qt.CaseInsensitive)
        self._proxy.setFilterKeyColumn(0)
        self._proxy.set_folders_first_mode(self._config.get_str("sort_folders_first", "auto"))
        self._proxy.set_cut_paths([])
        self._quick_filters: list[dict] = []

        list_icon_size = int(self._config.get("list_icon_size", 20))
        grid_icon_size = int(self._config.get("grid_icon_size", 64))
        row_padding = int(self._config.get("row_padding", 6))
        grid_spacing = int(self._config.get("grid_spacing", 12))
        self._file_views = FileViewStack(
            self._proxy, list_icon_size, grid_icon_size, row_padding, grid_spacing, self
        )
        self._file_views.apply_sort(self._sort_column, self._sort_order)
        self._file_views.list_view.header().sortIndicatorChanged.connect(self._on_sort_indicator_changed)
        self._file_views.set_root_index(self._proxy.mapFromSource(self._model.index(initial_path_str)))
        self._file_views.selectionChanged.connect(self._update_selection_status)
        self._apply_thumbnail_mode()

        self._places = PlacesSidebar(self)
        self._working_sets = WorkingSetStore(self._config)
        self._places.set_working_sets(self._serialize_working_sets())
        self._places.workingSetActivated.connect(self._open_working_set)
        self._places.workingSetRenameRequested.connect(self._rename_working_set)
        self._places.workingSetDeleteRequested.connect(self._delete_working_set)

        splitter = QSplitter()
        splitter.addWidget(self._places)
        self._view_container = QWidget()
        view_layout = QVBoxLayout(self._view_container)
        view_layout.setContentsMargins(0, 0, 0, 0)
        view_layout.setSpacing(0)
        self._inline_search_panel = self._build_inline_search()
        self._inline_search_panel.setVisible(False)
        view_layout.addWidget(self._inline_search_panel)
        self._working_set_panel = self._build_working_set_panel()
        self._working_set_panel.setVisible(False)
        view_layout.addWidget(self._working_set_panel)
        self._activity_panel = self._build_activity_panel()
        self._activity_panel.setVisible(False)
        view_layout.addWidget(self._activity_panel)
        view_layout.addWidget(self._file_views)
        self._empty_state = QWidget()
        self._empty_state.setObjectName("EmptyState")
        empty_layout = QVBoxLayout(self._empty_state)
        empty_layout.setAlignment(Qt.AlignHCenter | Qt.AlignVCenter)
        empty_layout.setSpacing(6)
        self._empty_icon = QLabel("...")
        self._empty_icon.setObjectName("EmptyStateIcon")
        self._empty_title = QLabel("Empty folder")
        self._empty_title.setObjectName("EmptyStateTitle")
        self._empty_subtitle = QLabel("Drop files here or use New Folder to get started.")
        self._empty_subtitle.setObjectName("EmptyStateSubtitle")
        self._empty_subtitle.setWordWrap(True)
        self._empty_state.setMinimumWidth(380)
        self._empty_state.setMinimumHeight(220)
        empty_layout.addWidget(self._empty_icon, alignment=Qt.AlignHCenter)
        empty_layout.addWidget(self._empty_title, alignment=Qt.AlignHCenter)
        empty_layout.addWidget(self._empty_subtitle, alignment=Qt.AlignHCenter)
        self._empty_state.setVisible(True)
        empty_wrapper = QWidget()
        empty_wrapper_layout = QVBoxLayout(empty_wrapper)
        empty_wrapper_layout.setContentsMargins(0, 0, 0, 0)
        empty_wrapper_layout.addStretch(1)
        empty_wrapper_layout.addWidget(self._empty_state, alignment=Qt.AlignCenter)
        empty_wrapper_layout.addStretch(1)
        view_layout.addWidget(empty_wrapper)
        self._empty_wrapper = empty_wrapper
        self._empty_wrapper.setVisible(False)
        splitter.addWidget(self._view_container)
        splitter.setStretchFactor(1, 1)
        splitter.setChildrenCollapsible(False)
        QTimer.singleShot(0, lambda: splitter.setSizes([220, 1]))

        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(6, 6, 6, 6)
        content_layout.setSpacing(4)
        self._breadcrumb_bar = QWidget()
        self._breadcrumb_layout = QHBoxLayout(self._breadcrumb_bar)
        self._breadcrumb_layout.setContentsMargins(0, 0, 0, 0)
        self._breadcrumb_layout.setSpacing(4)
        content_layout.addWidget(self._breadcrumb_bar)
        self._breadcrumb_bar.setVisible(self._config.get_bool("show_breadcrumbs", True))
        content_layout.addWidget(splitter, 1)

        self.setCentralWidget(content)
        self._title_bar = TitleBar(self)
        self._apply_title_bar()

        self._history: list[str] = [initial_path_str]
        self._history_index = 0
        self._inline_search_worker: SearchWorker | None = None
        self._inline_search_filters: list[dict] = []
        self._working_set_id: str | None = None
        self._op_log = OperationLog(self._config)
        self._current_path = initial_path_str
        self._clipboard_paths: list[str] = []
        self._clipboard_mode: str | None = None
        self._confirm_delete = self._config.get_bool("confirm_delete", True)
        self._confirm_overwrite = self._config.get_bool("confirm_overwrite", True)
        self._single_click_open = self._config.get_bool("single_click_open", False)
        self._open_folders_new_window = self._config.get_bool("open_folders_new_window", False)
        self._open_default_app = self._config.get_bool("open_default_app", True)
        self._delete_behavior = str(self._config.get("delete_behavior", "trash")).lower()
        self._conflict_default = str(self._config.get("conflict_default", "ask")).lower()
        self._preserve_metadata = self._config.get_bool("preserve_metadata", True)
        self._secure_delete_warning = self._config.get_bool("secure_delete_warning", True)
        self._trash_delete_info = self._config.get_bool("trash_write_info", True)
        self._track_recent = self._config.get_bool("track_recent", False)
        self._warn_executables = self._config.get_bool("warn_executables", True)
        self._active_transfer: TransferWorker | None = None
        self._active_progress: OperationProgressDialog | None = None
        self._active_image_worker: ImageGenerationWorker | None = None
        self._active_image_progress: OperationProgressDialog | None = None
        self._watcher = QFileSystemWatcher(self)
        self._refresh_timer = QTimer(self)
        self._refresh_timer.setSingleShot(True)
        self._refresh_timer.setInterval(250)
        self._refresh_timer.timeout.connect(self._refresh)
        self._watcher.directoryChanged.connect(self._debounced_refresh)
        self._watcher.fileChanged.connect(self._debounced_refresh)
        self._trash_path = str(Path.home() / ".local/share/Trash/files")

        self._build_toolbar()
        self._build_status_bar()
        self._restore_window_state()

        self._path_edit.returnPressed.connect(self._go_to_path)
        self._places.pathActivated.connect(lambda path: self._go_to(Path(path)))
        self._places.openInNewWindow.connect(self._open_path_in_new_window)
        self._places.showProperties.connect(self._show_path_properties)
        self._file_views.itemActivated.connect(self._go_to_index)
        self._file_views.itemSingleClicked.connect(self._handle_single_click)
        self._file_views.contextMenuRequested.connect(self._show_view_context_menu)
        self._update_breadcrumbs(initial_path_str)
        self._sync_places_selection(initial_path_str)
        self._setup_shortcuts()
        self._set_watched_path(initial_path_str)
        self._proxy.rowsInserted.connect(self._update_empty_state)
        self._proxy.rowsRemoved.connect(self._update_empty_state)
        self._proxy.modelReset.connect(self._update_empty_state)
        self._update_empty_state()

        self.destroyed.connect(self._save_state)
        if self._config.get_bool("clear_history_on_exit", False):
            self.destroyed.connect(self._clear_history)

    def _build_toolbar(self) -> None:
        toolbar = QToolBar("Main")
        toolbar.setObjectName("MainToolbar")
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(20, 20))

        back_action = QAction(QIcon.fromTheme("go-previous"), "Back", self)
        back_action.setShortcut("Alt+Left")
        back_action.triggered.connect(self._go_back)

        forward_action = QAction(QIcon.fromTheme("go-next"), "Forward", self)
        forward_action.setShortcut("Alt+Right")
        forward_action.triggered.connect(self._go_forward)

        up_action = QAction(QIcon.fromTheme("go-up"), "Up", self)
        up_action.setShortcut("Alt+Up")
        up_action.triggered.connect(self._go_up)

        refresh_action = QAction(QIcon.fromTheme("view-refresh"), "Refresh", self)
        refresh_action.setShortcut("F5")
        refresh_action.triggered.connect(self._refresh)

        search_action = QAction(QIcon.fromTheme("edit-find"), "Search", self)
        search_action.setShortcut("Ctrl+F")
        search_action.triggered.connect(self._handle_search_action)
        recursive_search_action = QAction(QIcon.fromTheme("edit-find"), "Search in Folder", self)
        recursive_search_action.setShortcut("Ctrl+Shift+F")
        recursive_search_action.triggered.connect(lambda: self._show_inline_search("recursive"))
        summary_action = QAction(QIcon.fromTheme("view-list-details"), "Folder Summary", self)
        summary_action.triggered.connect(self._open_folder_summary)
        activity_action = QAction(QIcon.fromTheme("view-history"), "Recent Activity", self)
        activity_action.setCheckable(True)
        activity_action.toggled.connect(self._toggle_activity_panel)
        self._activity_action = activity_action
        self._hidden_action = QAction(QIcon.fromTheme("view-hidden"), "Show Hidden", self)
        self._hidden_action.setCheckable(True)
        self._hidden_action.setChecked(self._config.get_bool("show_hidden", False))
        self._hidden_action.toggled.connect(self._toggle_hidden)
        self._empty_trash_action = QAction(QIcon.fromTheme("user-trash"), "Empty Trash", self)
        self._empty_trash_action.triggered.connect(self._empty_trash)
        self._empty_trash_action.setEnabled(False)
        settings_action = QAction(QIcon.fromTheme("settings"), "Settings", self)
        settings_action.triggered.connect(self._open_settings)

        toolbar.addAction(back_action)
        toolbar.addAction(forward_action)
        toolbar.addAction(up_action)
        toolbar.addSeparator()
        toolbar.addAction(refresh_action)
        toolbar.addSeparator()
        toolbar.addAction(search_action)
        toolbar.addAction(summary_action)
        toolbar.addAction(activity_action)
        toolbar.addAction(self._hidden_action)
        toolbar.addAction(self._empty_trash_action)
        toolbar.addAction(settings_action)
        toolbar.addSeparator()

        path_label = QLabel("Path:")
        self._path_edit = QLineEdit()
        self._path_edit.setText(self._current_path)
        self._path_edit.setMinimumWidth(320)
        self._path_edit.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        self._path_edit.setPlaceholderText("Enter a path and press Enter")

        toolbar.addWidget(path_label)
        toolbar.addWidget(self._path_edit)
        toolbar.addSeparator()

        self._search_edit = QLineEdit()
        self._search_edit.setPlaceholderText("Filter")
        self._search_edit.setMinimumWidth(180)
        self._search_edit.setClearButtonEnabled(True)
        self._search_edit.textChanged.connect(self._apply_filter)
        toolbar.addWidget(self._search_edit)
        filters_button = QToolButton()
        filters_button.setText("Filters")
        filters_button.setIcon(QIcon.fromTheme("view-filter"))
        filters_button.setToolButtonStyle(Qt.ToolButtonTextBesideIcon)
        filters_button.clicked.connect(self._open_quick_filters)
        toolbar.addWidget(filters_button)
        clear_filters_button = QToolButton()
        clear_filters_button.setText("Clear")
        clear_filters_button.setIcon(QIcon.fromTheme("edit-clear"))
        clear_filters_button.setToolButtonStyle(Qt.ToolButtonTextBesideIcon)
        clear_filters_button.clicked.connect(self._clear_quick_filters)
        toolbar.addWidget(clear_filters_button)
        self._filters_active_label = QLabel("Filters active")
        self._filters_active_label.setVisible(False)
        toolbar.addWidget(self._filters_active_label)
        toolbar.addSeparator()
        toolbar.addWidget(self._build_sort_button())
        toolbar.addWidget(self._build_view_toggle())

        self.addToolBar(toolbar)

    def _setup_shortcuts(self) -> None:
        copy_action = QAction(self)
        copy_action.setShortcut("Ctrl+C")
        copy_action.setShortcutContext(Qt.ApplicationShortcut)
        copy_action.triggered.connect(self._copy_selection)
        self.addAction(copy_action)

        cut_action = QAction(self)
        cut_action.setShortcut("Ctrl+X")
        cut_action.setShortcutContext(Qt.ApplicationShortcut)
        cut_action.triggered.connect(self._cut_selection)
        self.addAction(cut_action)

        paste_action = QAction(self)
        paste_action.setShortcut("Ctrl+V")
        paste_action.setShortcutContext(Qt.ApplicationShortcut)
        paste_action.triggered.connect(self._paste_into_current)
        self.addAction(paste_action)

        select_all_action = QAction(self)
        select_all_action.setShortcut("Ctrl+A")
        select_all_action.setShortcutContext(Qt.ApplicationShortcut)
        select_all_action.triggered.connect(self._select_all)
        self.addAction(select_all_action)

        delete_action = QAction(self)
        delete_action.setShortcut("Del")
        delete_action.triggered.connect(self._handle_delete_action)
        self.addAction(delete_action)

        search_action = QAction(self)
        search_action.setShortcut("Ctrl+F")
        search_action.triggered.connect(self._handle_search_action)
        self.addAction(search_action)

        recursive_search_action = QAction(self)
        recursive_search_action.setShortcut("Ctrl+Shift+F")
        recursive_search_action.triggered.connect(lambda: self._show_inline_search("recursive"))
        self.addAction(recursive_search_action)

        permanent_delete_action = QAction(self)
        permanent_delete_action.setShortcut("Shift+Del")
        permanent_delete_action.triggered.connect(self._confirm_permanent_delete)
        self.addAction(permanent_delete_action)

        new_folder_action = QAction(self)
        new_folder_action.setShortcut("Ctrl+Shift+N")
        new_folder_action.triggered.connect(self._create_new_folder)
        self.addAction(new_folder_action)

        rename_action = QAction(self)
        rename_action.setShortcut("F2")
        rename_action.triggered.connect(self._rename_current)
        self.addAction(rename_action)

    def _build_view_toggle(self) -> QToolButton:
        self._view_toggle = QToolButton()
        self._view_toggle.setText("View")
        self._view_toggle.setCheckable(True)
        self._view_toggle.setChecked(self._config.get("view_mode", "list") == "icon")
        self._view_toggle.setToolTip("Toggle view mode")
        self._view_toggle.toggled.connect(self._toggle_view_mode)
        self._view_toggle.setToolButtonStyle(Qt.ToolButtonTextBesideIcon)
        self._update_view_toggle_ui()
        return self._view_toggle

    def _build_sort_button(self) -> QToolButton:
        menu = QMenu("Sort", self)
        name_action = menu.addAction("Name")
        size_action = menu.addAction("Size")
        type_action = menu.addAction("Type")
        modified_action = menu.addAction("Modified")
        menu.addSeparator()
        asc_action = menu.addAction("Ascending")
        desc_action = menu.addAction("Descending")

        name_action.triggered.connect(lambda: self._set_sort_column(0))
        size_action.triggered.connect(lambda: self._set_sort_column(1))
        type_action.triggered.connect(lambda: self._set_sort_column(2))
        modified_action.triggered.connect(lambda: self._set_sort_column(3))
        asc_action.triggered.connect(lambda: self._set_sort_order(Qt.AscendingOrder))
        desc_action.triggered.connect(lambda: self._set_sort_order(Qt.DescendingOrder))

        self._sort_menu = menu
        button = QToolButton()
        button.setText("Sort")
        button.setIcon(QIcon.fromTheme("view-sort-ascending"))
        button.setPopupMode(QToolButton.InstantPopup)
        button.setMenu(menu)
        button.setToolButtonStyle(Qt.ToolButtonTextBesideIcon)
        return button

    def _build_status_bar(self) -> None:
        status = QStatusBar()
        status.showMessage("Ready")
        self.setStatusBar(status)

    def _apply_style(self) -> None:
        font = QFont("IBM Plex Sans", 10)
        app = QApplication.instance()
        if app is not None:
            app.setFont(font)
            app.setStyleSheet(build_stylesheet(self._config))

    def _go_to_path(self) -> None:
        raw_path = self._path_edit.text().strip()
        if not raw_path:
            return

        self._go_to(Path(raw_path).expanduser())

    def _go_to(self, path: Path, record_history: bool = True) -> None:
        if not path.exists():
            self.statusBar().showMessage("Path does not exist")
            return

        resolved = str(path.resolve())
        self._warn_large_folder(resolved)
        if record_history:
            if self._history_index < len(self._history) - 1:
                self._history = self._history[: self._history_index + 1]
            if not self._history or self._history[-1] != resolved:
                self._history.append(resolved)
                self._history_index = len(self._history) - 1

        self._current_path = resolved
        self._set_root_index(resolved)
        self._path_edit.setText(resolved)
        self._update_breadcrumbs(resolved)
        self._sync_places_selection(resolved)
        self._set_watched_path(resolved)
        self.statusBar().showMessage(resolved)
        self._update_empty_state()
        self._empty_trash_action.setEnabled(resolved == self._trash_path)
        self._config.set("last_path", resolved)
        if self._track_recent:
            recent = list(self._config.get("recent_paths", []))
            if resolved in recent:
                recent.remove(resolved)
            recent.insert(0, resolved)
            self._config.set("recent_paths", recent[:10])

    def _go_back(self) -> None:
        if self._history_index <= 0:
            return
        self._history_index -= 1
        self._go_to(Path(self._history[self._history_index]), record_history=False)

    def _go_forward(self) -> None:
        if self._history_index >= len(self._history) - 1:
            return
        self._history_index += 1
        self._go_to(Path(self._history[self._history_index]), record_history=False)

    def _go_up(self) -> None:
        current = Path(self._current_path)
        parent = current.parent if current.parent != current else current
        self._go_to(parent)

    def _refresh(self) -> None:
        index = self._model.index(self._current_path)
        if hasattr(self._model, "refresh"):
            self._model.refresh(index)
        else:
            self._model.setRootPath(self._current_path)
        self.statusBar().showMessage("Refreshed")
        self._update_empty_state()

    def _set_watched_path(self, path: str) -> None:
        directories = self._watcher.directories()
        files = self._watcher.files()
        if directories:
            self._watcher.removePaths(directories)
        if files:
            self._watcher.removePaths(files)
        self._watcher.addPath(path)

    def _warn_large_folder(self, path: str) -> None:
        try:
            threshold = int(self._config.get("large_folder_threshold", 50000))
        except Exception:
            threshold = 50000
        if threshold <= 0:
            return
        try:
            count = sum(1 for _ in Path(path).iterdir())
        except OSError:
            return
        if count >= threshold:
            QMessageBox.information(
                self,
                "Large Folder",
                f"This folder contains about {count} items and may be slow to open.",
            )
    def _set_root_index(self, resolved: str) -> None:
        source_index = self._model.index(resolved)
        proxy_index = self._proxy.mapFromSource(source_index)
        self._file_views.set_root_index(proxy_index)

    def _toggle_view_mode(self, checked: bool) -> None:
        self._file_views.set_view_mode("icon" if checked else "list")
        self._config.set("view_mode", "icon" if checked else "list")
        self._update_view_toggle_ui()
        self._update_selection_status()

    def _update_view_toggle_ui(self) -> None:
        checked = bool(self._view_toggle.isChecked())
        if checked:
            self._view_toggle.setText("Grid")
            self._view_toggle.setIcon(QIcon.fromTheme("view-grid"))
            self._view_toggle.setToolTip("Grid view")
        else:
            self._view_toggle.setText("List")
            self._view_toggle.setIcon(QIcon.fromTheme("view-list-details"))
            self._view_toggle.setToolTip("List view")

    def _save_state(self) -> None:
        if self._config.get_bool("remember_window", True):
            geometry = self.saveGeometry()
            self._config.set("window_geometry", geometry.toBase64().data().decode("ascii"))
        self._config.save()

    def _clear_history(self) -> None:
        self._config.set("recent_paths", [])
        self._config.save()

    def _debounced_refresh(self, _path: str) -> None:
        if self._refresh_timer.isActive():
            self._refresh_timer.stop()
        self._refresh_timer.start()

    def _update_empty_state(self) -> None:
        if self._inline_search_panel.isVisible():
            self._empty_wrapper.setVisible(False)
            return
        if self._working_set_panel.isVisible():
            self._empty_wrapper.setVisible(False)
            return
        info = QFileInfo(self._current_path)
        if info.exists() and not info.isReadable():
            title = "Permission denied"
            subtitle = "You do not have access to this folder."
            icon = "!"
        else:
            has_rows = self._proxy.rowCount(self._file_views.active_view.rootIndex()) > 0
            if has_rows:
                self._file_views.set_stack_visible(True)
                self._empty_wrapper.setVisible(False)
                return
            if self._search_edit.text().strip():
                title = "No results"
                subtitle = "Try a different search or clear filters."
                icon = "?"
            else:
                title = "Empty folder"
                subtitle = "Drop files here or use New Folder to get started."
                icon = "..."
        self._empty_icon.setText(icon)
        self._empty_title.setText(title)
        self._empty_subtitle.setText(subtitle)
        self._file_views.set_stack_visible(False)
        self._empty_wrapper.setVisible(True)

    def _go_to_index(self, index) -> None:
        if not index.isValid():
            return
        source_index = self._proxy.mapToSource(index)
        if self._model.isDir(source_index):
            path = self._model.filePath(source_index)
            if self._open_folders_new_window:
                if not self._open_path_in_new_window(path):
                    show_error(self, "Open in New Window", "Failed to open a new window.")
                return
            self._go_to(Path(path))
            return
        self._open_source_index(source_index)

    def _handle_single_click(self, index) -> None:
        if not self._single_click_open or not index.isValid():
            return
        source_index = self._proxy.mapToSource(index)
        if not source_index.isValid():
            return
        if self._model.isDir(source_index):
            path = self._model.filePath(source_index)
            if self._open_folders_new_window:
                if not self._open_path_in_new_window(path):
                    show_error(self, "Open in New Window", "Failed to open a new window.")
                return
            self._go_to(Path(path))
            return
        self._open_source_index(source_index)

    def _update_breadcrumbs(self, path: str) -> None:
        if not self._breadcrumb_bar.isVisible():
            return
        while self._breadcrumb_layout.count():
            item = self._breadcrumb_layout.takeAt(0)
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()

        resolved = Path(path)
        parts = resolved.parts or (resolved.root or "/",)
        current = Path(parts[0]) if parts else Path("/")

        for idx, part in enumerate(parts):
            label = "/" if part == "/" else part
            button = QPushButton(label)
            button.setFlat(True)
            button.setProperty("breadcrumb-index", idx)
            target = str(current)
            button.clicked.connect(lambda _checked=False, p=target: self._go_to(Path(p)))
            self._breadcrumb_layout.addWidget(button)

            if idx < len(parts) - 1:
                separator = QLabel("/")
                self._breadcrumb_layout.addWidget(separator)
            if idx + 1 < len(parts):
                current = current / parts[idx + 1]

        self._breadcrumb_layout.addStretch(1)

    def _sync_places_selection(self, path: str) -> None:
        self._places.sync_selection(path)

    def _update_selection_status(self) -> None:
        if not self._config.get_bool("status_bar_details", True):
            self.statusBar().showMessage(self._current_path)
            return
        selection_model = self._file_views.active_view.selectionModel()
        if selection_model is None:
            return

        indexes = selection_model.selectedIndexes()
        if not indexes:
            self.statusBar().showMessage(self._current_path)
            return

        paths: set[str] = set()
        total_bytes = 0
        file_count = 0
        for index in indexes:
            primary = index.siblingAtColumn(0)
            if not primary.isValid():
                continue
            source_primary = self._proxy.mapToSource(primary)
            if not source_primary.isValid():
                continue
            path = self._model.filePath(source_primary)
            if path in paths:
                continue
            paths.add(path)
            info = self._model.fileInfo(source_primary)
            if info.isFile():
                file_count += 1
                total_bytes += info.size()

        item_count = len(paths)
        if file_count:
            size_text = self._format_bytes(total_bytes)
            message = f"{item_count} items, {file_count} files, {size_text}"
        else:
            message = f"{item_count} items"
        self.statusBar().showMessage(message)

    def _show_view_context_menu(self, position, view) -> None:
        index = view.indexAt(position)
        global_pos = view.viewport().mapToGlobal(position)
        if index.isValid():
            self._show_item_context_menu(index, global_pos)
        else:
            self._show_blank_context_menu(global_pos)

    def _show_item_context_menu(self, index, global_pos) -> None:
        menu = QMenu(self)
        source_index = self._proxy.mapToSource(index)
        is_dir = source_index.isValid() and self._model.isDir(source_index)
        ai_enabled = self._config.get_bool("ai_enabled", False)
        has_clipboard = bool(self._clipboard_paths and self._clipboard_mode)
        in_trash = self._current_path == self._trash_path
        trash_write_info = self._trash_delete_info
        is_image = self._is_image_index(source_index)
        open_with_last_available = (
            self._config.get_bool("enable_open_with_last", True)
            and bool(self._config.get("last_open_with_app"))
        )

        open_action = menu.addAction("Open")
        open_with_action = menu.addAction("Open with…")
        if open_with_last_available:
            open_with_last_action = menu.addAction("Open with Last Used")
        else:
            open_with_last_action = None
        if is_dir:
            open_window_action = menu.addAction("Open in New Window")
        else:
            open_window_action = None
        menu.addSeparator()
        copy_action = menu.addAction("Copy")
        cut_action = menu.addAction("Cut")
        if has_clipboard:
            paste_action = menu.addAction("Paste")
        else:
            paste_action = None
        menu.addSeparator()
        rename_action = menu.addAction("Rename")
        if ai_enabled:
            ai_rename_action = menu.addAction("AI Rename Suggestions")
        else:
            ai_rename_action = None
        working_set_menu = menu.addMenu("Working Set")
        if in_trash and trash_write_info:
            restore_action = menu.addAction("Restore from Trash")
            trash_action = None
        else:
            trash_action = menu.addAction("Move to Trash")
            restore_action = None
        if ai_enabled and is_image:
            generate_variation_action = menu.addAction("Generate Variation…")
            edit_image_action = menu.addAction("Edit Image with Prompt…")
        else:
            generate_variation_action = None
            edit_image_action = None
        if is_dir:
            summary_action = menu.addAction("Folder Summary")
        else:
            summary_action = None
        properties_action = menu.addAction("Properties")

        open_action.triggered.connect(lambda: self._open_index(index))
        open_with_action.triggered.connect(lambda: self._open_with_index(index))
        if open_with_last_action is not None:
            open_with_last_action.triggered.connect(lambda: self._open_with_last(index))
        if open_window_action is not None:
            open_window_action.triggered.connect(lambda: self._open_in_new_window(index))
        copy_action.triggered.connect(self._copy_selection)
        cut_action.triggered.connect(self._cut_selection)
        if paste_action is not None:
            paste_action.triggered.connect(self._paste_into_current)
        rename_action.triggered.connect(lambda: self._rename_index(index))
        if ai_rename_action is not None:
            ai_rename_action.triggered.connect(lambda: self._open_ai_rename(index))
        if trash_action is not None:
            trash_action.triggered.connect(self._move_to_trash_selection)
        if restore_action is not None:
            restore_action.triggered.connect(self._restore_from_trash_selection)
        properties_action.triggered.connect(lambda: self._show_properties(index))
        if summary_action is not None:
            summary_action.triggered.connect(lambda: self._open_folder_summary_index(index))
        if generate_variation_action is not None:
            generate_variation_action.triggered.connect(
                lambda: self._open_image_generation(index, mode="variation")
            )
        if edit_image_action is not None:
            edit_image_action.triggered.connect(lambda: self._open_image_generation(index, mode="edit"))
        self._populate_working_set_menu(working_set_menu)
        menu.exec(global_pos)

    def _show_blank_context_menu(self, global_pos) -> None:
        menu = QMenu(self)
        new_folder_action = menu.addAction("New Folder")
        new_file_action = menu.addAction("New File")
        has_clipboard = bool(self._clipboard_paths and self._clipboard_mode)
        ai_enabled = self._config.get_bool("ai_enabled", False)
        if has_clipboard:
            paste_action = menu.addAction("Paste")
        else:
            paste_action = None
        if ai_enabled:
            generate_action = menu.addAction("Generate Image Here…")
        else:
            generate_action = None
        sort_menu = menu.addMenu(self._sort_menu)
        show_hidden_action = menu.addAction("Show Hidden")
        show_hidden_action.setCheckable(True)
        show_hidden_action.setChecked(self._hidden_action.isChecked())
        new_folder_action.triggered.connect(self._create_new_folder)
        new_file_action.triggered.connect(self._create_new_file)
        if paste_action is not None:
            paste_action.triggered.connect(self._paste_into_current)
        if generate_action is not None:
            generate_action.triggered.connect(self._open_image_generation)
        show_hidden_action.toggled.connect(self._hidden_action.setChecked)
        _ = sort_menu
        menu.exec(global_pos)

    def _open_index(self, index) -> None:
        source_index = self._proxy.mapToSource(index)
        if not source_index.isValid():
            return
        if self._model.isDir(source_index):
            path = self._model.filePath(source_index)
            if self._open_folders_new_window:
                if not self._open_path_in_new_window(path):
                    show_error(self, "Open in New Window", "Failed to open a new window.")
                return
            self._go_to(Path(path))
            return
        self._open_source_index(source_index)

    def _open_in_new_window(self, index) -> None:
        source_index = self._proxy.mapToSource(index)
        if not source_index.isValid():
            return
        path = self._model.filePath(source_index)
        if not self._model.isDir(source_index):
            path = str(Path(path).parent)
        if not self._open_path_in_new_window(path):
            show_error(self, "Open in New Window", "Failed to open a new window.")

    def _open_path_in_new_window(self, path: str) -> bool:
        return QProcess.startDetached(sys.executable, ["-m", "geyma", path])

    def _open_source_index(self, source_index) -> None:
        if not source_index.isValid():
            return
        path = self._model.filePath(source_index)
        if not self._open_default_app:
            self.statusBar().showMessage("Opening files in default apps is disabled")
            return
        if self._warn_executables and Path(path).is_file() and os.access(path, os.X_OK):
            reply = QMessageBox.warning(
                self,
                "Open Executable",
                "This file is executable. Open it anyway?",
                QMessageBox.Yes | QMessageBox.No,
            )
            if reply != QMessageBox.Yes:
                return
        if not self._open_path(path):
            self.statusBar().showMessage("Failed to open file")

    def _open_path(self, path: str) -> bool:
        preferred = self._config.get_str("open_backend", "auto").lower()
        candidates = self._open_candidates(path, preferred)
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

    def _open_with_index(self, index) -> None:
        source_index = self._proxy.mapToSource(index)
        if not source_index.isValid():
            return
        if self._model.isDir(source_index):
            path = self._model.filePath(source_index)
            if self._open_folders_new_window:
                if not self._open_path_in_new_window(path):
                    show_error(self, "Open in New Window", "Failed to open a new window.")
                return
            self._go_to(Path(path))
            return
        path = self._model.filePath(source_index)
        app_path, _ = QFileDialog.getOpenFileName(
            self,
            "Open With",
            str(Path.home()),
            "Applications (*)",
        )
        if not app_path:
            return
        if self._open_with_app(path, app_path):
            self._config.set("last_open_with_app", app_path)

    def _open_with_last(self, index) -> None:
        source_index = self._proxy.mapToSource(index)
        if not source_index.isValid():
            return
        if not self._config.get_bool("enable_open_with_last", True):
            return
        if self._model.isDir(source_index):
            path = self._model.filePath(source_index)
            if self._open_folders_new_window:
                if not self._open_path_in_new_window(path):
                    show_error(self, "Open in New Window", "Failed to open a new window.")
                return
            self._go_to(Path(path))
            return
        app_path = str(self._config.get("last_open_with_app", ""))
        if not app_path:
            return
        path = self._model.filePath(source_index)
        if not self._open_with_app(path, app_path):
            show_error(self, "Open With", "Failed to open with the last used app.")

    @staticmethod
    def _open_with_app(path: str, app_path: str) -> bool:
        return QProcess.startDetached(app_path, [path])

    def _rename_index(self, index) -> None:
        self._file_views.edit(index)

    def _rename_current(self) -> None:
        index = self._file_views.current_index()
        if index.isValid():
            self._rename_index(index)

    def _show_properties(self, index) -> None:
        source_index = self._proxy.mapToSource(index)
        if not source_index.isValid():
            return
        info = self._model.fileInfo(source_index)
        dialog = PropertiesDialog(Path(info.absoluteFilePath()), self)
        dialog.exec()

    def _show_path_properties(self, path: str) -> None:
        dialog = PropertiesDialog(Path(path), self)
        dialog.exec()

    def _create_new_folder(self) -> None:
        base = Path(self._current_path)
        if not base.exists():
            return
        stem = "New Folder"
        candidate = base / stem
        counter = 1
        while candidate.exists():
            candidate = base / f"{stem} {counter}"
            counter += 1
        try:
            candidate.mkdir()
            self._op_log.append("create_folder", [str(candidate)], success=True)
            self._go_to(base)
        except OSError as exc:
            self._op_log.append("create_folder", [str(candidate)], success=False, error=str(exc))
            show_error(self, "New Folder", str(exc))

    def _create_new_file(self) -> None:
        base = Path(self._current_path)
        if not base.exists():
            return
        candidate = self._resolve_collision(base / "New File.txt")
        try:
            candidate.touch(exist_ok=False)
            self._op_log.append("create_file", [str(candidate)], success=True)
            self.statusBar().showMessage(f"Created {candidate.name}")
            self._go_to(base)
        except OSError as exc:
            self._op_log.append("create_file", [str(candidate)], success=False, error=str(exc))
            show_error(self, "New File", str(exc))

    def _empty_trash(self) -> None:
        trash_files = Path(self._trash_path)
        trash_info = trash_files.parent / "info"
        if not trash_files.exists():
            return
        if self._confirm_delete:
            reply = QMessageBox.warning(
                self,
                "Empty Trash",
                "Permanently delete all items in Trash?",
                QMessageBox.Yes | QMessageBox.No,
            )
            if reply != QMessageBox.Yes:
                return
        try:
            for entry in trash_files.iterdir():
                if entry.is_dir() and not entry.is_symlink():
                    shutil.rmtree(entry)
                else:
                    entry.unlink(missing_ok=True)
            if trash_info.exists():
                for entry in trash_info.iterdir():
                    entry.unlink(missing_ok=True)
            self.statusBar().showMessage("Trash emptied")
            self._go_to(Path(self._current_path))
        except OSError as exc:
            show_error(self, "Empty Trash", str(exc))

    def _move_to_trash_selection(self) -> None:
        paths = self._selected_source_paths()
        if not paths:
            return

        trash_base = Path.home() / ".local/share/Trash"
        files_dir = trash_base / "files"
        info_dir = trash_base / "info"
        try:
            files_dir.mkdir(parents=True, exist_ok=True)
            info_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            show_error(self, "Move to Trash", str(exc))
            return

        timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        moved = 0
        for src in paths:
            source_path = Path(src)
            if not source_path.exists():
                continue
            name = self._unique_trash_name(files_dir, source_path.name)
            dest_path = files_dir / name
            info_path = info_dir / f"{name}.trashinfo"
            try:
                shutil.move(str(source_path), str(dest_path))
                encoded = quote(str(source_path), safe="/")
                if self._trash_delete_info:
                    info_path.write_text(
                        f"[Trash Info]\nPath={encoded}\nDeletionDate={timestamp}\n",
                        encoding="utf-8",
                    )
                moved += 1
            except OSError as exc:
                show_error(self, "Move to Trash", str(exc))

        if moved:
            self._op_log.append("trash", paths, success=True)
            self.statusBar().showMessage(f"Moved {moved} items to Trash")
            self._go_to(Path(self._current_path))

    def _handle_delete_action(self) -> None:
        if self._delete_behavior == "delete":
            self._confirm_permanent_delete()
        else:
            self._move_to_trash_selection()

    def _restore_from_trash_selection(self) -> None:
        if self._current_path != self._trash_path:
            return
        if not self._trash_delete_info:
            self.statusBar().showMessage("Restore is disabled when .trashinfo metadata is off")
            return
        selected = self._selected_source_paths()
        if not selected:
            return
        info_dir = Path(self._trash_path).parent / "info"
        restored = 0
        sources: list[str] = []
        destinations: list[str] = []
        for src in selected:
            source_path = Path(src)
            info_path = info_dir / f"{source_path.name}.trashinfo"
            info = parse_trash_info(info_path)
            if info is None:
                continue
            target = info.original_path
            target_parent = target.parent
            if not target_parent.exists():
                target_parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                target = self._resolve_collision(target)
            try:
                shutil.move(str(source_path), str(target))
                info_path.unlink(missing_ok=True)
                restored += 1
                sources.append(str(source_path))
                destinations.append(str(target))
            except OSError as exc:
                show_error(self, "Restore from Trash", str(exc))
        if restored:
            self._op_log.append("restore", sources, destinations, success=True)
            self.statusBar().showMessage(f"Restored {restored} items")
            self._go_to(Path(self._current_path))

    def _confirm_permanent_delete(self) -> None:
        paths = self._selected_source_paths()
        if not paths:
            return
        if self._confirm_delete:
            message = f"Permanently delete {len(paths)} item(s)? This cannot be undone."
            if self._secure_delete_warning:
                message += "\nSecure delete is not supported."
            reply = QMessageBox.warning(
                self,
                "Permanent Delete",
                message,
                QMessageBox.Yes | QMessageBox.No,
            )
            if reply != QMessageBox.Yes:
                return
        self._permanently_delete(paths)

    def _permanently_delete(self, paths: list[str]) -> None:
        deleted = 0
        for src in paths:
            source_path = Path(src)
            if not source_path.exists():
                continue
            try:
                if source_path.is_dir():
                    shutil.rmtree(source_path)
                else:
                    source_path.unlink()
                deleted += 1
            except OSError as exc:
                show_error(self, "Permanent Delete", str(exc))
                self._op_log.append("delete", [str(source_path)], success=False, error=str(exc))
        if deleted:
            self._op_log.append("delete", paths, success=True)
            self.statusBar().showMessage(f"Deleted {deleted} items")
            self._go_to(Path(self._current_path))

    def _selected_source_paths(self) -> list[str]:
        selection_model = self._file_views.active_view.selectionModel()
        if selection_model is None:
            return []
        indexes = selection_model.selectedIndexes()
        if not indexes:
            return []
        paths: list[str] = []
        seen: set[str] = set()
        for index in indexes:
            primary = index.siblingAtColumn(0)
            if not primary.isValid():
                continue
            source_primary = self._proxy.mapToSource(primary)
            if not source_primary.isValid():
                continue
            path = self._model.filePath(source_primary)
            if path in seen:
                continue
            seen.add(path)
            paths.append(path)
        return paths

    def _select_all(self) -> None:
        view = self._file_views.active_view
        view.selectAll()
        view.setFocus()

    def _copy_selection(self) -> None:
        paths = self._selected_source_paths()
        if not paths:
            self.statusBar().showMessage("No selection to copy")
            return
        self._clipboard_paths = paths
        self._clipboard_mode = "copy"
        self._proxy.set_cut_paths([])
        self.statusBar().showMessage(f"Copied {len(paths)} items")

    def _cut_selection(self) -> None:
        paths = self._selected_source_paths()
        if not paths:
            self.statusBar().showMessage("No selection to cut")
            return
        self._clipboard_paths = paths
        self._clipboard_mode = "cut"
        self._proxy.set_cut_paths(paths)
        self.statusBar().showMessage(f"Cut {len(paths)} items")

    def _paste_into_current(self) -> None:
        if not self._clipboard_paths or not self._clipboard_mode:
            self.statusBar().showMessage("Clipboard empty")
            return
        target_dir = Path(self._current_path)
        if not target_dir.exists():
            self.statusBar().showMessage("No valid destination for paste")
            return
        items = self._build_transfer_items(self._clipboard_paths, target_dir, self._clipboard_mode)
        if not items:
            self.statusBar().showMessage("Nothing to paste")
            return
        dialog = OperationProgressDialog(self)
        worker = TransferWorker(items)

        worker.signals.current.connect(dialog.set_current_file)
        worker.signals.progress.connect(dialog.set_progress)
        worker.signals.meta.connect(dialog.set_meta)
        worker.signals.error.connect(lambda message: show_error(self, "Paste", message))
        worker.signals.finished.connect(dialog.close)
        worker.signals.finished.connect(lambda: self._on_transfer_finished(target_dir))
        dialog.canceled.connect(worker.cancel)
        worker.signals.itemResult.connect(self._log_transfer_item)

        self._active_transfer = worker
        self._active_progress = dialog
        dialog.show()
        QThreadPool.globalInstance().start(worker)

    def _on_transfer_finished(self, target_dir: Path) -> None:
        if self._clipboard_mode == "cut":
            self._clipboard_paths = []
            self._clipboard_mode = None
            self._proxy.set_cut_paths([])
        self._active_transfer = None
        if self._active_progress is not None:
            self._active_progress.close()
            self._active_progress = None
        self._go_to(target_dir)

    def _log_transfer_item(self, source: str, dest: str, mode: str, success: bool, error: str) -> None:
        action = "copy" if mode == "copy" else "move"
        self._op_log.append(action, [source], [dest], success=success, error=error)

    def _log_rename_attempt(self, source: str, dest: str, success: bool, error: str) -> None:
        if not source or not dest:
            return
        self._op_log.append("rename", [source], [dest], success=success, error=error)

    def _build_transfer_items(self, paths: list[str], target_dir: Path, mode: str) -> list[TransferItem]:
        items: list[TransferItem] = []
        apply_action: str | None = None
        for src in paths:
            source_path = Path(src)
            if not source_path.exists():
                continue
            dest = target_dir / source_path.name
            try:
                same_target = source_path.resolve() == dest.resolve()
            except OSError:
                same_target = False
            if same_target:
                if mode == "copy":
                    dest = self._resolve_collision(dest)
                else:
                    continue
            replace = False
            action = apply_action
            if dest.exists():
                if action is None:
                    if self._conflict_default in {"replace", "skip", "rename"}:
                        action = self._conflict_default
                        apply_action = action
                    elif self._confirm_overwrite:
                        dialog = ConflictDialog(source_path.name, self)
                        if dialog.exec() != dialog.Accepted:
                            continue
                        choice = dialog.choice()
                        action = choice.action
                        if choice.apply_to_all:
                            apply_action = action
                    else:
                        action = "replace"
                if action == "skip":
                    continue
                if action == "rename":
                    dest = self._resolve_collision(dest)
                if action == "replace":
                    replace = True
            items.append(
                TransferItem(
                    source=source_path,
                    destination=dest,
                    mode=mode,
                    replace=replace,
                    preserve=self._preserve_metadata,
                )
            )
        return items

    @staticmethod
    def _resolve_collision(path: Path) -> Path:
        if not path.exists():
            return path
        stem = path.stem
        suffix = path.suffix
        counter = 1
        candidate = path
        while candidate.exists():
            candidate = path.with_name(f"{stem} ({counter}){suffix}")
            counter += 1
        return candidate

    @staticmethod
    def _unique_trash_name(base: Path, name: str) -> str:
        candidate = name
        counter = 1
        while (base / candidate).exists():
            candidate = f"{name} {counter}"
            counter += 1
        return candidate

    def _apply_filter(self, text: str) -> None:
        if not text:
            self._proxy.setFilterRegularExpression(QRegularExpression())
            self._update_empty_state()
            return
        escaped = QRegularExpression.escape(text)
        regex = QRegularExpression(escaped, QRegularExpression.CaseInsensitiveOption)
        self._proxy.setFilterRegularExpression(regex)
        self._update_empty_state()

    def _open_quick_filters(self) -> None:
        query = self._search_edit.text().strip()
        local_result = translate_query(query, allow_ai=False)
        result = local_result
        if self._config.get_bool("ai_enabled", False):
            payload = {"query": query, "local": local_result}
            dialog = AIDataPreviewDialog(
                "AI Filter Preview",
                "This data will be sent to the AI provider for filter translation.",
                payload,
                self,
            )
            if dialog.exec() == QDialog.Accepted:
                result = translate_query(query, allow_ai=True)
        dialog = FiltersDialog(
            result.get("query", query),
            result.get("filters", self._quick_filters),
            result.get("notes", []),
            ai_used=result.get("source") == "ai",
            parent=self,
        )
        if dialog.exec() != QDialog.Accepted:
            return
        self._search_edit.setText(dialog.query_text())
        filters = dialog.filters()
        if not filters and dialog.query_text():
            self.statusBar().showMessage("Filter errors; not applied")
            return
        self._quick_filters = filters
        self._proxy.set_filters(self._quick_filters)
        self.statusBar().showMessage(f"Filters ready ({len(self._quick_filters)})")
        self._filters_active_label.setVisible(bool(self._quick_filters))
        self._update_empty_state()

    def _clear_quick_filters(self) -> None:
        self._quick_filters = []
        self._proxy.set_filters(self._quick_filters)
        self._search_edit.clear()
        self.statusBar().showMessage("Filters cleared")
        self._filters_active_label.setVisible(False)
        self._update_empty_state()

    def _focus_search(self) -> None:
        self._search_edit.setFocus()

    def _handle_search_action(self) -> None:
        scope = self._config.get("search_scope", "current")
        self._show_inline_search(scope)

    def _open_folder_summary(self) -> None:
        dialog = FolderSummaryDialog(
            self._current_path,
            include_hidden=self._config.get_bool("search_include_hidden", False),
            parent=self,
        )
        dialog.exec()

    def _build_inline_search(self) -> QWidget:
        panel = QWidget()
        panel.setObjectName("InlineSearchPanel")
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 8)
        layout.setSpacing(6)

        header = QHBoxLayout()
        header.addWidget(QLabel("Search"))
        self._inline_search_scope = QComboBox()
        self._inline_search_scope.addItems(
            ["Current Folder", "This Folder + Subfolders", "System (All Files)"]
        )
        header.addWidget(self._inline_search_scope)
        self._inline_search_query = QLineEdit()
        self._inline_search_query.setPlaceholderText("Type to search…")
        header.addWidget(self._inline_search_query, 1)
        self._inline_search_filters_button = QToolButton()
        self._inline_search_filters_button.setText("Filters")
        header.addWidget(self._inline_search_filters_button)
        self._inline_search_start = QPushButton("Search")
        self._inline_search_cancel = QPushButton("Cancel")
        self._inline_search_close = QPushButton("Close")
        header.addWidget(self._inline_search_start)
        header.addWidget(self._inline_search_cancel)
        header.addWidget(self._inline_search_close)
        layout.addLayout(header)

        self._inline_search_results = QListWidget()
        self._inline_search_results.setContextMenuPolicy(Qt.CustomContextMenu)
        layout.addWidget(self._inline_search_results)

        footer = QHBoxLayout()
        self._inline_search_status = QLabel("Ready")
        self._inline_search_ai = QLabel("AI used")
        self._inline_search_ai.setVisible(False)
        footer.addWidget(self._inline_search_status)
        footer.addStretch(1)
        footer.addWidget(self._inline_search_ai)
        layout.addLayout(footer)

        self._inline_search_cancel.setEnabled(False)
        self._inline_search_start.clicked.connect(self._start_inline_search)
        self._inline_search_cancel.clicked.connect(self._cancel_inline_search)
        self._inline_search_close.clicked.connect(self._close_inline_search)
        self._inline_search_filters_button.clicked.connect(self._open_inline_filters)
        self._inline_search_query.returnPressed.connect(self._start_inline_search)
        self._inline_search_results.itemDoubleClicked.connect(self._open_inline_result)
        self._inline_search_results.customContextMenuRequested.connect(self._inline_search_context_menu)
        return panel

    def _build_working_set_panel(self) -> QWidget:
        panel = QWidget()
        panel.setObjectName("WorkingSetPanel")
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 8)
        layout.setSpacing(6)

        header = QHBoxLayout()
        self._working_set_label = QLabel("Working Set")
        header.addWidget(self._working_set_label)
        self._working_set_indicator = QLabel("Viewing Working Set")
        self._working_set_indicator.setObjectName("WorkingSetIndicator")
        header.addWidget(self._working_set_indicator)
        header.addStretch(1)
        self._working_set_add = QPushButton("Add Files")
        self._working_set_remove = QPushButton("Remove")
        self._working_set_reveal = QPushButton("Reveal")
        self._working_set_close = QPushButton("Close")
        header.addWidget(self._working_set_add)
        header.addWidget(self._working_set_remove)
        header.addWidget(self._working_set_reveal)
        header.addWidget(self._working_set_close)
        layout.addLayout(header)

        self._working_set_list = QListWidget()
        layout.addWidget(self._working_set_list)

        footer = QHBoxLayout()
        self._working_set_status = QLabel("Ready")
        footer.addWidget(self._working_set_status)
        footer.addStretch(1)
        layout.addLayout(footer)

        self._working_set_add.clicked.connect(self._add_files_to_working_set)
        self._working_set_remove.clicked.connect(self._remove_selected_from_working_set)
        self._working_set_reveal.clicked.connect(self._reveal_selected_working_set_item)
        self._working_set_close.clicked.connect(self._close_working_set)
        self._working_set_list.itemDoubleClicked.connect(self._open_working_set_item)
        self._working_set_list.setContextMenuPolicy(Qt.CustomContextMenu)
        self._working_set_list.customContextMenuRequested.connect(self._working_set_context_menu)
        return panel

    def _build_activity_panel(self) -> QWidget:
        panel = QWidget()
        panel.setObjectName("ActivityPanel")
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 8)
        layout.setSpacing(6)

        header = QHBoxLayout()
        title = QLabel("Recent activity")
        title.setObjectName("ActivityTitle")
        header.addWidget(title)
        header.addStretch(1)
        self._activity_refresh = QPushButton("Refresh")
        self._activity_close = QPushButton("Close")
        header.addWidget(self._activity_refresh)
        header.addWidget(self._activity_close)
        layout.addLayout(header)

        filters = QHBoxLayout()
        self._activity_action_filter = QComboBox()
        self._activity_action_filter.addItem("All actions", "all")
        for action in (
            "move",
            "rename",
            "delete",
            "copy",
            "trash",
            "restore",
            "create_file",
            "create_folder",
        ):
            label = action.replace("_", " ").title()
            self._activity_action_filter.addItem(label, action)
        self._activity_time_filter = QComboBox()
        self._activity_time_filter.addItem("Any time", 0)
        self._activity_time_filter.addItem("Last hour", 3600)
        self._activity_time_filter.addItem("Last day", 86400)
        self._activity_time_filter.addItem("Last week", 604800)
        self._activity_time_filter.addItem("Last month", 2592000)
        self._activity_scope_filter = QComboBox()
        self._activity_scope_filter.addItem("All activity", "all")
        self._activity_scope_filter.addItem("Current working set", "working_set")
        self._activity_scope_filter.setEnabled(False)
        self._activity_name_filter = QLineEdit()
        self._activity_name_filter.setPlaceholderText("Filter by name")
        self._activity_name_filter.setClearButtonEnabled(True)
        filters.addWidget(self._activity_action_filter)
        filters.addWidget(self._activity_time_filter)
        filters.addWidget(self._activity_scope_filter)
        filters.addWidget(self._activity_name_filter, 1)
        layout.addLayout(filters)

        self._activity_list = QTreeWidget()
        self._activity_list.setHeaderLabels(["When", "Action", "Item", "Destination", "Status"])
        self._activity_list.setRootIsDecorated(False)
        self._activity_list.setUniformRowHeights(True)
        self._activity_list.setSelectionMode(QAbstractItemView.SingleSelection)
        self._activity_list.setContextMenuPolicy(Qt.CustomContextMenu)
        layout.addWidget(self._activity_list, 1)

        self._activity_status = QLabel("Ready")
        self._activity_status.setObjectName("ActivityStatus")
        layout.addWidget(self._activity_status)

        self._activity_refresh.clicked.connect(self._refresh_activity)
        self._activity_close.clicked.connect(lambda: self._toggle_activity_panel(False))
        self._activity_action_filter.currentIndexChanged.connect(self._refresh_activity)
        self._activity_time_filter.currentIndexChanged.connect(self._refresh_activity)
        self._activity_scope_filter.currentIndexChanged.connect(self._refresh_activity)
        self._activity_name_filter.textChanged.connect(self._refresh_activity)
        self._activity_list.itemDoubleClicked.connect(self._reveal_activity_entry)
        self._activity_list.customContextMenuRequested.connect(self._activity_context_menu)
        return panel

    def _show_inline_search(self, scope: str | None = None) -> None:
        self._inline_search_panel.setVisible(True)
        if scope:
            self._inline_search_scope.setCurrentIndex(self._scope_index(scope))
        self._inline_search_query.setFocus()
        self._set_inline_search_mode(True)

    def _close_inline_search(self) -> None:
        self._cancel_inline_search()
        self._inline_search_panel.setVisible(False)
        self._inline_search_results.clear()
        self._set_inline_search_mode(False)
        self._update_empty_state()

    def _open_working_set(self, set_id: str) -> None:
        work_set = self._working_sets.refresh_set(set_id)
        if work_set is None:
            return
        self._working_set_id = set_id
        self._working_set_label.setText(f"Working Set: {work_set.name}")
        self._working_set_indicator.setVisible(True)
        self._working_set_list.clear()
        missing = 0
        for item in work_set.items:
            text = item.path
            if not item.exists:
                text = f"{item.path} (missing)"
                missing += 1
            entry = QListWidgetItem(text)
            entry.setData(Qt.UserRole, item.path)
            entry.setData(Qt.UserRole + 1, bool(item.exists))
            self._working_set_list.addItem(entry)
        self._working_set_status.setText(
            f"{len(work_set.items)} items, {missing} missing" if work_set.items else "Empty"
        )
        summary = self._working_set_activity_summary([item.path for item in work_set.items])
        if summary:
            self._working_set_status.setText(f"{self._working_set_status.text()} • {summary}")
        self._working_set_panel.setVisible(True)
        self._update_activity_scope_state()

    def _toggle_activity_panel(self, show: bool) -> None:
        self._activity_panel.setVisible(show)
        if self._activity_action.isChecked() != show:
            self._activity_action.blockSignals(True)
            self._activity_action.setChecked(show)
            self._activity_action.blockSignals(False)
        if show:
            self._refresh_activity()

    def _refresh_activity(self) -> None:
        entries = self._op_log.iter_entries()
        action_filter = self._activity_action_filter.currentData()
        name_filter = self._activity_name_filter.text().strip().lower()
        cutoff_seconds = int(self._activity_time_filter.currentData() or 0)
        scope_filter = self._activity_scope_filter.currentData()
        cutoff = None
        if cutoff_seconds:
            cutoff = datetime.utcnow() - timedelta(seconds=cutoff_seconds)

        self._activity_list.clear()
        filtered = 0
        working_set_paths: list[str] = []
        if scope_filter == "working_set":
            working_set_paths = self._current_working_set_paths()
            if not working_set_paths:
                self._activity_status.setText("No working set selected")
                return
        for entry in reversed(entries):
            if working_set_paths and not self._entry_matches_working_set(entry, working_set_paths):
                continue
            action = str(entry.get("action", "")).lower()
            if action_filter and action_filter != "all" and action != action_filter:
                continue
            timestamp_text = str(entry.get("timestamp", "")).strip()
            if cutoff:
                try:
                    timestamp = datetime.fromisoformat(timestamp_text)
                except ValueError:
                    continue
                if timestamp < cutoff:
                    continue
            if name_filter and not self._entry_matches_name(entry, name_filter):
                continue
            item = self._build_activity_item(entry)
            if item is None:
                continue
            self._activity_list.addTopLevelItem(item)
            filtered += 1
        self._activity_status.setText(f"{filtered} entries")
        self._activity_list.resizeColumnToContents(0)
        self._activity_list.resizeColumnToContents(1)
        self._activity_list.resizeColumnToContents(4)

    def _update_activity_scope_state(self) -> None:
        has_working_set = bool(self._working_set_id and self._current_working_set_paths())
        self._activity_scope_filter.setEnabled(has_working_set)
        if not has_working_set and self._activity_scope_filter.currentData() == "working_set":
            self._activity_scope_filter.setCurrentIndex(0)

    def _current_working_set_paths(self) -> list[str]:
        if not self._working_set_id:
            return []
        work_set = self._working_sets.get_set(self._working_set_id)
        if work_set is None:
            return []
        return [item.path for item in work_set.items if item.path]

    def _entry_matches_working_set(self, entry: dict, paths: list[str]) -> bool:
        if not paths:
            return False
        normalized = [os.path.normpath(path) for path in paths if path]
        entry_paths = entry.get("sources", []) + entry.get("destinations", [])
        for path in entry_paths:
            if not path:
                continue
            entry_norm = os.path.normpath(path)
            for anchor in normalized:
                if not anchor:
                    continue
                if anchor == os.sep:
                    return True
                if entry_norm == anchor or entry_norm.startswith(anchor + os.sep):
                    return True
        return False

    def _working_set_activity_summary(self, paths: list[str]) -> str:
        if not paths:
            return ""
        cutoff = datetime.utcnow() - timedelta(days=7)
        entries = self._op_log.iter_entries()
        count = 0
        latest: datetime | None = None
        for entry in entries:
            if not self._entry_matches_working_set(entry, paths):
                continue
            timestamp_text = str(entry.get("timestamp", "")).strip()
            try:
                timestamp = datetime.fromisoformat(timestamp_text)
            except ValueError:
                continue
            if timestamp < cutoff:
                continue
            count += 1
            if latest is None or timestamp > latest:
                latest = timestamp
        if count == 0:
            return "No recent activity"
        if latest is None:
            return f"{count} recent actions"
        return f"{count} recent actions (last {self._format_relative_time(latest)} ago)"

    @staticmethod
    def _format_relative_time(timestamp: datetime) -> str:
        delta = max((datetime.utcnow() - timestamp).total_seconds(), 0.0)
        if delta < 60:
            return "moments"
        if delta < 3600:
            minutes = int(delta // 60)
            return f"{minutes}m"
        if delta < 86400:
            hours = int(delta // 3600)
            return f"{hours}h"
        days = int(delta // 86400)
        return f"{days}d"
    def _entry_matches_name(self, entry: dict, fragment: str) -> bool:
        for path in entry.get("sources", []) + entry.get("destinations", []):
            name = Path(path).name.lower()
            if fragment in name:
                return True
        return False

    def _build_activity_item(self, entry: dict) -> QTreeWidgetItem | None:
        timestamp_text = str(entry.get("timestamp", "")).strip()
        try:
            timestamp = datetime.fromisoformat(timestamp_text)
            when_label = timestamp.strftime("%Y-%m-%d %H:%M")
        except ValueError:
            when_label = timestamp_text or "Unknown"
        action = str(entry.get("action", "")).replace("_", " ").title()
        sources = entry.get("sources", [])
        destinations = entry.get("destinations", [])
        source_label = self._summarize_paths(sources)
        dest_label = self._summarize_paths(destinations)
        success = bool(entry.get("success", True))
        status = "OK" if success else "Failed"
        item = QTreeWidgetItem([when_label, action, source_label, dest_label, status])
        item.setData(0, Qt.UserRole, entry)
        if sources:
            item.setToolTip(2, "\n".join(sources))
        if destinations:
            item.setToolTip(3, "\n".join(destinations))
        if not success and entry.get("error"):
            item.setToolTip(4, str(entry.get("error")))
        return item

    @staticmethod
    def _summarize_paths(paths: list[str]) -> str:
        if not paths:
            return ""
        first = Path(paths[0]).name
        if len(paths) == 1:
            return first
        return f"{first} (+{len(paths) - 1})"

    def _activity_context_menu(self, position) -> None:
        item = self._activity_list.itemAt(position)
        if item is None:
            return
        menu = QMenu(self)
        reveal_action = menu.addAction("Reveal in Folder")
        reveal_action.triggered.connect(lambda: self._reveal_activity_entry(item))
        working_sets_menu = menu.addMenu("Working Sets")
        self._populate_activity_working_sets_menu(working_sets_menu, item)
        menu.exec(self._activity_list.viewport().mapToGlobal(position))

    def _populate_activity_working_sets_menu(self, menu: QMenu, item: QTreeWidgetItem) -> None:
        entry = item.data(0, Qt.UserRole) or {}
        candidates: list[str] = []
        for path in entry.get("destinations", []) + entry.get("sources", []):
            if path and path not in candidates:
                candidates.append(path)
        related = self._working_sets_for_paths(candidates)
        menu.clear()
        if not related:
            empty = menu.addAction("No matching working sets")
            empty.setEnabled(False)
            return
        target = candidates[0] if candidates else ""
        for set_id, name in related:
            action = menu.addAction(f"Open {name}")
            action.triggered.connect(
                lambda _, sid=set_id, path=target: self._open_working_set_from_activity(sid, path)
            )

    def _working_sets_for_paths(self, paths: list[str]) -> list[tuple[str, str]]:
        if not paths:
            return []
        normalized = {os.path.normpath(path) for path in paths if path}
        related: list[tuple[str, str]] = []
        for work_set in self._working_sets.list_sets():
            for item in work_set.items:
                if os.path.normpath(item.path) in normalized:
                    related.append((work_set.id, work_set.name))
                    break
        return related

    def _open_working_set_from_activity(self, set_id: str, path: str) -> None:
        self._open_working_set(set_id)
        if path:
            self._select_working_set_item(path)

    def _select_working_set_item(self, path: str) -> None:
        if not path:
            return
        for i in range(self._working_set_list.count()):
            item = self._working_set_list.item(i)
            if item is None:
                continue
            item_path = item.data(Qt.UserRole)
            if not item_path:
                continue
            if os.path.normpath(str(item_path)) == os.path.normpath(path):
                self._working_set_list.setCurrentItem(item)
                self._working_set_list.scrollToItem(item)
                return

    def _reveal_activity_entry(self, item: QTreeWidgetItem | None = None) -> None:
        if item is None:
            item = self._activity_list.currentItem()
        if item is None:
            return
        entry = item.data(0, Qt.UserRole) or {}
        target = self._resolve_activity_target(entry)
        if not target:
            show_error(self, "Recent Activity", "No path available.")
            return
        target_path = Path(target)
        if target_path.is_dir():
            self._go_to(target_path)
            return
        parent = target_path.parent
        if parent.exists():
            self._go_to(parent)
            if target_path.exists():
                self._select_path(str(target_path))

    @staticmethod
    def _resolve_activity_target(entry: dict) -> str:
        destinations = entry.get("destinations", []) if entry.get("success", True) else []
        candidates = destinations + entry.get("sources", [])
        for path in candidates:
            if Path(path).exists():
                return path
        if destinations:
            return destinations[0]
        sources = entry.get("sources", [])
        if sources:
            return sources[0]
        return ""
        self._inline_search_panel.setVisible(False)
        self._file_views.setVisible(False)
        self._empty_wrapper.setVisible(False)

    def _close_working_set(self) -> None:
        self._working_set_panel.setVisible(False)
        self._working_set_id = None
        self._working_set_indicator.setVisible(False)
        self._update_activity_scope_state()
        self._file_views.setVisible(True)
        self._update_empty_state()

    def _add_files_to_working_set(self) -> None:
        if not self._working_set_id:
            return
        paths, _ = QFileDialog.getOpenFileNames(self, "Add Files", self._current_path)
        if not paths:
            return
        self._working_sets.add_items(self._working_set_id, paths)
        self._open_working_set(self._working_set_id)

    def _remove_selected_from_working_set(self) -> None:
        if not self._working_set_id:
            return
        selected = self._working_set_list.selectedItems()
        if not selected:
            return
        paths = [item.data(Qt.UserRole) for item in selected]
        self._working_sets.remove_items(self._working_set_id, paths)
        self._open_working_set(self._working_set_id)

    def _reveal_selected_working_set_item(self) -> None:
        item = self._working_set_list.currentItem()
        if item is None:
            return
        path = item.data(Qt.UserRole)
        if not path:
            return
        target = Path(path)
        if not target.exists():
            show_error(self, "Working Set", "File not found.")
            return
        self._go_to(target.parent)
        self._select_path(str(target))

    def _open_working_set_item(self) -> None:
        item = self._working_set_list.currentItem()
        if item is None:
            return
        path, exists = self._working_set_item_info(item)
        if not path or not exists:
            return
        target = Path(path)
        if target.is_dir():
            self._go_to(target)
            return
        self._open_path(str(target))

    def _working_set_context_menu(self, position) -> None:
        item = self._working_set_list.itemAt(position)
        if item is None:
            return
        self._working_set_list.setCurrentItem(item)
        path, exists = self._working_set_item_info(item)
        if not path:
            return
        menu = QMenu(self)
        open_action = menu.addAction("Open")
        open_window_action = menu.addAction("Open in New Window")
        reveal_action = menu.addAction("Reveal in Folder")
        copy_action = menu.addAction("Copy Path")
        properties_action = menu.addAction("Properties")
        menu.addSeparator()
        remove_action = menu.addAction("Remove from Working Set")
        open_action.triggered.connect(self._open_working_set_item)
        open_window_action.triggered.connect(self._open_working_set_in_new_window)
        reveal_action.triggered.connect(self._reveal_selected_working_set_item)
        copy_action.triggered.connect(self._copy_working_set_item_path)
        properties_action.triggered.connect(self._show_working_set_item_properties)
        remove_action.triggered.connect(self._remove_selected_from_working_set)
        open_action.setEnabled(exists)
        open_window_action.setEnabled(exists)
        reveal_action.setEnabled(exists)
        properties_action.setEnabled(exists)
        menu.exec(self._working_set_list.viewport().mapToGlobal(position))

    def _working_set_item_info(self, item: QListWidgetItem) -> tuple[str, bool]:
        path = item.data(Qt.UserRole)
        exists = bool(item.data(Qt.UserRole + 1))
        return str(path) if path else "", exists

    def _open_working_set_in_new_window(self) -> None:
        item = self._working_set_list.currentItem()
        if item is None:
            return
        path, exists = self._working_set_item_info(item)
        if not path or not exists:
            return
        target = Path(path)
        open_path = str(target) if target.is_dir() else str(target.parent)
        if not self._open_path_in_new_window(open_path):
            show_error(self, "Open in New Window", "Failed to open a new window.")

    def _copy_working_set_item_path(self) -> None:
        item = self._working_set_list.currentItem()
        if item is None:
            return
        path, _ = self._working_set_item_info(item)
        if not path:
            return
        QApplication.clipboard().setText(path)
        self.statusBar().showMessage("Path copied")

    def _show_working_set_item_properties(self) -> None:
        item = self._working_set_list.currentItem()
        if item is None:
            return
        path, exists = self._working_set_item_info(item)
        if not path or not exists:
            return
        self._show_path_properties(path)

    def _rename_working_set(self, set_id: str) -> None:
        work_set = self._working_sets.get_set(set_id)
        if work_set is None:
            return
        name, ok = QInputDialog.getText(self, "Rename Working Set", "Name:", text=work_set.name)
        if ok and name.strip():
            self._working_sets.rename_set(set_id, name.strip())
            self._places.set_working_sets(self._serialize_working_sets())
            if self._working_set_id == set_id:
                self._open_working_set(set_id)

    def _delete_working_set(self, set_id: str) -> None:
        work_set = self._working_sets.get_set(set_id)
        if work_set is None:
            return
        reply = QMessageBox.warning(
            self,
            "Delete Working Set",
            f"Delete '{work_set.name}'?",
            QMessageBox.Yes | QMessageBox.No,
        )
        if reply != QMessageBox.Yes:
            return
        self._working_sets.delete_set(set_id)
        self._places.set_working_sets(self._serialize_working_sets())
        if self._working_set_id == set_id:
            self._close_working_set()

    def _serialize_working_sets(self) -> list[dict]:
        return [{"id": item.id, "name": item.name} for item in self._working_sets.list_sets()]

    def _set_inline_search_mode(self, enabled: bool) -> None:
        self._file_views.setVisible(not enabled)
        self._empty_state.setVisible(False)

    def _start_inline_search(self) -> None:
        query = self._inline_search_query.text().strip()
        if (not query and not self._inline_search_filters) or self._inline_search_worker is not None:
            return
        self._inline_search_results.clear()
        self._inline_search_status.setText("Searching...")
        self._inline_search_start.setEnabled(False)
        self._inline_search_cancel.setEnabled(True)

        root, recursive, label = self._resolve_inline_scope()
        self._inline_search_status.setText(f"Searching ({label})...")
        self._config.set("search_scope", "recursive" if recursive else "current")
        if label.startswith("System"):
            self._config.set("search_scope", "system")
        self._config.save()

        worker = SearchWorker(
            root,
            query,
            self._config.get_bool("search_include_hidden", self._hidden_action.isChecked()),
            self._config.get_bool("search_case_sensitive", False),
            recursive=recursive,
            filters=self._inline_search_filters,
        )
        worker.signals.found.connect(self._inline_search_results.addItem)
        worker.signals.progress.connect(
            lambda count: self._inline_search_status.setText(f"Scanned {count} items")
        )
        worker.signals.error.connect(lambda message: self._inline_search_status.setText(message))
        worker.signals.finished.connect(self._finish_inline_search)
        self._inline_search_worker = worker
        QThreadPool.globalInstance().start(worker)

    def _finish_inline_search(self) -> None:
        self._inline_search_worker = None
        self._inline_search_status.setText(f"{self._inline_search_results.count()} results")
        self._inline_search_start.setEnabled(True)
        self._inline_search_cancel.setEnabled(False)

    def _cancel_inline_search(self) -> None:
        if self._inline_search_worker is None:
            return
        self._inline_search_worker.cancel()
        self._inline_search_status.setText("Canceled")
        self._inline_search_start.setEnabled(True)
        self._inline_search_cancel.setEnabled(False)
        self._inline_search_worker = None

    def _open_inline_result(self) -> None:
        item = self._inline_search_results.currentItem()
        if item is None:
            return
        path = item.text()
        target = Path(path)
        if target.is_dir():
            self._go_to(target)
            return
        self._open_path(path)

    def _inline_search_context_menu(self, position) -> None:
        item = self._inline_search_results.itemAt(position)
        if item is None:
            return
        menu = QMenu(self)
        reveal_action = menu.addAction("Reveal in Folder")
        reveal_action.triggered.connect(self._reveal_inline_result)
        add_menu = menu.addMenu("Add to Working Set")
        self._populate_working_set_menu_for_paths(add_menu, [item.text()])
        menu.exec(self._inline_search_results.viewport().mapToGlobal(position))

    def _reveal_inline_result(self) -> None:
        item = self._inline_search_results.currentItem()
        if item is None:
            return
        path = item.text()
        if not path:
            return
        target = Path(path)
        if target.is_dir():
            self._go_to(target)
            return
        parent = target.parent
        if parent.exists():
            self._go_to(parent)
            if target.exists():
                self._select_path(str(target))

    def _open_inline_filters(self) -> None:
        query = self._inline_search_query.text().strip()
        local_result = translate_query(query, allow_ai=False)
        result = local_result
        if self._config.get_bool("ai_enabled", False):
            payload = {"query": query, "local": local_result}
            dialog = AIDataPreviewDialog(
                "AI Filter Preview",
                "This data will be sent to the AI provider for filter translation.",
                payload,
                self,
            )
            if dialog.exec() == QDialog.Accepted:
                result = translate_query(query, allow_ai=True)
        dialog = FiltersDialog(
            result.get("query", query),
            result.get("filters", []),
            result.get("notes", []),
            ai_used=result.get("source") == "ai",
            parent=self,
        )
        if dialog.exec() == QDialog.Accepted:
            self._inline_search_query.setText(dialog.query_text())
            filters = dialog.filters()
            if not filters and dialog.query_text():
                self._inline_search_status.setText("Filter errors; not applied")
                return
            self._inline_search_filters = filters
            self._inline_search_status.setText(f"Filters ready ({len(self._inline_search_filters)})")
            self._inline_search_ai.setVisible(result.get("source") == "ai")

    def _populate_working_set_menu(self, menu: QMenu) -> None:
        menu.clear()
        sets = self._working_sets.list_sets()
        if not sets:
            create_action = menu.addAction("Create Working Set…")
            create_action.triggered.connect(self._create_working_set)
            return
        for item in sets:
            action = menu.addAction(f"Add to {item.name}")
            action.triggered.connect(lambda _, set_id=item.id: self._add_selection_to_working_set(set_id))
        menu.addSeparator()
        create_action = menu.addAction("Create Working Set…")
        create_action.triggered.connect(self._create_working_set)

    def _populate_working_set_menu_for_paths(self, menu: QMenu, paths: list[str]) -> None:
        menu.clear()
        sets = self._working_sets.list_sets()
        if not sets:
            create_action = menu.addAction("Create Working Set…")
            create_action.triggered.connect(lambda: self._create_working_set_from_paths(paths))
            return
        for item in sets:
            action = menu.addAction(f"Add to {item.name}")
            action.triggered.connect(
                lambda _, set_id=item.id, items=list(paths): self._add_paths_to_working_set(set_id, items)
            )
        menu.addSeparator()
        create_action = menu.addAction("Create Working Set…")
        create_action.triggered.connect(lambda: self._create_working_set_from_paths(paths))

    def _create_working_set(self) -> None:
        name, ok = QInputDialog.getText(self, "New Working Set", "Name:")
        if not ok or not name.strip():
            return
        new_set = self._working_sets.create_set(name.strip())
        self._places.set_working_sets(self._serialize_working_sets())
        self._add_selection_to_working_set(new_set.id)

    def _create_working_set_from_paths(self, paths: list[str]) -> None:
        name, ok = QInputDialog.getText(self, "New Working Set", "Name:")
        if not ok or not name.strip():
            return
        new_set = self._working_sets.create_set(name.strip())
        self._places.set_working_sets(self._serialize_working_sets())
        self._add_paths_to_working_set(new_set.id, paths)

    def _add_selection_to_working_set(self, set_id: str) -> None:
        paths = self._selected_source_paths()
        if not paths:
            return
        self._working_sets.add_items(set_id, paths)
        self._places.set_working_sets(self._serialize_working_sets())

    def _add_paths_to_working_set(self, set_id: str, paths: list[str]) -> None:
        if not paths:
            return
        self._working_sets.add_items(set_id, paths)
        self._places.set_working_sets(self._serialize_working_sets())
        if self._working_set_id == set_id:
            self._open_working_set(set_id)

    def _scope_index(self, scope: str) -> int:
        scope = (scope or "").lower()
        if scope == "recursive":
            return 1
        if scope == "system":
            return 2
        return 0

    def _resolve_inline_scope(self) -> tuple[Path, bool, str]:
        index = self._inline_search_scope.currentIndex()
        if index == 1:
            return Path(self._current_path), True, "This Folder + Subfolders"
        if index == 2:
            return Path("/"), True, "System (All Files)"
        return Path(self._current_path), False, "Current Folder"

    def _open_folder_summary_index(self, index) -> None:
        source_index = self._proxy.mapToSource(index)
        if not source_index.isValid():
            return
        if not self._model.isDir(source_index):
            return
        path = self._model.filePath(source_index)
        dialog = FolderSummaryDialog(
            path,
            include_hidden=self._config.get_bool("search_include_hidden", False),
            parent=self,
        )
        dialog.exec()

    def _open_ai_rename(self, index) -> None:
        paths = self._selected_source_paths()
        if not paths:
            source_index = self._proxy.mapToSource(index)
            if not source_index.isValid():
                return
            path = self._model.filePath(source_index)
            paths = [path]
        dialog = RenameSuggestionsDialog(paths, self._apply_rename_suggestions, self)
        dialog.exec()

    def _apply_rename_suggestions(self, renames: list[tuple[str, str]]) -> None:
        renamed = 0
        for src, new_name in renames:
            if not src or not new_name:
                continue
            source_path = Path(src)
            if not source_path.exists():
                continue
            if os.sep in new_name or (os.altsep and os.altsep in new_name):
                show_error(self, "Rename Suggestions", f"Invalid name: {new_name}")
                continue
            target = source_path.with_name(new_name)
            if target == source_path:
                continue
            if target.exists():
                show_error(self, "Rename Suggestions", f"Target exists: {new_name}")
                continue
            try:
                source_path.rename(target)
                self._op_log.append("rename", [str(source_path)], [str(target)], success=True)
                renamed += 1
            except OSError as exc:
                self._op_log.append("rename", [str(source_path)], [str(target)], success=False, error=str(exc))
                show_error(self, "Rename Suggestions", str(exc))
        if renamed:
            self.statusBar().showMessage(f"Renamed {renamed} items")
            self._go_to(Path(self._current_path))

    def _open_image_generation(self, index=None, mode: str = "new") -> None:
        if not self._config.get_bool("ai_enabled", False):
            show_error(self, "Generate Image", "Enable AI features to use image generation.")
            return
        folder = self._current_path
        reference = None
        if not isinstance(index, QModelIndex):
            index = None
        if index is not None:
            source_index = self._proxy.mapToSource(index)
            if source_index.isValid() and self._model.isDir(source_index):
                folder = self._model.filePath(source_index)
            elif source_index.isValid():
                reference = self._model.filePath(source_index)
        dialog = ImageGenerationDialog(folder, reference=reference, mode=mode, parent=self)
        if dialog.exec() != QDialog.Accepted:
            return
        payload = dialog.payload()
        payload["mode"] = mode
        if mode in {"variation", "edit"} and not payload.get("reference"):
            show_error(self, "Generate Image", "A reference image is required for this action.")
            return
        preview = AIDataPreviewDialog(
            "AI Image Generation Preview",
            "This data will be sent to the AI provider to generate an image.",
            payload,
            self,
        )
        if preview.exec() != QDialog.Accepted:
            return
        progress = OperationProgressDialog(self)
        progress.setWindowTitle("Image Generation")
        progress.set_current_file("Generating image")
        progress.set_progress(0)
        progress.set_meta("Starting...")

        worker = ImageGenerationWorker(mode=mode, payload=payload)
        worker.signals.current.connect(progress.set_current_file)
        worker.signals.progress.connect(progress.set_progress)
        worker.signals.meta.connect(progress.set_meta)
        worker.signals.error.connect(lambda message: show_error(self, "Generate Image", message))
        worker.signals.finished.connect(self._on_image_generation_finished)
        worker.signals.finished.connect(progress.close)
        progress.canceled.connect(worker.cancel)

        self._active_image_worker = worker
        self._active_image_progress = progress
        progress.show()
        QThreadPool.globalInstance().start(worker)

    def _is_image_index(self, source_index) -> bool:
        if not source_index.isValid() or self._model.isDir(source_index):
            return False
        path = self._model.filePath(source_index)
        suffix = Path(path).suffix.lower()
        return suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}

    def _on_image_generation_finished(self, output_path: str) -> None:
        self._active_image_worker = None
        if self._active_image_progress is not None:
            self._active_image_progress.close()
            self._active_image_progress = None
        if not output_path:
            return
        output = Path(output_path)
        if output.exists():
            self.statusBar().showMessage(f"Created {output.name}")
            self._go_to(output.parent)
            QTimer.singleShot(0, lambda: self._select_path(str(output)))

    def _select_path(self, path: str) -> None:
        source_index = self._model.index(path)
        if not source_index.isValid():
            return
        proxy_index = self._proxy.mapFromSource(source_index)
        if not proxy_index.isValid():
            return
        view = self._file_views.active_view
        selection = view.selectionModel()
        if selection is not None:
            selection.clear()
            selection.select(proxy_index, QItemSelectionModel.ClearAndSelect)
        view.setCurrentIndex(proxy_index)
        view.scrollTo(proxy_index)

    def _open_settings(self) -> None:
        dialog = SettingsDialog(self)
        dialog.settingsChanged.connect(self._apply_settings)
        dialog.exec()

    def _apply_settings(self) -> None:
        self._confirm_delete = self._config.get_bool("confirm_delete", True)
        self._confirm_overwrite = self._config.get_bool("confirm_overwrite", True)
        self._single_click_open = self._config.get_bool("single_click_open", False)
        self._open_folders_new_window = self._config.get_bool("open_folders_new_window", False)
        self._open_default_app = self._config.get_bool("open_default_app", True)
        self._delete_behavior = str(self._config.get("delete_behavior", "trash")).lower()
        self._conflict_default = str(self._config.get("conflict_default", "ask")).lower()
        self._preserve_metadata = self._config.get_bool("preserve_metadata", True)
        self._secure_delete_warning = self._config.get_bool("secure_delete_warning", True)
        self._track_recent = self._config.get_bool("track_recent", False)
        self._warn_executables = self._config.get_bool("warn_executables", True)
        self._hidden_action.setChecked(self._config.get_bool("show_hidden", False))
        self._breadcrumb_bar.setVisible(self._config.get_bool("show_breadcrumbs", True))
        self._file_views.set_view_mode(self._config.get_str("view_mode", "list"))
        self._view_toggle.setChecked(self._config.get_str("view_mode", "list") == "icon")
        self._sort_column = int(self._config.get("sort_column", 0))
        self._sort_order = (
            Qt.DescendingOrder
            if self._config.get("sort_order", "asc") == "desc"
            else Qt.AscendingOrder
        )
        self._apply_sort()
        list_icon_size = int(self._config.get("list_icon_size", 20))
        grid_icon_size = int(self._config.get("grid_icon_size", 64))
        self._file_views.set_icon_sizes(list_icon_size, grid_icon_size)
        row_padding = int(self._config.get("row_padding", 6))
        grid_spacing = int(self._config.get("grid_spacing", 12))
        self._file_views.set_spacing(row_padding, grid_spacing)
        self._proxy.set_folders_first_mode(self._config.get_str("sort_folders_first", "auto"))
        self._apply_style()
        self._apply_thumbnail_mode()
        self._apply_title_bar()
        self._places.set_working_sets(self._serialize_working_sets())

    def _toggle_hidden(self, enabled: bool) -> None:
        flags = QDir.AllEntries | QDir.NoDotAndDotDot
        if enabled:
            flags |= QDir.Hidden
        self._model.setFilter(flags)
        self._config.set("show_hidden", enabled)
        self._update_empty_state()

    def _apply_thumbnail_mode(self) -> None:
        mode = str(self._config.get("thumbnail_mode", "minimal")).lower()
        if mode == "off":
            list_size, grid_size = 16, 48
            self._model.setIconProvider(self._default_icon_provider)
        elif mode == "full":
            list_size, grid_size = 24, 96
            self._model.setIconProvider(ThumbnailIconProvider())
        else:
            list_size, grid_size = 20, 64
            self._model.setIconProvider(ThumbnailIconProvider())
        self._file_views.set_icon_sizes(list_size, grid_size)

    def _restore_window_state(self) -> None:
        if not self._config.get_bool("remember_window", True):
            return
        encoded = self._config.get("window_geometry")
        if not encoded:
            return
        try:
            geometry = QByteArray.fromBase64(encoded.encode("ascii"))
        except Exception:
            return
        self.restoreGeometry(geometry)

    def _set_sort_column(self, column: int) -> None:
        self._sort_column = column
        self._config.set("sort_column", column)
        self._apply_sort()

    def _set_sort_order(self, order: Qt.SortOrder) -> None:
        self._sort_order = order
        self._config.set("sort_order", "desc" if order == Qt.DescendingOrder else "asc")
        self._apply_sort()

    def _apply_sort(self) -> None:
        self._file_views.apply_sort(self._sort_column, self._sort_order)

    def _apply_title_bar(self) -> None:
        use_custom = self._config.get_bool("custom_titlebar", False)
        self.setWindowFlag(Qt.FramelessWindowHint, use_custom)
        if use_custom:
            self.setMenuWidget(self._title_bar)
        else:
            self.setMenuWidget(None)
        self.show()

    def _on_sort_indicator_changed(self, column: int, order: Qt.SortOrder) -> None:
        if column != self._sort_column:
            self._sort_column = column
            self._config.set("sort_column", column)
        if order != self._sort_order:
            self._sort_order = order
            self._config.set("sort_order", "desc" if order == Qt.DescendingOrder else "asc")
        self._config.save()

    def _format_bytes(self, value: int) -> str:
        units = ["B", "KB", "MB", "GB", "TB"]
        preferred = str(self._config.get("size_units", "auto")).upper()
        size = float(value)
        for unit in units:
            if preferred != "AUTO" and unit != preferred:
                size /= 1024
                continue
            if size < 1024 or unit == units[-1] or preferred != "AUTO":
                return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} {unit}"
            size /= 1024
