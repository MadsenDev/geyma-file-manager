from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ProviderCapabilities:
    text: bool = False
    images: bool = False


class AIProvider(ABC):
    """Base interface for BYOK AI providers."""

    @abstractmethod
    def is_configured(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def validate_key(self) -> tuple[bool, str]:
        raise NotImplementedError

    @abstractmethod
    def capabilities(self) -> ProviderCapabilities:
        raise NotImplementedError

    @abstractmethod
    def supports(self, feature: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def estimate_cost(self, feature: str, payload: dict[str, Any]) -> str:
        raise NotImplementedError

    @abstractmethod
    def run(self, feature: str, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError
