from __future__ import annotations

from geyma.ai.provider_base import AIProvider, ProviderCapabilities
from geyma.ai.providers.dummy import DummyProvider
from geyma.ai.providers.openai import OpenAIProvider


def available_providers() -> dict[str, type[AIProvider]]:
    return {
        "none": DummyProvider,
        "openai": OpenAIProvider,
    }


def create_provider(name: str) -> AIProvider:
    providers = available_providers()
    provider_cls = providers.get(name, DummyProvider)
    return provider_cls()


def provider_capabilities(name: str) -> ProviderCapabilities:
    try:
        provider = create_provider(name)
    except Exception:
        return ProviderCapabilities()
    return provider.capabilities()
