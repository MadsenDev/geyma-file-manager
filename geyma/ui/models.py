from __future__ import annotations

from datetime import date, datetime, time
from pathlib import Path
import re
import shutil
from typing import Any

from PySide6.QtCore import Qt, QSortFilterProxyModel, Signal
from PySide6.QtWidgets import QFileSystemModel, QMessageBox

from geyma.ui.error_dialog import show_error

_SIZE_RE = re.compile(r"^(?P<value>\\d+(?:\\.\\d+)?)(?P<unit>[KMGTP]?B)?$", re.IGNORECASE)


class ValidatingFileSystemModel(QFileSystemModel):
    renameAttempted = Signal(str, str, bool, str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)

    def setData(self, index, value, role=Qt.EditRole):
        if role == Qt.EditRole:
            name = str(value).strip()
            if not name:
                show_error(self.parent(), "Rename", "Name cannot be empty.")
                return False
            current_path = Path(self.filePath(index))
            target_path = current_path.with_name(name)
            if target_path == current_path:
                self.renameAttempted.emit(str(current_path), str(target_path), False, "No change")
                return False
            if target_path.exists():
                reply = QMessageBox.warning(
                    self.parent(),
                    "Rename",
                    "A file or folder with that name already exists. Replace it?",
                    QMessageBox.Yes | QMessageBox.No,
                )
                if reply != QMessageBox.Yes:
                    self.renameAttempted.emit(str(current_path), str(target_path), False, "Name exists")
                    return False
                try:
                    if target_path.is_dir() and not target_path.is_symlink():
                        shutil.rmtree(target_path)
                    else:
                        target_path.unlink()
                except OSError as exc:
                    show_error(self.parent(), "Rename", str(exc))
                    self.renameAttempted.emit(str(current_path), str(target_path), False, str(exc))
                    return False
        success = super().setData(index, value, role)
        if role == Qt.EditRole:
            self.renameAttempted.emit(
                str(current_path),
                str(target_path),
                bool(success),
                "" if success else "Rename failed",
            )
        return success


class FilterProxyModel(QSortFilterProxyModel):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._filters: list[dict] = []
        self._folders_first_mode = "auto"

    def set_filters(self, filters: list[dict]) -> None:
        self._filters = filters
        self.invalidateFilter()

    def set_folders_first_mode(self, mode: str) -> None:
        self._folders_first_mode = (mode or "auto").lower()
        self.invalidate()

    def lessThan(self, left, right) -> bool:
        mode = self._folders_first_mode
        if mode != "never":
            if mode == "always" or (mode == "auto" and self.sortColumn() == 0):
                model = self.sourceModel()
                if model is not None:
                    left_dir = model.isDir(left)
                    right_dir = model.isDir(right)
                    if left_dir != right_dir:
                        return left_dir and not right_dir
        return super().lessThan(left, right)

    def filterAcceptsRow(self, source_row: int, source_parent) -> bool:
        if not super().filterAcceptsRow(source_row, source_parent):
            return False
        if not self._filters:
            return True
        model = self.sourceModel()
        if model is None:
            return True
        index = model.index(source_row, 0, source_parent)
        if not index.isValid():
            return False
        info = model.fileInfo(index)
        name = info.fileName()
        path = info.absoluteFilePath()
        size = info.size()
        mtime = info.lastModified().toSecsSinceEpoch()
        for entry in self._filters:
            field = str(entry.get("field", "")).lower()
            op = str(entry.get("op", "")).lower()
            value = entry.get("value")
            if field == "ext":
                ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
                if op not in {"eq", "="} or ext != str(value).lower().lstrip("."):
                    return False
            elif field == "name":
                if op != "contains" or str(value).lower() not in name.lower():
                    return False
            elif field == "path":
                if op != "contains" or str(value).lower() not in path.lower():
                    return False
            elif field == "size":
                parsed = _parse_size(value)
                if parsed is None or not _compare_number(size, op, parsed):
                    return False
            elif field == "mtime":
                parsed = _parse_date(value)
                if parsed is None:
                    return False
                if op in {"eq", "="}:
                    file_date = datetime.fromtimestamp(mtime).date()
                    if file_date != parsed.date():
                        return False
                elif not _compare_number(mtime, op, parsed.timestamp()):
                    return False
            else:
                return False
        return True


def _parse_size(value: Any) -> int | None:
    if isinstance(value, (int, float)):
        return int(value)
    if value is None:
        return None
    text = str(value).strip()
    if text.isdigit():
        return int(text)
    match = _SIZE_RE.match(text)
    if not match:
        return None
    number = float(match.group("value"))
    unit = (match.group("unit") or "B").upper()
    multipliers = {
        "B": 1,
        "KB": 1024,
        "MB": 1024**2,
        "GB": 1024**3,
        "TB": 1024**4,
        "PB": 1024**5,
    }
    if unit not in multipliers:
        return None
    return int(number * multipliers[unit])


def _parse_date(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.min)
    if value is None:
        return None
    text = str(value).strip()
    for parser in (datetime.fromisoformat, date.fromisoformat):
        try:
            parsed = parser(text)
        except ValueError:
            continue
        if isinstance(parsed, datetime):
            return parsed
        return datetime.combine(parsed, time.min)
    return None


def _compare_number(left: float, op: str, right: float) -> bool:
    if op in {"eq", "="}:
        return left == right
    if op in {">", "gt"}:
        return left > right
    if op in {">=", "gte"}:
        return left >= right
    if op in {"<", "lt"}:
        return left < right
    if op in {"<=", "lte"}:
        return left <= right
    return False
