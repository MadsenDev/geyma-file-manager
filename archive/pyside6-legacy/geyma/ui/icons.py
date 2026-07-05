from __future__ import annotations

from pathlib import Path

from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QApplication, QStyle


def themed_icon(
    name: str | list[str] | tuple[str, ...],
    fallback: QStyle.StandardPixmap | None = None,
) -> QIcon:
    names = [name] if isinstance(name, str) else list(name)
    for candidate in names:
        icon = QIcon.fromTheme(candidate)
        if not icon.isNull():
            return icon
    if fallback is None:
        return QIcon()
    app = QApplication.instance()
    if app is None:
        return QIcon()
    return app.style().standardIcon(fallback)


def file_item_icon(path: str, *, is_dir: bool) -> QIcon:
    target = Path(path).expanduser()
    if is_dir:
        if target == Path.home():
            return themed_icon(["user-home", "go-home"], QStyle.SP_DirHomeIcon)
        if target.name.lower() == "trash":
            return themed_icon(["user-trash", "trash-empty"], QStyle.SP_TrashIcon)
        if target == Path("/"):
            return themed_icon(["drive-harddisk", "folder-root"], QStyle.SP_DriveHDIcon)
        return themed_icon(["folder", "inode-directory"], QStyle.SP_DirIcon)
    return themed_icon(["text-x-generic", "unknown"], QStyle.SP_FileIcon)
