from __future__ import annotations

import asyncio
import ast
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import nbformat
import pytest

from pipyter.pigent.bridge import PigentBridge
from pipyter.pigent.inspect import ArtifactRegistry, InspectionService
from pipyter.pigent.models import ToolFailure, success
from pipyter.protocol.models import ExecuteResponse, KernelOutput
from pipyter.protocol.pigent import PigentToolContext


class InspectKernels:
    def __init__(self):
        self.execution_count = 0

    def execute(self, kernel_id, code, timeout):
        self.execution_count += 1
        if "savefig(" in code:
            match = re.search(r"savefig\(([^,]+),", code)
            path = Path(ast.literal_eval(match.group(1)))
            path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"figure")
            payload = {"saved": True}
            text = "__PIPYTER_INSPECT__" + json.dumps(payload) + "\n"
        elif "__PIPYTER_INSPECT__" in code:
            payload = {"shape": [1000, 100], "columns": [f"c{i}" for i in range(50)],
                       "rows": [{"value": "x" * 10000} for _ in range(20)]}
            text = "__PIPYTER_INSPECT__" + json.dumps(payload) + "\n"
        else:
            text = "ran\n"
        return ExecuteResponse(kernel_id=kernel_id, execution_count=self.execution_count, status="idle",
                               outputs=[KernelOutput(type="stream", name="stdout", text=text)])


def run(coro):
    return asyncio.run(coro)


def test_bounded_inspection_and_simple_identifier_validation(tmp_path):
    registry = ArtifactRegistry(tmp_path)
    service = InspectionService(InspectKernels(), registry)
    result = run(service.inspect({"action": "dataframe", "name": "df", "limit": 20}, kernel_id="k"))
    assert result.ok
    assert len(json.dumps(result.data).encode()) < 70_000
    assert result.data["result"]["truncated"] is True
    with pytest.raises(ToolFailure) as caught:
        run(service.inspect({"action": "object", "name": "danger()"}, kernel_id="k"))
    assert caught.value.code == "invalid_request"
    with pytest.raises(ToolFailure) as caught:
        run(service.inspect({"action": "variables"}, kernel_id=None))
    assert caught.value.code == "kernel_unavailable"


def test_artifact_authorization_integrity_and_expiry(tmp_path):
    registry = ArtifactRegistry(tmp_path, ttl_seconds=60)
    ref = registry.create(b"\x89PNG\r\n\x1a\nimage", mime="image/png")
    viewed = run(registry.view(ref.id))
    assert viewed.ok and viewed.data["data_url"].startswith("data:image/png")
    with pytest.raises(ToolFailure) as caught:
        run(registry.view("art_guessable"))
    assert caught.value.code == "not_found"
    registry._items[ref.id].path.write_bytes(b"tampered")
    with pytest.raises(ToolFailure) as caught:
        run(registry.view(ref.id))
    assert caught.value.code == "permission_denied"

    expired = registry.create(b"text", mime="text/plain", kind="text", suffix=".txt")
    registry._items[expired.id].ref.expires_at = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    with pytest.raises(ToolFailure) as caught:
        run(registry.view(expired.id))
    assert caught.value.code == "not_found"


def test_notebook_kernel_visual_vertical_slice_through_bridge(tmp_path):
    notebook_path = tmp_path / "analysis.ipynb"
    notebook = nbformat.v4.new_notebook(cells=[nbformat.v4.new_code_cell("value = 1", id="cell-a")])
    nbformat.write(notebook, notebook_path)
    kernels = InspectKernels()
    bridge = PigentBridge(tmp_path, "w", kernels)
    bridge.register_session("s", mode="auto", active_kernel_id="current-kernel")
    states = []

    async def tasks(arguments, _context):
        states.append(arguments["action"])
        return success("tasks")

    bridge.register_handler("tasks", tasks)

    async def call(tool, call_id, arguments):
        context = PigentToolContext(tool_call_id=call_id, session_id="s", workspace_id="w", mode="auto")
        result = await bridge.dispatch(tool, arguments, context)
        assert result.ok, result
        return result

    read = run(call("notebook", "n-read", {"action": "read_cell", "path": "analysis.ipynb", "cell_id": "cell-a"}))
    run(call("tasks", "t-get", {"action": "get"}))
    updated = run(call("notebook", "n-update", {"action": "update_cell", "path": "analysis.ipynb", "cell_id": "cell-a",
                                                       "expected_revision": read.data["revision"], "source": "value = 2"}))
    run_result = run(call("notebook", "n-run", {"action": "run_cell", "path": "analysis.ipynb", "cell_id": "cell-a",
                                                        "expected_revision": updated.revisions.after}))
    inspected = run(call("inspect", "inspect-1", {"action": "dataframe", "name": "df", "limit": 10}))
    figure = run(call("inspect", "figure-1", {"action": "figure", "name": "fig"}))
    viewed = run(call("view", "view-1", {"source": {"kind": "figure", "figure_id": figure.data["figure_id"]}}))
    run(call("tasks", "t-done", {"action": "patch"}))
    assert run_result.data["cell"]["outputs"][0]["text"] == "ran\n"
    assert inspected.data["result"]["truncated"] is True
    assert viewed.data["media_type"] == "image/png"
    assert states == ["get", "patch"]
