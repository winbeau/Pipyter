from __future__ import annotations

import asyncio
import json
import os
import re
import signal
import uuid
from pathlib import Path
from typing import Any, Awaitable, Callable

from ..protocol.pigent import OperationEnvelope, OperationProgress, OperationResource, PigentToolError, ToolReceipt
from .environments import KernelEnvironmentError, KernelEnvironmentRegistry, atomic_json, now


_SECRET_ENV = re.compile(r"(?:api[_-]?key|token|secret|password|authorization|credential|bridge|pipyter.*proxy)", re.I)
_CREDENTIAL_URL = re.compile(r"(?P<scheme>https?://)[^\s/@:]+:[^\s/@]+@", re.I)
_TERMINAL_STATES = {"succeeded", "failed", "cancelled"}
_ACTIVE_STATES = {"queued", "running", "waiting_for_user"}


def sanitized_child_env() -> dict[str, str]:
    result: dict[str, str] = {}
    for key, value in os.environ.items():
        if _SECRET_ENV.search(key):
            continue
        if key.upper().endswith("_PROXY") and "://" in value and "@" in value.split("://", 1)[1].split("/", 1)[0]:
            continue
        result[key] = value
    return result


def redact(value: str, limit: int = 4000) -> str:
    text = _CREDENTIAL_URL.sub(r"\g<scheme>[redacted]@", value)
    return text[:limit] + (f"…[truncated {len(text) - limit} chars]" if len(text) > limit else "")


