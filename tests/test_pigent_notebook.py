from __future__ import annotations

import asyncio
import json
import threading
from pathlib import Path

import nbformat

from pipyter.pigent.bridge import PigentBridge
from pipyter.pigent.notebook import NotebookService
from pipyter.protocol.models import ExecuteResponse, KernelOutput
from pipyter.protocol.pigent import PigentToolContext


class FakeKernels:
    def __init__(self):
        self.calls = []
        self.started = threading.Event()
        self.release = threading.Event()
        self.block = False

    def execute(self, kernel_id, code, timeout):
        self.calls.append((kernel_id, code))
        if self.block:
            self.started.set()
            self.release.wait(timeout=2)
        return ExecuteResponse(kernel_id=kernel_id, execution_count=len(self.calls), status="idle",
                               outputs=[KernelOutput(type="stream", name="stdout", text="ran\n")])
    async def execute_async(self, kernel_id, code, timeout, *, store_history=True):
        return await asyncio.to_thread(self.execute, kernel_id, code, timeout)



def run(coro):
    return asyncio.run(coro)


def make_notebook(path: Path, *, with_id: bool = False):
    cell = {"cell_type": "code", "metadata": {}, "source": "x = 1\nprint(x)", "execution_count": None, "outputs": []}
    if with_id:
        cell["id"] = "cell-a"
    path.write_text(json.dumps({"cells": [cell], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}) + "\n",
                    encoding="utf-8")


def test_nbformat_validity_stable_ids_and_all_document_actions(tmp_path):
    path = tmp_path / "analysis.ipynb"
    make_notebook(path)
    service = NotebookService(tmp_path, FakeKernels())
    first = run(service.read_cell({"path": "analysis.ipynb", "include_outputs": True}))
    cell_id = first.data["cell_id"]
    revision = first.data["revision"]
    second = run(service.read_cell({"path": "analysis.ipynb", "cell_id": cell_id}))
    assert second.data["cell_id"] == cell_id
    nbformat.validate(nbformat.read(path, as_version=4))

    updated = run(service.dispatch({"action": "update_cell", "path": "analysis.ipynb", "cell_id": cell_id,
                                    "expected_revision": revision, "source": "x = 2\nprint(x)"}))
    assert updated.data["path"] == "analysis.ipynb"
    assert f"--- analysis.ipynb#cell={cell_id}" in updated.data["diff"]
    assert f"+++ analysis.ipynb#cell={cell_id}" in updated.data["diff"]
    assert "-x = 1\n" in updated.data["diff"]
    assert "+x = 2\n" in updated.data["diff"]
    revision = updated.revisions.after
    inserted = run(service.dispatch({"action": "insert_cell", "path": "analysis.ipynb", "expected_revision": revision,
                                     "cell_type": "code", "source": "y=3", "position": {"kind": "after", "cell_id": cell_id}}))
    assert inserted.data["path"] == "analysis.ipynb"
    inserted_id = inserted.data["cell"]["cell_id"]
    assert "--- /dev/null" in inserted.data["diff"]
    assert f"+++ analysis.ipynb#cell={inserted_id}" in inserted.data["diff"]
    assert "+y=3\n" in inserted.data["diff"]
    revision = inserted.revisions.after
    markdown = run(service.dispatch({"action": "add_markdown", "path": "analysis.ipynb", "expected_revision": revision,
                                     "source": "## Result", "position": {"kind": "end"}}))
    assert markdown.data["path"] == "analysis.ipynb"
    markdown_id = markdown.data["cell"]["cell_id"]
    assert "--- /dev/null" in markdown.data["diff"]
    assert f"+++ analysis.ipynb#cell={markdown_id}" in markdown.data["diff"]
    assert "+## Result\n" in markdown.data["diff"]
    revision = markdown.revisions.after
    moved = run(service.dispatch({"action": "move_cell", "path": "analysis.ipynb", "cell_id": inserted_id,
                                  "expected_revision": revision, "position": {"kind": "start"}}))
    assert moved.data["path"] == "analysis.ipynb"
    revision = moved.revisions.after
    cleared = run(service.dispatch({"action": "clear_output", "path": "analysis.ipynb", "scope": "all",
                                    "expected_revision": revision}))
    assert cleared.data["path"] == "analysis.ipynb"
    revision = cleared.revisions.after
    deleted = run(service.dispatch({"action": "delete_cell", "path": "analysis.ipynb", "cell_id": markdown_id,
                                    "expected_revision": revision}))
    assert deleted.ok
    assert deleted.data["path"] == "analysis.ipynb"
    assert f"--- analysis.ipynb#cell={markdown_id}" in deleted.data["diff"]
    assert "+++ /dev/null" in deleted.data["diff"]
    assert "-## Result\n" in deleted.data["diff"]
    assert str(tmp_path) not in json.dumps([updated.model_dump(), inserted.model_dump(), markdown.model_dump(),
                                            moved.model_dump(), cleared.model_dump(), deleted.model_dump()])
    nb = nbformat.read(path, as_version=4)
    nbformat.validate(nb)
    assert {cell.id for cell in nb.cells} == {cell_id, inserted_id}


