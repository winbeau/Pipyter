from __future__ import annotations

import json
import os
from pathlib import Path
import threading
import time

import pytest

from pipyter.pigent.config import PigentConfigError, PigentConfigStore
from pipyter.pigent.migration import PigentConfigMigrationService, PigentMigrationError, SshHelperRunner


SECRET = "fixture-secret-never-print"


def _fingerprint(value: object) -> str:
    import hashlib
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def _envelope(mode: str, *, provider: str = "deepseek", credential_kind: str = "literal") -> dict:
    definition = {"api": "openai-completions", "models": [{"id": "deepseek-v4-flash"}]}
    provider_auth = {"type": "api_key", "baseUrl": "https://api.deepseek.test/tenant-secret/v1", "key": SECRET}
    value = {
        "version": 1,
        "helper_version": 1,
        "source_version": "0.1.4",
        "provider": provider,
        "settings_mode": 0o600,
        "auth_mode": 0o600,
        "default_provider": provider,
        "default_model": "deepseek-v4-flash",
        "default_thinking_level": "medium",
        "provider_ids": ["deepseek", "openai"],
        "provider_definition": definition,
        "provider_definition_fingerprint": _fingerprint(definition),
        "provider_auth_fingerprint": _fingerprint(provider_auth),
        "credential_kind": credential_kind,
        "endpoint": {"scheme": "https", "host": "api.deepseek.test", "port": None, "path_configured": True},
    }
    if mode == "apply":
        value["provider_auth"] = provider_auth
    return value


class FakeRunner:
    def __init__(self, *, credential_kind: str = "literal"):
        self.calls = []
        self.credential_kind = credential_kind

    def __call__(self, source, provider, mode, source_config_dir=None):
        self.calls.append((source, provider, mode, source_config_dir))
        return _envelope(mode, provider=provider, credential_kind=self.credential_kind)


def _local(store: PigentConfigStore) -> None:
    store.write_settings({"version": 1, "defaultProvider": "custom", "defaultModel": "local"})
    store.write_auth({"custom": {"type": "api_key", "baseUrl": "https://local.test", "key": "local-secret"}})


def test_preview_is_provider_scoped_and_fully_redacted(tmp_path):
    store = PigentConfigStore(tmp_path)
    _local(store)
    runner = FakeRunner()
    preview = PigentConfigMigrationService(store, runner).preview_ssh("autodl", "deepseek")
    public = preview.as_dict()
    text = json.dumps(public)
    assert SECRET not in text and "local-secret" not in text
    assert public["provider"] == "deepseek"
    assert public["provider_ids"] == ["deepseek", "openai"]
    assert public["credential_kind"] == "literal"
    assert public["endpoint"] == {"scheme": "https", "host": "api.deepseek.test", "port": None, "path_configured": True}
    assert "tenant-secret" not in text
    assert runner.calls == [("autodl", "deepseek", "preview", None)]


def test_apply_merges_only_deepseek_and_creates_private_backup(tmp_path):
    store = PigentConfigStore(tmp_path)
    _local(store)
    service = PigentConfigMigrationService(store, FakeRunner())
    preview = service.preview_ssh("autodl", "deepseek")
    result = service.apply_ssh("autodl", "deepseek", preview_token=preview.preview_token)
    settings, auth = store.read_pair()
    assert settings.value["defaultProvider"] == "deepseek"
    assert settings.value["defaultModel"] == "deepseek-v4-flash"
    assert set(auth.value) == {"custom", "deepseek"}
    assert "openai" not in auth.value
    assert auth.value["deepseek"]["key"] == SECRET
    backup = store.backup_root / result["backup_id"]
    assert backup.is_dir()
    if os.name == "posix":
        assert backup.stat().st_mode & 0o777 == 0o700
        assert all(path.stat().st_mode & 0o777 == 0o600 for path in backup.iterdir())
    public = json.dumps(result)
    assert SECRET not in public and "local-secret" not in public
    assert str(store.backup_root) not in public


def test_rollback_restores_pair_and_conflict_is_safe(tmp_path):
    store = PigentConfigStore(tmp_path)
    _local(store)
    service = PigentConfigMigrationService(store, FakeRunner())
    result = service.apply_ssh("autodl", "deepseek")
    rolled = service.rollback(result["migration_id"])
    assert store.read_settings().value["defaultProvider"] == "custom"
    assert set(store.read_auth().value) == {"custom"}
    assert rolled["migration_id"].startswith("rollback_")

    result = service.apply_ssh("autodl", "deepseek")
    settings = store.read_settings()
    store.write_settings({**settings.value, "defaultThinkingLevel": "high"}, settings.revision)
    with pytest.raises(PigentConfigError, match="config_migration_conflict"):
        service.rollback(result["migration_id"])


