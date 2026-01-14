from __future__ import annotations

from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
)

from geyma.ai.filters import validate_filters
from geyma.ui.dialog_utils import apply_dialog_titlebar

class FiltersDialog(QDialog):
    def __init__(
        self,
        query: str,
        filters: list[dict],
        notes: list[str],
        ai_used: bool = False,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("Search Filters")

        self._ai_label = QLabel("AI-assisted result")
        self._ai_label.setVisible(ai_used)

        self._query = QLineEdit(query)
        self._table = QTableWidget(0, 3)
        self._table.setHorizontalHeaderLabels(["Field", "Op", "Value"])
        self._table.horizontalHeader().setStretchLastSection(True)

        for entry in filters:
            self._add_row(entry.get("field", ""), entry.get("op", ""), str(entry.get("value", "")))

        notes_text = "\n".join(notes) if notes else "No notes."
        self._notes = QLabel(notes_text)
        self._notes.setWordWrap(True)
        self._error_label = QLabel()
        self._error_label.setWordWrap(True)

        add_button = QPushButton("Add")
        remove_button = QPushButton("Remove")
        add_button.clicked.connect(lambda: self._add_row("name", "contains", ""))
        remove_button.clicked.connect(self._remove_row)

        controls = QHBoxLayout()
        controls.addWidget(add_button)
        controls.addWidget(remove_button)
        controls.addStretch(1)

        buttons = QDialogButtonBox(QDialogButtonBox.Apply | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Query"))
        layout.addWidget(self._query)
        layout.addWidget(QLabel("Filters"))
        layout.addWidget(self._table)
        layout.addLayout(controls)
        layout.addWidget(QLabel("Notes"))
        layout.addWidget(self._notes)
        layout.addWidget(self._error_label)
        layout.addWidget(self._ai_label)
        layout.addWidget(buttons)
        apply_dialog_titlebar(self)

    def query_text(self) -> str:
        return self._query.text().strip()

    def filters(self) -> list[dict]:
        filters: list[dict] = []
        for row in range(self._table.rowCount()):
            field_item = self._table.item(row, 0)
            op_item = self._table.item(row, 1)
            value_item = self._table.item(row, 2)
            field = field_item.text().strip() if field_item else ""
            op = op_item.text().strip() if op_item else ""
            value = value_item.text().strip() if value_item else ""
            if not field or not op or value == "":
                continue
            filters.append({"field": field, "op": op, "value": value})
        valid, errors = validate_filters(filters)
        if errors:
            self._error_label.setText("Errors:\n" + "\n".join(errors))
            return []
        self._error_label.setText("")
        return valid

    def _add_row(self, field: str, op: str, value: str) -> None:
        row = self._table.rowCount()
        self._table.insertRow(row)
        self._table.setItem(row, 0, QTableWidgetItem(field))
        self._table.setItem(row, 1, QTableWidgetItem(op))
        self._table.setItem(row, 2, QTableWidgetItem(value))

    def _remove_row(self) -> None:
        row = self._table.currentRow()
        if row >= 0:
            self._table.removeRow(row)
