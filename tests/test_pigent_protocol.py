"""Phase 0 focused checks: frozen Pigent contracts (mirror tests/test in TypeScript).

Covers Python model round trips, strict rejection of unknown tool names /
actions / statuses / modes / protocol versions, legacy pilot -> auto migration
(exactly once), cross-language golden JSON fixtures, JSON Schema <-> Python
enum consistency, and the extracted design baseline.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from pipyter.protocol.pigent import (
    NOTBOOK_ACTIONS,
    PIGENT_ACTION_FILTERS,
    PIGENT_ARTIFACT_KINDS,
    PIGENT_CAPABILITIES,
    PIGENT_CATALOGS,
    PIGENT_DELEGATE_PROFILES,
    PIGENT_ERROR_CODES,
    PIGENT_EVENT_TYPES,
    PIGENT_MODES,
    PIGENT_MODE_MATRIX,
    PIGENT_PROTOCOL_VERSION,
    PIGENT_SESSION_STATUSES,
    PIGENT_TASK_STATUSES,
    PIGENT_TOOL_NAMES,
    PigentEvent,
    PigentSession,
    PigentToolContext,
    PigentToolResult,
    allowed_actions,
    allowed_tools,
    migrate_legacy_mode,
    migrate_legacy_session_state,
)

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "packages" / "protocol" / "schemas"
FIXTURES = SCHEMAS / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def load_schema(name: str) -> dict:
    return json.loads((SCHEMAS / name).read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Frozen constants
# ---------------------------------------------------------------------------


def test_protocol_version_is_frozen():
    assert PIGENT_PROTOCOL_VERSION == "0.2"
    assert load_schema("pigent-tools.schema.json")["definitions"]["protocolVersion"]["const"] == "0.2"


def test_exactly_ten_tools():
    assert PIGENT_TOOL_NAMES == (
        "read", "view", "write", "update", "bash", "notebook", "kernel", "inspect", "tasks", "delegate",
    )
    assert len(PIGENT_TOOL_NAMES) == 10
    catalog = load_schema("pigent-tools.schema.json")["definitions"]["toolName"]["enum"]
    assert list(PIGENT_TOOL_NAMES) == catalog
    assert "watch" not in catalog and "edit" not in catalog


def test_modes_reject_pilot():
    assert PIGENT_MODES == ("ask", "plan", "auto")
    assert load_schema("pigent-modes.schema.json")["definitions"]["mode"]["enum"] == list(PIGENT_MODES)
    with pytest.raises(ValidationError):
        PigentToolContext(
            protocol_version="0.2", tool_call_id="c", session_id="s", workspace_id="w", mode="pilot"  # type: ignore[arg-type]
        )


def test_error_and_event_codes_are_stable():
    assert len(PIGENT_ERROR_CODES) == 34
    assert len(PIGENT_EVENT_TYPES) == 25
    schema_errors = load_schema("pigent-tools.schema.json")["definitions"]["errorCode"]["enum"]
    schema_events = load_schema("pigent-events.schema.json")["definitions"]["eventType"]["enum"]
    assert list(PIGENT_ERROR_CODES) == schema_errors
    assert list(PIGENT_EVENT_TYPES) == schema_events


def test_status_and_kind_enums_match_schema():
    assert PIGENT_TASK_STATUSES == ("pending", "running", "done", "blocked", "failed")
    assert PIGENT_SESSION_STATUSES == ("active", "completed", "failed", "interrupted", "waiting_for_user")
    assert PIGENT_ARTIFACT_KINDS == ("image", "table", "text", "file")
    assert PIGENT_DELEGATE_PROFILES == ("analysis", "research", "review", "implementation")
    assert len(PIGENT_CAPABILITIES) == 17
    schema_statuses = load_schema("pigent-session.schema.json")["definitions"]["sessionStatus"]["enum"]
    schema_kinds = load_schema("pigent-session.schema.json")["definitions"]["artifactKind"]["enum"]
    assert list(PIGENT_SESSION_STATUSES) == schema_statuses
    assert list(PIGENT_ARTIFACT_KINDS) == schema_kinds


def test_mode_matrix_frozen():
    matrix = load_schema("pigent-modes.schema.json")["definitions"]["modeMatrix"]["properties"]
    for capability, levels in PIGENT_MODE_MATRIX.items():
        schema_levels = matrix[capability]["properties"]
        for mode, level in levels.items():
            assert schema_levels[mode]["const"] == level, f"{capability}/{mode}"
    # Ask/Plan restrictions define product intent; Auto is never degraded.
    assert PIGENT_MODE_MATRIX["process.execute"]["ask"] == "deny"
    assert PIGENT_MODE_MATRIX["process.execute"]["plan"] == "deny"
    assert PIGENT_MODE_MATRIX["process.execute"]["auto"] == "os"
    assert PIGENT_MODE_MATRIX["process.interactive"]["auto"] == "interactive"
    assert PIGENT_MODE_MATRIX["filesystem.write"]["auto"] == "os"


# ---------------------------------------------------------------------------
# Mode projection
# ---------------------------------------------------------------------------


def test_allowed_tools_projection():
    assert allowed_tools("ask") == ("read", "view", "notebook", "kernel", "inspect", "delegate")
    assert allowed_tools("plan") == ("read", "view", "notebook", "kernel", "inspect", "delegate", "tasks")
    assert allowed_tools("auto") == PIGENT_TOOL_NAMES
    assert len(allowed_tools("auto")) == 10
    with pytest.raises(ValueError):
        allowed_tools("pilot")  # type: ignore[arg-type]


def test_allowed_actions_projection():
    assert allowed_actions("notebook", "ask") == ("read_cell",)
    assert allowed_actions("kernel", "plan") == ("status", "list_environments", "operation_status")
    assert allowed_actions("tasks", "ask") == ()
    assert allowed_actions("delegate", "ask") == ("analysis", "research", "review")
    assert allowed_actions("delegate", "auto") == ("analysis", "research", "review", "implementation")
    assert allowed_actions("notebook", "auto") == NOTBOOK_ACTIONS
    assert len(allowed_actions("kernel", "auto")) == 13
    assert allowed_actions("watch", "auto") == ()
    schema = load_schema("pigent-modes.schema.json")["definitions"]["toolActionFilter"]["properties"]
    assert list(allowed_actions("notebook", "auto")) == schema["notebook"]["properties"]["auto"]["items"]["enum"]
    assert list(allowed_actions("kernel", "auto")) == schema["kernel"]["properties"]["auto"]["items"]["enum"]


def test_fake_mode_in_arguments_does_not_change_trusted_mode():
    # The trusted mode lives in the injected context; unknown mode values are
    # rejected by the strict Literal, so an argument cannot smuggle a mode.
    with pytest.raises(ValidationError):
        PigentToolContext.model_validate(
            {"protocol_version": "0.2", "tool_call_id": "c", "session_id": "s", "workspace_id": "w", "mode": "turbo"}
        )


# ---------------------------------------------------------------------------
# Legacy migration
# ---------------------------------------------------------------------------


def test_legacy_pilot_maps_to_auto_exactly_once():
    legacy = load_fixture("legacy-pilot-state.json")
    migrated, changed = migrate_legacy_session_state(legacy)
    assert changed is True
    assert migrated["mode"] == "auto"
    assert "requested_mode" not in migrated
    assert "effective_mode" not in migrated
    assert migrated["session_id"] == "pigent_sess_old_01"
    assert migrated["title"] == "旧 Pilot 会话"
    # Second pass: no-op, maps exactly once.
    again, changed_again = migrate_legacy_session_state(migrated)
    assert changed_again is False
    assert again == migrated
    # Legacy fields are removed after one successful write in the new schema.
    assert "requested_mode" not in again


def test_legacy_mode_field_values():
    assert migrate_legacy_mode("pilot") == "auto"
    assert migrate_legacy_mode("ask") == "ask"
    assert migrate_legacy_mode("auto") == "auto"
    with pytest.raises(ValueError):
        migrate_legacy_mode("turbo")
    with pytest.raises(ValueError):
        migrate_legacy_session_state({"mode": "turbo"})


# ---------------------------------------------------------------------------
# Python model round trips
# ---------------------------------------------------------------------------


def test_tool_result_round_trip_golden():
    golden = load_fixture("golden-tool-result.json")
    success = PigentToolResult.model_validate(golden["success"])
    assert success.ok is True
    assert success.revisions is not None
    assert success.revisions.before.startswith("sha256:")
    assert success.artifacts[0].kind == "image"
    assert success.model_dump() == golden["success"]

    failure = PigentToolResult.model_validate(golden["failure"])
    assert failure.ok is False
    assert failure.error is not None
    assert failure.error.code == "revision_conflict"
    assert failure.error.retryable is True
    assert failure.model_dump() == golden["failure"]


def test_session_round_trip_golden():
    golden = load_fixture("golden-session-state.json")
    session = PigentSession.model_validate(golden["session"])
    assert session.mode == "auto"
    assert "execution_identity" not in session.model_dump()
    assert session.tasks_snapshot is not None
    assert session.tasks_snapshot.root.status == "running"
    done = next(c for c in session.tasks_snapshot.root.children if c.id == "locate")
    assert done.status == "done"
    assert session.model_dump() == golden["session"]


def test_events_round_trip_golden():
    golden = load_fixture("golden-events.json")
    events = [PigentEvent.model_validate(e) for e in golden["events"]]
    assert [e.event_id for e in events] == [1, 2, 3, 4, 5]
    interaction_event = events[3]
    assert interaction_event.type == "interaction.required"
    interaction = interaction_event.payload["interaction"]
    assert interaction["kind"] == "pty_handoff"
    assert interaction["choices"] == ["open_shell", "cancel"]
    # Secret bytes never enter event payloads.
    assert "password" not in json.dumps(interaction).lower()


def test_unknown_values_rejected():
    golden = load_fixture("golden-tool-result.json")
    # data is an open object; the tool name lives in the trusted context, not data.
    unknown_tool = dict(golden["success"])
    unknown_tool["data"] = {"tool": "watch"}
    assert PigentToolResult.model_validate(unknown_tool).ok is True

    # Missing required fields are rejected.
    with pytest.raises(ValidationError):
        PigentToolResult.model_validate({"version": 1, "summary": "x"})
    # Unknown protocol versions are rejected.
    with pytest.raises(ValidationError):
        PigentToolResult.model_validate(dict(golden["success"], version=2))
    # Unknown error codes are rejected.
    with pytest.raises(ValidationError):
        PigentToolResult.model_validate(
            dict(golden["failure"], error={"code": "unknown_code", "message": "x", "retryable": False})
        )
    # Malformed revisions are rejected.
    with pytest.raises(ValidationError):
        PigentToolResult.model_validate(
            dict(golden["success"], revisions={"before": "abc", "after": "def"})
        )
    # Non-matching schema fields are rejected.
    with pytest.raises(ValidationError):
        PigentToolResult.model_validate(
            dict(golden["success"], revisions={"before": "sha256:" + "a" * 64})
        )


def test_unknown_event_type_rejected():
    golden = load_fixture("golden-events.json")
    with pytest.raises(ValidationError):
        PigentEvent.model_validate(dict(golden["events"][0], type="tool.watch"))


def test_v02_operation_and_surface_fixtures_are_deterministic():
    from pipyter.protocol.pigent import KernelEnvironmentSummary, OperationEnvelope

    golden = load_fixture("golden-v0.2-operations.json")
    environment = KernelEnvironmentSummary.model_validate(golden["environment"])
    assert environment.kind == "temporary" and environment.status == "provisioning"
    operations = [OperationEnvelope.model_validate(event["payload"]["operation"]) for event in golden["operation_events"]]
    assert [item.state for item in operations] == ["running", "running", "succeeded"]
    assert operations[-1].receipt is not None and operations[-1].receipt.outcome == "success"
    cursor = PigentEvent.model_validate(golden["reconnect_cursor"])
    assert cursor.event_id is None and cursor.type == "reconnect.cursor"

    surfaces = load_fixture("golden-tool-surfaces.json")
    tool_names = {event.get("payload", {}).get("tool") for event in surfaces["events"]}
    # tasks/delegate use dedicated public lifecycle event families.
    assert tool_names >= {"read", "view", "write", "update", "bash", "notebook", "kernel", "inspect"}
    assert any(event["type"] == "tasks.snapshot" for event in surfaces["events"])
    assert any(event["type"] == "delegate.end" for event in surfaces["events"])
    assert any(event["type"] == "artifact.created" for event in surfaces["events"])
    assert any(event["type"] == "interaction.required" for event in surfaces["events"])
    assert any(event["type"] == "aborted" for event in surfaces["events"])
    assert "secret" not in json.dumps(surfaces).lower()


# ---------------------------------------------------------------------------
# Design baseline
# ---------------------------------------------------------------------------


def test_design_baseline_fixture_is_frozen():
    baseline = load_fixture("design-baseline.json")
    assert baseline["protocol_version"] == "0.1"
    layout = baseline["layout"]
    assert layout["rail_width"] == 84
    assert layout["session_list_width"] == 236
    assert layout["detail_panel_width"] == 300
    assert layout["workspace_pigent_panel_width"] == 360
    assert layout["shell_panel_height"] == 220
    assert layout["pigent_header_height"] == 52
    assert layout["content_max_width"] == 880
    assert baseline["modes"] == ["ask", "plan", "auto"]
    tokens = baseline["tokens"]
    assert tokens["pigent"] == "#d9730d"
    assert tokens["pigent-soft"] == "#fff0e5"
    assert tokens["pigent-dark"] == "#a64b18"
    assert tokens["accent"] == "#2383e2"
    assert tokens["surface-2"] == "#f1f1ef"
    assert baseline["sources"]["pigent"]["tokens"]["pigent-soft"] == "#fff0e5"
    # The three named HTML files are the visual source of truth.
    for source in ("shell", "pigent", "workspace"):
        assert "dimensions" in baseline["sources"][source]
