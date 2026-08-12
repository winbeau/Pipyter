from __future__ import annotations

import asyncio
import json
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterator

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .._version import __version__
from ..exceptions import UnsafePathError
from ..kernel import KernelRuntime
from ..kernel.environments import KernelEnvironmentError, KernelEnvironmentRegistry
from ..kernel.operations import OperationManager
from ..kernel.cleanup import KernelCleanupService
from ..pigent import PigentBridge, create_internal_router
from ..pigent.config import PigentConfigError, PigentConfigStore
from ..pigent.manager import PigentManager
from ..pigent.sessions import PigentSessionService, create_public_router
from ..protocol.models import (
    DirectoryCreateRequest,
    ExecuteRequest,
    ExecuteResponse,
    FileContent,
    FileEntry,
    FileWriteRequest,
    HealthResponse,
    KernelSpecSummary,
    KernelStartRequest,
    KernelSummary,
    NotebookDocument,
    RunningItem,
    RunningResponse,
    TerminalExecuteRequest,
    TerminalExecuteResponse,
    TerminalResizeRequest,
    TerminalSessionCreateRequest,
    WorkspaceSummary,
)
from ..protocol.pigent import TerminalSession
from ..terminal import TerminalPlatformUnsupported, TerminalRuntime, TerminalSessionManager
from .security import RuntimeAuthMiddleware
from ..workspace.files import (
    create_directory,
    delete_path,
    list_entries,
    read_notebook,
    read_text,
    resolve_workspace_path,
    write_notebook,
    write_text,
)
from ..workspace.project import ProjectBinding, load_project


def _project_for_root(root: Path) -> ProjectBinding:
    try:
        return load_project(root)
    except Exception:
        return ProjectBinding("local", "local-project", "local-workspace", root.name or "workspace", root)


