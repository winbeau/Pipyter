# Changelog

All notable changes to Pipyter are documented in this file.

## [0.1.4] - 2026-08-11

### Added

- Bundled the first-party Pigent runtime in the Pipyter wheel and source
  distribution, with a new `pigent` console entrypoint and no dependency on a
  source checkout, global npm package, or first-launch download.
- Added ten Pigent tools (`read`, `view`, `write`, `update`, `bash`,
  `notebook`, `kernel`, `inspect`, `tasks`, and `delegate`) with Ask, Plan, and
  Auto execution modes, persistent public sessions, replayable events,
  Dynamic Tasks, and bounded AgentPool delegation.
- Added persistent POSIX Shell sessions with independent processes, resize,
  reconnect replay, signals, close/shutdown handling, and Pigent PTY handoff.
- Added the canonical `#/pigent` React experience, a shared Workspace Pigent
  panel, and a persistent Shell panel; legacy `#/pilot` bookmarks redirect to
  Pigent.
- Added deterministic exact-lock Pigent payload generation, hash manifests,
  wheel/sdist embedding, offline installation support, Node.js `>=22.19.0`
  diagnostics, and clean-install CI coverage.
- Added two-file Pigent model configuration using only `settings.json` and
  `auth.json`, with atomic writes, locking, strict permissions, and sanitized
  API responses.

### Changed

- Agent model selection is now backend-authoritative through
  `settings.json`; legacy model-store files and automatic BeauPi configuration
  inheritance are not loaded or packaged.
- Missing or outdated Node.js now disables only Pigent session creation while
  leaving ordinary Workspace, files, notebooks, kernels, and Shell features
  available.
- Product and persisted runtime namespaces now consistently use Pigent naming.

### Fixed

- Fixed Pigent event replay ordering, cursor monotonicity, subscription races,
  duplicate mode events, session lifecycle restoration, and active-run state.
- Fixed Shell reconnect ghost tabs, duplicate default names, PTY resize and
  control-key behavior, and keyboard accessibility for resize controls and
  icon actions.
- Removed remote font dependencies and forbidden legacy identity/configuration
  strings from release payloads; build verification now rejects regressions.

## [0.1.3] - 2025-08-11

### Changed

- Workspace UI typography scaled up (tabs, file tree, outputs, dialogs, code
  editors, status bar) for comfortable reading.
- Notebook filename moved from the center of the page to the right side of
  the toolbar row below the tab strip.
- Terminal toggle is now a labeled `Terminal` button with an icon, at the
  same level as `Pilot`.
- Run menu item simplified to `运行全部 Cell`.
- Breadcrumb navigation: clicking the current directory or the workspace
  root no longer reloads the file list; the folder button always returns to
  the workspace root; empty directories show a gray `当前目录无文件` hint
  instead of an `上级目录` button.

### Fixed

- Document tab strip: close button is right-aligned and tabs no longer show
  divider lines or a nested-container border.
- New-file dialog input shows a single border (focus outline removed).

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
