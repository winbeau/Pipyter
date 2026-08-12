from __future__ import annotations

import asyncio
import json
import os
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from pipyter.pigent.config import PigentConfigStore
from pipyter.pigent.manager import PigentManager
from pipyter.pigent.sessions import ContextChange, MessageCreate, ModelChange, PigentSessionService, ProjectSessionCreate, SessionCreate, SessionState, create_public_router


@pytest.fixture()
def built_host() -> Path:
    path = Path(__file__).parents[1] / "packages" / "pigent" / "host" / "dist" / "main.js"
    if not path.exists():
        pytest.skip("Pigent host has not been built")
    return path


def test_host_jsonl_handshake_mode_change_and_crash_recovery(tmp_path, built_host):
    async def scenario():
        config = PigentConfigStore(tmp_path / "config")
        config.initialize()
        settings = config.read_settings()
        config.write_settings({"version": 1, "defaultProvider": "faux", "defaultModel": "deterministic"}, settings.revision)
        manager = PigentManager(tmp_path, "workspace-1", user_config_dir=config.directory,
                                bridge_endpoint="http://127.0.0.1:9/internal/pigent/v1", host_entry=built_host)
        try:
            client = await manager.ensure_started()
            handshake = await client.command("handshake")
            assert handshake["protocol_version"] == "0.2"
            assert len(handshake["tools"]) == 10
            session = {"id": "pigent_test", "mode": "ask", "execution_identity": {}, "tools": []}
            created = await client.command("create_session", session=session)
            assert created["session_id"] == "pigent_test"
            assert created["model"] == {"provider": "faux", "model": "deterministic"}
            await client.command("mode_change", session_id="pigent_test", mode="auto")
            assert manager.process is not None
            manager.process.kill()
            await manager.process.wait()
            replacement = await manager.ensure_started()
            assert replacement is not client
            assert manager.restart_count == 1
            # The supervisor did not replay create_session/mode_change into the new host.
            with pytest.raises(Exception, match="session not found"):
                await replacement.command("mode_change", session_id="pigent_test", mode="ask")
        finally:
            await manager.shutdown()
    asyncio.run(scenario())


def test_host_model_change_reloads_authoritative_settings(tmp_path, built_host):
    async def scenario():
        config = PigentConfigStore(tmp_path / "config")
        config.write_settings({"version": 1, "defaultProvider": "deepseek", "defaultModel": "deepseek-v4-flash"})
        config.write_auth({"deepseek": {"type": "api_key", "baseUrl": "https://deepseek.test", "key": "configured"}})
        manager = PigentManager(tmp_path, "workspace-1", user_config_dir=config.directory,
                                bridge_endpoint="http://127.0.0.1:9/internal/pigent/v1", host_entry=built_host)
        try:
            client = await manager.ensure_started()
            created = await client.command("create_session", session={
                "id": "pigent_model_change", "mode": "ask", "execution_identity": {}, "tools": [],
            })
            assert created["model"] == {"provider": "deepseek", "model": "deepseek-v4-flash"}
            current = config.read_settings()
            config.select_ui_model("deepseek", "deepseek-v4-pro", current.revision)
            changed = await client.command(
                "model_change", session_id="pigent_model_change",
                provider="deepseek", model="deepseek-v4-pro",
            )
            assert changed["model"] == {"provider": "deepseek", "model": "deepseek-v4-pro"}
        finally:
            await manager.shutdown()
    asyncio.run(scenario())


class _Manager:
    on_event = None

    def status(self):
        return {"status": "stopped"}


class _Bridge:
    sessions = {}


def test_event_cursor_replays_each_retained_event_once(tmp_path):
    service = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), _Bridge(),
                                   PigentConfigStore(tmp_path / "config"), _Manager())  # type: ignore[arg-type]
    session = SessionState("pigent_cursor", "ask", "automatic", {"provider": "faux", "model": "m"},
                           {"username": "u", "uid": 1, "home": str(tmp_path), "workspace": str(tmp_path)})
    service.sessions[session.id] = session
    asyncio.run(service.emit(session, "assistant.text", {"text": "one"}))
    asyncio.run(service.emit(session, "assistant.text", {"text": "two"}))
    assert [event["event_id"] for event in service.replay(session, 0)] == [1, 2]
    assert [event["event_id"] for event in service.replay(session, 1)] == [2]
    assert service.replay(session, 2) == []


