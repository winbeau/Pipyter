from __future__ import annotations

import json
import os
import threading
from pathlib import Path

import pytest

from pipyter.pigent.config import PIGENT_UI_MODELS, PigentConfigError, PigentConfigStore


def test_two_file_initialization_and_permissions(tmp_path):
    store = PigentConfigStore(tmp_path / "pipyter")
    store.initialize()
    assert store.settings_path.read_text() == '{\n  "version": 1\n}\n'
    assert store.auth_path.read_text() == '{}\n'
    if os.name == "posix":
        assert store.directory.stat().st_mode & 0o777 == 0o700
        assert store.settings_path.stat().st_mode & 0o777 == 0o600
        assert store.auth_path.stat().st_mode & 0o777 == 0o600
    assert {path.name for path in store.directory.iterdir()} == {"settings.json", "auth.json"}
    assert not (store.directory / "models.json").exists()
    assert not (store.directory / "models-store.json").exists()


def test_atomic_revision_write_and_sanitized_auth(tmp_path):
    store = PigentConfigStore(tmp_path)
    settings = store.read_settings()
    written = store.write_settings({"version": 1, "defaultProvider": "faux", "defaultModel": "test"}, settings.revision)
    assert written.revision != settings.revision
    auth = store.read_auth()
    store.write_auth({"faux": {"type": "api_key", "baseUrl": "https://example.test", "key": "secret"}}, auth.revision)
    value = store.sanitized()
    assert "secret" not in json.dumps(value)
    assert value["providers"][0]["configured"] is True
    with pytest.raises(PigentConfigError, match="revision conflict"):
        store.write_settings({"version": 1}, settings.revision)


def test_settings_rejects_secret_and_endpoint_aliases(tmp_path):
    store = PigentConfigStore(tmp_path)
    for key in ("api_key", "APIKey", "token", "password", "authorization", "headers", "endpoint"):
        with pytest.raises(PigentConfigError, match="secret/endpoint"):
            store.write_settings({"version": 1, "models": {"providers": {"custom": {key: "secret"}}}})
    store.write_settings({
        "version": 1,
        "models": {"providers": {"custom": {"models": [{"id": "m", "maxTokens": 1024}]}}},
    })


def test_concurrent_compare_and_swap_does_not_silently_lose_an_update(tmp_path):
    store = PigentConfigStore(tmp_path)
    original = store.read_settings()
    barrier = threading.Barrier(2)
    outcomes: list[str] = []

    def writer(model: str) -> None:
        barrier.wait()
        try:
            store.write_settings(
                {"version": 1, "defaultProvider": "faux", "defaultModel": model},
                original.revision,
            )
            outcomes.append("written")
        except PigentConfigError:
            outcomes.append("conflict")

    threads = [threading.Thread(target=writer, args=(model,)) for model in ("one", "two")]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(outcomes) == ["conflict", "written"]
    assert store.read_settings().value["defaultModel"] in {"one", "two"}
    assert {path.name for path in store.directory.iterdir()} == {"settings.json", "auth.json"}


def test_malformed_file_is_preserved_byte_for_byte(tmp_path):
    store = PigentConfigStore(tmp_path)
    store.initialize()
    malformed = b'{"version":\n'
    store.settings_path.write_bytes(malformed)
    with pytest.raises(PigentConfigError, match="malformed JSON"):
        store.read_settings()
    assert store.settings_path.read_bytes() == malformed
    assert store.auth_path.exists()


def test_missing_default_provider_requires_configuration(tmp_path):
    store = PigentConfigStore(tmp_path)
    store.initialize()
    with pytest.raises(PigentConfigError, match="model_configuration_required"):
        store.resolve_model()


