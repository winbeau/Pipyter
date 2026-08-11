from __future__ import annotations

from pathlib import Path
from typing import Any

from ..config import _atomic_json_write, config_dir, read_json


class LocalRegistry:
    """Development connector for control-plane records.

    Production deployments replace this object with a database-backed registry
    without changing runtime/workspace contracts.
    """

    def __init__(self, path: Path | None = None):
        self.path = path or config_dir() / "registry.json"

    def snapshot(self) -> dict[str, Any]:
        return read_json(
            self.path,
            {"accounts": {}, "nodes": {}, "projects": {}, "workspaces": {}},
        )

    def upsert(self, collection: str, identifier: str, value: dict[str, Any]) -> None:
        data = self.snapshot()
        if collection not in data or not isinstance(data[collection], dict):
            raise KeyError(collection)
        data[collection][identifier] = value
        _atomic_json_write(self.path, data)

    def get(self, collection: str, identifier: str) -> dict[str, Any] | None:
        values = self.snapshot().get(collection, {})
        value = values.get(identifier) if isinstance(values, dict) else None
        return value if isinstance(value, dict) else None
