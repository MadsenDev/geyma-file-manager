from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import unquote


@dataclass
class TrashInfo:
    original_path: Path
    deletion_date: str


def parse_trash_info(path: Path) -> Optional[TrashInfo]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None

    original = None
    deletion_date = ""
    in_section = False
    for line in lines:
        if line.strip() == "[Trash Info]":
            in_section = True
            continue
        if not in_section or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key == "Path":
            original = Path(unquote(value))
        elif key == "DeletionDate":
            deletion_date = value

    if original is None:
        return None
    return TrashInfo(original_path=original, deletion_date=deletion_date)
