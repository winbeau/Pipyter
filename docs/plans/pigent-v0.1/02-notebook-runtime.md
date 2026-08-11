# Notebook, Kernel, Inspect and visual artifacts

## Goal

Make Pigent operate the notebook document and the notebook’s current Jupyter kernel as one coherent runtime. Avoid model-generated full `.ipynb` rewrites, avoid separate shadow kernels, and prevent stale browser/Agent edits from overwriting each other.

## Ownership model

```text
Notebook file on disk
       │
       ▼
NotebookDocumentService
  ├── nbformat validation
  ├── stable cell ids
  ├── document revision / atomic save
  ├── per-document mutation queue
  └── output persistence
       │ binds to
       ▼
KernelSessionRegistry
  ├── notebook → current kernel
  ├── state / execution count
  ├── sequential execute queue
  └── interrupt/restart/shutdown
       │
       ├── InspectionService
       └── ArtifactRegistry → view
```

Pigent sees high-level ToolDefinitions. Python services own notebook JSON and Jupyter messages.

## Required dependencies

Add an explicit runtime dependency on `nbformat>=5.10,<6` rather than relying on it transitively through JupyterLab. Continue using `jupyter_client` for kernel messaging. Add `pandas` or Matplotlib only as optional inspected-kernel capabilities; Pipyter should not import them in its own server process merely to inspect a user kernel.

## Notebook document model

### Stable cell identity

- Require nbformat 4.5-compatible cell IDs.
- On the first read or mutation, assign IDs to legacy cells that lack them.
- Persist normalized IDs atomically before returning mutation-capable context.
- Use `cell_id` as the primary address. Index is display metadata and may change after insert/move/delete.
- Return `index` with each read result so the UI/model can orient itself without using it as a durable key.

### Source normalization

- Public protocol exposes `source` as one string.
- Read accepts legacy notebook `source` arrays and joins them without semantic changes.
- Write serializes valid nbformat while preserving notebook metadata and unrelated cell fields.
- `update_cell` changes only explicitly supplied fields.

### Document revision

Use an opaque content revision derived from raw notebook bytes:

```text
sha256:<hex>
```

Every read returns it. Every mutation requires `expected_revision` unless the host proves it is operating on the current in-memory document transaction.

A mutation conflict returns:

```json
{
  "code": "revision_conflict",
  "expected": "sha256:a",
  "current": "sha256:b",
  "retryable": true
}
```

The model must re-read the affected cell/document before retrying. It must not blindly remove the revision check.

### Browser dirty-state handshake

The browser may have an unsaved editor buffer. Before a Pigent notebook mutation:

1. Browser publishes active document path, revision, and dirty state to Pipyter.
2. If dirty, Pipyter requests a save/flush through the session channel.
3. The mutation waits for the new revision or returns `document_dirty`/`revision_conflict`.
4. After mutation, Pipyter broadcasts the new document revision and changed cell IDs so the browser reloads or applies the patch.

Do not let the Agent mutate disk behind an unsaved browser buffer without this handshake.

## `notebook` actions

### `read_cell`

Input:

```json
{
  "action": "read_cell",
  "path": "analysis.ipynb",
  "cell_id": "cell-a1",
  "include_outputs": true
}
```

Result:

- document revision;
- cell ID and current index;
- `cell_type`, source, execution count, selected metadata;
- bounded outputs when requested;
- output artifact references instead of large inline payloads.

A host-only context helper may read the active/selected cell without exposing a separate public action.

### `update_cell`

Input:

```json
{
  "action": "update_cell",
  "path": "analysis.ipynb",
  "cell_id": "cell-a1",
  "expected_revision": "sha256:...",
  "source": "df = load_data()",
  "cell_type": "code"
}
```

Rules:

- Require at least one changed field.
- Preserve outputs by default when only source or metadata changes; allow `clear_outputs: true` explicitly.
- Reject unsupported cell-type conversion or invalid metadata.
- Return before/after revision and changed cell snapshot.

### `insert_cell`

Input:

```json
{
  "action": "insert_cell",
  "path": "analysis.ipynb",
  "expected_revision": "sha256:...",
  "cell_type": "code",
  "source": "print(df.shape)",
  "position": {
    "kind": "after",
    "cell_id": "cell-a1"
  }
}
```

Supported positions:

```text
before <cell_id>
after <cell_id>
start
end
```

The runtime generates the new cell ID. `tool_call_id` deduplicates retries so an interrupted response cannot insert the same cell twice.

