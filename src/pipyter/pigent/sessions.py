from __future__ import annotations

import asyncio
import getpass
import json
import os
import re
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from ..protocol.pigent import PIGENT_CATALOGS, PIGENT_EVENT_TYPES, PIGENT_PROTOCOL_VERSION
from .config import PigentConfigError, PigentConfigStore
from .manager import PigentManager, PigentUnavailable
from .modes import normalize_mode


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_event_value(value: Any) -> Any:
    private_fields = {"executionidentity", "username", "uid", "home", "workspace", "workspaceroot", "userconfigdir", "sessiondir", "bridgeendpoint"}
    if isinstance(value, list):
        return [_public_event_value(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: _public_event_value(item)
        for key, item in value.items()
        if "".join(character for character in key.casefold() if character.isalnum()) not in private_fields
    }


def _automatic_session_title(content: str, limit: int = 48) -> str | None:
    """Build a stable one-line title without making a second model call."""
    text = re.sub(r"```[\s\S]*?```", " ", content)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"^\s{0,3}(?:#{1,6}|[-*+]|\d+[.)])\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+", " ", text).strip(" \t\r\n\"'`，。！？!?：:；;")
    if not text:
        return None
    if len(text) <= limit:
        return text
    title = text[:limit].rstrip()
    # Avoid a visibly broken English word when there is a useful boundary nearby.
    boundary = max(title.rfind(" "), title.rfind("，"), title.rfind(","), title.rfind("。"))
    if boundary >= max(12, limit // 2):
        title = title[:boundary].rstrip(" ，,。")
    return f"{title}…"


class SessionCreate(BaseModel):
    mode: str = "ask"
    approval_preference: str = "automatic"
    title: str | None = None


class ProjectSessionCreate(SessionCreate):
    workspace: str = Field(min_length=1, max_length=4096)
    kernel_name: str | None = Field(default=None, min_length=1, max_length=200)


class MessageCreate(BaseModel):
    client_message_id: str = Field(min_length=1)
    content: str = Field(min_length=1)
    behavior: str = "prompt"


class AbortRequest(BaseModel):
    run_id: str | None = None
    reason: str = "user_stop"


class SessionPatch(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class InteractionDecision(BaseModel):
    revision: int = Field(ge=1)
    decision_id: str = Field(min_length=1)
    action_id: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)


class ModeChange(BaseModel):
    mode: str


class ModelChange(BaseModel):
    provider: str
    model: str
    revision: str | None = None


class ContextChange(BaseModel):
    active_document: str | None = None
    active_kernel_id: str | None = None
    run_id: str | None = None
    turn_id: str | None = None
    accepted_messages: dict[str, dict[str, Any]] = field(default_factory=dict)
    interactions: dict[str, dict[str, Any]] = field(default_factory=dict)


@dataclass(slots=True)
class SessionState:
    id: str
    mode: str
    approval_preference: str
    model: dict[str, Any]
    execution_identity: dict[str, Any]
    title: str | None = None
    status: str = "active"
    created_at: str = field(default_factory=_now)
    last_activity_at: str = field(default_factory=_now)
    tasks: dict[str, Any] | None = None
    events: list[dict[str, Any]] = field(default_factory=list)
    next_event_id: int = 1
    subscribers: set[asyncio.Queue[dict[str, Any]]] = field(default_factory=set)
    message_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    host_attached: bool = False
    run_active: bool = False
    active_document: str | None = None
    active_kernel_id: str | None = None
    run_id: str | None = None
    turn_id: str | None = None
    accepted_messages: dict[str, dict[str, Any]] = field(default_factory=dict)
    interactions: dict[str, dict[str, Any]] = field(default_factory=dict)
    workspace_path: str = "."
    owned_kernel_id: str | None = None


class PigentSessionService:
    def __init__(self, workspace: Path, project: Any, bridge: Any, config: PigentConfigStore, manager: PigentManager):
        self.workspace = workspace
        self.project = project
        self.bridge = bridge
        self.config = config
        self.manager = manager
        self.sessions: dict[str, SessionState] = {}
        self._lock = asyncio.Lock()
        self.state_dir = workspace / ".pipyter" / "pigent" / "public-sessions"
        self.events_dir = workspace / ".pipyter" / "pigent" / "events"
        self._load()
        manager.on_event = self.accept_host_event

    def summary(self, session: SessionState) -> dict[str, Any]:
        value = {
            "id": session.id,
            "account_id": "local",
            "project_id": self.project.project_id,
            "workspace_id": self.project.workspace_id,
            "node_id": "local",
            "mode": session.mode,
            "approval_preference": session.approval_preference,
            "status": session.status,
            "title": session.title,
            "created_at": session.created_at,
            "last_activity_at": session.last_activity_at,
            "model": {"provider": session.model["provider"], "model": session.model["model"]},
            "tasks_snapshot": session.tasks,
            "run_id": session.run_id,
            "turn_id": session.turn_id,
        }
        if session.active_kernel_id:
            value["active_kernel_id"] = session.active_kernel_id
        if session.workspace_path != ".":
            value["project_workspace"] = session.workspace_path
        return value

    def _persist(self, session: SessionState) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        payload = self.summary(session)
        payload["execution_identity"] = session.execution_identity
        payload["next_event_id"] = session.next_event_id
        payload["run_active"] = session.run_active
        payload["active_document_path"] = session.active_document
        payload["owned_kernel_id"] = session.owned_kernel_id
        payload["accepted_messages"] = session.accepted_messages
        payload["interactions"] = session.interactions
        fd, temporary = tempfile.mkstemp(prefix=f".{session.id}.", dir=self.state_dir)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False, sort_keys=True)
                handle.write("\n")
            os.replace(temporary, self.state_dir / f"{session.id}.json")
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def _load(self) -> None:
        if not self.state_dir.exists():
            return
        for path in self.state_dir.glob("pigent_*.json"):
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
                stored_status = value.get("status", "interrupted")
                if stored_status in {"active", "waiting_for_user"}:
                    stored_status = "interrupted"
                session = SessionState(
                    value["id"], normalize_mode(value["mode"]), value.get("approval_preference", "automatic"),
                    value.get("model") or {}, value.get("execution_identity") or {}, value.get("title"), stored_status,
                    value["created_at"], value["last_activity_at"], value.get("tasks_snapshot"), [],
                    int(value.get("next_event_id", 1)), set(), asyncio.Lock(), False, False,
                )
                session.active_document = value.get("active_document_path")
                session.active_kernel_id = value.get("active_kernel_id")
                session.owned_kernel_id = value.get("owned_kernel_id")
                session.workspace_path = value.get("project_workspace", ".")
                session.run_id = value.get("run_id")
                session.turn_id = value.get("turn_id")
                session.accepted_messages = dict(value.get("accepted_messages") or {})
                session.interactions = dict(value.get("interactions") or {})
                event_path = self.events_dir / f"{session.id}.jsonl"
                if event_path.exists():
                    session.events = [json.loads(line) for line in event_path.read_text(encoding="utf-8").splitlines()[-1000:] if line]
                    if session.events:
                        session.next_event_id = max(session.next_event_id, session.events[-1]["event_id"] + 1)
                self.sessions[session.id] = session
            except Exception:
                continue

    async def _ensure_attached(self, session: SessionState) -> None:
        if session.host_attached and self.manager.status().get("status") == "running":
            return
        session_workspace = self._session_workspace(session)
        # Persisted execution identity is informational only. Re-authorize the
        # session root on every attach so the Host and Python bridge cannot
        # diverge after a state edit, symlink change, or Runtime relocation.
        session.execution_identity = {
            **session.execution_identity,
            "workspace": str(session_workspace),
        }
        if session.id not in self.bridge.sessions:
            self.bridge.register_session(
                session.id,
                mode=session.mode,
                workspace=session_workspace,
                active_document=session.active_document,
                active_kernel_id=session.active_kernel_id,
            )
        attached = await self.manager.command("create_session", session={
            **self.summary(session),
            "execution_identity": session.execution_identity,
            "active_document": session.active_document,
            "tools": list(PIGENT_CATALOGS[session.mode]),
        })
        attached_model = attached.get("model")
        if isinstance(attached_model, dict) and isinstance(attached_model.get("provider"), str) and isinstance(attached_model.get("model"), str):
            session.model = {"provider": attached_model["provider"], "model": attached_model["model"], "baseUrl": None}
        session.host_attached = True

    def _resolve_project_workspace(self, value: str) -> tuple[Path, str]:
        if "\x00" in value:
            raise HTTPException(status_code=400, detail={"code": "invalid_path", "message": "Workspace path contains NUL"})
        requested = Path(value).expanduser()
        try:
            candidate = requested if requested.is_absolute() else self.workspace / requested
            unresolved = candidate.resolve(strict=False)
            unresolved.relative_to(self.workspace.resolve())
            resolved = candidate.resolve(strict=True)
            relative = resolved.relative_to(self.workspace.resolve())
        except FileNotFoundError as error:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Project directory does not exist"}) from error
        except (OSError, RuntimeError, ValueError) as error:
            raise HTTPException(status_code=403, detail={"code": "permission_denied", "message": "Project directory must stay inside the Runtime Workspace"}) from error
        if not resolved.is_dir():
            raise HTTPException(status_code=400, detail={"code": "invalid_path", "message": "Project workspace must be a directory"})
        return resolved, relative.as_posix() or "."

    def _session_workspace(self, session: SessionState) -> Path:
        resolved, _ = self._resolve_project_workspace(session.workspace_path)
        return resolved

    async def create(self, body: SessionCreate, *, workspace: Path | None = None,
                     workspace_path: str = ".", active_kernel_id: str | None = None,
                     owned_kernel_id: str | None = None) -> SessionState:
        try:
            mode = normalize_mode(body.mode)
            model = self.config.resolve_model()
        except PigentConfigError as error:
            code = "model_configuration_required" if "model_configuration_required" in str(error) else "invalid_request"
            raise HTTPException(status_code=409, detail={"code": code, "message": str(error)}) from error
        except Exception as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        session_id = "pigent_" + uuid.uuid4().hex
        identity = {
            "username": getpass.getuser(),
            "uid": os.getuid() if hasattr(os, "getuid") else None,
            "home": str(Path.home()),
            "workspace": str(workspace or self.workspace),
        }
        session = SessionState(session_id, mode, body.approval_preference, model, identity, body.title)
        session.workspace_path = workspace_path
        session.active_kernel_id = active_kernel_id
        session.owned_kernel_id = owned_kernel_id
        async with self._lock:
            self.sessions[session_id] = session
        try:
            self.bridge.register_session(
                session_id, mode=mode, workspace=workspace or self.workspace, active_kernel_id=active_kernel_id,
            )
            await self._ensure_attached(session)
        except (PigentUnavailable, OSError) as error:
            self.sessions.pop(session_id, None)
            self.bridge.sessions.pop(session_id, None)
            raise HTTPException(status_code=503, detail={"code": "service_unavailable", "message": str(error)}) from error
        except Exception:
            self.sessions.pop(session_id, None)
            self.bridge.sessions.pop(session_id, None)
            raise
        await self.emit(session, "session.created", {"session": self.summary(session)})
        self._persist(session)
        return session

    async def create_project(self, body: ProjectSessionCreate) -> SessionState:
        workspace, workspace_path = self._resolve_project_workspace(body.workspace)
        kernel_id = None
        if body.kernel_name:
            kernels = getattr(self.bridge, "kernels", None)
            if kernels is None:
                raise HTTPException(status_code=503, detail={"code": "service_unavailable", "message": "Kernel service is unavailable"})
            try:
                available = {item.name for item in kernels.specs()}
            except Exception as error:
                raise HTTPException(status_code=503, detail={"code": "service_unavailable", "message": "Kernel specs are unavailable"}) from error
            if body.kernel_name not in available:
                raise HTTPException(status_code=409, detail={"code": "kernel_unavailable", "message": "Selected Kernel is unavailable"})
            try:
                kernel = await kernels.start_async(body.kernel_name, cwd=workspace)
                kernel_id = kernel.id
            except Exception as error:
                raise HTTPException(status_code=409, detail={"code": "kernel_unavailable", "message": str(error)}) from error
        try:
            return await self.create(body, workspace=workspace, workspace_path=workspace_path,
                                     active_kernel_id=kernel_id, owned_kernel_id=kernel_id)
        except Exception:
            if kernel_id:
                try:
                    await self.bridge.kernels.shutdown_async(kernel_id)
                except Exception:
                    pass
            raise

    def get(self, session_id: str) -> SessionState:
        try:
            return self.sessions[session_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Pigent session not found") from error

    async def emit(self, session: SessionState, event_type: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        if event_type not in PIGENT_EVENT_TYPES:
            event_type = "error"
            payload = {"code": "internal_error", "message": "unknown host event"}
        async with self._lock:
            event = {"version": 1, "event_id": session.next_event_id, "session_id": session.id,
                     "type": event_type, "timestamp": _now(), "payload": payload or {}}
            session.next_event_id += 1
            session.events.append(event)
            self.events_dir.mkdir(parents=True, exist_ok=True)
            with (self.events_dir / f"{session.id}.jsonl").open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")
            if len(session.events) > 1000:
                del session.events[:-1000]
            session.last_activity_at = event["timestamp"]
            subscribers = tuple(session.subscribers)
            self._persist(session)
        for queue in subscribers:
            queue.put_nowait(event)
        return event

    async def accept_host_event(self, event: dict[str, Any]) -> None:
        session_id = event.get("session_id")
        if not isinstance(session_id, str) or session_id not in self.sessions:
            return
        session = self.sessions[session_id]
        event_type = str(event.get("type"))
        payload = _public_event_value(dict(event.get("payload") or {}))
        if event_type == "tasks.snapshot":
            session.tasks = payload.get("snapshot")
        elif event_type == "mode.changed":
            try:
                session.mode = normalize_mode(payload.get("mode"))
                self.bridge.update_session(session.id, mode=session.mode)
            except Exception:
                event_type = "error"
                payload = {"code": "internal_error", "message": "invalid host mode event"}
        if event_type in {
            "assistant.text", "assistant.thinking", "tool.start", "tool.update", "tool.end",
            "delegate.start", "delegate.update", "delegate.end",
        }:
            session.run_active = True
        if event_type == "settled":
            requested_status = payload.get("status")
            session.status = requested_status if requested_status in {
                "active", "completed", "failed", "interrupted", "waiting_for_user",
            } else "completed"
            session.run_active = False
        elif event_type == "aborted":
            session.status = "interrupted"
            session.run_active = False
        elif event_type == "error":
            session.status = "failed"
            session.run_active = False
        elif event_type == "interaction.required":
            interaction = payload.get("interaction") if isinstance(payload.get("interaction"), dict) else payload
            interaction_id = interaction.get("interaction_id") if isinstance(interaction, dict) else None
            if isinstance(interaction_id, str):
                session.interactions[interaction_id] = {**interaction, "revision": int(payload.get("revision", 1)), "state": "pending", "decisions": {}}
            session.status = "waiting_for_user"
            session.run_active = True
        elif event_type == "interaction.resolved":
            interaction_id = payload.get("interaction_id")
            if isinstance(interaction_id, str) and interaction_id in session.interactions:
                session.interactions[interaction_id]["state"] = "resolved"
            session.status = "active"
            session.run_active = True
        await self.emit(session, event_type, payload)

    async def message(self, session: SessionState, body: MessageCreate) -> dict[str, Any]:
        fingerprint = json.dumps({"content": body.content, "behavior": body.behavior}, ensure_ascii=False, sort_keys=True)
        async with session.message_lock:
            existing = session.accepted_messages.get(body.client_message_id)
            if existing is not None:
                if existing.get("fingerprint") != fingerprint:
                    raise HTTPException(status_code=409, detail={"code": "invalid_request", "message": "client_message_id was reused with different content"})
                return {key: existing[key] for key in ("accepted", "client_message_id", "run_id", "turn_id")}
            if session.run_active and body.behavior != "follow_up":
                raise HTTPException(status_code=409, detail={"code": "invalid_request", "message": "An active run accepts follow_up messages only"})
            command = "follow_up" if body.behavior == "follow_up" else "prompt"
            await self._ensure_attached(session)
            previous_status, previous_run_active = session.status, session.run_active
            run_id = session.run_id if body.behavior == "follow_up" and session.run_active else "run_" + uuid.uuid4().hex
            turn_id = "turn_" + uuid.uuid4().hex
            accepted = {"accepted": True, "client_message_id": body.client_message_id, "run_id": run_id, "turn_id": turn_id,
                        "fingerprint": fingerprint, "state": "reserved"}
            session.accepted_messages[body.client_message_id] = accepted
            session.status = "active"
            session.run_active = True
            session.run_id = run_id
            session.turn_id = turn_id
            if not session.title:
                session.title = _automatic_session_title(body.content)
            self._persist(session)
            try:
                await self.manager.command(command, session_id=session.id, text=body.content,
                                           client_message_id=body.client_message_id, run_id=run_id, turn_id=turn_id)
            except Exception:
                session.accepted_messages.pop(body.client_message_id, None)
                session.status, session.run_active = previous_status, previous_run_active
                self._persist(session)
                raise
            accepted["state"] = "accepted"
            self._persist(session)
            await self.emit(session, "session.updated", {"session": self.summary(session), "run_active": True,
                                                           "client_message_id": body.client_message_id,
                                                           "run_id": run_id, "turn_id": turn_id})
            return {key: accepted[key] for key in ("accepted", "client_message_id", "run_id", "turn_id")}

    async def resolve_interaction(self, interaction_id: str, body: InteractionDecision) -> dict[str, Any]:
        session = next((item for item in self.sessions.values() if interaction_id in item.interactions), None)
        if session is None:
            raise HTTPException(status_code=404, detail="Interaction not found")
        interaction = session.interactions[interaction_id]
        decisions = interaction.setdefault("decisions", {})
        existing = decisions.get(body.decision_id)
        fingerprint = json.dumps({"action_id": body.action_id, "payload": body.payload}, sort_keys=True)
        if existing:
            if existing["fingerprint"] != fingerprint:
                raise HTTPException(status_code=409, detail={"code": "invalid_request", "message": "decision_id conflict"})
            return existing["receipt"]
        if interaction.get("revision") != body.revision or interaction.get("state") != "pending":
            raise HTTPException(status_code=409, detail={"code": "interaction_superseded", "message": "Interaction was superseded or already resolved"})
        choices = interaction.get("choices") or []
        if body.action_id not in choices:
            raise HTTPException(status_code=400, detail={"code": "invalid_request", "message": "Action is not advertised"})
        response = await self.manager.command("interaction_resolve", session_id=session.id, interaction_id=interaction_id,
                                              revision=body.revision, decision_id=body.decision_id,
                                              action_id=body.action_id, payload=body.payload)
        receipt = response.get("receipt") if isinstance(response.get("receipt"), dict) else {
            "outcome": "success", "summary": f"Interaction resolved: {body.action_id}",
            "identifiers": {"interaction_id": interaction_id, "decision_id": body.decision_id}, "at": _now(),
        }
        decisions[body.decision_id] = {"fingerprint": fingerprint, "receipt": receipt}
        interaction["state"] = "resolved"
        session.status = "active"
        public_interaction = {key: value for key, value in interaction.items() if key not in {"decisions", "state"}}
        await self.emit(session, "interaction.resolved", {"interaction_id": interaction_id, "decision_id": body.decision_id,
                                                           "action_id": body.action_id, "interaction": public_interaction,
                                                           "revision": interaction.get("revision", body.revision), "receipt": receipt})
        return receipt

    async def change_mode(self, session: SessionState, raw_mode: str) -> None:
        try:
            mode = normalize_mode(raw_mode)
        except Exception as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        await self._ensure_attached(session)
        await self.manager.command("mode_change", session_id=session.id, mode=mode)
        session.mode = mode
        self.bridge.update_session(session.id, mode=mode)
        self._persist(session)

    async def change_model(self, session: SessionState, body: ModelChange) -> str:
        if session.run_active:
            raise HTTPException(status_code=409, detail={"code": "invalid_request", "message": "Cannot change model while a run is active"})
        await self._ensure_attached(session)
        original = self.config.read_settings()
        try:
            written, resolved = self.config.select_ui_model(body.provider, body.model, body.revision)
        except PigentConfigError as error:
            code = "model_configuration_required" if "model_configuration_required" in str(error) else "invalid_request"
            raise HTTPException(status_code=409, detail={"code": code, "message": str(error)}) from error
        try:
            response = await self.manager.command(
                "model_change",
                session_id=session.id,
                provider=body.provider,
                model=body.model,
            )
        except Exception as error:
            try:
                self.config.write_settings(original.value, written.revision)
            except PigentConfigError:
                pass
            raise HTTPException(status_code=409, detail={"code": "model_configuration_required", "message": str(error)}) from error
        confirmed = response.get("model")
        session.model = confirmed if isinstance(confirmed, dict) else resolved
        self._persist(session)
        await self.emit(session, "session.updated", {
            "session": self.summary(session),
            "run_active": session.run_active,
            "settings_revision": written.revision,
        })
        return written.revision

    async def change_context(self, session: SessionState, body: ContextChange) -> None:
        active_document = None
        if body.active_document:
            try:
                session_workspace = self._session_workspace(session)
                resolved = (session_workspace / body.active_document).resolve()
                active_document = resolved.relative_to(session_workspace).as_posix()
            except (OSError, ValueError) as error:
                raise HTTPException(status_code=400, detail="active_document must stay inside the session Workspace") from error
        if body.active_kernel_id:
            kernels = getattr(self.bridge, "kernels", None)
            session_workspace = self._session_workspace(session)
            owns_workspace = getattr(kernels, "owns_workspace", None) if kernels is not None else None
            valid_kernel = any(item.id == body.active_kernel_id for item in kernels.list()) if kernels is not None else False
            if valid_kernel and callable(owns_workspace):
                valid_kernel = bool(owns_workspace(body.active_kernel_id, session_workspace))
            if kernels is not None and not valid_kernel:
                raise HTTPException(status_code=409, detail={"code": "kernel_unavailable", "message": "Active kernel is unavailable"})
        session.active_document = active_document
        session.active_kernel_id = body.active_kernel_id
        await self._ensure_attached(session)
        self.bridge.update_session(
            session.id,
            active_document=active_document,
            clear_active_document=active_document is None,
            active_kernel_id=body.active_kernel_id,
            clear_active_kernel=body.active_kernel_id is None,
        )
        await self.manager.command(
            "context_change",
            session_id=session.id,
            active_document=active_document,
            active_kernel_id=body.active_kernel_id,
        )
        self._persist(session)
        await self.emit(session, "context.updated", {
            "active_document": active_document,
            "active_kernel_id": body.active_kernel_id,
        })

    def replay(self, session: SessionState, after_event_id: int) -> list[dict[str, Any]]:
        return [event for event in session.events if event["event_id"] > after_event_id]

    def history(self, session: SessionState, before_event_id: int | None, limit: int) -> list[dict[str, Any]]:
        path = self.events_dir / f"{session.id}.jsonl"
        if not path.exists():
            return []
        selected: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                event = json.loads(line)
                event_id = event.get("event_id")
                if not isinstance(event_id, int):
                    continue
                if before_event_id is None or event_id < before_event_id:
                    selected.append(event)
                    if len(selected) > limit:
                        del selected[0]
        return selected


def create_public_router(service: PigentSessionService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/pigent", tags=["pigent"])

    @router.post("/sessions", status_code=201)
    async def create_session(body: SessionCreate) -> dict[str, Any]:
        return service.summary(await service.create(body))

    @router.post("/projects/sessions", status_code=201)
    async def create_project_session(body: ProjectSessionCreate) -> dict[str, Any]:
        return service.summary(await service.create_project(body))

    @router.get("/sessions")
    async def list_sessions(workspace_id: str | None = None, query: str | None = None,
                            before: str | None = None, limit: int = Query(default=50, ge=1, le=200)) -> list[dict[str, Any]]:
        if workspace_id and workspace_id != service.project.workspace_id:
            return []
        items = sorted(service.sessions.values(), key=lambda item: item.last_activity_at, reverse=True)
        if query:
            needle = query.casefold()
            items = [item for item in items if needle in (item.title or "").casefold()]
        if before:
            items = [item for item in items if item.last_activity_at < before]
        return [service.summary(item) for item in items[:limit]]

    @router.patch("/sessions/{session_id}")
    async def patch_session(session_id: str, body: SessionPatch) -> dict[str, Any]:
        session = service.get(session_id)
        session.title = body.title.strip()
        service._persist(session)
        await service.emit(session, "session.updated", {"session": service.summary(session), "run_active": session.run_active})
        return service.summary(session)

    @router.get("/sessions/{session_id}/events")
    async def session_events(session_id: str, before_event_id: int | None = Query(default=None, ge=1),
                             limit: int = Query(default=100, ge=1, le=500)) -> dict[str, Any]:
        events = service.history(service.get(session_id), before_event_id, limit)
        return {"events": events, "has_more": bool(events and events[0]["event_id"] > 1),
                "before_event_id": events[0]["event_id"] if events else before_event_id}

    @router.get("/sessions/{session_id}")
    async def get_session(session_id: str) -> dict[str, Any]:
        return service.summary(service.get(session_id))

    @router.delete("/sessions/{session_id}", status_code=204)
    async def delete_session(session_id: str) -> None:
        session = service.get(session_id)
        if session.run_active or any(item.get("state") == "pending" for item in session.interactions.values()):
            raise HTTPException(status_code=409, detail={"code": "invalid_request", "message": "Abort or resolve the active session before deletion"})
        try:
            await service.manager.command("delete_session", session_id=session_id)
        finally:
            if session.owned_kernel_id:
                try:
                    await service.bridge.kernels.shutdown_async(session.owned_kernel_id)
                except Exception:
                    pass
            service.sessions.pop(session_id, None)
            service.bridge.sessions.pop(session_id, None)
            (service.state_dir / f"{session_id}.json").unlink(missing_ok=True)
            (service.events_dir / f"{session_id}.jsonl").unlink(missing_ok=True)

    @router.post("/sessions/{session_id}/messages", status_code=202)
    async def send_message(session_id: str, body: MessageCreate) -> dict[str, Any]:
        return await service.message(service.get(session_id), body)

    @router.post("/sessions/{session_id}/abort", status_code=202)
    async def abort(session_id: str, body: AbortRequest) -> dict[str, bool]:
        session = service.get(session_id)
        if body.run_id and session.run_id and body.run_id != session.run_id:
            raise HTTPException(status_code=409, detail={"code": "invalid_request", "message": "run_id does not match the active run"})
        if not session.run_active:
            return {"accepted": True, "already_settled": True}
        await service.manager.command("abort", session_id=session.id, run_id=session.run_id, reason=body.reason)
        await service.bridge.cancel_session(session.id)
        return {"accepted": True, "already_settled": False}

    @router.post("/interactions/{interaction_id}")
    async def resolve_interaction(interaction_id: str, body: InteractionDecision) -> dict[str, Any]:
        return {"receipt": await service.resolve_interaction(interaction_id, body)}

    @router.put("/sessions/{session_id}/mode")
    async def mode(session_id: str, body: ModeChange) -> dict[str, Any]:
        session = service.get(session_id)
        await service.change_mode(session, body.mode)
        return service.summary(session)

    @router.put("/sessions/{session_id}/model")
    async def model(session_id: str, body: ModelChange) -> dict[str, Any]:
        session = service.get(session_id)
        revision = await service.change_model(session, body)
        return {"session": service.summary(session), "revision": revision}

    @router.put("/sessions/{session_id}/context")
    async def context(session_id: str, body: ContextChange) -> dict[str, Any]:
        session = service.get(session_id)
        await service.change_context(session, body)
        return service.summary(session)

    @router.get("/sessions/{session_id}/tasks")
    async def tasks(session_id: str) -> dict[str, Any]:
        session = service.get(session_id)
        return session.tasks or {"revision": "0", "root": {"id": "root", "title": "Tasks", "status": "pending"}}

    @router.get("/capabilities")
    async def capabilities() -> dict[str, Any]:
        model_state = service.config.ui_model_state()
        host_status = service.manager.status()
        try:
            negotiated = await service.manager.negotiated_capabilities(start=True)
        except Exception as error:
            negotiated = {
                "protocol_version": PIGENT_PROTOCOL_VERSION,
                "tools": [],
                "modes": {"ask": [], "plan": [], "auto": []},
                "action_filters": {},
                "capabilities": [],
                "event_types": [],
            }
            host_status = {**host_status, "negotiation_error": str(error)}
        return {**negotiated, **model_state, "host": host_status}

    @router.websocket("/sessions/{session_id}/stream")
    async def stream(websocket: WebSocket, session_id: str, after_event_id: int = Query(default=0, ge=0)) -> None:
        session = service.get(session_id)
        await websocket.accept()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        try:
            async with service._lock:
                session.subscribers.add(queue)
                replay = service.replay(session, after_event_id)
                snapshot = {"session": service.summary(session), "tasks": session.tasks,
                            "active_calls": [], "run_active": session.run_active,
                            "after_event_id": after_event_id}
                service._persist(session)
            for event in replay:
                await websocket.send_json(event)
            await websocket.send_json({"version": 1, "event_id": None,
                                       "session_id": session.id, "type": "reconnect.cursor", "timestamp": _now(),
                                       "payload": snapshot})
            while True:
                await websocket.send_json(await queue.get())
        except WebSocketDisconnect:
            pass
        finally:
            session.subscribers.discard(queue)

    return router
