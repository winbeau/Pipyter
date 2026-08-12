from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import socket
import sys
import threading
import webbrowser
from pathlib import Path

from .. import __version__
from ..admin import AdminConfigStore, MULTI_USER_MODE, SINGLE_USER_MODE
from ..auth.device import login_local, login_with_device_flow
from ..config import load_credentials
from ..exceptions import PipyterError, ProjectNotLinkedError
from ..runtime.manager import RuntimeManager
from ..server.security import bridge_endpoint, is_loopback_host
from ..pigent.config import PigentConfigError, PigentConfigStore
from ..pigent.resources import diagnostics as pigent_diagnostics
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

    lab = commands.add_parser("lab", help="Launch the Pipyter Workspace web UI for the current project")
    lab.add_argument("path", nargs="?", default=".")
    lab.add_argument("--host", default="127.0.0.1")
    lab.add_argument("--port", type=int, default=8895)
    lab.add_argument("--no-browser", action="store_true", help="Do not open a browser tab automatically")
    lab.add_argument("--verbose", action="store_true", help="Show per-request access logs")

    node = commands.add_parser("node", help="Run and manage a compute-node Runtime")
    node_commands = node.add_subparsers(dest="node_command", required=True)
    node_serve = node_commands.add_parser("serve", help="Serve one compute Workspace without opening a browser")
    node_serve.add_argument("path", nargs="?", default=".")
    node_serve.add_argument("--host", default="127.0.0.1")
    node_serve.add_argument("--port", type=int, default=8765)
    node_serve.add_argument("--token-file", help="Restricted file containing the Runtime Bearer token")
    node_serve.add_argument("--allowed-origin", action="append", default=[])
    node_serve.add_argument("--node-id")
    node_serve.add_argument("--user", help="Managed user selected from multi-user admin configuration")
    node_serve.add_argument("--verbose", action="store_true")

    admin = commands.add_parser("admin", help="Manage deployment mode and user directory layout")
    admin_commands = admin.add_subparsers(dest="admin_command")
    admin_commands.add_parser("status", help="Show deployment mode and managed users")
    admin_mode = admin_commands.add_parser("mode", help="Set the mutually exclusive deployment mode")
    admin_mode_commands = admin_mode.add_subparsers(dest="admin_mode_command", required=True)
    admin_mode_set = admin_mode_commands.add_parser("set")
    admin_mode_set.add_argument("mode", choices=[SINGLE_USER_MODE, MULTI_USER_MODE])
    admin_mode_set.add_argument("--users-root")
    admin_mode_set.add_argument("--force", action="store_true", help="Acknowledge an explicit mode switch")
    admin_user = admin_commands.add_parser("user", help="Manage multi-user directory layouts")
    admin_user_commands = admin_user.add_subparsers(dest="admin_user_command", required=True)
    admin_user_add = admin_user_commands.add_parser("add")
    admin_user_add.add_argument("name")
    admin_user_commands.add_parser("list")
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
        if args.command == "lab":
            return _lab(args)
        if args.command == "node":
            return _node(args)
        if args.command == "admin":
            return _admin(args)
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
        credentials = load_credentials()
        binding = link_project(
            args.path,
            account_id=credentials.account_id if credentials else "local",
            name=args.name,
            force=args.force,
        )
        print(json.dumps(binding.to_dict(), indent=2))
        return 0
    binding = load_project(args.path)
    print(json.dumps(binding.to_dict(), indent=2))
    return 0