### `delete_cell`

- Require path, cell ID, and expected revision.
- Return deleted cell summary and surrounding cell IDs.
- Reject deleting a missing cell instead of silently succeeding.
- Deleting the last cell is valid only if an empty notebook is valid for the current product behavior.

### `move_cell`

- Require source `cell_id`, target position, and expected revision.
- Compute the move against stable IDs, not stale indices.
- A no-op move returns success without changing the document revision.

### `run_cell`

Input:

```json
{
  "action": "run_cell",
  "path": "analysis.ipynb",
  "cell_id": "cell-a1",
  "expected_revision": "sha256:...",
  "timeout": 120,
  "save_outputs": true
}
```

Execution transaction:

1. Verify document revision and resolve the cell.
2. Resolve the notebook’s current kernel binding.
3. Wait for that kernel’s execute queue; reject or report waiting state if policy requires.
4. Execute the exact persisted cell source.
5. Collect parent-correlated IOPub messages until idle, cancellation, timeout, or kernel death.
6. Convert streams, execute results, display data, and errors to nbformat outputs.
7. Store large images/tables in `ArtifactRegistry` and keep normal notebook MIME payloads within configured limits.
8. Recheck document revision before writing outputs. If the source changed while code ran, return the execution result but do not overwrite the newer cell; report `output_persist_conflict`.
9. Persist execution count and outputs atomically when `save_outputs` is true.
10. Broadcast cell/output/kernel events to the browser and return the new revision.

`notebook.run_cell` is not an alias for arbitrary `kernel.execute`: it guarantees document/source/output linkage.

### `add_markdown`

This is intentional sugar over `insert_cell`:

```json
{
  "action": "add_markdown",
  "path": "analysis.ipynb",
  "expected_revision": "sha256:...",
  "source": "## Result",
  "position": {"kind": "after", "cell_id": "cell-a1"}
}
```

It creates a markdown cell with empty outputs and execution count.

### `clear_output`

Support either one cell or the whole notebook without adding another tool:

```json
{
  "action": "clear_output",
  "path": "analysis.ipynb",
  "cell_id": "cell-a1",
  "expected_revision": "sha256:..."
}
```

Omitting `cell_id` means all code cells only when the schema explicitly sets `scope: "all"`; do not infer a whole-notebook destructive action from an omitted field.

## Kernel binding

### Current kernel semantics

“Current kernel” means the kernel bound to the active notebook in the Pipyter workspace session. The model does not choose an arbitrary global kernel ID.

The browser/runtime context sends:

```json
{
  "notebook_path": "analysis.ipynb",
  "kernel_id": "kernel-...",
  "kernel_name": "python3",
  "document_revision": "sha256:..."
}
```

`KernelSessionRegistry` verifies that the kernel belongs to the same workspace and notebook binding before use.

### Initial implementation path

- Extend the existing in-process `KernelRuntime` with notebook bindings and per-kernel execute locks.
- Use the same Runtime API-created kernel already used by the Pipyter Workspace.
- Do not start a private Pigent-only kernel.

### Later JupyterLab attachment

When the browser uses Jupyter Server-managed sessions directly, add an adapter that resolves active Jupyter sessions/kernels through authenticated server APIs or connection metadata. Keep the `KernelSessionRegistry` interface stable so tools do not care which adapter owns the kernel.

## `kernel` actions

### `status`

Return:

- bound notebook path;
- kernel name and language;
- `starting`, `idle`, `busy`, `restarting`, or `dead`;
- execution count;
- queue depth;
- last activity timestamp;
- runtime execution identity/backend facts relevant to reproducing user execution.

### `execute`

Use for scratch code or runtime probes not represented by a notebook cell:

```json
{
  "action": "execute",
  "code": "df.shape",
  "timeout": 30,
  "store_history": false
}
```

- Execute sequentially in the current kernel.
- Default `store_history` to false for internal inspection-like probes and true only for user-visible scratch execution when desired.
- Return Jupyter-derived outputs and execution status.
- Do not write notebook outputs.
- Classify it as code execution for mode policy.

### `interrupt`

Interrupt the current kernel, report whether an execution was active, and keep the notebook binding.

### `restart`

Restart is unavailable in Ask/Plan and directly available in Auto. Clear execution count/runtime object registry and mark previous figure/variable artifact references stale; optional review UI may warn about active user work without creating a hidden capability restriction.

### `shutdown`

