# Pipyter Runtime Bridge

The installable implementation currently lives in `src/pipyter/server`, `src/pipyter/kernel`, `src/pipyter/terminal`, and `src/pipyter/workspace`.

This boundary exposes stable `/api/v1` contracts to the browser while keeping Jupyter client, filesystem, terminal, and future BeauPi details on the compute node. A production deployment may run it as a dedicated service without moving protocol ownership into either engine.
