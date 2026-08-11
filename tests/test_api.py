from __future__ import annotations


def test_health(client, project):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["protocol_version"] == "0.1"
    assert body["workspace_id"] == project.workspace_id


def test_workspace_summary(client, project):
    response = client.get("/api/v1/workspace")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "test-project"
    assert body["root_name"] == project.root.name
    assert body["connection_status"] == "connected"
    assert body["open_documents"] == []


def test_files_listing(client):
    response = client.get("/api/v1/files")
    assert response.status_code == 200
    entries = response.json()
    names = [entry["name"] for entry in entries]
    assert "data" in names
    assert ".pipyter" not in names


def test_file_read_write(client):
    response = client.put("/api/v1/files/content?path=notes/new.txt", json={"content": "hi"})
    assert response.status_code == 200
    fetched = client.get("/api/v1/files/content?path=notes/new.txt")
    assert fetched.json()["content"] == "hi"


def test_file_write_traversal_rejected(client):
    response = client.put("/api/v1/files/content?path=../evil.txt", json={"content": "x"})
    assert response.status_code == 403
    response = client.get("/api/v1/files/content?path=../evil.txt")
    assert response.status_code == 403


def test_file_missing_returns_404(client):
    assert client.get("/api/v1/files/content?path=absent.txt").status_code == 404


def test_directory_create_and_delete(client):
    created = client.post("/api/v1/files/directory", json={"path": "fresh"})
    assert created.status_code == 201
    assert created.json()["type"] == "directory"
    deleted = client.delete("/api/v1/files?path=fresh")
    assert deleted.status_code == 204
    assert client.get("/api/v1/files/content?path=fresh").status_code in {400, 404}


def test_metadata_directory_delete_rejected(client):
    response = client.delete("/api/v1/files?path=.pipyter")
    assert response.status_code == 403


def test_notebook_read_write(client):
    document = {
        "cells": [{"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": ["1+1"]}],
        "metadata": {},
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    put = client.put("/api/v1/notebooks", json={"path": "data/analysis.ipynb", "notebook": document})
    assert put.status_code == 200
    fetched = client.get("/api/v1/notebooks?path=data/analysis.ipynb")
    assert fetched.status_code == 200
    assert fetched.json()["notebook"]["cells"][0]["source"] == ["1+1"]


def test_kernel_lifecycle_and_execution(client):
    started = client.post("/api/v1/kernels", json={"kernel_name": "python3"})
    assert started.status_code == 201
    kernel_id = started.json()["id"]
    assert started.json()["status"] == "idle"

    executed = client.post(
        f"/api/v1/kernels/{kernel_id}/execute",
        json={"code": "6 * 7", "timeout": 30},
    )
    assert executed.status_code == 200
    body = executed.json()
    assert body["execution_count"] >= 1
    assert body["status"] == "idle"
    result_outputs = [output for output in body["outputs"] if output["type"] == "execute_result"]
    assert result_outputs and result_outputs[0]["text"] == "42"

    running = client.get("/api/v1/running")
    assert any(item["id"] == kernel_id for item in running.json()["kernels"])

    restarted = client.post(f"/api/v1/kernels/{kernel_id}/restart")
    assert restarted.status_code == 200
    assert restarted.json()["execution_count"] == 0

    assert client.delete(f"/api/v1/kernels/{kernel_id}").status_code == 204
    assert client.get("/api/v1/kernels").json() == []


def test_kernel_execute_error_captures_traceback(client):
    started = client.post("/api/v1/kernels", json={}).json()
    kernel_id = started["id"]
    executed = client.post(
        f"/api/v1/kernels/{kernel_id}/execute",
        json={"code": "raise ValueError('boom')", "timeout": 30},
    ).json()
    errors = [output for output in executed["outputs"] if output["type"] == "error"]
    assert errors
    assert "ValueError" in errors[0]["text"]
    assert errors[0]["traceback"]
    client.delete(f"/api/v1/kernels/{kernel_id}")


def test_unknown_kernel_returns_404(client):
    assert client.post("/api/v1/kernels/missing/execute", json={"code": "1"}).status_code == 404


def test_kernel_specs_listed(client):
    response = client.get("/api/v1/kernels/specs")
    assert response.status_code == 200
    specs = response.json()
    assert any(spec["name"] == "python3" for spec in specs)
    python3 = next(spec for spec in specs if spec["name"] == "python3")
    assert python3["language"] == "python"
    assert python3["argv"]


def test_file_download(client):
    client.put("/api/v1/files/content?path=download.txt", json={"content": "download me"})
    response = client.get("/api/v1/files/download?path=download.txt")
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment")
    assert "download me" in response.text


def test_file_download_traversal_rejected(client):
    response = client.get("/api/v1/files/download?path=../secret")
    assert response.status_code == 403


def test_terminal_execution_bounded(client):
    response = client.post(
        "/api/v1/terminals/execute",
        json={"command": "echo hello-workspace", "cwd": ".", "timeout": 15},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["exit_code"] == 0
    assert "hello-workspace" in body["stdout"]
    assert body["session_id"]


def test_terminal_rejects_escaping_cwd(client):
    response = client.post(
        "/api/v1/terminals/execute",
        json={"command": "pwd", "cwd": "../../etc", "timeout": 15},
    )
    assert response.status_code == 403
