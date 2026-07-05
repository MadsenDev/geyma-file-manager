from __future__ import annotations

from pathlib import Path
from typing import Callable

from PySide6.QtCore import QThreadPool
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QPushButton,
    QVBoxLayout,
)

from geyma.ai.jobs.text_to_filters import translate_query
from geyma.ops.search_worker import SearchWorker
from geyma.ui.ai_data_preview_dialog import AIDataPreviewDialog
from geyma.ui.filters_dialog import FiltersDialog
from geyma.ui.dialog_utils import apply_dialog_titlebar
from geyma.utils.config import ConfigStore


class SearchDialog(QDialog):
    def __init__(
        self,
        root: str,
        include_hidden: bool,
        case_sensitive: bool,
        default_scope: str,
        open_path: Callable[[str], bool],
        navigate_to: Callable[[str], None],
        parent=None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("Search")
        self._root = Path(root)
        self._include_hidden = include_hidden
        self._case_sensitive = case_sensitive
        self._default_scope = default_scope
        self._open_path = open_path
        self._navigate_to = navigate_to
        self._worker: SearchWorker | None = None
        self._filters: list[dict] = []
        self._config = ConfigStore()

        self._query_input = QLineEdit()
        self._query_input.setPlaceholderText("Type to search...")
        self._status_label = QLabel("Ready")
        self._ai_badge = QLabel("AI used")
        self._ai_badge.setVisible(False)
        self._results = QListWidget()
        self._scope = QComboBox()
        self._scope.addItems(["Current Folder", "This Folder + Subfolders", "System (All Files)"])
        self._scope.setCurrentIndex(self._scope_index(self._default_scope))

        self._start_button = QPushButton("Search")
        self._filters_button = QPushButton("Filters")
        self._cancel_button = QPushButton("Cancel")
        self._cancel_button.setEnabled(False)

        button_row = QHBoxLayout()
        button_row.addWidget(self._start_button)
        button_row.addWidget(self._filters_button)
        button_row.addWidget(self._cancel_button)
        button_row.addStretch(1)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel(f"Search in: {self._root}"))
        layout.addWidget(QLabel("Scope"))
        layout.addWidget(self._scope)
        layout.addWidget(self._query_input)
        layout.addLayout(button_row)
        layout.addWidget(self._results)
        layout.addWidget(self._status_label)
        layout.addWidget(self._ai_badge)
        apply_dialog_titlebar(self)

        self._start_button.clicked.connect(self._start_search)
        self._filters_button.clicked.connect(self._open_filters)
        self._cancel_button.clicked.connect(self._cancel_search)
        self._query_input.returnPressed.connect(self._start_search)
        self._results.itemDoubleClicked.connect(self._open_selected)

    def _start_search(self) -> None:
        query = self._query_input.text().strip()
        if (not query and not self._filters) or self._worker is not None:
            return
        self._results.clear()
        self._status_label.setText("Searching...")
        self._start_button.setEnabled(False)
        self._cancel_button.setEnabled(True)

        root, recursive, scope_label = self._resolve_scope()
        self._status_label.setText(f"Searching ({scope_label})...")
        self._config.set("search_scope", "recursive" if recursive else "current")
        if scope_label.startswith("System"):
            self._config.set("search_scope", "system")
        self._config.save()

        worker = SearchWorker(
            root,
            query,
            self._include_hidden,
            self._case_sensitive,
            recursive=recursive,
            filters=self._filters,
        )
        worker.signals.found.connect(self._results.addItem)
        worker.signals.progress.connect(lambda count: self._status_label.setText(f"Scanned {count} items"))
        worker.signals.error.connect(lambda message: self._status_label.setText(message))
        worker.signals.finished.connect(self._finish_search)
        self._worker = worker
        QThreadPool.globalInstance().start(worker)

    def _finish_search(self) -> None:
        self._worker = None
        self._status_label.setText(f"{self._results.count()} results")
        self._start_button.setEnabled(True)
        self._cancel_button.setEnabled(False)

    def _cancel_search(self) -> None:
        if self._worker is None:
            return
        self._worker.cancel()
        self._status_label.setText("Canceled")
        self._start_button.setEnabled(True)
        self._cancel_button.setEnabled(False)
        self._worker = None

    def _open_filters(self) -> None:
        query = self._query_input.text().strip()
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
            self._query_input.setText(dialog.query_text())
            filters = dialog.filters()
            if not filters and dialog.query_text():
                self._status_label.setText("Filter errors; not applied")
                return
            self._filters = filters
            self._status_label.setText(f"Filters ready ({len(self._filters)})")
            self._ai_badge.setVisible(result.get("source") == "ai")

    def _open_selected(self) -> None:
        item = self._results.currentItem()
        if item is None:
            return
        path = item.text()
        target = Path(path)
        if target.is_dir():
            self._navigate_to(path)
            self.close()
            return
        self._open_path(path)

    def _scope_index(self, scope: str) -> int:
        scope = (scope or "").lower()
        if scope == "recursive":
            return 1
        if scope == "system":
            return 2
        return 0

    def _resolve_scope(self) -> tuple[Path, bool, str]:
        index = self._scope.currentIndex()
        if index == 1:
            return self._root, True, "This Folder + Subfolders"
        if index == 2:
            return Path("/"), True, "System (All Files)"
        return self._root, False, "Current Folder"