def create_app(
    root: str | os.PathLike[str] | None = None,
    *,
    runtime_token: str | None = None,
    allowed_origins: list[str] | tuple[str, ...] | None = None,
    bridge_endpoint: str | None = None,
    config_root: str | os.PathLike[str] | None = None,
    node_id: str | None = None,
) -> FastAPI:
    workspace_root = Path(root or os.environ.get("PIPYTER_WORKSPACE_ROOT", ".")).expanduser().resolve()
    project = _project_for_root(workspace_root)
    runtime_token = runtime_token if runtime_token is not None else os.environ.get("PIPYTER_RUNTIME_TOKEN")
    node_id = node_id or os.environ.get("PIPYTER_NODE_ID") or "local"
    origin_env = os.environ.get("PIPYTER_ALLOWED_ORIGINS", "")
    explicit_origins = list(allowed_origins) if allowed_origins is not None else [
        value.strip() for value in origin_env.split(",") if value.strip()
    ]
    cors_origins = explicit_origins or ["http://127.0.0.1:5173", "http://localhost:5173"]
    kernel_environments = KernelEnvironmentRegistry(config_root=config_root)
    kernels = KernelRuntime(workspace_root, kernel_environments)
    kernel_operations = OperationManager(kernel_environments, workspace_root)
    kernel_cleanup = KernelCleanupService(kernel_environments, kernels, kernel_operations)
    terminal = TerminalRuntime(workspace_root)
    terminal_sessions = TerminalSessionManager(workspace_root)

    manager_holder: dict[str, PigentManager] = {}

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        kernel_cleanup.start()
        yield
        manager = manager_holder.get("manager")
        if manager is not None:
            await manager.shutdown()
        await kernel_cleanup.shutdown()
        await kernel_operations.shutdown()
        terminal_sessions.shutdown()
        await kernels.shutdown_all_async()

    app = FastAPI(
        title="Pipyter Runtime API",
        version=__version__,
        description="Workspace, file, notebook, kernel and terminal bridge for Pipyter.",
        lifespan=lifespan,
    )
    app.state.workspace_root = workspace_root
    app.state.project = project
    app.state.node_id = node_id
    app.state.runtime_auth_enabled = bool(runtime_token)
    app.state.kernels = kernels
    app.state.kernel_environments = kernel_environments
    app.state.kernel_operations = kernel_operations
    app.state.kernel_cleanup = kernel_cleanup
    app.state.terminal = terminal
    app.state.terminal_sessions = terminal_sessions
    bridge = PigentBridge(workspace_root, project.workspace_id, kernels, terminal_sessions=terminal_sessions,
                          environments=kernel_environments, operations=kernel_operations)
    bridge_credential = os.environ.get("PIPYTER_PIGENT_BRIDGE_TOKEN") or secrets.token_urlsafe(32)
    app.state.pigent_bridge = bridge
    app.state.pigent_bridge_credential = bridge_credential
    app.include_router(create_internal_router(bridge, bridge_credential))
    pigent_config = PigentConfigStore(config_root=config_root)
    pigent_manager = PigentManager(
        workspace_root,
        project.workspace_id,
        user_config_dir=pigent_config.directory,
        bridge_endpoint=(
            bridge_endpoint
            or os.environ.get("PIPYTER_PIGENT_BRIDGE_ENDPOINT")
            or f"http://127.0.0.1:{os.environ.get('PIPYTER_RUNTIME_PORT', '8895')}/internal/pigent/v1"
        ),
        bridge_token=bridge_credential,
    )
    manager_holder["manager"] = pigent_manager
    pigent_sessions = PigentSessionService(workspace_root, project, bridge, pigent_config, pigent_manager)

    async def operation_event(event_type: str, payload: dict) -> None:
        operation = payload.get("operation") or {}
        session_id = operation.get("session_id")
        if isinstance(session_id, str) and session_id in pigent_sessions.sessions:
            await pigent_sessions.emit(pigent_sessions.sessions[session_id], event_type, payload)
    kernel_operations.on_event = operation_event
    app.state.pigent_config = pigent_config
    app.state.pigent_manager = pigent_manager
    app.state.pigent_sessions = pigent_sessions
    app.include_router(create_public_router(pigent_sessions))

    @app.exception_handler(PigentConfigError)
    async def pigent_config_error(_request, error: PigentConfigError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": {"code": "invalid_request", "message": str(error)}})

    app.add_middleware(
        RuntimeAuthMiddleware,
        token=runtime_token,
        allowed_origins=explicit_origins,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(node_id=node_id, workspace_id=project.workspace_id)

    @app.get("/api/v1/pigent/artifacts/{artifact_id}")
    async def get_pigent_artifact(artifact_id: str, download: bool = Query(default=False)):
        try:
            item = bridge.artifact(artifact_id)
            if item is None:
                raise KeyError(artifact_id)
            raw = item.path.read_bytes()
            if item.ref.hash != "sha256:" + __import__("hashlib").sha256(raw).hexdigest():
                raise HTTPException(status_code=403, detail="Artifact integrity check failed")
            headers = {"Content-Disposition": f'attachment; filename="{item.path.name}"'} if download else {}
            return Response(raw, media_type=item.ref.mime, headers=headers)
        except (KeyError, FileNotFoundError) as error:
            raise HTTPException(status_code=404, detail="Artifact not found or expired") from error

    @app.get("/api/v1/pigent/config")
    def get_pigent_config() -> dict:
        try:
            return pigent_config.sanitized()
        except PigentConfigError as error:
            raise HTTPException(status_code=409, detail={"code": "invalid_request", "message": str(error)}) from error

    @app.put("/api/v1/pigent/config/model")
    def put_pigent_model(body: dict) -> dict:
        document = pigent_config.read_settings()
        value = dict(document.value)
        provider, model = body.get("defaultProvider"), body.get("defaultModel")
        if not isinstance(provider, str) or not provider or not isinstance(model, str) or not model:
            raise HTTPException(status_code=400, detail="defaultProvider and defaultModel are required")
        value.update({"defaultProvider": provider, "defaultModel": model})
        written = pigent_config.write_settings(value, body.get("revision", document.revision))
        return {"defaultProvider": provider, "defaultModel": model, "revision": written.revision}

    @app.get("/api/v1/pigent/auth")
    def get_pigent_auth() -> dict:
        sanitized = pigent_config.sanitized()
        return {"providers": sanitized["providers"], "revision": sanitized["auth_revision"]}

    @app.put("/api/v1/pigent/auth/{provider_id}")
    def put_pigent_auth(provider_id: str, body: dict) -> dict:
        document = pigent_config.read_auth()
        value = dict(document.value)
        current = value.get(provider_id)
        entry = dict(current) if isinstance(current, dict) else {}
        secret_fields = {"key", "accessToken", "refreshToken", "secretHeaders"}
        for key in ("type", "baseUrl", "key", "accessToken", "refreshToken", "secretHeaders"):
            if key not in body:
                continue
            candidate = body[key]
            if key in secret_fields and (candidate is None or candidate == ""):
                continue
            entry[key] = candidate
        value[provider_id] = entry
        written = pigent_config.write_auth(value, body.get("revision", document.revision))
        return {"provider_id": provider_id, "configured": True, "revision": written.revision}

    @app.delete("/api/v1/pigent/auth/{provider_id}", status_code=204)
    def delete_pigent_auth(provider_id: str) -> None:
        document = pigent_config.read_auth()
        value = dict(document.value)
        value.pop(provider_id, None)
        pigent_config.write_auth(value, document.revision)

    @app.get("/api/v1/workspace", response_model=WorkspaceSummary)
    def workspace() -> WorkspaceSummary:
        active_kernels = kernels.list()
        return WorkspaceSummary(
            node_id=node_id,
            workspace_id=project.workspace_id,
            project_id=project.project_id,
            name=project.name,
            root_name=workspace_root.name or "workspace",
            root=str(workspace_root),
            kernel_status=active_kernels[0].status if active_kernels else "idle",
            open_documents=[],
        )

    @app.get("/api/v1/files", response_model=list[FileEntry])
    def files(path: str = Query(default=".")) -> list[FileEntry]:
        return _translate_errors(lambda: list_entries(workspace_root, path))

    @app.get("/api/v1/files/content", response_model=FileContent)
    def file_content(path: str = Query(...)) -> FileContent:
        content = _translate_errors(lambda: read_text(workspace_root, path))
        return FileContent(path=path, content=content)

    @app.get("/api/v1/files/image")
    def file_image(path: str = Query(...)) -> FileResponse:
        import mimetypes

        try:
            resolved = resolve_workspace_path(workspace_root, path)
        except UnsafePathError as error:
            raise HTTPException(status_code=403, detail=str(error)) from error
        if not resolved.is_file():
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        media_type = mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
        return FileResponse(resolved, media_type=media_type)

    @app.get("/api/v1/files/download")
    def download_file(path: str = Query(...)) -> FileResponse:
        try:
            resolved = resolve_workspace_path(workspace_root, path)
        except UnsafePathError as error:
            raise HTTPException(status_code=403, detail=str(error)) from error
        if not resolved.is_file():
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        return FileResponse(resolved, media_type="application/octet-stream", filename=resolved.name)

    @app.put("/api/v1/files/content", response_model=FileContent)
    def update_file(body: FileWriteRequest, path: str = Query(...)) -> FileContent:
        _translate_errors(lambda: write_text(workspace_root, path, body.content))
        return FileContent(path=path, content=body.content)

    @app.post("/api/v1/files/directory", response_model=FileEntry, status_code=201)
    def new_directory(body: DirectoryCreateRequest) -> FileEntry:
        created = _translate_errors(lambda: create_directory(workspace_root, body.path))
        return FileEntry(path=body.path, name=created.name, type="directory", modified=created.stat().st_mtime)

    @app.delete("/api/v1/files", status_code=204)
    def remove_file(path: str = Query(...)) -> None:
        _translate_errors(lambda: delete_path(workspace_root, path))

    @app.get("/api/v1/notebooks", response_model=NotebookDocument)
    def notebook(path: str = Query(...)) -> NotebookDocument:
        value = _translate_errors(lambda: read_notebook(workspace_root, path))
        return NotebookDocument(path=path, notebook=value)

    @app.put("/api/v1/notebooks", response_model=NotebookDocument)
    def update_notebook(document: NotebookDocument) -> NotebookDocument:
        _translate_errors(lambda: write_notebook(workspace_root, document.path, document.notebook))
        return document

    @app.get("/api/v1/kernels", response_model=list[KernelSummary])
    def list_kernels() -> list[KernelSummary]:
        return kernels.list()

    @app.get("/api/v1/kernels/specs", response_model=list[KernelSpecSummary])
    def kernel_specs() -> list[KernelSpecSummary]:
        return kernels.specs()

    @app.post("/api/v1/kernels", response_model=KernelSummary, status_code=201)
    async def start_kernel(body: KernelStartRequest) -> KernelSummary:
        try:
            return await kernels.start_async(body.kernel_name, environment_id=body.environment_id, notebook_path=body.notebook_path)
        except KernelEnvironmentError as error:
            raise HTTPException(status_code=409, detail={"code": error.code, "message": str(error)}) from error
        except (KeyError, ValueError, RuntimeError) as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post("/api/v1/kernels/{kernel_id}/execute", response_model=ExecuteResponse)
    async def execute(kernel_id: str, body: ExecuteRequest) -> ExecuteResponse:
        try:
            return await kernels.execute_async(kernel_id, body.code, body.timeout, store_history=True)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        except TimeoutError as error:
            raise HTTPException(status_code=504, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post("/api/v1/kernels/{kernel_id}/interrupt", response_model=KernelSummary)
    async def interrupt_kernel(kernel_id: str) -> KernelSummary:
        try:
            return await kernels.interrupt_async(kernel_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @app.post("/api/v1/kernels/{kernel_id}/restart", response_model=KernelSummary)
    async def restart_kernel(kernel_id: str) -> KernelSummary:
        try:
            return await kernels.restart_async(kernel_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @app.delete("/api/v1/kernels/{kernel_id}", status_code=204)
    async def shutdown_kernel(kernel_id: str) -> None:
        try:
            await kernels.shutdown_async(kernel_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    def public_operation(operation):
        return operation.model_dump(mode="json")

    @app.get("/api/v1/kernel-environments")
    def list_kernel_environments() -> list[dict]:
        return [item.model_dump(mode="json") for item in kernel_environments.summaries(kernels.active_by_environment())]

    @app.get("/api/v1/kernel-environments/{environment_id}")
    def get_kernel_environment(environment_id: str) -> dict:
        values = {item.id: item for item in kernel_environments.summaries(kernels.active_by_environment())}
        if environment_id not in values:
            raise HTTPException(status_code=404, detail={"code": "kernel_environment_not_found", "message": "Environment not found"})
        return values[environment_id].model_dump(mode="json")

    @app.post("/api/v1/kernel-environments/temporary", status_code=202)
    async def create_temporary_environment(body: dict) -> dict:
        try:
            operation = kernel_operations.create_temporary(body)
            return public_operation(operation)
        except KernelEnvironmentError as error:
            raise HTTPException(status_code=409, detail={"code": error.code, "message": str(error)}) from error

    @app.post("/api/v1/kernel-environments/maintained", status_code=202)
    async def create_maintained_environment(body: dict) -> dict:
        try:
            operation = kernel_operations.create_maintained(body)
            return public_operation(operation)
        except KernelEnvironmentError as error:
            raise HTTPException(status_code=409, detail={"code": error.code, "message": str(error)}) from error

    @app.post("/api/v1/kernel-environments/{environment_id}/sync", status_code=202)
    async def sync_kernel_environment(environment_id: str) -> dict:
        try:
            return public_operation(kernel_operations.sync(environment_id))
        except KernelEnvironmentError as error:
            raise HTTPException(status_code=409, detail={"code": error.code, "message": str(error)}) from error

    @app.post("/api/v1/kernel-environments/{environment_id}/promote", status_code=202)
    async def promote_kernel_environment(environment_id: str, body: dict) -> dict:
        if kernels.active_by_environment().get(environment_id):
            raise HTTPException(status_code=409, detail={"code": "kernel_environment_busy", "message": "Environment has active Kernels"})
        try:
            return public_operation(kernel_operations.promote(environment_id, str(body.get("name", "")), body.get("display_name")))
        except KernelEnvironmentError as error:
            raise HTTPException(status_code=409, detail={"code": error.code, "message": str(error)}) from error

    @app.post("/api/v1/kernel-environments/{environment_id}/start", response_model=KernelSummary, status_code=201)
    async def start_kernel_environment(environment_id: str, body: dict | None = None) -> KernelSummary:
        body = body or {}
        try:
            return await kernels.start_async(None, environment_id=environment_id, notebook_path=body.get("notebook_path"))
        except (KernelEnvironmentError, KeyError, RuntimeError, ValueError) as error:
            code = error.code if isinstance(error, KernelEnvironmentError) else "kernel_environment_conflict"
            raise HTTPException(status_code=409, detail={"code": code, "message": str(error)}) from error

    @app.delete("/api/v1/kernel-environments/{environment_id}", status_code=202)
    async def delete_kernel_environment(environment_id: str, confirmed: bool = Query(default=False)) -> dict:
        active = kernels.active_by_environment().get(environment_id)
        if active:
            raise HTTPException(status_code=409, detail={"code": "kernel_environment_busy", "message": "Environment has active Kernels", "kernel_ids": active})
        try:
            value = kernel_environments.get(environment_id)
            if value["kind"] == "maintained" and not confirmed:
                raise HTTPException(status_code=409, detail={"code": "confirmation_required", "message": "Maintained delete requires confirmed=true"})
            return public_operation(kernel_operations.delete(environment_id))
        except KernelEnvironmentError as error:
            raise HTTPException(status_code=409, detail={"code": error.code, "message": str(error)}) from error

    @app.get("/api/v1/operations/{operation_id}")
    def get_operation(operation_id: str) -> dict:
        try:
            return public_operation(kernel_operations.get(operation_id))
        except KernelEnvironmentError as error:
            raise HTTPException(status_code=404, detail={"code": error.code, "message": str(error)}) from error

    @app.post("/api/v1/operations/{operation_id}/cancel", status_code=202)
    async def cancel_operation(operation_id: str) -> dict:
        try:
            return public_operation(await kernel_operations.cancel(operation_id))
        except KernelEnvironmentError as error:
            status = 409 if error.code == "operation_not_cancellable" else 404
            raise HTTPException(status_code=status, detail={"code": error.code, "message": str(error)}) from error

    @app.get("/api/v1/terminals", response_model=list[TerminalSession])
    def list_terminals() -> list[TerminalSession]:
        return terminal_sessions.list()

    @app.post("/api/v1/terminals", response_model=TerminalSession, status_code=201)
    def create_terminal(body: TerminalSessionCreateRequest) -> TerminalSession:
        try:
            return terminal_sessions.create(
                name=body.name,
                executable=body.executable,
                cwd=body.cwd,
                env=body.env,
                cols=body.cols,
                rows=body.rows,
                argv=body.argv,
            )
        except TerminalPlatformUnsupported as error:
            raise HTTPException(status_code=501, detail=str(error)) from error
        except OSError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @app.get("/api/v1/terminals/{session_id}", response_model=TerminalSession)
    def get_terminal(session_id: str) -> TerminalSession:
        return _translate_errors(lambda: terminal_sessions.get(session_id))

    @app.delete("/api/v1/terminals/{session_id}", status_code=204)
    def close_terminal(session_id: str) -> None:
        _translate_errors(lambda: terminal_sessions.close(session_id))

    @app.post("/api/v1/terminals/{session_id}/resize", response_model=TerminalSession)
    def resize_terminal(session_id: str, body: TerminalResizeRequest) -> TerminalSession:
        return _translate_errors(lambda: terminal_sessions.resize(session_id, body.cols, body.rows))

    @app.websocket("/api/v1/terminals/{session_id}/stream")
    async def stream_terminal(websocket: WebSocket, session_id: str) -> None:
        try:
            session = terminal_sessions.get(session_id)
            cursor = int(websocket.query_params.get("cursor", "0"))
            if cursor < 0:
                raise ValueError("cursor cannot be negative")
        except (KeyError, ValueError):
            await websocket.close(code=1008)
            return
        await websocket.accept()
        send_lock = asyncio.Lock()
        binary_output = websocket.query_params.get("binary", "0").lower() in {"1", "true", "yes"}

        async def send_envelope(value: dict) -> None:
            async with send_lock:
                await websocket.send_json(value)

        async def send_chunk(chunk) -> None:
            if not binary_output:
                await send_envelope(chunk.envelope())
                return
            async with send_lock:
                await websocket.send_json({
                    "version": 1,
                    "type": "output",
                    "cursor": chunk.cursor,
                    "encoding": "binary",
                    "size": len(chunk.data),
                })
                await websocket.send_bytes(chunk.data)

        async def send_replay(after_cursor: int) -> int:
            chunks, earliest, truncated = terminal_sessions.replay(session_id, after_cursor)
            await send_envelope({
                "version": 1,
                "type": "replay",
                "cursor": terminal_sessions.cursor(session_id),
                "requested_cursor": after_cursor,
                "earliest_cursor": earliest,
                "truncated": truncated,
            })
            latest = after_cursor
            for chunk in chunks:
                await send_chunk(chunk)
                latest = chunk.cursor
            return latest

        cursor = await send_replay(cursor)
        await send_envelope({"version": 1, "type": "status", "cursor": cursor, "session": session.model_dump()})

        async def output_loop() -> None:
            nonlocal cursor
            previous_status = session.status
            while True:
                chunks, status, exit_code = await asyncio.to_thread(terminal_sessions.wait, session_id, cursor, 0.5)
                for chunk in chunks:
                    await send_chunk(chunk)
                    cursor = chunk.cursor
                if status != previous_status:
                    current = terminal_sessions.get(session_id)
                    await send_envelope({"version": 1, "type": "status", "cursor": cursor, "session": current.model_dump()})
                    previous_status = status
                if status != "running":
                    await send_envelope({"version": 1, "type": "exit", "cursor": cursor, "exit_code": exit_code})
                    return

        async def input_loop() -> None:
            nonlocal cursor
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    return
                if message.get("bytes") is not None:
                    terminal_sessions.input(session_id, message["bytes"])
                    continue
                text = message.get("text") or ""
                try:
                    control = json.loads(text)
                except json.JSONDecodeError:
                    control = None
                if not isinstance(control, dict) or control.get("version") != 1 or control.get("type") not in {
                    "resize", "status", "signal", "exit", "close", "replay"
                }:
                    terminal_sessions.input(session_id, text)
                    continue
                kind = control["type"]
                if kind == "resize":
                    current = terminal_sessions.resize(session_id, int(control["cols"]), int(control["rows"]))
                    await send_envelope({"version": 1, "type": "status", "cursor": cursor, "session": current.model_dump()})
                elif kind == "status":
                    current = terminal_sessions.get(session_id)
                    await send_envelope({"version": 1, "type": "status", "cursor": cursor, "session": current.model_dump()})
                elif kind == "signal":
                    terminal_sessions.signal(session_id, control.get("signal", "INT"))
                elif kind == "exit":
                    terminal_sessions.exit(session_id)
                elif kind == "close":
                    terminal_sessions.close(session_id)
                elif kind == "replay":
                    cursor = await send_replay(int(control.get("cursor", cursor)))

        output_task = asyncio.create_task(output_loop())
        input_task = asyncio.create_task(input_loop())
        try:
            done, pending = await asyncio.wait({output_task, input_task}, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                task.result()
        except (WebSocketDisconnect, RuntimeError, KeyError, ValueError, asyncio.CancelledError):
            pass
        finally:
            if websocket.client_state.name == "CONNECTED":
                try:
                    await websocket.close()
                except (RuntimeError, WebSocketDisconnect, asyncio.CancelledError):
                    # Client already disconnected or the ASGI task is cancelling.
                    pass

    @app.post("/api/v1/terminals/execute", response_model=TerminalExecuteResponse)
    def execute_terminal(body: TerminalExecuteRequest) -> TerminalExecuteResponse:
        return _translate_errors(lambda: terminal.execute(body.command, body.cwd, body.timeout))

    @app.get("/api/v1/running", response_model=RunningResponse)
    def running() -> RunningResponse:
        kernel_items = [
            RunningItem(id=item.id, kind="kernel", name=item.name, path="", status=item.status)
            for item in kernels.list()
        ]
        terminal_items = [
            RunningItem(id=item.id, kind="terminal", name=item.name, path=item.cwd, status=item.status)
            for item in terminal_sessions.list()
            if item.status != "closed"
        ]
        return RunningResponse(kernels=kernel_items, terminals=terminal_items)

    static_dir = Path(__file__).resolve().parent.parent / "static"
    if static_dir.joinpath("index.html").exists():
        assets = static_dir / "assets"
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def portal(path: str):
            requested = static_dir / path
            if path and requested.is_file() and requested.resolve().is_relative_to(static_dir.resolve()):
                return FileResponse(requested)
            return FileResponse(static_dir / "index.html")

    return app


def _translate_errors(operation):
    try:
        return operation()
    except UnsafePathError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except FileExistsError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except (ValueError, NotADirectoryError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error
