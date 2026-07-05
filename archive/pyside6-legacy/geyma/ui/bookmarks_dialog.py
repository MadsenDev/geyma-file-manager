from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QDialog,
    QFileDialog,
    QHBoxLayout,
    QListWidget,
    QListWidgetItem,
    QPushButton,
    QVBoxLayout,
)

from geyma.ui.dialog_utils import apply_dialog_titlebar

class BookmarksDialog(QDialog):
    changed = Signal(list)

    def __init__(self, bookmarks: list[dict], parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Bookmarks")
        self._list = QListWidget()
        self._list.setSelectionMode(QListWidget.SingleSelection)
        for entry in bookmarks:
            item = QListWidgetItem(entry.get("label", "Bookmark"))
            item.setData(Qt.UserRole, entry.get("path", ""))
            self._list.addItem(item)

        add_button = QPushButton("Add")
        remove_button = QPushButton("Remove")
        up_button = QPushButton("Move Up")
        down_button = QPushButton("Move Down")
        close_button = QPushButton("Close")

        add_button.clicked.connect(self._add)
        remove_button.clicked.connect(self._remove)
        up_button.clicked.connect(lambda: self._move(-1))
        down_button.clicked.connect(lambda: self._move(1))
        close_button.clicked.connect(self._emit_changes)
        close_button.clicked.connect(self.accept)

        controls = QHBoxLayout()
        controls.addWidget(add_button)
        controls.addWidget(remove_button)
        controls.addWidget(up_button)
        controls.addWidget(down_button)
        controls.addStretch(1)
        controls.addWidget(close_button)

        layout = QVBoxLayout(self)
        layout.addWidget(self._list)
        layout.addLayout(controls)
        apply_dialog_titlebar(self)

    def _add(self) -> None:
        path = QFileDialog.getExistingDirectory(self, "Add Bookmark", str(Path.home()))
        if not path:
            return
        label = Path(path).name or path
        item = QListWidgetItem(label)
        item.setData(Qt.UserRole, path)
        self._list.addItem(item)

    def _remove(self) -> None:
        row = self._list.currentRow()
        if row >= 0:
            self._list.takeItem(row)

    def _move(self, offset: int) -> None:
        row = self._list.currentRow()
        if row < 0:
            return
        new_row = row + offset
        if new_row < 0 or new_row >= self._list.count():
            return
        item = self._list.takeItem(row)
        self._list.insertItem(new_row, item)
        self._list.setCurrentRow(new_row)

    def _emit_changes(self) -> None:
        bookmarks: list[dict] = []
        for idx in range(self._list.count()):
            item = self._list.item(idx)
            bookmarks.append({"label": item.text(), "path": item.data(Qt.UserRole)})
        self.changed.emit(bookmarks)
