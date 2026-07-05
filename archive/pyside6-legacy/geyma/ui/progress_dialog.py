from __future__ import annotations

from PySide6.QtCore import Signal
from PySide6.QtWidgets import (
    QDialog,
    QHBoxLayout,
    QLabel,
    QProgressBar,
    QPushButton,
    QVBoxLayout,
)

from geyma.ui.dialog_utils import apply_dialog_titlebar

class OperationProgressDialog(QDialog):
    canceled = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("File Operation")
        self.setModal(True)

        self._file_label = QLabel("--")
        self._meta_label = QLabel("--")
        self._progress = QProgressBar()
        self._progress.setRange(0, 100)
        self._progress.setValue(0)
        self._progress.setTextVisible(True)

        cancel_button = QPushButton("Cancel")
        cancel_button.clicked.connect(self._on_cancel)

        button_row = QHBoxLayout()
        button_row.addStretch(1)
        button_row.addWidget(cancel_button)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Current file:"))
        layout.addWidget(self._file_label)
        layout.addWidget(self._progress)
        layout.addWidget(self._meta_label)
        layout.addLayout(button_row)
        apply_dialog_titlebar(self)

    def set_current_file(self, name: str) -> None:
        self._file_label.setText(name)

    def set_progress(self, percent: int) -> None:
        self._progress.setValue(max(0, min(100, percent)))

    def set_meta(self, text: str) -> None:
        self._meta_label.setText(text)

    def _on_cancel(self) -> None:
        self.canceled.emit()
        self.close()
