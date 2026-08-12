from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from pipyter.pigent.bridge import PigentBridge, create_internal_router
from pipyter.pigent.models import ToolFailure, success
from pipyter.pigent.tools import BashToolService, FileToolService, revision_path
from pipyter.protocol.models import ExecuteResponse, KernelOutput, KernelSummary
from pipyter.protocol.pigent import PigentToolContext


class NoKernels:
    def execute(self, *_args, **_kwargs):
        raise AssertionError("kernel not expected")


class NamedKernels:
    def __init__(self):
        self.execute_calls = []
        self.list_calls = 0

    async def execute_async(self, kernel_id, code, timeout, *, store_history=True):
        self.execute_calls.append((kernel_id, code, timeout, store_history))
        return ExecuteResponse(kernel_id=kernel_id, execution_count=7, status="idle",
                               outputs=[KernelOutput(type="stream", name="stdout", text="ok\n")])

    def list(self):
        self.list_calls += 1
        return [KernelSummary(id="kernel-real", name="python-private", status="idle")]


def run(coro):
    return asyncio.run(coro)


def test_nul_invalid_utf8_and_workspace_path_boundary(tmp_path):
    service = FileToolService(tmp_path)
    with pytest.raises(ToolFailure, match="NUL"):
        run(service.read({"path": "bad\x00name"}))
    (tmp_path / "bad.bin").write_bytes(b"\xffnot-utf8")
    with pytest.raises(ToolFailure) as caught:
        run(service.read({"path": "bad.bin"}))
    assert caught.value.code == "invalid_request"
    (tmp_path / "relative.txt").write_text("relative", encoding="utf-8")
    outside = tmp_path.parent / "absolute-pigent.txt"
    outside.write_text("absolute", encoding="utf-8")
    try:
        relative = run(service.read({"path": "relative.txt"}))
        assert relative.data["content"] == "relative" and relative.data["path"] == "relative.txt"
        with pytest.raises(ToolFailure) as absolute:
            run(service.read({"path": str(outside)}))
        with pytest.raises(ToolFailure) as traversed:
            run(service.read({"path": "../absolute-pigent.txt"}))
        assert absolute.value.code == traversed.value.code == "permission_denied"
        assert str(tmp_path.parent) not in json.dumps(relative.model_dump())
    finally:
        outside.unlink(missing_ok=True)


def test_bounded_directory_read_and_media_separation(tmp_path):
    for index in range(5):
        (tmp_path / f"f{index}.txt").write_text(str(index), encoding="utf-8")
    png = tmp_path / "plot.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\n" + b"x" * 20)
    service = FileToolService(tmp_path)
    listing = run(service.read({"path": ".", "limit": 3}))
    assert len(listing.data["entries"]) == 3
    assert listing.data["truncated"] is True
    with pytest.raises(ToolFailure) as caught:
        run(service.read({"path": "plot.png"}))
    assert caught.value.code == "unsupported_media"
    viewed = run(service.view({"source": {"kind": "file", "path": "plot.png"}}))
    assert viewed.data["media_type"] == "image/png"
    assert viewed.data["data_url"].startswith("data:image/png;base64,")


def test_replace_uniqueness_overlap_patch_and_stale_revision(tmp_path):
    path = tmp_path / "sample.txt"
    path.write_text("alpha\nbeta\ngamma\n", encoding="utf-8")
    service = FileToolService(tmp_path)
    revision = revision_path(path)
    updated = run(service.update({"path": "sample.txt", "strategy": "replace", "expected_revision": revision,
                                  "edits": [{"old_text": "beta", "new_text": "BETA"}]}))
    assert updated.ok and path.read_text() == "alpha\nBETA\ngamma\n"
    with pytest.raises(ToolFailure, match="exactly once"):
        run(service.update({"path": "sample.txt", "strategy": "replace", "edits": [{"old_text": "a", "new_text": "x"}]}))
    current = revision_path(path)
    patch = "@@ -1,3 +1,3 @@\n alpha\n-BETA\n+delta\n gamma\n"
    patched = run(service.update({"path": "sample.txt", "strategy": "patch", "expected_revision": current, "patch": patch}))
    assert patched.ok and "delta" in path.read_text()
    with pytest.raises(ToolFailure) as caught:
        run(service.write({"path": "sample.txt", "content": "stale", "expected_revision": current}))
    assert caught.value.code == "revision_conflict"
    bad_patch = "@@ -1,1 +1,1 @@\n-wrong\n+new\n"
    with pytest.raises(ToolFailure, match="context"):
        run(service.update({"path": "sample.txt", "strategy": "patch", "patch": bad_patch}))


