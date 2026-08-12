from __future__ import annotations

import asyncio
import os
import queue
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from ..protocol.models import ExecuteResponse, KernelOutput, KernelSpecSummary, KernelSummary
from .environments import KernelEnvironmentRegistry


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _filtered_kernel_env() -> dict[str, str]:
    import re
    secret = re.compile(r"(?:api[_-]?key|token|secret|password|authorization|credential|bridge|pipyter.*proxy)", re.I)
    result: dict[str, str] = {}
    for key, value in os.environ.items():
        if secret.search(key):
            continue
        if key.upper().endswith("_PROXY") and "://" in value and "@" in value.split("://", 1)[1].split("/", 1)[0]:
            continue
        result[key] = value
    return result


@dataclass
class _KernelHandle:
    id: str
    name: str
    manager: Any
    client: Any
    environment_id: str | None = None
    notebook_path: str | None = None
    language: str = "python"
    status: str = "idle"
    execution_count: int = 0
    generation: int = 1
    queue_depth: int = 0
    started_at: str = field(default_factory=_now)
    last_activity_at: str = field(default_factory=_now)
    last_error: str | None = None
    gate: threading.RLock = field(default_factory=threading.RLock)
    active_message_id: str | None = None
    active_request_id: str | None = None


class KernelRuntime:
    """Single authoritative KernelSessionRegistry and execution queue owner."""

    def __init__(self, root: Path, environments: KernelEnvironmentRegistry | None = None):
        self.root = root.resolve()
        self.environments = environments
        self._kernels: dict[str, _KernelHandle] = {}
        self._notebook_bindings: dict[str, str] = {}
        self._registry_lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="pipyter-kernel")
        self._listeners: list[Callable[[dict[str, Any]], None]] = []

    def add_listener(self, listener: Callable[[dict[str, Any]], None]) -> None:
        self._listeners.append(listener)

    def _notify(self, handle: _KernelHandle) -> None:
        value = self._summary(handle).model_dump(mode="json")
        for listener in tuple(self._listeners):
            try:
                listener(value)
            except Exception:
                continue

    def specs(self) -> list[KernelSpecSummary]:
        from jupyter_client.kernelspec import KernelSpecManager

        specs = KernelSpecManager().get_all_specs()
        result: list[KernelSpecSummary] = []
        for name, spec in sorted(specs.items()):
            metadata = spec.get("spec", {}) if isinstance(spec, dict) else {}
            result.append(KernelSpecSummary(
                name=name,
                display_name=str(metadata.get("display_name", name)),
                language=str(metadata.get("language", "python")),
                argv=list(metadata.get("argv", [])),
            ))
        return result

    def _summary(self, item: _KernelHandle) -> KernelSummary:
        return KernelSummary(
            id=item.id,
            name=item.name,
            status=item.status,
            execution_count=item.execution_count,
            environment_id=item.environment_id,
            notebook_path=item.notebook_path,
            language=item.language,
            generation=item.generation,
            queue_depth=item.queue_depth,
            started_at=item.started_at,
            last_activity_at=item.last_activity_at,
            last_error=item.last_error,
        )

    def list(self) -> list[KernelSummary]:
        with self._registry_lock:
            return [self._summary(item) for item in self._kernels.values()]

    def active_by_environment(self) -> dict[str, list[str]]:
        result: dict[str, list[str]] = {}
        with self._registry_lock:
            for handle in self._kernels.values():
                if handle.environment_id:
                    result.setdefault(handle.environment_id, []).append(handle.id)
        return result

    def bind_notebook(self, kernel_id: str, notebook_path: str) -> KernelSummary:
        resolved = (self.root / notebook_path).resolve()
        try:
            relative = resolved.relative_to(self.root).as_posix()
        except ValueError as error:
            raise ValueError("Notebook path must stay inside the Workspace") from error
        handle = self._require(kernel_id)
        with self._registry_lock:
            previous = self._notebook_bindings.get(relative)
            if previous and previous != kernel_id:
                raise RuntimeError(f"Notebook is already bound to kernel {previous}")
            if handle.notebook_path and handle.notebook_path != relative:
                self._notebook_bindings.pop(handle.notebook_path, None)
            handle.notebook_path = relative
            self._notebook_bindings[relative] = kernel_id
            self._notify(handle)
            return self._summary(handle)

    def kernel_for_notebook(self, notebook_path: str) -> str | None:
        return self._notebook_bindings.get(notebook_path)

    def start(self, kernel_name: str | None = "python3", *, environment_id: str | None = None,
              notebook_path: str | None = None) -> KernelSummary:
        from jupyter_client import KernelManager

        if environment_id and kernel_name not in {None, "", "python3"}:
            raise ValueError("Select exactly one of environment_id or kernel_name")
        manager: Any
        name: str
        if environment_id:
            if self.environments is None:
                raise KeyError(f"Unknown environment: {environment_id}")
            spec = self.environments.kernelspec(environment_id)
            from jupyter_client.kernelspec import KernelSpec
            manager = KernelManager(kernel_name="")
            manager._kernel_spec = KernelSpec.from_resource_dir(str(self.environments.path(environment_id) / "kernelspec"))
            name = str(spec.get("display_name", environment_id))
        else:
            name = kernel_name or "python3"
            manager = KernelManager(kernel_name=name)
        kernel_id = str(uuid.uuid4())
        handle = _KernelHandle(kernel_id, name, manager, None, environment_id=environment_id, status="starting")
        with self._registry_lock:
            self._kernels[kernel_id] = handle
        try:
            manager.start_kernel(cwd=str(self.root), env=_filtered_kernel_env())
            client = manager.client()
            handle.client = client
            client.start_channels()
            client.wait_for_ready(timeout=20)
            handle.status = "idle"
            handle.last_activity_at = _now()
            if notebook_path:
                self.bind_notebook(kernel_id, notebook_path)
            self._notify(handle)
            return self._summary(handle)
        except Exception:
            handle.status = "dead"
            handle.last_error = "Kernel failed to start"
            try:
                if handle.client is not None:
                    handle.client.stop_channels()
                manager.shutdown_kernel(now=True)
            except Exception:
                pass
            with self._registry_lock:
                self._kernels.pop(kernel_id, None)
            raise

    async def start_async(self, kernel_name: str | None = "python3", *, environment_id: str | None = None,
                          notebook_path: str | None = None) -> KernelSummary:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, lambda: self.start(kernel_name, environment_id=environment_id, notebook_path=notebook_path))

    def execute(
        self,
        kernel_id: str,
        code: str,
        timeout: float = 30,
        *,
        store_history: bool = True,
        _cancel_event: threading.Event | None = None,
        _request_id: str | None = None,
    ) -> ExecuteResponse:
        handle = self._require(kernel_id)
        request_id = _request_id or "execute_" + uuid.uuid4().hex
        with self._registry_lock:
            handle.queue_depth += 1
            self._notify(handle)
        entered_gate = False
        try:
            with handle.gate:
                entered_gate = True
                handle.queue_depth -= 1
                if _cancel_event is not None and _cancel_event.is_set():
                    raise RuntimeError("Kernel execution cancelled before start")
                if handle.status == "dead" or not self._is_alive(handle):
                    handle.status = "dead"
                    raise RuntimeError("Kernel is dead")
                handle.status = "busy"
                handle.active_request_id = request_id
                handle.last_activity_at = _now()
                handle.last_error = None
                self._notify(handle)
                message_id = handle.client.execute(code, store_history=store_history)
                handle.active_message_id = message_id
                outputs: list[KernelOutput] = []
                execution_count = handle.execution_count
                deadline = time.monotonic() + timeout
                cancelled = False
                interrupt_sent = False
                while True:
                    if _cancel_event is not None and _cancel_event.is_set():
                        cancelled = True
                        if not interrupt_sent:
                            try:
                                handle.manager.interrupt_kernel()
                            except Exception:
                                pass
                            interrupt_sent = True
                    remaining = max(0.01, deadline - time.monotonic())
                    try:
                        message = handle.client.get_iopub_msg(timeout=remaining)
                    except queue.Empty as error:
                        try:
                            handle.manager.interrupt_kernel()
                        except Exception:
                            pass
                        handle.status = "idle" if self._is_alive(handle) else "dead"
                        handle.last_error = f"Kernel execution timed out after {timeout}s"
                        raise TimeoutError(handle.last_error) from error
                    parent_id = message.get("parent_header", {}).get("msg_id")
                    if parent_id != message_id:
                        continue
                    message_type = message.get("header", {}).get("msg_type")
                    content = message.get("content", {})
                    if message_type == "status":
                        state = content.get("execution_state")
                        if state in {"idle", "busy", "starting"}:
                            handle.status = state
                        if handle.status == "idle":
                            break
                    elif message_type == "execute_input":
                        reported = int(content.get("execution_count", execution_count + 1))
                        execution_count = reported if store_history else handle.execution_count
                    elif message_type == "stream":
                        outputs.append(KernelOutput(type="stream", text=str(content.get("text", "")), name=content.get("name")))
                    elif message_type in {"execute_result", "display_data"}:
                        data = content.get("data", {})
                        outputs.append(KernelOutput(type="execute_result" if message_type == "execute_result" else "display_data",
                                                    text=str(data.get("text/plain", "")), data=data))
                    elif message_type == "error":
                        outputs.append(KernelOutput(type="error", text=f"{content.get('ename', 'Error')}: {content.get('evalue', '')}",
                                                    traceback=list(content.get("traceback", []))))
                if cancelled:
                    raise RuntimeError("Kernel execution cancelled")
                handle.execution_count = execution_count if store_history else handle.execution_count
                handle.status = "idle"
                handle.last_activity_at = _now()
                return ExecuteResponse(kernel_id=kernel_id, execution_count=execution_count, status="idle", outputs=outputs,
                                       generation=handle.generation, partial=False)
        finally:
            if not entered_gate:
                with self._registry_lock:
                    handle.queue_depth = max(0, handle.queue_depth - 1)
            handle.active_message_id = None
            if handle.active_request_id == request_id:
                handle.active_request_id = None
            if handle.status == "busy":
                handle.status = "idle" if self._is_alive(handle) else "dead"
            handle.last_activity_at = _now()
            self._notify(handle)

    async def execute_async(self, kernel_id: str, code: str, timeout: float = 30, *, store_history: bool = True) -> ExecuteResponse:
        loop = asyncio.get_running_loop()
        cancel_event = threading.Event()
        request_id = "execute_" + uuid.uuid4().hex
        future = loop.run_in_executor(
            self._executor,
            lambda: self.execute(
                kernel_id,
                code,
                timeout,
                store_history=store_history,
                _cancel_event=cancel_event,
                _request_id=request_id,
            ),
        )
        try:
            return await asyncio.shield(future)
        except asyncio.CancelledError:
            cancel_event.set()
            try:
                handle = self._require(kernel_id)
                if handle.active_request_id == request_id and handle.status == "busy":
                    handle.manager.interrupt_kernel()
            except Exception:
                pass
            await asyncio.gather(asyncio.shield(future), return_exceptions=True)
            raise

    def interrupt(self, kernel_id: str) -> KernelSummary:
        handle = self._require(kernel_id)
        # Interrupt intentionally does not wait for the execution gate: it must
        # be able to stop the active owner. The execution worker confirms idle.
        if handle.status == "dead" or not self._is_alive(handle):
            handle.status = "dead"
            raise RuntimeError("Kernel is dead")
        handle.manager.interrupt_kernel()
        handle.last_activity_at = _now()
        self._notify(handle)
        return self._summary(handle)

    async def interrupt_async(self, kernel_id: str) -> KernelSummary:
        return await asyncio.get_running_loop().run_in_executor(self._executor, lambda: self.interrupt(kernel_id))

    def restart(self, kernel_id: str) -> KernelSummary:
        handle = self._require(kernel_id)
        with handle.gate:
            handle.status = "restarting"
            self._notify(handle)
            try:
                handle.manager.restart_kernel(now=True)
                handle.client.wait_for_ready(timeout=20)
            except Exception:
                handle.status = "dead"
                handle.last_error = "Kernel restart failed"
                self._notify(handle)
                raise
            handle.status = "idle"
            handle.execution_count = 0
            handle.generation += 1
            handle.last_activity_at = _now()
            handle.last_error = None
            self._notify(handle)
            return self._summary(handle)

    async def restart_async(self, kernel_id: str) -> KernelSummary:
        return await asyncio.get_running_loop().run_in_executor(self._executor, lambda: self.restart(kernel_id))

    def shutdown(self, kernel_id: str) -> None:
        handle = self._require(kernel_id)
        with handle.gate:
            handle.status = "stopping"
            self._notify(handle)
            try:
                if handle.client is not None:
                    handle.client.stop_channels()
            finally:
                try:
                    handle.manager.shutdown_kernel(now=True)
                finally:
                    with self._registry_lock:
                        self._kernels.pop(kernel_id, None)
                        if handle.notebook_path:
                            self._notebook_bindings.pop(handle.notebook_path, None)

    async def shutdown_async(self, kernel_id: str) -> None:
        await asyncio.get_running_loop().run_in_executor(self._executor, lambda: self.shutdown(kernel_id))

    def mark_dead(self, kernel_id: str, message: str = "Kernel process exited") -> KernelSummary:
        handle = self._require(kernel_id)
        handle.status = "dead"
        handle.last_error = message
        handle.last_activity_at = _now()
        self._notify(handle)
        return self._summary(handle)

    def cleanup_idle(self, max_idle_seconds: float, now_monotonic: float | None = None) -> list[str]:
        current = datetime.now(timezone.utc)
        removed: list[str] = []
        for summary in self.list():
            if summary.status != "idle" or summary.queue_depth:
                continue
            last = datetime.fromisoformat(summary.last_activity_at) if summary.last_activity_at else current
            if (current - last).total_seconds() >= max_idle_seconds:
                try:
                    self.shutdown(summary.id)
                    removed.append(summary.id)
                except Exception:
                    continue
        return removed

    def shutdown_all(self) -> None:
        errors = []
        for kernel_id in [item.id for item in self.list()]:
            try:
                self.shutdown(kernel_id)
            except Exception as error:
                errors.append(error)
        self._executor.shutdown(wait=True, cancel_futures=True)
        if errors:
            raise RuntimeError(f"Failed to shut down {len(errors)} kernel(s)") from errors[0]

    async def shutdown_all_async(self) -> None:
        ids = [item.id for item in self.list()]
        await asyncio.gather(*(self.shutdown_async(kernel_id) for kernel_id in ids), return_exceptions=True)
        self._executor.shutdown(wait=True, cancel_futures=True)

    def _is_alive(self, handle: _KernelHandle) -> bool:
        try:
            return bool(handle.manager.is_alive())
        except Exception:
            return handle.status != "dead"

    def _require(self, kernel_id: str) -> _KernelHandle:
        try:
            return self._kernels[kernel_id]
        except KeyError as error:
            raise KeyError(f"Unknown kernel: {kernel_id}") from error


KernelSessionRegistry = KernelRuntime
