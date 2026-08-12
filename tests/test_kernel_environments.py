from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from pipyter.kernel.environments import KernelEnvironmentError, KernelEnvironmentRegistry
from pipyter.kernel.manager import KernelRuntime
from pipyter.kernel.operations import OperationManager, sanitized_child_env


async def wait(operation, manager: OperationManager, timeout: float = 180):
    async def settled():
        while manager.get(operation.operation_id).state not in {"succeeded", "failed", "cancelled"}:
            await asyncio.sleep(0.05)
        return manager.get(operation.operation_id)
    return await asyncio.wait_for(settled(), timeout)


def no_global_kernel_dirs(home: Path) -> set[Path]:
    roots = [home / ".local/share/jupyter/kernels", home / ".jupyter/kernels"]
    return {path for root in roots if root.exists() for path in root.rglob("*")}


@pytest.mark.skipif(shutil.which("uv") is None, reason="uv unavailable")
def test_real_uv_temporary_promote_restart_and_two_maintained_isolation(tmp_path, monkeypatch):
    config = tmp_path / "config root ü"
    workspace = tmp_path / "workspace with spaces ü"
    workspace.mkdir()
    monkeypatch.setenv("HOME", str(tmp_path / "home"))
    before_global = no_global_kernel_dirs(Path(os.environ["HOME"]))

    async def scenario():
        registry = KernelEnvironmentRegistry(config)
        operations = OperationManager(registry, workspace)
        kernels = KernelRuntime(workspace, registry)
        try:
            temporary = operations.create_temporary({"python": f"{sys.version_info.major}.{sys.version_info.minor}", "ttl_seconds": 900})
            temporary_done = await wait(temporary, operations)
            assert temporary_done.state == "succeeded", temporary_done.model_dump()
            environment_id = temporary.resource.id
            first_kernel = await kernels.start_async(None, environment_id=environment_id)
            executable = await kernels.execute_async(first_kernel.id, "import sys; print(sys.executable)", 30)
            text = "".join(item.text for item in executable.outputs)
            assert str(registry.path(environment_id)) in text
            await kernels.shutdown_async(first_kernel.id)

            promoted = operations.promote(environment_id, "research-one")
            assert (await wait(promoted, operations)).state == "succeeded"
            assert registry.get(environment_id)["kind"] == "maintained"

            second = operations.create_maintained({"name": "research-two", "python": f"{sys.version_info.major}.{sys.version_info.minor}", "packages": []})
            second_done = await wait(second, operations)
            assert second_done.state == "succeeded", second_done.model_dump()
            second_id = second.resource.id

            # Registry reconstructs exclusively from private config metadata.
            restarted = KernelEnvironmentRegistry(config)
            assert {item.id for item in restarted.summaries()} == {environment_id, second_id}
            restarted_kernels = KernelRuntime(workspace, restarted)
            try:
                one = await restarted_kernels.start_async(None, environment_id=environment_id)
                two = await restarted_kernels.start_async(None, environment_id=second_id)
                one_result, two_result = await asyncio.gather(
                    restarted_kernels.execute_async(one.id, "import sys; print(sys.executable)", 30),
                    restarted_kernels.execute_async(two.id, "import sys; print(sys.executable)", 30),
                )
                one_path = "".join(item.text for item in one_result.outputs).strip()
                two_path = "".join(item.text for item in two_result.outputs).strip()
                assert one_path != two_path
                assert str(restarted.path(environment_id)) in one_path
                assert str(restarted.path(second_id)) in two_path
            finally:
                await restarted_kernels.shutdown_all_async()
        finally:
            await operations.shutdown()
            await kernels.shutdown_all_async()

    asyncio.run(scenario())
    assert no_global_kernel_dirs(Path(os.environ["HOME"])) == before_global


