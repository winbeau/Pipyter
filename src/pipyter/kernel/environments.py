from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import shutil
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from ..pigent.config import pipyter_config_root
from ..pigent.resources import RuntimeFinding, resolve_uv
from ..protocol.pigent import KernelEnvironmentSummary, PigentToolError


class KernelEnvironmentError(RuntimeError):
    def __init__(self, code: str, message: str, *, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def revision(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(path.parent, 0o700)
    temporary = path.with_name(f".{path.name}.{secrets.token_hex(6)}.tmp")
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
        os.chmod(path, 0o600)
    finally:
        temporary.unlink(missing_ok=True)


_PACKAGE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9_,.-]+\])?(?:\s*(?:===|==|~=|!=|<=|>=|<|>)\s*[^\s;]+)?$")
_SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")


def normalize_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    if not _SLUG.fullmatch(slug):
        raise KernelEnvironmentError("invalid_request", "Environment name must form a 1-64 character slug")
    return slug


def validate_packages(values: list[str] | None) -> list[str]:
    packages = list(values or [])
    if len(packages) > 100:
        raise KernelEnvironmentError("invalid_request", "At most 100 packages may be requested")
    normalized = []
    for value in packages:
        if not isinstance(value, str) or len(value) > 200 or not _PACKAGE.fullmatch(value.strip()):
            raise KernelEnvironmentError("invalid_request", "Package requirements must be structured package specifiers")
        normalized.append(value.strip())
    return normalized


@dataclass(slots=True)
class EnvironmentRecord:
    metadata_path: Path
    value: dict[str, Any]