class OperationManager:
    def __init__(
        self,
        environments: KernelEnvironmentRegistry,
        workspace: Path,
        *,
        on_event: Callable[[str, dict[str, Any]], Awaitable[None] | None] | None = None,
    ):
        self.environments = environments
        self.workspace = workspace.resolve()
        self.on_event = on_event
        self.state_root = self.environments.root / "operations"
        self.state_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.state_root, 0o700)
        self._operations: dict[str, OperationEnvelope] = {}
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._reserved: dict[str, str] = {}
        self._processes: dict[str, asyncio.subprocess.Process] = {}
        self._load_and_reconcile()

    def _path(self, operation_id: str) -> Path:
        return self.state_root / f"{operation_id}.json"

    def _persist(self, operation: OperationEnvelope) -> None:
        atomic_json(self._path(operation.operation_id), operation.model_dump(mode="json"))

    def _load_and_reconcile(self) -> None:
        interrupted_environments: set[str] = set()
        for path in sorted(self.state_root.glob("op_*.json")):
            try:
                operation = OperationEnvelope.model_validate(json.loads(path.read_text(encoding="utf-8")))
            except Exception:
                continue
            if operation.state in _ACTIVE_STATES:
                operation.state = "failed"
                operation.cancellable = False
                operation.updated_at = now()
                operation.progress = OperationProgress(phase="complete", completed=1, total=1, message="Operation interrupted by Runtime restart")
                operation.error = PigentToolError(code="internal_error", message="Operation was interrupted by Runtime restart", retryable=True, details={})
                operation.receipt = ToolReceipt(
                    outcome="failed",
                    summary="Operation interrupted by Runtime restart",
                    identifiers={"environment_id": operation.resource.id, "operation_id": operation.operation_id},
                    at=operation.updated_at,
                )
                interrupted_environments.add(operation.resource.id)
                self._persist(operation)
            self._operations[operation.operation_id] = operation
        for environment_id in interrupted_environments:
            try:
                value = self.environments.get(environment_id)
                if value["status"] in {"provisioning", "syncing", "deleting"}:
                    self.environments.update(
                        environment_id,
                        status="error" if value["status"] == "provisioning" else "stale",
                        last_error={"code": "internal_error", "message": "Environment operation was interrupted by Runtime restart", "retryable": True, "details": {}},
                    )
            except KernelEnvironmentError:
                continue
        for environment_id, value in [(item.id, item.model_dump(mode="json")) for item in self.environments.summaries()]:
            if value["status"] in {"provisioning", "syncing", "deleting"} and environment_id not in interrupted_environments:
                self.environments.update(
                    environment_id,
                    status="error" if value["status"] == "provisioning" else "stale",
                    last_error={"code": "internal_error", "message": "Incomplete environment state was recovered after Runtime restart", "retryable": True, "details": {}},
                )

    async def _emit(self, event_type: str, operation: OperationEnvelope) -> None:
        if self.on_event is None:
            return
        value = self.on_event(event_type, {"operation": operation.model_dump(mode="json")})
        if asyncio.iscoroutine(value):
            await value

    def get(self, operation_id: str) -> OperationEnvelope:
        try:
            return self._operations[operation_id]
        except KeyError as error:
            raise KernelEnvironmentError("not_found", f"Operation not found: {operation_id}") from error

    def _reserve(self, environment_id: str, operation_id: str) -> None:
        active = self._reserved.get(environment_id)
        if active is not None:
            raise KernelEnvironmentError("kernel_environment_busy", f"Environment already has active operation {active}")
        self._reserved[environment_id] = operation_id

    def _release(self, operation: OperationEnvelope) -> None:
        if self._reserved.get(operation.resource.id) == operation.operation_id:
            self._reserved.pop(operation.resource.id, None)
        self._processes.pop(operation.operation_id, None)

    async def cancel(self, operation_id: str) -> OperationEnvelope:
        operation = self.get(operation_id)
        if operation.state in _TERMINAL_STATES:
            return operation
        if not operation.cancellable:
            raise KernelEnvironmentError("operation_not_cancellable", "Operation is no longer cancellable")
        task = self._tasks.get(operation_id)
        if task is None or task.done():
            return self.get(operation_id)
        operation.progress = OperationProgress(
            phase="cancelling",
            completed=operation.progress.completed if operation.progress else 0,
            total=operation.progress.total if operation.progress else None,
            message="Cancellation requested",
        )
        operation.updated_at = now()
        self._persist(operation)
        await self._emit("operation.updated", operation)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        return self.get(operation_id)

    def _accepted(self, kind: str, environment_id: str, session_id: str | None, tool_call_id: str | None) -> OperationEnvelope:
        operation_id = "op_" + uuid.uuid4().hex
        self._reserve(environment_id, operation_id)
        created = now()
        operation = OperationEnvelope(
            operation_id=operation_id,
            kind=kind,
            state="queued",
            progress=OperationProgress(phase="queued", completed=0, total=None, message="Operation accepted"),
            resource=OperationResource(type="kernel_environment", id=environment_id),
            created_at=created,
            updated_at=created,
            session_id=session_id,
            tool_call_id=tool_call_id,
            cancellable=True,
        )
        self._operations[operation_id] = operation
        self._persist(operation)
        return operation

    def _schedule(self, operation: OperationEnvelope, coroutine: Awaitable[None]) -> OperationEnvelope:
        self._tasks[operation.operation_id] = asyncio.create_task(coroutine)
        return operation

    def create_temporary(self, request: dict[str, Any], *, session_id: str | None = None, tool_call_id: str | None = None) -> OperationEnvelope:
        value = self.environments.reserve_temporary(request)
        try:
            operation = self._accepted("kernel_environment.provision", value["id"], session_id, tool_call_id)
        except Exception:
            self.environments.delete(value["id"])
            raise
        return self._schedule(operation, self._provision(operation, request))

    def create_maintained(self, request: dict[str, Any], *, session_id: str | None = None, tool_call_id: str | None = None) -> OperationEnvelope:
        value = self.environments.reserve_maintained(request, self.workspace)
        try:
            operation = self._accepted("kernel_environment.provision", value["id"], session_id, tool_call_id)
        except Exception:
            self.environments.delete(value["id"])
            raise
        return self._schedule(operation, self._provision(operation, request))

    def sync(self, environment_id: str, *, session_id: str | None = None, tool_call_id: str | None = None) -> OperationEnvelope:
        value = self.environments.get(environment_id)
        if value["kind"] != "maintained":
            raise KernelEnvironmentError("kernel_environment_conflict", "Only maintained environments can be synced")
        operation = self._accepted("kernel_environment.sync", environment_id, session_id, tool_call_id)
        return self._schedule(operation, self._sync(operation))

    def promote(self, environment_id: str, name: str, display_name: str | None = None, *, session_id: str | None = None, tool_call_id: str | None = None) -> OperationEnvelope:
        self.environments.get(environment_id)
        operation = self._accepted("kernel_environment.promote", environment_id, session_id, tool_call_id)
        return self._schedule(operation, self._promote(operation, name, display_name))

    def delete(self, environment_id: str, *, session_id: str | None = None, tool_call_id: str | None = None) -> OperationEnvelope:
        self.environments.get(environment_id)
        operation = self._accepted("kernel_environment.delete", environment_id, session_id, tool_call_id)
        return self._schedule(operation, self._delete(operation))

    async def _set(self, operation: OperationEnvelope, *, state: str | None = None, phase: str | None = None,
                   completed: int | None = None, total: int | None = None, message: str | None = None,
                   cancellable: bool | None = None) -> None:
        if state is not None:
            operation.state = state  # type: ignore[assignment]
        if phase is not None:
            operation.progress = OperationProgress(
                phase=phase,
                completed=completed if completed is not None else (operation.progress.completed if operation.progress else 0),
                total=total,
                message=message or "",
            )
        if cancellable is not None:
            operation.cancellable = cancellable
        operation.updated_at = now()
        self._persist(operation)
        await self._emit("operation.started" if state == "running" and phase == "prepare" else "operation.updated", operation)

    async def _finish(self, operation: OperationEnvelope, outcome: str, summary: str, *, error: KernelEnvironmentError | None = None) -> None:
        operation.state = {"success": "succeeded", "cancelled": "cancelled"}.get(outcome, "failed")  # type: ignore[assignment]
        operation.cancellable = False
        operation.updated_at = now()
        operation.progress = OperationProgress(phase="complete", completed=1, total=1, message=summary)
        operation.receipt = ToolReceipt(
            outcome=outcome, summary=summary,
            identifiers={"environment_id": operation.resource.id, "operation_id": operation.operation_id},
            at=operation.updated_at,
        )  # type: ignore[arg-type]
        if error is not None:
            operation.error = PigentToolError(code=error.code, message=str(error), retryable=False, details=error.details)  # type: ignore[arg-type]
        self._persist(operation)
        self._release(operation)
        await self._emit("operation.ended", operation)

    async def _terminate(self, process: asyncio.subprocess.Process) -> None:
        if process.returncode is not None:
            return
        try:
            if os.name == "posix":
                os.killpg(process.pid, signal.SIGTERM)
            else:  # pragma: no cover - Windows
                process.terminate()
        except ProcessLookupError:
            return
        try:
            await asyncio.wait_for(process.wait(), 5)
        except TimeoutError:
            try:
                if os.name == "posix":
                    os.killpg(process.pid, signal.SIGKILL)
                else:  # pragma: no cover - Windows
                    process.kill()
            except ProcessLookupError:
                return
            await process.wait()

    async def _run(self, operation: OperationEnvelope, argv: list[str], *, cwd: Path | None = None, timeout: float = 900) -> tuple[int, str, str]:
        try:
            process = await asyncio.create_subprocess_exec(
                *argv,
                cwd=cwd,
                env=sanitized_child_env(),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=os.name == "posix",
            )
            self._processes[operation.operation_id] = process
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout)
            except TimeoutError as error:
                await self._terminate(process)
                raise KernelEnvironmentError("kernel_environment_provision_failed", "Environment command timed out") from error
            finally:
                if self._processes.get(operation.operation_id) is process:
                    self._processes.pop(operation.operation_id, None)
            return process.returncode or 0, stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace")
        except asyncio.CancelledError:
            process = self._processes.get(operation.operation_id)
            if process is not None:
                await asyncio.shield(self._terminate(process))
            raise
        except OSError as error:
            raise KernelEnvironmentError("kernel_environment_provision_failed", "Environment command could not start") from error

    async def _provision(self, operation: OperationEnvelope, request: dict[str, Any]) -> None:
        environment_id = operation.resource.id
        lock = self._locks.setdefault(environment_id, asyncio.Lock())
        try:
            async with lock:
                finding = self.environments.require_uv()
                directory = self.environments.path(environment_id)
                venv = directory / "pyvenv"
                await self._set(operation, state="running", phase="prepare", completed=0, total=3, message="Preparing environment")
                returncode, stdout, stderr = await self._run(operation, [finding.executable or "uv", "venv", str(venv), "--python", self.environments.get(environment_id)["python_request"]])
                if returncode != 0:
                    raise KernelEnvironmentError("kernel_environment_provision_failed", redact(stderr or stdout or "uv venv failed"))
                await self._set(operation, phase="install_packages", completed=1, total=3, message="Installing ipykernel and packages")
                interpreter = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
                packages = ["ipykernel", *self.environments.get(environment_id).get("requested_packages", [])]
                returncode, stdout, stderr = await self._run(operation, [finding.executable or "uv", "pip", "install", "--python", str(interpreter), *packages])
                if returncode != 0:
                    raise KernelEnvironmentError("kernel_environment_provision_failed", redact(stderr or stdout or "uv pip failed"))
                await self._set(operation, phase="verify", completed=2, total=3, message="Verifying interpreter")
                returncode, stdout, _stderr = await self._run(operation, [str(interpreter), "-c", "import ipykernel,sys,json;print(json.dumps({'version':sys.version.split()[0]}))"])
                if returncode != 0:
                    raise KernelEnvironmentError("kernel_environment_provision_failed", "Environment validation failed")
                python_version = json.loads(stdout.strip().splitlines()[-1])["version"]
                self.environments.update(environment_id, status="ready", python_version=python_version, last_error=None)
                self.environments.write_kernelspec(environment_id)
                await self._finish(operation, "success", "Kernel environment is ready")
        except asyncio.CancelledError:
            try:
                self.environments.update(environment_id, status="error", last_error={"code": "cancelled", "message": "Provision cancelled", "retryable": True, "details": {}})
            except KernelEnvironmentError:
                pass
            await asyncio.shield(self._finish(operation, "cancelled", "Kernel environment provisioning cancelled"))
        except KernelEnvironmentError as error:
            self.environments.update(environment_id, status="error", last_error={"code": error.code, "message": str(error), "retryable": False, "details": error.details})
            await self._finish(operation, "failed", "Kernel environment provisioning failed", error=error)

    async def _sync(self, operation: OperationEnvelope) -> None:
        environment_id = operation.resource.id
        lock = self._locks.setdefault(environment_id, asyncio.Lock())
        try:
            async with lock:
                value = self.environments.get(environment_id)
                self.environments.update(environment_id, status="syncing")
                await self._set(operation, state="running", phase="prepare", completed=0, total=2, message="Preparing sync")
                finding = self.environments.require_uv()
                interpreter = self.environments.path(environment_id) / value["interpreter"]
                source = value.get("project_source")
                if source:
                    project_source = self.environments.validate_persisted_source(environment_id, self.workspace)
                    argv = [finding.executable or "uv", "pip", "install", "--python", str(interpreter), "-e", str(project_source["path"])]
                    lock_revision = project_source["content_revision"]
                else:
                    argv = [finding.executable or "uv", "pip", "install", "--python", str(interpreter), *value.get("requested_packages", [])]
                    lock_revision = None
                returncode, stdout, stderr = await self._run(operation, argv)
                if returncode != 0:
                    raise KernelEnvironmentError("kernel_environment_sync_failed", redact(stderr or stdout or "uv sync failed"))
                self.environments.update(environment_id, status="ready", lock_revision=lock_revision, last_error=None)
                await self._finish(operation, "success", "Kernel environment synchronized")
        except asyncio.CancelledError:
            try:
                self.environments.update(environment_id, status="stale", last_error={"code": "cancelled", "message": "Sync cancelled", "retryable": True, "details": {}})
            except KernelEnvironmentError:
                pass
            await asyncio.shield(self._finish(operation, "cancelled", "Kernel environment sync cancelled"))
        except KernelEnvironmentError as error:
            self.environments.update(environment_id, status="error", last_error={"code": error.code, "message": str(error), "retryable": False, "details": error.details})
            await self._finish(operation, "failed", "Kernel environment sync failed", error=error)

    async def _promote(self, operation: OperationEnvelope, name: str, display_name: str | None) -> None:
        lock = self._locks.setdefault(operation.resource.id, asyncio.Lock())
        try:
            async with lock:
                await self._set(operation, state="running", phase="prepare", completed=0, total=1, message="Promoting temporary environment", cancellable=False)
                self.environments.promote(operation.resource.id, name, display_name)
                await self._finish(operation, "success", "Temporary environment promoted")
        except asyncio.CancelledError:
            await asyncio.shield(self._finish(operation, "cancelled", "Environment promotion cancelled"))
        except KernelEnvironmentError as error:
            await self._finish(operation, "failed", "Environment promotion failed", error=error)

    async def _delete(self, operation: OperationEnvelope) -> None:
        lock = self._locks.setdefault(operation.resource.id, asyncio.Lock())
        try:
            async with lock:
                await self._set(operation, state="running", phase="delete", completed=0, total=1, message="Deleting environment", cancellable=False)
                self.environments.update(operation.resource.id, status="deleting")
                self.environments.delete(operation.resource.id)
                await self._finish(operation, "success", "Kernel environment deleted")
        except asyncio.CancelledError:
            try:
                self.environments.update(operation.resource.id, status="stale")
            except KernelEnvironmentError:
                pass
            await asyncio.shield(self._finish(operation, "cancelled", "Environment deletion cancelled"))
        except KernelEnvironmentError as error:
            await self._finish(operation, "failed", "Environment deletion failed", error=error)

    async def shutdown(self) -> None:
        tasks = [task for task in self._tasks.values() if not task.done()]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
