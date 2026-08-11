from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..protocol.pigent import PigentErrorCode, PigentToolError, PigentToolResult, Revisions


@dataclass(slots=True)
class ToolFailure(Exception):
    code: PigentErrorCode
    message: str
    retryable: bool = False
    details: dict[str, Any] | None = None

    def result(self) -> PigentToolResult:
        return PigentToolResult(
            ok=False,
            summary=self.message,
            error=PigentToolError(
                code=self.code,
                message=self.message,
                retryable=self.retryable,
                details=self.details or {},
            ),
        )


def success(
    summary: str,
    *,
    data: dict[str, Any] | None = None,
    before: str | None = None,
    after: str | None = None,
    artifacts: list[Any] | None = None,
    warnings: list[str] | None = None,
) -> PigentToolResult:
    revisions = Revisions(before=before, after=after) if before is not None and after is not None else None
    return PigentToolResult(
        ok=True,
        summary=summary,
        data=data or {},
        revisions=revisions,
        artifacts=artifacts or [],
        warnings=warnings or [],
    )
