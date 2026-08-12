from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Any

NODE_ENV = "PIGENT_NODE"
PAYLOAD_ENV = "PIGENT_PAYLOAD_ROOT"
DEFAULT_NODE_MIN = "22.19.0"
PIGENT_PROTOCOL_VERSION = "0.2"
PAYLOAD_SCHEMA_VERSION = 2
UV_MIN_VERSION = "0.9.0"


class PigentResourceError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class RuntimeFinding:
    ok: bool
    required: str
    executable: str | None = None
    version: str | None = None
    message: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "required": self.required,
            "executable": self.executable,
            "version": self.version,
            "message": self.message,
        }


def _source_payload_root() -> Path | None:
    # Editable installs resolve this module from <repository>/src/pipyter. Only
    # accept the exact verified build output; never search parents or engines.
    package_dir = Path(__file__).resolve().parents[1]
    candidate = package_dir.parents[1] / "build" / "pigent-runtime"
    return candidate.resolve() if package_dir.name == "pipyter" and candidate.is_dir() else None


def payload_root() -> Path:
    override = os.environ.get(PAYLOAD_ENV)
    if override:
        path = Path(override).expanduser().resolve()
    else:
        installed = Path(str(resources.files("pipyter").joinpath("_vendor", "pigent")))
        path = installed if installed.is_dir() else (_source_payload_root() or installed)
    if not path.is_dir():
        raise PigentResourceError("payload_missing: verified Pigent payload is missing; run npm run payload:build in packages/pigent")
    return path


def load_manifest() -> dict[str, Any]:
    path = payload_root() / "manifest.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PigentResourceError(f"invalid Pigent manifest: {type(error).__name__}") from error
    if not isinstance(value, dict):
        raise PigentResourceError("invalid Pigent manifest: expected object")
    return value


def verify_payload() -> dict[str, Any]:
    root = payload_root()
    manifest = load_manifest()
    if manifest.get("schema_version") != PAYLOAD_SCHEMA_VERSION:
        raise PigentResourceError("payload_stale: Pigent payload manifest schema is incompatible")
    if manifest.get("host_protocol_version") != PIGENT_PROTOCOL_VERSION or manifest.get("tool_protocol_version") != PIGENT_PROTOCOL_VERSION:
        raise PigentResourceError("payload_stale: Pigent payload protocol is incompatible")
    if manifest.get("portable") is not True or manifest.get("external_engine_required") is not False:
        raise PigentResourceError("Pigent payload is not marked portable and first-party")
    files = manifest.get("files")
    if not isinstance(files, dict) or not files:
        raise PigentResourceError("Pigent manifest has no file hashes")
    for path in root.rglob("*"):
        if path.is_symlink():
            raise PigentResourceError(f"Pigent payload contains a symlink: {path.relative_to(root)}")
    actual = sorted(
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and path.name != "manifest.json"
    )
    expected = sorted(files)
    if actual != expected:
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        raise PigentResourceError(f"Pigent payload inventory mismatch; missing={missing}, extra={extra}")
    for relative, expected_hash in sorted(files.items()):
        if not isinstance(relative, str) or not isinstance(expected_hash, str):
            raise PigentResourceError("Pigent manifest file entries must be strings")
        path = root / relative
        digest = "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != expected_hash:
            raise PigentResourceError(f"Pigent payload hash mismatch: {relative}")
        lowered = relative.lower().split("/")
        if relative.lower().endswith(".node") or any(part in {"engines", ".beaupi", ".pi"} for part in lowered):
            raise PigentResourceError(f"forbidden Pigent payload entry: {relative}")
    host = manifest.get("host_entry")
    if not isinstance(host, str):
        raise PigentResourceError("Pigent manifest host_entry is invalid")
    host_path = Path(host)
    if host_path.is_absolute() or ".." in host_path.parts or host_path.as_posix() != host or host not in files:
        raise PigentResourceError("Pigent manifest host_entry must be a hashed relative payload file")
    resolved_host = (root / host_path).resolve()
    try:
        resolved_host.relative_to(root.resolve())
    except ValueError as error:
        raise PigentResourceError("Pigent manifest host_entry escapes the payload") from error
    if not resolved_host.is_file():
        raise PigentResourceError("Pigent host entry is missing")
    return manifest


def host_entry(*, verify: bool = False) -> Path:
    manifest = verify_payload() if verify else load_manifest()
    entry = manifest.get("host_entry")
    files = manifest.get("files")
    if not isinstance(entry, str) or not isinstance(files, dict):
        raise PigentResourceError("Pigent manifest host_entry is invalid")
    relative = Path(entry)
    if relative.is_absolute() or ".." in relative.parts or relative.as_posix() != entry or entry not in files:
        raise PigentResourceError("Pigent manifest host_entry must be a hashed relative payload file")
    root = payload_root().resolve()
    path = (root / relative).resolve()
    try:
        path.relative_to(root)
    except ValueError as error:
        raise PigentResourceError("Pigent manifest host_entry escapes the payload") from error
    if not path.is_file():
        raise PigentResourceError("Pigent host entry is missing")
    return path


