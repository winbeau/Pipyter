from __future__ import annotations

import json

import pytest

from pipyter.pigent.cli import build_parser, main
from pipyter.pigent.migration import MigrationPreview


def test_config_parser_requires_preview_or_apply():
    with pytest.raises(SystemExit):
        build_parser().parse_args(["config", "migrate-ssh", "--source", "autodl", "--provider", "deepseek"])
    preview = build_parser().parse_args([
        "config", "migrate-ssh", "--source", "autodl", "--provider", "deepseek", "--preview",
    ])
    assert preview.preview is True and preview.apply is False


def test_cli_preview_and_apply_never_print_secret(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("PIPYTER_CONFIG_HOME", str(tmp_path))
    secret = "cli-secret-never-print"

    def preview(self, source, provider, source_config_dir=None):
        return MigrationPreview(
            source, provider, provider, "m", None, (provider,), "literal",
            {"scheme": "https", "host": "example.test", "port": None, "path": "/v1"},
            0o600, 0o600, str(tmp_path / "pigent"), "sha256:" + "a" * 64,
            "sha256:" + "b" * 64, "merge", "replace", "preview_x", (),
        )

    def apply(self, source, provider, **kwargs):
        return {"migration_id": "mig_x", "provider": provider, "model": "m", "rollback_command": "pigent config rollback mig_x"}

    monkeypatch.setattr("pipyter.pigent.cli.PigentConfigMigrationService.preview_ssh", preview)
    monkeypatch.setattr("pipyter.pigent.cli.PigentConfigMigrationService.apply_ssh", apply)
    assert main(["config", "migrate-ssh", "--source", "autodl", "--provider", "deepseek", "--preview"]) == 0
    assert main(["config", "migrate-ssh", "--source", "autodl", "--provider", "deepseek", "--apply"]) == 0
    output = capsys.readouterr()
    assert secret not in output.out and secret not in output.err
    assert json.loads(output.out.split("}\n{")[0] + "}")["ok"] is True
