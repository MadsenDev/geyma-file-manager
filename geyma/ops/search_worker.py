from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from pathlib import Path
import os
import re
from typing import Any

from PySide6.QtCore import QObject, QRunnable, Signal

_SIZE_RE = re.compile(r"^(?P<value>\\d+(?:\\.\\d+)?)(?P<unit>[KMGTP]?B)?$", re.IGNORECASE)


class SearchSignals(QObject):
    found = Signal(str)
    progress = Signal(int)
    finished = Signal()
    error = Signal(str)


@dataclass
class SearchPlan:
    root: Path
    query: str
    include_hidden: bool
    case_sensitive: bool
    recursive: bool
    filters: list[dict]


class SearchWorker(QRunnable):
    def __init__(
        self,
        root: Path,
        query: str,
        include_hidden: bool,
        case_sensitive: bool,
        recursive: bool = True,
        filters: list[dict] | None = None,
    ) -> None:
        super().__init__()
        self._plan = SearchPlan(
            root=root,
            query=query if case_sensitive else query.lower(),
            include_hidden=include_hidden,
            case_sensitive=case_sensitive,
            recursive=recursive,
            filters=filters or [],
        )
        self.signals = SearchSignals()
        self._cancel = False

    def cancel(self) -> None:
        self._cancel = True

    def run(self) -> None:
        if not self._plan.root.exists():
            self.signals.error.emit("Search root does not exist")
            self.signals.finished.emit()
            return

        total_scanned = 0
        for dirpath, dirnames, filenames in os.walk(self._plan.root):
            if self._cancel:
                break
            if not self._plan.include_hidden:
                dirnames[:] = [d for d in dirnames if not d.startswith(".")]
                filenames = [f for f in filenames if not f.startswith(".")]
            for name in filenames + dirnames:
                if self._cancel:
                    break
                total_scanned += 1
                haystack = name if self._plan.case_sensitive else name.lower()
                if self._plan.query and self._plan.query not in haystack:
                    continue
                candidate = Path(dirpath) / name
                if self._plan.filters and not _match_filters(candidate, self._plan.filters):
                    continue
                self.signals.found.emit(str(candidate))
                if total_scanned % 200 == 0:
                    self.signals.progress.emit(total_scanned)
            if not self._plan.recursive:
                break

        self.signals.finished.emit()


def _match_filters(path: Path, filters: list[dict]) -> bool:
    try:
        stat = path.stat()
    except OSError:
        return False
    name = path.name
    path_str = str(path)
    for entry in filters:
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
            if op != "contains" or str(value).lower() not in path_str.lower():
                return False
        elif field == "size":
            size_value = _parse_size(value)
            if size_value is None:
                return False
            if not _compare_number(stat.st_size, op, size_value):
                return False
        elif field == "mtime":
            target = _parse_date(value)
            if target is None:
                return False
            candidate = datetime.fromtimestamp(stat.st_mtime)
            if not _compare_number(candidate.timestamp(), op, target.timestamp()):
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
