from __future__ import annotations

from PySide6.QtWidgets import QDialog, QDialogButtonBox, QLabel, QVBoxLayout

from geyma.ui.dialog_utils import apply_dialog_titlebar


class AIDisclosureDialog(QDialog):
    def __init__(self, provider_name: str, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("AI Disclosure")

        intro = QLabel(
            "Geyma AI is optional and BYOK only. When you use an AI feature, "
            "the app sends limited metadata to the selected provider."
        )
        intro.setWordWrap(True)

        details = QLabel(
            "\n".join(
                [
                    f"Provider: {provider_name}",
                    "",
                    "What is sent:",
                    "- Filenames, sizes, dates, and file type metadata",
                    "",
                    "What is never sent:",
                    "- File contents, unless you explicitly choose an image feature",
                    "",
                    "How it works:",
                    "- AI results are previews only",
                    "- You must approve any changes",
                ]
            )
        )
        details.setWordWrap(True)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Ok).setText("Enable AI")
        buttons.button(QDialogButtonBox.Cancel).setText("Cancel")
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addWidget(intro)
        layout.addWidget(details)
        layout.addWidget(buttons)
        apply_dialog_titlebar(self)
