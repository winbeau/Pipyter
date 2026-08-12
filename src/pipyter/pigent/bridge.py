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
        idempotency_ttl: float = 300,
    ):
        self.workspace = workspace.expanduser().resolve()
        self.workspace_id = workspace_id
        self.kernels = kernels
        self.idempotency_ttl = idempotency_ttl
        self.artifacts = ArtifactRegistry(self.workspace)
        self.files = FileToolService(self.workspace, self.artifacts)
        self.bash_service = BashToolService(self.workspace, terminal_sessions=terminal_sessions)
        self.notebooks = NotebookService(self.workspace, kernels)
        self.inspection = InspectionService(kernels, self.artifacts)
        self.sessions: dict[str, BridgeSession] = {}
        self.handlers: dict[str, ToolHandler] = {}
        self._cache: dict[tuple[str, str], _Cached] = {}
        self._call_locks: dict[tuple[str, str], asyncio.Lock] = {}

    def register_session(
        self,
        session_id: str,
        *,
        mode: Any,
        active_document: str | None = None,
        active_kernel_id: str | None = None,
    ) -> BridgeSession:
        session = BridgeSession(
            session_id, self.workspace_id, self.workspace, normalize_mode(mode), active_document, active_kernel_id,
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
        if tool == "read":
            return await self.files.read(arguments)
        if tool == "view":
            return await self.files.view(arguments)
        if tool == "write":
            return await self.files.write(arguments)
        if tool == "update":
            return await self.files.update(arguments)
        if tool == "bash":
            return await self.bash_service.bash(arguments)
        if tool == "notebook":
            notebook_arguments = dict(arguments)
            active_document = context.active_document or {}
            if not notebook_arguments.get("path") and active_document.get("path"):
                notebook_arguments["path"] = active_document["path"]
            return await self.notebooks.dispatch(notebook_arguments, kernel_id=context.active_kernel_id)
        if tool == "kernel":
            return await self._kernel(arguments, context.active_kernel_id)
        if tool == "inspect":
            return await self.inspection.inspect(arguments, kernel_id=context.active_kernel_id)
        handler = self.handlers.get(tool)
        if handler is None:
            raise ToolFailure("service_unavailable", f"{tool} is not connected in the Phase 2 bridge")
        return await handler(arguments, context)

    async def _kernel(self, arguments: dict[str, Any], kernel_id: str | None) -> PigentToolResult:
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
        if action == "execute":
            if kernel_id is None:
                raise ToolFailure("kernel_unavailable", "No active kernel")
            result = await asyncio.to_thread(self.kernels.execute, kernel_id, str(arguments.get("code", "")), arguments.get("timeout", 30))
            data = result.model_dump() if hasattr(result, "model_dump") else dict(result)
            return PigentToolResult(ok=True, summary="Kernel execution completed", data=data)
        if kernel_id is None:
            raise ToolFailure("kernel_unavailable", "No active kernel")
        operation = {"interrupt": self.kernels.interrupt, "restart": self.kernels.restart,
                     "shutdown": self.kernels.shutdown}.get(action)
        if operation is None:
            raise ToolFailure("invalid_request", f"Unknown kernel action: {action}")
        result = await asyncio.to_thread(operation, kernel_id)
        data = result.model_dump() if hasattr(result, "model_dump") else {}
        return PigentToolResult(ok=True, summary=f"Kernel {action} completed", data=data)

    def _session(self, session_id: str) -> BridgeSession:
        try:
            return self.sessions[session_id]
        except KeyError as error:
            raise ToolFailure("permission_denied", "Unknown or expired Pigent session") from error

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
