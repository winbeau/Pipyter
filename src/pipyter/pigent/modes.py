from __future__ import annotations

from typing import Any

from ..protocol.pigent import (
    PIGENT_ACTION_FILTERS,
    PIGENT_CATALOGS,
    PigentMode,
    migrate_legacy_mode,
    migrate_legacy_session_state,
)
from .models import ToolFailure


def normalize_mode(mode: Any) -> PigentMode:
    try:
        return migrate_legacy_mode(mode)
    except ValueError as error:
        raise ToolFailure("invalid_request", str(error)) from error


def validate_action(mode: Any, tool: str, arguments: dict[str, Any]) -> PigentMode:
    """Recheck trusted mode immediately before dispatch.

    Multi-action tools use ``action``; delegate uses its public ``profile`` as
    the filtered action. The host's trusted context is authoritative.
    """
    normalized = normalize_mode(mode)
    if tool not in PIGENT_CATALOGS[normalized]:
        raise ToolFailure("mode_denied", f"{tool} is unavailable in {normalized} mode")
    filters = PIGENT_ACTION_FILTERS.get(tool)
    if filters is not None:
        key = "profile" if tool == "delegate" else "action"
        action = arguments.get(key)
        if action not in filters[normalized]:
            raise ToolFailure(
                "mode_denied",
                f"{tool}.{action or '<missing>'} is unavailable in {normalized} mode",
                details={"mode": normalized, "tool": tool, "action": action},
            )
    return normalized


__all__ = ["normalize_mode", "validate_action", "migrate_legacy_session_state"]
