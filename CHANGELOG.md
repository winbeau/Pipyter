# Changelog

All notable changes to Pipyter are documented in this file.

## [0.1.2] - 2025-08-11

### Added

- `pipyter lab --verbose` shows per-request access logs; the default mode now
  only prints the Workspace URL and startup status.
- New `.ipynb` files are created with a valid empty notebook document and open
  automatically in the editor, so they are editable immediately after
  creation.
- On headless sessions (no graphical display), `pipyter lab` prints the
  Workspace URL instead of failing to launch a browser.

### Fixed

- Creating a `.ipynb` file no longer yields a 400 error when opening it.

## [0.1.1] - 2025-08-11

### Added

- `pipyter lab` command: install with `uv tool install pipyter`, then run
  `pipyter lab` in any directory to launch the Workspace web UI. The directory
  is auto-linked when no project binding exists, and the browser opens directly
  at the Workspace page (`http://127.0.0.1:8765/#/workspace`).
- Bundled the React Workspace portal into the wheel (`pipyter/static`), so the
  portal and the Runtime API are served from the same origin after install.
- Jupyter-style Workspace UI refinements:
  - Persistent CodeMirror 6 editing for code cells and Python files with
    syntax highlighting, line numbers, and 4-space auto-indent.
  - Markdown cells with stable click/edit height and unified blue focus
    styling across cell gutter, source, and output.
  - File browser with single-line breadcrumbs (`.../current-dir`), official
    Jupyter/Python/Markdown file badges, root-folder navigation, and compact
    toolbar.
  - Flush document tab strip without hover gaps, custom Code/Markdown cell
    type menu, Lucide + Iconify icon set, and light JupyterLab-mapped theme
    with switchable code palettes.

### Changed

- Terminal and Pilot panels are collapsed by default in the Workspace.
- Workspace persistence key bumped to `pipyter.workspace.v2`; state saves are
  debounced and flushed on `pagehide`.

### Fixed

- Cell click bubbling no longer resets editing state; floating cell toolbars
  no longer change cell height on hover.
- Removed output collapse buttons and the notebook demo subtitle row.
- Root-level folder navigation stops at the workspace root.

## [0.1.0] - 2025-08-10

### Added

- Initial Pipyter release: project binding, credentials, Runtime API
  (workspace / files / notebooks / kernels / terminals), CLI commands
  (`auth`, `project`, `up`, `down`, `status`, `doctor`, `serve`), and the
  Jupyter-style React Workspace portal.
