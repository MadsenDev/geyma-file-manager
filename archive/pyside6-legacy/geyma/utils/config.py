from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ConfigStore:
    def __init__(self, app_name: str = "geyma") -> None:
        self._config_dir = Path.home() / ".config" / app_name
        self._config_dir.mkdir(parents=True, exist_ok=True)
        self._config_path = self._config_dir / "config.json"
        self._data: dict[str, Any] = {}
        self._load()
        self._migrate_from_legacy()

    def _load(self) -> None:
        if not self._config_path.exists():
            return
        try:
            self._data = json.loads(self._config_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            self._data = {}

    def _migrate_from_legacy(self) -> None:
        if self._data:
            return
        legacy_path = Path.home() / ".config" / "librefiles" / "config.json"
        if not legacy_path.exists():
            return
        try:
            legacy_data = json.loads(legacy_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        self._data = legacy_data
        self.save()

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def get_str(self, key: str, default: str = "") -> str:
        value = self._data.get(key, default)
        if value is None:
            return default
        return str(value)

    def set(self, key: str, value: Any) -> None:
        self._data[key] = value

    def get_bool(self, key: str, default: bool = False) -> bool:
        value = self._data.get(key, default)
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in {"1", "true", "yes", "on"}
        return bool(value)

    def save(self) -> None:
        try:
            self._config_path.write_text(
                json.dumps(self._data, indent=2, sort_keys=True),
                encoding="utf-8",
            )
        except OSError:
            pass

    def clear(self) -> None:
        self._data = {}
        try:
            if self._config_path.exists():
                self._config_path.unlink()
        except OSError:
            pass
