from __future__ import annotations

import asyncio
import base64
import difflib
import mimetypes
import os
import re
import signal
from collections import defaultdict
from pathlib import Path
from typing import Any

from ..workspace.files import atomic_write_bytes, content_revision, file_kind
from .models import ToolFailure, success

READ_MAX_BYTES = 50 * 1024
READ_MAX_LINES = 2_000
DIRECTORY_MAX_DEPTH = 3
BASH_MAX_OUTPUT = 128 * 1024
IMAGE_MIMES = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/svg+xml"}
_SECRET_NAME = re.compile(r"(?:api[_-]?key|token|secret|password|authorization|credential|pipyter.*bridge|pigent.*bridge)", re.I)


def revision_bytes(value: bytes) -> str:
    return content_revision(value)


def revision_path(path: Path) -> str:
    return revision_bytes(path.read_bytes())


def public_path(workspace: Path, path: Path) -> str:
    try:
        relative = path.relative_to(workspace)
        return relative.as_posix() or "."
    except ValueError:
        return path.name


def resolve_target(workspace: Path, value: str | os.PathLike[str] | None, *, default: str = ".") -> Path:
    raw = default if value is None else os.fspath(value)
    if not isinstance(raw, str) or not raw or "\x00" in raw:
        raise ToolFailure("invalid_path", "Path must be a non-empty string without NUL bytes")
    try:
        requested = Path(raw).expanduser()
        return (requested if requested.is_absolute() else workspace / requested).resolve(strict=False)
    except (OSError, RuntimeError, ValueError) as error:
        raise ToolFailure("invalid_path", f"Invalid path: {raw}") from error


def _media_type(path: Path) -> str:
    guessed = mimetypes.guess_type(path.name)[0]
    head = path.read_bytes()[:16]
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if head.startswith(b"BM"):
        return "image/bmp"
    return guessed or "application/octet-stream"


def _translate_os(error: BaseException, path: Path | None = None) -> ToolFailure:
    if isinstance(error, asyncio.CancelledError):
        # Cancellation must propagate to the Agent abort path, never be
        # rewritten as an application error (03-modes-permissions.md).
        raise error
    if isinstance(error, FileNotFoundError):
        return ToolFailure("not_found", f"Not found: {path or error}")
    if isinstance(error, PermissionError):
        return ToolFailure("permission_denied", f"Permission denied: {path or error}")
    if isinstance(error, UnicodeDecodeError):
        return ToolFailure("invalid_request", f"File is not valid UTF-8: {path}", details={"encoding": "utf-8"})
    if isinstance(error, ToolFailure):
        return error
    return ToolFailure("internal_error", str(error))


