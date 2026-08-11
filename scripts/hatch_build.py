from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class PigentPayloadError(RuntimeError):
    pass


def _verify_payload(root: Path) -> dict[str, Any]:
    manifest_path = root / "manifest.json"
    if not root.is_dir() or not manifest_path.is_file():
        raise PigentPayloadError(
            "verified Pigent payload is required; run `cd packages/pigent && npm run payload:build`"
        )
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PigentPayloadError(f"invalid Pigent payload manifest: {error}") from error
    if not isinstance(manifest, dict) or manifest.get("portable") is not True:
        raise PigentPayloadError("Pigent payload manifest is not portable")
    if manifest.get("external_engine_required") is not False:
        raise PigentPayloadError("Pigent payload must not require an external engine")
    files = manifest.get("files")
    if not isinstance(files, dict) or not files:
        raise PigentPayloadError("Pigent payload manifest has no file inventory")
    actual: list[str] = []
    for path in root.rglob("*"):
        if path.is_symlink():
            raise PigentPayloadError(f"Pigent payload contains a symlink: {path.relative_to(root)}")
        if path.is_file() and path != manifest_path:
            actual.append(path.relative_to(root).as_posix())
    if sorted(actual) != sorted(files):
        raise PigentPayloadError("Pigent payload inventory does not match its manifest")
    for relative, expected in sorted(files.items()):
        if not isinstance(relative, str) or not isinstance(expected, str):
            raise PigentPayloadError("Pigent payload manifest entries must be strings")
        path = root / relative
        digest = "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != expected:
            raise PigentPayloadError(f"Pigent payload hash mismatch: {relative}")
    return manifest


class CustomBuildHook(BuildHookInterface):
    """Require and include a prebuilt, hash-verified Pigent payload.

    In a repository build the generated artifact lives under build/. In a build
    from the released sdist it is already present below src/pipyter/_vendor/.
    No npm command or network operation is ever performed by this hook.
    """

    def initialize(self, version: str, build_data: dict[str, Any]) -> None:
        repository_payload = Path(self.root) / "build" / "pigent-runtime"
        legacy_sdist_payload = Path(self.root) / "src" / "pipyter" / "_vendor" / "pigent"
        payload = repository_payload if repository_payload.is_dir() else legacy_sdist_payload
        _verify_payload(payload)
        if payload == legacy_sdist_payload and self.target_name == "wheel":
            # Compatibility for an already-created development sdist using the
            # older location; normal Phase 6 sdists use build/pigent-runtime.
            return
        destination = "build/pigent-runtime" if self.target_name == "sdist" else "pipyter/_vendor/pigent"
        build_data.setdefault("force_include", {})[os.fspath(payload)] = destination
