# Verification and PyPI release

## Python checks

- Unit tests for project discovery, path validation, state persistence and command construction.
- FastAPI tests for health, workspace, file and notebook endpoints.
- CLI smoke for help, doctor and project commands.
- `uv build` or `python -m build` creates sdist and wheel.
- Inspect wheel contents and install into a clean environment.

## Web checks

- `pnpm typecheck`
- `pnpm build`
- Browser checks for menus, file tree, tab switching, cell run/add/delete/move, terminal and status changes.
- Confirm Pilot open/collapse remains available.

## Release artifacts

- Root `LICENSE`, `UPSTREAM.md` and third-party license copies.
- PyPI metadata, project URLs and Python version classifiers.
- Version comes from `src/pipyter/_version.py`.

## Stop conditions

- Do not publish to PyPI in this milestone without explicit user approval.
- Do not modify nested engine repositories.
- Do not claim remote authentication, multi-user isolation or persistent WebSocket terminals are production-complete until their dedicated connectors exist.
