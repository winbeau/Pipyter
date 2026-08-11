from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from pathlib import Path

from ..exceptions import ProjectNotLinkedError

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - Python 3.10 dependency path
    import tomli as tomllib  # type: ignore[no-redef]


@dataclass(frozen=True, slots=True)
class ProjectBinding:
    account_id: str
    project_id: str
    workspace_id: str
    name: str
    root: Path

    @property
    def metadata_dir(self) -> Path:
        return self.root / ".pipyter"

    @property
    def metadata_path(self) -> Path:
        return self.metadata_dir / "project.toml"

    @property
    def runtime_state_path(self) -> Path:
        return self.metadata_dir / "runtime.json"

    def to_dict(self) -> dict[str, str]:
        return {
            "account_id": self.account_id,
            "project_id": self.project_id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "root": str(self.root),
        }


def _toml_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def link_project(
    path: str | os.PathLike[str],
    *,
    account_id: str = "local",
    name: str | None = None,
    force: bool = False,
) -> ProjectBinding:
    root = Path(path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise ProjectNotLinkedError(f"Project directory does not exist: {root}")
    metadata_dir = root / ".pipyter"
    metadata_path = metadata_dir / "project.toml"
    if metadata_path.exists() and not force:
        return load_project(root)
    project_id = str(uuid.uuid4())
    workspace_id = str(uuid.uuid4())
    project_name = name or root.name or "workspace"
    metadata_dir.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(
        "[project]\n"
        f"account_id = {_toml_string(account_id)}\n"
        f"project_id = {_toml_string(project_id)}\n"
        f"workspace_id = {_toml_string(workspace_id)}\n"
        f"name = {_toml_string(project_name)}\n"
        f"root = {_toml_string(str(root))}\n",
        encoding="utf-8",
    )
    return ProjectBinding(account_id, project_id, workspace_id, project_name, root)


def _metadata_candidates(path: Path):
    current = path if path.is_dir() else path.parent
    yield from (current / ".pipyter" / "project.toml" for _ in [0])
    for parent in current.parents:
        yield parent / ".pipyter" / "project.toml"


def find_project(path: str | os.PathLike[str] = ".") -> Path | None:
    target = Path(path).expanduser().resolve()
    for candidate in _metadata_candidates(target):
        if candidate.is_file():
            return candidate
    return None


def load_project(path: str | os.PathLike[str] = ".") -> ProjectBinding:
    metadata_path = find_project(path)
    if metadata_path is None:
        raise ProjectNotLinkedError(
            f"No .pipyter/project.toml found at or above {Path(path).expanduser().resolve()}"
        )
    with metadata_path.open("rb") as handle:
        data = tomllib.load(handle)
    project = data.get("project", {})
    root = Path(str(project.get("root", metadata_path.parent.parent))).expanduser().resolve()
    if root != metadata_path.parent.parent.resolve():
        # The metadata root is authoritative only when it still points to the
        # directory containing the binding. This prevents copied metadata from
        # silently redirecting a runtime to another project.
        root = metadata_path.parent.parent.resolve()
    return ProjectBinding(
        account_id=str(project.get("account_id", "local")),
        project_id=str(project.get("project_id", "local-project")),
        workspace_id=str(project.get("workspace_id", "local-workspace")),
        name=str(project.get("name", root.name or "workspace")),
        root=root,
    )


__all__ = ["ProjectBinding", "find_project", "link_project", "load_project"]
