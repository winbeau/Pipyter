from __future__ import annotations

import os
import subprocess
import uuid
from pathlib import Path

from ..protocol.models import TerminalExecuteResponse
from ..workspace.files import resolve_workspace_path


class TerminalRuntime:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.session_id = str(uuid.uuid4())
        self.history: list[str] = []

    def execute(self, command: str, cwd: str = ".", timeout: float = 15) -> TerminalExecuteResponse:
        working_directory = resolve_workspace_path(self.root, cwd)
        if not working_directory.is_dir():
            raise NotADirectoryError(cwd)
        self.history.append(command)
        result = subprocess.run(
            command,
            cwd=working_directory,
            shell=True,
            executable=None if os.name == "nt" else "/bin/bash",
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return TerminalExecuteResponse(
            session_id=self.session_id,
            command=command,
            cwd=working_directory.relative_to(self.root).as_posix() or ".",
            stdout=result.stdout,
            stderr=result.stderr,
            exit_code=result.returncode,
        )
