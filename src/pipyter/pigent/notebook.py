from __future__ import annotations

import asyncio
import copy
import json
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

import nbformat
from nbformat import NotebookNode

from .models import ToolFailure, success
from ..workspace.files import atomic_write_bytes
from .tools import public_path, resolve_target, revision_bytes


class NotebookService:
    def __init__(self, workspace: Path, kernels: Any):
        self.workspace = workspace.expanduser().resolve()
        self.kernels = kernels
        self._locks: defaultdict[Path, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def dispatch(self, arguments: dict[str, Any], *, kernel_id: str | None = None):
        action = arguments.get("action")
        if action == "read_cell":
            return await self.read_cell(arguments)
        if action == "run_cell":
            return await self.run_cell(arguments, kernel_id=kernel_id)
        if action in {"update_cell", "insert_cell", "delete_cell", "move_cell", "add_markdown", "clear_output"}:
            return await self._mutation(action, arguments)
        raise ToolFailure("invalid_request", f"Unknown notebook action: {action}")

    def _path(self, arguments: dict[str, Any]) -> Path:
        path = resolve_target(self.workspace, arguments.get("path"))
        if path.suffix.lower() != ".ipynb":
            raise ToolFailure("invalid_path", "Notebook path must end with .ipynb")
        return path

    async def read_cell(self, arguments: dict[str, Any]):
        path = self._path(arguments)
        async with self._locks[path]:
            notebook, raw, normalized = self._load(path)
            if normalized:
                raw = self._save(path, notebook)
            requested_cell_id = arguments.get("cell_id")
            if requested_cell_id is None and notebook.cells:
                cell, index = notebook.cells[0], 0
            else:
                cell, index = self._find(notebook, requested_cell_id)
            data = self._cell_data(cell, index, bool(arguments.get("include_outputs", False)))
            data.update({"path": public_path(self.workspace, path), "revision": revision_bytes(raw)})
            return success(f"Read cell {cell.id}", data=data)

    async def _mutation(self, action: str, arguments: dict[str, Any]):
        path = self._path(arguments)
        async with self._locks[path]:
            notebook, raw, _ = self._load(path)
            before = revision_bytes(raw)
            self._check_revision(arguments.get("expected_revision"), before)
            result: dict[str, Any]
            changed = True
            if action == "update_cell":
                cell, index = self._find(notebook, arguments.get("cell_id"))
                supplied = any(key in arguments for key in ("source", "cell_type", "metadata", "clear_outputs"))
                if not supplied:
                    raise ToolFailure("invalid_request", "update_cell requires at least one changed field")
                if "source" in arguments:
                    if not isinstance(arguments["source"], str):
                        raise ToolFailure("invalid_request", "source must be a string")
                    cell.source = arguments["source"]
                if "cell_type" in arguments:
                    target_type = arguments["cell_type"]
                    if target_type not in {"code", "markdown", "raw"}:
                        raise ToolFailure("invalid_request", "Unsupported cell type")
                    if target_type != cell.cell_type:
                        replacement = self._new_cell(target_type, str(cell.source), cell_id=cell.id)
                        replacement.metadata = copy.deepcopy(cell.metadata)
                        notebook.cells[index] = cell = replacement
                if "metadata" in arguments:
                    if not isinstance(arguments["metadata"], dict):
                        raise ToolFailure("invalid_request", "metadata must be an object")
                    cell.metadata = copy.deepcopy(arguments["metadata"])
                if arguments.get("clear_outputs") and cell.cell_type == "code":
                    cell.outputs = []
                    cell.execution_count = None
                result = {"cell": self._cell_data(cell, index, True)}
            elif action in {"insert_cell", "add_markdown"}:
                cell_type = "markdown" if action == "add_markdown" else arguments.get("cell_type", "code")
                source = arguments.get("source", "")
                if not isinstance(source, str) or cell_type not in {"code", "markdown", "raw"}:
                    raise ToolFailure("invalid_request", "Invalid cell_type or source")
                cell = self._new_cell(cell_type, source)
                index = self._position(notebook, arguments.get("position", {"kind": "end"}))
                notebook.cells.insert(index, cell)
                result = {"cell": self._cell_data(cell, index, True)}
            elif action == "delete_cell":
                cell, index = self._find(notebook, arguments.get("cell_id"))
                deleted = self._cell_data(cell, index, False)
                notebook.cells.pop(index)
                result = {"deleted": deleted,
                          "previous_cell_id": notebook.cells[index - 1].id if index > 0 else None,
                          "next_cell_id": notebook.cells[index].id if index < len(notebook.cells) else None}
            elif action == "move_cell":
                cell, old_index = self._find(notebook, arguments.get("cell_id"))
                notebook.cells.pop(old_index)
                new_index = self._position(notebook, arguments.get("position", {"kind": "end"}))
                notebook.cells.insert(new_index, cell)
                changed = new_index != old_index
                result = {"cell": self._cell_data(cell, new_index, False), "from_index": old_index, "to_index": new_index}
            else:  # clear_output
                scope = arguments.get("scope")
                cell_id = arguments.get("cell_id")
                if cell_id:
                    cell, _ = self._find(notebook, cell_id)
                    targets = [cell]
                elif scope == "all":
                    targets = [cell for cell in notebook.cells if cell.cell_type == "code"]
                else:
                    raise ToolFailure("invalid_request", "clear_output requires cell_id or explicit scope=all")
                for cell in targets:
                    if cell.cell_type == "code":
                        cell.outputs = []
                        cell.execution_count = None
                result = {"cleared_cell_ids": [cell.id for cell in targets]}
            if not changed:
                return success(f"Notebook {action} was a no-op", data={**result, "revision": before}, before=before, after=before)
            new_raw = self._save(path, notebook)
            after = revision_bytes(new_raw)
            result["revision"] = after
            return success(f"Notebook {action} completed", data=result, before=before, after=after)

    async def run_cell(self, arguments: dict[str, Any], *, kernel_id: str | None):
        if not kernel_id:
            raise ToolFailure("kernel_unavailable", "No current kernel is bound to this notebook")
        path = self._path(arguments)
        async with self._locks[path]:
            notebook, raw, _ = self._load(path)
            before = revision_bytes(raw)
            self._check_revision(arguments.get("expected_revision"), before)
            cell, index = self._find(notebook, arguments.get("cell_id"))
            if cell.cell_type != "code":
                raise ToolFailure("invalid_request", "Only code cells can be run")
            source = str(cell.source)
            cell_id = cell.id
        timeout = float(arguments.get("timeout", 120))
        try:
            response = await self.kernels.execute_async(kernel_id, source, timeout, store_history=True)
        except KeyError as error:
            raise ToolFailure("kernel_unavailable", str(error)) from error
        except TimeoutError as error:
            raise ToolFailure("execution_timeout", str(error), True) from error
        outputs = [self._kernel_output(item) for item in response.outputs]
        if not arguments.get("save_outputs", True):
            return success(f"Ran cell {cell_id}", data={"cell_id": cell_id, "execution_count": response.execution_count,
                                                              "outputs": outputs, "revision": before})
        async with self._locks[path]:
            current, current_raw, _ = self._load(path)
            current_revision = revision_bytes(current_raw)
            current_cell, current_index = self._find(current, cell_id)
            if current_revision != before or str(current_cell.source) != source:
                raise ToolFailure("output_persist_conflict", "Cell source or notebook changed while execution was running", True,
                                  {"expected": before, "current": current_revision, "outputs": outputs})
            current_cell.outputs = [nbformat.from_dict(item) for item in outputs]
            current_cell.execution_count = response.execution_count
            new_raw = self._save(path, current)
            after = revision_bytes(new_raw)
            return success(f"Ran and saved cell {cell_id}",
                           data={"cell": self._cell_data(current_cell, current_index, True), "revision": after},
                           before=before, after=after)

    def _load(self, path: Path) -> tuple[NotebookNode, bytes, bool]:
        try:
            raw = path.read_bytes()
        except FileNotFoundError as error:
            raise ToolFailure("not_found", f"Not found: {public_path(self.workspace, path)}") from error
        try:
            text = raw.decode("utf-8")
            raw_document = json.loads(text)
            normalized = False
            raw_seen: set[str] = set()
            for raw_cell in raw_document.get("cells", []):
                if not isinstance(raw_cell, dict):
                    continue
                cell_id = raw_cell.get("id")
                if not isinstance(cell_id, str) or not cell_id or cell_id in raw_seen:
                    raw_cell["id"] = uuid.uuid4().hex[:12]
                    normalized = True
                raw_seen.add(raw_cell["id"])
            notebook = nbformat.from_dict(raw_document)
        except UnicodeDecodeError as error:
            raise ToolFailure("invalid_request", "Notebook is not valid UTF-8") from error
        except Exception as error:
            raise ToolFailure("invalid_request", f"Invalid notebook: {error}") from error
        seen: set[str] = set()
        for cell in notebook.cells:
            cell_id = cell.get("id")
            if not isinstance(cell_id, str) or not cell_id or cell_id in seen:
                cell["id"] = uuid.uuid4().hex[:12]
                normalized = True
            seen.add(cell["id"])
            if isinstance(cell.source, list):
                cell.source = "".join(cell.source)
                normalized = True
        try:
            nbformat.validate(notebook)
        except Exception as error:
            raise ToolFailure("invalid_request", f"Notebook validation failed: {error}") from error
        return notebook, raw, normalized

    def _save(self, path: Path, notebook: NotebookNode) -> bytes:
        nbformat.validate(notebook)
        raw = nbformat.writes(notebook, version=4).encode("utf-8")
        path.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_bytes(path, raw)
        return raw

    @staticmethod
    def _check_revision(expected: Any, current: str) -> None:
        if expected is None:
            raise ToolFailure("invalid_request", "expected_revision is required for notebook mutations")
        if expected != current:
            raise ToolFailure("revision_conflict", f"Expected {expected}, current {current}", True,
                              {"expected": expected, "current": current})

    @staticmethod
    def _find(notebook: NotebookNode, cell_id: Any) -> tuple[NotebookNode, int]:
        if not isinstance(cell_id, str) or not cell_id:
            raise ToolFailure("invalid_request", "cell_id is required")
        for index, cell in enumerate(notebook.cells):
            if cell.id == cell_id:
                return cell, index
        raise ToolFailure("not_found", f"Cell not found: {cell_id}")

    @staticmethod
    def _new_cell(cell_type: str, source: str, *, cell_id: str | None = None) -> NotebookNode:
        if cell_type == "code":
            cell = nbformat.v4.new_code_cell(source=source)
        elif cell_type == "markdown":
            cell = nbformat.v4.new_markdown_cell(source=source)
        else:
            cell = nbformat.v4.new_raw_cell(source=source)
        cell.id = cell_id or uuid.uuid4().hex[:12]
        return cell

    @classmethod
    def _position(cls, notebook: NotebookNode, position: Any) -> int:
        if not isinstance(position, dict):
            raise ToolFailure("invalid_request", "position must be an object")
        kind = position.get("kind")
        if kind == "start":
            return 0
        if kind == "end":
            return len(notebook.cells)
        if kind in {"before", "after"}:
            _, index = cls._find(notebook, position.get("cell_id"))
            return index + (kind == "after")
        raise ToolFailure("invalid_request", "position.kind must be start, end, before, or after")

    @staticmethod
    def _cell_data(cell: NotebookNode, index: int, include_outputs: bool) -> dict[str, Any]:
        data: dict[str, Any] = {"cell_id": cell.id, "index": index, "cell_type": cell.cell_type,
                                "source": str(cell.source), "metadata": dict(cell.metadata)}
        if cell.cell_type == "code":
            data["execution_count"] = cell.execution_count
            if include_outputs:
                outputs = [dict(output) for output in cell.outputs]
                data["outputs"] = outputs[:100]
                data["outputs_truncated"] = len(outputs) > 100
        return data

    @staticmethod
    def _kernel_output(item: Any) -> dict[str, Any]:
        if item.type == "stream":
            return {"output_type": "stream", "name": item.name or "stdout", "text": item.text[:65536]}
        if item.type == "error":
            text = item.text or "Error"
            ename, _, evalue = text.partition(":")
            return {"output_type": "error", "ename": ename, "evalue": evalue.strip(), "traceback": item.traceback[:100]}
        data = dict(item.data or {})
        data = {key: value for key, value in data.items() if len(str(value)) <= 1024 * 1024}
        if item.type == "execute_result":
            return {"output_type": "execute_result", "data": data, "metadata": {}, "execution_count": None}
        return {"output_type": "display_data", "data": data, "metadata": {}}