def _up(args: argparse.Namespace) -> int:
    _require_single_user_mode("pipyter up")
    if not is_loopback_host(args.api_host):
        raise PipyterError("pipyter up is local-only; use 'pipyter node serve' for a remote Runtime")
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
    checks["api_port_8895_free"] = _port_free(8895)
    pigent = pigent_diagnostics(verify_hashes=True)
    checks["pigent_payload_ok"] = bool(pigent["payload_ok"])
    checks["pigent_payload_error"] = pigent.get("payload_error") or ""
    checks["pigent_node_ok"] = bool(pigent["node"]["ok"])
    checks["pigent_node_required"] = str(pigent["node"]["required"])
    checks["pigent_node_version"] = str(pigent["node"].get("version") or "")
    checks["pigent_node_finding"] = str(pigent["node"]["message"])
    checks["pigent_uv_ok"] = bool(pigent["uv"]["ok"])
    checks["pigent_uv_required"] = str(pigent["uv"]["required"])
    checks["pigent_uv_version"] = str(pigent["uv"].get("version") or "")
    checks["pigent_uv_finding"] = str(pigent["uv"]["message"])
    try:
        config = PigentConfigStore()
        checks["pigent_config_directory"] = str(config.directory)
        checks["pigent_config_initialized"] = config.settings_path.exists() and config.auth_path.exists()
        if checks["pigent_config_initialized"]:
            config.read_settings()
            config.read_auth()
        checks["pigent_config_ok"] = True
    except PigentConfigError as error:
        checks["pigent_config_ok"] = False
        checks["pigent_config_error"] = str(error)
    print(json.dumps(checks, indent=2))
    failed = [
        key for key, value in checks.items()
        if not key.startswith("pigent_")
        and key.endswith(("_ok", "_importable", "_linked", "_writable"))
        and value is False
    ]
    return 1 if failed else 0


def _serve(args: argparse.Namespace) -> int:
    import uvicorn

    from ..server.app import create_app

    _require_single_user_mode("pipyter serve")
    project = load_project(args.path)
    if not is_loopback_host(args.host):
        raise PipyterError("pipyter serve is local-only; use 'pipyter node serve' for a remote Runtime")
    token = os.environ.get("PIPYTER_RUNTIME_TOKEN")
    internal_endpoint = bridge_endpoint(args.host, args.port)
    if args.reload:
        os.environ["PIPYTER_WORKSPACE_ROOT"] = str(project.root)
        os.environ["PIPYTER_PIGENT_BRIDGE_ENDPOINT"] = internal_endpoint
        uvicorn.run(
            "pipyter.server.app:create_app",
            factory=True,
            host=args.host,
            port=args.port,
            reload=True,
        )
    else:
        uvicorn.run(
            create_app(project.root, runtime_token=token, bridge_endpoint=internal_endpoint),
            host=args.host,
            port=args.port,
        )
    return 0


def _open_browser(url: str) -> None:
    """Open the URL in a browser, or print it on headless sessions."""
    headless = (
        os.name != "nt"
        and sys.platform != "darwin"
        and not os.environ.get("DISPLAY")
        and not os.environ.get("WAYLAND_DISPLAY")
    )
    if headless:
        print(f"No graphical session detected — open the Workspace manually: {url}", flush=True)
        return
    webbrowser.open(url)


def _lab(args: argparse.Namespace) -> int:
    """Launch the Workspace web UI: auto-link the directory, serve the bundled
    portal and API on one origin, and open the browser at the Workspace page."""
    import uvicorn

    _require_single_user_mode("pipyter lab")
    if not is_loopback_host(args.host):
        raise PipyterError("pipyter lab is local-only; use 'pipyter node serve' for a remote Runtime")

    from ..server.app import create_app

    try:
        project = load_project(args.path)
    except ProjectNotLinkedError:
        project = link_project(args.path)
        print(f"Linked workspace {project.name} at {project.root}", flush=True)

    url = f"http://{args.host}:{args.port}/#/workspace"
    print(f"Pipyter Workspace: {url}", flush=True)
    print(f"Workspace root: {project.root}", flush=True)
    if not args.no_browser:
        threading.Timer(0.8, lambda: _open_browser(url)).start()
    uvicorn.run(
        create_app(
            project.root,
            bridge_endpoint=bridge_endpoint(args.host, args.port),
        ),
        host=args.host,
        port=args.port,
        access_log=args.verbose,
        log_level="info" if args.verbose else "warning",
    )
    return 0


