from __future__ import annotations

from typing import Any

from geyma.ai.filters import parse_nl_query
from geyma.ai.provider_registry import create_provider
from geyma.utils.config import ConfigStore


def translate_query(query: str, allow_ai: bool = False) -> dict[str, Any]:
    """Return structured filters from a query, using AI if enabled."""
    local = parse_nl_query(query)
    result: dict[str, Any] = {
        "query": local.get("query", ""),
        "filters": local.get("filters", []),
        "notes": local.get("notes", []),
        "source": "local",
        "ai": None,
        "error": "",
    }

    config = ConfigStore()
    if not allow_ai or not config.get_bool("ai_enabled", False):
        return result

    provider_name = config.get_str("ai_provider", "none")
    provider = create_provider(provider_name)
    if not provider.is_configured() or not provider.supports("text_to_filters"):
        return result

    try:
        response = provider.run("text_to_filters", {"query": query, "local": local})
    except RuntimeError as exc:
        result["error"] = str(exc)
        return result

    data = response.get("data")
    if isinstance(data, dict) and "filters" in data:
        result["filters"] = data.get("filters", result["filters"])
        result["notes"] = data.get("notes", result["notes"])
        result["ai"] = response
        result["source"] = "ai"
    return result
