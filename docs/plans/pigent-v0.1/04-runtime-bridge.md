# Python/Node runtime bridge and session lifecycle

## Goal

Embed the copied first-party TypeScript Agent runtime without allowing a second implementation of files, Notebook documents, Kernels, Shell sessions, public APIs, or control-plane state to emerge.

## Recommended process topology

```text
Pipyter server process (Python)
  ├── FastAPI public API
  ├── Workspace/Notebook/Kernel/Terminal services
  ├── PigentManager
  │    └── pigent-host Node child process
  ├── private tool bridge
  └── Pigent event/session broker
```

Start Pigent lazily on the first Agent session or explicit health request. Normal file/notebook Workspace use must continue when Node is missing or Pigent fails.

## Why a custom host instead of the copied standalone CLI

The copied BeauPi standalone entrypoints expose many tools and own their own config/resource conventions. Pigent needs:

- exactly ten product tools;
- Pipyter-owned file/Notebook/Kernel/Shell implementations;
- Ask/Plan/Auto tool projection;
- `.pipyter/pigent` state and `PIGENT_*` naming;
- no project extension auto-execution by default;
- Pipyter context, event, and interactive PTY handoff integration;
- a stable product protocol independent of internal runtime refactors.

Build `packages/pigent/host` with the copied SDK/RPC, `ToolDefinition`, AgentSession, Dynamic Tasks, and AgentPool primitives. The host reuses strict JSONL framing and event lifecycle while constructing a Pigent-specific session and ten custom ToolDefinitions.

## Pigent host startup

`packages/pigent/host/src/main.ts` should:

1. Read a versioned host configuration from a restricted inherited descriptor or startup file.
2. Validate workspace ID, root, session directory, bridge endpoint/credential descriptor, mode, and protocol versions.
3. Create an explicit ResourceLoader rather than default project discovery.
4. Create `ModelRuntime` with the exact Pipyter paths `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json` and `auth.json`, `modelsPath: null`, and an in-memory model store.
5. Register only the ten product ToolDefinitions.
6. Enable AgentPool and Dynamic Tasks with Pigent-branded profiles/statuses.
7. Create an AgentSessionRuntime and enter RPC mode.
8. Emit a `pigent.ready` event containing host/runtime/tool protocol versions and capabilities.

No npm package manager, self-update logic, TUI, install telemetry, project `.beaupi` resources, or first-time terminal setup should run in the embedded host.

## Host resource policy

Start conservatively:

- system prompt: Pigent-specific prompt supplied by Pipyter;
- context files: Pipyter-approved `AGENTS.md`/project documents only;
- skills: none by default, then add a Pipyter-owned allowlist later;
- extensions: only tracked Pigent host factories, no arbitrary project extension discovery;
- themes/TUI assets: not loaded;
- session storage: Pipyter-provided directory;
- model configuration: only Pipyter Pigent `settings.json` for provider/model choice and `auth.json` for provider API address/credentials, never notebook/project files, `models.json`, `models-store.json`, browser state, or standalone BeauPi paths.

This avoids importing standalone Agent behavior accidentally into the web product.

## Python process supervisor

Add `PigentManager` with responsibilities similar to, but separate from, `RuntimeManager`:

- locate and verify the bundled runtime manifest;
- locate compatible Node;
- spawn one host per workspace runtime, or a bounded host pool later;
- send JSONL commands and correlate responses by ID;
- parse JSONL strictly on LF boundaries;
- stream and retain bounded events;
- detect malformed output, process exit, stall, and protocol mismatch;
- support prompt, steer, follow-up, abort, mode change, session replacement, and shutdown;
- restart the host without rerunning accepted mutations;
- remove bridge credentials and provider secrets from child command environment;
- redirect stderr to `<workspace>/.pipyter/logs/pigent-host.log` with truncation/rotation.

Use `asyncio.create_subprocess_exec` in the server runtime so prompt/event handling does not block FastAPI workers.

## Runtime state

Extend persisted runtime state with non-secret Pigent facts:

```json
{
  "pigent_pid": 12345,
  "pigent_status": "running",
  "pigent_protocol_version": "0.1",
  "pigent_runtime_version": "...",
  "pigent_started_at": 0,
  "pigent_restart_count": 0
}
```

Do not store raw bridge tokens, provider keys, or full prompt/session content in `runtime.json`.

`pipyter up` may eagerly validate Pigent but should not need to start it. `pipyter down` terminates Pigent before the Runtime API. `status` reports health and active session count.

## Private tool bridge

### Transport

Use a local-only authenticated transport owned by the Python runtime:

- Unix: Unix domain socket preferred.
- Windows: loopback TCP with a random high-entropy credential in a restricted temporary file or inherited handle.
- Development fallback: loopback HTTP with the same credential rules.

The browser and public gateway must never receive this endpoint or credential.

### Credential delivery

Prefer an inherited file descriptor/handle:

```text
PIGENT_BRIDGE_TOKEN_FD=3
```

