# Pipyter Workspace v0.1 implementation plan

## Goal

Deliver a PyPI-installable `pipyter` package that can bind a project directory, start a local runtime around JupyterLab, expose a stable Workspace API, and serve the React portal with a JupyterLab-inspired Workspace. Pigent runtime and its redesigned panel/Shell integration are implemented by the follow-on Pigent plan.

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

## Follow-on Pigent and Shell migration

The old static Pilot-labelled panel is not a compatibility target. [Pigent v0.1](../pigent-v0.1/README.md) replaces it with the latest designs: Pigent naming, Ask/Plan/Auto, canonical `/pigent`, a shared live Pigent session, a 360 px light Workspace panel, and a persistent multi-session Shell. It also directly copies BeauPi first-party runtime code into tracked `packages/pigent/` while `engines/` remains ignored.

## Completion criteria

- `uv tool install .` exposes the `pipyter` command as the preferred user-level installation; `pip install .` remains a packaging smoke path.
- `pipyter project link .`, `pipyter doctor`, `pipyter up .`, `pipyter status`, and `pipyter down` have implemented behavior.
- Workspace API validates paths against the linked project root.
- React Workspace provides the JupyterLab-style non-Agent baseline consumed by the Pigent/Shell migration.
- Python and web builds pass without reading or modifying ignored `engines/` as part of normal build/runtime behavior.