def test_same_target_mutations_are_serialized(tmp_path):
    path = tmp_path / "counter.txt"
    path.write_text("zero\n", encoding="utf-8")
    service = FileToolService(tmp_path)
    expected = revision_path(path)

    async def scenario():
        return await asyncio.gather(
            service.update({"path": "counter.txt", "expected_revision": expected, "strategy": "replace",
                            "edits": [{"old_text": "zero", "new_text": "one"}]}),
            service.update({"path": "counter.txt", "expected_revision": expected, "strategy": "replace",
                            "edits": [{"old_text": "zero", "new_text": "two"}]}),
            return_exceptions=True,
        )

    results = run(scenario())
    assert sum(not isinstance(item, Exception) for item in results) == 1
    assert any(isinstance(item, ToolFailure) and item.code == "revision_conflict" for item in results)


def test_bash_outside_workspace_timeout_cancellation_and_secret_filter(tmp_path, monkeypatch):
    service = BashToolService(tmp_path)
    outside = tmp_path.parent
    with pytest.raises(ToolFailure) as caught:
        run(service.bash({"command": "pwd", "cwd": str(outside)}))
    assert caught.value.code == "permission_denied"
    monkeypatch.setenv("OPENAI_API_KEY", "do-not-leak")
    monkeypatch.setenv("PIPYTER_PIGENT_BRIDGE_TOKEN", "bridge-secret")
    env_result = run(service.bash({"command": "printf '%s|%s' \"${OPENAI_API_KEY-unset}\" \"${PIPYTER_PIGENT_BRIDGE_TOKEN-unset}\""}))
    assert env_result.data["stdout"] == "unset|unset"
    with pytest.raises(ToolFailure) as caught:
        run(service.bash({"command": "sleep 2", "timeout": 0.05}))
    assert caught.value.code == "execution_timeout"

    async def cancel():
        task = asyncio.create_task(service.bash({"command": "sleep 10"}))
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    run(cancel())


def test_authenticated_bridge_idempotency_modes_and_text_vertical_slice(tmp_path):
    bridge = PigentBridge(tmp_path, "workspace-1", NoKernels())
    bridge.register_session("session-1", mode="auto")
    task_states = []

    async def tasks(arguments, _context):
        task_states.append(arguments["action"])
        return success("tasks", data={"state": arguments["action"]})

    bridge.register_handler("tasks", tasks)
    base = {"protocol_version": "0.2", "session_id": "session-1", "workspace_id": "workspace-1", "mode": "ask"}

    async def dispatch(tool, call_id, arguments):
        return await bridge.dispatch(tool, arguments, PigentToolContext(tool_call_id=call_id, **base))

    first = run(dispatch("write", "write-1", {"path": "flow.txt", "content": "value=1\n"}))
    retry = run(dispatch("write", "write-1", {"path": "flow.txt", "content": "value=1\n"}))
    assert first.ok and retry.revisions == first.revisions
    assert run(dispatch("read", "read-1", {"path": "flow.txt"})).ok
    assert run(dispatch("tasks", "tasks-1", {"action": "get"})).ok
    revision = revision_path(tmp_path / "flow.txt")
    assert run(dispatch("update", "update-1", {"path": "flow.txt", "expected_revision": revision,
                                                  "strategy": "replace", "edits": [{"old_text": "1", "new_text": "2"}]})).ok
    assert run(dispatch("bash", "bash-1", {"command": "grep -q 'value=2' flow.txt"})).ok
    assert run(dispatch("read", "read-2", {"path": "flow.txt"})).data["content"] == "value=2\n"
    assert run(dispatch("tasks", "tasks-2", {"action": "patch"})).ok
    assert task_states == ["get", "patch"]

    bridge.update_session("session-1", mode="ask")
    denied = run(dispatch("write", "denied", {"path": "x", "content": "x"}))
    assert denied.error.code == "mode_denied"

    app = FastAPI()
    app.include_router(create_internal_router(bridge, "credential"))
    with TestClient(app) as client:
        body = {"context": {**base, "tool_call_id": "http-read"}, "arguments": {"path": "flow.txt"}}
        assert client.post("/internal/pigent/v1/tools/read", json=body).status_code == 401
        response = client.post("/internal/pigent/v1/tools/read", json=body,
                               headers={"Authorization": "Bearer credential"})
        assert response.status_code == 200 and response.json()["ok"] is True
        cross_workspace = {"context": {**base, "workspace_id": "workspace-2", "tool_call_id": "cross-read"},
                           "arguments": {"path": "flow.txt"}}
        response = client.post("/internal/pigent/v1/tools/read", json=cross_workspace,
                               headers={"Authorization": "Bearer credential"})
        assert response.status_code == 200
        assert response.json()["error"]["code"] == "permission_denied"


