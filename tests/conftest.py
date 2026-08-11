from __future__ import annotations

import os

import pytest

from pipyter.config import config_dir
from pipyter.server.app import create_app
from pipyter.workspace.project import link_project


@pytest.fixture()
def isolated_config(tmp_path, monkeypatch):
    """Point Pipyter config/credentials at a scratch directory."""
    monkeypatch.setenv("PIPYTER_CONFIG_DIR", str(tmp_path / "config"))
    return config_dir()


@pytest.fixture()
def project(tmp_path):
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "notes.txt").write_text("hello\n", encoding="utf-8")
    (tmp_path / "data" / "analysis.ipynb").write_text(
        '{"cells": [], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}\n',
        encoding="utf-8",
    )
    return link_project(tmp_path, name="test-project")


@pytest.fixture()
def client(project):
    app = create_app(project.root)
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _isolate_config_env(monkeypatch):
    # Keep the runner's own credentials untouched by default.
    monkeypatch.setenv("PIPYTER_CONFIG_DIR", str(os.environ.get("PIPYTER_CONFIG_DIR", "")) or "/tmp/pipyter-test-config")
