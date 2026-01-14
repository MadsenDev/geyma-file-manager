from __future__ import annotations

from dataclasses import dataclass

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QCheckBox,
    QDialog,
    QDialogButtonBox,
    QLabel,
    QVBoxLayout,
)

from geyma.ui.dialog_utils import apply_dialog_titlebar

@dataclass
class ConflictChoice:
    action: str
    apply_to_all: bool


class ConflictDialog(QDialog):
    def __init__(self, name: str, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("File Conflict")
        self._choice = ConflictChoice(action="skip", apply_to_all=False)

        message = QLabel(f"{name} already exists in this location.")
        message.setWordWrap(True)

        self._apply_all = QCheckBox("Apply to all")

        buttons = QDialogButtonBox()
        replace_button = buttons.addButton("Replace", QDialogButtonBox.AcceptRole)
        skip_button = buttons.addButton("Skip", QDialogButtonBox.DestructiveRole)
        rename_button = buttons.addButton("Rename", QDialogButtonBox.ActionRole)

        replace_button.clicked.connect(lambda: self._set_choice("replace"))
        skip_button.clicked.connect(lambda: self._set_choice("skip"))
        rename_button.clicked.connect(lambda: self._set_choice("rename"))

        layout = QVBoxLayout(self)
        layout.addWidget(message)
        layout.addWidget(self._apply_all)
        layout.addWidget(buttons)
        apply_dialog_titlebar(self)

    def _set_choice(self, action: str) -> None:
        self._choice = ConflictChoice(action=action, apply_to_all=self._apply_all.isChecked())
        self.accept()

    def choice(self) -> ConflictChoice:
        return self._choice