def test_bridge_session_subworkspace_scopes_file_and_bash_tools(tmp_path):
    runtime_root = tmp_path / "runtime"
    project_root = runtime_root / "projects" / "alpha"
    project_root.mkdir(parents=True)
    (runtime_root / "outside.txt").write_text("outside", encoding="utf-8")
    bridge = PigentBridge(runtime_root, "workspace-1", NoKernels())
    bridge.register_session("project-session", mode="auto", workspace=project_root)
    context = PigentToolContext(
        tool_call_id="write-1", session_id="project-session", workspace_id="workspace-1", mode="auto",
    )

    written = run(bridge.dispatch("write", {"path": "inside.txt", "content": "inside"}, context))
    assert written.ok and (project_root / "inside.txt").read_text(encoding="utf-8") == "inside"
    assert not (runtime_root / "inside.txt").exists()
    escaped = run(bridge.dispatch(
        "read", {"path": "../../outside.txt"}, context.model_copy(update={"tool_call_id": "read-2"}),
    ))
    assert escaped.ok is False
    assert escaped.error is not None and escaped.error.code == "permission_denied"
    bash = run(bridge.dispatch(
        "bash", {"command": "pwd"}, context.model_copy(update={"tool_call_id": "bash-1"}),
    ))
    assert bash.ok and bash.data["stdout"].strip() == str(project_root)


def test_kernel_execute_projects_name_from_active_backend_summary_without_path_leak(tmp_path):
    kernels = NamedKernels()
    bridge = PigentBridge(tmp_path, "workspace-1", kernels)
    bridge.register_session("session-1", mode="auto", active_kernel_id="kernel-real")
    context = PigentToolContext(tool_call_id="kernel-execute", session_id="session-1",
                                workspace_id="workspace-1", mode="auto")

    result = run(bridge.dispatch("kernel", {"action": "execute", "code": "print('ok')"}, context))

    assert result.ok
    assert result.data["name"] == "python-private"
    assert result.data["kernel_id"] == "kernel-real"
    assert kernels.execute_calls == [("kernel-real", "print('ok')", 30, False)]
    assert kernels.list_calls == 1
    assert str(tmp_path) not in json.dumps(result.model_dump())


def test_interactive_handoff_contains_no_secret_input(tmp_path):
    service = BashToolService(tmp_path)
    with pytest.raises(ToolFailure) as caught:
        run(service.bash({"command": "login", "interactive": True, "password": "must-not-appear"}))
    interaction = caught.value.details["interaction"]
    assert interaction == {"kind": "pty_handoff", "summary": "Open the Shell to continue",
                           "choices": ["open_shell", "cancel"]}
    assert "must-not-appear" not in json.dumps(interaction)