def test_public_stream_replay_and_cursor_are_monotonic(tmp_path):
    service = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), _Bridge(),
                                   PigentConfigStore(tmp_path / "config"), _Manager())  # type: ignore[arg-type]
    session = SessionState("pigent_stream", "ask", "automatic", {"provider": "faux", "model": "m"},
                           {"username": "u", "uid": 1, "home": str(tmp_path), "workspace": str(tmp_path)})
    service.sessions[session.id] = session
    asyncio.run(service.emit(session, "assistant.text", {"text": "one"}))
    asyncio.run(service.emit(session, "assistant.text", {"text": "two"}))
    app = FastAPI()
    app.include_router(create_public_router(service))

    with TestClient(app) as client:
        with client.websocket_connect(f"/api/v1/pigent/sessions/{session.id}/stream?after_event_id=0") as websocket:
            first = websocket.receive_json()
            second = websocket.receive_json()
            cursor = websocket.receive_json()
        assert [(first["event_id"], first["type"]), (second["event_id"], second["type"]),
                (cursor["event_id"], cursor["type"])] == [
            (1, "assistant.text"), (2, "assistant.text"), (None, "reconnect.cursor"),
        ]
        with client.websocket_connect(f"/api/v1/pigent/sessions/{session.id}/stream?after_event_id=2") as websocket:
            next_cursor = websocket.receive_json()
        assert (next_cursor["event_id"], next_cursor["type"]) == (None, "reconnect.cursor")
    assert session.next_event_id == 3


def test_mode_change_emits_once_and_lifecycle_state_is_authoritative(tmp_path):
    class EventingManager:
        on_event = None

        def status(self):
            return {"status": "running"}

        async def command(self, command, **payload):
            if command == "mode_change":
                assert self.on_event is not None
                await self.on_event({"session_id": payload["session_id"], "type": "mode.changed",
                                     "payload": {"mode": payload["mode"], "tools": ["read"]}})
            return {"ok": True}

    class RecordingBridge:
        def __init__(self):
            self.sessions = {"pigent_mode": "ask"}

        def register_session(self, session_id, *, mode, workspace=None):
            self.sessions[session_id] = mode

        def update_session(self, session_id, *, mode):
            self.sessions[session_id] = mode

    manager, bridge = EventingManager(), RecordingBridge()
    service = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), bridge,
                                   PigentConfigStore(tmp_path / "config"), manager)  # type: ignore[arg-type]
    session = SessionState("pigent_mode", "ask", "automatic", {"provider": "faux", "model": "m"},
                           {"username": "u", "uid": 1, "home": str(tmp_path), "workspace": str(tmp_path)},
                           host_attached=True)
    service.sessions[session.id] = session

    asyncio.run(service.change_mode(session, "plan"))
    assert [(event["type"], event["payload"].get("mode")) for event in session.events] == [("mode.changed", "plan")]
    assert session.mode == "plan" and bridge.sessions[session.id] == "plan"

    asyncio.run(manager.on_event({"session_id": session.id, "type": "settled",
                                  "payload": {"status": "waiting_for_user"}}))
    assert session.status == "waiting_for_user"
    session.status = "completed"
    asyncio.run(service.message(session, MessageCreate(client_message_id="msg_continue", content="continue")))
    assert session.status == "active"
    assert session.events[-1]["type"] == "session.updated"


