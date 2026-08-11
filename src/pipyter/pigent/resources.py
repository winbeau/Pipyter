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


class PigentResourceError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class NodeFinding:
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


def payload_root() -> Path:
    # This override is intentionally explicit and exists only for source-tree
    # tests/development. Normal discovery always uses installed package data.
    override = os.environ.get(PAYLOAD_ENV)
    root = Path(override).expanduser().resolve() if override else resources.files("pipyter").joinpath("_vendor", "pigent")
    path = Path(str(root))
    if not path.is_dir():
        raise PigentResourceError(f"bundled Pigent payload is missing: {path}")
    return path


def load_manifest() -> dict[str, Any]:
    path = payload_root() / "manifest.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PigentResourceError(f"invalid Pigent manifest {path}: {error}") from error
    if not isinstance(value, dict):
        raise PigentResourceError(f"invalid Pigent manifest {path}: expected object")
    return value


def verify_payload() -> dict[str, Any]:
    root = payload_root()
    manifest = load_manifest()
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
    if not isinstance(host, str) or not (root / host).is_file():
        raise PigentResourceError("Pigent host entry is missing")
    return manifest


def host_entry(*, verify: bool = False) -> Path:
    manifest = verify_payload() if verify else load_manifest()
    entry = manifest.get("host_entry")
    if not isinstance(entry, str):
        raise PigentResourceError("Pigent manifest host_entry is invalid")
    path = payload_root() / entry
    if not path.is_file():
        raise PigentResourceError(f"Pigent host entry is missing: {path}")
    return path


def _version_tuple(value: str) -> tuple[int, int, int] | None:
    match = re.match(r"^v?(\d+)\.(\d+)\.(\d+)", value.strip())
    return tuple(map(int, match.groups())) if match else None  # type: ignore[return-value]


def resolve_node(configured: str | os.PathLike[str] | None = None) -> NodeFinding:
    try:
        required = str(load_manifest().get("node_min") or DEFAULT_NODE_MIN)
    except PigentResourceError:
        # Node and payload are independent doctor findings. A missing payload
        # must not make an otherwise valid Node installation appear missing.
        required = DEFAULT_NODE_MIN
    candidate = os.environ.get(NODE_ENV) or (os.fspath(configured) if configured else None) or shutil.which("node")
    if not candidate:
        return NodeFinding(False, required, message=f"Node >= {required} is required for Pigent; no trusted executable was found")
    executable = str(Path(candidate).expanduser()) if os.path.sep in candidate or (os.path.altsep and os.path.altsep in candidate) else candidate
    try:
        completed = subprocess.run(
            [executable, "--version"], check=False, capture_output=True, text=True, timeout=5, shell=False
        )
    except (OSError, subprocess.SubprocessError) as error:
        return NodeFinding(False, required, executable=executable, message=f"cannot execute Node candidate {executable}: {error}")
    raw_version = completed.stdout.strip() or completed.stderr.strip()
    actual, minimum = _version_tuple(raw_version), _version_tuple(required)
    if completed.returncode != 0 or actual is None or minimum is None:
        return NodeFinding(False, required, executable=executable, version=raw_version or None,
                           message=f"cannot determine Node version from {executable}")
    if actual < minimum:
        return NodeFinding(False, required, executable=executable, version=raw_version,
                           message=f"Node >= {required} is required for Pigent; found {raw_version} at {executable}")
    return NodeFinding(True, required, executable=executable, version=raw_version,
                       message=f"Node {raw_version} satisfies Pigent minimum {required}")


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
    return {
        "payload_ok": payload_ok,
        "payload_error": payload_error,
        "runtime_version": manifest.get("runtime_version"),
        "host_protocol_version": manifest.get("host_protocol_version"),
        "node": node.as_dict(),
    }
