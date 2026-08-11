# Protocol and API

## Stable objects

- `Account`, `Node`, `Project`, `Workspace`, `RuntimeStatus`
- `FileEntry`, `DocumentTab`, `NotebookCell`, `KernelSession`, `TerminalSession`
- Device authorization request/response and runtime health messages

## Runtime API

- `GET /api/v1/health`
- `GET /api/v1/workspace`
- `GET /api/v1/files?path=...`
- `GET|PUT /api/v1/files/content?path=...`
- `POST /api/v1/files/directory`
- `DELETE /api/v1/files?path=...`
- `GET|PUT /api/v1/notebooks?path=...`
- `GET|POST /api/v1/kernels`
- `POST /api/v1/kernels/{id}/execute`
- `POST /api/v1/kernels/{id}/restart`
- `DELETE /api/v1/kernels/{id}`
- `POST /api/v1/terminals/execute`
- `GET /api/v1/running`

## Shared artifacts

- Python Pydantic models live in `src/pipyter/protocol`.
- TypeScript contracts and JSON schemas live in `packages/protocol`.
- Web UI consumes the same field names and protocol version.

## Security

- Reject absolute paths and `..` traversal outside the workspace.
- Never return raw Jupyter or node credentials.
- Use separate runtime API credentials when remote routing is enabled.
