from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class RuntimeState:
    workspace_id: str
    root: str
    api_pid: int | None = None
    jupyter_pid: int | None = None
    api_url: str = "http://127.0.0.1:8765"
    jupyter_url: str = "http://127.0.0.1:8888/lab"
    token_fingerprint: str | None = None
    started_at: float = 0.0
    status: str = "stopped"
    pigent_pid: int | None = None
    pigent_status: str = "stopped"
    pigent_protocol_version: str = "0.2"
    pigent_runtime_version: str | None = None
    pigent_started_at: float = 0.0
    pigent_restart_count: int = 0

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(asdict(self), indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, path)

    @classmethod
    def load(cls, path: Path) -> "RuntimeState | None":
        if not path.exists():
            return None
        data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
        return cls(**data)

    @property
    def running(self) -> bool:
        return any(pid_alive(pid) for pid in (self.api_pid, self.jupyter_pid))

    def mark_started(self) -> None:
        self.started_at = time.time()
        self.status = "running"


def pid_alive(pid: int | None) -> bool:
    if not pid or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except (OSError, ProcessLookupError):
        return False
    return True
