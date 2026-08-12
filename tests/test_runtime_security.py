from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from pipyter.server.app import create_app
from pipyter.server.security import bridge_endpoint, read_token_file


def test_runtime_token_file_requires_private_regular_file(tmp_path):
    token_file = tmp_path / "runtime-token"
    token_file.write_text("t" * 48 + "\n", encoding="utf-8")
    token_file.chmod(0o644)
    with pytest.raises(ValueError, match="group/others"):
        read_token_file(str(token_file))
    token_file.chmod(0o600)
    assert read_token_file(str(token_file)) == "t" * 48
    link = tmp_path / "runtime-token-link"
    link.symlink_to(token_file)
    with pytest.raises(ValueError, match="securely open"):
        read_token_file(str(link))


def test_bridge_endpoint_tracks_specific_bind_and_wildcards():
    assert bridge_endpoint("0.0.0.0", 8765) == "http://127.0.0.1:8765/internal/pigent/v1"
    assert bridge_endpoint("192.168.3.251", 8765) == "http://192.168.3.251:8765/internal/pigent/v1"
    assert bridge_endpoint("::", 8765) == "http://[::1]:8765/internal/pigent/v1"


def test_runtime_http_token_protects_public_api(project):
    with TestClient(create_app(project.root, runtime_token="r" * 48)) as client:
        denied = client.get("/api/v1/health")
        assert denied.status_code == 401
        assert denied.headers["www-authenticate"] == "Bearer"
        assert "r" * 48 not in denied.text
        assert client.get("/api/v1/health", headers={"Authorization": "Bearer bad"}).status_code == 401
        allowed = client.get("/api/v1/health", headers={"Authorization": f"Bearer {'r' * 48}"})
        assert allowed.status_code == 200


def test_runtime_websocket_requires_token_and_checks_explicit_origin(project):
    token = "w" * 48
    app = create_app(project.root, runtime_token=token, allowed_origins=["http://pi5.test:8080"])
    with TestClient(app) as client:
        session = client.post(
            "/api/v1/terminals",
            headers={"Authorization": f"Bearer {token}"},
            json={"cwd": ".", "name": "auth-test"},
        ).json()
        with pytest.raises(WebSocketDisconnect) as missing:
            with client.websocket_connect(f"/api/v1/terminals/{session['id']}/stream"):
                pass
        assert missing.value.code == 1008
        with pytest.raises(WebSocketDisconnect) as missing_origin:
            with client.websocket_connect(
                f"/api/v1/terminals/{session['id']}/stream",
                headers={"Authorization": f"Bearer {token}"},
            ):
                pass
        assert missing_origin.value.code == 1008
        with pytest.raises(WebSocketDisconnect) as wrong_origin:
            with client.websocket_connect(
                f"/api/v1/terminals/{session['id']}/stream",
                headers={"Authorization": f"Bearer {token}", "Origin": "http://wrong.test"},
            ):
                pass
        assert wrong_origin.value.code == 1008
        with client.websocket_connect(
            f"/api/v1/terminals/{session['id']}/stream",
            headers={"Authorization": f"Bearer {token}", "Origin": "http://pi5.test:8080"},
        ) as websocket:
            assert websocket.receive_json()["type"] == "replay"