def test_stale_revision_concurrent_serialization_and_bridge_idempotent_insert(tmp_path):
    path = tmp_path / "analysis.ipynb"
    make_notebook(path, with_id=True)
    kernels = FakeKernels()
    service = NotebookService(tmp_path, kernels)
    read = run(service.read_cell({"path": "analysis.ipynb", "cell_id": "cell-a"}))
    stale = read.data["revision"]
    first = run(service.dispatch({"action": "update_cell", "path": "analysis.ipynb", "cell_id": "cell-a",
                                  "expected_revision": stale, "source": "new"}))
    from pipyter.pigent.models import ToolFailure
    try:
        run(service.dispatch({"action": "update_cell", "path": "analysis.ipynb", "cell_id": "cell-a",
                              "expected_revision": stale, "source": "other"}))
    except ToolFailure as error:
        assert error.code == "revision_conflict"
    else:
        raise AssertionError("stale revision accepted")

    bridge = PigentBridge(tmp_path, "w", kernels)
    bridge.register_session("s", mode="auto", active_kernel_id="k")
    context = PigentToolContext(tool_call_id="insert-once", session_id="s", workspace_id="w", mode="auto")
    args = {"action": "insert_cell", "path": "analysis.ipynb", "expected_revision": first.revisions.after,
            "cell_type": "code", "source": "once", "position": {"kind": "end"}}
    one = run(bridge.dispatch("notebook", args, context))
    two = run(bridge.dispatch("notebook", args, context))
    assert one.ok and two.data == one.data
    nb = nbformat.read(path, as_version=4)
    assert sum(cell.source == "once" for cell in nb.cells) == 1


def test_bridge_injects_trusted_active_notebook_path(tmp_path):
    path = tmp_path / "analysis.ipynb"
    make_notebook(path, with_id=True)
    bridge = PigentBridge(tmp_path, "w", FakeKernels())
    bridge.register_session("s", mode="ask", active_document="analysis.ipynb")
    context = PigentToolContext(tool_call_id="active-read", session_id="s", workspace_id="w", mode="ask")
    result = run(bridge.dispatch("notebook", {"action": "read_cell", "cell_id": "cell-a"}, context))
    assert result.ok
    assert result.data["path"] == path.name
    assert result.data["cell_id"] == "cell-a"


def test_run_cell_persists_outputs_and_detects_source_conflict(tmp_path):
    path = tmp_path / "analysis.ipynb"
    make_notebook(path, with_id=True)
    kernels = FakeKernels()
    service = NotebookService(tmp_path, kernels)
    revision = run(service.read_cell({"path": "analysis.ipynb", "cell_id": "cell-a"})).data["revision"]
    result = run(service.run_cell({"path": "analysis.ipynb", "cell_id": "cell-a", "expected_revision": revision},
                                  kernel_id="kernel-current"))
    assert result.ok and kernels.calls[0] == ("kernel-current", "x = 1\nprint(x)")
    assert result.data["path"] == "analysis.ipynb"
    assert str(tmp_path) not in json.dumps(result.model_dump())
    saved = nbformat.read(path, as_version=4)
    assert saved.cells[0].outputs[0].text == "ran\n"
    assert saved.cells[0].execution_count == 1

    current_revision = result.revisions.after
    unsaved = run(service.run_cell({"path": "analysis.ipynb", "cell_id": "cell-a",
                                    "expected_revision": current_revision, "save_outputs": False},
                                   kernel_id="kernel-current"))
    assert unsaved.data["path"] == "analysis.ipynb"
    assert unsaved.data["index"] == 0
    assert str(tmp_path) not in json.dumps(unsaved.model_dump())
    kernels.block = True

    async def conflict():
        task = asyncio.create_task(service.run_cell(
            {"path": "analysis.ipynb", "cell_id": "cell-a", "expected_revision": current_revision},
            kernel_id="kernel-current",
        ))
        await asyncio.to_thread(kernels.started.wait, 1)
        raw = json.loads(path.read_text(encoding="utf-8"))
        raw["cells"][0]["source"] = "changed while running"
        path.write_text(json.dumps(raw), encoding="utf-8")
        kernels.release.set()
        from pipyter.pigent.models import ToolFailure
        try:
            await task
        except ToolFailure as error:
            assert error.code == "output_persist_conflict"
        else:
            raise AssertionError("source conflict was not detected")

    run(conflict())
    assert nbformat.read(path, as_version=4).cells[0].source == "changed while running"