def test_model_and_context_changes_update_authoritative_session_state(tmp_path):
    class RecordingManager:
        on_event = None

        def __init__(self):
            self.commands = []

        def status(self):
            return {"status": "running"}

        async def command(self, command, **payload):
            self.commands.append((command, payload))
            if command == "model_change":
                return {"model": {"provider": payload["provider"], "model": payload["model"]}}
            return {"ok": True}

    class RecordingBridge:
        def __init__(self):
            self.sessions = {"pigent_model": SimpleNamespace(mode="ask", active_document=None, active_kernel_id=None)}
            self.kernels = SimpleNamespace(list=lambda: [SimpleNamespace(id="kernel-1")])

        def update_session(self, session_id, *, mode=None, active_document=None, clear_active_document=False,
                           active_kernel_id=None, clear_active_kernel=False):
            item = self.sessions[session_id]
            if mode is not None:
                item.mode = mode
            if clear_active_document or active_document is not None:
                item.active_document = active_document
            if clear_active_kernel or active_kernel_id is not None:
                item.active_kernel_id = active_kernel_id

    config = PigentConfigStore(tmp_path / "config")
    config.write_settings({"version": 1, "defaultProvider": "deepseek", "defaultModel": "deepseek-v4-flash"})
    config.write_auth({"deepseek": {"type": "api_key", "baseUrl": "https://deepseek.test", "key": "configured"}})
    manager, bridge = RecordingManager(), RecordingBridge()
    service = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), bridge,
                                   config, manager)  # type: ignore[arg-type]
    session = SessionState("pigent_model", "ask", "automatic", {"provider": "deepseek", "model": "deepseek-v4-flash"},
                           {"username": "u", "uid": 1, "home": str(tmp_path), "workspace": str(tmp_path)},
                           host_attached=True)
    service.sessions[session.id] = session

    revision = config.read_settings().revision
    changed_revision = asyncio.run(service.change_model(session, ModelChange(
        provider="deepseek", model="deepseek-v4-pro", revision=revision,
    )))
    assert changed_revision != revision
    assert session.model == {"provider": "deepseek", "model": "deepseek-v4-pro"}
    assert config.read_settings().value["defaultModel"] == "deepseek-v4-pro"
    assert session.events[-1]["type"] == "session.updated"
    assert session.events[-1]["payload"]["settings_revision"] == changed_revision

    asyncio.run(service.change_context(session, ContextChange(
        active_document="analysis.ipynb", active_kernel_id="kernel-1",
    )))
    assert session.active_document == "analysis.ipynb"
    assert session.active_kernel_id == "kernel-1"
    assert bridge.sessions[session.id].active_document == "analysis.ipynb"
    assert bridge.sessions[session.id].active_kernel_id == "kernel-1"
    assert manager.commands[-1] == ("context_change", {
        "session_id": session.id,
        "active_document": "analysis.ipynb",
        "active_kernel_id": "kernel-1",
    })
    assert session.events[-1]["type"] == "context.updated"


def test_execution_identity_is_injected_into_host_session(tmp_path):
    class RecordingManager:
        on_event = None

        def __init__(self):
            self.commands = []

        def status(self):
            return {"status": "running"}

        async def command(self, command, **payload):
            self.commands.append((command, payload))
            return {"ok": True}

    class RecordingBridge:
        def __init__(self):
            self.sessions = {}

        def register_session(self, session_id, *, mode, workspace=None, active_document=None, active_kernel_id=None):
            self.sessions[session_id] = mode

    config = PigentConfigStore(tmp_path / "config")
    config.initialize()
    config.write_settings({"version": 1, "defaultProvider": "faux", "defaultModel": "m"})
    manager, bridge = RecordingManager(), RecordingBridge()
    service = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), bridge,
                                   config, manager)  # type: ignore[arg-type]
    session = asyncio.run(service.create(SessionCreate(mode="auto")))
    create_payload = next(payload for command, payload in manager.commands if command == "create_session")
    identity = create_payload["session"]["execution_identity"]
    assert identity == session.execution_identity
    assert set(identity) == {"username", "uid", "home", "workspace"}
    assert identity["workspace"] == str(tmp_path)
    assert "execution_identity" not in service.summary(session)


