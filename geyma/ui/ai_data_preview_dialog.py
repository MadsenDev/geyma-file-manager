from __future__ import annotations

import json

from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QLabel,
    QPlainTextEdit,
    QVBoxLayout,
)

from geyma.ui.dialog_utils import apply_dialog_titlebar

class AIDataPreviewDialog(QDialog):
    def __init__(self, title: str, description: str, payload: dict, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle(title)

        header = QLabel(description)
        header.setWordWrap(True)

        preview = QPlainTextEdit()
        preview.setReadOnly(True)
        preview.setPlainText(json.dumps(payload, indent=2, sort_keys=True))

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Ok).setText("Send")
        buttons.button(QDialogButtonBox.Cancel).setText("Cancel")
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addWidget(header)
        layout.addWidget(preview)
        layout.addWidget(buttons)
        apply_dialog_titlebar(self)
