from __future__ import annotations

from typing import Any

from geyma.ai.provider_base import AIProvider, ProviderCapabilities


class DummyProvider(AIProvider):
    """Placeholder provider for wiring and testing."""

    def __init__(self) -> None:
        self._configured = False

    def is_configured(self) -> bool:
        return self._configured

    def validate_key(self) -> tuple[bool, str]:
        return False, "No API key configured"

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities()

    def supports(self, feature: str) -> bool:
        return False

    def estimate_cost(self, feature: str, payload: dict[str, Any]) -> str:
        return "n/a"

    def run(self, feature: str, payload: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("Dummy provider cannot run")
