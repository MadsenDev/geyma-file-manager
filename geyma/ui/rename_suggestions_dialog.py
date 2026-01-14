from __future__ import annotations

from PySide6.QtCore import QObject, QRunnable, Qt, Signal
from PySide6.QtWidgets import (
    QCheckBox,
    QDialog,
    QDialogButtonBox,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
)

from geyma.ai.jobs.rename_suggestions import collect_items, suggest_renames
from geyma.ui.ai_data_preview_dialog import AIDataPreviewDialog
from geyma.ui.dialog_utils import apply_dialog_titlebar


class _SuggestionSignals(QObject):
    finished = Signal(dict)


class _SuggestionWorker(QRunnable):
    def __init__(self, items: list[dict], include_contents: bool = False) -> None:
        super().__init__()
        self._items = items
        self._include_contents = include_contents
        self.signals = _SuggestionSignals()

    def run(self) -> None:
        result = suggest_renames(self._items, allow_ai=True, include_contents=self._include_contents)
        self.signals.finished.emit(result)


class RenameSuggestionsDialog(QDialog):
    def __init__(self, paths: list[str], apply_callback, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Rename Suggestions")
        self._apply_callback = apply_callback
        self._items = collect_items(paths)
        self._suggestions: dict[str, str] = {}

        self._status = QLabel("Ready")
        self._ai_label = QLabel("AI-assisted result")
        self._ai_label.setVisible(False)
        self._error = QLabel()
        self._error.setWordWrap(True)
        self._include_contents = QCheckBox(
            "Include file contents for better suggestions (sends files to provider)"
        )
        self._include_contents.setChecked(False)
        self._include_warning = QLabel(
            "Recommended: enable only if you trust the provider. Large files may be slow to upload."
        )
        self._include_warning.setWordWrap(True)

        self._table = QTableWidget(0, 3)
        self._table.setHorizontalHeaderLabels(["Use", "Current", "Proposed"])
        self._table.horizontalHeader().setStretchLastSection(True)
        self._table.verticalHeader().setVisible(False)

        self._generate_button = QPushButton("Generate")
        self._apply_button = QPushButton("Apply")
        self._apply_button.setEnabled(False)
        self._generate_button.clicked.connect(self._generate)
        self._apply_button.clicked.connect(self._apply)

        buttons = QDialogButtonBox(QDialogButtonBox.Close)
        buttons.rejected.connect(self.reject)

        actions = QHBoxLayout()
        actions.addWidget(self._generate_button)
        actions.addWidget(self._apply_button)
        actions.addStretch(1)

        layout = QVBoxLayout(self)
        layout.addWidget(self._table)
        layout.addWidget(self._include_contents)
        layout.addWidget(self._include_warning)
        layout.addLayout(actions)
        layout.addWidget(self._status)
        layout.addWidget(self._ai_label)
        layout.addWidget(self._error)
        layout.addWidget(buttons)
        apply_dialog_titlebar(self)

        self._populate_table()

    def _populate_table(self) -> None:
        self._table.setRowCount(0)
        for item in self._items:
            row = self._table.rowCount()
            self._table.insertRow(row)
            use_item = QTableWidgetItem()
            use_item.setCheckState(Qt.Unchecked)
            use_item.setFlags(Qt.ItemIsUserCheckable | Qt.ItemIsEnabled)
            self._table.setItem(row, 0, use_item)
            self._table.setItem(row, 1, QTableWidgetItem(item.get("name", "")))
            self._table.setItem(row, 2, QTableWidgetItem(""))

    def _generate(self) -> None:
        if not self._items:
            self._status.setText("No items to rename")
            return
        include_contents = self._include_contents.isChecked()
        preview_payload = {
            "items": self._items,
            "include_contents": include_contents,
            "note": "File contents will be read and sent when enabled.",
        }
        preview = AIDataPreviewDialog(
            "AI Rename Preview",
            "This metadata will be sent to the AI provider for rename suggestions.",
            preview_payload,
            self,
        )
        if preview.exec() != QDialog.Accepted:
            self._status.setText("Canceled")
            return
        self._status.setText("Generating...")
        self._generate_button.setEnabled(False)
        worker = _SuggestionWorker(self._items, include_contents=include_contents)
        worker.signals.finished.connect(self._apply_suggestions)
        from PySide6.QtCore import QThreadPool

        QThreadPool.globalInstance().start(worker)

    def _apply_suggestions(self, result: dict) -> None:
        self._generate_button.setEnabled(True)
        self._error.setText(result.get("error", ""))
        self._ai_label.setVisible(result.get("source") == "ai")
        suggestions = result.get("suggestions", [])
        self._suggestions = {
            str(entry.get("original")): str(entry.get("proposed"))
            for entry in suggestions
            if entry.get("original") and entry.get("proposed")
        }
        applied = 0
        for row, item in enumerate(self._items):
            current_name = item.get("name", "")
            proposed = self._suggestions.get(current_name, "")
            if proposed:
                self._table.item(row, 2).setText(proposed)
                self._table.item(row, 0).setCheckState(Qt.Checked)
                applied += 1
        self._apply_button.setEnabled(applied > 0)
        self._status.setText(f"Suggestions ready ({applied})")

    def _apply(self) -> None:
        renames: list[tuple[str, str]] = []
        for row, item in enumerate(self._items):
            use_item = self._table.item(row, 0)
            proposed_item = self._table.item(row, 2)
            if use_item is None or proposed_item is None:
                continue
            if use_item.checkState() != Qt.Checked:
                continue
            proposed = proposed_item.text().strip()
            if not proposed:
                continue
            renames.append((item.get("path", ""), proposed))
        if not renames:
            self._status.setText("No rename selections")
            return
        self._apply_callback(renames)
        self.accept()
