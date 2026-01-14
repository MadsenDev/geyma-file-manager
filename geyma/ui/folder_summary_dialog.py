from __future__ import annotations

from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QLabel,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
)

from geyma.ai.jobs.folder_summary import summarize_folder
from geyma.ui.ai_data_preview_dialog import AIDataPreviewDialog
from geyma.ui.dialog_utils import apply_dialog_titlebar
from geyma.utils.config import ConfigStore
from geyma.utils.config import ConfigStore


class FolderSummaryDialog(QDialog):
    def __init__(self, path: str, include_hidden: bool, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Folder Summary")
        self._path = path
        self._include_hidden = include_hidden
        self._config = ConfigStore()

        self._header = QLabel(f"Summary for: {path}")
        self._header.setWordWrap(True)

        self._summary = QLabel()
        self._summary.setWordWrap(True)

        self._stats_table = QTableWidget(0, 2)
        self._stats_table.setHorizontalHeaderLabels(["Metric", "Value"])
        self._stats_table.horizontalHeader().setStretchLastSection(True)
        self._stats_table.verticalHeader().setVisible(False)

        self._ai_label = QLabel("AI-assisted summary")
        self._ai_label.setVisible(False)

        self._error = QLabel()
        self._error.setWordWrap(True)

        buttons = QDialogButtonBox(QDialogButtonBox.Retry | QDialogButtonBox.Close)
        buttons.rejected.connect(self.reject)
        buttons.accepted.connect(self._refresh)

        layout = QVBoxLayout(self)
        layout.addWidget(self._header)
        layout.addWidget(self._summary)
        layout.addWidget(self._stats_table)
        layout.addWidget(self._ai_label)
        layout.addWidget(self._error)
        layout.addWidget(buttons)

        self._refresh()
        apply_dialog_titlebar(self)

    def _refresh(self) -> None:
        local_result = summarize_folder(self._path, include_hidden=self._include_hidden, allow_ai=False)
        result = local_result
        if self._config.get_bool("ai_enabled", False):
            dialog = AIDataPreviewDialog(
                "AI Folder Summary Preview",
                "This metadata will be sent to the AI provider to summarize the folder.",
                {"stats": local_result.get("stats", {})},
                self,
            )
            if dialog.exec() == QDialog.Accepted:
                result = summarize_folder(self._path, include_hidden=self._include_hidden, allow_ai=True)
        stats = result.get("stats", {})
        summary_text = result.get("text") or "No AI summary available."
        self._summary.setText(summary_text)
        self._populate_stats(stats)
        self._ai_label.setVisible(result.get("source") == "ai")
        self._error.setText(result.get("error", ""))

    def _populate_stats(self, stats: dict) -> None:
        self._stats_table.setRowCount(0)
        if not stats:
            self._add_row("Status", "No statistics available.")
            return
        self._add_row("Files", str(stats.get("total_files", 0)))
        self._add_row("Folders", str(stats.get("total_dirs", 0)))
        self._add_row("Total size", self._format_bytes(int(stats.get("total_size", 0))))
        self._add_row("Size buckets", self._format_map(stats.get("size_buckets", {})))
        self._add_row("File types", self._format_map(stats.get("type_counts", {})))
        self._add_row("Age buckets", self._format_map(stats.get("age_buckets", {})))

    def _add_row(self, label: str, value: str) -> None:
        row = self._stats_table.rowCount()
        self._stats_table.insertRow(row)
        self._stats_table.setItem(row, 0, QTableWidgetItem(label))
        self._stats_table.setItem(row, 1, QTableWidgetItem(value))

    @staticmethod
    def _format_map(values: dict) -> str:
        if not values:
            return "None"
        return ", ".join(f"{key}: {count}" for key, count in values.items())

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
        return f"{int(value)} B"
