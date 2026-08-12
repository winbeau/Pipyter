# uv Kernel environment lifecycle

## Goal

Upgrade Pigent's `kernel` capability from “operate the one currently started kernelspec” to a managed environment and session system that supports:

1. quickly created, automatically cleaned temporary Python environments;
2. several named, long-lived uv-managed environments under the Pipyter user config directory;
3. consistent Kernel selection in Workspace and Pigent;
4. one authoritative execution queue and lifecycle model.

## Terminology

```text
Kernel environment
  A Python interpreter + installed packages + private kernelspec metadata.
  Persistent definition; no running process implied.

Kernel session
  A running Jupyter Kernel process created from one environment and optionally
  bound to a notebook. Runtime-owned and disposable.

Temporary environment
  Config-root environment with TTL, created for an experiment/tool request.

Maintained environment
  Named config-root environment retained until the user deletes it.
```

Do not call a maintained environment a “persistent kernel”; only the environment persists. Kernel processes restart and may die.

## Existing gaps to fix first

The current `KernelRuntime` has a simple in-memory handle map and system kernelspec enumeration. It lacks:

- notebook-to-kernel binding;
- a shared lock/queue across REST, Notebook, Inspect, and Pigent;
- `starting/restarting/dead/stopping` states;
- generation and stale object semantics;
- queue depth and activity timestamps;
- health/death detection and idle cleanup;
- uv environment provisioning or private kernelspec discovery.

`NotebookService` and `InspectionService` currently use separate lock maps. That must not continue once environment management is added.

## Configuration root

Resolve Kernel environments through the same trusted config root order as Pipyter:

```text
trusted runtime override
PIPYTER_CONFIG_HOME / existing canonical config variable
XDG_CONFIG_HOME/pipyter
~/.config/pipyter
```

Target:

```text
<pipyter-config>/kernels/
```

The implementation must use the repository's canonical config resolver. Do not introduce a competing `PIPYTER_KERNEL_HOME` unless a strong deployment requirement appears.

uv is an optional prerequisite for this subsystem, parallel to Node for Pigent:

- freeze a tested minimum uv version during Phase 0 based on the commands/flags actually used;
- `pipyter doctor` and capabilities return `uv_ok`, detected version, required version, and one exact finding;
- missing/incompatible uv hides/rejects create/sync/promote actions with `uv_missing`/`uv_incompatible` but leaves system kernelspecs, existing Kernel sessions, Workspace, Notebook, Shell, and normal Pigent turns usable;
- Pipyter never auto-downloads uv.

## Metadata model

### Registry

`registry.json` is an index/cache, not the sole truth. Each environment has its own metadata file and can be reconstructed by scanning known directories.

```json
{
  "version": 1,
  "revision": "sha256:...",
  "environments": [
    {
      "id": "env_...",
      "kind": "maintained",
      "slug": "research-py311",
      "relative_path": "maintained/research-py311",
      "metadata_revision": "sha256:..."
    }
  ]
}
```

### Environment metadata

```json
{
  "version": 1,
  "id": "env_...",
  "kind": "temporary",
  "slug": null,
  "displayName": "Temporary Python 3.12",
  "status": "ready",
  "pythonRequest": "3.12",
  "pythonVersion": "3.12.8",
  "interpreter": "pyvenv/bin/python",
  "requestedPackages": ["pandas", "matplotlib"],
  "packagePolicy": "explicit",
  "projectSource": null,
  "lockRevision": "sha256:...",
  "createdAt": "...",
  "updatedAt": "...",
  "lastUsedAt": "...",
  "expiresAt": "...",
  "lastError": null
}
```

Paths in browser/public results are logical/config-relative unless an authorized diagnostics endpoint explicitly returns a local path. Never include provider secrets or Kernel connection keys.

### Kernel session

```text
id
kernel_name / display_name / language
environment_id
notebook_path | null
status: starting|idle|busy|restarting|dead|stopping
execution_count
generation
queue_depth
started_at
last_activity_at
last_error (bounded)
```