class FileToolService:
    def __init__(self, workspace: Path, artifact_registry: Any | None = None):
        self.workspace = workspace.expanduser().resolve()
        self.artifacts = artifact_registry
        self._locks: defaultdict[Path, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def read(self, arguments: dict[str, Any]):
        path = resolve_target(self.workspace, arguments.get("path"))
        try:
            display_path = public_path(self.workspace, path)
            if path.is_dir():
                depth = max(1, min(int(arguments.get("depth", 1)), DIRECTORY_MAX_DEPTH))
                limit = max(1, min(int(arguments.get("limit", 200)), 1_000))
                entries: list[dict[str, Any]] = []
                base_depth = len(path.parts)
                for item in sorted(path.rglob("*") if depth > 1 else path.iterdir(), key=lambda p: str(p).lower()):
                    if ".pipyter" in item.relative_to(path).parts:
                        continue
                    if len(item.parts) - base_depth > depth:
                        continue
                    stat = item.stat()
                    entries.append({
                        "path": public_path(self.workspace, item), "name": item.name, "kind": file_kind(item),
                        "size": None if item.is_dir() else stat.st_size, "modified": stat.st_mtime,
                    })
                    if len(entries) >= limit:
                        break
                return success(
                    f"Listed {display_path}",
                    data={"path": display_path, "entries": entries, "truncated": len(entries) >= limit, "limit": limit},
                )
            if not path.is_file():
                raise FileNotFoundError(path)
            media = _media_type(path)
            if media in IMAGE_MIMES or media.startswith("image/"):
                raise ToolFailure("unsupported_media", f"{display_path} is visual media; use view")
            raw = path.read_bytes()
            if b"\x00" in raw[:8192]:
                raise ToolFailure("unsupported_media", f"{display_path} appears binary; use view or download")
            text = raw.decode("utf-8")
            offset = max(1, int(arguments.get("offset", 1)))
            limit = max(1, min(int(arguments.get("limit", 400)), READ_MAX_LINES))
            lines = text.splitlines(keepends=True)
            selected = "".join(lines[offset - 1:offset - 1 + limit])
            encoded = selected.encode("utf-8")
            byte_truncated = len(encoded) > READ_MAX_BYTES
            if byte_truncated:
                selected = encoded[:READ_MAX_BYTES].decode("utf-8", errors="ignore")
            truncated = offset - 1 + limit < len(lines) or byte_truncated
            return success(
                f"Read {display_path}",
                data={"path": display_path, "content": selected, "offset": offset, "line_count": len(lines),
                      "truncated": truncated, "next_offset": offset + selected.count("\n") if truncated else None,
                      "revision": revision_bytes(raw), "media_type": media},
            )
        except BaseException as error:
            raise _translate_os(error, path) from error

    async def view(self, arguments: dict[str, Any]):
        source = arguments.get("source") or {}
        kind = source.get("kind")
        if kind in {"artifact", "figure"}:
            if self.artifacts is None:
                raise ToolFailure("not_found", "Artifact registry is unavailable")
            artifact_id = source.get("artifact_id") or source.get("figure_id")
            return await self.artifacts.view(str(artifact_id))
        if kind != "file":
            raise ToolFailure("invalid_request", "view source.kind must be file, artifact, or figure")
        path = resolve_target(self.workspace, source.get("path"))
        try:
            if not path.is_file():
                raise FileNotFoundError(path)
            mime = _media_type(path)
            if mime not in IMAGE_MIMES:
                raise ToolFailure("unsupported_media", f"Unsupported visual media type: {mime}")
            raw = path.read_bytes()
            if len(raw) > 8 * 1024 * 1024:
                raise ToolFailure("too_large", "Image exceeds the 8 MiB view limit")
            data_url = f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"
            display_path = public_path(self.workspace, path)
            return success(f"Viewed {display_path}", data={"source": {"kind": "file", "path": display_path},
                                                        "media_type": mime, "data_url": data_url,
                                                        "size": len(raw), "hash": revision_bytes(raw)})
        except BaseException as error:
            raise _translate_os(error, path) from error

    async def write(self, arguments: dict[str, Any]):
        path = resolve_target(self.workspace, arguments.get("path"))
        content = arguments.get("content")
        if not isinstance(content, str):
            raise ToolFailure("invalid_request", "content must be a string")
        return await self._mutate(path, arguments.get("expected_revision"), lambda _old: content,
                                  verb="Wrote", create=True)

    async def update(self, arguments: dict[str, Any]):
        path = resolve_target(self.workspace, arguments.get("path"))
        strategy = arguments.get("strategy", "replace")
        if strategy == "replace":
            edits = arguments.get("edits")
            if not isinstance(edits, list) or not edits:
                raise ToolFailure("invalid_request", "replace requires a non-empty edits list")
            def transform(original: str) -> str:
                spans: list[tuple[int, int, str]] = []
                for edit in edits:
                    old, new = edit.get("old_text"), edit.get("new_text")
                    if not isinstance(old, str) or not old or not isinstance(new, str):
                        raise ToolFailure("invalid_request", "Each edit needs non-empty old_text and string new_text")
                    count = original.count(old)
                    if count != 1:
                        raise ToolFailure("invalid_request", f"old_text must match exactly once; matched {count}")
                    start = original.index(old)
                    spans.append((start, start + len(old), new))
                spans.sort()
                if any(left[1] > right[0] for left, right in zip(spans, spans[1:])):
                    raise ToolFailure("invalid_request", "Replacement edits overlap")
                result = original
                for start, end, new in reversed(spans):
                    result = result[:start] + new + result[end:]
                return result
        elif strategy == "patch":
            patch = arguments.get("patch")
            if not isinstance(patch, str):
                raise ToolFailure("invalid_request", "patch must be a unified diff string")
            transform = lambda original: _apply_unified_patch(original, patch)
        else:
            raise ToolFailure("invalid_request", f"Unknown update strategy: {strategy}")
        return await self._mutate(path, arguments.get("expected_revision"), transform, verb="Updated", create=False)

    async def _mutate(self, path: Path, expected: str | None, transform: Any, *, verb: str, create: bool):
        async with self._locks[path]:
            try:
                existed = path.exists()
                if not existed and not create:
                    raise FileNotFoundError(path)
                old_raw = path.read_bytes() if existed else b""
                before = revision_bytes(old_raw)
                if expected is not None and expected != before:
                    raise ToolFailure("revision_conflict", f"Expected {expected}, current {before}", True,
                                      {"expected": expected, "current": before})
                try:
                    old_text = old_raw.decode("utf-8")
                except UnicodeDecodeError as error:
                    raise _translate_os(error, path) from error
                new_text = transform(old_text)
                if not isinstance(new_text, str):
                    raise ToolFailure("invalid_request", "Mutation did not produce text")
                new_raw = new_text.encode("utf-8")
                path.parent.mkdir(parents=True, exist_ok=True)
                atomic_write_bytes(path, new_raw)
                after = revision_bytes(new_raw)
                display_path = public_path(self.workspace, path)
                diff = "".join(difflib.unified_diff(old_text.splitlines(True), new_text.splitlines(True),
                                                     fromfile=display_path, tofile=display_path))
                return success(f"{verb} {display_path}", data={"path": display_path, "bytes_written": len(new_raw), "diff": diff},
                               before=before, after=after)
            except BaseException as error:
                raise _translate_os(error, path) from error


class BashToolService:
    def __init__(self, workspace: Path, *, terminal_sessions: Any | None = None):
        self.workspace = workspace.expanduser().resolve()
        self.terminal_sessions = terminal_sessions

    async def bash(self, arguments: dict[str, Any]):
        command = arguments.get("command")
        if not isinstance(command, str) or not command or "\x00" in command:
            raise ToolFailure("invalid_request", "command must be a non-empty string without NUL bytes")
        cwd = resolve_target(self.workspace, arguments.get("cwd"), default=".")
        if arguments.get("interactive") is True:
            shell_session_id = None
            if self.terminal_sessions is not None:
                relative_cwd = cwd.relative_to(self.workspace).as_posix() or "."
                attached = self.terminal_sessions.attach_command(command, cwd=relative_cwd)
                shell_session_id = attached.id
            interaction = {"kind": "pty_handoff", "summary": "Open the Shell to continue",
                           "choices": ["open_shell", "cancel"]}
            if shell_session_id is not None:
                interaction["shell_session_id"] = shell_session_id
            raise ToolFailure(
                "confirmation_required",
                "Interactive command requires direct Shell handoff",
                details={"interaction": interaction},
            )
        timeout = float(arguments.get("timeout", 120))
        if timeout <= 0:
            raise ToolFailure("invalid_request", "timeout must be positive")
        env = {key: value for key, value in os.environ.items() if not _SECRET_NAME.search(key)}
        try:
            process = await asyncio.create_subprocess_exec(
                "/bin/sh", "-lc", command, cwd=str(cwd), env=env,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, start_new_session=True,
            )
        except BaseException as error:
            raise _translate_os(error, cwd) from error
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except asyncio.TimeoutError as error:
            await _terminate_process(process)
            raise ToolFailure("execution_timeout", f"Command timed out after {timeout:g}s", True) from error
        except asyncio.CancelledError:
            await _terminate_process(process)
            raise
        combined = stdout + stderr
        truncated = len(combined) > BASH_MAX_OUTPUT
        if truncated:
            combined = combined[-BASH_MAX_OUTPUT:]
        return success(
            f"Command exited with code {process.returncode}",
            data={"command": command, "cwd": public_path(self.workspace, cwd), "exit_code": process.returncode,
                  "stdout": stdout[-BASH_MAX_OUTPUT:].decode("utf-8", errors="replace"),
                  "stderr": stderr[-BASH_MAX_OUTPUT:].decode("utf-8", errors="replace"),
                  "output_tail": combined.decode("utf-8", errors="replace"), "truncated": truncated},
        )


async def _terminate_process(process: asyncio.subprocess.Process) -> None:
    if process.returncode is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        await asyncio.wait_for(process.wait(), timeout=1)
    except asyncio.TimeoutError:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        await process.wait()


def _apply_unified_patch(original: str, patch: str) -> str:
    lines = patch.splitlines(keepends=True)
    if any(line.startswith(("--- ", "+++ ")) for line in lines):
        headers = [line for line in lines if line.startswith(("--- ", "+++ "))]
        if len(headers) > 2:
            raise ToolFailure("invalid_request", "Only a single-file unified diff is supported")
    source = original.splitlines(keepends=True)
    output: list[str] = []
    source_index = 0
    hunk_seen = False
    index = 0
    pattern = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
    while index < len(lines):
        line = lines[index]
        if line.startswith(("--- ", "+++ ")):
            index += 1
            continue
        match = pattern.match(line)
        if not match:
            if line.strip():
                raise ToolFailure("invalid_request", "Malformed unified diff")
            index += 1
            continue
        hunk_seen = True
        old_start = int(match.group(1)) - 1
        if old_start < source_index or old_start > len(source):
            raise ToolFailure("invalid_request", "Patch hunk has an invalid source range")
        output.extend(source[source_index:old_start])
        source_index = old_start
        index += 1
        while index < len(lines) and not lines[index].startswith("@@ "):
            change = lines[index]
            if change.startswith("\\ No newline"):
                index += 1
                continue
            if not change or change[0] not in " +-":
                raise ToolFailure("invalid_request", "Malformed patch hunk")
            payload = change[1:]
            if change[0] in " -":
                if source_index >= len(source) or source[source_index] != payload:
                    raise ToolFailure("invalid_request", "Patch context does not match the current file")
                source_index += 1
            if change[0] in " +":
                output.append(payload)
            index += 1
    if not hunk_seen:
        raise ToolFailure("invalid_request", "Patch contains no hunks")
    output.extend(source[source_index:])
    return "".join(output)
