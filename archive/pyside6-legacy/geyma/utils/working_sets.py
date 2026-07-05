from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from geyma.utils.config import ConfigStore


@dataclass
class WorkingSetItem:
    path: str
    last_known_location: str
    exists: bool
    last_seen_at: str

    @staticmethod
    def from_path(path: str) -> "WorkingSetItem":
        current = Path(path)
        exists = current.exists()
        now = datetime.utcnow().isoformat()
        return WorkingSetItem(
            path=str(current),
            last_known_location=str(current),
            exists=exists,
            last_seen_at=now,
        )

    def refresh(self) -> None:
        current = Path(self.path)
        self.exists = current.exists()
        if self.exists:
            self.last_known_location = str(current)
            self.last_seen_at = datetime.utcnow().isoformat()


@dataclass
class WorkingSet:
    id: str
    name: str
    description: str
    items: list[WorkingSetItem] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    last_used_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def touch(self) -> None:
        self.last_used_at = datetime.utcnow().isoformat()


class WorkingSetStore:
    def __init__(self, config: ConfigStore | None = None) -> None:
        self._config = config or ConfigStore()

    def list_sets(self) -> list[WorkingSet]:
        raw_sets = list(self._config.get("working_sets", []))
        sets: list[WorkingSet] = []
        for entry in raw_sets:
            items = [
                WorkingSetItem(
                    path=item.get("path", ""),
                    last_known_location=item.get("last_known_location", ""),
                    exists=bool(item.get("exists", False)),
                    last_seen_at=item.get("last_seen_at", ""),
                )
                for item in entry.get("items", [])
            ]
            sets.append(
                WorkingSet(
                    id=entry.get("id", ""),
                    name=entry.get("name", "Untitled"),
                    description=entry.get("description", ""),
                    items=items,
                    created_at=entry.get("created_at", datetime.utcnow().isoformat()),
                    last_used_at=entry.get("last_used_at", datetime.utcnow().isoformat()),
                )
            )
        return sets

    def create_set(self, name: str, description: str = "") -> WorkingSet:
        new_set = WorkingSet(id=str(uuid4()), name=name, description=description)
        sets = self.list_sets()
        sets.append(new_set)
        self._save_sets(sets)
        return new_set

    def rename_set(self, set_id: str, name: str) -> None:
        sets = self.list_sets()
        for item in sets:
            if item.id == set_id:
                item.name = name
                break
        self._save_sets(sets)

    def delete_set(self, set_id: str) -> None:
        sets = [item for item in self.list_sets() if item.id != set_id]
        self._save_sets(sets)

    def get_set(self, set_id: str) -> WorkingSet | None:
        for item in self.list_sets():
            if item.id == set_id:
                return item
        return None

    def add_items(self, set_id: str, paths: list[str]) -> None:
        sets = self.list_sets()
        for work_set in sets:
            if work_set.id != set_id:
                continue
            existing = {item.path for item in work_set.items}
            for path in paths:
                if path in existing:
                    continue
                work_set.items.append(WorkingSetItem.from_path(path))
            work_set.touch()
            break
        self._save_sets(sets)

    def remove_items(self, set_id: str, paths: list[str]) -> None:
        sets = self.list_sets()
        for work_set in sets:
            if work_set.id != set_id:
                continue
            work_set.items = [item for item in work_set.items if item.path not in paths]
            work_set.touch()
            break
        self._save_sets(sets)

    def refresh_set(self, set_id: str) -> WorkingSet | None:
        sets = self.list_sets()
        target = None
        for work_set in sets:
            if work_set.id == set_id:
                for item in work_set.items:
                    item.refresh()
                work_set.touch()
                target = work_set
                break
        self._save_sets(sets)
        return target

    def _save_sets(self, sets: list[WorkingSet]) -> None:
        payload: list[dict[str, Any]] = []
        for work_set in sets:
            payload.append(
                {
                    "id": work_set.id,
                    "name": work_set.name,
                    "description": work_set.description,
                    "created_at": work_set.created_at,
                    "last_used_at": work_set.last_used_at,
                    "items": [
                        {
                            "path": item.path,
                            "last_known_location": item.last_known_location,
                            "exists": item.exists,
                            "last_seen_at": item.last_seen_at,
                        }
                        for item in work_set.items
                    ],
                }
            )
        self._config.set("working_sets", payload)
        self._config.save()