def test_project_session_endpoint_binds_validated_subworkspace_and_kernel(tmp_path):
    class RecordingManager:
        on_event = None

        def __init__(self):
            self.commands = []

        def status(self):
            return {"status": "running"}

        async def command(self, command, **payload):
            self.commands.append((command, payload))
            return {"ok": True}

    class Kernels:
        def __init__(self):
            self.started = []

        def specs(self):
            return [SimpleNamespace(name="python3")]

        async def start_async(self, name, *, cwd=None):
            self.started.append((name, Path(cwd)))
            return SimpleNamespace(id="kernel-project")

        async def shutdown_async(self, _kernel_id):
            raise AssertionError("successful creation must not shut down the Kernel")

    class RecordingBridge:
        def __init__(self):
            self.sessions = {}
            self.kernels = Kernels()

        def register_session(self, session_id, *, mode, workspace=None, active_document=None, active_kernel_id=None):
            self.sessions[session_id] = SimpleNamespace(
                mode=mode, workspace=Path(workspace), active_kernel_id=active_kernel_id,
            )

    project_dir = tmp_path / "projects" / "alpha"
    project_dir.mkdir(parents=True)
    config = PigentConfigStore(tmp_path / "config")
    config.write_settings({"version": 1, "defaultProvider": "faux", "defaultModel": "m"})
    manager, bridge = RecordingManager(), RecordingBridge()
    service = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), bridge,
                                   config, manager)  # type: ignore[arg-type]
    app = FastAPI()
    app.include_router(create_public_router(service))

    response = TestClient(app).post("/api/v1/pigent/projects/sessions", json={
        "mode": "auto", "workspace": "projects/alpha", "kernel_name": "python3",
    })

    assert response.status_code == 201
    value = response.json()
    assert value["project_workspace"] == "projects/alpha"
    assert value["active_kernel_id"] == "kernel-project"
    assert "workspace" not in value and "execution_identity" not in value
    assert bridge.kernels.started == [("python3", project_dir)]
    session = service.sessions[value["id"]]
    assert bridge.sessions[session.id].workspace == project_dir
    create_payload = next(payload for command, payload in manager.commands if command == "create_session")
    assert create_payload["session"]["execution_identity"]["workspace"] == str(project_dir)

    absolute = TestClient(app).post("/api/v1/pigent/projects/sessions", json={
        "workspace": str(project_dir),
    })
    assert absolute.status_code == 201
    assert absolute.json()["project_workspace"] == "projects/alpha"


def test_project_session_rejects_escape_missing_file_and_unknown_kernel(tmp_path):
    class Manager:
        on_event = None

        def status(self):
            return {"status": "running"}

        async def command(self, _command, **_payload):
            return {"ok": True}

    class Kernels:
        def specs(self):
            return [SimpleNamespace(name="python3")]

        async def start_async(self, *_args, **_kwargs):
            raise AssertionError("invalid requests must not start a Kernel")

    bridge = SimpleNamespace(sessions={}, kernels=Kernels())
    config = PigentConfigStore(tmp_path / "config")
    config.write_settings({"version": 1, "defaultProvider": "faux", "defaultModel": "m"})
    service = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), bridge,
                                   config, Manager())  # type: ignore[arg-type]
    app = FastAPI()
    app.include_router(create_public_router(service))
    client = TestClient(app)
    (tmp_path / "plain.txt").write_text("x", encoding="utf-8")
    external = tmp_path.parent / f"{tmp_path.name}-external"
    external.mkdir(exist_ok=True)
    symlink = tmp_path / "escaped-link"
    try:
        symlink.symlink_to(external, target_is_directory=True)
    except OSError:
        symlink = None

    assert client.post("/api/v1/pigent/projects/sessions", json={"workspace": "../outside"}).status_code == 403
    if symlink is not None:
        assert client.post("/api/v1/pigent/projects/sessions", json={"workspace": "escaped-link"}).status_code == 403
    assert client.post("/api/v1/pigent/projects/sessions", json={"workspace": "missing"}).status_code == 404
    assert client.post("/api/v1/pigent/projects/sessions", json={"workspace": "plain.txt"}).status_code == 400
    unknown = client.post("/api/v1/pigent/projects/sessions", json={
        "workspace": ".", "kernel_name": "unknown",
    })
    assert unknown.status_code == 409
    assert unknown.json()["detail"]["code"] == "kernel_unavailable"


