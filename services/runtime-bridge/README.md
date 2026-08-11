# Pipyter Runtime Bridge

The installable implementation currently lives in `src/pipyter/server`, `src/pipyter/kernel`, `src/pipyter/terminal`, and `src/pipyter/workspace`.

This boundary exposes stable `/api/v1` contracts to the browser while keeping Jupyter clients, files, Notebook/Kernels, persistent Shell sessions, and Pigent on the compute node. Pigent first-party runtime code lives in tracked `packages/pigent/`; ignored `engines/` trees are not runtime inputs. User model configuration is injected from `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json` and `auth.json` only; the bridge never exposes raw provider secrets or adds a `models.json`/`models-store.json` path. A production deployment may run the bridge as a dedicated service without moving protocol ownership into Jupyter or the Pigent Node host.
