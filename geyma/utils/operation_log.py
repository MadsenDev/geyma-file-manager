from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
from typing import Iterable

from geyma.utils.config import ConfigStore


class OperationLog:
    def __init__(self, config: ConfigStore | None = None) -> None:
        self._config = config or ConfigStore()
        self._log_path = self._resolve_log_path()

    def append(
        self,
        action: str,
        sources: Iterable[str],
        destinations: Iterable[str] | None = None,
        success: bool = True,
        error: str = "",
    ) -> None:
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "sources": list(sources),
            "destinations": list(destinations or []),
            "success": success,
            "error": error,
        }
        try:
            self._log_path.parent.mkdir(parents=True, exist_ok=True)
            with self._log_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry) + "\n")
            self._enforce_max_size()
        except OSError:
            return

    def iter_entries(self, limit: int | None = None) -> list[dict]:
        if not self._log_path.exists():
            return []
        entries: list[dict] = []
        with self._log_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        if limit:
            return entries[-limit:]
        return entries

    def clear(self) -> None:
        if self._log_path.exists():
            self._log_path.unlink()

    def _resolve_log_path(self) -> Path:
        log_path = self._config.get_str(
            "operation_log_path",
            str(Path.home() / ".cache/geyma/logs/operation_log.jsonl"),
        )
        return Path(log_path)

    def _enforce_max_size(self) -> None:
        max_mb = int(self._config.get("operation_log_max_mb", 5))
        if max_mb <= 0:
            return
        if not self._log_path.exists():
            return
        size_mb = self._log_path.stat().st_size / (1024 * 1024)
        if size_mb <= max_mb:
            return
        entries = self.iter_entries()
        if not entries:
            return
        keep = entries[len(entries) // 2 :]
        with self._log_path.open("w", encoding="utf-8") as handle:
            for entry in keep:
                handle.write(json.dumps(entry) + "\n")