def test_project_session_kernel_is_rolled_back_when_agent_creation_fails(tmp_path):
    class FailingManager:
        on_event = None

        def status(self):
            return {"status": "running"}

        async def command(self, command, **_payload):
            if command == "create_session":
                raise RuntimeError("host rejected session")
            return {"ok": True}

    class Kernels:
        def __init__(self):
            self.shutdown = []

        def specs(self):
            return [SimpleNamespace(name="python3")]

        async def start_async(self, _name, *, cwd=None):
            assert Path(cwd) == tmp_path
            return SimpleNamespace(id="kernel-rollback")

        async def shutdown_async(self, kernel_id):
            self.shutdown.append(kernel_id)

    class Bridge:
        def __init__(self):
            self.sessions = {}
            self.kernels = Kernels()

        def register_session(self, session_id, *, mode, workspace=None, active_document=None, active_kernel_id=None):
            self.sessions[session_id] = SimpleNamespace(mode=mode)

    config = PigentConfigStore(tmp_path / "config")
    config.write_settings({"version": 1, "defaultProvider": "faux", "defaultModel": "m"})
    bridge = Bridge()
    service = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), bridge,
                                   config, FailingManager())  # type: ignore[arg-type]
    with pytest.raises(RuntimeError, match="host rejected"):
        asyncio.run(service.create_project(ProjectSessionCreate(workspace=".", kernel_name="python3")))
    assert bridge.kernels.shutdown == ["kernel-rollback"]
    assert not service.sessions and not bridge.sessions


def test_project_session_workspace_persists_and_context_uses_subworkspace(tmp_path):
    class Manager:
        on_event = None

        def __init__(self):
            self.commands = []

        def status(self):
            return {"status": "running"}

        async def command(self, command, **payload):
            self.commands.append((command, payload))
            return {"ok": True}

    class Bridge:
        def __init__(self):
            self.sessions = {}
            self.kernels = SimpleNamespace(list=lambda: [])

        def register_session(self, session_id, *, mode, workspace=None, active_document=None, active_kernel_id=None):
            self.sessions[session_id] = SimpleNamespace(
                mode=mode, workspace=Path(workspace), active_document=active_document, active_kernel_id=active_kernel_id,
            )

        def update_session(self, session_id, *, mode=None, active_document=None, clear_active_document=False,
                           active_kernel_id=None, clear_active_kernel=False):
            item = self.sessions[session_id]
            if clear_active_document or active_document is not None:
                item.active_document = active_document

    project_dir = tmp_path / "projects" / "alpha"
    project_dir.mkdir(parents=True)
    (project_dir / "analysis.ipynb").write_text("{}", encoding="utf-8")
    config = PigentConfigStore(tmp_path / "config")
    config.write_settings({"version": 1, "defaultProvider": "faux", "defaultModel": "m"})
    manager, bridge = Manager(), Bridge()
    service = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), bridge,
                                   config, manager)  # type: ignore[arg-type]
    session = asyncio.run(service.create_project(ProjectSessionCreate(workspace="projects/alpha")))
    restored_bridge = Bridge()
    restored = PigentSessionService(tmp_path, SimpleNamespace(project_id="p", workspace_id="w"), restored_bridge,
                                    config, Manager())  # type: ignore[arg-type]
    restored_session = restored.sessions[session.id]
    assert restored_session.workspace_path == "projects/alpha"
    restored_session.execution_identity["workspace"] = str(tmp_path.parent)
    asyncio.run(restored.change_context(restored_session, ContextChange(active_document="analysis.ipynb")))
    assert restored_bridge.sessions[session.id].workspace == project_dir
    assert restored_session.execution_identity["workspace"] == str(project_dir)
    assert restored_session.active_document == "analysis.ipynb"
    with pytest.raises(Exception) as caught:
        asyncio.run(restored.change_context(restored_session, ContextChange(active_document="../../escape.ipynb")))
    assert getattr(caught.value, "status_code", None) == 400


