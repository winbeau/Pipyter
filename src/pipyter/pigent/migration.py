from __future__ import annotations

import base64
import hashlib
import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .config import PigentConfigError, PigentConfigStore, _contains_forbidden_setting
from .migration_helper import REMOTE_ENVELOPE_VERSION, REMOTE_HELPER_SOURCE, REMOTE_HELPER_VERSION


class PigentMigrationError(ValueError):
    pass


def _validate_source_alias(value: str) -> str:
    if not value or len(value) > 255 or value.startswith("-") or any(ord(char) < 32 for char in value):
        raise PigentMigrationError("config_migration_invalid_source: invalid SSH source alias")
    return value


def _public_endpoint(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    return {key: value.get(key) for key in ("scheme", "host", "port", "path_configured")}


def _token(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return "preview_" + base64.urlsafe_b64encode(hashlib.sha256(raw).digest()).decode().rstrip("=")


@dataclass(frozen=True, slots=True)
class MigrationPreview:
    source: str
    provider: str
    default_provider: str | None
    default_model: str | None
    default_thinking_level: str | None
    provider_ids: tuple[str, ...]
    credential_kind: str
    endpoint: dict[str, Any] | None
    settings_mode: int
    auth_mode: int
    local_destination: str
    local_settings_revision: str
    local_auth_revision: str
    settings_action: str
    auth_action: str
    preview_token: str
    warnings: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "provider": self.provider,
            "default_provider": self.default_provider,
            "default_model": self.default_model,
            "default_thinking_level": self.default_thinking_level,
            "provider_ids": list(self.provider_ids),
            "credential_kind": self.credential_kind,
            "endpoint": self.endpoint,
            "settings_mode": oct(self.settings_mode),
            "auth_mode": oct(self.auth_mode),
            "local_destination": self.local_destination,
            "local_settings_revision": self.local_settings_revision,
            "local_auth_revision": self.local_auth_revision,
            "settings_action": self.settings_action,
            "auth_action": self.auth_action,
            "preview_token": self.preview_token,
            "warnings": list(self.warnings),
        }


class SshHelperRunner:
    def __call__(self, source: str, provider: str, mode: str, source_config_dir: str | None = None) -> dict[str, Any]:
        source = _validate_source_alias(source)
        request = {"version": 1, "mode": mode, "provider": provider, "config_dir": source_config_dir}
        # The remote argv is fixed. Request data and helper code share stdin;
        # no secret or user value enters argv or a remote shell expression.
        remote_request = json.dumps(request, ensure_ascii=True, separators=(",", ":"))
        program = f"PIGENT_MIGRATION_REQUEST = {remote_request!r}\n" + REMOTE_HELPER_SOURCE
        # Login-shell PATHs commonly contain the remote Python installation
        # (for example Conda on GPU hosts) while the fixed non-interactive SSH
        # PATH does not. The command remains fixed; no request value is placed
        # in the shell string or argv after the source alias.
        argv = ["ssh", source, "bash -lc 'exec python3 -'"]
        try:
            completed = subprocess.run(
                argv,
                input=program,
                text=True,
                capture_output=True,
                check=False,
                timeout=30,
                shell=False,
            )
        except (OSError, subprocess.SubprocessError) as error:
            raise PigentMigrationError("config_migration_invalid_source: SSH helper failed") from error
        if completed.returncode != 0:
            raise PigentMigrationError("config_migration_invalid_source: remote configuration could not be read")
        try:
            value = json.loads(completed.stdout)
        except json.JSONDecodeError as error:
            raise PigentMigrationError("config_migration_invalid_source: unsupported helper response") from error
        if not isinstance(value, dict) or value.get("version") != REMOTE_ENVELOPE_VERSION or value.get("helper_version") != REMOTE_HELPER_VERSION:
            raise PigentMigrationError("config_migration_invalid_source: unsupported helper version")
        return value


class PigentConfigMigrationService:
    def __init__(self, store: PigentConfigStore, runner: Callable[[str, str, str, str | None], dict[str, Any]] | None = None):
        self.store = store
        self.runner = runner or SshHelperRunner()
        self._previews: dict[str, tuple[MigrationPreview, dict[str, Any]]] = {}

    def _preview(self, source: str, provider: str, envelope: dict[str, Any]) -> MigrationPreview:
        settings, auth = self.store.read_pair()
        if envelope.get("provider") != provider:
            raise PigentMigrationError("config_migration_invalid_source: provider mismatch")
        if envelope.get("default_provider") != provider or not isinstance(envelope.get("default_model"), str):
            raise PigentMigrationError("config_migration_invalid_source: selected provider is not the remote default")
        credential_kind = str(envelope.get("credential_kind") or "missing")
        warnings: list[str] = []
        if credential_kind == "command_reference":
            warnings.append("Command credential references are not executable during migration")
        if credential_kind in {"missing", "environment_reference", "command_reference"}:
            warnings.append("Apply may be blocked until the credential is locally usable")
        facts = {
            "source": source,
            "provider": provider,
            "remote_default": [envelope.get("default_provider"), envelope.get("default_model")],
            "remote_modes": [envelope.get("settings_mode"), envelope.get("auth_mode")],
            "local_revisions": [settings.revision, auth.revision],
            "credential_kind": credential_kind,
            "endpoint": _public_endpoint(envelope.get("endpoint")),
            "provider_definition_fingerprint": envelope.get("provider_definition_fingerprint"),
            "provider_auth_fingerprint": envelope.get("provider_auth_fingerprint"),
        }
        preview = MigrationPreview(
            source=source,
            provider=provider,
            default_provider=envelope.get("default_provider"),
            default_model=envelope.get("default_model"),
            default_thinking_level=envelope.get("default_thinking_level"),
            provider_ids=tuple(str(item) for item in envelope.get("provider_ids") or ()),
            credential_kind=credential_kind,
            endpoint=_public_endpoint(envelope.get("endpoint")),
            settings_mode=int(envelope.get("settings_mode") or 0),
            auth_mode=int(envelope.get("auth_mode") or 0),
            local_destination="user Pigent config",
            local_settings_revision=settings.revision,
            local_auth_revision=auth.revision,
            settings_action="merge_default_and_provider_definition",
            auth_action="replace_selected_provider" if provider in auth.value else "create_selected_provider",
            preview_token=_token(facts),
            warnings=tuple(warnings),
        )
        return preview

    def preview_ssh(self, source: str, provider: str, source_config_dir: str | None = None) -> MigrationPreview:
        source = _validate_source_alias(source)
        envelope = self.runner(source, provider, "preview", source_config_dir)
        preview = self._preview(source, provider, envelope)
        self._previews[preview.preview_token] = (preview, {"source_config_dir": source_config_dir})
        return preview

    def apply_ssh(
        self,
        source: str,
        provider: str,
        *,
        preview_token: str | None = None,
        source_config_dir: str | None = None,
    ) -> dict[str, Any]:
        source = _validate_source_alias(source)
        if preview_token is None or preview_token not in self._previews:
            preview = self.preview_ssh(source, provider, source_config_dir)
        else:
            preview, metadata = self._previews[preview_token]
            if preview.source != source or preview.provider != provider:
                raise PigentMigrationError("config_migration_conflict: preview source changed")
            source_config_dir = metadata.get("source_config_dir")
        envelope = self.runner(source, provider, "apply", source_config_dir)
        fresh = self._preview(source, provider, envelope)
        if fresh.preview_token != preview.preview_token:
            raise PigentMigrationError("config_migration_conflict: source or local configuration changed after preview")
        provider_auth = envelope.get("provider_auth")
        if not isinstance(provider_auth, dict):
            raise PigentMigrationError("config_migration_invalid_source: selected provider credential missing")
        if fresh.credential_kind in {"environment_reference", "command_reference", "missing"}:
            raise PigentMigrationError("config_migration_invalid_source: selected credential is not independently usable locally")
        settings, auth = self.store.read_pair()
        new_settings = dict(settings.value)
        new_settings["defaultProvider"] = provider
        new_settings["defaultModel"] = fresh.default_model
        if fresh.default_thinking_level:
            new_settings["defaultThinkingLevel"] = fresh.default_thinking_level
        definition = envelope.get("provider_definition")
        if isinstance(definition, dict):
            models = dict(new_settings.get("models") or {})
            providers = dict(models.get("providers") or {})
            providers[provider] = definition
            models["providers"] = providers
            new_settings["models"] = models
        if _contains_forbidden_setting(new_settings):
            raise PigentMigrationError("config_migration_invalid_source: remote settings contain secret or endpoint fields")
        new_auth = dict(auth.value)
        new_auth[provider] = provider_auth
        result = self.store.write_pair(
            new_settings,
            new_auth,
            expected_settings_revision=settings.revision,
            expected_auth_revision=auth.revision,
            source={"kind": "ssh", "alias": source, "providers": [provider], "helper_version": REMOTE_HELPER_VERSION},
        )
        self.store.resolve_model()
        return {
            "migration_id": result["migration_id"],
            "provider": provider,
            "model": fresh.default_model,
            "settings_revision": result["settings_revision"],
            "auth_revision": result["auth_revision"],
            "backup_id": Path(result["backup_dir"]).name,
            "rollback_command": f"pigent config rollback {result['migration_id']}",
        }

    def rollback(self, migration_id: str, *, force: bool = False) -> dict[str, Any]:
        result = self.store.rollback(migration_id, force=force)
        return {
            "migration_id": result["migration_id"],
            "settings_revision": result["settings_revision"],
            "auth_revision": result["auth_revision"],
            "backup_id": Path(result["backup_dir"]).name,
        }
