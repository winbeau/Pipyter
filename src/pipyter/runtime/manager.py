from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from ..exceptions import RuntimeStateError
from ..workspace.project import ProjectBinding
from ..pigent.resources import diagnostics as pigent_diagnostics
from ..server.security import is_loopback_host
from .jupyter import build_jupyter_command, new_runtime_token, token_fingerprint
from .state import RuntimeState, pid_alive


class RuntimeManager:
    def __init__(self, project: ProjectBinding):
        self.project = project
        self.state_path = project.runtime_state_path
        self.log_dir = project.metadata_dir / "logs"

    def state(self) -> RuntimeState | None:
        return RuntimeState.load(self.state_path)

    def start(
        self,
        *,
        api_host: str = "127.0.0.1",
        api_port: int = 8765,
        jupyter_port: int = 8888,
        start_jupyter: bool = True,
    ) -> RuntimeState:
        if not is_loopback_host(api_host):
            raise RuntimeStateError("RuntimeManager is local-only; use 'pipyter node serve' for remote binds")
        current = self.state()
        if current and current.running:
            return current
        self.log_dir.mkdir(parents=True, exist_ok=True)
        token = new_runtime_token()
        api_log = (self.log_dir / "runtime-api.log").open("ab")
        api_env = os.environ.copy()
        api_env["PIPYTER_WORKSPACE_ROOT"] = str(self.project.root)
        api_env["PIPYTER_WORKSPACE_ID"] = self.project.workspace_id
        api_env["PIPYTER_PIGENT_BRIDGE_ENDPOINT"] = f"http://127.0.0.1:{api_port}/internal/pigent/v1"
        api_cmd = [
            sys.executable,
            "-m",
            "pipyter.server",
            "--root",
            str(self.project.root),
            "--host",
            api_host,
            "--port",
            str(api_port),
        ]
        api = _spawn(api_cmd, api_log, api_env)
        jupyter = None
        if start_jupyter:
            jupyter_log = (self.log_dir / "jupyter.log").open("ab")
            jupyter = _spawn(
                build_jupyter_command(self.project.root, port=jupyter_port, token=token),
                jupyter_log,
                os.environ.copy(),
            )
        state = RuntimeState(
            workspace_id=self.project.workspace_id,
            root=str(self.project.root),
            api_pid=api.pid,
            jupyter_pid=jupyter.pid if jupyter else None,
            api_url=f"http://{api_host}:{api_port}",
            jupyter_url=f"http://127.0.0.1:{jupyter_port}/jupyter/lab",
            token_fingerprint=token_fingerprint(token),
        )
        state.mark_started()
        state.save(self.state_path)
        return state

    def stop(self) -> RuntimeState | None:
        state = self.state()
        if not state:
            return None
        for pid in (state.jupyter_pid, state.api_pid):
            _terminate(pid)
        state.api_pid = None
        state.jupyter_pid = None
        state.status = "stopped"
        state.save(self.state_path)
        return state

    def status(self) -> dict[str, object]:
        state = self.state()
        pigent = pigent_diagnostics(verify_hashes=False)
        pigent_finding = {
            "pigent_payload_ok": pigent["payload_ok"],
            "pigent_payload_error": pigent["payload_error"],
            "pigent_node_ok": pigent["node"]["ok"],
            "pigent_node_version": pigent["node"]["version"],
            "pigent_node_required": pigent["node"]["required"],
            "pigent_node_finding": pigent["node"]["message"],
        }
        if not state:
            return {"status": "stopped", "workspace_id": self.project.workspace_id, **pigent_finding}
        return {
            "workspace_id": state.workspace_id,
            "root": state.root,
            "api_pid": state.api_pid,
            "jupyter_pid": state.jupyter_pid,
            "api_url": state.api_url,
            "jupyter_url": state.jupyter_url,
            "token_fingerprint": state.token_fingerprint,
            "started_at": state.started_at,
            "status": state.status,
            "api_alive": pid_alive(state.api_pid),
            "jupyter_alive": pid_alive(state.jupyter_pid),
            "pigent_pid": state.pigent_pid,
            "pigent_status": state.pigent_status,
            "pigent_protocol_version": state.pigent_protocol_version,
            "pigent_runtime_version": state.pigent_runtime_version,
            "pigent_started_at": state.pigent_started_at,
            "pigent_restart_count": state.pigent_restart_count,
            "pigent_active_sessions": 0,
            **pigent_finding,
        }


def _spawn(command: list[str], output, env: dict[str, str]) -> subprocess.Popen[bytes]:
    kwargs: dict[str, object] = {
        "stdout": output,
        "stderr": subprocess.STDOUT,
        "stdin": subprocess.DEVNULL,
        "env": env,
    }
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    return subprocess.Popen(command, **kwargs)  # type: ignore[arg-type]


def _terminate(pid: int | None) -> None:
    if not pid_alive(pid):
        return
    assert pid is not None
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], check=False)
        else:
            os.killpg(pid, signal.SIGTERM)
            deadline = time.time() + 2
            while time.time() < deadline and pid_alive(pid):
                time.sleep(0.05)
            if pid_alive(pid):
                os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
