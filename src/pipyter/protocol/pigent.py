"""Pigent v0.2 protocol models.

Mirror of ``packages/protocol/src/pigent.ts`` and the authoritative JSON
Schemas in ``packages/protocol/schemas/pigent-*.schema.json`` (the schemas are
force-included in the wheel/sdist). Every public enum is a strict ``Literal``:
unknown tool names, actions, statuses, modes and protocol versions are
rejected, and legacy ``pilot`` mode maps to ``auto`` exactly once.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, TypeAlias

from pydantic import BaseModel, Field, StringConstraints

PIGENT_PROTOCOL_VERSION = "0.2"

# ---------------------------------------------------------------------------
# Enums (keep in sync with the JSON schemas and pigent.ts)
# ---------------------------------------------------------------------------

PigentToolName: TypeAlias = Literal[
    "read", "view", "write", "update", "bash", "notebook", "kernel", "inspect", "tasks", "delegate"
]
PIGENT_TOOL_NAMES: tuple[PigentToolName, ...] = (
    "read", "view", "write", "update", "bash", "notebook", "kernel", "inspect", "tasks", "delegate",
)

PigentMode: TypeAlias = Literal["ask", "plan", "auto"]
PIGENT_MODES: tuple[PigentMode, ...] = ("ask", "plan", "auto")

LegacyPigentMode: TypeAlias = Literal["pilot", "ask", "plan", "auto"]

PigentErrorCode: TypeAlias = Literal[
    "invalid_request",
    "invalid_path",
    "permission_denied",
    "not_found",
    "unsupported_media",
    "too_large",
    "revision_conflict",
    "mode_denied",
    "confirmation_required",
    "kernel_unavailable",
    "kernel_busy",
    "execution_timeout",
    "cancelled",
    "internal_error",
    "document_dirty",
    "output_persist_conflict",
    "kernel_dead",
    "model_configuration_required",
    "service_unavailable",
    "payload_missing",
    "payload_stale",
    "uv_missing",
    "uv_incompatible",
    "config_migration_conflict",
    "config_migration_invalid_source",
    "kernel_environment_not_found",
    "kernel_environment_conflict",
    "kernel_environment_busy",
    "kernel_environment_stale",
    "kernel_environment_provision_failed",
    "kernel_environment_sync_failed",
    "kernel_queue_cancelled",
    "operation_not_cancellable",
    "interaction_superseded",
]
PIGENT_ERROR_CODES: tuple[PigentErrorCode, ...] = (
    "invalid_request", "invalid_path", "permission_denied", "not_found", "unsupported_media",
    "too_large", "revision_conflict", "mode_denied", "confirmation_required",
    "kernel_unavailable", "kernel_busy", "execution_timeout", "cancelled", "internal_error",
    "document_dirty", "output_persist_conflict", "kernel_dead",
    "model_configuration_required", "service_unavailable", "payload_missing", "payload_stale",
    "uv_missing", "uv_incompatible", "config_migration_conflict", "config_migration_invalid_source",
    "kernel_environment_not_found", "kernel_environment_conflict", "kernel_environment_busy",
    "kernel_environment_stale", "kernel_environment_provision_failed", "kernel_environment_sync_failed",
    "kernel_queue_cancelled", "operation_not_cancellable", "interaction_superseded",
)

PigentEventType: TypeAlias = Literal[
    "session.created", "session.updated", "mode.changed", "assistant.text", "assistant.thinking",
    "tool.start", "tool.update", "tool.end", "tasks.snapshot", "delegate.start",
    "delegate.update", "delegate.end", "interaction.required", "interaction.resolved",
    "context.updated", "kernel.updated", "artifact.created", "error", "aborted", "settled",
    "reconnect.cursor", "operation.started", "operation.updated", "operation.ended",
    "kernel.environment.updated",
]
PIGENT_EVENT_TYPES: tuple[PigentEventType, ...] = (
    "session.created", "session.updated", "mode.changed", "assistant.text", "assistant.thinking",
    "tool.start", "tool.update", "tool.end", "tasks.snapshot", "delegate.start",
    "delegate.update", "delegate.end", "interaction.required", "interaction.resolved",
    "context.updated", "kernel.updated", "artifact.created", "error", "aborted", "settled",
    "reconnect.cursor", "operation.started", "operation.updated", "operation.ended",
    "kernel.environment.updated",
)

PigentTaskStatus: TypeAlias = Literal["pending", "running", "done", "blocked", "failed"]
PIGENT_TASK_STATUSES: tuple[PigentTaskStatus, ...] = ("pending", "running", "done", "blocked", "failed")

PigentSessionStatus: TypeAlias = Literal["active", "completed", "failed", "interrupted", "waiting_for_user"]
PIGENT_SESSION_STATUSES: tuple[PigentSessionStatus, ...] = (
    "active", "completed", "failed", "interrupted", "waiting_for_user",
)

PigentArtifactKind: TypeAlias = Literal["image", "table", "text", "file"]
PIGENT_ARTIFACT_KINDS: tuple[PigentArtifactKind, ...] = ("image", "table", "text", "file")

PigentDelegateProfile: TypeAlias = Literal["analysis", "research", "review", "implementation"]
PIGENT_DELEGATE_PROFILES: tuple[PigentDelegateProfile, ...] = (
    "analysis", "research", "review", "implementation",
)

PigentCapability: TypeAlias = Literal[
    "filesystem.read", "filesystem.write", "visual.read", "notebook.read", "notebook.write",
    "kernel.status", "kernel.inspect", "kernel.execute", "process.execute",
    "process.interactive", "network", "system.execute", "tasks.write", "delegate.read",
    "delegate.write", "kernel.environment.read", "kernel.environment.manage",
]
PIGENT_CAPABILITIES: tuple[PigentCapability, ...] = (
    "filesystem.read", "filesystem.write", "visual.read", "notebook.read", "notebook.write",
    "kernel.status", "kernel.inspect", "kernel.execute", "process.execute",
    "process.interactive", "network", "system.execute", "tasks.write", "delegate.read",
    "delegate.write", "kernel.environment.read", "kernel.environment.manage",
)

CapabilityLevel: TypeAlias = Literal["allow", "deny", "os", "interactive"]

NOTBOOK_ACTIONS: tuple[str, ...] = (
    "read_cell", "update_cell", "insert_cell", "delete_cell", "move_cell", "run_cell",
    "add_markdown", "clear_output",
)
KERNEL_READ_ACTIONS: tuple[str, ...] = ("status", "list_environments", "operation_status")
KERNEL_ACTIONS: tuple[str, ...] = (
    "status", "execute", "interrupt", "restart", "shutdown", "list_environments", "operation_status",
    "create_temporary", "create_maintained", "sync_environment", "start_environment",
    "promote_environment", "delete_environment",
)
INSPECT_ACTIONS: tuple[str, ...] = ("variables", "variable", "dataframe", "figure", "object")
TASKS_ACTIONS: tuple[str, ...] = ("get", "replace", "patch")

# Frozen mode x capability matrix (03-modes-permissions.md). Ask and Plan
# restrictions define product intent; Auto is the single execution mode and is
# never degraded into a hidden restricted tier.
PIGENT_MODE_MATRIX: dict[PigentCapability, dict[PigentMode, CapabilityLevel]] = {
    "filesystem.read": {"ask": "allow", "plan": "allow", "auto": "os"},
    "visual.read": {"ask": "allow", "plan": "allow", "auto": "os"},
    "notebook.read": {"ask": "allow", "plan": "allow", "auto": "os"},
    "kernel.status": {"ask": "allow", "plan": "allow", "auto": "os"},
    "kernel.inspect": {"ask": "allow", "plan": "allow", "auto": "os"},
    "kernel.environment.read": {"ask": "allow", "plan": "allow", "auto": "allow"},
    "tasks.write": {"ask": "deny", "plan": "allow", "auto": "allow"},
    "delegate.read": {"ask": "allow", "plan": "allow", "auto": "allow"},
    "filesystem.write": {"ask": "deny", "plan": "deny", "auto": "os"},
    "notebook.write": {"ask": "deny", "plan": "deny", "auto": "os"},
    "kernel.execute": {"ask": "deny", "plan": "deny", "auto": "os"},
    "process.execute": {"ask": "deny", "plan": "deny", "auto": "os"},
    "process.interactive": {"ask": "deny", "plan": "deny", "auto": "interactive"},
    "network": {"ask": "deny", "plan": "deny", "auto": "os"},
    "system.execute": {"ask": "deny", "plan": "deny", "auto": "interactive"},
    "delegate.write": {"ask": "deny", "plan": "deny", "auto": "allow"},
    "kernel.environment.manage": {"ask": "deny", "plan": "deny", "auto": "os"},
}

# Projected tool catalogs by mode.
PIGENT_CATALOGS: dict[PigentMode, tuple[PigentToolName, ...]] = {
    "ask": ("read", "view", "notebook", "kernel", "inspect", "delegate"),
    "plan": ("read", "view", "notebook", "kernel", "inspect", "delegate", "tasks"),
    "auto": PIGENT_TOOL_NAMES,
}

# Per-mode action filters for multi-action tools.
PIGENT_ACTION_FILTERS: dict[str, dict[PigentMode, tuple[str, ...]]] = {
    "notebook": {
        "ask": ("read_cell",),
        "plan": ("read_cell",),
        "auto": NOTBOOK_ACTIONS,
    },
    "kernel": {
        "ask": KERNEL_READ_ACTIONS,
        "plan": KERNEL_READ_ACTIONS,
        "auto": KERNEL_ACTIONS,
    },
    "inspect": {
        "ask": INSPECT_ACTIONS,
        "plan": INSPECT_ACTIONS,
        "auto": INSPECT_ACTIONS,
    },
    "tasks": {
        "ask": (),
        "plan": TASKS_ACTIONS,
        "auto": TASKS_ACTIONS,
    },
    "delegate": {
        "ask": ("analysis", "research", "review"),
        "plan": ("analysis", "research", "review"),
        "auto": PIGENT_DELEGATE_PROFILES,
    },
}


def allowed_tools(mode: PigentMode) -> tuple[PigentToolName, ...]:
    """Tools advertised to the model in the selected mode."""
    if mode not in PIGENT_CATALOGS:
        raise ValueError(f"unknown Pigent mode: {mode!r}")
    return PIGENT_CATALOGS[mode]


def allowed_actions(tool: str, mode: PigentMode) -> tuple[str, ...]:
    """Actions allowed for a (multi-action) tool in the selected mode."""
    filter_ = PIGENT_ACTION_FILTERS.get(tool)
    if filter_ is None:
        return ()
    return filter_[mode]


def migrate_legacy_mode(value: Any) -> PigentMode:
    """Map legacy pilot state to auto; reject anything else unknown."""
    if value == "pilot":
        return "auto"
    if value in PIGENT_MODES:
        return value  # type: ignore[return-value]
    raise ValueError(f"invalid mode: {value!r} (pilot maps to auto, new schemas reject pilot)")


def migrate_legacy_session_state(state: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """Migrate legacy session state: mode/requested_mode/effective_mode pilot -> auto.

    Legacy fields are removed after one successful write in the new schema.
    Returns (migrated, changed).
    """
    migrated = dict(state)
    changed = False
    for key in ("mode", "requested_mode", "effective_mode"):
        if key in migrated:
            value = migrated[key]
            if value == "pilot":
                migrated[key] = "auto"
                changed = True
            elif value not in PIGENT_MODES:
                raise ValueError(f"invalid legacy mode field {key}: {value!r}")
    if changed:
        migrated.pop("requested_mode", None)
        migrated.pop("effective_mode", None)
    return migrated, changed


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

Revision = Annotated[str, StringConstraints(pattern=r"^sha256:[0-9a-f]{64}$")]
"""Opaque content revision: sha256:<64 hex>."""


def _revision_pattern() -> str:
    return r"^sha256:[0-9a-f]{64}$"


class ArtifactRef(BaseModel):
    id: str
    kind: PigentArtifactKind
    mime: str
    size: int = Field(ge=0)
    created_at: str
    hash: str = Field(pattern=_revision_pattern())
    width: int | None = Field(default=None, ge=0)
    height: int | None = Field(default=None, ge=0)
    expires_at: str | None = None


class PigentToolError(BaseModel):
    code: PigentErrorCode
    message: str
    retryable: bool = False
    details: dict[str, Any] = Field(default_factory=dict)


class Revisions(BaseModel):
    """Structured before/after revision pair returned by mutating tools."""

    before: Revision
    after: Revision


class PigentToolResult(BaseModel):
    """Versioned envelope returned by every Python-backed tool."""

    version: Literal[1] = 1
    ok: bool
    summary: str = ""
    data: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[ArtifactRef] = Field(default_factory=list)
    revisions: Revisions | None = Field(default=None)
    error: PigentToolError | None = None
    warnings: list[str] = Field(default_factory=list)


class PigentToolContext(BaseModel):
    """Trusted context injected by the Pigent host; the model never overrides it."""

    protocol_version: Literal["0.2"] = "0.2"
    tool_call_id: str
    session_id: str
    workspace_id: str
    mode: PigentMode
    active_document: dict[str, str] | None = None
    active_kernel_id: str | None = None


OperationState: TypeAlias = Literal["queued", "running", "waiting_for_user", "succeeded", "failed", "cancelled"]
OperationOutcome: TypeAlias = Literal["success", "partial", "failed", "cancelled", "superseded"]
KernelEnvironmentKind: TypeAlias = Literal["temporary", "maintained"]
KernelEnvironmentStatus: TypeAlias = Literal["provisioning", "ready", "stale", "syncing", "error", "deleting", "missing"]


class OperationProgress(BaseModel):
    phase: str
    completed: int = Field(default=0, ge=0)
    total: int | None = Field(default=None, ge=0)
    message: str = ""


class ToolReceipt(BaseModel):
    outcome: OperationOutcome
    summary: str
    identifiers: dict[str, str] = Field(default_factory=dict)
    at: str


class OperationResource(BaseModel):
    type: Literal["kernel_environment"]
    id: str


class OperationEnvelope(BaseModel):
    operation_id: str
    kind: str
    state: OperationState
    progress: OperationProgress | None = None
    resource: OperationResource
    created_at: str
    updated_at: str
    session_id: str | None = None
    tool_call_id: str | None = None
    cancellable: bool = True
    receipt: ToolReceipt | None = None
    error: PigentToolError | None = None


class KernelEnvironmentSummary(BaseModel):
    id: str
    kind: KernelEnvironmentKind
    name: str | None = None
    display_name: str
    status: KernelEnvironmentStatus
    python_request: str
    python_version: str | None = None
    interpreter: str | None = None
    packages: list[str] = Field(default_factory=list)
    source: dict[str, Any] | None = None
    lock_revision: str | None = None
    revision: str
    created_at: str
    updated_at: str
    last_used_at: str | None = None
    expires_at: str | None = None
    active_kernel_ids: list[str] = Field(default_factory=list)
    last_error: PigentToolError | None = None


class ExecutionIdentity(BaseModel):
    username: str
    uid: int | str | None = None
    home: str
    workspace: str


class ModeState(BaseModel):
    """Persisted mode selection. No requested/effective split."""

    mode: PigentMode
    changed_by: Literal["user", "host"] = "user"
    changed_at: str
    approval_preference: Literal["automatic", "review_all"] = "automatic"


class TaskNode(BaseModel):
    id: str
    title: str
    status: PigentTaskStatus
    depends_on: list[str] = Field(default_factory=list)
    completion_criteria: list[str] = Field(default_factory=list)
    children: list[TaskNode] = Field(default_factory=list)


class TasksSnapshot(BaseModel):
    revision: str
    root: TaskNode
    updated_at: str | None = None


class PigentSession(BaseModel):
    id: str
    account_id: str
    project_id: str
    workspace_id: str
    node_id: str
    mode: PigentMode
    approval_preference: Literal["automatic", "review_all"] = "automatic"
    status: PigentSessionStatus
    title: str | None = None
    created_at: str
    last_activity_at: str
    active_document: dict[str, str] | None = None
    active_kernel_id: str | None = None
    model: dict[str, str] | None = None
    tasks_snapshot: TasksSnapshot | None = None


class TerminalSession(BaseModel):
    """A persistent human Shell/PTY session; one tab is one real process."""

    id: str
    name: str
    executable: str
    cwd: str
    status: Literal["running", "exited", "closed"]
    cols: int = Field(default=80, ge=2, le=500)
    rows: int = Field(default=24, ge=1, le=500)
    created_at: str
    last_exit_code: int | None = None


class PigentInteraction(BaseModel):
    """Human interaction is a host event, never an LLM tool."""

    version: Literal[1] = 1
    interaction_id: str
    session_id: str
    tool_call_id: str
    kind: Literal["pty_handoff", "review_request", "clarification"]
    summary: str
    shell_session_id: str | None = None
    command_preview: str | None = None
    choices: list[Literal["open_shell", "cancel", "allow_once", "allow_workspace", "reject"]] = Field(
        min_length=1
    )


class PigentEvent(BaseModel):
    """Public browser event; reconnect.cursor has no business event ID."""

    version: Literal[1] = 1
    event_id: int | None = Field(default=None, ge=1)
    session_id: str
    type: PigentEventType
    timestamp: str
    payload: dict[str, Any] = Field(default_factory=dict)


class WorkspaceContext(BaseModel):
    """Active workspace context published independently of prompts."""

    type: Literal["workspace.context"] = "workspace.context"
    active_document: str
    document_revision: str | None = None
    active_cell_id: str | None = None
    selection: str | None = None
    active_kernel_id: str | None = None
    selected_figure_id: str | None = None