def _node(args: argparse.Namespace) -> int:
    import uvicorn

    from ..server.app import create_app
    from ..server.security import read_token_file

    project = load_project(args.path)
    config_root: Path | None = None
    store = AdminConfigStore()
    config = store.read()
    if config.mode == MULTI_USER_MODE and not args.user:
        raise PipyterError("multi-user mode requires 'pipyter node serve --user <name>'")
    if config.mode == SINGLE_USER_MODE and args.user:
        raise PipyterError("--user is available only in multi-user mode")
    if args.user:
        if args.user not in config.users:
            raise PipyterError(f"Managed user is not registered: {args.user}")
        layout = store.layout(args.user, config=config)
        try:
            project.root.relative_to(layout.workspaces_root)
        except ValueError as error:
            raise PipyterError(
                f"Workspace {project.root} is outside managed user root {layout.workspaces_root}"
            ) from error
        config_root = layout.config_root
    token = read_token_file(args.token_file) if args.token_file else os.environ.get("PIPYTER_RUNTIME_TOKEN")
    origins = args.allowed_origin or [
        value.strip() for value in os.environ.get("PIPYTER_ALLOWED_ORIGINS", "").split(",") if value.strip()
    ]
    if not is_loopback_host(args.host) and not token:
        raise PipyterError("A Runtime token is required when node serve binds a non-loopback host")
    if not is_loopback_host(args.host) and not origins:
        raise PipyterError("At least one --allowed-origin is required for a non-loopback node")
    node_id = args.node_id or os.environ.get("PIPYTER_NODE_ID") or socket.gethostname()
    print(f"Pipyter node {node_id}: http://{args.host}:{args.port}", flush=True)
    print(f"Workspace root: {project.root}", flush=True)
    if token:
        print("Runtime API authentication: enabled", flush=True)
    uvicorn.run(
        create_app(
            project.root,
            runtime_token=token,
            allowed_origins=origins or None,
            bridge_endpoint=bridge_endpoint(args.host, args.port),
            config_root=config_root,
            node_id=node_id,
        ),
        host=args.host,
        port=args.port,
        access_log=args.verbose,
        log_level="info" if args.verbose else "warning",
    )
    return 0


def _admin(args: argparse.Namespace) -> int:
    store = AdminConfigStore()
    if args.admin_command is None:
        if sys.stdin.isatty() and sys.stdout.isatty():
            return _admin_console(store)
        print(json.dumps(store.status(), ensure_ascii=False, indent=2))
        return 0
    if args.admin_command == "status":
        print(json.dumps(store.status(), ensure_ascii=False, indent=2))
        return 0
    if args.admin_command == "mode" and args.admin_mode_command == "set":
        config = store.set_mode(
            args.mode,
            users_root=args.users_root,
            force=args.force,
        )
        print(json.dumps(config.to_dict(), ensure_ascii=False, indent=2))
        return 0
    if args.admin_command == "user" and args.admin_user_command == "add":
        print(json.dumps(store.add_user(args.name).to_dict(), ensure_ascii=False, indent=2))
        return 0
    if args.admin_command == "user" and args.admin_user_command == "list":
        print(json.dumps([item.to_dict() for item in store.users()], ensure_ascii=False, indent=2))
        return 0
    raise PipyterError("Unsupported admin command")


def _admin_console(store: AdminConfigStore) -> int:
    while True:
        status = store.status()
        print(f"\nPipyter admin · mode: {status['mode']}")
        print("1) Use single-user mode")
        print("2) Use multi-user mode")
        print("3) Add managed user")
        print("4) Show status")
        print("q) Quit")
        choice = input("Select: ").strip().lower()
        if choice in {"q", "quit", "exit"}:
            return 0
        if choice == "1":
            store.set_mode(SINGLE_USER_MODE, force=True)
        elif choice == "2":
            root = input("Users root: ").strip()
            if root:
                store.set_mode(MULTI_USER_MODE, users_root=root, force=True)
        elif choice == "3":
            name = input("Managed user name: ").strip()
            if name:
                layout = store.add_user(name)
                print(json.dumps(layout.to_dict(), ensure_ascii=False, indent=2))
        elif choice == "4":
            print(json.dumps(status, ensure_ascii=False, indent=2))
        else:
            print("Unknown selection")


def _require_single_user_mode(command: str) -> None:
    config = AdminConfigStore().read()
    if config.mode != SINGLE_USER_MODE:
        raise PipyterError(
            f"{command} is a single-user command; switch with "
            "'pipyter admin mode set single-user --force' or run a managed node with --user"
        )


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
