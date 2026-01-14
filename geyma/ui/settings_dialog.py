from __future__ import annotations

from pathlib import Path
import platform
from shutil import which

from PySide6.QtCore import QObject, QProcess, QRunnable, Signal, QThreadPool
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QTabWidget,
    QVBoxLayout,
)

from geyma.ai.connection_test import test_connection
import logging

from geyma.ai.keystore import KeyStoreError, get_api_key_info, set_api_key
from geyma.ai.provider_registry import available_providers
from geyma.ui.ai_disclosure_dialog import AIDisclosureDialog
from geyma.ui.bookmarks_dialog import BookmarksDialog
from geyma.ui.dialog_utils import apply_dialog_titlebar
from geyma.utils.config import ConfigStore


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

        self._tabs = QTabWidget()
        self._tabs.addTab(self._build_general_tab(), "General")
        self._tabs.addTab(self._build_display_tab(), "Display")
        self._tabs.addTab(self._build_sidebar_tab(), "Sidebar")
        self._tabs.addTab(self._build_navigation_tab(), "Navigation")
        self._tabs.addTab(self._build_file_ops_tab(), "File Operations")
        self._tabs.addTab(self._build_search_tab(), "Search")
        self._tabs.addTab(self._build_privacy_tab(), "Privacy & Security")
        self._tabs.addTab(self._build_performance_tab(), "Performance")
        self._tabs.addTab(self._build_integrations_tab(), "Integrations")
        self._tabs.addTab(self._build_ai_tab(), "AI")
        self._tabs.addTab(self._build_advanced_tab(), "Advanced")

        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Close)
        buttons.accepted.connect(self._apply)
        buttons.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addWidget(self._tabs)
        layout.addWidget(buttons)
        apply_dialog_titlebar(self)

    def _build_general_tab(self):
        widget = QGroupBox("Startup")
        form = QFormLayout(widget)

        self._startup_mode = QComboBox()
        self._startup_mode.addItems(["last", "home", "custom"])
        self._startup_mode.setCurrentText(self._config.get_str("startup_mode", "last"))

        self._startup_path = QLineEdit(self._config.get_str("startup_path", ""))
        browse = QPushButton("Browse")
        browse.clicked.connect(self._browse_startup_path)
        startup_row = QHBoxLayout()
        startup_row.addWidget(self._startup_path)
        startup_row.addWidget(browse)

        self._restore_windows = QCheckBox("Restore tabs/windows on launch")
        self._restore_windows.setChecked(self._config.get_bool("restore_windows", False))

        self._remember_window = QCheckBox("Remember window size/position")
        self._remember_window.setChecked(self._config.get_bool("remember_window", True))

        form.addRow("Startup folder", self._startup_mode)
        form.addRow("Custom path", startup_row)
        form.addRow(self._restore_windows)
        form.addRow(self._remember_window)
        return widget

    def _build_display_tab(self):
        widget = QGroupBox("Display")
        form = QFormLayout(widget)

        self._show_hidden = QCheckBox("Show hidden files by default")
        self._show_hidden.setChecked(self._config.get_bool("show_hidden", False))

        self._list_icon_size = QSpinBox()
        self._list_icon_size.setRange(12, 64)
        self._list_icon_size.setValue(int(self._config.get("list_icon_size", 20)))

        self._grid_icon_size = QSpinBox()
        self._grid_icon_size.setRange(32, 256)
        self._grid_icon_size.setValue(int(self._config.get("grid_icon_size", 64)))

        self._row_padding = QSpinBox()
        self._row_padding.setRange(0, 20)
        self._row_padding.setValue(int(self._config.get("row_padding", 6)))

        self._grid_spacing = QSpinBox()
        self._grid_spacing.setRange(0, 40)
        self._grid_spacing.setValue(int(self._config.get("grid_spacing", 12)))

        self._thumbnail_mode = QComboBox()
        self._thumbnail_mode.addItems(["off", "minimal", "full"])
        self._thumbnail_mode.setCurrentText(self._config.get_str("thumbnail_mode", "minimal"))

        self._thumbnail_max_bytes = QSpinBox()
        self._thumbnail_max_bytes.setRange(1, 1024)
        self._thumbnail_max_bytes.setValue(int(int(self._config.get("thumbnail_max_bytes", 10 * 1024 * 1024)) / (1024 * 1024)))
        self._thumbnail_max_bytes.setSuffix(" MB")

        self._size_units = QComboBox()
        self._size_units.addItems(["auto", "B", "KB", "MB", "GB", "TB"])
        self._size_units.setCurrentText(self._config.get_str("size_units", "auto"))

        self._date_format = QLineEdit(self._config.get_str("date_format", "locale"))

        self._folders_first_mode = QComboBox()
        self._folders_first_mode.addItem("Auto (like Windows Explorer)", "auto")
        self._folders_first_mode.addItem("Always keep folders first", "always")
        self._folders_first_mode.addItem("Mix folders and files", "never")
        current_mode = self._config.get_str("sort_folders_first", "auto")
        index = self._folders_first_mode.findData(current_mode)
        if index >= 0:
            self._folders_first_mode.setCurrentIndex(index)

        self._show_breadcrumbs = QCheckBox("Show breadcrumbs")
        self._show_breadcrumbs.setChecked(self._config.get_bool("show_breadcrumbs", True))

        self._status_details = QCheckBox("Show status bar selection details")
        self._status_details.setChecked(self._config.get_bool("status_bar_details", True))

        form.addRow(self._show_hidden)
        form.addRow("List icon size", self._list_icon_size)
        form.addRow("Grid icon size", self._grid_icon_size)
        form.addRow("Row padding", self._row_padding)
        form.addRow("Grid spacing", self._grid_spacing)
        form.addRow("Thumbnail mode", self._thumbnail_mode)
        form.addRow("Max thumbnail size", self._thumbnail_max_bytes)
        form.addRow("File size units", self._size_units)
        form.addRow("Date format", self._date_format)
        form.addRow("Folder sorting", self._folders_first_mode)
        form.addRow(self._show_breadcrumbs)
        form.addRow(self._status_details)
        return widget

    def _build_sidebar_tab(self):
        widget = QGroupBox("Sidebar")
        layout = QVBoxLayout(widget)

        self._show_places = QCheckBox("Show Places section")
        self._show_places.setChecked(self._config.get_bool("sidebar_show_places", True))
        self._show_devices = QCheckBox("Show Devices section")
        self._show_devices.setChecked(self._config.get_bool("sidebar_show_devices", True))
        self._show_trash = QCheckBox("Show Trash")
        self._show_trash.setChecked(self._config.get_bool("sidebar_show_trash", True))
        self._show_network = QCheckBox("Show mounted network locations")
        self._show_network.setChecked(self._config.get_bool("sidebar_show_network", True))

        edit_bookmarks = QPushButton("Edit Bookmarks")
        edit_bookmarks.clicked.connect(self._edit_bookmarks)

        layout.addWidget(self._show_places)
        layout.addWidget(self._show_devices)
        layout.addWidget(self._show_trash)
        layout.addWidget(self._show_network)
        layout.addWidget(edit_bookmarks)
        layout.addStretch(1)
        return widget

    def _build_navigation_tab(self):
        widget = QGroupBox("Navigation")
        layout = QVBoxLayout(widget)

        self._default_view = QComboBox()
        self._default_view.addItems(["list", "icon"])
        self._default_view.setCurrentText(self._config.get_str("view_mode", "list"))

        self._sort_column = QComboBox()
        self._sort_column.addItems(["Name", "Size", "Type", "Modified"])
        self._sort_column.setCurrentIndex(int(self._config.get("sort_column", 0)))

        self._sort_order = QComboBox()
        self._sort_order.addItems(["asc", "desc"])
        self._sort_order.setCurrentText(self._config.get_str("sort_order", "asc"))

        self._single_click = QCheckBox("Single-click to open")
        self._single_click.setChecked(self._config.get_bool("single_click_open", False))

        self._open_folders_new_window = QCheckBox("Open folders in new window/tab")
        self._open_folders_new_window.setChecked(self._config.get_bool("open_folders_new_window", False))

        self._open_default_app = QCheckBox("Open files in default app")
        self._open_default_app.setChecked(self._config.get_bool("open_default_app", True))

        self._open_with_last = QCheckBox("Enable open with last-used app")
        self._open_with_last.setChecked(self._config.get_bool("enable_open_with_last", True))

        self._middle_click_tab = QCheckBox("Middle-click opens new tab (not implemented)")
        self._middle_click_tab.setChecked(self._config.get_bool("middle_click_tab", False))
        self._middle_click_tab.setEnabled(False)

        layout.addWidget(QLabel("Default view"))
        layout.addWidget(self._default_view)
        layout.addWidget(QLabel("Default sort column"))
        layout.addWidget(self._sort_column)
        layout.addWidget(QLabel("Default sort order"))
        layout.addWidget(self._sort_order)
        layout.addWidget(self._single_click)
        layout.addWidget(self._open_folders_new_window)
        layout.addWidget(self._open_default_app)
        layout.addWidget(self._open_with_last)
        layout.addWidget(self._middle_click_tab)
        layout.addStretch(1)
        return widget

    def _build_file_ops_tab(self):
        widget = QGroupBox("File Operations")
        layout = QVBoxLayout(widget)

        self._conflict_default = QComboBox()
        self._conflict_default.addItems(["ask", "replace", "skip", "rename"])
        self._conflict_default.setCurrentText(self._config.get_str("conflict_default", "ask"))

        self._preserve_metadata = QCheckBox("Preserve timestamps and permissions")
        self._preserve_metadata.setChecked(self._config.get_bool("preserve_metadata", True))

        self._delete_behavior = QComboBox()
        self._delete_behavior.addItems(["trash", "delete"])
        self._delete_behavior.setCurrentText(self._config.get_str("delete_behavior", "trash"))

        self._secure_delete_warning = QCheckBox("Warn that secure delete is not supported")
        self._secure_delete_warning.setChecked(self._config.get_bool("secure_delete_warning", True))

        self._undo_redo = QCheckBox("Enable undo/redo (v2)")
        self._undo_redo.setEnabled(False)

        self._background_ops = QCheckBox("Enable background operations queue")
        self._background_ops.setEnabled(False)

        layout.addWidget(QLabel("Conflict default"))
        layout.addWidget(self._conflict_default)
        layout.addWidget(self._preserve_metadata)
        layout.addWidget(QLabel("Delete behavior"))
        layout.addWidget(self._delete_behavior)
        layout.addWidget(self._secure_delete_warning)
        layout.addWidget(self._undo_redo)
        layout.addWidget(self._background_ops)
        layout.addStretch(1)
        return widget

    def _build_search_tab(self):
        widget = QGroupBox("Search")
        layout = QVBoxLayout(widget)

        self._search_scope = QComboBox()
        self._search_scope.addItems(["current", "recursive"])
        self._search_scope.setCurrentText(self._config.get_str("search_scope", "current"))

        self._search_include_hidden = QCheckBox("Include hidden files by default")
        self._search_include_hidden.setChecked(self._config.get_bool("search_include_hidden", False))

        self._search_case_sensitive = QCheckBox("Case sensitive search")
        self._search_case_sensitive.setChecked(self._config.get_bool("search_case_sensitive", False))

        self._content_search = QCheckBox("Enable content search (ripgrep)")
        self._content_search.setEnabled(False)

        layout.addWidget(QLabel("Default search scope"))
        layout.addWidget(self._search_scope)
        layout.addWidget(self._search_include_hidden)
        layout.addWidget(self._search_case_sensitive)
        layout.addWidget(self._content_search)
        layout.addStretch(1)
        return widget

    def _build_privacy_tab(self):
        widget = QGroupBox("Privacy & Security")
        layout = QVBoxLayout(widget)

        self._track_recent = QCheckBox("Track recent paths")
        self._track_recent.setChecked(self._config.get_bool("track_recent", False))

        self._clear_history = QCheckBox("Clear history on exit")
        self._clear_history.setChecked(self._config.get_bool("clear_history_on_exit", False))

        self._permissions_editor = QCheckBox("Enable permissions editor")
        self._permissions_editor.setChecked(self._config.get_bool("permissions_editor_enabled", True))

        self._warn_exec = QCheckBox("Warn when opening executables")
        self._warn_exec.setChecked(self._config.get_bool("warn_executables", True))

        layout.addWidget(self._track_recent)
        layout.addWidget(self._clear_history)
        layout.addWidget(self._permissions_editor)
        layout.addWidget(self._warn_exec)
        layout.addStretch(1)
        return widget

    def _build_performance_tab(self):
        widget = QGroupBox("Performance")
        form = QFormLayout(widget)

        self._thumbnail_cache_size = QSpinBox()
        self._thumbnail_cache_size.setRange(16, 2048)
        self._thumbnail_cache_size.setValue(int(self._config.get("thumbnail_cache_size", 256)))

        self._thumbnail_max_bytes_perf = QSpinBox()
        self._thumbnail_max_bytes_perf.setRange(1, 1024)
        self._thumbnail_max_bytes_perf.setValue(int(int(self._config.get("thumbnail_max_bytes", 10 * 1024 * 1024)) / (1024 * 1024)))
        self._thumbnail_max_bytes_perf.setSuffix(" MB")

        self._large_folder_threshold = QSpinBox()
        self._large_folder_threshold.setRange(0, 200000)
        self._large_folder_threshold.setValue(int(self._config.get("large_folder_threshold", 50000)))

        form.addRow("Thumbnail cache size", self._thumbnail_cache_size)
        form.addRow("Max thumbnail size", self._thumbnail_max_bytes_perf)
        form.addRow("Large folder warning threshold", self._large_folder_threshold)
        return widget

    def _build_integrations_tab(self):
        widget = QGroupBox("Integrations")
        form = QFormLayout(widget)

        self._open_backend = QComboBox()
        self._open_backend.addItems(["auto", "kde", "gio", "xdg"])
        self._open_backend.setCurrentText(self._config.get_str("open_backend", "auto"))

        self._trash_write_info = QCheckBox("Write .trashinfo metadata")
        self._trash_write_info.setChecked(self._config.get_bool("trash_write_info", True))

        self._mount_unmount = QCheckBox("Enable mount/unmount actions")
        self._mount_unmount.setChecked(self._config.get_bool("enable_mount_actions", True))

        form.addRow("Open backend", self._open_backend)
        form.addRow(self._trash_write_info)
        form.addRow(self._mount_unmount)
        return widget

    def _build_ai_tab(self):
        widget = QGroupBox("AI")
        layout = QVBoxLayout(widget)

        self._ai_enabled = QCheckBox("Enable AI features (BYOK only)")
        self._ai_enabled.setChecked(self._config.get_bool("ai_enabled", False))

        self._ai_provider = QComboBox()
        self._ai_provider.addItems(sorted(available_providers().keys()))
        self._ai_provider.setCurrentText(self._config.get_str("ai_provider", "none"))

        self._ai_key = QLineEdit()
        self._ai_key.setEchoMode(QLineEdit.Password)
        self._ai_key.setPlaceholderText("API key")
        self._ai_status = QLabel("")
        self._ai_status.setWordWrap(True)
        self._ai_key_info = QLabel("")
        self._ai_key_info.setWordWrap(True)
        self._ai_allow_plaintext = QCheckBox("Allow insecure key storage in config (not recommended)")
        self._ai_allow_plaintext.setChecked(self._config.get_bool("ai_allow_plaintext_key", False))
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
        self._ai_provider.currentTextChanged.connect(self._refresh_ai_key_info_async)
        self._ai_allow_plaintext.toggled.connect(self._refresh_ai_key_info_async)

        key_row = QHBoxLayout()
        key_row.addWidget(self._ai_key)
        key_row.addWidget(save_key)
        key_row.addWidget(test_key)
        key_row.addWidget(install_keyring)

        layout.addWidget(self._ai_enabled)
        layout.addWidget(QLabel("Provider"))
        layout.addWidget(self._ai_provider)
        layout.addLayout(key_row)
        layout.addWidget(self._ai_status)
        layout.addWidget(self._ai_key_info)
        layout.addWidget(self._ai_keyring_note)
        layout.addWidget(self._ai_allow_plaintext)
        layout.addStretch(1)
        self._refresh_ai_key_info_async()
        return widget

    def _build_advanced_tab(self):
        widget = QGroupBox("Advanced")
        layout = QVBoxLayout(widget)

        self._debug_logging = QCheckBox("Enable debug logging")
        self._debug_logging.setChecked(self._config.get_bool("debug_logging", False))

        log_path = self._config.get_str("log_path", str(Path.home() / ".cache/geyma/logs/geyma.log"))
        layout.addWidget(QLabel(f"Log file: {log_path}"))
        layout.addWidget(self._debug_logging)

        self._reset_settings = QCheckBox("Reset settings on close")
        self._reset_settings.setChecked(False)
        layout.addWidget(self._reset_settings)
        self._custom_titlebar = QCheckBox("Use custom title bar (restart window)")
        self._custom_titlebar.setChecked(self._config.get_bool("custom_titlebar", False))
        layout.addWidget(self._custom_titlebar)
        layout.addStretch(1)
        return widget

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

    def _apply(self) -> None:
        if self._ai_enabled.isChecked() and not self._config.get_bool("ai_disclosure_seen", False):
            dialog = AIDisclosureDialog(self._ai_provider.currentText(), self)
            if dialog.exec() != QDialog.Accepted:
                return
            self._config.set("ai_disclosure_seen", True)

        if self._reset_settings.isChecked():
            self._config.clear()
            self.settingsChanged.emit()
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
        self.accept()

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
        self._config.set("ai_allow_plaintext_key", self._ai_allow_plaintext.isChecked())
        self._config.save()
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
                if self._ai_allow_plaintext.isChecked():
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
