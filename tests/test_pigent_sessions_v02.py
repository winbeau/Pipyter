from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from pipyter.pigent.config import PigentConfigStore
from pipyter.pigent.sessions import (
    InteractionDecision,
    MessageCreate,
    PigentSessionService,
    SessionState,
    _automatic_session_title,
    create_public_router,
)


class Manager:
    on_event = None

    def __init__(self):
        self.commands = []

    def status(self):
        return {"status": "running"}

    async def command(self, command, **payload):
        self.commands.append((command, payload))
        if command == "interaction_resolve":
            return {"receipt": {"outcome": "success", "summary": "resolved", "identifiers": {}, "at": "2025-01-01T00:00:00Z"}}
        return {"accepted": True}


class Bridge:
    def __init__(self):
        self.sessions = {"pigent_v02": SimpleNamespace()}
        self.cancelled_sessions = []

    async def cancel_session(self, session_id):
        self.cancelled_sessions.append(session_id)


def service(tmp_path):
    manager = Manager()
    value = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), Bridge(),
                                 PigentConfigStore(tmp_path / "config"), manager)  # type: ignore[arg-type]
    session = SessionState("pigent_v02", "ask", "automatic", {"provider": "faux", "model": "m"},
                           {"username": "u", "uid": 1, "home": str(tmp_path), "workspace": str(tmp_path)},
                           host_attached=True)
    value.sessions[session.id] = session
    return value, session, manager


def test_client_message_id_is_idempotent_and_correlated(tmp_path):
    value, session, manager = service(tmp_path)
    request = MessageCreate(client_message_id="msg_1", content="hello")
    first = asyncio.run(value.message(session, request))
    second = asyncio.run(value.message(session, request))
    assert first == second
    assert first["run_id"].startswith("run_") and first["turn_id"].startswith("turn_")
    assert [command for command, _ in manager.commands].count("prompt") == 1
    try:
        asyncio.run(value.message(session, MessageCreate(client_message_id="msg_1", content="different")))
    except Exception as error:
        assert getattr(error, "status_code", None) == 409
    else:
        raise AssertionError("message ID conflict was accepted")


def test_first_message_auto_titles_an_untitled_session_without_overwriting_manual_title(tmp_path):
    value, session, manager = service(tmp_path)
    assert session.title is None
    asyncio.run(value.message(session, MessageCreate(
        client_message_id="msg_title",
        content="# 修复 Notebook 输出\n\n请检查 `analysis.ipynb` 的第 4 个单元格。",
    )))
    assert session.title == "修复 Notebook 输出 请检查 analysis.ipynb 的第 4 个单元格"
    assert session.events[-1]["payload"]["session"]["title"] == session.title

    session.run_active = False
    session.title = "用户手动标题"
    asyncio.run(value.message(session, MessageCreate(client_message_id="msg_keep_title", content="完全不同的新问题")))
    assert session.title == "用户手动标题"
    assert [name for name, _ in manager.commands].count("prompt") == 2


def test_automatic_session_title_is_clean_and_bounded():
    assert _automatic_session_title("```bash\nrm -rf /tmp/demo\n```") is None
    title = _automatic_session_title("Please investigate why the notebook kernel repeatedly disconnects while running the long analysis pipeline")
    assert title is not None and len(title) <= 49 and title.endswith("…")


def test_concurrent_client_message_id_is_reserved_once(tmp_path):
    value, session, manager = service(tmp_path)
    gate = asyncio.Event()
    original = manager.command

    async def command(name, **payload):
        if name == "prompt":
            await gate.wait()
        return await original(name, **payload)

    manager.command = command

    async def scenario():
        request = MessageCreate(client_message_id="msg_concurrent", content="hello")
        first = asyncio.create_task(value.message(session, request))
        await asyncio.sleep(0)
        second = asyncio.create_task(value.message(session, request))
        await asyncio.sleep(0)
        gate.set()
        return await asyncio.gather(first, second)

    first, second = asyncio.run(scenario())
    assert first == second
    assert [name for name, _ in manager.commands].count("prompt") == 1