def test_model_resolution_is_strict_and_ignores_legacy_files(tmp_path, monkeypatch):
    store = PigentConfigStore(tmp_path)
    store.initialize()
    store.write_settings({
        "version": 1,
        "defaultProvider": "custom",
        "defaultModel": "selected",
        "models": {"providers": {"custom": {"api": "openai-responses", "models": [{"id": "other"}]}}},
    })
    store.write_auth({"custom": {"type": "api_key", "baseUrl": "https://example.test", "key": "literal"}})
    with pytest.raises(PigentConfigError, match="model_configuration_required"):
        store.resolve_model()

    store.write_settings({
        "version": 1,
        "defaultProvider": "custom",
        "defaultModel": "selected",
        "models": {"providers": {"custom": {"api": "openai-responses", "models": [{"id": "selected"}]}}},
    })
    store.write_auth({"custom": {"type": "api_key", "baseUrl": "https://example.test", "key": "${PIGENT_TEST_KEY}"}})
    monkeypatch.delenv("PIGENT_TEST_KEY", raising=False)
    with pytest.raises(PigentConfigError, match="model_configuration_required"):
        store.resolve_model()
    monkeypatch.setenv("PIGENT_TEST_KEY", "available")
    assert store.resolve_model() == {"provider": "custom", "model": "selected", "baseUrl": "https://example.test"}

    legacy = tmp_path / ".beaupi"
    legacy.mkdir()
    (legacy / "settings.json").write_text('{"defaultProvider":"wrong","defaultModel":"wrong"}', encoding="utf-8")
    (store.directory / "models.json").write_text('{"wrong":true}', encoding="utf-8")
    (store.directory / "models-store.json").write_text('{"wrong":true}', encoding="utf-8")
    assert store.resolve_model()["model"] == "selected"


def test_ui_model_selection_is_catalog_driven_revisioned_and_uses_only_two_files(tmp_path):
    store = PigentConfigStore(tmp_path)
    store.write_settings({"version": 1, "defaultProvider": "deepseek", "defaultModel": "deepseek-v4-flash"})
    store.write_auth({
        "deepseek": {"type": "api_key", "baseUrl": "https://deepseek.test", "key": "secret-deepseek"},
        "openai": {"type": "api_key", "baseUrl": "https://openai.test", "key": "secret-openai"},
    })
    state = store.ui_model_state()
    assert {(item["provider"], item["model"]) for item in state["models"]} == {
        (item["provider"], item["model"]) for item in PIGENT_UI_MODELS
    }
    assert all(item["configured"] for item in state["models"])
    assert "secret-" not in json.dumps(state)

    written, resolved = store.select_ui_model("deepseek", "deepseek-v4-pro", state["settings_revision"])
    assert resolved == {"provider": "deepseek", "model": "deepseek-v4-pro", "baseUrl": "https://deepseek.test"}
    assert store.read_settings().value["defaultModel"] == "deepseek-v4-pro"
    assert written.revision != state["settings_revision"]
    with pytest.raises(PigentConfigError, match="model_configuration_required"):
        store.select_ui_model("custom", "anything", written.revision)
    assert {path.name for path in store.directory.iterdir()} == {"settings.json", "auth.json"}


def test_model_catalog_preserves_official_builtin_ids_and_custom_names(tmp_path):
    store = PigentConfigStore(tmp_path)
    store.write_settings({
        "version": 1,
        "defaultProvider": "deepseek",
        "defaultModel": "deepseek-v4-flash",
        "models": {"providers": {
            "deepseek": {"models": [
                {"id": "deepseek-v4-flash", "name": "ds-v4-flash"},
                {"id": "deepseek-v4-pro", "name": "pro"},
                {"id": "private-research", "name": "Research Preview"},
            ]},
            "openai": {"models": [
                {"id": "gpt-5.6-sol", "name": "sol"},
                {"id": "gpt-5.6-terra", "name": "terra"},
            ]},
        }},
    })
    catalog = {(item["provider"], item["model"]): item for item in store.model_catalog()}

    for item in PIGENT_UI_MODELS:
        listed = catalog[(item["provider"], item["model"])]
        assert listed["id"] == item["model"]
        assert listed["label"] == item["model"]
    custom = catalog[("deepseek", "private-research")]
    assert custom["id"] == "Research Preview"
    assert custom["label"] == "Research Preview"
