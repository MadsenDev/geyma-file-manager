from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFormLayout,
    QGroupBox,
    QLabel,
    QLineEdit,
    QSpinBox,
    QVBoxLayout,
)

from geyma.ui.dialog_utils import apply_dialog_titlebar

class ImageGenerationDialog(QDialog):
    def __init__(
        self,
        folder: str,
        reference: str | None = None,
        mode: str = "new",
        parent=None,
    ) -> None:
        super().__init__(parent)
        self._mode = mode
        self.setWindowTitle(self._title_for_mode())
        self._folder = folder
        self._reference = reference

        self._prompt = QLineEdit()
        self._prompt.setPlaceholderText(self._prompt_placeholder())

        self._size = QComboBox()
        self._size.addItems(["auto", "1024x1024", "1024x1536", "1536x1024"])

        self._format = QComboBox()
        self._format.addItems(["png", "jpg"])

        self._filename = QLineEdit()
        self._filename.setPlaceholderText("generated_{n}")

        self._preview = QLabel("No reference image")
        self._preview.setMinimumHeight(160)
        self._preview.setAlignment(Qt.AlignCenter)
        self._use_reference = QCheckBox("Include reference image")
        self._use_reference.setChecked(bool(reference))
        self._use_reference.setVisible(bool(reference))
        if reference:
            pixmap = QPixmap(reference)
            if not pixmap.isNull():
                self._preview.setPixmap(pixmap.scaled(320, 180, Qt.KeepAspectRatio, Qt.SmoothTransformation))

        self._steps = QSpinBox()
        self._steps.setRange(1, 150)
        self._steps.setValue(30)

        self._guidance = QDoubleSpinBox()
        self._guidance.setRange(0.0, 20.0)
        self._guidance.setValue(7.0)
        self._guidance.setSingleStep(0.5)

        self._strength = QDoubleSpinBox()
        self._strength.setRange(0.0, 1.0)
        self._strength.setSingleStep(0.05)
        self._strength.setValue(self._default_strength())

        self._quality = QComboBox()
        self._quality.addItems(["low", "medium", "high"])
        self._quality.setCurrentText("medium")

        form = QFormLayout()
        form.addRow("Prompt", self._prompt)
        form.addRow("Size", self._size)
        form.addRow("Format", self._format)
        form.addRow("Filename template", self._filename)

        advanced = QGroupBox("Advanced settings")
        advanced.setCheckable(True)
        advanced.setChecked(False)
        advanced_layout = QFormLayout(advanced)
        advanced_layout.addRow("Steps", self._steps)
        advanced_layout.addRow("Guidance", self._guidance)
        advanced_layout.addRow("Strength", self._strength)
        advanced_layout.addRow("Quality", self._quality)

        details = QLabel(f"Folder: {folder}")
        details.setWordWrap(True)
        if reference:
            details.setText(f"{details.text()}\nReference: {Path(reference).name}")
        hint = QLabel(self._mode_hint())
        hint.setWordWrap(True)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addWidget(details)
        layout.addWidget(hint)
        layout.addWidget(self._preview)
        layout.addWidget(self._use_reference)
        layout.addLayout(form)
        layout.addWidget(advanced)
        layout.addWidget(buttons)
        apply_dialog_titlebar(self)

    def payload(self) -> dict[str, str]:
        return {
            "prompt": self._prompt.text().strip(),
            "size": self._size.currentText(),
            "format": self._format.currentText(),
            "filename": self._filename.text().strip() or "generated_{n}",
            "folder": self._folder,
            "reference": (self._reference or "") if self._use_reference.isChecked() else "",
            "use_reference": self._use_reference.isChecked(),
            "steps": self._steps.value(),
            "guidance": self._guidance.value(),
            "strength": self._strength.value(),
            "quality": self._quality.currentText(),
            "mode": self._mode,
        }

    def _title_for_mode(self) -> str:
        if self._mode == "variation":
            return "Generate Variation"
        if self._mode == "edit":
            return "Edit Image with Prompt"
        return "Generate Image"

    def _prompt_placeholder(self) -> str:
        if self._mode == "variation":
            return "Optional: add a gentle twist (e.g. 'pastel colors')"
        if self._mode == "edit":
            return "Describe the edit (e.g. 'add a sunset sky')"
        return "Describe the image you want"

    def _default_strength(self) -> float:
        if self._mode == "variation":
            return 0.35
        if self._mode == "edit":
            return 0.7
        return 0.5

    def _mode_hint(self) -> str:
        if self._mode == "variation":
            return "Variation keeps the original mostly intact with small changes."
        if self._mode == "edit":
            return "Edit applies a stronger change using your prompt."
        return "Generate creates a brand new image from the prompt."
