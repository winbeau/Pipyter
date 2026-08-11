from __future__ import annotations

import tomllib
from pathlib import Path

import pytest

from pipyter.exceptions import ProjectNotLinkedError
from pipyter.workspace.project import find_project, link_project, load_project


def test_link_creates_metadata_without_secrets(tmp_path):
    binding = link_project(tmp_path, name="demo")
    assert binding.root == tmp_path.resolve()
    assert binding.metadata_path.is_file()
    data = tomllib.loads(binding.metadata_path.read_text(encoding="utf-8"))["project"]
    assert data["account_id"] == "local"
    assert data["name"] == "demo"
    assert "token" not in data and "secret" not in " ".join(data.values())


def test_link_is_idempotent(tmp_path):
    first = link_project(tmp_path, name="a")
    second = link_project(tmp_path, name="a")
    assert first.project_id == second.project_id
    assert first.workspace_id == second.workspace_id


def test_link_force_rebinds(tmp_path):
    first = link_project(tmp_path, name="a")
    second = link_project(tmp_path, name="b", force=True)
    assert first.project_id != second.project_id
    assert second.name == "b"


def test_find_project_walks_parents(tmp_path):
    nested = tmp_path / "a" / "b"
    nested.mkdir(parents=True)
    link_project(tmp_path, name="root")
    found = find_project(nested)
    assert found is not None
    assert found.parent == (tmp_path / ".pipyter")


def test_nearest_binding_wins(tmp_path):
    inner = tmp_path / "inner"
    inner.mkdir()
    link_project(tmp_path, name="outer")
    link_project(inner, name="inner-project")
    assert load_project(inner).name == "inner-project"
    assert load_project(tmp_path).name == "outer"


def test_load_project_metadata_root_is_authoritative(tmp_path):
    binding = link_project(tmp_path, name="demo")
    # Corrupt the recorded root; loading must fall back to the metadata parent
    # instead of following the recorded path.
    path = binding.metadata_path
    text = path.read_text(encoding="utf-8").replace(str(tmp_path.resolve()), "/nonexistent/elsewhere")
    path.write_text(text, encoding="utf-8")
    assert load_project(tmp_path).root == tmp_path.resolve()


def test_load_unlinked_raises(tmp_path):
    with pytest.raises(ProjectNotLinkedError):
        load_project(tmp_path)


def test_project_rejects_missing_directory(tmp_path):
    with pytest.raises(ProjectNotLinkedError):
        link_project(tmp_path / "missing")