## Environment creation

### Temporary

Request example:

```json
{
  "python": "3.12",
  "packages": ["pandas>=2", "matplotlib"],
  "ttlSeconds": 21600,
  "displayName": "CSV exploration"
}
```

Policy:

- default TTL: 6 hours after last use;
- minimum/maximum configurable, e.g. 15 minutes to 7 days;
- random unguessable ID and no user-controlled path;
- package list optional and bounded;
- create operation is cancellable before environment publication;
- environment becomes visible as `provisioning`, then `ready` or `error`;
- failed partial directories are retained briefly for diagnosis or removed safely after bounded logs are captured.

Provision steps:

```text
validate request
→ reserve metadata + per-env lock
→ uv venv <env>/pyvenv --python <request>
→ uv pip install --python <env-python> ipykernel [requested packages]
→ verify interpreter and import ipykernel
→ write private kernelspec
→ atomically mark ready
```

No shell. Command argv and cwd are explicit. Output is bounded/redacted and streamed as an operation event.

### Maintained

Request example:

```json
{
  "name": "research-py311",
  "displayName": "Research · Python 3.11",
  "python": "3.11",
  "packages": ["numpy", "pandas", "matplotlib", "torch"]
}
```

Rules:

- slug is normalized and collision checked;
- environment path is always derived by Pipyter;
- delete is explicit; no TTL;
- package intent and lock/sync status are recorded;
- creation is idempotent by request ID but not silently merged with an existing different definition;
- support several environments without setting a global default implicitly.

## Package/sync policies

Support two v0.2 creation sources:

### Explicit package list

Pipyter owns a minimal environment definition and installs the requested requirements through `uv pip`. This mode records the normalized requested package set and installed snapshot/revision but does not claim to produce `uv.lock`.

### Workspace project sync

```json
{
  "source": "workspace-project",
  "workspacePath": ".",
  "python": "3.12",
  "extras": ["dev"]
}
```

- validate the linked project is under the authorized workspace;
- recognize `pyproject.toml` and optional `uv.lock`;
- copy/reference only the dependency intent needed for the environment operation; when a real uv project is materialized/synced, retain its lock revision. Do not invent a `uv.lock` for the explicit-package-list mode;
- do not place maintained environment files inside the workspace;
- record source path and lock/content revision so the environment can be marked `stale` when the project changes;
- syncing is explicit or user-approved, never automatic during every Kernel start.

Do not support arbitrary install shell commands in environment metadata. Pigent Auto can still use `bash` with runtime-user authority, but the managed environment service remains structured and reproducible.

## Private kernelspec

Write:

```text
<environment>/kernelspec/kernel.json
```

Conceptual content:

```json
{
  "argv": [
    "<absolute-env-python>",
    "-m",
    "ipykernel_launcher",
    "-f",
    "{connection_file}"
  ],
  "display_name": "Research · Python 3.11",
  "language": "python",
  "metadata": {
    "pipyter": {
      "environment_id": "env_...",
      "kind": "maintained"
    }
  }
}
```

Resolution is unambiguous:

- `environment_id` means Pipyter loads exactly that environment's private kernelspec/absolute interpreter after ownership and readiness validation;
- legacy `kernel_name` means the existing system `KernelSpecManager` path only;
- requests cannot supply both, and a private environment slug never shadows a system kernelspec name.

Do not install private specs into `~/.local/share/jupyter/kernels` or a system directory. This prevents global pollution and makes deletion/backup deterministic.

## KernelSessionRegistry

Refactor the current runtime into one owner:

```text
KernelSessionRegistry
├── environment registry reference
├── sessions by kernel ID
├── notebook binding map
├── one async queue/lock per kernel
├── execute/interrupt/restart/shutdown
├── health/death monitoring
└── cleanup/reaper
```

### One execution authority

All of these call the same serialized execution method:

- `/api/v1/kernels/{id}/execute`;
- Workspace Run Cell/Run All;
- `NotebookService.run_cell`;
- `InspectionService` helper execution;
- Pigent `kernel.execute`;
- future Figure inspection.

The queue owns:

- queue depth;
- status transitions;
- parent message correlation;
- cancellation/interrupt;
- partial output collection;
- last activity;
- timeout policy.

Do not keep service-local lock maps.

### Notebook binding

- A notebook path can bind to one active kernel in a workspace session.
- A kernel may start unbound for scratch work, then bind explicitly.
- Binding validates workspace and environment ownership.
- Switching environment for a dirty notebook requires the browser dirty-state/save handshake already defined by Pigent v0.1.
- Shutdown clears binding; restart keeps binding and increments generation.

### Generation

Increment on restart/replacement. Attach generation to:

- variable/figure live references;
- Kernel-produced artifacts that depend on live objects;
- inspection cache entries.

Already-rendered immutable artifacts remain viewable, but UI marks their source Kernel generation as historical.

## Environment lifecycle actions

### `list_environments`

Read-like in Ask/Plan/Auto. Return bounded summaries and running Kernel references. This intentionally expands the v0.1 Kernel contract and requires a new `kernel.environment.read` capability plus synchronized Python/host/Web mode filters.

### `operation_status`

Read-like in Ask/Plan/Auto. Input is an authorized `operation_id`; return bounded state/progress/resource/receipt facts. This is the model's explicit way to inspect a previously accepted asynchronous create/sync/promote/delete operation.

### `create_temporary`

Execution/mutation; Auto only. Returns immediately with an accepted operation/environment reference. The original tool call does not wait for uv. Agent-initiated operation events retain `tool_call_id`; the model may continue other independent work or call `operation_status`/`list_environments` before using the environment. Default packages are empty except `ipykernel`.

### `create_maintained`

Execution/mutation; Auto only. Requires a stable name and explicit source/package intent and returns an accepted asynchronous operation reference.

### `sync_environment`

Execution/mutation; Auto only. Uses optimistic environment revision, returns an accepted asynchronous operation reference, and marks stale/ready based on definition and lock state.

### `start_environment`

Execution; Auto only. Starts a Kernel session from an explicitly authorized environment ID, optionally binding the active notebook. This is an intentional evolution from v0.1's “current bound Kernel only” rule: the host guidance must require same-workspace ownership and the existing dirty-document handshake, and must not accept arbitrary global Kernel IDs. The Web UI may invoke the same backend action directly as a normal user operation.

### `promote_environment`

Mutation; Auto only. Returns an accepted asynchronous operation reference. Conceptually:

```text
lock temporary env
→ validate ready/no conflicting operation
→ choose maintained slug
→ copy/rename within config filesystem when possible
→ rewrite metadata/kernelspec atomically
→ update registry
→ preserve or restart active Kernel sessions according to explicit policy
```

Recommended v0.2 policy: promotion requires no active Kernel session, or shuts it down only after explicit confirmation. Avoid moving an interpreter under a live process.

### `delete_environment`

Mutation; Auto only. Returns an accepted asynchronous operation reference after any required confirmation. Maintained delete requires explicit confirmation. If active Kernels exist, return conflict with IDs; UI offers shutdown-then-delete as a separate confirmed flow. Temporary GC may shut down only Kernels owned by an expired temporary environment and idle beyond policy.

## Cleanup

### Temporary reaper

Periodic bounded task:

- scans registry/metadata;
- skips environments with active/busy kernels or an active provisioning operation;
- evaluates expiry from `lastUsedAt` and TTL;
- shuts down idle owned Kernel sessions;
- deletes via rename-to-trash then recursive removal;
- records a compact cleanup event;
- retries failed deletion with backoff.

### Maintained

Never auto-delete. Mark:

- `missing` if files disappeared;
- `stale` if source/definition changed;
- `error` if interpreter/ipykernel validation fails.

The UI provides Repair/Sync/Delete; Pipyter does not touch uv's global cache.

