from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from ..protocol.pigent import PIGENT_TOOL_NAMES, PigentMode, PigentToolContext, PigentToolResult
from .inspect import ArtifactRegistry, InspectionService
from .models import ToolFailure
from .modes import normalize_mode, validate_action
from .notebook import NotebookService
from .tools import BashToolService, FileToolService

ToolHandler = Callable[[dict[str, Any], PigentToolContext], Awaitable[PigentToolResult]]


class InternalToolRequest(BaseModel):
    context: PigentToolContext
    arguments: dict[str, Any] = Field(default_factory=dict)


@dataclass(slots=True)
class BridgeSession:
    session_id: str
    workspace_id: str
    workspace: Path
    mode: PigentMode
    active_document: str | None = None
    active_kernel_id: str | None = None


@dataclass(slots=True)
class _WorkspaceServices:
    artifacts: ArtifactRegistry
    files: FileToolService
    bash: BashToolService
    notebooks: NotebookService
    inspection: InspectionService


@dataclass(slots=True)
class _Cached:
    fingerprint: str
    result: PigentToolResult
    expires_at: float


class PigentBridge:
    """Authenticated Python-owned dispatch for Pigent's public tools."""

    def __init__(
        self,
        workspace: Path,
        workspace_id: str,
        kernels: Any,
        *,
        terminal_sessions: Any | None = None,
        environments: Any | None = None,
        operations: Any | None = None,
        idempotency_ttl: float = 300,
    ):
        self.workspace = workspace.expanduser().resolve()
        self.workspace_id = workspace_id
        self.kernels = kernels
        self.environments = environments
        self.operations = operations
        self.terminal_sessions = terminal_sessions
        self.idempotency_ttl = idempotency_ttl
        self.artifacts = ArtifactRegistry(self.workspace)
        self.files = FileToolService(self.workspace, self.artifacts)
        self.bash_service = BashToolService(self.workspace, terminal_sessions=terminal_sessions)
        self.notebooks = NotebookService(self.workspace, kernels)
        self.inspection = InspectionService(kernels, self.artifacts)
        self._workspace_services: dict[Path, _WorkspaceServices] = {
            self.workspace: _WorkspaceServices(
                self.artifacts, self.files, self.bash_service, self.notebooks, self.inspection,
            ),
        }
        self.sessions: dict[str, BridgeSession] = {}
        self.handlers: dict[str, ToolHandler] = {}
        self._cache: dict[tuple[str, str], _Cached] = {}
        self._call_locks: dict[tuple[str, str], asyncio.Lock] = {}

    def register_session(
        self,
        session_id: str,
        *,
        mode: Any,
        workspace: Path | None = None,
        active_document: str | None = None,
        active_kernel_id: str | None = None,
    ) -> BridgeSession:
        session_workspace = (workspace or self.workspace).expanduser().resolve()
        try:
            session_workspace.relative_to(self.workspace)
        except ValueError as error:
            raise ValueError("Session workspace must stay inside the Runtime Workspace") from error
        if not session_workspace.is_dir():
            raise NotADirectoryError(session_workspace)
        session = BridgeSession(
            session_id, self.workspace_id, session_workspace, normalize_mode(mode), active_document, active_kernel_id,
        )
        self.sessions[session_id] = session
        return session

    def update_session(
        self,
        session_id: str,
        *,
        mode: Any | None = None,
        active_document: str | None = None,
        clear_active_document: bool = False,
        active_kernel_id: str | None = None,
        clear_active_kernel: bool = False,
    ) -> None:
        session = self._session(session_id)
        if mode is not None:
            session.mode = normalize_mode(mode)
        if clear_active_document or active_document is not None:
            session.active_document = active_document
        if clear_active_kernel or active_kernel_id is not None:
            session.active_kernel_id = active_kernel_id

    async def cancel_session(self, session_id: str) -> None:
        """Cancel long-running bridge-owned work that outlives the host tool call."""
        if self.operations is not None:
            await self.operations.cancel_for_session(session_id)

    def register_handler(self, tool: str, handler: ToolHandler) -> None:
        if tool not in PIGENT_TOOL_NAMES:
            raise ValueError(f"Unknown Pigent tool: {tool}")
        self.handlers[tool] = handler

    async def dispatch(self, tool: str, arguments: dict[str, Any], context: PigentToolContext) -> PigentToolResult:
        if tool not in PIGENT_TOOL_NAMES:
            return ToolFailure("invalid_request", f"Unknown Pigent tool: {tool}").result()
        try:
            session = self._session(context.session_id)
            if context.workspace_id != session.workspace_id:
                raise ToolFailure("permission_denied", "Session does not own the requested workspace")
            if session.active_kernel_id:
                owns_workspace = getattr(self.kernels, "owns_workspace", None)
                if callable(owns_workspace) and not owns_workspace(session.active_kernel_id, session.workspace):
                    raise ToolFailure("permission_denied", "Active Kernel belongs to a different project Workspace")
            trusted = context.model_copy(update={
                "mode": session.mode,
                "workspace_id": session.workspace_id,
                "active_document": {"path": session.active_document} if session.active_document else None,
                "active_kernel_id": session.active_kernel_id,
            })
            validate_action(session.mode, tool, arguments)
            key = (session.session_id, context.tool_call_id)
            fingerprint = hashlib.sha256(json.dumps([tool, arguments], sort_keys=True, default=str).encode()).hexdigest()
            lock = self._call_locks.setdefault(key, asyncio.Lock())
            async with lock:
                now = time.monotonic()
                self._prune(now)
                cached = self._cache.get(key)
                if cached is not None:
                    if cached.fingerprint != fingerprint:
                        raise ToolFailure("invalid_request", "tool_call_id was reused with different arguments")
                    return cached.result.model_copy(deep=True)
                result = await self._invoke(tool, arguments, trusted)
                self._cache[key] = _Cached(fingerprint, result.model_copy(deep=True), now + self.idempotency_ttl)
                return result
        except asyncio.CancelledError:
            return ToolFailure("cancelled", "Tool call was cancelled", True).result()
        except ToolFailure as error:
            return error.result()
        except Exception as error:
            return ToolFailure("internal_error", str(error)).result()

    async def _invoke(self, tool: str, arguments: dict[str, Any], context: PigentToolContext) -> PigentToolResult:
        session = self._session(context.session_id)
        services = self._services(session.workspace)
        if tool == "read":
            return await services.files.read(arguments)
        if tool == "view":
            return await services.files.view(arguments)
        if tool == "write":
            return await services.files.write(arguments)
        if tool == "update":
            return await services.files.update(arguments)
        if tool == "bash":
            return await services.bash.bash(arguments)
        if tool == "notebook":
            notebook_arguments = dict(arguments)
            active_document = context.active_document or {}
            if not notebook_arguments.get("path") and active_document.get("path"):
                notebook_arguments["path"] = active_document["path"]
            return await services.notebooks.dispatch(notebook_arguments, kernel_id=context.active_kernel_id)
        if tool == "kernel":
            return await self._kernel(arguments, context.active_kernel_id, context)
        if tool == "inspect":
            return await services.inspection.inspect(arguments, kernel_id=context.active_kernel_id)
        handler = self.handlers.get(tool)
        if handler is None:
            raise ToolFailure("service_unavailable", f"{tool} is not connected in the Phase 2 bridge")
        return await handler(arguments, context)

    async def _kernel(self, arguments: dict[str, Any], kernel_id: str | None, context: PigentToolContext) -> PigentToolResult:
        action = arguments.get("action")
        if action == "status":
            if kernel_id is None:
                return PigentToolResult(ok=True, summary="No active kernel", data={"status": "unavailable"})
            items = [item for item in self.kernels.list() if item.id == kernel_id]
            if not items:
                raise ToolFailure("kernel_unavailable", "Active kernel is unavailable")
            item = items[0]
            data = item.model_dump() if hasattr(item, "model_dump") else dict(item)
            return PigentToolResult(ok=True, summary=f"Kernel {data.get('status', 'unknown')}", data=data)
        if action == "list_environments":
            if self.environments is None:
                raise ToolFailure("service_unavailable", "Kernel environment management is unavailable")
            values = [item.model_dump(mode="json") for item in self.environments.summaries(self.kernels.active_by_environment())]
            return PigentToolResult(ok=True, summary=f"Listed {len(values)} Kernel environments", data={"environments": values})
        if action == "operation_status":
            if self.operations is None:
                raise ToolFailure("service_unavailable", "Kernel operation service is unavailable")
            value = self.operations.get(str(arguments.get("operation_id", "")))
            return PigentToolResult(ok=True, summary=f"Operation {value.state}", data={"operation": value.model_dump(mode="json")})
        if action in {"create_temporary", "create_maintained", "sync_environment", "promote_environment", "delete_environment"}:
            if self.operations is None:
                raise ToolFailure("service_unavailable", "Kernel operation service is unavailable")
            if self._session(context.session_id).workspace != self.workspace:
                raise ToolFailure("permission_denied", "Kernel environment management is only available from the Runtime Workspace")
            if action == "create_temporary":
                accepted = self.operations.create_temporary(arguments, session_id=context.session_id, tool_call_id=context.tool_call_id)
            elif action == "create_maintained":
                accepted = self.operations.create_maintained(arguments, session_id=context.session_id, tool_call_id=context.tool_call_id)
            elif action == "sync_environment":
                accepted = self.operations.sync(str(arguments.get("environment_id", "")), session_id=context.session_id, tool_call_id=context.tool_call_id)
            elif action == "promote_environment":
                environment_id = str(arguments.get("environment_id", ""))
                if self.kernels.active_by_environment().get(environment_id) and not arguments.get("confirm_shutdown"):
                    raise ToolFailure("kernel_environment_busy", "Environment has active Kernels; explicit shutdown confirmation is required")
                accepted = self.operations.promote(environment_id, str(arguments.get("name", "")), arguments.get("display_name"), session_id=context.session_id, tool_call_id=context.tool_call_id)
            else:
                environment_id = str(arguments.get("environment_id", ""))
                if self.kernels.active_by_environment().get(environment_id):
                    raise ToolFailure("kernel_environment_busy", "Environment has active Kernels")
                if self.environments.get(environment_id).get("kind") == "maintained" and not arguments.get("confirmed"):
                    raise ToolFailure("confirmation_required", "Deleting a maintained environment requires confirmed=true")
                accepted = self.operations.delete(environment_id, session_id=context.session_id, tool_call_id=context.tool_call_id)
            data = {"accepted": True, "operation_id": accepted.operation_id, "environment_id": accepted.resource.id,
                    "state": accepted.state, "operation": accepted.model_dump(mode="json")}
            return PigentToolResult(ok=True, summary="Kernel environment operation accepted", data=data)
        if action == "start_environment":
            environment_id = str(arguments.get("environment_id", ""))
            try:
                summary = await self.kernels.start_async(
                    None,
                    environment_id=environment_id,
                    notebook_path=arguments.get("notebook_path"),
                    cwd=self._session(context.session_id).workspace,
                )
            except Exception as error:
                raise ToolFailure("kernel_environment_conflict", str(error)) from error
            self.update_session(context.session_id, active_kernel_id=summary.id)
            return PigentToolResult(ok=True, summary="Kernel environment started", data=summary.model_dump(mode="json"))
        if action == "execute":
            if kernel_id is None:
                raise ToolFailure("kernel_unavailable", "No active kernel")
            result = await self.kernels.execute_async(kernel_id, str(arguments.get("code", "")), arguments.get("timeout", 30),
                                                      store_history=bool(arguments.get("store_history", False)))
            data = result.model_dump() if hasattr(result, "model_dump") else dict(result)
            active = next((item for item in self.kernels.list() if item.id == kernel_id), None)
            if active is not None:
                data["name"] = active.name
            return PigentToolResult(ok=True, summary="Kernel execution completed", data=data)
        if kernel_id is None:
            raise ToolFailure("kernel_unavailable", "No active kernel")
        if action == "interrupt":
            result = await self.kernels.interrupt_async(kernel_id)
        elif action == "restart":
            result = await self.kernels.restart_async(kernel_id)
        elif action == "shutdown":
            await self.kernels.shutdown_async(kernel_id)
            self.update_session(context.session_id, clear_active_kernel=True)
            result = None
        else:
            raise ToolFailure("invalid_request", f"Unknown kernel action: {action}")
        data = result.model_dump() if hasattr(result, "model_dump") else {}
        return PigentToolResult(ok=True, summary=f"Kernel {action} completed", data=data)

    def _session(self, session_id: str) -> BridgeSession:
        try:
            return self.sessions[session_id]
        except KeyError as error:
            raise ToolFailure("permission_denied", "Unknown or expired Pigent session") from error

    def artifact(self, artifact_id: str) -> Any | None:
        for services in self._workspace_services.values():
            item = services.artifacts._items.get(artifact_id)
            if item is not None:
                return item
        return None

    def _services(self, workspace: Path) -> _WorkspaceServices:
        workspace = workspace.resolve()
        existing = self._workspace_services.get(workspace)
        if existing is not None:
            return existing
        artifacts = ArtifactRegistry(workspace)
        services = _WorkspaceServices(
            artifacts=artifacts,
            files=FileToolService(workspace, artifacts),
            bash=BashToolService(workspace, terminal_sessions=self.terminal_sessions),
            notebooks=NotebookService(workspace, self.kernels),
            inspection=InspectionService(self.kernels, artifacts),
        )
        self._workspace_services[workspace] = services
        return services

    def _prune(self, now: float) -> None:
        expired = [key for key, item in self._cache.items() if item.expires_at <= now]
        for key in expired:
            self._cache.pop(key, None)
            if not self._call_locks.get(key, asyncio.Lock()).locked():
                self._call_locks.pop(key, None)


def create_internal_router(bridge: PigentBridge, credential: str) -> APIRouter:
    if not credential:
        raise ValueError("A non-empty bridge credential is required")
    router = APIRouter(prefix="/internal/pigent/v1", tags=["pigent-internal"])

    @router.post("/tools/{tool}", response_model=PigentToolResult)
    async def dispatch_tool(
        tool: str,
        body: InternalToolRequest,
        authorization: str | None = Header(default=None),
    ) -> PigentToolResult:
        expected = f"Bearer {credential}"
        if authorization is None or not hmac.compare_digest(authorization, expected):
            raise HTTPException(status_code=401, detail="Invalid Pigent bridge credential")
        return await bridge.dispatch(tool, body.arguments, body.context)

    return router
