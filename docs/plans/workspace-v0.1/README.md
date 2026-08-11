# Pipyter Workspace v0.1 implementation plan

## Goal

Deliver a PyPI-installable `pipyter` package that can bind a project directory, start a local runtime around JupyterLab, expose a stable Workspace API, and serve the existing React portal with a JupyterLab-inspired Workspace. Pi/BeauPi remains an engine boundary and is not expanded in this milestone.

## Architecture boundary

```text
Browser React Workspace
        │ HTTP / future WebSocket
        ▼
Pipyter Runtime API
  ├── workspace/files/notebooks
  ├── kernel execution adapter
  ├── terminal execution adapter
  └── runtime/session status
        │
        ▼
Jupyter Server / JupyterLab / kernels
```

Product code stays outside `engines/`. JupyterLab is launched as an installed Python dependency and referenced for interaction behavior; its copied source is not modified.

## Milestones

1. **Packaging and CLI** — installable `pipyter`, project binding, credentials, doctor, up/down/status.
2. **Runtime and protocol** — path-safe file/notebook APIs, kernel and terminal adapters, persisted runtime state.
3. **Workspace UI** — JupyterLab shell areas, file browser, document tabs, notebook toolbar/cells, terminal, running state, status bar.
4. **Integration** — API client with local fallback, runtime launch config, web proxy.
5. **Release verification** — Python tests/build, CLI smoke, API smoke, TypeScript build and browser interaction checks.

## Detailed plans

- [Python package and CLI](01-python-package.md)
- [Runtime, Jupyter and control services](02-runtime-control.md)
- [Protocol and API](03-protocol-api.md)
- [React Workspace](04-web-workspace.md)
- [Verification and PyPI release](05-verification-release.md)

## Completion criteria

- `uv tool install .` or `pip install .` exposes the `pipyter` command.
- `pipyter project link .`, `pipyter doctor`, `pipyter up .`, `pipyter status`, and `pipyter down` have implemented behavior.
- Workspace API validates paths against the linked project root.
- React Workspace retains the existing Pilot open/collapse interaction and adds JupyterLab-style non-Agent functionality.
- Python and web builds pass without modifying `engines/`.
