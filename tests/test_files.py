from __future__ import annotations

from pathlib import Path

import pytest

from pipyter.exceptions import UnsafePathError
from pipyter.workspace.files import (
    create_directory,
    delete_path,
    file_kind,
    list_entries,
    read_notebook,
    read_text,
    resolve_workspace_path,
    write_notebook,
    write_text,
)


def test_relative_path_resolves_inside_root(tmp_path):
    resolved = resolve_workspace_path(tmp_path, "a/b.txt")
    assert resolved == (tmp_path / "a" / "b.txt").resolve()


def test_absolute_path_rejected(tmp_path):
    with pytest.raises(UnsafePathError):
        resolve_workspace_path(tmp_path, str(Path("/etc/passwd")))


@pytest.mark.parametrize("bad", ["../outside", "a/../../outside", ".."])
def test_traversal_rejected(tmp_path, bad):
    with pytest.raises(UnsafePathError):
        resolve_workspace_path(tmp_path, bad)


def test_symlink_escape_rejected(tmp_path):
    outside = tmp_path / ".." / f"escape-{tmp_path.name}"
    outside.mkdir(exist_ok=True)
    (tmp_path / "link").symlink_to(outside, target_is_directory=True)
    with pytest.raises(UnsafePathError):
        resolve_workspace_path(tmp_path, "link/target.txt")
    outside.rmdir()


def test_list_entries_skips_metadata(tmp_path):
    (tmp_path / ".pipyter").mkdir()
    (tmp_path / "a.txt").write_text("a", encoding="utf-8")
    (tmp_path / "sub").mkdir()
    entries = list_entries(tmp_path)
    names = [entry.name for entry in entries]
    assert "a.txt" in names and "sub" in names
    assert ".pipyter" not in names


def test_file_kind(tmp_path):
    (tmp_path / "n.ipynb").write_text("{}", encoding="utf-8")
    (tmp_path / "p.png").write_bytes(b"\x89PNG")
    (tmp_path / "plain.txt").write_text("x", encoding="utf-8")
    assert file_kind(tmp_path / "n.ipynb") == "notebook"
    assert file_kind(tmp_path / "p.png") == "image"
    assert file_kind(tmp_path / "plain.txt") == "file"
    assert file_kind(tmp_path) == "directory"


def test_write_read_text_roundtrip(tmp_path):
    write_text(tmp_path, "docs/notes.txt", "content\n")
    assert read_text(tmp_path, "docs/notes.txt") == "content\n"


def test_write_text_creates_parents(tmp_path):
    write_text(tmp_path, "deep/nested/file.py", "# x")
    assert (tmp_path / "deep" / "nested" / "file.py").is_file()


def test_read_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        read_text(tmp_path, "missing.txt")


def test_directory_create_and_delete(tmp_path):
    created = create_directory(tmp_path, "newdir")
    assert created.is_dir()
    with pytest.raises(FileExistsError):
        create_directory(tmp_path, "newdir")
    delete_path(tmp_path, "newdir")
    assert not (tmp_path / "newdir").exists()


def test_delete_guards_root_and_metadata(tmp_path):
    (tmp_path / ".pipyter").mkdir()
    with pytest.raises(UnsafePathError):
        delete_path(tmp_path, ".")
    with pytest.raises(UnsafePathError):
        delete_path(tmp_path, ".pipyter")


def test_notebook_roundtrip(tmp_path):
    document = {"cells": [], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}
    write_notebook(tmp_path, "book.ipynb", document)
    assert read_notebook(tmp_path, "book.ipynb") == document


def test_notebook_requires_extension(tmp_path):
    with pytest.raises(ValueError):
        read_notebook(tmp_path, "book.txt")
    with pytest.raises(ValueError):
        write_notebook(tmp_path, "book.txt", {})


def test_delete_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        delete_path(tmp_path, "nothing.txt")
