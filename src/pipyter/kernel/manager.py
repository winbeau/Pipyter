from __future__ import annotations

import queue
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..protocol.models import ExecuteResponse, KernelOutput, KernelSpecSummary, KernelSummary


@dataclass
class _KernelHandle:
    id: str
    name: str
    manager: Any
    client: Any
    status: str = "idle"
    execution_count: int = 0


class KernelRuntime:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self._kernels: dict[str, _KernelHandle] = {}

    def specs(self) -> list[KernelSpecSummary]:
        from jupyter_client.kernelspec import KernelSpecManager

        specs = KernelSpecManager().get_all_specs()
        result: list[KernelSpecSummary] = []
        for name, spec in sorted(specs.items()):
            metadata = spec.get("spec", {}) if isinstance(spec, dict) else {}
            result.append(
                KernelSpecSummary(
                    name=name,
                    display_name=str(metadata.get("display_name", name)),
                    language=str(metadata.get("language", "python")),
                    argv=list(metadata.get("argv", [])),
                )
            )
        return result

    def list(self) -> list[KernelSummary]:
        return [
            KernelSummary(
                id=item.id,
                name=item.name,
                status=item.status,
                execution_count=item.execution_count,
            )
            for item in self._kernels.values()
        ]

    def start(self, kernel_name: str = "python3") -> KernelSummary:
        from jupyter_client import KernelManager

        manager = KernelManager(kernel_name=kernel_name)
        manager.start_kernel(cwd=str(self.root))
        client = manager.client()
        client.start_channels()
        client.wait_for_ready(timeout=20)
        kernel_id = str(uuid.uuid4())
        handle = _KernelHandle(kernel_id, kernel_name, manager, client)
        self._kernels[kernel_id] = handle
        return KernelSummary(id=kernel_id, name=kernel_name, status="idle")

    def execute(self, kernel_id: str, code: str, timeout: float = 30) -> ExecuteResponse:
        handle = self._require(kernel_id)
        handle.status = "busy"
        message_id = handle.client.execute(code)
        outputs: list[KernelOutput] = []
        execution_count = handle.execution_count
        while True:
            try:
                message = handle.client.get_iopub_msg(timeout=timeout)
            except queue.Empty as error:
                handle.status = "idle"
                raise TimeoutError(f"Kernel execution timed out after {timeout}s") from error
            parent_id = message.get("parent_header", {}).get("msg_id")
            if parent_id != message_id:
                continue
            message_type = message.get("header", {}).get("msg_type")
            content = message.get("content", {})
            if message_type == "status":
                handle.status = content.get("execution_state", handle.status)
                if handle.status == "idle":
                    break
            elif message_type == "execute_input":
                execution_count = int(content.get("execution_count", execution_count + 1))
            elif message_type == "stream":
                outputs.append(
                    KernelOutput(type="stream", text=str(content.get("text", "")), name=content.get("name"))
                )
            elif message_type in {"execute_result", "display_data"}:
                data = content.get("data", {})
                outputs.append(
                    KernelOutput(
                        type="execute_result" if message_type == "execute_result" else "display_data",
                        text=str(data.get("text/plain", "")),
                        data=data,
                    )
                )
            elif message_type == "error":
                outputs.append(
                    KernelOutput(
                        type="error",
                        text=f"{content.get('ename', 'Error')}: {content.get('evalue', '')}",
                        traceback=list(content.get("traceback", [])),
                    )
                )
        handle.execution_count = execution_count
        handle.status = "idle"
        return ExecuteResponse(
            kernel_id=kernel_id,
            execution_count=execution_count,
            status="idle",
            outputs=outputs,
        )

    def interrupt(self, kernel_id: str) -> KernelSummary:
        handle = self._require(kernel_id)
        handle.manager.interrupt_kernel()
        handle.status = "idle"
        return KernelSummary(id=handle.id, name=handle.name, status=handle.status)

    def restart(self, kernel_id: str) -> KernelSummary:
        handle = self._require(kernel_id)
        handle.status = "restarting"
        handle.manager.restart_kernel(now=True)
        handle.client.wait_for_ready(timeout=20)
        handle.status = "idle"
        handle.execution_count = 0
        return KernelSummary(id=handle.id, name=handle.name, status=handle.status)

    def shutdown(self, kernel_id: str) -> None:
        handle = self._require(kernel_id)
        try:
            handle.client.stop_channels()
        finally:
            handle.manager.shutdown_kernel(now=True)
            self._kernels.pop(kernel_id, None)

    def shutdown_all(self) -> None:
        for kernel_id in list(self._kernels):
            self.shutdown(kernel_id)

    def _require(self, kernel_id: str) -> _KernelHandle:
        try:
            return self._kernels[kernel_id]
        except KeyError as error:
            raise KeyError(f"Unknown kernel: {kernel_id}") from error