def test_operation_cancel_settles_and_stops_child_process(tmp_path, monkeypatch):
    registry = KernelEnvironmentRegistry(tmp_path / "config")
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setattr(registry, "require_uv", lambda: type("Finding", (), {"ok": True, "executable": sys.executable})())

    async def scenario():
        operations = OperationManager(registry, workspace)
        environment = registry.reserve_temporary({"python": "3.12", "ttl_seconds": 900})
        operation = operations._accepted("test.long", environment["id"], None, None)

        async def long_running():
            try:
                await operations._set(operation, state="running", phase="prepare")
                await operations._run(operation, [sys.executable, "-c", "import pathlib,time; time.sleep(10); pathlib.Path(r'%s').write_text('leaked')" % (tmp_path / "after-cancel")])
            except asyncio.CancelledError:
                await asyncio.shield(operations._finish(operation, "cancelled", "cancelled"))

        operations._tasks[operation.operation_id] = asyncio.create_task(long_running())
        while operations.get(operation.operation_id).state != "running":
            await asyncio.sleep(0.01)
        cancelled = await operations.cancel(operation.operation_id)
        assert cancelled.state == "cancelled"
        await asyncio.sleep(0.2)
        assert not (tmp_path / "after-cancel").exists()
        assert operations._reserved.get(environment["id"]) is None
        await operations.shutdown()

    asyncio.run(scenario())


def test_conflicting_environment_operations_are_rejected_and_restart_reconciles(tmp_path, monkeypatch):
    registry = KernelEnvironmentRegistry(tmp_path / "config")
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setattr(registry, "require_uv", lambda: type("Finding", (), {"ok": True, "executable": "uv"})())

    async def scenario():
        operations = OperationManager(registry, workspace)
        environment = registry.reserve_temporary({"python": "3.12", "ttl_seconds": 900})
        operation = operations._accepted("test.busy", environment["id"], None, None)
        with pytest.raises(KernelEnvironmentError, match="active operation"):
            operations._accepted("test.second", environment["id"], None, None)
        operations._operations[operation.operation_id] = operation
        operations._persist(operation)
        restarted = OperationManager(KernelEnvironmentRegistry(tmp_path / "config"), workspace)
        assert restarted.get(operation.operation_id).state == "failed"
        assert restarted.environments.get(environment["id"])["status"] == "error"
        operations._release(operation)

    asyncio.run(scenario())


def test_registry_ttl_active_exclusion_and_no_global_kernelspec(tmp_path, monkeypatch):
    registry = KernelEnvironmentRegistry(tmp_path / "config")
    monkeypatch.setattr(registry, "require_uv", lambda: type("Finding", (), {"ok": True, "executable": "uv"})())
    value = registry.reserve_temporary({"python": "3.12", "ttl_seconds": 900})
    expired = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    registry.update(value["id"], status="ready", expires_at=expired)
    assert registry.expired_temporary_ids({value["id"]}) == []
    assert registry.expired_temporary_ids() == [value["id"]]
    assert registry.path(value["id"]).is_relative_to(registry.root)
    assert not (Path.home() / ".local/share/jupyter/kernels" / value["id"]).exists()


def test_private_environment_id_never_shadows_system_kernel_name(tmp_path, monkeypatch):
    registry = KernelEnvironmentRegistry(tmp_path / "config")
    monkeypatch.setattr(registry, "require_uv", lambda: type("Finding", (), {"ok": True, "executable": "uv"})())
    value = registry.reserve_maintained({"name": "python3", "python": "3.12"}, tmp_path)
    registry.update(value["id"], status="ready")
    directory = registry.path(value["id"])
    interpreter = directory / "pyvenv/bin/python"
    interpreter.parent.mkdir(parents=True)
    interpreter.write_text("", encoding="utf-8")
    registry.write_kernelspec(value["id"])
    runtime = KernelRuntime(tmp_path, registry)
    # Legacy kernel_name stays a system kernelspec request; environment_id is explicit.
    assert any(spec.name == "python3" for spec in runtime.specs())
    assert registry.kernelspec(value["id"])["metadata"]["pipyter"]["environment_id"] == value["id"]
    runtime.shutdown_all()


def test_provider_and_bridge_secrets_are_removed_from_children(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "do-not-leak")
    monkeypatch.setenv("PIPYTER_PIGENT_BRIDGE_TOKEN", "do-not-leak")
    monkeypatch.setenv("PIPYTER_RUNTIME_TOKEN", "do-not-leak")
    monkeypatch.setenv("SAFE_TEST_VALUE", "kept")
    env = sanitized_child_env()
    assert "DEEPSEEK_API_KEY" not in env
    assert "PIPYTER_PIGENT_BRIDGE_TOKEN" not in env
    assert "PIPYTER_RUNTIME_TOKEN" not in env
    assert env["SAFE_TEST_VALUE"] == "kept"
