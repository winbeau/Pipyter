# Python package and CLI

## Package

- Root `pyproject.toml` uses `hatchling` and a `src/pipyter` layout.
- Runtime dependencies include FastAPI/Uvicorn, HTTPX, JupyterLab and Jupyter Client.
- The wheel contains Python sources and protocol schemas required by the runtime.

## CLI commands

- `pipyter auth login`: device-flow client contract and local development credential mode.
- `pipyter project link [PATH]`: create `.pipyter/project.toml` without storing secrets.
- `pipyter project show [PATH]`: resolve the nearest project binding.
- `pipyter up [PATH]`: start Runtime API and JupyterLab processes and persist state.
- `pipyter down [PATH]`: terminate persisted runtime processes safely.
- `pipyter status [PATH]`: display workspace/runtime state.
- `pipyter doctor [PATH]`: inspect Python, JupyterLab, project binding, directories and ports.
- `pipyter serve [PATH]`: run only the Runtime API for development.

## Persistence

- Pipyter account/node credentials: OS keyring or a separately scoped restrictive control-plane credential backend; do not use the Pigent provider store.
- Pigent provider/model settings: `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json`, mode `0600`.
- Pigent provider API addresses and credentials: `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/auth.json`, mode `0600`.
- Project metadata: `<project>/.pipyter/project.toml`.
- Runtime state: `<project>/.pipyter/runtime.json`.
- Runtime logs: `<project>/.pipyter/logs/`.

The follow-on Pigent plan permits no `models.json`, `models-store.json`, project model override, or automatic `.beaupi` inheritance; see [User installation and Pigent model configuration](../pigent-v0.1/09-user-install-model-config.md).

## Safety

- Never put access tokens in project metadata or command-line URLs.
- Resolve and validate all requested paths under the linked project root.
- Refuse stale or foreign PID termination.