def test_raw_host_ready_malformed_jsonl_commands_and_monotonic_events(tmp_path, built_host):
    async def scenario():
        config = PigentConfigStore(tmp_path / "config")
        config.initialize()
        config.write_settings({"version": 1, "defaultProvider": "faux", "defaultModel": "deterministic"})
        session_dir = tmp_path / "sessions"
        startup = tmp_path / "startup.json"
        startup.write_text(json.dumps({
            "version": 1, "protocolVersion": "0.2", "workspaceId": "workspace-1",
            "workspaceRoot": str(tmp_path), "userConfigDir": str(config.directory),
            "sessionDir": str(session_dir), "bridgeEndpoint": "http://127.0.0.1:9/internal/pigent/v1",
        }), encoding="utf-8")
        env = os.environ.copy()
        env.update({"PIGENT_HOST_CONFIG_PATH": str(startup), "PIGENT_BRIDGE_TOKEN": "x" * 48})
        process = await asyncio.create_subprocess_exec(
            "node", str(built_host), stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE, env=env, cwd=tmp_path,
        )
        assert process.stdin is not None and process.stdout is not None

        async def read_record():
            return json.loads((await asyncio.wait_for(process.stdout.readline(), 5)).decode())

        async def send(record):
            process.stdin.write((record + "\n").encode() if isinstance(record, str)
                                else (json.dumps(record) + "\n").encode())
            await process.stdin.drain()

        async def response_for(request_id):
            events = []
            while True:
                record = await read_record()
                if record.get("id") == request_id:
                    return record, events
                if record.get("kind") == "event":
                    events.append(record["event"])

        ready = await read_record()
        assert ready["kind"] == "host_event"
        assert ready["event"]["type"] == "pigent.ready"
        assert ready["event"]["payload"]["protocol_version"] == "0.2"

        await send("{bad json")
        malformed = await read_record()
        assert malformed["error"]["code"] == "invalid_request"

        await send({"version": 1, "id": "h", "command": "handshake"})
        handshake, _ = await response_for("h")
        assert handshake["tools"] == ["read", "view", "write", "update", "bash", "notebook", "kernel", "inspect", "tasks", "delegate"]
        assert "pilot" not in json.dumps(handshake).lower()
        assert handshake["action_filters"]["notebook"]["ask"] == ["read_cell"]
        assert handshake["action_filters"]["kernel"]["plan"] == ["status", "list_environments", "operation_status"]

        identity = {"username": "runtime-user", "uid": 123, "home": "/home/runtime-user", "workspace": str(tmp_path)}
        await send({"version": 1, "id": "c", "command": "create_session",
                    "session": {"id": "pigent_raw", "mode": "ask", "execution_identity": identity}})
        created = (await response_for("c"))[0]
        assert created["ok"] is True and created["model"] == {"provider": "faux", "model": "deterministic"}
        await send({"version": 1, "id": "x", "command": "context_change", "session_id": "pigent_raw",
                    "active_document": "analysis.ipynb", "active_kernel_id": "kernel-1"})
        assert (await response_for("x"))[0]["ok"] is True
        await send({"version": 1, "id": "m", "command": "mode_change", "session_id": "pigent_raw", "mode": "auto"})
        mode_response, mode_events = await response_for("m")
        assert mode_response["ok"] is True
        await send({"version": 1, "id": "r", "command": "reconnect", "session_id": "pigent_raw", "after_event_id": 0})
        reconnect_response, reconnect_events = await response_for("r")
        assert reconnect_response["ok"] is True
        await send({"version": 1, "id": "p", "command": "prompt", "session_id": "pigent_raw", "text": "hello",
                    "client_message_id": "client_raw", "run_id": "run_raw", "turn_id": "turn_raw"})
        prompt_response, prompt_events = await response_for("p")
        assert prompt_response["accepted"] is True
        events = mode_events + reconnect_events + prompt_events
        while not any(event["type"] == "settled" for event in events):
            record = await read_record()
            if record.get("kind") == "event":
                events.append(record["event"])
        ids = [event["event_id"] for event in events]
        assert ids == sorted(ids) and len(ids) == len(set(ids))
        assert {event["type"] for event in events} >= {"mode.changed", "reconnect.cursor", "settled"}
        correlated = [event for event in events if event["type"] in {"assistant.text", "settled"}]
        assert correlated and all(event["payload"].get("run_id") == "run_raw" and event["payload"].get("turn_id") == "turn_raw" for event in correlated)

        await send({"version": 1, "id": "a", "command": "abort", "session_id": "pigent_raw"})
        assert (await response_for("a"))[0]["ok"] is True
        await send({"version": 1, "id": "s", "command": "shutdown"})
        assert (await response_for("s"))[0]["ok"] is True
        assert await asyncio.wait_for(process.wait(), 5) == 0

    asyncio.run(scenario())


