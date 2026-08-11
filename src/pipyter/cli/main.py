from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import socket
import sys
from pathlib import Path

from .. import __version__
from ..auth.device import login_local, login_with_device_flow
from ..config import load_credentials
from ..exceptions import PipyterError
from ..runtime.manager import RuntimeManager
from ..workspace.project import find_project, link_project, load_project

DEFAULT_CONTROL_URL = "https://pipyter.icthub.top"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pipyter", description="Pipyter scientific workspace runtime")
    parser.add_argument("--version", action="version", version=f"pipyter {__version__}")
    commands = parser.add_subparsers(dest="command", required=True)

    auth = commands.add_parser("auth", help="Manage Pipyter credentials")
    auth_commands = auth.add_subparsers(dest="auth_command", required=True)
    login = auth_commands.add_parser("login", help="Sign in using device authorization")
    login.add_argument("--server", default=DEFAULT_CONTROL_URL)
    login.add_argument("--local", action="store_true", help="Create a local development credential")
    login.add_argument("--no-browser", action="store_true")

    project = commands.add_parser("project", help="Manage project directory binding")
    project_commands = project.add_subparsers(dest="project_command", required=True)
    link = project_commands.add_parser("link")
    link.add_argument("path", nargs="?", default=".")
    link.add_argument("--name")
    link.add_argument("--force", action="store_true")
    show = project_commands.add_parser("show")
    show.add_argument("path", nargs="?", default=".")

    for name in ("up", "down", "status", "doctor"):
        command = commands.add_parser(name)
        command.add_argument("path", nargs="?", default=".")
    up = commands.choices["up"]
    up.add_argument("--api-host", default="127.0.0.1")
    up.add_argument("--api-port", type=int, default=8765)
    up.add_argument("--jupyter-port", type=int, default=8888)
    up.add_argument("--no-jupyter", action="store_true")

    serve = commands.add_parser("serve", help="Run the Pipyter Runtime API")
    serve.add_argument("path", nargs="?", default=".")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--reload", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "auth":
            return _auth(args)
        if args.command == "project":
            return _project(args)
        if args.command == "up":
            return _up(args)
        if args.command == "down":
            return _down(args)
        if args.command == "status":
            return _status(args)
        if args.command == "doctor":
            return _doctor(args)
        if args.command == "serve":
            return _serve(args)
    except PipyterError as error:
        print(f"pipyter: {error}", file=sys.stderr)
        return 2
    except (FileNotFoundError, ValueError, OSError) as error:
        print(f"pipyter: {error}", file=sys.stderr)
        return 2
    return 0


def _auth(args: argparse.Namespace) -> int:
    credentials = login_local(args.server) if args.local else login_with_device_flow(
        args.server, open_browser=not args.no_browser
    )
    print(json.dumps({"account_id": credentials.account_id, "server_url": credentials.server_url}, indent=2))
    return 0


def _project(args: argparse.Namespace) -> int:
    if args.project_command == "link":
        binding = link_project(args.path, name=args.name, force=args.force)
        print(json.dumps(binding.to_dict(), indent=2))
        return 0
    binding = load_project(args.path)
    print(json.dumps(binding.to_dict(), indent=2))
    return 0


def _up(args: argparse.Namespace) -> int:
    project = load_project(args.path)
    manager = RuntimeManager(project)
    state = manager.start(
        api_host=args.api_host,
        api_port=args.api_port,
        jupyter_port=args.jupyter_port,
        start_jupyter=not args.no_jupyter,
    )
    print(json.dumps(manager.status(), indent=2))
    return 0 if state.status == "running" else 1


def _down(args: argparse.Namespace) -> int:
    project = load_project(args.path)
    RuntimeManager(project).stop()
    print(f"Stopped workspace {project.name}")
    return 0


def _status(args: argparse.Namespace) -> int:
    project = load_project(args.path)
    print(json.dumps(RuntimeManager(project).status(), indent=2))
    return 0


def _doctor(args: argparse.Namespace) -> int:
    project_path = find_project(args.path)
    checks: dict[str, bool | str] = {
        "python": sys.version.split()[0],
        "python_ok": sys.version_info >= (3, 10),
        "pipyter": True,
        "jupyterlab_importable": importlib.util.find_spec("jupyterlab") is not None,
        "jupyter_client_importable": importlib.util.find_spec("jupyter_client") is not None,
        "uv_available": shutil.which("uv") is not None,
        "project_linked": project_path is not None,
    }
    if project_path:
        project = load_project(args.path)
        checks["workspace_root"] = str(project.root)
        checks["workspace_writable"] = project.root.is_dir() and _writable(project.root)
    else:
        checks["workspace_writable"] = False
    checks["credentials_present"] = load_credentials() is not None
    checks["api_port_8765_free"] = _port_free(8765)
    print(json.dumps(checks, indent=2))
    failed = [key for key, value in checks.items() if key.endswith(("_ok", "_importable", "_linked", "_writable")) and value is False]
    return 1 if failed else 0


def _serve(args: argparse.Namespace) -> int:
    import uvicorn

    from ..server.app import create_app

    project = load_project(args.path)
    if args.reload:
        os.environ["PIPYTER_WORKSPACE_ROOT"] = str(project.root)
        uvicorn.run(
            "pipyter.server.app:create_app",
            factory=True,
            host=args.host,
            port=args.port,
            reload=True,
        )
    else:
        uvicorn.run(create_app(project.root), host=args.host, port=args.port)
    return 0


def _writable(path: Path) -> bool:
    try:
        return path.stat().st_mode & 0o200 != 0
    except OSError:
        return False


def _port_free(port: int) -> bool:
    with socket.socket() as sock:
        sock.settimeout(0.1)
        return sock.connect_ex(("127.0.0.1", port)) != 0


if __name__ == "__main__":
    raise SystemExit(main())
