from __future__ import annotations

import hashlib
import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows
    fcntl = None  # type: ignore[assignment]


class PigentConfigError(ValueError):
    def __init__(self, path: Path, message: str):
        super().__init__(f"{path.name}: {message}")
        self.path = path


_FORBIDDEN_SETTING_KEYS = {
    "baseurl", "apiurl", "endpoint", "apiendpoint", "apikey", "key", "token",
    "accesstoken", "refreshtoken", "password", "authorization", "headers",
    "secretheaders", "credential", "credentials", "clientsecret",
}

PIGENT_BUILTIN_MODELS: tuple[dict[str, str], ...] = (
    {"id": "deepseek-v4-flash", "label": "deepseek-v4-flash", "provider": "deepseek", "model": "deepseek-v4-flash"},
    {"id": "deepseek-v4-pro", "label": "deepseek-v4-pro", "provider": "deepseek", "model": "deepseek-v4-pro"},
    {"id": "gpt-5.6-luna", "label": "gpt-5.6-luna", "provider": "openai", "model": "gpt-5.6-luna"},
    {"id": "gpt-5.6-sol", "label": "gpt-5.6-sol", "provider": "openai", "model": "gpt-5.6-sol"},
    {"id": "gpt-5.6-terra", "label": "gpt-5.6-terra", "provider": "openai", "model": "gpt-5.6-terra"},
)
PIGENT_UI_MODELS = PIGENT_BUILTIN_MODELS  # compatibility display catalog, not selection authority


def _contains_forbidden_setting(value: Any) -> bool:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = "".join(character for character in str(key).lower() if character.isalnum())
            if (
                normalized in _FORBIDDEN_SETTING_KEYS
                or normalized.startswith("secret")
                or normalized.endswith(("apikey", "accesstoken", "refreshtoken", "password", "credential"))
            ):
                return True
            if _contains_forbidden_setting(child):
                return True
        return False
    return isinstance(value, list) and any(_contains_forbidden_setting(item) for item in value)


def pipyter_config_root(config_root: str | os.PathLike[str] | None = None) -> Path:
    if config_root is not None:
        root = Path(config_root).expanduser()
    elif os.environ.get("PIPYTER_CONFIG_HOME"):
        root = Path(os.environ["PIPYTER_CONFIG_HOME"]).expanduser()
    elif os.environ.get("XDG_CONFIG_HOME"):
        root = Path(os.environ["XDG_CONFIG_HOME"]).expanduser() / "pipyter"
    else:
        root = Path.home() / ".config" / "pipyter"
    return root.resolve()


def pigent_config_dir(config_root: str | os.PathLike[str] | None = None) -> Path:
    return pipyter_config_root(config_root) / "pigent"


def _revision(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


@contextmanager
def _locked(directory: Path) -> Iterator[None]:
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(directory.parent, 0o700)
    os.chmod(directory, 0o700)
    # Lock the configuration directory itself so initialization leaves exactly
    # settings.json and auth.json behind. POSIX flock applies to the open
    # directory description and serializes both initialization and replacement.
    descriptor = os.open(directory, os.O_RDONLY)
    try:
        if fcntl is not None:
            fcntl.flock(descriptor, fcntl.LOCK_EX)
        yield
    finally:
        if fcntl is not None:
            fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)


