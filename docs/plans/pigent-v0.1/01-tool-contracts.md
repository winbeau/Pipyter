# Pigent tool contracts and compatibility

## Goal

Expose a small, stable tool catalog to the model while allowing Pipyter internals to stay modular. Public names are product API and require protocol-versioned changes; internal service classes and helper endpoints may be more granular.

## Canonical catalog

| Tool | Layer | Mutates | Primary runtime owner |
| --- | --- | --- | --- |
| `read` | Workspace | No | file service |
| `view` | Workspace/multimodal | No | file/artifact service |
| `write` | Workspace | Yes | file service |
| `update` | Workspace | Yes | file service |
| `bash` | Workspace execution | Potentially | terminal service |
| `notebook` | Notebook document | Depends on action | notebook service |
| `kernel` | Notebook runtime | Depends on action | kernel service |
| `inspect` | Runtime inspection | No intended mutation | inspection service |
| `tasks` | Orchestration | Yes, structured state | Dynamic Task adapter |
| `delegate` | Orchestration | Child-dependent | AgentPool adapter |

`grep`, `find`, `ls`, document discovery, workflow, background, monitor, remote, and privilege helpers remain internal or future optional capabilities. They are not separate Pigent v0.1 product tools.

## Common request context

The LLM supplies only the tool’s public parameters. The Pigent host injects trusted context before dispatch:

```json
{
  "protocol_version": "0.1",
  "tool_call_id": "call_...",
  "session_id": "pigent_...",
  "workspace_id": "workspace_...",
  "mode": "auto",
  "active_document": {
    "path": "analysis.ipynb",
    "revision": "sha256:...",
    "cell_id": "cell-..."
  },
  "active_kernel_id": "kernel_..."
}
```

The model must not be able to override `workspace_id`, `session_id`, mode, active kernel ownership, or bridge credentials.

## Common result envelope

Every Python-backed tool returns structured details in one versioned envelope, while the normal tool `content` remains a concise text/image representation for the model:

```json
{
  "version": 1,
  "ok": true,
  "summary": "Updated src/model.py",
  "data": {},
  "artifacts": [],
  "revisions": {
    "before": "sha256:...",
    "after": "sha256:..."
  },
  "warnings": []
}
```

Failure shape:

```json
{
  "version": 1,
  "ok": false,
  "summary": "Notebook changed since it was read",
  "error": {
    "code": "revision_conflict",
    "message": "Expected sha256:a, current sha256:b",
    "retryable": true,
    "details": {}
  },
  "warnings": []
}
```

Stable error codes should include at least:

- `invalid_request`
- `invalid_path`
- `permission_denied`
- `not_found`
- `unsupported_media`
- `too_large`
- `revision_conflict`
- `mode_denied`
- `confirmation_required`
- `kernel_unavailable`
- `kernel_busy`
- `execution_timeout`
- `cancelled`
- `internal_error`

## Cross-tool invariants

1. Relative paths resolve from the active workspace/cwd for convenience. Absolute paths and parent traversal are valid in Auto when the runtime OS user can access the resolved target; Ask/Plan may use readable targets through their non-mutating actions.
2. Text, table previews, output arrays, and images are bounded. Full data is never inserted into model context by default.
3. Structured mutations are atomic and target-serialized. Two concurrent calls touching the same file or notebook cannot perform read-modify-write from the same stale base.
4. Structured mutations accept an expected revision when the caller previously read the target. A stale expected revision fails instead of silently overwriting browser/user changes.
5. `tool_call_id` is an idempotency key for a short retention window. Retried insert/delete/run operations return the recorded result instead of applying twice.
6. Cancellation propagates from Agent abort to Python operation and then to subprocess/kernel cancellation where supported.
7. Python rechecks the trusted Ask/Plan/Auto session mode immediately before the operation. In Auto it applies normal OS-user permissions rather than a workspace confinement policy.
8. Result details contain no raw credentials, Authorization headers, Jupyter tokens, terminal authentication input, environment secrets, or unrestricted object serialization.

## `read`

Purpose: text-oriented reading for source, Markdown, JSON, TOML, YAML, CSV, logs, and similar files.

Suggested public parameters for a file:

```json
{
  "path": "results.csv",
  "offset": 1,
  "limit": 400
}
```

