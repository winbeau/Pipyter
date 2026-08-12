from __future__ import annotations

import pytest

from pipyter.config import config_dir
from pipyter.server.app import create_app
from pipyter.workspace.project import link_project


@pytest.fixture()
def isolated_config(tmp_path, monkeypatch):
    """Point Pipyter config/credentials at a scratch directory."""
    root = tmp_path / "config"
    monkeypatch.setenv("PIPYTER_CONFIG_HOME", str(root))
    monkeypatch.setenv("PIPYTER_CONFIG_DIR", str(root))
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
def _isolate_config_env(tmp_path, monkeypatch):
    """Keep every control-plane and Pigent config write inside this test's temp tree."""
    root = tmp_path / "config"
    # PIPYTER_CONFIG_HOME is the shared authority. Retain CONFIG_DIR because
    # older control-plane call sites and tests still support that alias.
    monkeypatch.setenv("PIPYTER_CONFIG_HOME", str(root))
    monkeypatch.setenv("PIPYTER_CONFIG_DIR", str(root))
