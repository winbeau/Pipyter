from __future__ import annotations

import json
import os
import sys

import pytest

from pipyter.runtime.jupyter import build_jupyter_command, new_runtime_token, token_fingerprint
from pipyter.runtime.manager import RuntimeManager
from pipyter.exceptions import RuntimeStateError
from pipyter.runtime.state import RuntimeState, pid_alive
from pipyter.workspace.project import link_project


def test_token_fingerprint_is_short_sha256():
    token = new_runtime_token()
    assert len(token) >= 32
    fingerprint = token_fingerprint(token)
    assert len(fingerprint) == 16
    assert fingerprint == token_fingerprint(token)
    assert token_fingerprint("other") != fingerprint


def test_jupyter_command_flags(tmp_path):
    command = build_jupyter_command(tmp_path, port=9999, base_url="/jupyter/", token="secret-token")
    assert command[0] == sys.executable
    joined = " ".join(command)
    assert f"--ServerApp.root_dir={tmp_path}" in joined
    assert "--ServerApp.ip=127.0.0.1" in joined
    assert "--ServerApp.port=9999" in joined
    assert "--ServerApp.base_url=/jupyter/" in joined
    assert "--ServerApp.open_browser=False" in joined
    assert "--ServerApp.allow_remote_access=False" in joined
    assert "--IdentityProvider.token=secret-token" in joined


def test_state_roundtrip(tmp_path):
    state = RuntimeState(
        workspace_id="w-1",
        root=str(tmp_path),
        api_pid=1234,
        jupyter_pid=5678,
        api_url="http://127.0.0.1:8765",
        status="running",
    )
    path = tmp_path / "runtime.json"
    state.save(path)
    loaded = RuntimeState.load(path)
    assert loaded is not None
    assert loaded.workspace_id == "w-1"
    assert loaded.api_pid == 1234
    assert loaded.status == "running"


def test_state_load_missing_returns_none(tmp_path):
    assert RuntimeState.load(tmp_path / "missing.json") is None


def test_pid_alive_detects_own_process():
    assert pid_alive(os.getpid())
    assert not pid_alive(None)
    assert not pid_alive(0)
    assert not pid_alive(999_999_999)


def test_manager_rejects_non_loopback_runtime_api(tmp_path):
    project = link_project(tmp_path, name="remote-rejected")
    with pytest.raises(RuntimeStateError, match="local-only"):
        RuntimeManager(project).start(api_host="0.0.0.0", api_port=18764, start_jupyter=False)


def test_manager_reuses_live_runtime(tmp_path):
    project = link_project(tmp_path, name="reuse")
    manager = RuntimeManager(project)
    state = manager.start(api_port=18765, start_jupyter=False)
    try:
        assert state.status == "running"
        again = manager.start(api_port=18765, start_jupyter=False)
        assert again.api_pid == state.api_pid
        reported = manager.status()
        assert reported["api_alive"] is True
        assert "token" not in json.dumps(reported).lower() or "fingerprint" in json.dumps(reported)
    finally:
        manager.stop()


def test_manager_stop_clears_pids(tmp_path):
    project = link_project(tmp_path, name="stop")
    manager = RuntimeManager(project)
    manager.start(api_port=18766, start_jupyter=False)
    stopped = manager.stop()
    assert stopped is not None
    assert stopped.status == "stopped"
    assert stopped.api_pid is None
    assert manager.status()["status"] == "stopped"
