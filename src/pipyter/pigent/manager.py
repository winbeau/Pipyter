from __future__ import annotations

import asyncio
import json
import os
import secrets
from pathlib import Path
from typing import Any, Awaitable, Callable

from .client import PigentJsonlClient, PigentProtocolError
from ..protocol.pigent import PIGENT_ACTION_FILTERS, PIGENT_CAPABILITIES, PIGENT_CATALOGS, PIGENT_EVENT_TYPES, PIGENT_PROTOCOL_VERSION, PIGENT_TOOL_NAMES
from .resources import PigentResourceError, host_entry as packaged_host_entry, load_manifest, resolve_node, verify_payload


class PigentUnavailable(RuntimeError):
    pass


class PigentManager:
    """Lazy one-host-per-workspace supervisor.

    Commands accepted by a dead host are never replayed. Session/event state is
    Python-owned, so a replacement host receives snapshots rather than pending
    mutations.
    """

    def __init__(
        self,
        workspace: Path,
        workspace_id: str,
        *,
        user_config_dir: Path,
        bridge_endpoint: str = "",
        bridge_token: str | None = None,
        host_entry: Path | None = None,
        on_event: Callable[[dict[str, Any]], Awaitable[None] | None] | None = None,
    ):
        self.workspace = workspace.resolve()
        self.workspace_id = workspace_id
        self.user_config_dir = user_config_dir.resolve()
        self.bridge_endpoint = bridge_endpoint
        self.bridge_token = bridge_token or secrets.token_urlsafe(48)
        self.host_entry = host_entry.resolve() if host_entry is not None else None
        self.on_event = on_event
        self.process: asyncio.subprocess.Process | None = None
        self.client: PigentJsonlClient | None = None
        self.restart_count = 0
        self._start_count = 0
        self._lock = asyncio.Lock()
        self._log_handle = None
        self._startup_path: Path | None = None
        self._handshake: dict[str, Any] | None = None
        self._manifest: dict[str, Any] | None = None

    @staticmethod
    def _default_host_entry() -> Path:
        override = os.environ.get("PIGENT_HOST_ENTRY")
        if override:
            return Path(override).expanduser().resolve()
        try:
            return packaged_host_entry()
        except PigentResourceError as error:
            raise PigentUnavailable(str(error)) from error

    def validate(self) -> tuple[str, Path]:
        finding = resolve_node()
        if not finding.ok or not finding.executable:
            raise PigentUnavailable(finding.message)
        entry = self.host_entry or self._default_host_entry()
        if not entry.is_file():
            raise PigentUnavailable(f"Pigent host entry not found: {entry}")
        if self.host_entry is None and not os.environ.get("PIGENT_HOST_ENTRY"):
            try:
                verify_payload()
            except PigentResourceError as error:
                raise PigentUnavailable(str(error)) from error
        return finding.executable, entry

    async def ensure_started(self) -> PigentJsonlClient:
        async with self._lock:
            if self.process is not None and self.process.returncode is None and self.client is not None:
                return self.client
            node, entry = self.validate()
            log_dir = self.workspace / ".pipyter" / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            log_path = log_dir / "pigent-host.log"
            if log_path.exists() and log_path.stat().st_size > 2_000_000:
                log_path.replace(log_path.with_suffix(".log.1"))
            self._log_handle = log_path.open("ab", buffering=0)
            env = os.environ.copy()
            for key in list(env):
                if key.startswith(("BEAUPI_", "PI_")):
                    env.pop(key, None)
            env["PIGENT_BRIDGE_TOKEN"] = self.bridge_token
            startup = {
                "version": 1,
                "protocolVersion": PIGENT_PROTOCOL_VERSION,
                "workspaceId": self.workspace_id,
                "workspaceRoot": str(self.workspace),
                "sessionDir": str(self.workspace / ".pipyter" / "pigent" / "sessions"),
                "userConfigDir": str(self.user_config_dir),
                "bridgeEndpoint": self.bridge_endpoint,
            }
            runtime_dir = self.workspace / ".pipyter" / "runtime"
            runtime_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
            os.chmod(runtime_dir, 0o700)
            self._startup_path = runtime_dir / "pigent-host-config.json"
            temporary = self._startup_path.with_suffix(".tmp")
            temporary.write_text(json.dumps(startup), encoding="utf-8")
            os.chmod(temporary, 0o600)
            os.replace(temporary, self._startup_path)
            os.chmod(self._startup_path, 0o600)
            env["PIGENT_HOST_CONFIG_PATH"] = str(self._startup_path)
            env.pop("PIGENT_HOST_CONFIG", None)
            if self._start_count:
                self.restart_count += 1
            self._start_count += 1
            self.process = await asyncio.create_subprocess_exec(
                node,
                str(entry),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=self._log_handle,
                env=env,
                cwd=self.workspace,
            )
            self.client = PigentJsonlClient(self.process, self.on_event)
            try:
                ready = await asyncio.wait_for(self.client.command("handshake"), timeout=5)
            except Exception:
                await self._discard_process()
                raise
            try:
                manifest = verify_payload() if self.host_entry is None and not os.environ.get("PIGENT_HOST_ENTRY") else None
                self._handshake = self._validate_handshake(ready, manifest)
                self._manifest = manifest
            except (PigentProtocolError, PigentResourceError):
                await self._discard_process()
                raise
            return self.client

    @staticmethod
    def _validate_handshake(value: dict[str, Any], manifest: dict[str, Any] | None = None) -> dict[str, Any]:
        if value.get("protocol_version") != PIGENT_PROTOCOL_VERSION or value.get("tool_protocol_version") != PIGENT_PROTOCOL_VERSION:
            raise PigentProtocolError("Pigent host protocol mismatch")
        tools = tuple(value.get("tools") or ())
        if tools != PIGENT_TOOL_NAMES:
            raise PigentProtocolError("Pigent host tool catalog mismatch")
        modes = value.get("modes")
        action_filters = value.get("action_filters")
        capabilities = value.get("capabilities")
        event_types = value.get("event_types")
        if not isinstance(modes, dict) or not isinstance(action_filters, dict) or not isinstance(capabilities, list) or not isinstance(event_types, list):
            raise PigentProtocolError("Pigent host handshake is incomplete")
        for mode, ceiling in PIGENT_CATALOGS.items():
            advertised = modes.get(mode)
            if not isinstance(advertised, list) or any(tool not in ceiling for tool in advertised):
                raise PigentProtocolError(f"Pigent host mode catalog mismatch: {mode}")
        negotiated_actions: dict[str, dict[str, list[str]]] = {}
        for tool, by_mode in PIGENT_ACTION_FILTERS.items():
            host_by_mode = action_filters.get(tool)
            if not isinstance(host_by_mode, dict):
                raise PigentProtocolError(f"Pigent host action filter missing: {tool}")
            negotiated_actions[tool] = {}
            for mode, ceiling in by_mode.items():
                advertised = host_by_mode.get(mode)
                if not isinstance(advertised, list) or any(action not in ceiling for action in advertised):
                    raise PigentProtocolError(f"Pigent host action filter mismatch: {tool}/{mode}")
                negotiated_actions[tool][mode] = [action for action in ceiling if action in advertised]
        negotiated_capabilities = [item for item in PIGENT_CAPABILITIES if item in capabilities]
        negotiated_events = [item for item in PIGENT_EVENT_TYPES if item in event_types]
        if manifest is not None and (
            manifest.get("host_protocol_version") != value.get("protocol_version")
            or manifest.get("tool_protocol_version") != value.get("tool_protocol_version")
        ):
            raise PigentProtocolError("Pigent payload manifest/host protocol mismatch")
        return {
            "protocol_version": PIGENT_PROTOCOL_VERSION,
            "runtime_version": value.get("runtime_version"),
            "tools": list(PIGENT_TOOL_NAMES),
            "modes": {mode: [tool for tool in ceiling if tool in modes[mode]] for mode, ceiling in PIGENT_CATALOGS.items()},
            "action_filters": negotiated_actions,
            "capabilities": negotiated_capabilities,
            "event_types": negotiated_events,
        }

    async def negotiated_capabilities(self, *, start: bool = True) -> dict[str, Any]:
        if start:
            await self.ensure_started()
        if self._handshake is None:
            raise PigentUnavailable("payload_missing: verified Pigent host handshake is unavailable")
        return dict(self._handshake)

    async def command(self, command: str, **payload: Any) -> dict[str, Any]:
        client = await self.ensure_started()
        try:
            return await client.command(command, **payload)
        except (BrokenPipeError, ConnectionError, PigentProtocolError):
            # Mark unavailable. Do not replay this command: it may have accepted a mutation.
            await self._discard_process()
            raise

    async def _discard_process(self) -> None:
        process, self.process, self.client = self.process, None, None
        self._handshake = None
        self._manifest = None
        if process is not None and process.returncode is None:
            process.kill()
            await process.wait()
        if self._log_handle is not None:
            self._log_handle.close()
            self._log_handle = None
        if self._startup_path is not None:
            self._startup_path.unlink(missing_ok=True)
            self._startup_path = None

    async def shutdown(self) -> None:
        async with self._lock:
            client = self.client
            if client is not None:
                await client.close()
            self.client = None
            self.process = None
            self._handshake = None
            self._manifest = None
            if self._log_handle is not None:
                self._log_handle.close()
                self._log_handle = None
            if self._startup_path is not None:
                self._startup_path.unlink(missing_ok=True)
                self._startup_path = None

    def status(self) -> dict[str, Any]:
        running = self.process is not None and self.process.returncode is None
        finding = resolve_node()
        try:
            manifest = verify_payload()
            payload_ok, payload_error = True, None
        except PigentResourceError as error:
            manifest, payload_ok, payload_error = {}, False, str(error)
        return {"status": "running" if running else "stopped", "pid": self.process.pid if running else None,
                "restart_count": self.restart_count, "payload_ok": payload_ok, "payload_error": payload_error,
                "runtime_version": manifest.get("runtime_version"), "protocol_version": manifest.get("host_protocol_version"),
                "negotiated": self._handshake, "node_ok": finding.ok,
                "node_version": finding.version, "node_required": finding.required, "node_finding": finding.message}
