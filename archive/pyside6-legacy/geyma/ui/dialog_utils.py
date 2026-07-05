from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QVBoxLayout

from geyma.ui.title_bar import TitleBar
from geyma.utils.config import ConfigStore


def apply_dialog_titlebar(dialog) -> None:
    config = ConfigStore()
    use_custom = config.get_bool("custom_titlebar", False)
    dialog.setWindowFlag(Qt.FramelessWindowHint, use_custom)
    if use_custom:
        title_bar = TitleBar(
            dialog,
            title=dialog.windowTitle(),
            show_minimize=False,
            show_maximize=False,
            show_close=True,
        )
        layout = dialog.layout()
        if layout is None:
            layout = QVBoxLayout(dialog)
            layout.setContentsMargins(0, 0, 0, 0)
            layout.setSpacing(0)
        layout.insertWidget(0, title_bar)
    else:
        layout = dialog.layout()
        if layout is None:
            return
        for i in range(layout.count()):
            item = layout.itemAt(i)
            widget = item.widget()
            if isinstance(widget, TitleBar):
                widget.setParent(None)
                widget.deleteLater()
                break
