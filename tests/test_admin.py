from __future__ import annotations

import json

import pytest

from pipyter.admin import AdminConfigError, AdminConfigStore, MULTI_USER_MODE, SINGLE_USER_MODE


def test_admin_defaults_to_implicit_single_user(isolated_config):
    store = AdminConfigStore()
    config = store.read()
    assert config.mode == SINGLE_USER_MODE
    assert config.explicit is False
    assert not store.path.exists()


def test_admin_modes_are_mutually_exclusive(tmp_path, isolated_config):
    store = AdminConfigStore()
    configured = store.set_mode(MULTI_USER_MODE, users_root=tmp_path / "users")
    assert configured.mode == MULTI_USER_MODE
    with pytest.raises(AdminConfigError, match="--force"):
        store.set_mode(SINGLE_USER_MODE)
    switched = store.set_mode(SINGLE_USER_MODE, force=True)
    assert switched.mode == SINGLE_USER_MODE
    assert json.loads(store.path.read_text(encoding="utf-8"))["mode"] == SINGLE_USER_MODE


def test_managed_user_layout_initializes_two_pigent_files(tmp_path, isolated_config):
    store = AdminConfigStore()
    store.set_mode(MULTI_USER_MODE, users_root=tmp_path / "users")
    layout = store.add_user("wenbiao_zhao")
    assert layout.root == (tmp_path / "users" / "wenbiao_zhao").resolve()
    assert layout.workspaces_root.is_dir()
    files = sorted(path.relative_to(layout.config_root).as_posix() for path in layout.config_root.rglob("*") if path.is_file())
    assert files == ["pigent/auth.json", "pigent/settings.json"]
    assert store.add_user("wenbiao_zhao") == layout
    assert [item.name for item in store.users()] == ["wenbiao_zhao"]


def test_managed_user_name_cannot_escape_users_root(tmp_path, isolated_config):
    store = AdminConfigStore()
    store.set_mode(MULTI_USER_MODE, users_root=tmp_path / "users")
    for invalid in ("../zirui", "zirui/name", ".hidden", "two words"):
        with pytest.raises(AdminConfigError):
            store.add_user(invalid)
