from __future__ import annotations

import pytest

from pipyter.pigent.modes import normalize_mode, validate_action
from pipyter.protocol.pigent import migrate_legacy_session_state
from pipyter.pigent.models import ToolFailure


@pytest.mark.parametrize("mode", ["ask", "plan"])
@pytest.mark.parametrize(
    ("tool", "arguments"),
    [("write", {}), ("update", {}), ("bash", {}), ("notebook", {"action": "run_cell"}),
     ("kernel", {"action": "execute"}), ("delegate", {"profile": "implementation"})],
)
def test_ask_and_plan_reject_mutation_and_execution(mode, tool, arguments):
    with pytest.raises(ToolFailure) as caught:
        validate_action(mode, tool, arguments)
    assert caught.value.code == "mode_denied"


def test_read_only_actions_and_plan_tasks_are_allowed():
    assert validate_action("ask", "read", {}) == "ask"
    assert validate_action("ask", "notebook", {"action": "read_cell"}) == "ask"
    assert validate_action("plan", "tasks", {"action": "patch"}) == "plan"
    assert validate_action("plan", "inspect", {"action": "dataframe"}) == "plan"


def test_auto_allows_mutation_execution_and_legacy_pilot_migrates():
    assert validate_action("auto", "write", {}) == "auto"
    assert validate_action("auto", "bash", {}) == "auto"
    assert validate_action("auto", "notebook", {"action": "run_cell"}) == "auto"
    assert normalize_mode("pilot") == "auto"
    migrated, changed = migrate_legacy_session_state({"mode": "pilot", "requested_mode": "pilot"})
    assert changed is True
    assert migrated == {"mode": "auto"}


def test_fake_mode_argument_never_changes_trusted_mode():
    with pytest.raises(ToolFailure) as caught:
        validate_action("ask", "write", {"mode": "auto", "path": "owned.txt", "content": "no"})
    assert caught.value.code == "mode_denied"
