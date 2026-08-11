from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterator

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from ..exceptions import UnsafePathError
from ..kernel import KernelRuntime
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
    WorkspaceSummary,
)
from ..terminal import TerminalRuntime
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


def create_app(root: str | os.PathLike[str] | None = None) -> FastAPI:
    workspace_root = Path(root or os.environ.get("PIPYTER_WORKSPACE_ROOT", ".")).expanduser().resolve()
    project = _project_for_root(workspace_root)
    kernels = KernelRuntime(workspace_root)
    terminal = TerminalRuntime(workspace_root)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        yield
        kernels.shutdown_all()

    app = FastAPI(
        title="Pipyter Runtime API",
        version="0.1.1",
        description="Workspace, file, notebook, kernel and terminal bridge for Pipyter.",
        lifespan=lifespan,
    )
    app.state.workspace_root = workspace_root
    app.state.project = project
    app.state.kernels = kernels
    app.state.terminal = terminal
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(workspace_id=project.workspace_id)

    @app.get("/api/v1/workspace", response_model=WorkspaceSummary)
    def workspace() -> WorkspaceSummary:
        active_kernels = kernels.list()
        return WorkspaceSummary(
            workspace_id=project.workspace_id,
            project_id=project.project_id,
            name=project.name,
            root_name=workspace_root.name or "workspace",
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
    def start_kernel(body: KernelStartRequest) -> KernelSummary:
        return _translate_errors(lambda: kernels.start(body.kernel_name))

    @app.post("/api/v1/kernels/{kernel_id}/execute", response_model=ExecuteResponse)
    def execute(kernel_id: str, body: ExecuteRequest) -> ExecuteResponse:
        return _translate_errors(lambda: kernels.execute(kernel_id, body.code, body.timeout))

    @app.post("/api/v1/kernels/{kernel_id}/interrupt", response_model=KernelSummary)
    def interrupt_kernel(kernel_id: str) -> KernelSummary:
        return _translate_errors(lambda: kernels.interrupt(kernel_id))

    @app.post("/api/v1/kernels/{kernel_id}/restart", response_model=KernelSummary)
    def restart_kernel(kernel_id: str) -> KernelSummary:
        return _translate_errors(lambda: kernels.restart(kernel_id))

    @app.delete("/api/v1/kernels/{kernel_id}", status_code=204)
    def shutdown_kernel(kernel_id: str) -> None:
        _translate_errors(lambda: kernels.shutdown(kernel_id))

    @app.post("/api/v1/terminals/execute", response_model=TerminalExecuteResponse)
    def execute_terminal(body: TerminalExecuteRequest) -> TerminalExecuteResponse:
        return _translate_errors(lambda: terminal.execute(body.command, body.cwd, body.timeout))

    @app.get("/api/v1/running", response_model=RunningResponse)
    def running() -> RunningResponse:
        kernel_items = [
            RunningItem(id=item.id, kind="kernel", name=item.name, path="", status=item.status)
            for item in kernels.list()
        ]
        terminal_items = []
        if terminal.history:
            terminal_items.append(
                RunningItem(
                    id=terminal.session_id,
                    kind="terminal",
                    name="Terminal 1",
                    path=".",
                    status="connected",
                )
            )
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
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error
