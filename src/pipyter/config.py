from __future__ import annotations

import json
import os
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


def config_dir() -> Path:
    override = os.environ.get("PIPYTER_CONFIG_HOME") or os.environ.get("PIPYTER_CONFIG_DIR")
    if override:
        return Path(override).expanduser().resolve()
    xdg = os.environ.get("XDG_CONFIG_HOME")
    base = Path(xdg).expanduser() if xdg else Path.home() / ".config"
    return base / "pipyter"


def credentials_path() -> Path:
    return config_dir() / "credentials.json"


def _atomic_json_write(path: Path, payload: dict[str, Any], mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def read_json(path: Path, default: dict[str, Any] | None = None) -> dict[str, Any]:
    if not path.exists():
        return {} if default is None else default
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


@dataclass(slots=True)
class Credentials:
    account_id: str
    access_token: str
    server_url: str
    refresh_token: str | None = None


def load_credentials() -> Credentials | None:
    data = read_json(credentials_path())
    if not data:
        return None
    return Credentials(
        account_id=str(data["account_id"]),
        access_token=str(data["access_token"]),
        server_url=str(data["server_url"]),
        refresh_token=data.get("refresh_token"),
    )


def save_credentials(credentials: Credentials) -> Path:
    path = credentials_path()
    _atomic_json_write(path, asdict(credentials), mode=0o600)
    return path


__all__ = [
    "Credentials",
    "config_dir",
    "credentials_path",
    "load_credentials",
    "read_json",
    "save_credentials",
    "_atomic_json_write",
]
