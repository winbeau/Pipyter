from __future__ import annotations

import asyncio
import base64
import json
import mimetypes
import os
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from ..protocol.pigent import ArtifactRef
from .models import ToolFailure, success
from ..workspace.files import atomic_write_bytes
from .tools import revision_bytes

_NAME = re.compile(r"^[A-Za-z_]\w*$")
_SENTINEL = "__PIPYTER_INSPECT__"


@dataclass(slots=True)
class _Artifact:
    ref: ArtifactRef
    path: Path


class ArtifactRegistry:
    def __init__(self, workspace: Path, *, ttl_seconds: int = 3600):
        self.workspace = workspace.expanduser().resolve()
        self.root = self.workspace / ".pipyter" / "pigent" / "artifacts"
        self.root.mkdir(parents=True, exist_ok=True)
        self.ttl_seconds = ttl_seconds
        self._items: dict[str, _Artifact] = {}

    def create(self, raw: bytes, *, mime: str, kind: str = "image", suffix: str | None = None) -> ArtifactRef:
        artifact_id = "art_" + secrets.token_urlsafe(24)
        extension = suffix or mimetypes.guess_extension(mime) or ".bin"
        path = self.root / f"{artifact_id}{extension}"
        atomic_write_bytes(path, raw)
        return self._register(artifact_id, path, raw, mime, kind)

    def reserve_path(self, suffix: str = ".png") -> tuple[str, Path]:
        artifact_id = "art_" + secrets.token_urlsafe(24)
        return artifact_id, self.root / f"{artifact_id}{suffix}"

    def register_existing(self, artifact_id: str, path: Path, *, mime: str, kind: str = "image") -> ArtifactRef:
        resolved = path.resolve()
        try:
            resolved.relative_to(self.root.resolve())
        except ValueError as error:
            raise ToolFailure("permission_denied", "Artifact path is outside the registry") from error
        if resolved.name != path.name or not resolved.is_file():
            raise ToolFailure("not_found", "Artifact was not produced")
        return self._register(artifact_id, resolved, resolved.read_bytes(), mime, kind)

    def _register(self, artifact_id: str, path: Path, raw: bytes, mime: str, kind: str) -> ArtifactRef:
        now = datetime.now(timezone.utc)
        expires = now + timedelta(seconds=self.ttl_seconds)
        ref = ArtifactRef(
            id=artifact_id, kind=kind, mime=mime, size=len(raw), created_at=now.isoformat(),
            hash=revision_bytes(raw), expires_at=expires.isoformat(),
        )
        self._items[artifact_id] = _Artifact(ref=ref, path=path)
        return ref

    async def view(self, artifact_id: str):
        item = self._items.get(artifact_id)
        if item is None:
            raise ToolFailure("not_found", "Artifact not found or not authorized")
        expiry = datetime.fromisoformat(item.ref.expires_at) if item.ref.expires_at else None
        if expiry is not None and datetime.now(timezone.utc) >= expiry:
            self._items.pop(artifact_id, None)
            try:
                item.path.unlink()
            except FileNotFoundError:
                pass
            raise ToolFailure("not_found", "Artifact has expired")
        try:
            raw = item.path.read_bytes()
        except FileNotFoundError as error:
            raise ToolFailure("not_found", "Artifact data is unavailable") from error
        if revision_bytes(raw) != item.ref.hash:
            raise ToolFailure("permission_denied", "Artifact integrity check failed")
        data = {"artifact_id": artifact_id, "media_type": item.ref.mime, "size": len(raw), "hash": item.ref.hash}
        if item.ref.mime.startswith("image/"):
            data["data_url"] = f"data:{item.ref.mime};base64,{base64.b64encode(raw).decode('ascii')}"
        else:
            data["content"] = raw[:65536].decode("utf-8", errors="replace")
            data["truncated"] = len(raw) > 65536
        return success(f"Viewed artifact {artifact_id}", data=data, artifacts=[item.ref])


