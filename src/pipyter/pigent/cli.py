from __future__ import annotations

import argparse
import json
import sys

from .. import __version__
from .config import PigentConfigError, PigentConfigStore
from .resources import diagnostics


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pigent", description="Pigent packaged runtime diagnostics")
    parser.add_argument("--version", action="version", version=f"pigent {__version__}")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="Verify bundled payload, Node prerequisite, and two-file configuration")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command != "doctor":
        return 0
    finding = diagnostics(verify_hashes=True)
    store = PigentConfigStore()
    try:
        store.initialize()
        settings = store.read_settings()
        store.read_auth()
        finding["config_ok"] = True
        finding["config_directory"] = str(store.directory)
        finding["config_files"] = [store.auth_path.name, store.settings_path.name]
        finding["model_configured"] = bool(settings.value.get("defaultProvider") and settings.value.get("defaultModel"))
    except PigentConfigError as error:
        finding["config_ok"] = False
        finding["config_error"] = str(error)
    print(json.dumps(finding, indent=2, sort_keys=True))
    return 0 if finding.get("payload_ok") and finding.get("config_ok") and finding["node"]["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