A directory path returns a bounded listing instead of requiring a separate `list` tool:

```json
{
  "path": "src",
  "depth": 1,
  "limit": 200
}
```

Behavior:

- Decode UTF-8 by default; report an explicit encoding error rather than silently replacing arbitrary bytes.
- For directories, return resolved/display path, name, kind, size, and modified metadata; default to one level and cap recursive depth tightly.
- Preserve current 2,000-line/50-KB style bounds or a protocol-defined equivalent.
- Return continuation metadata when truncated.
- Reject image and binary MIME types with `unsupported_media` and a message to use `view`.
- Do not add separate `list`, `grep`, or `find` tools in v0.1. Ask/Plan can discover bounded trees through `read`; Auto uses `bash` for complex searches.

## `view`

Purpose: the visual counterpart of `read`.

Use a discriminated source so files, cell outputs, and in-memory figures remain one tool without ambiguous optional fields:

```json
{
  "source": {
    "kind": "file",
    "path": "figures/latency.png"
  }
}
```

```json
{
  "source": {
    "kind": "cell_output",
    "notebook_path": "analysis.ipynb",
    "cell_id": "cell-a1",
    "output_index": 0
  }
}
```

```json
{
  "source": {
    "kind": "figure",
    "figure_id": "figure-17"
  }
}
```

v0.1 formats:

- PNG, JPEG, WebP, GIF first frame, BMP after safe conversion.
- SVG only after sanitization and rasterization for model delivery.
- Cell display output containing `image/png`, `image/jpeg`, or sanitized SVG.
- Figure artifacts emitted by `inspect` or `notebook.run_cell`.

Result includes media type, dimensions, source reference, optional conversion/resizing notes, and `ImageContent`. `watch` is intentionally not an alias.

## `write`

Purpose: create a file or replace its complete contents.

```json
{
  "path": "reports/summary.md",
  "content": "# Summary\n",
  "expected_revision": null
}
```

Rules:

- Create parents under the workspace when needed.
- For an existing file, use `expected_revision` when a prior read informed the rewrite.
- Return bytes written and before/after revisions.
- Use `update` for focused edits instead of rewriting large existing files.
- Reject binary output in v0.1; generated images belong to kernel/figure export services.

## `update`

Purpose: precise modification of an existing text file. This is the public replacement for engine `edit`.

Two strategies share one tool:

### Exact replacements

```json
{
  "path": "src/model.py",
  "strategy": "replace",
  "expected_revision": "sha256:...",
  "edits": [
    {"old_text": "lr = 1e-3", "new_text": "lr = 3e-4"}
  ]
}
```

Each `old_text` must match exactly once in the original content. Edits are evaluated against the same original revision, must not overlap, and are applied atomically.

### Unified diff

```json
{
  "path": "src/model.py",
  "strategy": "patch",
  "expected_revision": "sha256:...",
  "patch": "@@ -1,2 +1,2 @@\n-...\n+..."
}
```

v0.1 patch mode remains single-file. Multi-file patches belong in a later version or an explicitly reviewed `bash` operation. The result always returns the actual unified diff and new revision.

## `bash`

Purpose: Shell, Python, Git, environment management, and script execution without creating separate tools.

```json
{
  "command": "python -m pytest tests/test_model.py -q",
  "cwd": ".",
  "timeout": 120
}
```

Rules:

- Relative `cwd` starts from the active workspace; Auto may use any absolute/parent cwd available to the runtime OS user.
- The command runs as the same OS/container identity as the Pipyter runtime and can use that identity's files, programs, network, devices, and system facilities.
- Output is streamed, tail-truncated for model context, and retained in a bounded runtime log when long.
- Preserve the user/runtime environment needed for normal commands while removing provider keys, bridge credentials, and other values that must not enter child process logs or delegated contexts.
- Process ownership is recorded and the owned process tree is cancelled on abort or timeout where supported.
- Python may classify network, package manager, destructive, privilege, outside-workspace, or interactive intent for UI/audit facts, but Auto does not deny the command on those labels.
- Commands requiring a TTY, password, hardware key, browser approval, or other direct input emit an interaction/PTY handoff. Secret input goes directly to the process and never through the model transcript.
- OS permission, command-not-found, and program exit failures are returned as execution results rather than rewritten as application policy denial.

## `notebook`

