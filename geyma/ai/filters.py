from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
import re
import shlex
from typing import Any


@dataclass(frozen=True)
class FilterSpec:
    field: str
    op: str
    value: Any


ALLOWED_FIELDS = {"ext", "name", "path", "size", "mtime"}
ALLOWED_OPS = {"eq", "=", "contains", ">", ">=", "<", "<=", "gt", "gte", "lt", "lte"}


_SIZE_RE = re.compile(r"^(?P<value>\d+(?:\.\d+)?)(?P<unit>[KMGTP]?B)?$", re.IGNORECASE)


def parse_nl_query(text: str) -> dict[str, Any]:
    """Parse a natural-language-ish query into structured filters."""
    filters: list[FilterSpec] = []
    notes: list[str] = []
    free_terms: list[str] = []

    for token in _split_tokens(text):
        parsed = _parse_token(token)
        if parsed is None:
            free_terms.append(token)
            continue
        if isinstance(parsed, str):
            notes.append(parsed)
            continue
        filters.append(parsed)

    return {
        "query": " ".join(free_terms).strip(),
        "filters": [f.__dict__ for f in filters],
        "notes": notes,
    }


def _split_tokens(text: str) -> list[str]:
    if not text.strip():
        return []
    try:
        return shlex.split(text)
    except ValueError:
        return text.split()


def _parse_token(token: str) -> FilterSpec | str | None:
    if ":" in token:
        key, value = token.split(":", 1)
        key = key.lower()
        if key in {"ext", "type"} and value:
            return FilterSpec("ext", "eq", value.lstrip("."))
        if key == "name" and value:
            return FilterSpec("name", "contains", value)
        if key == "path" and value:
            return FilterSpec("path", "contains", value)
        if key in {"before", "after"}:
            parsed = _parse_date(value)
            if parsed is None:
                return f"Invalid date: {value}"
            return FilterSpec("mtime", "lt" if key == "before" else "gt", parsed.isoformat())
        if key == "size":
            parsed = _parse_size(value)
            if parsed is None:
                return f"Invalid size: {value}"
            return FilterSpec("size", "eq", parsed)
        return None

    for op in (">=", "<=", ">", "<"):
        if op in token:
            left, right = token.split(op, 1)
            left = left.lower().strip()
            right = right.strip()
            if left == "size":
                parsed = _parse_size(right)
                if parsed is None:
                    return f"Invalid size: {right}"
                return FilterSpec("size", op, parsed)
            if left in {"before", "after"}:
                parsed = _parse_date(right)
                if parsed is None:
                    return f"Invalid date: {right}"
                return FilterSpec("mtime", "lt" if left == "before" else "gt", parsed.isoformat())
    return None


def validate_filters(filters: list[dict]) -> tuple[list[dict], list[str]]:
    valid: list[dict] = []
    errors: list[str] = []
    for entry in filters:
        field = str(entry.get("field", "")).lower()
        op = str(entry.get("op", "")).lower()
        value = entry.get("value")
        if field not in ALLOWED_FIELDS:
            errors.append(f"Unsupported field: {field}")
            continue
        if op not in ALLOWED_OPS:
            errors.append(f"Unsupported op: {op}")
            continue
        if field == "size" and _parse_size(value) is None:
            errors.append(f"Invalid size: {value}")
            continue
        if field == "mtime" and _parse_date(value) is None:
            errors.append(f"Invalid date: {value}")
            continue
        valid.append({"field": field, "op": op, "value": value})
    return valid, errors


def _parse_size(value: str) -> int | None:
    match = _SIZE_RE.match(value.strip())
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


def _parse_date(value: str) -> date | None:
    normalized = value.strip().lower()
    today = date.today()
    if normalized == "today":
        return today
    if normalized == "yesterday":
        return today - timedelta(days=1)
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(normalized, fmt).date()
        except ValueError:
            continue
    return None
