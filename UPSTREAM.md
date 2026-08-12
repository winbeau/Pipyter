# Source snapshots and local references

Pipyter product code is maintained outside `engines/`. The entire `engines/` tree remains Git-ignored and is only a local source/reference area; normal build, test, packaging, and runtime paths must work without it.

## JupyterLab

- Repository: `jupyterlab/jupyterlab` (local project fork checkout)
- Imported commit: `08b3325c4ad3a0c817e56d883612b2b167e7404c`
- License: BSD-3-Clause
- Role: notebook, kernel, terminal, file browser, document shell and Jupyter Server engine

## BeauPi / Pi first-party source

- Local source checkout: `engines/beaupi/` (ignored)
- Current reference commit: `bdf94680d14232bc47df872d3cf9a09bbcd5a000`
- Local description: `v1.1.0-1-gbdf94680`
- Ownership: first-party code by the same author as Pipyter; no external engine/package boundary is retained after migration
- Migration: directly copy the useful `ai`, `agent`, and `coding-agent` package trees into tracked `packages/pigent/`, then rename, prune, modify, and release them as Pipyter code
- Build rule: no import, file dependency, build step, or runtime lookup may resolve back into `engines/beaupi/`
- Plans: `docs/plans/pigent-v0.1/08-beaupi-first-party-embedding.md` and `docs/plans/pigent-v0.1/09-user-install-model-config.md`
- User-state rule: do not inherit standalone `.beaupi`/`.pi` config; Pigent model/API configuration uses only Pipyter's `settings.json` and `auth.json`

## tool-ui design reference

- Local reference during v0.2 planning: `/tmp/tool-ui/` (ephemeral; not a build or runtime input)
- Decision: the tracked files under `web/src/pigent/tool-ui/` are a clean internal reimplementation of the action/surface registry pattern. No tool-ui source file, package dependency, asset, or copyright header was copied into Pipyter.
- Provenance consequence: no additional third-party license text is required for these implementation files; the directory name records the design influence only. Release/build verification must continue to work when `/tmp/tool-ui/` is absent.

## Source policy

1. Keep Pipyter product behavior in tracked `src/`, `packages/`, `services/`, and `web/`.
2. Treat `packages/pigent/` as the Pigent source of truth after the direct copy; future product changes happen there, not as a patch layer over the ignored checkout.
3. Require CI and package builds to pass with `engines/` absent.
4. Track external dependency metadata required by the shipped artifacts separately from the first-party BeauPi-to-Pigent code migration.
