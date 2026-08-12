from __future__ import annotations

import asyncio
import getpass
import json
import os
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from ..protocol.pigent import PIGENT_ACTION_FILTERS, PIGENT_CAPABILITIES, PIGENT_CATALOGS, PIGENT_EVENT_TYPES
from .config import PigentConfigError, PigentConfigStore
from .manager import PigentManager, PigentUnavailable
from .modes import normalize_mode


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SessionCreate(BaseModel):
    mode: str = "ask"
    approval_preference: str = "automatic"
    title: str | None = None


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)
    behavior: str = "prompt"


class ModeChange(BaseModel):
    mode: str


class ModelChange(BaseModel):
    provider: str
    model: str
    revision: str | None = None


class ContextChange(BaseModel):
    active_document: str | None = None
    active_kernel_id: str | None = None


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
    host_attached: bool = False
    run_active: bool = False
    active_document: str | None = None
    active_kernel_id: str | None = None


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
            "execution_identity": session.execution_identity,
            "status": session.status,
            "title": session.title,
            "created_at": session.created_at,
            "last_activity_at": session.last_activity_at,
            "model": {"provider": session.model["provider"], "model": session.model["model"]},
            "tasks_snapshot": session.tasks,
        }
        if session.active_kernel_id:
            value["active_kernel_id"] = session.active_kernel_id
        return value

    def _persist(self, session: SessionState) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        payload = self.summary(session)
        payload["next_event_id"] = session.next_event_id
        payload["run_active"] = session.run_active
        payload["active_document_path"] = session.active_document
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
                    value.get("model") or {}, value["execution_identity"], value.get("title"), stored_status,
                    value["created_at"], value["last_activity_at"], value.get("tasks_snapshot"), [],
                    int(value.get("next_event_id", 1)), set(), False, False,
                )
                session.active_document = value.get("active_document_path")
                session.active_kernel_id = value.get("active_kernel_id")
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
        if session.id not in self.bridge.sessions:
            self.bridge.register_session(
                session.id,
                mode=session.mode,
                active_document=session.active_document,
                active_kernel_id=session.active_kernel_id,
            )
        attached = await self.manager.command("create_session", session={
            **self.summary(session),
            "active_document": session.active_document,
            "tools": list(PIGENT_CATALOGS[session.mode]),
        })
        attached_model = attached.get("model")
        if isinstance(attached_model, dict) and isinstance(attached_model.get("provider"), str) and isinstance(attached_model.get("model"), str):
            session.model = {"provider": attached_model["provider"], "model": attached_model["model"], "baseUrl": None}
        session.host_attached = True

    async def create(self, body: SessionCreate) -> SessionState:
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
            "workspace": str(self.workspace),
        }
        session = SessionState(session_id, mode, body.approval_preference, model, identity, body.title)
        async with self._lock:
            self.sessions[session_id] = session
        self.bridge.register_session(session_id, mode=mode)
        try:
            await self._ensure_attached(session)
        except (PigentUnavailable, OSError) as error:
            self.sessions.pop(session_id, None)
            raise HTTPException(status_code=503, detail={"code": "service_unavailable", "message": str(error)}) from error
        await self.emit(session, "session.created", {"session": self.summary(session)})
        self._persist(session)
        return session

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
        payload = dict(event.get("payload") or {})
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
            session.status = "waiting_for_user"
            session.run_active = True
        elif event_type == "interaction.resolved":
            session.status = "active"
            session.run_active = True
        await self.emit(session, event_type, payload)

    async def message(self, session: SessionState, body: MessageCreate) -> None:
        command = "follow_up" if body.behavior == "follow_up" else "prompt"
        await self._ensure_attached(session)
        previous_status, previous_run_active = session.status, session.run_active
        session.status = "active"
        session.run_active = True
        self._persist(session)
        try:
            await self.manager.command(command, session_id=session.id, text=body.content)
        except Exception:
            session.status, session.run_active = previous_status, previous_run_active
            self._persist(session)
            raise
        await self.emit(session, "session.updated", {"session": self.summary(session), "run_active": True})

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
                resolved = (self.workspace / body.active_document).resolve()
                active_document = resolved.relative_to(self.workspace).as_posix()
            except (OSError, ValueError) as error:
                raise HTTPException(status_code=400, detail="active_document must stay inside the Workspace") from error
        if body.active_kernel_id:
            kernels = getattr(self.bridge, "kernels", None)
            if kernels is not None and not any(item.id == body.active_kernel_id for item in kernels.list()):
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


def create_public_router(service: PigentSessionService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/pigent", tags=["pigent"])

    @router.post("/sessions", status_code=201)
    async def create_session(body: SessionCreate) -> dict[str, Any]:
        return service.summary(await service.create(body))

    @router.get("/sessions")
    async def list_sessions() -> list[dict[str, Any]]:
        return [service.summary(item) for item in service.sessions.values()]

    @router.get("/sessions/{session_id}")
    async def get_session(session_id: str) -> dict[str, Any]:
        return service.summary(service.get(session_id))

    @router.delete("/sessions/{session_id}", status_code=204)
    async def delete_session(session_id: str) -> None:
        session = service.get(session_id)
        try:
            await service.manager.command("delete_session", session_id=session_id)
        finally:
            service.sessions.pop(session_id, None)
            service.bridge.sessions.pop(session_id, None)
            (service.state_dir / f"{session_id}.json").unlink(missing_ok=True)
            (service.events_dir / f"{session_id}.jsonl").unlink(missing_ok=True)

    @router.post("/sessions/{session_id}/messages", status_code=202)
    async def send_message(session_id: str, body: MessageCreate) -> dict[str, bool]:
        await service.message(service.get(session_id), body)
        return {"accepted": True}

    @router.post("/sessions/{session_id}/abort", status_code=202)
    async def abort(session_id: str) -> dict[str, bool]:
        session = service.get(session_id)
        await service.manager.command("abort", session_id=session.id)
        return {"accepted": True}

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
        return {"protocol_version": "0.1", "tools": list(PIGENT_CATALOGS["auto"]),
                "modes": {key: list(value) for key, value in PIGENT_CATALOGS.items()},
                "action_filters": PIGENT_ACTION_FILTERS, "capabilities": list(PIGENT_CAPABILITIES),
                **model_state, "host": service.manager.status()}

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
                cursor_event_id = session.next_event_id
                session.next_event_id += 1
                service._persist(session)
            for event in replay:
                await websocket.send_json(event)
            await websocket.send_json({"version": 1, "event_id": cursor_event_id,
                                       "session_id": session.id, "type": "reconnect.cursor", "timestamp": _now(),
                                       "payload": snapshot})
            while True:
                await websocket.send_json(await queue.get())
        except WebSocketDisconnect:
            pass
        finally:
            session.subscribers.discard(queue)

    return router
