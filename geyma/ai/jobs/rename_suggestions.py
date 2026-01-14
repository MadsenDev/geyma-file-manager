from __future__ import annotations

from base64 import b64encode
from pathlib import Path
import mimetypes
import os
from typing import Any

from geyma.ai.provider_registry import create_provider
from geyma.utils.config import ConfigStore


def collect_items(paths: list[str]) -> list[dict]:
    items: list[dict] = []
    for raw_path in paths:
        path = Path(raw_path)
        if not path.exists():
            continue
        try:
            stat = path.stat()
        except OSError:
            continue
        items.append(
            {
                "path": str(path),
                "name": path.name,
                "ext": path.suffix.lstrip(".").lower(),
                "mime": mimetypes.guess_type(str(path))[0] or "",
                "size": stat.st_size,
                "mtime": int(stat.st_mtime),
                "is_dir": path.is_dir(),
            }
        )
    return items


def suggest_renames(items: list[dict], allow_ai: bool = False, include_contents: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {
        "items": items,
        "suggestions": [],
        "source": "local",
        "error": "",
    }
    config = ConfigStore()
    if not allow_ai or not config.get_bool("ai_enabled", False):
        return result

    provider_name = config.get_str("ai_provider", "none")
    provider = create_provider(provider_name)
    if not provider.is_configured() or not provider.supports("rename_suggestions"):
        return result

    try:
        payload: dict[str, Any] = {"items": items, "include_contents": include_contents}
        if include_contents:
            payload["files"] = _build_file_payload(items)
        response = provider.run("rename_suggestions", payload)
    except RuntimeError as exc:
        result["error"] = str(exc)
        return result

    data = response.get("data")
    if isinstance(data, dict) and isinstance(data.get("suggestions"), list):
        result["suggestions"] = data.get("suggestions", [])
        result["source"] = "ai"
    return result


def _build_file_payload(items: list[dict]) -> list[dict]:
    files: list[dict] = []
    for item in items:
        path = item.get("path")
        if not path or item.get("is_dir"):
            continue
        entry = {
            "path": path,
            "name": item.get("name", ""),
            "mime": item.get("mime", ""),
            "size": item.get("size", 0),
        }
        mime = entry["mime"]
        try:
            if mime.startswith("text/"):
                entry["content_text"] = _read_text(path)
            elif mime in {"image/png", "image/jpeg", "image/webp", "image/gif"}:
                entry["image_base64"] = _read_base64(path)
            else:
                entry["content_note"] = "binary content not included"
        except OSError:
            entry["content_note"] = "failed to read content"
        files.append(entry)
    return files


def _read_text(path: str) -> str:
    return Path(path).read_text(encoding="utf-8", errors="replace")


def _read_base64(path: str) -> str:
    data = Path(path).read_bytes()
    return b64encode(data).decode("ascii")
