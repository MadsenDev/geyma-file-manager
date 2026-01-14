from __future__ import annotations

from PySide6.QtWidgets import QMessageBox


def show_error(parent, title: str, message: str) -> None:
    QMessageBox.warning(parent, title, message)