def _version_tuple(value: str) -> tuple[int, int, int] | None:
    match = re.match(r"^v?(\d+)\.(\d+)\.(\d+)", value.strip())
    return tuple(map(int, match.groups())) if match else None  # type: ignore[return-value]


def resolve_node(configured: str | os.PathLike[str] | None = None) -> RuntimeFinding:
    try:
        required = str(load_manifest().get("node_min") or DEFAULT_NODE_MIN)
    except PigentResourceError:
        # Node and payload are independent doctor findings. A missing payload
        # must not make an otherwise valid Node installation appear missing.
        required = DEFAULT_NODE_MIN
    candidate = os.environ.get(NODE_ENV) or (os.fspath(configured) if configured else None) or shutil.which("node")
    if not candidate:
        return RuntimeFinding(False, required, message=f"Node >= {required} is required for Pigent; no trusted executable was found")
    executable = str(Path(candidate).expanduser()) if os.path.sep in candidate or (os.path.altsep and os.path.altsep in candidate) else candidate
    try:
        completed = subprocess.run(
            [executable, "--version"], check=False, capture_output=True, text=True, timeout=5, shell=False
        )
    except (OSError, subprocess.SubprocessError) as error:
        return RuntimeFinding(False, required, executable=executable, message=f"cannot execute Node candidate {executable}: {error}")
    raw_version = completed.stdout.strip() or completed.stderr.strip()
    actual, minimum = _version_tuple(raw_version), _version_tuple(required)
    if completed.returncode != 0 or actual is None or minimum is None:
        return RuntimeFinding(False, required, executable=executable, version=raw_version or None,
                           message=f"cannot determine Node version from {executable}")
    if actual < minimum:
        return RuntimeFinding(False, required, executable=executable, version=raw_version,
                           message=f"Node >= {required} is required for Pigent; found {raw_version} at {executable}")
    return RuntimeFinding(True, required, executable=executable, version=raw_version,
                       message=f"Node {raw_version} satisfies Pigent minimum {required}")


def resolve_uv(configured: str | os.PathLike[str] | None = None) -> RuntimeFinding:
    candidate = os.fspath(configured) if configured else shutil.which("uv")
    if not candidate:
        return RuntimeFinding(False, UV_MIN_VERSION, message=f"uv >= {UV_MIN_VERSION} is required only for managed Kernel environments; uv was not found")
    executable = str(Path(candidate).expanduser()) if os.path.sep in candidate or (os.path.altsep and os.path.altsep in candidate) else candidate
    try:
        completed = subprocess.run([executable, "--version"], check=False, capture_output=True, text=True, timeout=5, shell=False)
    except (OSError, subprocess.SubprocessError) as error:
        return RuntimeFinding(False, UV_MIN_VERSION, executable=executable, message=f"cannot execute uv candidate {executable}: {error}")
    raw_version = completed.stdout.strip() or completed.stderr.strip()
    version_text = raw_version.split()[-1] if raw_version else ""
    actual, minimum = _version_tuple(version_text), _version_tuple(UV_MIN_VERSION)
    if completed.returncode != 0 or actual is None or minimum is None:
        return RuntimeFinding(False, UV_MIN_VERSION, executable=executable, version=raw_version or None, message=f"cannot determine uv version from {executable}")
    if actual < minimum:
        return RuntimeFinding(False, UV_MIN_VERSION, executable=executable, version=version_text, message=f"uv >= {UV_MIN_VERSION} is required for managed Kernel environments; found {version_text}")
    return RuntimeFinding(True, UV_MIN_VERSION, executable=executable, version=version_text, message=f"uv {version_text} satisfies managed Kernel environment minimum {UV_MIN_VERSION}")


def diagnostics(*, verify_hashes: bool = True, configured_node: str | os.PathLike[str] | None = None) -> dict[str, Any]:
    payload_ok = False
    payload_error: str | None = None
    manifest: dict[str, Any] = {}
    try:
        manifest = verify_payload() if verify_hashes else load_manifest()
        payload_ok = True
    except PigentResourceError as error:
        payload_error = str(error)
    node = resolve_node(configured_node)
    uv = resolve_uv()
    return {
        "payload_ok": payload_ok,
        "payload_error": payload_error,
        "runtime_version": manifest.get("runtime_version"),
        "host_protocol_version": manifest.get("host_protocol_version"),
        "tool_protocol_version": manifest.get("tool_protocol_version"),
        "payload_schema_version": manifest.get("schema_version"),
        "node": node.as_dict(),
        "uv": uv.as_dict(),
    }
