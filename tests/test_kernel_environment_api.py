from __future__ import annotations

import asyncio
from types import SimpleNamespace

from fastapi.testclient import TestClient

from pipyter.kernel.environments import KernelEnvironmentRegistry
from pipyter.server.app import create_app


def test_environment_rest_accept_status_cancel_and_permission_errors(tmp_path, monkeypatch):
    app = create_app(tmp_path / "workspace", config_root=tmp_path / "config")
    app.state.workspace_root.mkdir(parents=True, exist_ok=True)
    registry = app.state.kernel_environments
    monkeypatch.setattr(registry, "require_uv", lambda: SimpleNamespace(ok=True, executable="uv"))

    async def fake_provision(operation, request):
        await app.state.kernel_operations._set(operation, state="running", phase="prepare", completed=0, total=1, message="waiting")
        try:
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            registry.update(operation.resource.id, status="error")
            await app.state.kernel_operations._finish(operation, "cancelled", "cancelled")

    monkeypatch.setattr(app.state.kernel_operations, "_provision", fake_provision)
    with TestClient(app) as client:
        accepted = client.post("/api/v1/kernel-environments/temporary", json={"python": "3.12", "ttl_seconds": 900})
        assert accepted.status_code == 202
        operation = accepted.json()
        assert operation["state"] in {"queued", "running"}
        assert operation["resource"]["type"] == "kernel_environment"
        status = client.get(f"/api/v1/operations/{operation['operation_id']}")
        assert status.status_code == 200
        cancelled = client.post(f"/api/v1/operations/{operation['operation_id']}/cancel")
        assert cancelled.status_code == 202

        missing = client.get("/api/v1/operations/op_missing")
        assert missing.status_code == 404
        missing_env = client.post("/api/v1/kernel-environments/env_missing/start", json={})
        assert missing_env.status_code == 409


def test_maintained_delete_requires_confirmation_and_active_conflict(tmp_path, monkeypatch):
    app = create_app(tmp_path / "workspace", config_root=tmp_path / "config")
    app.state.workspace_root.mkdir(parents=True, exist_ok=True)
    registry: KernelEnvironmentRegistry = app.state.kernel_environments
    monkeypatch.setattr(registry, "require_uv", lambda: SimpleNamespace(ok=True, executable="uv"))
    value = registry.reserve_maintained({"name": "research", "python": "3.12"}, app.state.workspace_root)
    registry.update(value["id"], status="ready")
    with TestClient(app) as client:
        response = client.delete(f"/api/v1/kernel-environments/{value['id']}")
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "confirmation_required"
