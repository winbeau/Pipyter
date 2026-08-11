from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pipyter.pigent.models import ToolFailure
from pipyter.pigent.tools import BashToolService
from pipyter.server.app import create_app
from pipyter.terminal import TerminalSessionManager

pytestmark = pytest.mark.skipif(os.name != "posix", reason="Phase 4 persistent PTY checks require a POSIX PTY")


def _output(manager: TerminalSessionManager, session_id: str, cursor: int = 0) -> tuple[bytes, int]:
    chunks, _, _ = manager.replay(session_id, cursor)
    return b"".join(chunk.data for chunk in chunks), (chunks[-1].cursor if chunks else cursor)


def _wait_output(
    manager: TerminalSessionManager,
    session_id: str,
    needle: bytes,
    *,
    cursor: int = 0,
    timeout: float = 5,
) -> tuple[bytes, int]:
    deadline = time.monotonic() + timeout
    collected = bytearray()
    while time.monotonic() < deadline:
        chunks, status, _ = manager.wait(session_id, cursor, 0.1)
        for chunk in chunks:
            collected.extend(chunk.data)
            cursor = chunk.cursor
        if needle in collected:
            return bytes(collected), cursor
        if status != "running" and not chunks:
            break
    raise AssertionError(f"Did not receive {needle!r}; output was {bytes(collected)!r}")


def _wait_status(manager: TerminalSessionManager, session_id: str, status: str, timeout: float = 5) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if manager.get(session_id).status == status:
            return
        time.sleep(0.05)
    raise AssertionError(f"Terminal {session_id} did not reach {status}")


def test_two_sessions_have_independent_cwd_environment_and_output(tmp_path: Path):
    (tmp_path / "one").mkdir()
    (tmp_path / "two").mkdir()
    manager = TerminalSessionManager(tmp_path)
    try:
        first = manager.create(executable="/bin/sh", cwd="one", env={"PIPYTER_SESSION_VALUE": "first"})
        second = manager.create(executable="/bin/sh", cwd="two", env={"PIPYTER_SESSION_VALUE": "second"})
        assert first.name == "sh" and second.name == "sh 2"
        manager.input(first.id, b'printf "FIRST:%s:%s\\n" "$PIPYTER_SESSION_VALUE" "$PWD"\n')
        manager.input(second.id, b'printf "SECOND:%s:%s\\n" "$PIPYTER_SESSION_VALUE" "$PWD"\n')
        first_output, _ = _wait_output(manager, first.id, b"FIRST:first:")
        second_output, _ = _wait_output(manager, second.id, b"SECOND:second:")
        assert str(tmp_path / "one").encode() in first_output
        assert str(tmp_path / "two").encode() in second_output
        assert b"SECOND:second:" not in first_output
        assert b"FIRST:first:" not in second_output
    finally:
        manager.shutdown()


def test_bash_and_python_repl_accept_raw_input(tmp_path: Path):
    manager = TerminalSessionManager(tmp_path)
    try:
        shell = manager.create(executable="/bin/bash")
        python = manager.create(executable=sys.executable, argv=[sys.executable, "-i", "-q"])
        manager.input(shell.id, b"echo bash-ready\n")
        manager.input(python.id, b"print('python-ready')\n")
        assert b"bash-ready" in _wait_output(manager, shell.id, b"bash-ready")[0]
        assert b"python-ready" in _wait_output(manager, python.id, b"python-ready")[0]
    finally:
        manager.shutdown()


