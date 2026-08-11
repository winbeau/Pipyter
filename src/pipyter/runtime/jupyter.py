from __future__ import annotations

import hashlib
import secrets
import sys
from pathlib import Path


def new_runtime_token() -> str:
    return secrets.token_urlsafe(32)


def token_fingerprint(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]


def build_jupyter_command(
    root: Path,
    *,
    port: int = 8888,
    base_url: str = "/jupyter/",
    token: str,
) -> list[str]:
    return [
        sys.executable,
        "-m",
        "jupyterlab",
        f"--ServerApp.root_dir={root}",
        "--ServerApp.ip=127.0.0.1",
        f"--ServerApp.port={port}",
        "--ServerApp.open_browser=False",
        "--ServerApp.allow_remote_access=False",
        f"--ServerApp.base_url={base_url}",
        f"--IdentityProvider.token={token}",
    ]
