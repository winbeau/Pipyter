from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from ..exceptions import UnsafePathError
from ..protocol.models import FileEntry

MAX_TEXT_BYTES = 8 * 1024 * 1024


def content_revision(raw: bytes) -> str:
    """Return the shared opaque revision used by structured file operations."""
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def atomic_write_bytes(path: Path, raw: bytes) -> None:
    """Atomically replace one target while preserving normal OS permissions/errors."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def resolve_workspace_path(root: Path, relative: str | os.PathLike[str] = ".") -> Path:
    root = root.expanduser().resolve()
    requested = Path(relative)
    if requested.is_absolute():
        raise UnsafePathError("Workspace paths must be relative")
    candidate = (root / requested).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise UnsafePathError(f"Path escapes workspace root: {relative}") from error
    return candidate


def file_kind(path: Path) -> str:
    if path.is_dir():
        return "directory"
    if path.suffix == ".ipynb":
        return "notebook"
    if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
        return "image"
    return "file"


def list_entries(root: Path, relative: str = ".") -> list[FileEntry]:
    directory = resolve_workspace_path(root, relative)
    if not directory.exists() or not directory.is_dir():
        raise FileNotFoundError(relative)
    entries: list[FileEntry] = []
    for item in directory.iterdir():
        if item.name == ".pipyter":
            continue
        stat = item.stat()
        entries.append(
            FileEntry(
                path=item.relative_to(root.resolve()).as_posix(),
                name=item.name,
                type=file_kind(item),  # type: ignore[arg-type]
                size=None if item.is_dir() else stat.st_size,
                modified=stat.st_mtime,
            )
        )
    return sorted(entries, key=lambda entry: (entry.type != "directory", entry.name.lower()))


def read_text(root: Path, relative: str) -> str:
    path = resolve_workspace_path(root, relative)
    if not path.is_file():
        raise FileNotFoundError(relative)
    if path.stat().st_size > MAX_TEXT_BYTES:
        raise ValueError(f"File exceeds {MAX_TEXT_BYTES} bytes")
    return path.read_text(encoding="utf-8")


def write_text(root: Path, relative: str, content: str) -> Path:
    path = resolve_workspace_path(root, relative)
    atomic_write_bytes(path, content.encode("utf-8"))
    return path


def create_directory(root: Path, relative: str) -> Path:
    path = resolve_workspace_path(root, relative)
    path.mkdir(parents=True, exist_ok=False)
    return path


def delete_path(root: Path, relative: str) -> None:
    path = resolve_workspace_path(root, relative)
    if path == root.resolve():
        raise UnsafePathError("Cannot delete the workspace root")
    if path == root.resolve() / ".pipyter" or path.is_relative_to(root.resolve() / ".pipyter"):
        raise UnsafePathError("Cannot delete Pipyter metadata (.pipyter)")
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()
    else:
        raise FileNotFoundError(relative)


def read_notebook(root: Path, relative: str) -> dict[str, Any]:
    path = resolve_workspace_path(root, relative)
    if path.suffix != ".ipynb":
        raise ValueError("Notebook path must end with .ipynb")
    return json.loads(read_text(root, relative))


def write_notebook(root: Path, relative: str, notebook: dict[str, Any]) -> Path:
    if Path(relative).suffix != ".ipynb":
        raise ValueError("Notebook path must end with .ipynb")
    return write_text(root, relative, json.dumps(notebook, ensure_ascii=False, indent=1) + "\n")
