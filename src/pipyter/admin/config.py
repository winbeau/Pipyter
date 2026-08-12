from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from ..config import _atomic_json_write, config_dir
from ..exceptions import PipyterError
from ..pigent.config import PigentConfigStore

SINGLE_USER_MODE = "single-user"
MULTI_USER_MODE = "multi-user"
DeploymentMode = Literal["single-user", "multi-user"]
_USER_NAME = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,63}$")


class AdminConfigError(PipyterError):
    """Raised when deployment/user layout configuration is invalid."""


@dataclass(frozen=True, slots=True)
class ManagedUserLayout:
    name: str
    root: Path
    config_root: Path
    workspaces_root: Path

    def to_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "root": str(self.root),
            "config_root": str(self.config_root),
            "workspaces_root": str(self.workspaces_root),
        }


@dataclass(frozen=True, slots=True)
class AdminConfig:
    mode: DeploymentMode = SINGLE_USER_MODE
    users_root: Path | None = None
    users: tuple[str, ...] = field(default_factory=tuple)
    explicit: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": 1,
            "mode": self.mode,
            "users_root": str(self.users_root) if self.users_root else None,
            "users": list(self.users),
            "explicit": self.explicit,
            "isolation": "runtime-os-identity" if self.mode == SINGLE_USER_MODE else "directory-only",
        }


class AdminConfigStore:
    """Owns global deployment mode and managed-user directory metadata.

    Provider credentials and account/node credentials deliberately live outside
    this document. An absent file is the implicit single-user default.
    """

    def __init__(self, path: Path | None = None):
        self.path = path or config_dir() / "admin.json"

    def read(self) -> AdminConfig:
        if not self.path.exists():
            return AdminConfig()
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise AdminConfigError(f"Invalid admin configuration {self.path}: {error}") from error
        if not isinstance(raw, dict):
            raise AdminConfigError(f"Invalid admin configuration {self.path}: expected an object")
        if raw.get("version", 1) != 1:
            raise AdminConfigError(f"Unsupported admin configuration version in {self.path}")
        mode = raw.get("mode", SINGLE_USER_MODE)
        if mode not in {SINGLE_USER_MODE, MULTI_USER_MODE}:
            raise AdminConfigError(f"Invalid deployment mode in {self.path}: {mode!r}")
        root_value = raw.get("users_root")
        users_root = Path(str(root_value)).expanduser().resolve() if root_value else None
        values = raw.get("users", [])
        if not isinstance(values, list) or any(not isinstance(item, str) for item in values):
            raise AdminConfigError(f"Invalid managed user list in {self.path}")
        users = tuple(sorted({_validate_user_name(item) for item in values}))
        if mode == MULTI_USER_MODE and users_root is None:
            raise AdminConfigError(f"multi-user mode requires users_root in {self.path}")
        return AdminConfig(mode=mode, users_root=users_root, users=users, explicit=True)

    def set_mode(
        self,
        mode: DeploymentMode,
        *,
        users_root: str | os.PathLike[str] | None = None,
        force: bool = False,
    ) -> AdminConfig:
        if mode not in {SINGLE_USER_MODE, MULTI_USER_MODE}:
            raise AdminConfigError(f"Unsupported deployment mode: {mode}")
        current = self.read()
        if current.explicit and current.mode != mode and not force:
            raise AdminConfigError(
                f"Deployment is already {current.mode}; pass --force to switch modes explicitly"
            )
        resolved_root = current.users_root
        if users_root is not None:
            resolved_root = Path(users_root).expanduser().resolve()
        if mode == MULTI_USER_MODE:
            if resolved_root is None:
                raise AdminConfigError("multi-user mode requires --users-root")
            resolved_root.mkdir(parents=True, exist_ok=True, mode=0o700)
            _restrict_directory(resolved_root)
        config = AdminConfig(
            mode=mode,
            users_root=resolved_root,
            users=current.users,
            explicit=True,
        )
        self._write(config)
        return config

    def add_user(self, name: str) -> ManagedUserLayout:
        config = self.read()
        if config.mode != MULTI_USER_MODE or config.users_root is None:
            raise AdminConfigError("Managed users are available only in multi-user mode")
        validated = _validate_user_name(name)
        layout = self.layout(validated, config=config)
        layout.workspaces_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        _restrict_directory(layout.root)
        _restrict_directory(layout.config_root)
        _restrict_directory(layout.workspaces_root)
        PigentConfigStore(config_root=layout.config_root).initialize()
        if validated not in config.users:
            config = AdminConfig(
                mode=config.mode,
                users_root=config.users_root,
                users=tuple(sorted((*config.users, validated))),
                explicit=True,
            )
            self._write(config)
        return layout

    def users(self) -> list[ManagedUserLayout]:
        config = self.read()
        if config.mode != MULTI_USER_MODE:
            return []
        return [self.layout(name, config=config) for name in config.users]

    def layout(self, name: str, *, config: AdminConfig | None = None) -> ManagedUserLayout:
        current = config or self.read()
        if current.mode != MULTI_USER_MODE or current.users_root is None:
            raise AdminConfigError("Managed user layout requires multi-user mode")
        validated = _validate_user_name(name)
        root = (current.users_root / validated).resolve()
        try:
            root.relative_to(current.users_root)
        except ValueError as error:  # defensive; validation already excludes separators
            raise AdminConfigError(f"Managed user root escapes users_root: {validated}") from error
        config_root = root / ".pipyter"
        return ManagedUserLayout(validated, root, config_root, config_root / "workspaces")

    def status(self) -> dict[str, Any]:
        config = self.read()
        result = config.to_dict()
        result["path"] = str(self.path)
        result["managed_users"] = [item.to_dict() for item in self.users()]
        if config.mode == MULTI_USER_MODE:
            result["warning"] = (
                "Directory separation is not a security boundary; public multi-user runtimes "
                "must use per-user OS or container identities."
            )
        return result

    def _write(self, config: AdminConfig) -> None:
        payload = {
            "version": 1,
            "mode": config.mode,
            "users_root": str(config.users_root) if config.users_root else None,
            "users": list(config.users),
        }
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        _restrict_directory(self.path.parent)
        _atomic_json_write(self.path, payload, mode=0o600)


def _validate_user_name(value: str) -> str:
    if not _USER_NAME.fullmatch(value):
        raise AdminConfigError(
            "User name must start with a letter and contain only letters, digits, '_' or '-' (max 64)"
        )
    return value


def _restrict_directory(path: Path) -> None:
    if path.exists() and os.name != "nt":
        os.chmod(path, 0o700)
