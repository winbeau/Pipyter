from __future__ import annotations

import hashlib
import json
import os
import tempfile
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
        super().__init__(f"{path}: {message}")
        self.path = path


def pigent_config_dir(config_root: str | os.PathLike[str] | None = None) -> Path:
    if config_root is not None:
        root = Path(config_root).expanduser()
    elif os.environ.get("PIPYTER_CONFIG_HOME"):
        root = Path(os.environ["PIPYTER_CONFIG_HOME"]).expanduser()
    elif os.environ.get("XDG_CONFIG_HOME"):
        root = Path(os.environ["XDG_CONFIG_HOME"]).expanduser() / "pipyter"
    else:
        root = Path.home() / ".config" / "pipyter"
    return root.resolve() / "pigent"


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
        self.directory = pigent_config_dir(config_root)
        self.settings_path = self.directory / "settings.json"
        self.auth_path = self.directory / "auth.json"

    def initialize(self) -> None:
        with _locked(self.directory):
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
        forbidden = {"baseUrl", "apiKey", "key", "accessToken", "refreshToken", "secretHeaders"}
        def visit(value: Any) -> bool:
            if isinstance(value, dict):
                return any(key in forbidden or visit(item) for key, item in value.items())
            if isinstance(value, list):
                return any(visit(item) for item in value)
            return False
        if visit(document.value):
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
        forbidden = {"baseUrl", "apiKey", "key", "accessToken", "refreshToken", "secretHeaders"}
        def visit(item: Any) -> bool:
            if isinstance(item, dict):
                return any(key in forbidden or visit(child) for key, child in item.items())
            return isinstance(item, list) and any(visit(child) for child in item)
        if visit(value):
            raise PigentConfigError(self.settings_path, "settings.json contains secret/endpoint fields")
        return self._write(self.settings_path, value, expected_revision)

    def write_auth(self, value: dict[str, Any], expected_revision: str | None = None) -> ConfigDocument:
        return self._write(self.auth_path, value, expected_revision)

    @staticmethod
    def _configured_secret(value: Any) -> bool:
        if not isinstance(value, str) or not value:
            return False
        if value.startswith("${") and value.endswith("}"):
            name = value[2:-1]
            return bool(name) and name.replace("_", "a").isalnum() and bool(os.environ.get(name))
        return True

    def resolve_model(self) -> dict[str, Any]:
        settings = self.read_settings().value
        auth = self.read_auth().value
        provider = settings.get("defaultProvider")
        model = settings.get("defaultModel")
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
            "settings_path": str(settings.path),
            "auth_path": str(auth.path),
        }