One tool with exactly the requested public actions:

```text
read_cell
update_cell
insert_cell
delete_cell
move_cell
run_cell
add_markdown
clear_output
```

Common fields:

- `path`: notebook path.
- `cell_id`: stable nbformat cell ID where applicable.
- `expected_revision`: document revision for mutations.
- `position` or `target_cell_id`: insertion/move location.
- `source`: string for cell content.

`run_cell` is high-level: execute the source in the notebook’s bound current kernel, collect IOPub outputs, update execution count, and persist outputs under one document revision transaction. Low-level scratch execution uses `kernel.execute`.

Full action contracts and conflict semantics are in [02-notebook-runtime.md](02-notebook-runtime.md).

## `kernel`

One tool for the current Jupyter kernel:

```text
status
execute
interrupt
restart
shutdown
```

`execute` is scratch/runtime code not tied to a notebook cell. It returns bounded Jupyter message-derived output. Starting or binding a kernel is normally a host action derived from the active notebook, not something the model chooses by arbitrary kernel ID.

## `inspect`

One tool with bounded runtime views:

```text
variables
variable
dataframe
figure
object
```

Examples:

```json
{"action": "variables", "limit": 100}
```

```json
{"action": "dataframe", "name": "results", "rows": 20, "columns": 30}
```

```json
{"action": "figure", "name": "fig", "format": "png"}
```

Inspection runs in the current kernel but avoids pickle, full tensor transfer, unrestricted recursive traversal, and arbitrary browser delivery. Generic object inspection defaults to type/shape/length/safe metadata; potentially side-effectful `repr` is bounded and opt-in.

## `tasks`

Public adapter over the versioned Dynamic Task runtime.

Recommended actions:

```text
get
replace
patch
```

Public statuses:

```text
pending · running · done · blocked · failed
```

Adapter mapping:

| Pigent | Engine |
| --- | --- |
| `running` | `active` |
| `done` | `completed` |
| `tasks` | `tasks_update` |

Keep compare-and-swap revisions. Only the Coordinator can add, remove, rename, reorder, reopen, or change dependencies. Child agents may report facts but cannot rewrite structure.

Plan mode can create/update Tasks without executing workspace changes. Ask mode does not create Tasks by default.

## `delegate`

Public adapter over AgentPool:

```json
{
  "task": "分析这组实验数据并寻找异常",
  "agent": "analysis",
  "timeout": 300
}
```

Rules:

- `agent` maps to a configured profile ID; suggested product profiles are `analysis`, `research`, `review`, and later `implementation`.
- Tool execution mode is parallel so independent delegate calls can run concurrently.
- Results remain structured: summary, references/citations, modified files, checks, diagnostics, clarification request, usage, budget, and last activity.
- No child transcript is injected into the Coordinator.
- Controlled children never receive `delegate` themselves.
- Ask/Plan permit non-writing profiles only. Auto may assign an implementation profile with the full public tool set and runtime-user execution capability.
- User decisions requested by a child return as a structured clarification request; the Coordinator resolves it from context or asks the user.

## Hidden host interactions

The following are host protocol events, not additional LLM tools:

- user question/clarification UI;
- interactive PTY/browser handoff and optional user-configured operation review;
- mode selection;
- active notebook/cell/kernel context updates;
- cancellation;
- provider credential setup;
- runtime health and reconnect.

Keeping these outside the advertised tool list preserves the ten-tool product surface.

## Compatibility implementation

### Stage 1: adapters

- Build new `view`, `notebook`, `kernel`, and `inspect` as custom ToolDefinitions.
- Wrap existing engine file edit behavior as public `update`.
- Wrap Dynamic Tasks and AgentPool as `tasks` and `delegate`.
- Disable old aliases in new Pigent sessions.

### Stage 2: engine cleanup where justified

- Separate current `read` image behavior into reusable text and image primitives.
- Allow runtime identity/config paths to be injected so Pigent has no user-visible BeauPi naming.
- Keep old engine APIs only for standalone engine compatibility, not in the Pigent prompt.

### Stage 3: session import

If old sessions must be resumed, translate stored tool calls/results during import:

```text
edit          → update
 tasks_update → tasks
 delegate_task→ delegate
read(image)   → view(file)
```

Do not advertise both names to the model during live execution.
