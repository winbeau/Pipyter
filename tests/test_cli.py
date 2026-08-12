from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from pipyter.cli.main import main
from pipyter.config import Credentials, config_dir, load_credentials, save_credentials


@pytest.fixture()
def cli_project(tmp_path, isolated_config):
    main(["project", "link", str(tmp_path), "--name", "cli-demo"])
    return tmp_path


def test_help_exits_zero():
    for argv in (
        ["--help"], ["auth", "--help"], ["lab", "--help"],
        ["node", "--help"], ["node", "serve", "--help"], ["admin", "--help"],
    ):
        with pytest.raises(SystemExit) as excinfo:
            main(argv)
        assert excinfo.value.code == 0


def test_version():
    with pytest.raises(SystemExit) as excinfo:
        main(["--version"])
    assert excinfo.value.code == 0


def test_auth_local_creates_credentials(isolated_config):
    assert main(["auth", "login", "--local", "--server", "http://127.0.0.1:9999"]) == 0
    credentials = load_credentials()
    assert credentials is not None
    assert credentials.account_id == "local"
    assert credentials.server_url == "http://127.0.0.1:9999"
    path = config_dir() / "credentials.json"
    assert path.exists()
    assert path.stat().st_mode & 0o077 == 0


def test_project_show(cli_project, capsys):
    assert main(["project", "show", str(cli_project)]) == 0
    captured = json.loads(capsys.readouterr().out)
    assert captured["name"] == "cli-demo"
    assert captured["root"] == str(cli_project.resolve())


def test_project_link_idempotent(cli_project):
    assert main(["project", "link", str(cli_project)]) == 0


def test_project_link_uses_signed_in_account(tmp_path, isolated_config, capsys):
    save_credentials(Credentials("account-alice", "control-token", "https://control.test"))
    assert main(["project", "link", str(tmp_path), "--name", "alice-project"]) == 0
    assert json.loads(capsys.readouterr().out)["account_id"] == "account-alice"


def test_project_show_unlinked_fails(tmp_path):
    assert main(["project", "show", str(tmp_path)]) == 2


def test_doctor_on_linked_project(cli_project, capsys):
    code = main(["doctor", str(cli_project)])
    assert code == 0
    checks = json.loads(capsys.readouterr().out)
    assert checks["project_linked"] is True
    assert checks["jupyterlab_importable"] is True


def test_doctor_unlinked_still_reports(tmp_path, capsys):
    code = main(["doctor", str(tmp_path)])
    checks = json.loads(capsys.readouterr().out)
    assert checks["project_linked"] is False
    assert code == 1


def test_lab_rejects_non_loopback_bind(cli_project):
    assert main(["lab", str(cli_project), "--no-browser", "--host", "0.0.0.0"]) == 2
    assert main(["serve", str(cli_project), "--host", "0.0.0.0"]) == 2
    assert main(["up", str(cli_project), "--api-host", "0.0.0.0", "--no-jupyter"]) == 2


def test_lab_keeps_local_same_origin_mode(cli_project, monkeypatch):
    captured = {}
    monkeypatch.setattr("uvicorn.run", lambda app, **kwargs: captured.update(app=app, kwargs=kwargs))
    assert main(["lab", str(cli_project), "--no-browser", "--port", "18767"]) == 0
    assert captured["app"].state.runtime_auth_enabled is False
    assert captured["app"].state.node_id == "local"
    assert captured["kwargs"]["host"] == "127.0.0.1"


def test_node_serve_requires_token_for_non_loopback(cli_project):
    assert main(["node", "serve", str(cli_project), "--host", "0.0.0.0"]) == 2


def test_multi_user_mode_blocks_single_user_lab(cli_project, tmp_path):
    assert main([
        "admin", "mode", "set", "multi-user", "--users-root", str(tmp_path / "users")
    ]) == 0
    assert main(["lab", str(cli_project), "--no-browser"]) == 2
    assert main(["node", "serve", str(cli_project)]) == 2


def test_node_serve_enables_remote_runtime_auth(cli_project, tmp_path, monkeypatch):
    token_file = tmp_path / "runtime-token"
    token_file.write_text("n" * 48 + "\n", encoding="utf-8")
    token_file.chmod(0o600)
    captured = {}
    monkeypatch.setattr("uvicorn.run", lambda app, **kwargs: captured.update(app=app, kwargs=kwargs))
    assert main([
        "node", "serve", str(cli_project),
        "--host", "0.0.0.0", "--port", "18768",
        "--node-id", "gpu-lan", "--token-file", str(token_file),
        "--allowed-origin", "http://192.168.3.250:8080",
    ]) == 0
    assert captured["app"].state.runtime_auth_enabled is True
    assert captured["app"].state.node_id == "gpu-lan"
    assert captured["kwargs"]["host"] == "0.0.0.0"
