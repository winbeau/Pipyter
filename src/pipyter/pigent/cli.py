from __future__ import annotations

import argparse
import json
import sys

from .. import __version__
from .config import PigentConfigError, PigentConfigStore
from .migration import PigentConfigMigrationService, PigentMigrationError
from .resources import diagnostics


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pigent", description="Pigent packaged runtime diagnostics")
    parser.add_argument("--version", action="version", version=f"pigent {__version__}")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="Verify bundled payload, Node/uv prerequisites, and two-file configuration")
    config = commands.add_parser("config", help="Migrate and recover Pigent provider configuration")
    config_commands = config.add_subparsers(dest="config_command", required=True)
    migrate = config_commands.add_parser("migrate-ssh", help="Preview or apply a provider-scoped SSH migration")
    migrate.add_argument("--source", required=True, help="Trusted OpenSSH alias")
    migrate.add_argument("--provider", required=True)
    migrate.add_argument("--source-config-dir")
    mode = migrate.add_mutually_exclusive_group(required=True)
    mode.add_argument("--preview", action="store_true")
    mode.add_argument("--apply", action="store_true")
    migrate.add_argument("--preview-token")
    rollback = config_commands.add_parser("rollback", help="Restore a private migration backup")
    rollback.add_argument("migration_id")
    rollback.add_argument("--force", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    store = PigentConfigStore()
    if args.command == "config":
        service = PigentConfigMigrationService(store)
        try:
            if args.config_command == "migrate-ssh":
                if args.preview:
                    value = service.preview_ssh(args.source, args.provider, args.source_config_dir).as_dict()
                else:
                    value = service.apply_ssh(
                        args.source, args.provider, preview_token=args.preview_token,
                        source_config_dir=args.source_config_dir,
                    )
            else:
                value = service.rollback(args.migration_id, force=args.force)
        except (PigentConfigError, PigentMigrationError) as error:
            print(json.dumps({"ok": False, "code": str(error).split(":", 1)[0], "message": "Pigent configuration operation failed"}, sort_keys=True), file=sys.stderr)
            return 2
        print(json.dumps({"ok": True, **value}, indent=2, sort_keys=True))
        return 0
    finding = diagnostics(verify_hashes=True)
    try:
        store.initialize()
        settings = store.read_settings()
        store.read_auth()
        finding["config_ok"] = True
        finding["config_scope"] = "user"
        finding["config_files"] = [store.settings_path.name, store.auth_path.name]
        finding["model_configured"] = bool(settings.value.get("defaultProvider") and settings.value.get("defaultModel"))
    except PigentConfigError as error:
        finding["config_ok"] = False
        finding["config_error"] = str(error)
    print(json.dumps(finding, indent=2, sort_keys=True))
    return 0 if finding.get("payload_ok") and finding.get("config_ok") and finding["node"]["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
