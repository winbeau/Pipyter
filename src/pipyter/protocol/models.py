from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

PROTOCOL_VERSION = "0.1"


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    protocol_version: str = PROTOCOL_VERSION
    workspace_id: str


class WorkspaceSummary(BaseModel):
    protocol_version: str = PROTOCOL_VERSION
    workspace_id: str
    project_id: str
    name: str
    root_name: str
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
    kernel_name: str = "python3"


class KernelSummary(BaseModel):
    id: str
    name: str
    status: str
    execution_count: int = 0


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


class RunningItem(BaseModel):
    id: str
    kind: Literal["kernel", "terminal"]
    name: str
    path: str
    status: str


class RunningResponse(BaseModel):
    kernels: list[RunningItem] = Field(default_factory=list)
    terminals: list[RunningItem] = Field(default_factory=list)