Shut down the current bound kernel and clear the binding. This is a destructive runtime action and should not be available in Ask/Plan.

## `inspect` design

Inspection executes a small, versioned helper payload inside the current kernel. Keep helper names private and avoid leaving normal user variables behind.

### `variables`

Return a bounded namespace summary:

```json
{
  "variables": [
    {
      "name": "df",
      "type": "pandas.core.frame.DataFrame",
      "shape": [1200, 14],
      "size_hint": 16800
    }
  ],
  "truncated": false
}
```

Defaults:

- exclude names beginning with `_`;
- exclude modules, functions, classes, and known IPython machinery unless requested;
- no full values;
- max variable count and response bytes.

### `variable`

Return type, shape, dtype, length, device, and a small scalar/sequence preview where safe. Do not call unrestricted recursive serializers.

For tensors/arrays:

- report shape, dtype, device, and memory estimate;
- do not transfer full GPU tensors to CPU;
- sample only with explicit bounded parameters.

### `dataframe`

Detect pandas-compatible DataFrames through runtime type checks in the kernel. Return:

- shape;
- column names and dtypes, bounded by column limit;
- index summary;
- bounded `head`/`tail` or selected row window;
- null counts only when requested because they may be expensive;
- JSON-safe scalar conversion with truncation markers.

Large tables become structured artifacts that the browser can render, while the model receives a bounded preview.

### `figure`

Support Matplotlib first:

- resolve by variable name or current figure number;
- extract metadata: size, DPI, axes count, labels, titles, legends, line/image counts;
- render PNG by default and optional sanitized SVG;
- register an immutable `figure_id` artifact with kernel generation and source hints;
- return image content so the model can inspect it immediately.

Later backends can add Plotly/Vega adapters without changing the top-level `inspect` tool.

### `object`

Generic metadata fallback:

- fully qualified type;
- safe `len`, shape, dtype, keys/attributes sampled under a limit;
- bounded `repr` only when `include_repr: true`;
- per-inspection timeout;
- catch user-defined property/repr failures as warnings.

Python object inspection is not perfectly side-effect free because user-defined methods can run code. Ask/Plan should use conservative metadata defaults and never claim mathematical read-only purity.

## Artifact registry and `view`

`ArtifactRegistry` stores bounded runtime outputs outside normal model context:

```text
<workspace>/.pipyter/pigent/artifacts/
```

Each artifact records:

- ID and kind (`image`, `table`, `text`, later `file`);
- workspace and session ID;
- notebook path, cell ID, kernel ID/generation where applicable;
- MIME type, dimensions/shape, size, creation time;
- content hash and expiry/retention policy;
- path to restricted local payload.

Rules:

- Artifact IDs are unguessable and scoped to workspace/session authorization.
- Kernel restart invalidates live-object references but not already-rendered immutable images.
- Browser download/render endpoints revalidate workspace access.
- SVG is sanitized or rasterized.
- Artifact cleanup never deletes user-authored workspace files.

`view` reads file images or these artifact references through one public contract.

## Concurrency and failure handling

| Resource | Serialization rule |
| --- | --- |
| Notebook document | one mutation transaction per path |
| Notebook `run_cell` | document preflight, then one execution per bound kernel, then document commit |
| Kernel | one execute message at a time; interrupt may preempt |
| Inspect | joins kernel queue; read-like calls may not run concurrently with user code |
| Artifact write | unique immutable ID; no in-place mutation |

Important failures:

- kernel dies during execution: return captured partial output plus `kernel_dead`;
- timeout: interrupt, wait for idle, then mark `execution_timeout`; restart only by explicit policy;
- document changes during execution: return output but skip stale persistence;
- browser disconnect: execution continues or cancels according to request policy, with events retained for reconnect;
- output exceeds bounds: store artifact/log and return a compact reference.

## Verification

Targeted tests:

1. legacy notebook gets stable IDs once and remains valid nbformat;
2. stale revision blocks every mutation action;
3. insert retry with the same `tool_call_id` inserts only once;
4. move/delete use IDs correctly after index changes;
5. run cell persists execution count, streams, results, display data, and errors;
6. source changed during execution does not receive stale outputs;
7. current-kernel binding prevents cross-workspace kernel use;
8. inspect variable/DataFrame/Figure returns bounded structured data;
9. large figure/table becomes an artifact and `view` can retrieve it;
10. restart invalidates live references;
11. abort/timeout terminates the active execution path and leaves the kernel state known;
12. browser dirty-state handshake prevents lost edits.
