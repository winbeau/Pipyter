from __future__ import annotations

import argparse

import os

import uvicorn

from .app import create_app
from .security import bridge_endpoint, is_loopback_host, read_token_file


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Pipyter Runtime API")
    parser.add_argument("--root", default=".")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--reload", action="store_true")
    parser.add_argument("--token-file")
    parser.add_argument("--allowed-origin", action="append", default=[])
    parser.add_argument("--node-id")
    parser.add_argument("--config-root")
    args = parser.parse_args()
    token = read_token_file(args.token_file) if args.token_file else os.environ.get("PIPYTER_RUNTIME_TOKEN")
    origins = args.allowed_origin or [
        value.strip() for value in os.environ.get("PIPYTER_ALLOWED_ORIGINS", "").split(",") if value.strip()
    ]
    if not is_loopback_host(args.host) and not token:
        parser.error("a Runtime token is required for a non-loopback bind")
    if not is_loopback_host(args.host) and not origins:
        parser.error("at least one --allowed-origin is required for a non-loopback bind")
    uvicorn.run(
        create_app(
            args.root,
            runtime_token=token,
            allowed_origins=origins or None,
            bridge_endpoint=bridge_endpoint(args.host, args.port),
            config_root=args.config_root,
            node_id=args.node_id,
        ),
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