If platform support requires a file, create it mode `0600` under `.pipyter/runtime/`, pass only its path, and delete it on shutdown. Do not put the secret in argv, logs, normal session JSON, or child `bash` environments.

### Endpoint

One internal endpoint keeps the bridge small:

```text
POST /internal/v1/pigent/tools/{tool_name}
```

Body:

```json
{
  "context": {
    "protocol_version": "0.1",
    "tool_call_id": "call_...",
    "session_id": "pigent_...",
    "mode": "auto"
  },
  "arguments": {}
}
```

Python resolves trusted session/workspace/mode facts from the authenticated connection and treats body context as correlation data, not authorization proof.

For streaming `bash`/kernel output, either:

- return an operation ID and stream updates over the bridge event channel; or
- keep the internal request open with newline-delimited update/final records.

Use one documented method consistently and propagate cancellation.

## ToolDefinition adapters

`packages/pigent/host/src/tools.ts` should keep definitions thin:

```text
schema validation
  → host mode/action preflight
  → bridge request
  → convert bridge result to AgentToolResult
```

Do not duplicate path resolution, notebook parsing, shell classification, or kernel inspection in TypeScript.

Orchestration exceptions:

- `tasks` adapts the in-process Dynamic Task runtime and emits snapshots to Python/UI.
- `delegate` adapts AgentPool, but child workspace tools still call the Python bridge.

All ten tools use shared result-envelope parsing and convert Python artifacts to `TextContent`/`ImageContent` safely.

## Public Pigent API

Keep public API separate from the internal tool bridge.

Suggested REST endpoints:

```text
POST   /api/v1/pigent/sessions
GET    /api/v1/pigent/sessions/{session_id}
DELETE /api/v1/pigent/sessions/{session_id}
POST   /api/v1/pigent/sessions/{session_id}/messages
POST   /api/v1/pigent/sessions/{session_id}/abort
PUT    /api/v1/pigent/sessions/{session_id}/mode
GET    /api/v1/pigent/sessions/{session_id}/tasks
POST   /api/v1/pigent/interactions/{interaction_id}
GET    /api/v1/pigent/capabilities
```

Streaming endpoint:

```text
WS /api/v1/pigent/sessions/{session_id}/stream
```

The WebSocket carries versioned events for:

- assistant text/thinking deltas;
- tool start/update/end;
- Tasks snapshot changes;
- delegate lifecycle/progress;
- Ask/Plan/Auto mode, approval preference, and execution-identity changes;
- interactive PTY/browser handoff, optional review, and clarification requests;
- kernel/notebook/artifact updates relevant to the Agent panel;
- errors, aborts, settled state, and reconnect cursor.

A first implementation may use SSE for one-way events plus REST interaction responses, but WebSocket is the better long-term fit for PTY/browser handoff, optional review, steering, cancellation, and reconnect.

## Public event envelope

```json
{
  "version": 1,
  "event_id": 42,
  "session_id": "pigent_...",
  "type": "tool.end",
  "timestamp": "...",
  "payload": {}
}
```

Requirements:

- monotonically increasing `event_id` per session;
- reconnect with `after_event_id`;
- bounded in-memory/disk retention;
- tool correlation by `tool_call_id`;
- no raw provider headers or credentials;
- internal copied-runtime events translated to product-stable Pigent events.

Do not expose internal RPC events as the public browser contract without translation; that would couple Pipyter UI to implementation refactors.

## Session records and storage

### Control metadata

Keep public/registry records behind `pipyter.control`:

```text
PigentSessionRecord
  id
  account_id
  project_id
  workspace_id
  node_id
  mode
  approval_preference
  execution_identity
  status
  created_at
  last_activity_at
```

This follows the existing account/project/node/workspace registry boundary.

### Runtime-local content

Store compute-sensitive content under:

```text
<workspace>/.pipyter/pigent/
├── sessions/
├── artifacts/
├── tasks/
└── events/
```

Provider/model configuration remains outside the workspace:

```text
${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/
├── settings.json   # provider/model selection and non-secret protocol/model definitions
└── auth.json       # provider API base URL, API-key/OAuth credentials, secret headers
```

These are the only persistent Pigent model-config files. Use directory mode `0700`, file mode `0600`, locking, and atomic replacement. Do not create/read `models.json`, `models-store.json`, project-local model settings, or `.beaupi`/`.pi` state. A remote catalog refresh, if enabled, is process-local and cannot change the selected default pair. See [User installation and Pigent model configuration](09-user-install-model-config.md).

Never place provider keys in `.ipynb`, project TOML, browser local storage, URLs, normal logs, or session records. Pipyter account/node authentication remains a separate control-plane credential domain and must not reuse `pigent/auth.json`.

### Authority

- Pigent session JSONL is authoritative for Agent conversation branch and Dynamic Task facts.
- Pipyter may maintain indexed snapshots for UI/query performance but must be able to rebuild them.
- Notebook files and kernels remain authoritative in their Python/Jupyter services.
- `pipyter.control` stores routing/identity metadata, not full notebook or model context.