def test_interrupted_pair_transaction_recovers_original_bytes(tmp_path):
    store = PigentConfigStore(tmp_path)
    _local(store)
    before_settings = store.settings_path.read_bytes()
    before_auth = store.auth_path.read_bytes()
    settings, auth = store.read_pair()
    with pytest.raises(RuntimeError, match="simulated"):
        store.write_pair(
            {"version": 1, "defaultProvider": "deepseek", "defaultModel": "m"},
            {"deepseek": {"key": SECRET}},
            expected_settings_revision=settings.revision,
            expected_auth_revision=auth.revision,
            migration_id="mig_interrupt",
            fail_after="auth_replaced",
        )
    assert store.auth_path.read_bytes() != before_auth
    store.recover_transactions()
    assert store.settings_path.read_bytes() == before_settings
    assert store.auth_path.read_bytes() == before_auth


def test_preview_token_detects_changed_provider_definition_or_credential(tmp_path):
    store = PigentConfigStore(tmp_path)
    _local(store)

    class ChangingRunner(FakeRunner):
        def __init__(self, field: str):
            super().__init__()
            self.field = field

        def __call__(self, source, provider, mode, source_config_dir=None):
            value = super().__call__(source, provider, mode, source_config_dir)
            if mode == "apply":
                value[self.field] = "sha256:" + "f" * 64
            return value

    for field in ("provider_definition_fingerprint", "provider_auth_fingerprint"):
        service = PigentConfigMigrationService(store, ChangingRunner(field))
        preview = service.preview_ssh("autodl", "deepseek")
        with pytest.raises(PigentMigrationError, match="changed after preview"):
            service.apply_ssh("autodl", "deepseek", preview_token=preview.preview_token)


def test_recovery_waits_for_active_pair_transaction_lock(tmp_path, monkeypatch):
    store = PigentConfigStore(tmp_path)
    _local(store)
    settings, auth = store.read_pair()
    import pipyter.pigent.config as config_module

    original = config_module._atomic_write
    journal_written = threading.Event()
    release_writer = threading.Event()

    def paused(path, value):
        result = original(path, value)
        if path.parent == store.transaction_root and value.get("state") == "prepared":
            journal_written.set()
            release_writer.wait(5)
        return result

    monkeypatch.setattr(config_module, "_atomic_write", paused)
    errors: list[BaseException] = []

    def writer():
        try:
            store.write_pair(
                {"version": 1, "defaultProvider": "deepseek", "defaultModel": "deepseek-v4-flash"},
                {"deepseek": {"type": "api_key", "key": SECRET}},
                expected_settings_revision=settings.revision,
                expected_auth_revision=auth.revision,
            )
        except BaseException as error:
            errors.append(error)

    worker = threading.Thread(target=writer)
    worker.start()
    assert journal_written.wait(5)
    recovered = threading.Event()
    reader = threading.Thread(target=lambda: (PigentConfigStore(tmp_path).initialize(), recovered.set()))
    reader.start()
    time.sleep(0.1)
    assert not recovered.is_set()
    release_writer.set()
    worker.join(5); reader.join(5)
    assert not errors and recovered.is_set()
    pair = store.read_pair()
    assert pair[0].value["defaultProvider"] == "deepseek"
    assert pair[1].value["deepseek"]["key"] == SECRET


def test_environment_or_command_reference_is_blocked(tmp_path):
    store = PigentConfigStore(tmp_path)
    _local(store)
    for kind in ("environment_reference", "command_reference", "missing"):
        service = PigentConfigMigrationService(store, FakeRunner(credential_kind=kind))
        preview = service.preview_ssh("autodl", "deepseek")
        assert preview.warnings
        with pytest.raises(PigentMigrationError, match="not independently usable"):
            service.apply_ssh("autodl", "deepseek", preview_token=preview.preview_token)


def test_ssh_runner_uses_fixed_argv_stdin_and_redacts_failures(monkeypatch):
    captured = {}

    class Completed:
        returncode = 0
        stdout = json.dumps(_envelope("preview"))
        stderr = SECRET

    def fake_run(argv, **kwargs):
        captured["argv"] = argv
        captured.update(kwargs)
        return Completed()

    monkeypatch.setattr("subprocess.run", fake_run)
    value = SshHelperRunner()("autodl", "deepseek", "preview")
    assert captured["argv"] == ["ssh", "autodl", "bash -lc 'exec python3 -'"]
    assert captured["shell"] is False
    assert "PIGENT_MIGRATION_REQUEST" in captured["input"]
    assert SECRET not in json.dumps(value)

    with pytest.raises(PigentMigrationError, match="invalid SSH source"):
        SshHelperRunner()("-oProxyCommand=bad", "deepseek", "preview")
