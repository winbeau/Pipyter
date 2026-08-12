from __future__ import annotations

import json
import os
import shutil
import stat
from pathlib import Path

try:
    import tomllib
except ImportError:  # pragma: no cover - Python 3.10
    import tomli as tomllib

import pytest

from pipyter.pigent import resources
from pipyter.pigent.manager import PigentManager, PigentUnavailable


REPOSITORY = Path(__file__).parents[1]
PAYLOAD = REPOSITORY / "build" / "pigent-runtime"


def test_payload_manifest_is_sorted_portable_and_hash_verified(monkeypatch):
    if not PAYLOAD.exists():
        pytest.skip("generated Pigent payload is not present")
    monkeypatch.setenv(resources.PAYLOAD_ENV, str(PAYLOAD))
    manifest = resources.verify_payload()
    assert manifest["node_min"] == "22.19.0"
    assert manifest["portable"] is True
    assert manifest["external_engine_required"] is False
    assert list(manifest["files"]) == sorted(manifest["files"])
    assert not any("engines/" in path or path.endswith(".node") for path in manifest["files"])


def test_payload_rejects_unhashed_absolute_or_traversal_host_entry(tmp_path, monkeypatch):
    if not PAYLOAD.exists():
        pytest.skip("generated Pigent payload is not present")
    destination = tmp_path / "payload"
    shutil.copytree(PAYLOAD, destination)
    manifest_path = destination / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    monkeypatch.setenv(resources.PAYLOAD_ENV, str(destination))
    for host_entry in (str(tmp_path / "outside.mjs"), "../outside.mjs", "unhashed.mjs"):
        (tmp_path / "outside.mjs").write_text("", encoding="utf-8")
        manifest["host_entry"] = host_entry
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with pytest.raises(resources.PigentResourceError):
            resources.verify_payload()


def _fake_node(path: Path, version: str, *, exit_code: int = 0) -> Path:
    path.write_text(f"#!/bin/sh\nprintf '%s\\n' '{version}'\nexit {exit_code}\n", encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def test_node_minimum_and_missing_are_independent_payload_findings(tmp_path, monkeypatch):
    monkeypatch.setenv(resources.PAYLOAD_ENV, str(tmp_path / "missing-payload"))
    old = _fake_node(tmp_path / "old-node", "v22.18.0")
    current = _fake_node(tmp_path / "current-node", "v22.19.0")
    assert resources.resolve_node(old).ok is False
    assert resources.resolve_node(current).ok is True
    monkeypatch.delenv(resources.NODE_ENV, raising=False)
    monkeypatch.setenv("PATH", "")
    missing = resources.resolve_node()
    assert missing.ok is False
    assert "no trusted executable" in missing.message


def test_missing_node_prevents_only_lazy_pigent_start(tmp_path, monkeypatch):
    host = tmp_path / "host.mjs"
    host.write_text("", encoding="utf-8")
    monkeypatch.delenv(resources.NODE_ENV, raising=False)
    monkeypatch.setenv("PATH", "")
    manager = PigentManager(tmp_path, "workspace", user_config_dir=tmp_path / "config", host_entry=host)
    with pytest.raises(PigentUnavailable, match="no trusted executable"):
        manager.validate()
    assert manager.process is None


def test_console_launcher_and_hatch_payload_hook_are_declared():
    metadata = tomllib.loads((REPOSITORY / "pyproject.toml").read_text(encoding="utf-8"))
    assert metadata["project"]["scripts"]["pigent"] == "pipyter.pigent.cli:main"
    assert metadata["tool"]["hatch"]["build"]["hooks"]["custom"]["path"] == "scripts/hatch_build.py"
    assert "/packages/pigent" in metadata["tool"]["hatch"]["build"]["targets"]["sdist"]["include"]
