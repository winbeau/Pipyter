# Runtime, Jupyter and control services

## Runtime manager

- Build explicit JupyterLab and Runtime API command lines.
- Bind JupyterLab to loopback with a workspace-scoped base URL and generated token.
- Store only token fingerprints in public runtime status; keep raw tokens process-local or in restricted state.
- Reuse a live runtime instead of restarting kernels on repeated `up`.

## Workspace service

- Resolve project binding by walking parent directories.
- Return workspace identity, root path, open documents, kernel/terminal summary and health.
- Expose file listing, file read/write, notebook read/write and directory creation.

## Kernel adapter

- Start Python kernels through `jupyter_client`.
- Execute code and collect stream/result/error/display messages.
- Expose busy/idle/restarting/dead state.
- Restart and shutdown with explicit API calls.

## Terminal adapter

- v0.1 executes bounded commands in the workspace root and returns stdout/stderr/exit code.
- The protocol keeps terminal session IDs so a persistent PTY/WebSocket implementation can replace it later.

## Control plane seam

- Keep account/project/node/workspace records in `pipyter.control` models and registry interfaces.
- v0.1 persists local development records; production gateway storage is a replaceable connector.