def test_resize_reaches_pty_and_clear_is_client_only(tmp_path: Path):
    manager = TerminalSessionManager(tmp_path)
    try:
        shell = manager.create(executable="/bin/sh", cols=80, rows=24)
        manager.resize(shell.id, 101, 37)
        manager.input(shell.id, b"stty size > terminal-size.txt; printf 'retained-%s\\n' 'before-clear'\n")
        output, cursor = _wait_output(manager, shell.id, b"retained-before-clear")
        size_path = tmp_path / "terminal-size.txt"
        assert size_path.read_text(encoding="utf-8").strip() == "37 101"

        # A UI clear discards only its local rendered buffer. The runtime has no clear
        # process action, and replay still contains output generated before that click.
        replay, _, truncated = manager.replay(shell.id, 0)
        assert not truncated
        assert b"retained-before-clear" in b"".join(chunk.data for chunk in replay)
        manager.input(shell.id, b"echo process-still-running\n")
        assert b"process-still-running" in _wait_output(manager, shell.id, b"process-still-running", cursor=cursor)[0]
    finally:
        manager.shutdown()


def test_close_only_selected_session_and_shutdown_cleans_all(tmp_path: Path):
    manager = TerminalSessionManager(tmp_path)
    first = manager.create(executable="/bin/sh")
    second = manager.create(executable="/bin/sh")
    first_process = manager._require(first.id).process
    second_process = manager._require(second.id).process

    manager.close(first.id)
    _wait_status(manager, first.id, "closed")
    assert first_process.poll() is not None
    assert manager.get(second.id).status == "running"
    manager.input(second.id, b"echo survivor\n")
    assert b"survivor" in _wait_output(manager, second.id, b"survivor")[0]

    manager.shutdown()
    assert second_process.poll() is not None
    assert manager.get(second.id).status == "closed"


def test_bounded_replay_cursor_reports_truncation(tmp_path: Path):
    manager = TerminalSessionManager(tmp_path, replay_bytes=1024, replay_chunks=2)
    try:
        shell = manager.create(executable="/bin/cat")
        handle = manager._require(shell.id)
        handle.append(b"old-one")
        handle.append(b"old-two")
        handle.append(b"old-three")
        chunks, earliest, truncated = manager.replay(shell.id, 0)
        assert [chunk.data for chunk in chunks] == [b"old-two", b"old-three"]
        assert earliest == chunks[0].cursor
        assert truncated
        latest = chunks[-1].cursor
        manager.input(shell.id, b"ZZ-RESUME\n")
        resumed, _ = _wait_output(manager, shell.id, b"ZZ-RESUME", cursor=latest)
        assert b"old-one" not in resumed
    finally:
        manager.shutdown()


def test_ctrl_c_interrupts_foreground_job_and_ctrl_d_exits_shell(tmp_path: Path):
    manager = TerminalSessionManager(tmp_path)
    try:
        shell = manager.create(executable="/bin/sh")
        manager.input(shell.id, b"sleep 30\n")
        time.sleep(0.2)
        manager.input(shell.id, b"\x03")
        manager.input(shell.id, b"echo after-interrupt\n")
        assert b"after-interrupt" in _wait_output(manager, shell.id, b"after-interrupt")[0]
        manager.input(shell.id, b"\x04")
        _wait_status(manager, shell.id, "exited")
        assert manager.get(shell.id).last_exit_code is not None
    finally:
        manager.shutdown()


def test_websocket_reconnect_replays_once_from_cursor(tmp_path: Path):
    app = create_app(tmp_path)
    with TestClient(app) as client:
        response = client.post("/api/v1/terminals", json={"executable": "/bin/sh"})
        assert response.status_code == 201
        session_id = response.json()["id"]
        first_cursor = 0
        with client.websocket_connect(f"/api/v1/terminals/{session_id}/stream?cursor=0") as websocket:
            assert websocket.receive_json()["type"] == "replay"
            while websocket.receive_json()["type"] != "status":
                pass
            websocket.send_bytes(b"echo reconnect-one\n")
            seen_first = ""
            while seen_first.count("reconnect-one") < 2:
                event = websocket.receive_json()
                if event["type"] == "output":
                    first_cursor = event["cursor"]
                    seen_first += event.get("data", "")

        with client.websocket_connect(
            f"/api/v1/terminals/{session_id}/stream?cursor={first_cursor}"
        ) as websocket:
            replay = websocket.receive_json()
            assert replay["type"] == "replay"
            status = websocket.receive_json()
            replayed_text = ""
            while status["type"] != "status":
                if status["type"] == "output":
                    assert status["cursor"] > first_cursor
                    replayed_text += status.get("data", "")
                status = websocket.receive_json()
            assert "reconnect-one" not in replayed_text
            websocket.send_text("echo reconnect-two\n")
            seen = ""
            while seen.count("reconnect-two") < 2:
                event = websocket.receive_json()
                if event["type"] == "output":
                    assert event["cursor"] > first_cursor
                    seen += event.get("data", "")
            assert "reconnect-one" not in seen


