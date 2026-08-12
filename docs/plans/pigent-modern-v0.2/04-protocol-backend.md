# Protocol, backend ownership and persistence

## Goal

Define the cross-layer changes needed for modern frontend actions, local configuration migration, and uv Kernel environments without duplicating owners or breaking the Pigent v0.1 contract.

## Ownership matrix

| Concern | Authoritative owner | Browser/Node responsibility |
| --- | --- | --- |
| Pigent conversation branch/model loop | bundled Node Pigent host/session runtime | Browser projects events; Python supervises/translates |
| Public Pigent sessions/events/interactions | Python session broker/API | Browser consumes versioned product events |
| Provider/model files and migration | Python `PigentConfigStore` + migration service | Browser sees only sanitized facts; Node receives exact paths |
| Workspace files and Notebook documents | Python workspace/notebook services | Node tool adapters forward structured requests |
| Kernel environment definitions | Python `KernelEnvironmentRegistry` | Browser/Pigent invoke structured actions |
| Running Kernel sessions/queues | Python `KernelSessionRegistry` | Browser/Pigent share summaries and actions |
| Tasks/delegate orchestration | Node copied first-party runtime | Python/browser receive stable snapshots/results |
| Shell processes | Python `TerminalSessionManager` | Browser streams PTY; Pigent receives references only |
| Artifacts | Python ArtifactRegistry | Browser renders authorized endpoints |

No TypeScript host implementation may invoke uv or create kernelspecs directly.

## Protocol evolution

Keep protocol versioning explicit. Adding Kernel environment actions, operation events, capabilities, and error/status literals is a protocol revision rather than a silent additive frontend feature. Bump the tool/event protocol and update Python models, TypeScript protocol/schema files, host `ACTION_FILTERS`, mode matrices, manifest metadata, and golden tests together.

Capability authority is negotiated:

```text
verified payload manifest + host ready handshake action/capability set
∩ Python-supported catalog/mode ceiling
= public /capabilities response
```

If the host is absent, stale, or on the old protocol, Python must not advertise new Kernel actions. The frontend hides unsupported UI and displays the exact payload/protocol finding.

### Tool catalog

The ten names remain:

```text
read · view · write · update · bash
notebook · kernel · inspect
tasks · delegate
```

Only `kernel` action schema expands. Ask/Plan receive `list_environments`, `operation_status`, and read-only environment/status facts; create/sync/start/promote/delete remain Auto-only. Add explicit `kernel.environment.read` and `kernel.environment.manage` capability facts and update both Python and TypeScript mode matrices.

### Common operation envelope

Long-running environment/config operations need a stable public projection:

```json
{
  "operation_id": "op_...",
  "kind": "kernel_environment.provision",
  "state": "queued",
  "progress": {
    "phase": "create_venv",
    "completed": 0,
    "total": null,
    "message": "Creating Python environment"
  },
  "resource": {
    "type": "kernel_environment",
    "id": "env_..."
  },
  "created_at": "...",
  "updated_at": "..."
}
```

States:

```text
queued · running · waiting_for_user · succeeded · failed · cancelled
```

Do not expose raw uv stdout as progress. Preserve full bounded diagnostic logs in runtime-local files; product events carry phase, safe summary, and optional tail.

### Asynchronous Pigent tool semantics

Environment create/sync/promote/delete never hold the Node→Python bridge open for minutes:

1. the `kernel` tool action reserves the resource/operation and returns a successful accepted result containing `operation_id`, `environment_id`, and current state;
2. the host emits normal `tool.end` for that accepted result, so the Agent loop is not suspended on package installation;
3. the operation manager emits `operation.started/updated/ended`; Agent-initiated payloads include `session_id` and `tool_call_id`, while browser-initiated operations omit tool correlation;
4. `operation.ended` carries the final receipt/resource revision;
5. `kernel.operation_status` is a read-like action available in all modes so the model can inspect completion before `start_environment` or further work.

This same operation service backs browser REST and Pigent actions; only the acceptance transport differs.

### Receipt

Use a common data-only receipt for UI projection:

```json
{
  "outcome": "success",
  "summary": "Created maintained environment Research · Python 3.11",
  "identifiers": {
    "environment_id": "env_..."
  },
  "at": "..."
}
```

Outcomes:

```text
success · partial · failed · cancelled · superseded
```

The frontend may format wording by tool/action, but the backend provides authoritative outcome and identifiers.

`queued` ToolSurface state is derived only for an accepted, correlated operation/tool intent before its start event; ordinary model tool calls first become visible at `tool.start`. Do not invent a generic `tool.queued` state unless the protocol later adds that event explicitly.

## User message identity

Add `client_message_id` to message submission and public accepted/settled projection.

```json
POST /sessions/{id}/messages
{
  "client_message_id": "msg_client_...",
  "content": "...",
  "behavior": "prompt"
}
```

Rules:

- unique per session;
- repeated same ID + identical payload is idempotent;
- repeated same ID + different payload is conflict;
- preserve existing `content` and `behavior: prompt|follow_up` fields for compatibility;
- server returns accepted `run_id` and `turn_id` in addition to `accepted`;
- event stream includes enough correlation for optimistic UI reconciliation;
- prompts remain runtime-local and are not browser-local persisted.