def test_active_run_rejects_second_prompt_but_accepts_follow_up(tmp_path):
    value, session, manager = service(tmp_path)
    first = asyncio.run(value.message(session, MessageCreate(client_message_id="msg_prompt", content="hello")))
    try:
        asyncio.run(value.message(session, MessageCreate(client_message_id="msg_second", content="new prompt")))
    except Exception as error:
        assert getattr(error, "status_code", None) == 409
    else:
        raise AssertionError("second prompt was accepted during an active run")
    follow_up = asyncio.run(value.message(session, MessageCreate(client_message_id="msg_follow", content="continue", behavior="follow_up")))
    assert follow_up["run_id"] == first["run_id"]
    assert [name for name, _ in manager.commands].count("follow_up") == 1


def test_host_event_strips_private_identity_and_path_fields(tmp_path):
    value, session, _ = service(tmp_path)
    asyncio.run(value.accept_host_event({
        "session_id": session.id,
        "type": "session.updated",
        "payload": {
            "execution_identity": {"username": "private", "home": "/home/private", "workspace": "/secret/workspace"},
            "nested": {"workspace_root": "/secret/workspace", "summary": "safe"},
        },
    }))
    payload = session.events[-1]["payload"]
    assert payload == {"nested": {"summary": "safe"}}
    assert str(tmp_path) not in json.dumps(payload)


def test_interaction_resolution_idempotency_and_superseded(tmp_path):
    value, session, manager = service(tmp_path)
    session.interactions["interaction_1"] = {
        "interaction_id": "interaction_1", "revision": 3, "state": "pending",
        "choices": ["allow_once", "reject"], "decisions": {},
    }
    body = InteractionDecision(revision=3, decision_id="decision_1", action_id="allow_once")
    first = asyncio.run(value.resolve_interaction("interaction_1", body))
    # The interaction is now authoritative resolved; a second decision is superseded.
    assert first["outcome"] == "success"
    try:
        asyncio.run(value.resolve_interaction("interaction_1", InteractionDecision(
            revision=3, decision_id="decision_2", action_id="reject",
        )))
    except Exception as error:
        assert getattr(error, "status_code", None) == 409
    else:
        raise AssertionError("superseded interaction resolved")


def test_disk_history_pages_beyond_memory_and_restart(tmp_path):
    value, session, _ = service(tmp_path)
    for index in range(1205):
        asyncio.run(value.emit(session, "assistant.text", {"text": str(index)}))
    assert len(session.events) == 1000
    first = value.history(session, before_event_id=206, limit=100)
    assert [event["event_id"] for event in first] == list(range(106, 206))

    restored = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), Bridge(),
                                    PigentConfigStore(tmp_path / "config"), Manager())  # type: ignore[arg-type]
    loaded = restored.get(session.id)
    assert len(loaded.events) == 1000
    older = restored.history(loaded, before_event_id=106, limit=100)
    assert [event["event_id"] for event in older] == list(range(6, 106))


def test_session_patch_search_filter_delete_conflict_and_history_api(tmp_path):
    value, session, _ = service(tmp_path)
    session.title = "Alpha research"
    asyncio.run(value.emit(session, "assistant.text", {"text": "one"}))
    app = FastAPI()
    app.include_router(create_public_router(value))
    with TestClient(app) as client:
        assert len(client.get("/api/v1/pigent/sessions?query=alpha&workspace_id=w").json()) == 1
        assert client.get("/api/v1/pigent/sessions?workspace_id=wrong").json() == []
        patched = client.patch(f"/api/v1/pigent/sessions/{session.id}", json={"title": "Renamed"})
        assert patched.status_code == 200 and patched.json()["title"] == "Renamed"
        history = client.get(f"/api/v1/pigent/sessions/{session.id}/events?limit=10")
        assert history.status_code == 200 and history.json()["events"]
        session.run_active = True
        deleted = client.delete(f"/api/v1/pigent/sessions/{session.id}")
        assert deleted.status_code == 409


def test_abort_cancels_host_and_bridge_owned_operations(tmp_path):
    value, session, manager = service(tmp_path)
    session.run_active = True
    session.run_id = "run_active"
    app = FastAPI()
    app.include_router(create_public_router(value))
    with TestClient(app) as client:
        response = client.post(
            f"/api/v1/pigent/sessions/{session.id}/abort",
            json={"run_id": session.run_id, "reason": "user_stop"},
        )
    assert response.status_code == 202
    assert manager.commands[-1] == ("abort", {
        "session_id": session.id,
        "run_id": session.run_id,
        "reason": "user_stop",
    })
    assert value.bridge.cancelled_sessions == [session.id]