class KernelEnvironmentRegistry:
    def __init__(self, config_root: str | os.PathLike[str] | None = None):
        self.config_root = pipyter_config_root(config_root)
        self.root = self.config_root / "kernels"
        self.temporary_root = self.root / "temporary"
        self.maintained_root = self.root / "maintained"
        self.trash_root = self.root / ".trash"
        self.registry_path = self.root / "registry.json"
        self._items: dict[str, EnvironmentRecord] = {}
        self.initialize()

    def initialize(self) -> None:
        for path in (self.root, self.temporary_root, self.maintained_root, self.trash_root):
            path.mkdir(parents=True, exist_ok=True, mode=0o700)
            os.chmod(path, 0o700)
        self.scan()

    @property
    def uv(self) -> RuntimeFinding:
        return resolve_uv()

    def require_uv(self) -> RuntimeFinding:
        finding = self.uv
        if not finding.ok:
            code = "uv_missing" if finding.executable is None else "uv_incompatible"
            raise KernelEnvironmentError(code, finding.message)
        return finding

    def scan(self) -> None:
        items: dict[str, EnvironmentRecord] = {}
        for root in (self.temporary_root, self.maintained_root):
            for path in root.glob("*/environment.json"):
                try:
                    value = json.loads(path.read_text(encoding="utf-8"))
                    if isinstance(value, dict) and isinstance(value.get("id"), str):
                        self._validate_record(path, value)
                        items[value["id"]] = EnvironmentRecord(path, value)
                except Exception:
                    continue
        self._items = items
        self._write_registry()

    def _write_registry(self) -> None:
        rows = []
        for environment_id, record in sorted(self._items.items()):
            rows.append({
                "id": environment_id,
                "kind": record.value["kind"],
                "slug": record.value.get("slug"),
                "relative_path": record.metadata_path.parent.relative_to(self.root).as_posix(),
                "metadata_revision": record.value["revision"],
            })
        payload = {"version": 1, "environments": rows}
        payload["revision"] = revision(payload)
        atomic_json(self.registry_path, payload)

    def _validate_record(self, path: Path, value: dict[str, Any]) -> None:
        expected_parent = self.temporary_root if value.get("kind") == "temporary" else self.maintained_root
        resolved = path.resolve()
        try:
            resolved.relative_to(expected_parent.resolve())
        except ValueError as error:
            raise KernelEnvironmentError("permission_denied", "Environment metadata escaped the config root") from error
        if value.get("kind") not in {"temporary", "maintained"} or value.get("status") not in {
            "provisioning", "ready", "stale", "syncing", "error", "deleting", "missing",
        }:
            raise KernelEnvironmentError("invalid_request", "Invalid environment metadata")

    def reserve_temporary(self, request: dict[str, Any]) -> dict[str, Any]:
        self.require_uv()
        environment_id = "env_" + secrets.token_urlsafe(18).replace("-", "").replace("_", "")
        ttl = int(request.get("ttl_seconds", request.get("ttlSeconds", 21600)))
        if not 900 <= ttl <= 604800:
            raise KernelEnvironmentError("invalid_request", "Temporary TTL must be between 900 and 604800 seconds")
        created = now()
        value = {
            "version": 1,
            "id": environment_id,
            "kind": "temporary",
            "slug": None,
            "display_name": str(request.get("display_name") or request.get("displayName") or f"Temporary Python {request.get('python', '')}").strip(),
            "status": "provisioning",
            "python_request": str(request.get("python") or "3"),
            "python_version": None,
            "interpreter": "pyvenv/bin/python",
            "requested_packages": validate_packages(request.get("packages")),
            "package_policy": "explicit",
            "project_source": None,
            "lock_revision": None,
            "created_at": created,
            "updated_at": created,
            "last_used_at": created,
            "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).isoformat(),
            "last_error": None,
        }
        return self._publish_new(value, self.temporary_root / environment_id)

    def reserve_maintained(self, request: dict[str, Any], workspace: Path | None = None) -> dict[str, Any]:
        self.require_uv()
        name = str(request.get("name") or "")
        slug = normalize_slug(name)
        target = self.maintained_root / slug
        if target.exists() or any(item.value.get("slug") == slug for item in self._items.values()):
            raise KernelEnvironmentError("kernel_environment_conflict", f"Maintained environment already exists: {slug}")
        source = request.get("source")
        if source is not None and not isinstance(source, dict):
            raise KernelEnvironmentError("invalid_request", "source must be an object")
        created = now()
        environment_id = "env_" + secrets.token_urlsafe(18).replace("-", "").replace("_", "")
        value = {
            "version": 1,
            "id": environment_id,
            "kind": "maintained",
            "slug": slug,
            "display_name": str(request.get("display_name") or request.get("displayName") or name),
            "status": "provisioning",
            "python_request": str(request.get("python") or "3"),
            "python_version": None,
            "interpreter": "pyvenv/bin/python",
            "requested_packages": validate_packages(request.get("packages")),
            "package_policy": "workspace-project" if source else "explicit",
            "project_source": self._validate_source(source, workspace) if source else None,
            "lock_revision": None,
            "created_at": created,
            "updated_at": created,
            "last_used_at": None,
            "expires_at": None,
            "last_error": None,
        }
        return self._publish_new(value, target)

    def _validate_source(self, source: dict[str, Any], workspace: Path | None) -> dict[str, Any]:
        if source.get("kind", source.get("source")) not in {"workspace-project", None}:
            raise KernelEnvironmentError("invalid_request", "Only workspace-project sources are supported")
        if workspace is None:
            raise KernelEnvironmentError("invalid_request", "Workspace source requires a workspace")
        relative = str(source.get("workspace_path", source.get("workspacePath", ".")))
        target = (workspace / relative).resolve()
        workspace = workspace.resolve()
        try:
            target.relative_to(workspace)
        except ValueError as error:
            raise KernelEnvironmentError("permission_denied", "Workspace source escaped the Workspace") from error
        pyproject = target / "pyproject.toml"
        if not pyproject.is_file():
            raise KernelEnvironmentError("not_found", "Workspace source has no pyproject.toml")
        lock = target / "uv.lock"
        return {
            "kind": "workspace-project",
            "workspace_path": target.relative_to(workspace).as_posix() or ".",
            "extras": [str(item) for item in source.get("extras", [])],
            "content_revision": revision({"pyproject": pyproject.read_text(encoding="utf-8"), "lock": lock.read_text(encoding="utf-8") if lock.exists() else None}),
        }

    def validate_persisted_source(self, environment_id: str, workspace: Path) -> dict[str, Any]:
        value = self.get(environment_id)
        source = value.get("project_source")
        if not isinstance(source, dict) or source.get("kind") != "workspace-project":
            raise KernelEnvironmentError("kernel_environment_conflict", "Environment has no workspace-project source")
        refreshed = self._validate_source(source, workspace)
        return {"path": (workspace.resolve() / refreshed["workspace_path"]).resolve(), **refreshed}

    def _publish_new(self, value: dict[str, Any], directory: Path) -> dict[str, Any]:
        directory.mkdir(parents=True, exist_ok=False, mode=0o700)
        os.chmod(directory, 0o700)
        value["revision"] = revision({key: item for key, item in value.items() if key != "revision"})
        path = directory / "environment.json"
        atomic_json(path, value)
        self._items[value["id"]] = EnvironmentRecord(path, value)
        self._write_registry()
        return dict(value)

    def get(self, environment_id: str) -> dict[str, Any]:
        try:
            return dict(self._items[environment_id].value)
        except KeyError as error:
            raise KernelEnvironmentError("kernel_environment_not_found", f"Environment not found: {environment_id}") from error

    def path(self, environment_id: str) -> Path:
        try:
            return self._items[environment_id].metadata_path.parent
        except KeyError as error:
            raise KernelEnvironmentError("kernel_environment_not_found", f"Environment not found: {environment_id}") from error

    def interpreter(self, environment_id: str) -> Path:
        value = self.get(environment_id)
        if value["status"] not in {"ready", "stale"}:
            raise KernelEnvironmentError("kernel_environment_busy", "Environment is not ready")
        path = (self.path(environment_id) / value["interpreter"]).resolve()
        try:
            path.relative_to(self.path(environment_id).resolve())
        except ValueError as error:
            raise KernelEnvironmentError("permission_denied", "Environment interpreter escaped its directory") from error
        if not path.is_file():
            raise KernelEnvironmentError("kernel_environment_not_found", "Environment interpreter is missing")
        return path

    def kernelspec(self, environment_id: str) -> dict[str, Any]:
        path = self.path(environment_id) / "kernelspec" / "kernel.json"
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise KernelEnvironmentError("kernel_environment_not_found", "Private kernelspec is unavailable") from error
        return value

    def update(self, environment_id: str, **changes: Any) -> dict[str, Any]:
        record = self._items.get(environment_id)
        if record is None:
            raise KernelEnvironmentError("kernel_environment_not_found", f"Environment not found: {environment_id}")
        value = dict(record.value)
        value.update(changes)
        value["updated_at"] = now()
        value["revision"] = revision({key: item for key, item in value.items() if key != "revision"})
        atomic_json(record.metadata_path, value)
        record.value = value
        self._write_registry()
        return dict(value)

    def summaries(self, active_by_environment: dict[str, list[str]] | None = None) -> list[KernelEnvironmentSummary]:
        active_by_environment = active_by_environment or {}
        result = []
        for environment_id, record in sorted(self._items.items(), key=lambda pair: pair[1].value["created_at"]):
            value = record.value
            last_error = value.get("last_error")
            result.append(KernelEnvironmentSummary(
                id=environment_id,
                kind=value["kind"],
                name=value.get("slug"),
                display_name=value["display_name"],
                status=value["status"],
                python_request=value["python_request"],
                python_version=value.get("python_version"),
                interpreter=value.get("interpreter"),
                packages=list(value.get("requested_packages") or []),
                source=value.get("project_source"),
                lock_revision=value.get("lock_revision"),
                revision=value["revision"],
                created_at=value["created_at"],
                updated_at=value["updated_at"],
                last_used_at=value.get("last_used_at"),
                expires_at=value.get("expires_at"),
                active_kernel_ids=list(active_by_environment.get(environment_id, [])),
                last_error=PigentToolError.model_validate(last_error) if isinstance(last_error, dict) else None,
            ))
        return result

    def promote(self, environment_id: str, name: str, display_name: str | None = None) -> dict[str, Any]:
        record = self._items.get(environment_id)
        if record is None:
            raise KernelEnvironmentError("kernel_environment_not_found", "Temporary environment not found")
        if record.value["kind"] != "temporary" or record.value["status"] != "ready":
            raise KernelEnvironmentError("kernel_environment_conflict", "Only a ready temporary environment can be promoted")
        slug = normalize_slug(name)
        target = self.maintained_root / slug
        if target.exists():
            raise KernelEnvironmentError("kernel_environment_conflict", f"Maintained environment already exists: {slug}")
        value = dict(record.value)
        value.update({"kind": "maintained", "slug": slug, "display_name": display_name or name, "expires_at": None})
        source = record.metadata_path.parent
        shutil.move(str(source), str(target))
        path = target / "environment.json"
        self._items[environment_id] = EnvironmentRecord(path, value)
        self.update(environment_id, **value)
        self.write_kernelspec(environment_id)
        return self.get(environment_id)

    def write_kernelspec(self, environment_id: str) -> Path:
        value = self.get(environment_id)
        interpreter = self.path(environment_id) / value["interpreter"]
        path = self.path(environment_id) / "kernelspec" / "kernel.json"
        atomic_json(path, {
            "argv": [str(interpreter), "-m", "ipykernel_launcher", "-f", "{connection_file}"],
            "display_name": value["display_name"],
            "language": "python",
            "metadata": {"pipyter": {"environment_id": environment_id, "kind": value["kind"]}},
        })
        return path

    def delete(self, environment_id: str) -> None:
        record = self._items.get(environment_id)
        if record is None:
            raise KernelEnvironmentError("kernel_environment_not_found", "Environment not found")
        source = record.metadata_path.parent
        target = self.trash_root / f"{environment_id}-{secrets.token_hex(6)}"
        source.rename(target)
        self._items.pop(environment_id, None)
        self._write_registry()
        shutil.rmtree(target, ignore_errors=True)

    def expired_temporary_ids(self, active_environment_ids: set[str] | None = None, now_at: datetime | None = None) -> list[str]:
        active_environment_ids = active_environment_ids or set()
        current = now_at or datetime.now(timezone.utc)
        expired = []
        for environment_id, record in self._items.items():
            value = record.value
            if value["kind"] != "temporary" or environment_id in active_environment_ids or value["status"] not in {"ready", "error"}:
                continue
            expires_at = value.get("expires_at")
            if expires_at and datetime.fromisoformat(expires_at) <= current:
                expired.append(environment_id)
        return expired
