from __future__ import annotations

import base64
import errno
import os
import re
import signal
import subprocess
import threading
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

from ..protocol.pigent import TerminalSession
from ..workspace.files import resolve_workspace_path

try:  # POSIX-only imports are intentionally isolated behind the adapter.
    import fcntl
    import pty
    import struct
    import termios
except ImportError:  # pragma: no cover - exercised by the Windows adapter contract.
    fcntl = pty = struct = termios = None  # type: ignore[assignment]


DEFAULT_REPLAY_BYTES = 1024 * 1024
DEFAULT_REPLAY_CHUNKS = 2048
_SECRET_ENV_NAME = re.compile(
    r"(?:api[_-]?key|token|secret|password|authorization|credential|pipyter.*bridge|pigent.*bridge)", re.I
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TerminalPlatformUnsupported(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class OutputChunk:
    cursor: int
    data: bytes

    def envelope(self) -> dict[str, Any]:
        try:
            text = self.data.decode("utf-8")
        except UnicodeDecodeError:
            return {
                "version": 1,
                "type": "output",
                "cursor": self.cursor,
                "encoding": "base64",
                "data": base64.b64encode(self.data).decode("ascii"),
            }
        return {"version": 1, "type": "output", "cursor": self.cursor, "encoding": "utf-8", "data": text}


@dataclass(slots=True)
class SpawnedTerminal:
    process: subprocess.Popen[bytes]
    master_fd: int


class TerminalPlatformAdapter(Protocol):
    def spawn(self, executable: str, argv: list[str], cwd: Path, env: dict[str, str], cols: int, rows: int) -> SpawnedTerminal: ...

    def resize(self, master_fd: int, cols: int, rows: int) -> None: ...


class PosixTerminalAdapter:
    def _winsize(self, cols: int, rows: int) -> bytes:
        assert struct is not None
        return struct.pack("HHHH", rows, cols, 0, 0)

    def spawn(self, executable: str, argv: list[str], cwd: Path, env: dict[str, str], cols: int, rows: int) -> SpawnedTerminal:
        assert pty is not None and fcntl is not None and termios is not None
        master_fd, slave_fd = pty.openpty()
        fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, self._winsize(cols, rows))

        def child_setup() -> None:
            os.setsid()
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        try:
            process = subprocess.Popen(
                argv,
                executable=executable,
                cwd=cwd,
                env=env,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                close_fds=True,
                preexec_fn=child_setup,
            )
        except BaseException:
            os.close(master_fd)
            os.close(slave_fd)
            raise
        os.close(slave_fd)
        return SpawnedTerminal(process=process, master_fd=master_fd)

    def resize(self, master_fd: int, cols: int, rows: int) -> None:
        assert fcntl is not None and termios is not None
        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, self._winsize(cols, rows))


class WindowsTerminalAdapter:
    """ConPTY integration point. Phase 4 ships the interface, not a fake pipe terminal."""

    def spawn(self, executable: str, argv: list[str], cwd: Path, env: dict[str, str], cols: int, rows: int) -> SpawnedTerminal:
        raise TerminalPlatformUnsupported("Persistent PTY sessions require a ConPTY adapter on Windows")

    def resize(self, master_fd: int, cols: int, rows: int) -> None:
        raise TerminalPlatformUnsupported("Persistent PTY sessions require a ConPTY adapter on Windows")


@dataclass(slots=True)
class _TerminalHandle:
    id: str
    name: str
    executable: str
    cwd: Path
    cwd_display: str
    cols: int
    rows: int
    created_at: str
    process: subprocess.Popen[bytes]
    master_fd: int
    replay_bytes: int
    replay_chunks: int
    status: str = "running"
    last_exit_code: int | None = None
    chunks: deque[OutputChunk] = field(default_factory=deque)
    buffered_bytes: int = 0
    next_cursor: int = 1
    condition: threading.Condition = field(default_factory=threading.Condition)
    closed: bool = False

    def summary(self) -> TerminalSession:
        return TerminalSession(
            id=self.id,
            name=self.name,
            executable=self.executable,
            cwd=self.cwd_display,
            status=self.status,
            cols=self.cols,
            rows=self.rows,
            created_at=self.created_at,
            last_exit_code=self.last_exit_code,
        )

    def append(self, data: bytes) -> None:
        if not data:
            return
        if len(data) > self.replay_bytes:
            data = data[-self.replay_bytes :]
        with self.condition:
            chunk = OutputChunk(self.next_cursor, data)
            self.next_cursor += 1
            self.chunks.append(chunk)
            self.buffered_bytes += len(data)
            while len(self.chunks) > 1 and (
                len(self.chunks) > self.replay_chunks or self.buffered_bytes > self.replay_bytes
            ):
                removed = self.chunks.popleft()
                self.buffered_bytes -= len(removed.data)
            self.condition.notify_all()

    def mark_exited(self, exit_code: int) -> None:
        with self.condition:
            self.last_exit_code = exit_code
            if not self.closed:
                self.status = "exited"
            self.condition.notify_all()

    def replay(self, after_cursor: int) -> tuple[list[OutputChunk], int, bool]:
        with self.condition:
            earliest = self.chunks[0].cursor if self.chunks else self.next_cursor
            truncated = after_cursor < earliest - 1
            return [chunk for chunk in self.chunks if chunk.cursor > after_cursor], earliest, truncated

    def wait(self, after_cursor: int, timeout: float = 0.5) -> tuple[list[OutputChunk], str, int | None]:
        with self.condition:
            if not any(chunk.cursor > after_cursor for chunk in self.chunks) and self.status == "running":
                self.condition.wait(timeout)
            return ([chunk for chunk in self.chunks if chunk.cursor > after_cursor], self.status, self.last_exit_code)


