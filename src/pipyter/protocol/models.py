from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

PROTOCOL_VERSION = "0.1"


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    protocol_version: str = PROTOCOL_VERSION
    node_id: str = "local"
    workspace_id: str


class WorkspaceSummary(BaseModel):
    protocol_version: str = PROTOCOL_VERSION
    node_id: str = "local"
    workspace_id: str
    project_id: str
    name: str
    root_name: str
    root: str | None = None
    kernel_status: str = "idle"
    connection_status: str = "connected"
    open_documents: list[str] = Field(default_factory=list)


class FileEntry(BaseModel):
    path: str
    name: str
    type: Literal["directory", "notebook", "file", "image"]
    size: int | None = None
    modified: float | None = None
    running: bool = False


class FileContent(BaseModel):
    path: str
    content: str
    encoding: Literal["utf-8"] = "utf-8"


class FileWriteRequest(BaseModel):
    content: str


class DirectoryCreateRequest(BaseModel):
    path: str


class NotebookDocument(BaseModel):
    path: str
    notebook: dict[str, Any]


class KernelStartRequest(BaseModel):
    kernel_name: str | None = "python3"
    environment_id: str | None = None
    notebook_path: str | None = None

    def model_post_init(self, _context: Any) -> None:
        if self.environment_id and self.kernel_name not in {None, "", "python3"}:
            raise ValueError("Select exactly one of environment_id or kernel_name")


class KernelSummary(BaseModel):
    id: str
    name: str
    status: Literal["starting", "idle", "busy", "restarting", "dead", "stopping"]
    execution_count: int = 0
    environment_id: str | None = None
    notebook_path: str | None = None
    language: str = "python"
    generation: int = 1
    queue_depth: int = 0
    started_at: str | None = None
    last_activity_at: str | None = None
    last_error: str | None = None


class KernelSpecSummary(BaseModel):
    name: str
    display_name: str
    language: str
    argv: list[str] = Field(default_factory=list)


class ExecuteRequest(BaseModel):
    code: str
    timeout: float = Field(default=30, ge=0.1, le=300)


class KernelOutput(BaseModel):
    type: Literal["stream", "execute_result", "display_data", "error"]
    text: str = ""
    data: dict[str, Any] = Field(default_factory=dict)
    name: str | None = None
    traceback: list[str] = Field(default_factory=list)


class ExecuteResponse(BaseModel):
    kernel_id: str
    execution_count: int
    status: str
    outputs: list[KernelOutput]
    generation: int = 1
    partial: bool = False


class TerminalExecuteRequest(BaseModel):
    command: str
    cwd: str = "."
    timeout: float = Field(default=15, ge=0.1, le=120)


class TerminalExecuteResponse(BaseModel):
    session_id: str
    command: str
    cwd: str
    stdout: str
    stderr: str
    exit_code: int


class TerminalSessionCreateRequest(BaseModel):
    name: str | None = None
    executable: str | None = None
    cwd: str = "."
    env: dict[str, str] = Field(default_factory=dict)
    cols: int = Field(default=80, ge=2, le=500)
    rows: int = Field(default=24, ge=1, le=500)
    argv: list[str] | None = None


class TerminalResizeRequest(BaseModel):
    cols: int = Field(ge=2, le=500)
    rows: int = Field(ge=1, le=500)


class RunningItem(BaseModel):
    id: str
    kind: Literal["kernel", "terminal"]
    name: str
    path: str
    status: str


class RunningResponse(BaseModel):
    kernels: list[RunningItem] = Field(default_factory=list)
    terminals: list[RunningItem] = Field(default_factory=list)