def test_websocket_binary_output_frames_include_versioned_cursor(tmp_path: Path):
    app = create_app(tmp_path)
    with TestClient(app) as client:
        session_id = client.post(
            "/api/v1/terminals", json={"executable": "/bin/cat", "name": "binary-cat"}
        ).json()["id"]
        with client.websocket_connect(
            f"/api/v1/terminals/{session_id}/stream?cursor=0&binary=1"
        ) as websocket:
            assert websocket.receive_json()["type"] == "replay"
            assert websocket.receive_json()["type"] == "status"
            websocket.send_bytes(b"binary-frame\n")
            metadata = websocket.receive_json()
            assert metadata["version"] == 1
            assert metadata["type"] == "output"
            assert metadata["encoding"] == "binary"
            assert metadata["cursor"] >= 1
            assert b"binary-frame" in websocket.receive_bytes()


def test_rest_resize_running_and_selected_close(tmp_path: Path):
    app = create_app(tmp_path)
    with TestClient(app) as client:
        first = client.post("/api/v1/terminals", json={"name": "first", "executable": "/bin/sh"}).json()
        second = client.post("/api/v1/terminals", json={"name": "second", "executable": "/bin/sh"}).json()
        resized = client.post(f"/api/v1/terminals/{first['id']}/resize", json={"cols": 120, "rows": 40})
        assert resized.status_code == 200
        assert (resized.json()["cols"], resized.json()["rows"]) == (120, 40)
        running = client.get("/api/v1/running").json()["terminals"]
        assert {item["id"] for item in running} == {first["id"], second["id"]}
        assert client.delete(f"/api/v1/terminals/{first['id']}").status_code == 204
        assert client.get(f"/api/v1/terminals/{first['id']}").json()["status"] == "closed"
        assert client.get(f"/api/v1/terminals/{second['id']}").json()["status"] == "running"


def test_pigent_interactive_handoff_attaches_shell_session(tmp_path: Path):
    manager = TerminalSessionManager(tmp_path)
    service = BashToolService(tmp_path, terminal_sessions=manager)
    try:
        with pytest.raises(ToolFailure) as raised:
            asyncio.run(service.bash({"command": "read value; echo attached:$value", "interactive": True}))
        interaction = raised.value.details["interaction"]
        assert interaction["kind"] == "pty_handoff"
        shell_session_id = interaction["shell_session_id"]
        assert manager.attach(shell_session_id).id == shell_session_id
        manager.input(shell_session_id, b"handoff-ok\n")
        assert b"attached:handoff-ok" in _wait_output(manager, shell_session_id, b"attached:handoff-ok")[0]
    finally:
        manager.shutdown()


def test_terminal_authentication_input_is_not_logged(tmp_path: Path, caplog: pytest.LogCaptureFixture):
    caplog.set_level(logging.DEBUG)
    manager = TerminalSessionManager(tmp_path)
    secret = "terminal-secret-should-not-be-logged"
    try:
        shell = manager.create(executable="/bin/sh")
        manager.input(shell.id, b"stty -echo; read token; stty echo; echo auth-complete\n")
        time.sleep(0.1)
        manager.input(shell.id, (secret + "\n").encode())
        output, _ = _wait_output(manager, shell.id, b"auth-complete")
        assert secret.encode() not in output
        assert secret not in caplog.text
    finally:
        manager.shutdown()