class TerminalSessionManager:
    """Own persistent PTY processes independently of browser connections."""

    def __init__(
        self,
        root: Path,
        *,
        replay_bytes: int = DEFAULT_REPLAY_BYTES,
        replay_chunks: int = DEFAULT_REPLAY_CHUNKS,
        adapter: TerminalPlatformAdapter | None = None,
    ):
        self.root = root.expanduser().resolve()
        self.replay_bytes = replay_bytes
        self.replay_chunks = replay_chunks
        self.adapter = adapter or (PosixTerminalAdapter() if os.name == "posix" else WindowsTerminalAdapter())
        self._sessions: dict[str, _TerminalHandle] = {}
        self._lock = threading.RLock()
        self._shutdown = False

    def _next_default_name(self, executable: str) -> str:
        base = Path(executable).name or "Shell"
        with self._lock:
            names = {item.name for item in self._sessions.values() if item.status != "closed"}
        if base not in names:
            return base
        index = 2
        while f"{base} {index}" in names:
            index += 1
        return f"{base} {index}"

    def create(
        self,
        *,
        name: str | None = None,
        executable: str | None = None,
        cwd: str = ".",
        env: dict[str, str] | None = None,
        cols: int = 80,
        rows: int = 24,
        argv: list[str] | None = None,
    ) -> TerminalSession:
        if self._shutdown:
            raise RuntimeError("Terminal session manager is shut down")
        if not 2 <= cols <= 500 or not 1 <= rows <= 500:
            raise ValueError("Terminal size is out of range")
        working_directory = resolve_workspace_path(self.root, cwd)
        if not working_directory.is_dir():
            raise NotADirectoryError(cwd)
        selected = executable or os.environ.get("SHELL") or ("cmd.exe" if os.name == "nt" else "/bin/bash")
        if "\x00" in selected:
            raise ValueError("Executable cannot contain NUL bytes")
        arguments = list(argv) if argv is not None else [selected]
        if not arguments:
            raise ValueError("argv cannot be empty")
        child_env = {key: value for key, value in os.environ.items() if not _SECRET_ENV_NAME.search(key)}
        child_env.update({"TERM": child_env.get("TERM", "xterm-256color"), "COLUMNS": str(cols), "LINES": str(rows)})
        for key, value in (env or {}).items():
            if not isinstance(key, str) or not isinstance(value, str) or "\x00" in key or "\x00" in value or "=" in key:
                raise ValueError("Terminal environment keys and values must be strings without NUL; keys cannot contain '='")
            child_env[key] = value
        spawned = self.adapter.spawn(selected, arguments, working_directory, child_env, cols, rows)
        session_id = "shell_" + uuid.uuid4().hex
        display_cwd = working_directory.relative_to(self.root).as_posix() or "."
        handle = _TerminalHandle(
            id=session_id,
            name=name or self._next_default_name(selected),
            executable=selected,
            cwd=working_directory,
            cwd_display=display_cwd,
            cols=cols,
            rows=rows,
            created_at=_now(),
            process=spawned.process,
            master_fd=spawned.master_fd,
            replay_bytes=self.replay_bytes,
            replay_chunks=self.replay_chunks,
        )
        with self._lock:
            self._sessions[session_id] = handle
        threading.Thread(target=self._read_output, args=(handle,), name=f"pipyter-{session_id}", daemon=True).start()
        return handle.summary()

    def attach_command(
        self,
        command: str,
        *,
        cwd: str = ".",
        env: dict[str, str] | None = None,
        name: str | None = None,
        cols: int = 80,
        rows: int = 24,
    ) -> TerminalSession:
        """Create the PTY used by a Pigent interaction handoff and return its public attachment."""
        if not command or "\x00" in command:
            raise ValueError("command must be non-empty and contain no NUL bytes")
        shell = os.environ.get("SHELL") or "/bin/sh"
        return self.create(
            name=name or "Pigent interaction",
            executable=shell,
            argv=[shell, "-lc", command],
            cwd=cwd,
            env=env,
            cols=cols,
            rows=rows,
        )

    def attach(self, session_id: str) -> TerminalSession:
        """Reserved public handoff interface: attaching never creates or restarts a process."""
        return self.get(session_id)

    def list(self) -> list[TerminalSession]:
        with self._lock:
            return [item.summary() for item in sorted(self._sessions.values(), key=lambda value: value.created_at)]

    def get(self, session_id: str) -> TerminalSession:
        return self._require(session_id).summary()

    def input(self, session_id: str, data: bytes | str) -> None:
        handle = self._require(session_id)
        if handle.status != "running":
            raise RuntimeError("Terminal session is not running")
        payload = data.encode("utf-8") if isinstance(data, str) else data
        if payload:
            os.write(handle.master_fd, payload)

    def resize(self, session_id: str, cols: int, rows: int) -> TerminalSession:
        if not 2 <= cols <= 500 or not 1 <= rows <= 500:
            raise ValueError("Terminal size is out of range")
        handle = self._require(session_id)
        if handle.status == "closed":
            raise RuntimeError("Terminal session is closed")
        self.adapter.resize(handle.master_fd, cols, rows)
        handle.cols, handle.rows = cols, rows
        return handle.summary()

    def signal(self, session_id: str, signal_value: int | str) -> TerminalSession:
        handle = self._require(session_id)
        if handle.status != "running":
            return handle.summary()
        signum = self._signal_number(signal_value)
        if os.name == "posix":
            os.killpg(handle.process.pid, signum)
        else:  # pragma: no cover - reserved for ConPTY implementation.
            handle.process.send_signal(signum)
        return handle.summary()

    def exit(self, session_id: str) -> TerminalSession:
        handle = self._require(session_id)
        if handle.status == "running":
            self.input(session_id, b"\x04")
        return handle.summary()

    def close(self, session_id: str) -> None:
        handle = self._require(session_id)
        self._terminate(handle, closed=True)

    def shutdown(self) -> None:
        with self._lock:
            self._shutdown = True
            handles = list(self._sessions.values())
        for handle in handles:
            self._terminate(handle, closed=True)

    def replay(self, session_id: str, after_cursor: int = 0) -> tuple[list[OutputChunk], int, bool]:
        if after_cursor < 0:
            raise ValueError("cursor cannot be negative")
        return self._require(session_id).replay(after_cursor)

    def wait(self, session_id: str, after_cursor: int, timeout: float = 0.5) -> tuple[list[OutputChunk], str, int | None]:
        return self._require(session_id).wait(after_cursor, timeout)

    def cursor(self, session_id: str) -> int:
        handle = self._require(session_id)
        with handle.condition:
            return handle.next_cursor - 1

    def _read_output(self, handle: _TerminalHandle) -> None:
        try:
            while True:
                try:
                    data = os.read(handle.master_fd, 65536)
                except OSError as error:
                    if error.errno in (errno.EIO, errno.EBADF):
                        break
                    raise
                if not data:
                    break
                handle.append(data)
        finally:
            try:
                exit_code = handle.process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                exit_code = handle.process.poll()
            handle.mark_exited(exit_code if exit_code is not None else -1)
            try:
                os.close(handle.master_fd)
            except OSError:
                pass

    def _terminate(self, handle: _TerminalHandle, *, closed: bool) -> None:
        with handle.condition:
            if closed:
                handle.closed = True
                handle.status = "closed"
            handle.condition.notify_all()
        if handle.process.poll() is None:
            try:
                if os.name == "posix":
                    os.killpg(handle.process.pid, signal.SIGTERM)
                else:  # pragma: no cover
                    handle.process.terminate()
                handle.process.wait(timeout=1.5)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                if handle.process.poll() is None:
                    try:
                        if os.name == "posix":
                            os.killpg(handle.process.pid, signal.SIGKILL)
                        else:  # pragma: no cover
                            handle.process.kill()
                    except ProcessLookupError:
                        pass
                    try:
                        handle.process.wait(timeout=1)
                    except subprocess.TimeoutExpired:
                        pass
        if handle.last_exit_code is None:
            handle.last_exit_code = handle.process.poll()
        try:
            os.close(handle.master_fd)
        except OSError:
            pass
        with handle.condition:
            handle.condition.notify_all()

    def _require(self, session_id: str) -> _TerminalHandle:
        with self._lock:
            try:
                return self._sessions[session_id]
            except KeyError as error:
                raise KeyError(f"Terminal session not found: {session_id}") from error

    @staticmethod
    def _signal_number(value: int | str) -> int:
        if isinstance(value, int):
            return value
        normalized = value.upper()
        if not normalized.startswith("SIG"):
            normalized = "SIG" + normalized
        result = getattr(signal, normalized, None)
        if not isinstance(result, signal.Signals):
            raise ValueError(f"Unknown signal: {value}")
        return int(result)