### Orphan processes

- Kernel manager shutdown on normal Runtime exit;
- heartbeat/process checks mark dead sessions;
- persist enough non-secret ownership metadata to diagnose/reap orphans after abnormal Runtime exit;
- do not persist connection keys in the public registry;
- test process-tree cleanup on Linux.

## Concurrency and locking

```text
registry lock              serialize registry generation writes
environment lock           create/sync/promote/delete one environment
kernel queue lock          execute/inspect/notebook operations per kernel
notebook document lock     structured notebook mutation per path
```

Lock order when multiple resources are needed:

```text
registry → environment → notebook → kernel queue
```

Keep critical sections small; do not hold the registry lock through a long `uv` install. Reserve state atomically, release registry lock, run operation under environment lock, then commit a revision-checked result.

## Security and bounds

- environment path derived from IDs/slugs; no arbitrary path input;
- Python request and packages validated/bounded;
- no shell interpolation;
- operation logs redact URL userinfo, credentials, auth headers, and environment secrets;
- provider/bridge credentials are removed from `uv` and Kernel child environments unless explicitly required by normal user environment policy;
- public API returns logical paths and bounded error output;
- managed environment commands run as the Pipyter Runtime OS user, consistent with Auto authority;
- package installation requires network and executes package code; surface this consequence clearly in review/audit UI, but do not create a fake sandbox claim.

## Web UX

### Kernel chooser

Replace a flat kernelspec dialog with:

```text
Current / running
Maintained environments
Temporary environments
System kernelspecs (compatibility)
```

Each row shows Python version, readiness/stale/error, package/source summary, active count, last used, and actions.

### Environment manager

- Create temporary: Python + optional packages + TTL.
- Create maintained: name + Python + explicit packages or workspace project source.
- Progress surface with cancellable provisioning where safe.
- Start, Sync/Repair, Promote, Rename display name, Delete.
- Show effective interpreter and `sys.executable` verification.
- Do not expose provider settings here.

### Pigent card

When Pigent creates or starts an environment, render the same operation state and receipt in `KernelSurface`. Link to the environment manager rather than dumping uv output by default.

## Tests

### Unit

- path/slug validation;
- metadata and registry revision round trips;
- lock/state transitions;
- TTL calculation and reaper decisions;
- private kernelspec content;
- stale detection from project definition/lock revision;
- secret redaction in operation logs.

### Integration with real uv

Skip only when uv is unavailable:

1. create temporary env in a temp config home;
2. verify `ipykernel` import;
3. start and execute `sys.executable`;
4. verify interpreter is under the environment path;
5. promote to maintained;
6. restart Pipyter service and rediscover environment;
7. start second maintained environment with a different Python/package fact;
8. ensure sessions remain isolated;
9. sync/mark stale;
10. shutdown/delete and verify no global kernelspec was created.

Include workspace paths with spaces and Unicode.

### Kernel concurrency

- concurrent execute requests serialize and do not cross-consume output;
- Notebook run and Inspect call serialize on the same kernel;
- interrupt affects the active execution and returns whether work was interrupted;
- timeout captures partial output, interrupts, and leaves known state;
- kernel death marks dead promptly;
- restart increments generation and invalidates live references;
- shutdown clears notebook binding.

### Browser

- create temporary, see progress, start, run cell;
- promote and see it under maintained after refresh/restart;
- manage at least two maintained environments;
- active Kernel/environment facts appear in Workspace and Pigent;
- delete conflict with active Kernel is actionable and safe.

## Completion criteria

- Temporary and maintained environments both live under the Pipyter config root.
- The environment registry survives Runtime restarts and can reconstruct from metadata.
- No global kernelspec pollution occurs.
- All Kernel callers share one execution queue.
- At least two maintained uv environments can start independent Kernels.
- Temporary TTL cleanup never deletes an active/busy environment.
- Pigent uses environment actions through the existing `kernel` tool; the public tool catalog remains ten tools.