## Abort contract

Existing abort API becomes explicit about run identity and idempotency:

```json
POST /sessions/{id}/abort
{
  "run_id": "run_...",
  "reason": "user_stop"
}
```

Response:

```json
{
  "accepted": true,
  "already_settled": false
}
```

The authoritative `aborted`/`settled` event concludes UI state. Cancellation propagates to Node generation, active bridge tool operation, uv operation, Kernel queue, or Shell handoff as appropriate. Unknown completion state of an already accepted mutation must not be auto-replayed.

## Interaction resolution

Add the missing public endpoint:

```text
POST /api/v1/pigent/interactions/{interaction_id}
```

Request:

```json
{
  "revision": 3,
  "decision_id": "decision_...",
  "action_id": "allow_once",
  "payload": {}
}
```

Rules:

- interaction is scoped to authenticated session/workspace;
- revision or signature prevents resolving a superseded request;
- decision is idempotent by `decision_id`;
- only advertised action IDs are accepted;
- receipt event follows resolution;
- authentication/terminal input bytes never enter this endpoint.

## Session management API

Complete:

```text
POST   /api/v1/pigent/sessions
GET    /api/v1/pigent/sessions?workspace_id=&query=&before=&limit=
PATCH  /api/v1/pigent/sessions/{id}       # title
DELETE /api/v1/pigent/sessions/{id}
GET    /api/v1/pigent/sessions/{id}/events?before_event_id=&limit=
```

- DELETE of running/pending-interaction session returns conflict unless abort/resolve policy is satisfied.
- List is always workspace-authorized and filtered server-side.
- History paging uses event IDs/cursors, not array offsets.

## Kernel environment protocol

### Environment summary

Define matching Python/TypeScript schemas, including:

```text
id, kind, name/slug, display_name
status, python_request, python_version
source summary, package summary, revision
created/updated/last_used/expires
active_kernel_ids, last_error
```

Unknown additive fields are tolerated within the same protocol version where policy allows; unknown status/kind/action is rejected.

### Operation resources and events

Expose authorized operation reads/cancellation for browser management:

```text
GET  /api/v1/operations/{operation_id}
POST /api/v1/operations/{operation_id}/cancel
```

Cancellation returns `operation_not_cancellable` after the operation crosses a non-reversible phase; it never pretends a package install/process stopped before confirmation.

Add stable product events, preferably generic with typed payloads:

```text
operation.started
operation.updated
operation.ended
kernel.environment.updated
kernel.updated
```

These event names and their payload schemas are part of the v0.2 protocol bump. Do not overload `tool.update` for browser-initiated management operations without a tool call. Operation events use their own operation sequence/state; reconnect cursor snapshots do not consume business `event_id` values.

### Binding and session summaries

Extend Kernel create/start request:

```json
{
  "environment_id": "env_...",
  "notebook_path": "analysis.ipynb"
}
```

Keep `kernel_name` compatibility for system kernelspecs. Exactly one of `environment_id` and `kernel_name` is selected. `environment_id` resolves only through the private Pipyter environment registry; `kernel_name` resolves only through the legacy system kernelspec manager.

## Configuration migration service

Suggested Python modules:

```text
src/pipyter/pigent/migration.py
src/pipyter/pigent/config.py           # existing store remains owner
src/pipyter/cli/pigent_config.py       # or existing CLI placement
```

### Remote helper envelope

The local v0.2 `pigent` package supplies a small versioned read-only helper script and runs it remotely as `ssh <alias> python3 -`, streaming the script on stdin. This keeps migration compatible with AutoDL Pipyter 0.1.4, which has no helper command, and does not persist code remotely. The helper imports no remote Pipyter internals: it resolves/reads the two explicitly permitted config files, enforces provider filtering/file checks, and emits a versioned JSON envelope. Sensitive provider records are included only in apply mode and travel over SSH stdout; diagnostics never echo them.

The local process:

- does not save the transfer to `/tmp`;
- parses from a pipe;
- keeps secret-bearing structures out of exception repr/logging;
- locks and writes through the existing config store;
- records only redacted manifest facts.

### Pair atomicity

`settings.json` and `auth.json` are two files but one migration transaction. Since POSIX cannot atomically replace both as a pair, use a transaction journal:

```text
write/validate both staged files
→ write private transaction manifest state=prepared
→ replace auth then settings (or documented order)
→ validate pair
→ mark committed
```

On startup or next config access, recover an incomplete transaction by restoring backups or completing only when both staged hashes and expected revisions still match. Tests must cover interruption after each step.

## Persistence layout

### User config

```text
<pipyter-config>/
├── pigent/settings.json
├── pigent/auth.json
├── kernels/...
└── backups/pigent/...
```

### Workspace runtime state

```text
<workspace>/.pipyter/
├── pigent/
│   ├── public-sessions/        # public/session projection JSON
│   ├── sessions/               # host conversation JSONL
│   ├── events|tasks|artifacts/
├── logs/
└── runtime/...
```

