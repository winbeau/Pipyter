from __future__ import annotations

import os
import secrets
import stat
from collections.abc import Iterable


class RuntimeAuthMiddleware:
    """Authenticate public Runtime HTTP and WebSocket traffic.

    The private Pigent bridge has its own credential and is intentionally outside
    the `/api/v1/` path guarded here.
    """

    def __init__(self, app, *, token: str | None = None, allowed_origins: Iterable[str] = ()):
        self.app = app
        self.token = token or None
        self.allowed_origins = frozenset(origin.rstrip("/") for origin in allowed_origins if origin)

    async def __call__(self, scope, receive, send) -> None:
        path = str(scope.get("path", ""))
        kind = scope.get("type")
        if not path.startswith("/api/v1/") or kind not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        if kind == "http" and str(scope.get("method", "")).upper() == "OPTIONS":
            await self.app(scope, receive, send)
            return
        if self.token and not _valid_bearer(headers.get(b"authorization"), self.token):
            if kind == "websocket":
                await send({"type": "websocket.close", "code": 1008, "reason": "runtime authorization required"})
            else:
                await send({
                    "type": "http.response.start",
                    "status": 401,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"www-authenticate", b"Bearer"),
                    ],
                })
                await send({
                    "type": "http.response.body",
                    "body": b'{"detail":"runtime authorization required"}',
                })
            return
        if kind == "websocket" and self.allowed_origins:
            raw_origin = headers.get(b"origin")
            origin = raw_origin.decode("latin-1").rstrip("/") if raw_origin else ""
            if not origin or origin not in self.allowed_origins:
                await send({"type": "websocket.close", "code": 1008, "reason": "origin not allowed"})
                return
        await self.app(scope, receive, send)


def _valid_bearer(raw: bytes | None, expected: str) -> bool:
    if raw is None:
        return False
    try:
        value = raw.decode("latin-1")
    except UnicodeDecodeError:
        return False
    scheme, separator, token = value.partition(" ")
    return bool(separator) and scheme.lower() == "bearer" and secrets.compare_digest(token, expected)


def is_loopback_host(host: str) -> bool:
    import ipaddress

    normalized = host.strip().lower().strip("[]")
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def bridge_endpoint(host: str, port: int) -> str:
    normalized = host.strip().strip("[]")
    if normalized == "0.0.0.0":
        normalized = "127.0.0.1"
    elif normalized == "::":
        normalized = "::1"
    display = f"[{normalized}]" if ":" in normalized else normalized
    return f"http://{display}:{port}/internal/pigent/v1"


def read_token_file(path: str) -> str:
    from pathlib import Path

    token_path = Path(path).expanduser().absolute()
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(token_path, flags)
    except OSError as error:
        raise ValueError(f"Cannot securely open Runtime token file {token_path}: {error}") from error
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            raise ValueError(f"Runtime token path is not a regular file: {token_path}")
        if os.name == "posix":
            if metadata.st_uid != os.getuid():
                raise ValueError(f"Runtime token file is not owned by the current user: {token_path}")
            if stat.S_IMODE(metadata.st_mode) & 0o077:
                raise ValueError(f"Runtime token file must not be accessible by group/others: {token_path}")
        payload = os.read(descriptor, 4097)
        if len(payload) > 4096:
            raise ValueError(f"Runtime token file is unexpectedly large: {token_path}")
        token = payload.decode("utf-8").strip()
    finally:
        os.close(descriptor)
    if len(token) < 32:
        raise ValueError(f"Runtime token in {token_path} must contain at least 32 characters")
    return token
