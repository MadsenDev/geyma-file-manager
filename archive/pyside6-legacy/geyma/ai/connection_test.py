from __future__ import annotations

from geyma.ai.provider_registry import create_provider


def test_connection(provider_name: str) -> tuple[bool, str]:
    provider = create_provider(provider_name)
    if not provider.is_configured():
        return False, "Provider is not configured"
    return provider.validate_key()
