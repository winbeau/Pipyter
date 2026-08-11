# Verification and PyPI release

## Python checks

- Unit tests for project discovery, path validation, state persistence and command construction.
- FastAPI tests for health, workspace, file and notebook endpoints.
- CLI smoke for help, doctor and project commands.
- `uv build` or `python -m build` creates sdist and wheel.
- Inspect wheel contents, install into a clean environment, and run a separate `uv tool install` smoke as the recommended user path.

## Web checks

- `pnpm typecheck`
- `pnpm build`
- Browser checks for menus, file tree, tab switching, cell run/add/delete/move, terminal and status changes.
- Do not freeze the old Pilot panel as a regression target; Pigent/Shell layout and behavior are verified by the dedicated migration plan.

## Release artifacts

- Root `LICENSE`, `UPSTREAM.md` and third-party license copies.
- PyPI metadata, project URLs and Python version classifiers.
- Version comes from `src/pipyter/_version.py`.

## Stop conditions

- Do not publish to PyPI in this milestone without explicit user approval.
- Keep `engines/` ignored and out of normal build/runtime inputs; first-party Agent code is copied into tracked Pipyter source only in the dedicated Pigent migration.
- Do not claim remote authentication, multi-user isolation or persistent WebSocket terminals are production-complete until their dedicated connectors exist.
