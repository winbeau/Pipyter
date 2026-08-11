# Upstream snapshots

Pipyter product code is maintained outside `engines/`. The local engine checkouts are reference and integration sources and retain their upstream licenses.

## JupyterLab

- Repository: `jupyterlab/jupyterlab` (local project fork checkout)
- Imported commit: `08b3325c4ad3a0c817e56d883612b2b167e7404c`
- License: BSD-3-Clause
- Role: notebook, kernel, terminal, file browser, document shell and Jupyter Server engine

## BeauPi / Pi

- Repository: BeauPi / Pi local project fork checkout
- Imported commit: `bdf94680d14232bc47df872d3cf9a09bbcd5a000`
- Local description: `v1.1.0-1-gbdf94680`
- License: MIT
- Role: optional Agent engine; not expanded by the Workspace v0.1 implementation

## Update policy

1. Record the new upstream commit before merging engine changes.
2. Keep Pipyter product behavior in `src/`, `packages/`, `services/`, and `web/`.
3. Preserve upstream copyright headers and refresh `THIRD_PARTY_LICENSES/` when license text changes.