Kernel environment definitions do not go into workspace runtime state. Workspace state may store a non-secret preferred environment ID or notebook binding snapshot, validated at load.

### Browser persistence

Allowed:

```text
layout/density
active session ID
last event cursor
panel open/height state
selected node/workspace IDs
```

Forbidden:

```text
provider secrets
full prompts/events
Kernel connection data
SSH target details beyond deployment-owned public metadata
migration transfer/backup data
```

## Kernel backend modules

Suggested focused ownership:

```text
src/pipyter/kernel/manager.py              # session registry/process lifecycle
src/pipyter/kernel/environments.py         # environment registry and metadata
src/pipyter/kernel/operations.py           # uv operation lifecycle
src/pipyter/kernel/kernelspec.py            # private kernelspec materialization
src/pipyter/kernel/cleanup.py               # temporary/session reapers
```

Refactor incrementally; do not create empty layers first.

### Async boundary

Current Kernel/Jupyter clients are synchronous. Options:

1. retain sync clients behind one bounded worker/executor per Kernel queue;
2. migrate to async clients carefully.

For the shortest reliable path, keep the proven synchronous Jupyter client but centralize it behind the async registry/queue and a bounded executor. Do not call arbitrary `asyncio.to_thread` from multiple services because that bypasses queue/worker ownership.

### Resource lifecycle

FastAPI lifespan owns:

- Kernel registry startup/cleanup;
- environment registry recovery;
- operation manager;
- temporary reaper;
- orphan/dead session reconciliation.

Normal server shutdown cancels pending provision operations safely, shuts Kernel sessions, flushes metadata, and leaves maintained environments intact.

## Bridge and Node host changes

- Update the `kernel` ToolDefinition schema/action projection, guidance, capabilities, and mode filters. Starting an environment is allowed only by authorized `environment_id` and optional active-notebook binding; arbitrary global Kernel selection remains forbidden.
- Keep adapter thin: validate → bridge → convert result/operation reference.
- Translate operation/progress/receipt facts into stable Pigent events.
- Do not expose local config paths by default to the model; environment IDs/display names/interpreter facts are sufficient.
- Ensure provider/bridge secrets do not enter Kernel/uv child environments.
- A host missing the new protocol must fail version negotiation rather than advertise actions it cannot correlate.

## Error taxonomy

Add stable codes:

```text
payload_missing
payload_stale
uv_missing
uv_incompatible
config_migration_conflict
config_migration_invalid_source
kernel_environment_not_found
kernel_environment_conflict
kernel_environment_busy
kernel_environment_stale
kernel_environment_provision_failed
kernel_environment_sync_failed
kernel_dead
kernel_queue_cancelled
operation_not_cancellable
interaction_superseded
```

Errors include safe details, retryability, and resource IDs, never raw command environments or credential-bearing URLs.

## Observability

Expose sanitized diagnostics:

- host payload version/path kind/hash status and negotiated action/capability set;
- uv detected/required version and environment-management availability;
- selected provider/model and configured boolean;
- Kernel environment counts by status/kind;
- active Kernel sessions and queue depths;
- operation state/duration/failure code;
- temporary cleanup counts;
- migration ID/source alias/provider IDs, never credentials.

Logs:

```text
<workspace>/.pipyter/logs/pigent-host.log
<pipyter-config>/logs/kernel-environments.log (or central Pipyter log policy)
```

Use bounded rotation. Do not log full request/response bodies for config, prompts, or tool results.

## Compatibility

- Existing `POST /api/v1/kernels {kernel_name}` remains supported.
- Existing five Kernel actions remain unchanged, including making the currently ignored `store_history` behavior match the documented contract.
- New frontend tolerates older Runtime capabilities by hiding unsupported environment UI and showing an upgrade explanation.
- New Runtime keeps old frontend fields and event forms through the intended compatibility window, but it never reports v0.2 action capability unless the verified host handshake advertises the matching protocol.
- Existing remote AutoDL/Pi5 routing forwards new REST/WebSocket paths without embedding secrets.

## Verification

### Cross-language fixtures

- user message correlation;
- interaction decision/receipt;
- environment summary;
- operation lifecycle;
- extended Kernel summary/actions;
- error codes and redaction.

### Recovery

- host crash during model stream;
- old/missing host payload against a v0.2 Python Runtime;
- Runtime crash during environment provision;
- migration interruption between file replacements;
- reconnect during operation updates;
- stale interaction decision;
- restart with dead Kernel process and maintained environments intact.

### Security

- browser cannot reach private bridge;
- migration preview/read APIs do not return secrets;
- uv/Kernel child environments omit provider/bridge/runtime proxy credentials;
- session/event/config logs redact secret fields;
- environment paths cannot escape config root;
- cross-workspace Kernel/environment references are rejected.

## Completion criteria

- One owner exists for every behavior in the matrix.
- Python and TypeScript fixtures agree.
- New frontend actions have stable API/idempotency/receipt semantics.
- Kernel environment operations work from both browser APIs and Pigent `kernel` actions through the same service.
- Existing v0.1 sessions, ten tools, files, Notebook, Shell, and remote routing remain compatible.