def test_host_event_payload_redacts_secret_fields(built_host):
    script = """
      import { sanitizeEventPayload } from './packages/pigent/host/dist/events.js';
      console.log(JSON.stringify(sanitizeEventPayload({password:'hidden', nested:{api_key:'also-hidden'}, safe:'visible'})));
    """
    output = subprocess.run(
        ["node", "--input-type=module", "-e", script], cwd=Path(__file__).parents[1],
        capture_output=True, text=True, check=True,
    )
    assert json.loads(output.stdout) == {"password": "[redacted]", "nested": {"api_key": "[redacted]"}, "safe": "visible"}


def test_host_stream_deltas_share_one_message_identifier(built_host):
    script = """
      import { EventEmitter } from './packages/pigent/host/dist/events.js';
      const events = [];
      const emitter = new EventEmitter('s', event => events.push(event));
      const message = text => ({role:'assistant', content:[{type:'text', text}], stopReason:'pending', timestamp:1});
      emitter.translate({type:'message_start', message:message('')});
      emitter.translate({type:'message_update', message:message('Hello')});
      emitter.translate({type:'message_update', message:message('Hello!')});
      emitter.translate({type:'message_end', message:{...message('Hello!'), stopReason:'stop'}});
      emitter.translate({type:'message_start', message:message('')});
      emitter.translate({type:'message_update', message:message('Again')});
      console.log(JSON.stringify(events));
    """
    output = subprocess.run(
        ["node", "--input-type=module", "-e", script], cwd=Path(__file__).parents[1],
        capture_output=True, text=True, check=True,
    )
    events = json.loads(output.stdout)
    assert [event["payload"]["text"] for event in events] == ["Hello", "!", "Again"]
    assert all(event["payload"]["delta"] is True for event in events)
    assert events[0]["payload"]["message_id"] == events[1]["payload"]["message_id"]
    assert events[2]["payload"]["message_id"] != events[1]["payload"]["message_id"]


def test_host_streams_thinking_separately_from_final_text(built_host):
    script = """
      import { EventEmitter } from './packages/pigent/host/dist/events.js';
      const events = [];
      const emitter = new EventEmitter('s', event => events.push(event));
      const message = (thinking, text='') => ({role:'assistant', content:[{type:'thinking', thinking}, {type:'text', text}], stopReason:'pending', timestamp:1});
      emitter.translate({type:'message_start', message:message('')});
      emitter.translate({type:'message_update', message:message('Check PATH')});
      emitter.translate({type:'message_update', message:message('Check PATH, then restart')});
      emitter.translate({type:'message_end', message:{...message('Check PATH, then restart', 'Done'), stopReason:'stop'}});
      console.log(JSON.stringify(events));
    """
    output = subprocess.run(
        ["node", "--input-type=module", "-e", script], cwd=Path(__file__).parents[1],
        capture_output=True, text=True, check=True,
    )
    events = json.loads(output.stdout)
    thinking = [event for event in events if event["type"] == "assistant.thinking"]
    text = [event for event in events if event["type"] == "assistant.text"]
    assert [event["payload"]["text"] for event in thinking] == ["Check PATH", ", then restart"]
    assert [event["payload"]["text"] for event in text] == ["Done"]
    assert thinking[0]["payload"]["message_id"] == text[0]["payload"]["message_id"]


