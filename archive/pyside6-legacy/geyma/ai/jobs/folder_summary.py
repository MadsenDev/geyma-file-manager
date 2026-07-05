from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
import os
import time
from typing import Any

from geyma.ai.provider_registry import create_provider
from geyma.utils.config import ConfigStore


@dataclass(frozen=True)
class FolderStats:
    total_files: int
    total_dirs: int
    total_size: int
    size_buckets: dict[str, int]
    type_counts: dict[str, int]
    age_buckets: dict[str, int]


def analyze_folder(root: str, include_hidden: bool = False) -> FolderStats:
    base = Path(root)
    total_files = 0
    total_dirs = 0
    total_size = 0
    size_counter = Counter()
    type_counter = Counter()
    age_counter = Counter()
    now = time.time()

    for dirpath, dirnames, filenames in os.walk(base):
        if not include_hidden:
            dirnames[:] = [d for d in dirnames if not d.startswith(".")]
            filenames = [f for f in filenames if not f.startswith(".")]
        total_dirs += len(dirnames)
        for name in filenames:
            path = Path(dirpath) / name
            try:
                stat = path.stat()
            except OSError:
                continue
            total_files += 1
            total_size += stat.st_size
            size_counter[_size_bucket(stat.st_size)] += 1
            type_counter[_file_type(name)] += 1
            age_counter[_age_bucket(now - stat.st_mtime)] += 1

    return FolderStats(
        total_files=total_files,
        total_dirs=total_dirs,
        total_size=total_size,
        size_buckets=dict(size_counter),
        type_counts=_cap_counts(type_counter, 20),
        age_buckets=dict(age_counter),
    )


def summarize_folder(root: str, include_hidden: bool = False, allow_ai: bool = False) -> dict[str, Any]:
    stats = analyze_folder(root, include_hidden=include_hidden)
    result: dict[str, Any] = {"stats": stats.__dict__, "source": "local", "text": "", "error": ""}

    config = ConfigStore()
    if not allow_ai or not config.get_bool("ai_enabled", False):
        return result

    provider_name = config.get_str("ai_provider", "none")
    provider = create_provider(provider_name)
    if not provider.is_configured() or not provider.supports("folder_summary"):
        return result

    try:
        response = provider.run("folder_summary", {"stats": stats.__dict__})
    except RuntimeError as exc:
        result["error"] = str(exc)
        return result

    result["text"] = response.get("text", "")
    result["source"] = "ai"
    return result


def _size_bucket(size_bytes: int) -> str:
    if size_bytes < 1024 * 1024:
        return "<1MB"
    if size_bytes < 10 * 1024 * 1024:
        return "1-10MB"
    if size_bytes < 100 * 1024 * 1024:
        return "10-100MB"
    if size_bytes < 1024 * 1024 * 1024:
        return "100MB-1GB"
    return ">1GB"


def _file_type(name: str) -> str:
    if "." not in name:
        return "no_ext"
    return name.rsplit(".", 1)[-1].lower()


def _age_bucket(age_seconds: float) -> str:
    age_days = age_seconds / 86400
    if age_days < 1:
        return "<1d"
    if age_days < 7:
        return "1-7d"
    if age_days < 30:
        return "7-30d"
    if age_days < 180:
        return "30-180d"
    if age_days < 365:
        return "180-365d"
    return ">365d"


def _cap_counts(counter: Counter[str], limit: int) -> dict[str, int]:
    items = counter.most_common()
    if len(items) <= limit:
        return dict(items)
    trimmed = dict(items[:limit])
    trimmed["other"] = sum(count for _, count in items[limit:])
    return trimmed
