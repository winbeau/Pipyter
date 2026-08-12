from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from .environments import KernelEnvironmentRegistry
from .manager import KernelRuntime
from .operations import OperationManager


class KernelCleanupService:
    """Conservative temporary-environment and idle/dead Kernel cleanup."""

    def __init__(self, environments: KernelEnvironmentRegistry, kernels: KernelRuntime, operations: OperationManager):
        self.environments = environments
        self.kernels = kernels
        self.operations = operations
        self._task: asyncio.Task[None] | None = None
        self._stop = asyncio.Event()

    def start(self, interval_seconds: float = 60) -> None:
        if self._task is None or self._task.done():
            self._stop.clear()
            self._task = asyncio.create_task(self._loop(interval_seconds))

    async def _loop(self, interval_seconds: float) -> None:
        while not self._stop.is_set():
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=interval_seconds)
            except TimeoutError:
                self.run_once()

    def run_once(self) -> dict[str, Any]:
        active = set(self.kernels.active_by_environment())
        active_operations = {
            operation.resource.id
            for operation in self.operations._operations.values()
            if operation.state in {"queued", "running", "waiting_for_user"}
        }
        removed = []
        for environment_id in self.environments.expired_temporary_ids(active | active_operations, datetime.now(timezone.utc)):
            try:
                self.environments.delete(environment_id)
                removed.append(environment_id)
            except Exception:
                continue
        return {"removed_environment_ids": removed}

    async def shutdown(self) -> None:
        self._stop.set()
        if self._task is not None:
            await asyncio.gather(self._task, return_exceptions=True)
            self._task = None
