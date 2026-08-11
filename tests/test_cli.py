from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from pipyter.cli.main import main
from pipyter.config import config_dir, load_credentials


@pytest.fixture()
def cli_project(tmp_path, isolated_config):
    main(["project", "link", str(tmp_path), "--name", "cli-demo"])
    return tmp_path


def test_help_exits_zero():
    for argv in (["--help"], ["auth", "--help"], ["lab", "--help"]):
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