def _encode(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def _atomic_write(path: Path, value: dict[str, Any]) -> str:
    payload = _encode(value)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
        os.chmod(path, 0o600)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return _revision(payload)


@dataclass(frozen=True, slots=True)
class ConfigDocument:
    path: Path
    value: dict[str, Any]
    revision: str


class PigentConfigStore:
    """Sole owner of Pigent's two persistent model-configuration files."""

    def __init__(self, config_root: str | os.PathLike[str] | None = None):
        self.root = pipyter_config_root(config_root)
        self.directory = self.root / "pigent"
        self.backup_root = self.root / "backups" / "pigent"
        self.transaction_root = self.root / "transactions" / "pigent"
        self.settings_path = self.directory / "settings.json"
        self.auth_path = self.directory / "auth.json"

    def initialize(self) -> None:
        # Recovery and normal reads/writes share one directory lock. Otherwise
        # a second process could roll back a prepared journal while its writer
        # is still replacing the pair.
        with _locked(self.directory):
            self._recover_transactions_locked()
            for path, initial in ((self.settings_path, {"version": 1}), (self.auth_path, {})):
                if not path.exists():
                    _atomic_write(path, initial)
                else:
                    os.chmod(path, 0o600)

    def _read(self, path: Path) -> ConfigDocument:
        self.initialize()
        data = path.read_bytes()
        try:
            value = json.loads(data)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise PigentConfigError(path, f"malformed JSON ({error})") from error
        if not isinstance(value, dict):
            raise PigentConfigError(path, "expected a JSON object")
        return ConfigDocument(path, value, _revision(data))

    def read_settings(self) -> ConfigDocument:
        document = self._read(self.settings_path)
        if _contains_forbidden_setting(document.value):
            raise PigentConfigError(document.path, "settings.json contains secret/endpoint fields")
        return document

    def read_auth(self) -> ConfigDocument:
        return self._read(self.auth_path)

    def _write(self, path: Path, value: dict[str, Any], expected_revision: str | None) -> ConfigDocument:
        with _locked(self.directory):
            if path.exists() and expected_revision is not None:
                actual = _revision(path.read_bytes())
                if actual != expected_revision:
                    raise PigentConfigError(path, f"revision conflict: expected {expected_revision}, current {actual}")
            revision = _atomic_write(path, value)
        return ConfigDocument(path, value, revision)

    def write_settings(self, value: dict[str, Any], expected_revision: str | None = None) -> ConfigDocument:
        if _contains_forbidden_setting(value):
            raise PigentConfigError(self.settings_path, "settings.json contains secret/endpoint fields")
        return self._write(self.settings_path, value, expected_revision)

    def write_auth(self, value: dict[str, Any], expected_revision: str | None = None) -> ConfigDocument:
        return self._write(self.auth_path, value, expected_revision)

    def read_pair(self) -> tuple[ConfigDocument, ConfigDocument]:
        return self.read_settings(), self.read_auth()

    @staticmethod
    def _private_directory(path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(path, 0o700)

    def write_pair(
        self,
        settings: dict[str, Any],
        auth: dict[str, Any],
        *,
        expected_settings_revision: str,
        expected_auth_revision: str,
        migration_id: str | None = None,
        source: dict[str, Any] | None = None,
        fail_after: str | None = None,
    ) -> dict[str, Any]:
        if _contains_forbidden_setting(settings):
            raise PigentConfigError(self.settings_path, "settings.json contains secret/endpoint fields")
        self.initialize()
        migration_id = migration_id or f"mig_{uuid.uuid4().hex}"
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_dir = self.backup_root / f"{timestamp}-{migration_id}"
        journal_path = self.transaction_root / f"{migration_id}.json"
        self._private_directory(self.backup_root)
        self._private_directory(self.transaction_root)
        with _locked(self.directory):
            actual_settings = _revision(self.settings_path.read_bytes())
            actual_auth = _revision(self.auth_path.read_bytes())
            if actual_settings != expected_settings_revision or actual_auth != expected_auth_revision:
                raise PigentConfigError(self.directory, "config_migration_conflict: local revisions changed")
            self._private_directory(backup_dir)
            for source_path in (self.settings_path, self.auth_path):
                target = backup_dir / source_path.name
                target.write_bytes(source_path.read_bytes())
                os.chmod(target, 0o600)
            staged_settings = self.directory / f".settings.{migration_id}.staged"
            staged_auth = self.directory / f".auth.{migration_id}.staged"
            for path, value in ((staged_settings, settings), (staged_auth, auth)):
                payload = _encode(value)
                path.write_bytes(payload)
                os.chmod(path, 0o600)
                with path.open("rb") as handle:
                    os.fsync(handle.fileno())
            manifest = {
                "version": 1,
                "migration_id": migration_id,
                "state": "prepared",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "backup_dir": str(backup_dir),
                "staged_settings": str(staged_settings),
                "staged_auth": str(staged_auth),
                "expected_settings_revision": expected_settings_revision,
                "expected_auth_revision": expected_auth_revision,
                "target_settings_revision": _revision(staged_settings.read_bytes()),
                "target_auth_revision": _revision(staged_auth.read_bytes()),
                "source": source or {},
            }
            _atomic_write(journal_path, manifest)
            _atomic_write(backup_dir / "manifest.json", {k: v for k, v in manifest.items() if k not in {"staged_settings", "staged_auth"}})
            if fail_after == "prepared":
                raise RuntimeError("simulated transaction interruption after prepared")
            os.replace(staged_auth, self.auth_path)
            os.chmod(self.auth_path, 0o600)
            manifest["state"] = "auth_replaced"
            _atomic_write(journal_path, manifest)
            if fail_after == "auth_replaced":
                raise RuntimeError("simulated transaction interruption after auth replace")
            os.replace(staged_settings, self.settings_path)
            os.chmod(self.settings_path, 0o600)
            manifest["state"] = "committed"
            _atomic_write(journal_path, manifest)
            # Validate the pair before removing the journal.
            json.loads(self.settings_path.read_text(encoding="utf-8"))
            json.loads(self.auth_path.read_text(encoding="utf-8"))
            journal_path.unlink(missing_ok=True)
            return {
                "migration_id": migration_id,
                "backup_dir": backup_dir,
                "settings_revision": _revision(self.settings_path.read_bytes()),
                "auth_revision": _revision(self.auth_path.read_bytes()),
            }

    def _recover_transactions_locked(self) -> None:
        if not self.transaction_root.exists():
            return
        self._private_directory(self.transaction_root)
        for journal_path in sorted(self.transaction_root.glob("*.json")):
            try:
                manifest = json.loads(journal_path.read_text(encoding="utf-8"))
                backup_dir = Path(manifest["backup_dir"])
                if manifest.get("state") != "committed":
                    self._private_directory(self.directory)
                    for name, target in (("settings.json", self.settings_path), ("auth.json", self.auth_path)):
                        source = backup_dir / name
                        if source.is_file():
                            os.replace(source, target)
                            os.chmod(target, 0o600)
                for key in ("staged_settings", "staged_auth"):
                    raw = manifest.get(key)
                    if isinstance(raw, str):
                        Path(raw).unlink(missing_ok=True)
                journal_path.unlink(missing_ok=True)
            except Exception as error:
                raise PigentConfigError(journal_path, f"cannot recover config transaction ({error})") from error

    def recover_transactions(self) -> None:
        with _locked(self.directory):
            self._recover_transactions_locked()

    def rollback(self, migration_id: str, *, force: bool = False) -> dict[str, Any]:
        matches = sorted(self.backup_root.glob(f"*-{migration_id}")) if self.backup_root.exists() else []
        if len(matches) != 1:
            raise PigentConfigError(self.backup_root, "config_migration_invalid_source: migration backup not found")
        backup_dir = matches[0]
        manifest = json.loads((backup_dir / "manifest.json").read_text(encoding="utf-8"))
        current_settings, current_auth = self.read_pair()
        if not force and (
            current_settings.revision != manifest.get("target_settings_revision")
            or current_auth.revision != manifest.get("target_auth_revision")
        ):
            raise PigentConfigError(self.directory, "config_migration_conflict: active config changed after migration")
        settings = json.loads((backup_dir / "settings.json").read_text(encoding="utf-8"))
        auth = json.loads((backup_dir / "auth.json").read_text(encoding="utf-8"))
        return self.write_pair(
            settings, auth,
            expected_settings_revision=current_settings.revision,
            expected_auth_revision=current_auth.revision,
            migration_id=f"rollback_{migration_id}_{uuid.uuid4().hex[:8]}",
            source={"rollback_of": migration_id},
        )

    @staticmethod
    def _configured_secret(value: Any) -> bool:
        if not isinstance(value, str) or not value:
            return False
        if value.startswith("${") and value.endswith("}"):
            name = value[2:-1]
            return bool(name) and name.replace("_", "a").isalnum() and bool(os.environ.get(name))
        return True

    def _resolve_selection(
        self,
        settings: dict[str, Any],
        auth: dict[str, Any],
        provider: Any,
        model: Any,
    ) -> dict[str, Any]:
        if not isinstance(provider, str) or not provider or not isinstance(model, str) or not model:
            raise PigentConfigError(self.settings_path, "model_configuration_required")
        definitions = settings.get("models", {}).get("providers", {}) if isinstance(settings.get("models"), dict) else {}
        definition = definitions.get(provider) if isinstance(definitions, dict) else None
        if isinstance(definition, dict):
            models = definition.get("models")
            if not isinstance(models, list) or not any(isinstance(item, dict) and item.get("id") == model for item in models):
                raise PigentConfigError(self.settings_path, "model_configuration_required")
        entry = auth.get(provider)
        if provider != "faux":
            usable = isinstance(entry, dict) and (
                entry.get("type") == "keyless"
                or self._configured_secret(entry.get("key"))
                or self._configured_secret(entry.get("accessToken"))
                or self._configured_secret(entry.get("refreshToken"))
            )
            if not usable:
                raise PigentConfigError(self.auth_path, "model_configuration_required")
        return {"provider": provider, "model": model, "baseUrl": entry.get("baseUrl") if isinstance(entry, dict) else None}

    def resolve_selected_model(self, provider: str, model: str) -> dict[str, Any]:
        settings = self.read_settings().value
        auth = self.read_auth().value
        return self._resolve_selection(settings, auth, provider, model)

    def resolve_model(self) -> dict[str, Any]:
        settings = self.read_settings().value
        auth = self.read_auth().value
        return self._resolve_selection(settings, auth, settings.get("defaultProvider"), settings.get("defaultModel"))

    def select_ui_model(
        self,
        provider: str,
        model: str,
        expected_revision: str | None = None,
    ) -> tuple[ConfigDocument, dict[str, Any]]:
        settings = self.read_settings()
        auth = self.read_auth().value
        resolved = self._resolve_selection(settings.value, auth, provider, model)
        value = dict(settings.value)
        value.update({"defaultProvider": provider, "defaultModel": model})
        written = self.write_settings(value, expected_revision or settings.revision)
        return written, resolved

    def model_catalog(self) -> list[dict[str, Any]]:
        settings = self.read_settings().value
        definitions = settings.get("models", {}).get("providers", {}) if isinstance(settings.get("models"), dict) else {}
        by_pair: dict[tuple[str, str], dict[str, Any]] = {}
        for item in PIGENT_BUILTIN_MODELS:
            by_pair[(item["provider"], item["model"])] = dict(item)
        if isinstance(definitions, dict):
            for provider, raw in definitions.items():
                if not isinstance(provider, str) or not isinstance(raw, dict):
                    continue
                for model in raw.get("models", []) if isinstance(raw.get("models"), list) else []:
                    if not isinstance(model, dict) or not isinstance(model.get("id"), str):
                        continue
                    model_id = model["id"]
                    # Built-in product models always use their official model ID
                    # in the UI. Configured names remain available only for
                    # genuinely custom models.
                    if (provider, model_id) in by_pair:
                        continue
                    by_pair[(provider, model_id)] = {
                        "id": str(model.get("name") or model_id),
                        "label": str(model.get("name") or model_id),
                        "provider": provider,
                        "model": model_id,
                    }
        current_provider, current_model = settings.get("defaultProvider"), settings.get("defaultModel")
        if isinstance(current_provider, str) and isinstance(current_model, str):
            by_pair.setdefault((current_provider, current_model), {
                "id": current_model, "label": current_model, "provider": current_provider, "model": current_model,
            })
        return [by_pair[key] for key in sorted(by_pair)]

    def ui_model_state(self) -> dict[str, Any]:
        settings = self.read_settings()
        current = {"provider": settings.value.get("defaultProvider"), "model": settings.value.get("defaultModel")}
        choices = []
        for item in self.model_catalog():
            try:
                self.resolve_selected_model(item["provider"], item["model"])
                configured = True
            except PigentConfigError:
                configured = False
            choices.append({**item, "configured": configured})
        return {"model": current, "models": choices, "settings_revision": settings.revision}

    def sanitized(self) -> dict[str, Any]:
        settings = self.read_settings()
        auth = self.read_auth()
        providers = []
        for provider_id, raw in auth.value.items():
            if not isinstance(raw, dict):
                continue
            base_url = raw.get("baseUrl")
            providers.append({
                "provider_id": provider_id,
                "credential_type": raw.get("type"),
                "configured": bool(raw.get("key") or raw.get("accessToken") or raw.get("refreshToken")),
                "base_url_configured": isinstance(base_url, str) and bool(base_url),
            })
        return {
            "settings": settings.value,
            "settings_revision": settings.revision,
            "auth_revision": auth.revision,
            "providers": providers,
            "config_files": [self.settings_path.name, self.auth_path.name],
        }