class InspectionService:
    def __init__(self, kernels: Any, artifacts: ArtifactRegistry):
        self.kernels = kernels
        self.artifacts = artifacts
        self._kernel_locks: dict[str, asyncio.Lock] = {}

    async def inspect(self, arguments: dict[str, Any], *, kernel_id: str | None):
        if not kernel_id:
            raise ToolFailure("kernel_unavailable", "No current kernel is bound")
        action = arguments.get("action")
        if action not in {"variables", "variable", "dataframe", "figure", "object"}:
            raise ToolFailure("invalid_request", f"Unknown inspect action: {action}")
        if action == "figure":
            return await self._figure(arguments, kernel_id)
        name = arguments.get("name")
        if action != "variables" and (not isinstance(name, str) or not _NAME.fullmatch(name)):
            raise ToolFailure("invalid_request", "name must be a simple Python identifier")
        limit = max(1, min(int(arguments.get("limit", 50)), 200))
        if action == "variables":
            expression = "[{\"name\":k,\"type\":type(v).__name__,\"repr\":repr(v)[:240]} for k,v in list(globals().items()) if not k.startswith('_')][:LIMIT]"
        elif action == "dataframe":
            expression = ("(lambda v:{\"type\":type(v).__name__,\"shape\":list(v.shape),"
                          "\"columns\":[str(x) for x in list(v.columns)[:LIMIT]],"
                          "\"rows\":v.head(min(LIMIT,20)).astype(object).where(v.head(min(LIMIT,20)).notna(),None).to_dict(orient='records')})(NAME)")
        else:
            expression = ("(lambda v:{\"name\":NAME_TEXT,\"type\":type(v).__name__,\"repr\":repr(v)[:4000],"
                          "\"attributes\":[x for x in dir(v) if not x.startswith('_')][:LIMIT]})(NAME)")
        code = "import json as __pipyter_json\n" + f"LIMIT={limit}\n"
        if action != "variables":
            code += f"NAME_TEXT={name!r}\nNAME=globals().get({name!r})\n"
        code += f"print({_SENTINEL!r}+__pipyter_json.dumps({expression}, default=str, ensure_ascii=False))"
        payload = await self._execute_json(kernel_id, code, float(arguments.get("timeout", 30)))
        bounded = json.dumps(payload, ensure_ascii=False)
        if len(bounded.encode("utf-8")) > 65536:
            payload = {"preview": bounded[:65536], "truncated": True}
        return success(f"Inspected {action}", data={"action": action, "result": payload})

    async def _figure(self, arguments: dict[str, Any], kernel_id: str):
        name = arguments.get("name")
        if not isinstance(name, str) or not _NAME.fullmatch(name):
            raise ToolFailure("invalid_request", "name must be a simple Python identifier")
        artifact_id, path = self.artifacts.reserve_path(".png")
        code = (
            f"__pipyter_fig=globals().get({name!r})\n"
            "if __pipyter_fig is None: raise NameError('figure not found')\n"
            f"__pipyter_fig.savefig({os.fspath(path)!r}, format='png', dpi=120, bbox_inches='tight')\n"
            f"print({_SENTINEL!r}+__import__('json').dumps({{'saved': True}}))"
        )
        await self._execute_json(kernel_id, code, float(arguments.get("timeout", 30)))
        ref = self.artifacts.register_existing(artifact_id, path, mime="image/png", kind="image")
        return success(f"Captured figure {name}", data={"figure_id": ref.id}, artifacts=[ref])

    async def _execute_json(self, kernel_id: str, code: str, timeout: float) -> Any:
        lock = self._kernel_locks.setdefault(kernel_id, asyncio.Lock())
        try:
            async with lock:
                response = await asyncio.to_thread(self.kernels.execute, kernel_id, code, timeout)
        except KeyError as error:
            raise ToolFailure("kernel_unavailable", str(error)) from error
        except TimeoutError as error:
            raise ToolFailure("execution_timeout", str(error), True) from error
        text = "\n".join((output.text or "") for output in response.outputs)
        for line in text.splitlines():
            if line.startswith(_SENTINEL):
                try:
                    return json.loads(line[len(_SENTINEL):])
                except json.JSONDecodeError as error:
                    raise ToolFailure("internal_error", "Inspection helper returned invalid JSON") from error
        errors = [output.text for output in response.outputs if output.type == "error"]
        if errors:
            raise ToolFailure("invalid_request", errors[-1][:2000])
        raise ToolFailure("internal_error", "Inspection helper returned no bounded result")