## Active workspace context

The browser/runtime sends context updates independently of prompts:

```json
{
  "type": "workspace.context",
  "active_document": "analysis.ipynb",
  "document_revision": "sha256:...",
  "active_cell_id": "cell-a1",
  "selection": null,
  "active_kernel_id": "kernel-...",
  "selected_figure_id": null
}
```

Pipyter validates it, stores a session snapshot, and injects a compact context message before the next turn. Do not send whole notebooks, variable values, or terminal history automatically. Pigent should call `read`, `notebook`, `inspect`, or `view` as needed.

Context updates during an Agent run become steering/context facts according to a defined policy; they must not silently change the target of an already-authorized mutation.

## Lifecycle flows

### Create session

1. Authenticate browser/account and resolve workspace access.
2. Ensure Pigent host health, starting lazily if needed.
3. Create/control registry record.
4. Resolve the configured model strictly from Pigent `settings.json` plus `auth.json`; if the explicit default pair is missing/invalid, return `model_configuration_required` without guessing.
5. Create a Pigent session with identity, selected Ask/Plan/Auto mode, resolved model snapshot, tool catalog, execution identity, and workspace context.
6. Return session summary and stream URL.

### Prompt

1. Validate session/workspace/account.
2. Refresh active context, selected mode, and runtime execution identity.
3. Send `prompt` RPC command with correlation ID.
4. Translate internal runtime events to Pigent events.
5. Route tool calls through bridge.
6. Persist event cursor and settled state.

### Interactive handoff or optional review

1. An Auto command that requires a TTY/browser/user secret returns `interaction_required` with the owned process/Shell session reference; optional review preferences may emit the same interaction shape before execution.
2. The host emits a product interaction event and pauses the affected tool call when direct user input is required.
3. The browser opens/focuses the referenced Shell or browser verification flow.
4. Authentication/input bytes travel directly to that process/flow and never through Agent events or model context.
5. The tool resumes, completes, fails according to the OS/program, or is cancelled by the user.

### Reconnect

1. Client supplies last event ID.
2. Pipyter returns session/mode/tasks/tool state snapshot.
3. Replay retained events after the cursor.
4. Continue live stream without restarting the kernel or Agent session.

### Shutdown/restart

- Graceful Pipyter shutdown asks Pigent host to settle/flush, then terminates it.
- Unexpected host exit marks sessions interrupted, retains event/session files, and may restart the host.
- Accepted tool results use idempotency records so reconnect/restart does not duplicate mutations.
- Model generation may be retried only when safe; do not replay an unknown in-flight mutating tool call automatically.

## Copied first-party runtime reuse

Retain these copied capabilities in tracked `packages/pigent/` source:

- `ToolDefinition` and custom tool registration;
- SDK `createAgentSession`/AgentSessionRuntime;
- strict JSONL RPC/event stream;
- Dynamic Tasks compare-and-swap runtime;
- AgentPool structured sub-agent results and parallel execution;
- session branching/compaction;
- model/provider runtime;
- tool lifecycle events and cancellation.

Do not initially expose:

- stock built-in file/bash tools;
- project extension/package auto-discovery;
- remote/terminal/privilege/web/background/workflow tools;
- TUI-specific UI;
- standalone update/install behavior;
- `.beaupi` config or session paths;
- file-backed `models.json` or `models-store.json` selection/cache paths.

## Web Workspace boundary

The latest designs replace the old static panel and terminal surface. Follow [Pigent and Shell UI migration](07-pigent-shell-ui-migration.md):

- canonical `/pigent` dedicated page;
- shared live session between dedicated page and Workspace panel;
- 360 px light Pigent right panel with Ask/Plan/Auto;
- no legacy collapsed vertical rail;
- persistent 220 px multi-session Shell panel;
- UI consumes translated product events only.

## Verification

1. host starts from the bundled payload and emits matching protocol versions;
2. malformed/non-LF JSONL does not desynchronize the client;
3. bridge rejects unauthenticated and cross-workspace requests;
4. browser cannot reach the private bridge;
5. all Python-backed tools recheck trusted Ask/Plan/Auto mode and structured revisions while Auto uses normal runtime-user OS permissions;
6. active context cannot retarget an already accepted tool call;
7. events replay exactly once by cursor;
8. host crash/restart does not duplicate a successful mutation;
9. missing Node disables Pigent with a clear health error but leaves Workspace APIs working;
10. session/control records remain in registry interfaces while sensitive content stays runtime-local;
11. provider/bridge credentials are absent from argv, status output, logs, browser payloads, and shell child environments;
12. model selection comes only from `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json`, while provider endpoint/auth availability comes from `auth.json`; CLI/env/browser/session/project values cannot override either source;
13. startup and runtime never read/write `models.json`, `models-store.json`, or standalone BeauPi/Pi user config;
14. dedicated and embedded Pigent views share one session/event cursor, and persistent Shell sessions survive browser reconnect.