def test_host_tasks_and_delegate_adapters(built_host):
    script = """
      import { createToolDefinitions } from './packages/pigent/host/dist/tools.js';
      import { agentProfile, dynamicTasksInput, mainAgentSystemPrompt, publicTasks } from './packages/pigent/host/dist/main.js';
      let active = 0, maxActive = 0;
      const calls = [];
      const context = {
        sessionId: 's', workspaceId: 'w', mode: 'auto', bridgeEndpoint: '', bridgeToken: '',
        interaction() {},
        async tasks(action, args) { calls.push({kind:'tasks', action, revision:args.expected_revision}); return {ok:true, summary:action, data:{status:'accepted'}}; },
        async delegate(args, signal, update) {
          calls.push({kind:'delegate', profile:args.profile}); active++; maxActive=Math.max(maxActive, active);
          update({status:'running'}); await new Promise(resolve => setTimeout(resolve, 20)); active--;
          return {ok:true, summary:'completed', data:{result:{status:'completed', summary:args.task, profile:args.profile}}};
        },
      };
      const tools = createToolDefinitions(context);
      const tasks = tools.find(tool => tool.name === 'tasks');
      const delegate = tools.find(tool => tool.name === 'delegate');
      await tasks.execute('t1', {action:'get'}, undefined);
      await tasks.execute('t2', {action:'replace', expected_revision:'7', root:{title:'Goal', children:[]}}, undefined);
      await tasks.execute('t3', {action:'patch', expected_revision:'8', updates:[]}, undefined);
      const delegated = await Promise.all([
        delegate.execute('d1', {profile:'analysis', task:'one'}, undefined),
        delegate.execute('d2', {profile:'implementation', task:'two'}, undefined),
      ]);
      const snapshot = {revision:9, updatedAt:0, planId:'root', goal:'Goal', tasks:[
        {id:'a', title:'A', status:'active', dependsOn:[]}, {id:'b', title:'B', status:'completed', dependsOn:['a']}
      ]};
      console.log(JSON.stringify({
        toolCount: tools.length, taskMode: tasks.executionMode, delegateMode: delegate.executionMode,
        calls, maxActive, delegated: delegated.map(item => item.details.data.result),
        publicSnapshot: publicTasks(snapshot),
        casInput: dynamicTasksInput({expected_revision:'9', root:{title:'Next', children:[{id:'c', title:'C', status:'done'}]}}, snapshot),
        mainSystemPrompt: mainAgentSystemPrompt('Execution identity (authoritative): username=test.'),
        profiles: [agentProfile('analysis', false), agentProfile('implementation', true)],
      }));
    """
    output = subprocess.run(
        ["node", "--input-type=module", "-e", script], cwd=Path(__file__).parents[1],
        capture_output=True, text=True, check=True,
    )
    value = json.loads(output.stdout)
    assert value["toolCount"] == 10
    assert value["taskMode"] == "sequential" and value["delegateMode"] == "parallel"
    assert [item["action"] for item in value["calls"] if item["kind"] == "tasks"] == ["get", "replace", "patch"]
    assert value["maxActive"] == 2
    assert [item["profile"] for item in value["delegated"]] == ["analysis", "implementation"]
    assert [item["status"] for item in value["publicSnapshot"]["root"]["children"]] == ["running", "done"]
    assert value["casInput"]["expectedRevision"] == 9
    assert value["casInput"]["tasks"][0]["status"] == "completed"
    prompt_guidance = "Do not use emoji by default. Do not decorate headings or list items with emoji."
    assert prompt_guidance in value["mainSystemPrompt"]
    assert "never use more than one emoji in the entire response" in value["mainSystemPrompt"]
    assert all(prompt_guidance in profile["systemPrompt"] for profile in value["profiles"])
    assert all("never use more than one emoji in the entire response" in profile["systemPrompt"] for profile in value["profiles"])
    assert all("delegate" not in profile["toolAllowlist"] for profile in value["profiles"])
    assert value["profiles"][0]["allowFileModifications"] is False
    assert value["profiles"][1]["allowFileModifications"] is True
