from __future__ import annotations

import asyncio
import threading
import time

from pipyter.kernel.manager import KernelRuntime


def test_concurrent_execute_requests_share_one_queue(tmp_path):
    kernels = KernelRuntime(tmp_path)
    kernel = kernels.start()

    async def run(value: str):
        return await kernels.execute_async(kernel.id, f"import time; print('start-{value}'); time.sleep(0.15); print('end-{value}')", 10)

    async def scenario():
        first, second = await asyncio.gather(run("one"), run("two"))
        one = "".join(item.text for item in first.outputs if item.type == "stream")
        two = "".join(item.text for item in second.outputs if item.type == "stream")
        assert one == "start-one\nend-one\n"
        assert two == "start-two\nend-two\n"
        assert kernels.list()[0].queue_depth == 0

    try:
        asyncio.run(scenario())
    finally:
        kernels.shutdown_all()


def test_store_history_interrupt_timeout_generation_and_binding(tmp_path):
    kernels = KernelRuntime(tmp_path)
    kernel = kernels.start(notebook_path="analysis.ipynb")
    try:
        hidden = kernels.execute(kernel.id, "40 + 2", store_history=False)
        visible = kernels.execute(kernel.id, "6 * 7", store_history=True)
        assert hidden.execution_count == 0
        assert visible.execution_count >= 1
        assert kernels.kernel_for_notebook("analysis.ipynb") == kernel.id

        restarted = kernels.restart(kernel.id)
        assert restarted.generation == 2
        assert restarted.execution_count == 0
        assert restarted.notebook_path == "analysis.ipynb"

        partial = []

        def timeout():
            try:
                kernels.execute(kernel.id, "import time; print('partial', flush=True); time.sleep(5)", timeout=0.3)
            except TimeoutError as error:
                partial.append(str(error))

        worker = threading.Thread(target=timeout)
        worker.start()
        worker.join(timeout=5)
        assert partial and "timed out" in partial[0]
        assert kernels.list()[0].status in {"idle", "dead"}
    finally:
        kernels.shutdown_all()
    assert kernels.kernel_for_notebook("analysis.ipynb") is None


def test_async_cancellation_removes_queued_work_and_interrupts_active_work(tmp_path):
    kernels = KernelRuntime(tmp_path)
    kernel = kernels.start()

    async def scenario():
        active = asyncio.create_task(kernels.execute_async(kernel.id, "import time; time.sleep(10)", 20))
        for _ in range(100):
            if kernels.list()[0].status == "busy":
                break
            await asyncio.sleep(0.01)
        queued = asyncio.create_task(kernels.execute_async(kernel.id, "print('must-not-run')", 20))
        await asyncio.sleep(0.05)
        queued.cancel()
        await asyncio.gather(queued, return_exceptions=True)
        active.cancel()
        await asyncio.gather(active, return_exceptions=True)
        assert kernels.list()[0].queue_depth == 0
        probe = await kernels.execute_async(kernel.id, "print('alive')", 10)
        assert "alive" in "".join(item.text for item in probe.outputs)

    try:
        asyncio.run(scenario())
    finally:
        kernels.shutdown_all()


def test_dead_kernel_is_reported_deterministically(tmp_path):
    kernels = KernelRuntime(tmp_path)
    kernel = kernels.start()
    handle = kernels._require(kernel.id)
    handle.manager.shutdown_kernel(now=True)
    summary = kernels.mark_dead(kernel.id)
    assert summary.status == "dead"
    try:
        try:
            kernels.execute(kernel.id, "1", timeout=1)
        except RuntimeError as error:
            assert "dead" in str(error).lower()
        else:
            raise AssertionError("dead kernel executed")
    finally:
        kernels.shutdown_all()
