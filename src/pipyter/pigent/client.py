from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import Any, Awaitable, Callable


class PigentProtocolError(RuntimeError):
    pass


EventCallback = Callable[[dict[str, Any]], Awaitable[None] | None]


class PigentJsonlClient:
    """Strict LF-delimited JSONL client with command/response correlation."""

    def __init__(self, process: asyncio.subprocess.Process, on_event: EventCallback | None = None):
        self.process = process
        self.on_event = on_event
        self._pending: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._reader_task = asyncio.create_task(self._read_loop())
        self._sequence = 0

    async def command(self, command: str, **payload: Any) -> dict[str, Any]:
        if self.process.returncode is not None:
            raise PigentProtocolError("Pigent host is not running")
        self._sequence += 1
        request_id = f"rpc-{self._sequence}"
        future = asyncio.get_running_loop().create_future()
        self._pending[request_id] = future
        record = {"version": 1, "id": request_id, "command": command, **payload}
        assert self.process.stdin is not None
        self.process.stdin.write((json.dumps(record, separators=(",", ":")) + "\n").encode())
        await self.process.stdin.drain()
        try:
            return await future
        finally:
            self._pending.pop(request_id, None)

    async def _read_loop(self) -> None:
        assert self.process.stdout is not None
        try:
            while True:
                line = await self.process.stdout.readline()
                if not line:
                    break
                if not line.endswith(b"\n"):
                    raise PigentProtocolError("unterminated JSONL record")
                try:
                    message = json.loads(line[:-1])
                except (UnicodeDecodeError, json.JSONDecodeError) as error:
                    raise PigentProtocolError(f"malformed host JSONL: {error}") from error
                if not isinstance(message, dict):
                    raise PigentProtocolError("host JSONL record is not an object")
                request_id = message.get("id")
                if isinstance(request_id, str) and request_id in self._pending:
                    future = self._pending[request_id]
                    if not future.done():
                        if message.get("ok", True):
                            future.set_result(message)
                        else:
                            future.set_exception(PigentProtocolError(str(message.get("error", "host command failed"))))
                elif message.get("kind") == "event" and self.on_event is not None:
                    result = self.on_event(message.get("event", {}))
                    if asyncio.iscoroutine(result):
                        await result
            if self._pending:
                raise PigentProtocolError("Pigent host closed stdout")
        except BaseException as error:
            for future in self._pending.values():
                if not future.done():
                    future.set_exception(error)
            if isinstance(error, asyncio.CancelledError):
                raise

    async def close(self) -> None:
        if self.process.returncode is None:
            try:
                await asyncio.wait_for(self.command("shutdown"), timeout=2)
            except Exception:
                self.process.terminate()
        try:
            await asyncio.wait_for(self.process.wait(), timeout=2)
        except asyncio.TimeoutError:
            self.process.kill()
            await self.process.wait()
        self._reader_task.cancel()
        await asyncio.gather(self._reader_task, return_exceptions=True)
