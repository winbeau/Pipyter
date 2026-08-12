from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from pipyter.pigent import resources
from pipyter.pigent.client import PigentProtocolError
from pipyter.pigent.manager import PigentManager
from pipyter.protocol.pigent import PIGENT_ACTION_FILTERS, PIGENT_CAPABILITIES, PIGENT_CATALOGS, PIGENT_EVENT_TYPES, PIGENT_TOOL_NAMES


def _handshake() -> dict:
    return {
        "protocol_version": "0.2",
        "tool_protocol_version": "0.2",
        "runtime_version": "0.3.0",
        "tools": list(PIGENT_TOOL_NAMES),
        "modes": {key: list(value) for key, value in PIGENT_CATALOGS.items()},
        "action_filters": {
            tool: {mode: list(actions) for mode, actions in by_mode.items()}
            for tool, by_mode in PIGENT_ACTION_FILTERS.items()
        },
        "capabilities": list(PIGENT_CAPABILITIES),
        "event_types": list(PIGENT_EVENT_TYPES),
    }


def test_handshake_intersection_is_authoritative():
    value = _handshake()
    value["capabilities"].remove("kernel.environment.manage")
    value["action_filters"]["kernel"]["auto"].remove("delete_environment")
    negotiated = PigentManager._validate_handshake(value)
    assert "kernel.environment.manage" not in negotiated["capabilities"]
    assert "delete_environment" not in negotiated["action_filters"]["kernel"]["auto"]
    assert negotiated["tools"] == list(PIGENT_TOOL_NAMES)


def test_old_or_incomplete_host_cannot_advertise_v02_actions():
    old = _handshake()
    old["protocol_version"] = old["tool_protocol_version"] = "0.1"
    with pytest.raises(PigentProtocolError, match="protocol mismatch"):
        PigentManager._validate_handshake(old)

    incomplete = _handshake()
    incomplete.pop("capabilities")
    with pytest.raises(PigentProtocolError, match="incomplete"):
        PigentManager._validate_handshake(incomplete)


def test_payload_manifest_protocol_metadata_is_enforced(tmp_path, monkeypatch):
    source = Path(__file__).parents[1] / "build" / "pigent-runtime"
    if not source.exists():
        pytest.skip("generated Pigent payload is not present")
    destination = tmp_path / "payload"
    destination.mkdir()
    manifest = json.loads((source / "manifest.json").read_text())
    manifest["host_protocol_version"] = "0.1"
    manifest["files"] = {"host.mjs": manifest["files"]["host.mjs"]}
    (destination / "manifest.json").write_text(json.dumps(manifest))
    (destination / "host.mjs").write_bytes((source / "host.mjs").read_bytes())
    monkeypatch.setenv(resources.PAYLOAD_ENV, str(destination))
    with pytest.raises(resources.PigentResourceError, match="payload_stale"):
        resources.verify_payload()


def test_source_mode_resolves_only_verified_repository_payload(monkeypatch):
    monkeypatch.delenv(resources.PAYLOAD_ENV, raising=False)
    assert resources.payload_root().name == "pigent-runtime"
    manifest = resources.verify_payload()
    assert manifest["schema_version"] == 2
    assert manifest["host_protocol_version"] == "0.2"
    assert manifest["tool_protocol_version"] == "0.2"


def test_built_payload_handshake_matches_manifest(tmp_path):
    async def scenario():
        from pipyter.pigent.config import PigentConfigStore

        config = PigentConfigStore(tmp_path / "config")
        config.write_settings({"version": 1, "defaultProvider": "faux", "defaultModel": "deterministic"})
        manager = PigentManager(tmp_path, "workspace", user_config_dir=config.directory,
                                bridge_endpoint="http://127.0.0.1:9/internal/pigent/v1")
        try:
            negotiated = await manager.negotiated_capabilities()
            assert negotiated["protocol_version"] == "0.2"
            assert negotiated["tools"] == list(PIGENT_TOOL_NAMES)
            assert negotiated["action_filters"]["kernel"]["auto"][-1] == "delete_environment"
        finally:
            await manager.shutdown()

    asyncio.run(scenario())
