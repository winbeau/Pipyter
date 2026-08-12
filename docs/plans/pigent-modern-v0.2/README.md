# Pigent modern Web Agent v0.2 — implementation plan

## Goal

Turn the existing Pigent page into a modern, trustworthy, locally developable Web Agent surface while preserving the working Pipyter runtime and ten-tool contract.

The release must deliver one coherent end-to-end path:

```text
local browser
  → local `pipyter lab`
  → local Pigent host and public event stream
  → migrated DeepSeek provider configuration
  → local files / Notebook / Kernel / Shell tools
  → temporary or maintained uv Kernel environment
```

This is an implementation plan, not a replacement product sketch. Pipyter v0.1.4 already contains the Pigent host, ten public tools, Ask/Plan/Auto, persistent Shell sessions, dedicated and embedded Pigent views, and the two-file provider configuration. v0.2 should improve the owning layers instead of rebuilding them.

## Audit baseline

### Verified local state

- The repository and source runtime are Pipyter `0.1.4`; the globally installed `pipyter` command is older (`0.1.1`). Development must therefore use the repository environment or a freshly built wheel, not the stale global executable.
- `uv`, Node 24 and pnpm are available locally.
- A local `pipyter lab --no-browser --port 8895 <workspace>` serves `#/pigent` successfully.
- The local source checkout does not currently contain `src/pipyter/_vendor/pigent`, so the Pigent host reports `payload_ok: false`. A local Agent turn cannot work until the deterministic Node payload is built or a wheel containing it is installed.
- Local `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json` contains only `{ "version": 1 }`; local `auth.json` contains placeholder provider data.
- Baseline screenshot: `.beaupi/pigent-local-baseline.png`.

### Verified AutoDL state

- AutoDL runs Pipyter `0.1.4` with Node `24.19.0` and uv `0.12.3`.
- The live workspace is `/root/pipyter-workspaces/research`; one active Runtime listens on `0.0.0.0:6006` behind the LAN gateway.
- Pigent uses exactly:
  - `/root/.config/pipyter/pigent/settings.json`
  - `/root/.config/pipyter/pigent/auth.json`
- Default selection is `deepseek/deepseek-v4-flash`.
- `auth.json` has configured `deepseek` and `openai` providers. Credentials are literal secrets and must be copied only through a private, atomic, permission-preserving migration path; they must never enter Git, plan text, command output, browser state, or logs.
- Several stale Pipyter processes were present, while only the newest process owned port 6006. Process cleanup is an AutoDL operational follow-up, not a prerequisite for the local frontend plan.

### Verified frontend gap

The current frontend has the correct high-level layout and live event/store foundations, but it still behaves like a design prototype in important places:

- tool Apply/Revert/Undo controls and interaction decisions are visible without complete handlers;
- no real Stop/Abort control is exposed;
- sent user messages do not immediately appear with pending/failed/retry state;
- assistant output is plain text rather than readable Markdown/code;
- artifact events do not become useful image/table previews;
- session creation, rename, delete, search, and workspace filtering are incomplete;
- model choices are partly hard-coded despite capabilities/config APIs;
- long feeds are truncated rather than paged/windowed;
- web unit and browser tests are absent.

### `/tmp/tool-ui` decision

`/tmp/tool-ui` is MIT licensed. Reuse its interaction principles and selected compact components, not its Next.js/assistant-ui framework wholesale.

Adopt:

- schema-first, stream-safe parsing;
- stable addressable card IDs;
- data-derived `interactive → executing → receipt` state;
- separate local actions from decision actions;
- one primary action per card, execution locks, destructive confirmation, Escape cancel;
- terminal/code/diff folding, copy actions, truncation facts, progress and receipt semantics;
- container-query responsiveness, visible focus, reduced motion, `aria-live`, 44 px touch targets.

Do not adopt in v0.2:

- assistant-ui transport/toolkit coupling;
- the tool-ui Next.js/Tailwind stack;
- heavyweight weather/map/chart components;
- `@pierre/diffs` until its license and bundle trade-offs are explicitly accepted.

If source is copied, retain the MIT notice in `THIRD_PARTY_LICENSES/TOOL-UI-MIT.txt` and record copied files/commit in `UPSTREAM.md`. Prefer adapting the small state/action primitives to Pipyter's existing CSS and protocol.

## Product decisions

1. **Keep the existing architecture.** React consumes stable Pipyter Pigent events; Python owns files, Notebook, Kernel, Shell, configuration, and OS side effects; the bundled Node host owns Agent/model/orchestration behavior.
2. **Local development is first-class.** `uv run pipyter lab <workspace>` is the normal source path. It must diagnose or build the local Pigent payload predictably rather than silently showing a nonfunctional model selector.
3. **Configuration migration is explicit and scoped.** Copy only provider/model configuration into the local two-file directory. Do not copy AutoDL sessions, Tasks, artifacts, runtime tokens, bridge tokens, project metadata, or Shell/Kernel state.
4. **The current ten public tools remain stable.** Kernel environment management is added as actions under `kernel`; do not add a separate public `venv`, `uv`, or `package` tool in this release. Expanding the frozen Kernel action set is an intentional tool-protocol revision: Python, the bundled host, protocol fixtures, mode filters, and Web capabilities must upgrade together.
5. **Capabilities come from the verified host handshake.** Python's static catalog is a validation/fallback ceiling, not authority to advertise actions an absent or older payload cannot execute. The public capability response exposes only the negotiated intersection and the exact protocol/payload health.
6. **Long environment work is asynchronous but tool-correlated.** Create/sync/promote/delete return an operation reference immediately; operation events carry `tool_call_id` when Agent-initiated, and a read-only `operation_status` Kernel action lets the model inspect completion. The original tool call settles with an “operation accepted” receipt rather than blocking for package installation.
7. **An environment definition persists; a kernel process does not.** Maintained uv environments survive restart. Running Kernel processes remain runtime-owned and restartable.
8. **Temporary environments are disposable but inspectable.** They live under the user Pipyter config root, have TTL/reference metadata, and can be promoted atomically to a maintained environment.
9. **Maintained environments are user-level resources.** Store them under `${XDG_CONFIG_HOME:-~/.config}/pipyter/kernels/`, not inside a Git workspace. A workspace may reference an environment ID but does not own the environment files.
10. **Use a Python-managed uv workflow.** Pipyter invokes `uv` with argv lists, never shell strings; creates environments, installs `ipykernel`, writes private kernelspec metadata, and launches them without modifying global Jupyter kernelspec directories. uv gets a tested minimum version and a Node-like doctor/degradation contract; missing uv disables only environment management.
11. **Fix trust before visual ornament.** Working stop, decision, retry, receipt, error, and reconnect behavior precede dark mode, command palettes, rich animation, or broad design-system migration.
12. **Do not expose an unsafe frontend action.** A button without a real state transition/API call is hidden or disabled with a clear reason.

## Target architecture

```text
Web
├── Pigent feature store
│   ├── session projection
│   ├── optimistic user turns
│   ├── event reducer + replay cursor
│   ├── tool surface registry
│   └── interaction/receipt state
├── shared ToolSurface components
│   ├── AssistantMessage / UserMessage
│   ├── PlanSurface / DelegateSurface
│   ├── FileSurface / DiffSurface
│   ├── CommandSurface / KernelSurface
│   ├── ArtifactSurface
│   ├── ApprovalSurface
│   └── FallbackSurface
└── Kernel environment manager UI
    ├── Current Kernel
    ├── Temporary Environments
    └── Maintained Environments

Pipyter Python Runtime
├── public Pigent sessions/events/interactions API
├── ModelConfig migration service
├── KernelEnvironmentRegistry
│   ├── config metadata
│   ├── uv provision/sync/delete/promote
│   ├── private kernelspec materialization
│   └── per-environment operation locks
├── KernelSessionRegistry
│   ├── notebook binding
│   ├── per-kernel execution queue
│   ├── status/generation/health
│   └── idle/dead cleanup
└── existing Pigent bridge / Notebook / Shell / artifact owners

Bundled Node Pigent Host
└── existing ten tools and translated lifecycle events
```

## Configuration layout

```text
${XDG_CONFIG_HOME:-~/.config}/pipyter/
├── pigent/
│   ├── settings.json                 # existing model selection
│   └── auth.json                     # existing provider endpoint/credential
└── kernels/
    ├── registry.json                 # non-secret environment index, 0600
    ├── temporary/
    │   └── <env-id>/
    │       ├── pyvenv/               # uv-created environment
    │       ├── environment.json      # owner, TTL, requested Python/packages
    │       └── kernelspec/kernel.json
    └── maintained/
        └── <slug>/
            ├── pyvenv/
            ├── environment.json      # display name, Python, package intent, revision
            ├── uv.lock               # generated/managed reproducibility lock when used
            └── kernelspec/kernel.json
```

Directory/file permissions are `0700/0600` where POSIX supports them. Provider secrets remain only in `pigent/auth.json`; Kernel metadata must never contain provider credentials.

## Public contract changes

Extend `kernel` actions while keeping the public tool count at ten:

```text
Existing session actions
  status · execute · interrupt · restart · shutdown

New environment actions
  list_environments
  operation_status
  create_temporary
  create_maintained
  sync_environment
  start_environment
  promote_environment
  delete_environment
```

The browser may use dedicated REST resources for management, while Pigent calls the same Python service through the `kernel` ToolDefinition.

Suggested REST resources:

```text
GET    /api/v1/kernel-environments
POST   /api/v1/kernel-environments/temporary
POST   /api/v1/kernel-environments/maintained
GET    /api/v1/kernel-environments/{environment_id}
POST   /api/v1/kernel-environments/{environment_id}/sync
POST   /api/v1/kernel-environments/{environment_id}/promote
POST   /api/v1/kernel-environments/{environment_id}/start
DELETE /api/v1/kernel-environments/{environment_id}
GET    /api/v1/operations/{operation_id}
POST   /api/v1/operations/{operation_id}/cancel
```

Create/sync/promote/delete are operations rather than long-held request bodies when package work is slow:

```text
Browser: POST → 202 { operation_id, environment_id }
Pigent: kernel action → successful “accepted” result with operation_id/environment_id
Progress: operation events; Agent-initiated events also carry tool_call_id
Inspection: GET operation or kernel.operation_status
Terminal state: operation.ended + final receipt/resource revision
```

Required environment summary:

```text
id · kind temporary|maintained · name · display_name
status provisioning|ready|stale|syncing|error|deleting
python_request · python_version · interpreter
packages/lock revision · created_at · last_used_at · expires_at
active_kernel_ids · last_error (bounded/redacted)
```

Required Kernel session additions:

```text
environment_id · notebook_path · language · status
generation · queue_depth · started_at · last_activity_at
```

## Detailed module plans

- [Modern frontend and tool surfaces](01-modern-frontend.md)
- [Local runtime and AutoDL DeepSeek migration](02-local-runtime-ds-migration.md)
- [uv Kernel environment lifecycle](03-uv-kernel-environments.md)
- [Protocol, backend ownership and persistence](04-protocol-backend.md)
- [Implementation sequence and acceptance gates](05-implementation-sequence.md)
- [Risk register, security and rollback](06-risk-security-rollback.md)

## Delivery milestones

### M0 — Reproducible local Pigent

- Build or install a verified Pigent runtime payload from the repository and negotiate capabilities from its handshake.
- Migrate AutoDL provider configuration through an explicit, backed-up, permission-preserving path.
- Start a local `pipyter lab` using the repository version and confirm a real DeepSeek turn.
- Confirm missing/incompatible uv reports one exact environment-management finding while ordinary Workspace/Pigent use remains available.

Exit: the local page is not demo-only, capabilities show the configured default, and a real Ask response streams without reading AutoDL at request time.

### M1 — Trustworthy conversation loop

- Add optimistic user messages, retry state, real Stop/Abort, authoritative run status, interaction resolution, and receipt transitions.
- Remove/hide dead Apply/Revert/Undo controls until their backend contract is implemented.
- Render assistant Markdown/code and stable error/fallback surfaces.

Exit: every visible control works, interrupted/failed/retried turns remain understandable after reconnect, and no duplicate event is rendered.

### M2 — Tool-ui-derived surfaces

- Add the small ToolSurface registry and shared action/receipt primitives.
- Upgrade Tasks, file changes, command output, Kernel execution, delegate, artifact, and approval rendering.
- Preserve dedicated/embedded component sharing.

Exit: every ten-tool family has a compact running/success/error/cancelled representation at both densities.

### M3 — Session and artifact usability

- Add session new/rename/delete/search/workspace filtering.
- Use capabilities/config for model choices and show configuration health.
- Add image/table artifacts, feed paging/windowing, timestamps, follow-output behavior, and loading/empty/error states.

Exit: a long, multi-tool session is navigable and resumes at the same cursor in both Pigent surfaces.

### M4 — KernelRuntime correctness

- Establish one authoritative per-kernel execution queue.
- Add notebook binding, status transitions, generation, queue depth, last activity, dead detection, timeout/interrupt semantics, and cleanup.
- Make Notebook, Inspect, browser execution, and Pigent `kernel.execute` use the same queue.

Exit: concurrent calls cannot cross-consume IOPub messages; restart invalidates live object references; dead/timeout states are deterministic.

### M5 — uv environment management

- Implement temporary and maintained environments in the config directory.
- Support provision, sync, start, promote, delete, operation progress, TTL cleanup, and UI management.
- Extend Pigent `kernel` actions without changing the ten-tool catalog.

Exit: a temporary environment can run code and be promoted; at least two maintained environments survive Pipyter restart and start independent Kernels using their own interpreters.

### M6 — Hardening and release candidate

- Add web unit/component tests and Playwright flows.
- Add package/build/clean-install checks, migration rollback tests, a11y checks, and deterministic screenshots.
- Update user/operator docs and third-party notices.

Exit: source, built wheel, local migration, frontend flows, Kernel environments, and existing Workspace/Shell/Notebook regressions all pass.

## Definition of done

- Local development uses the same Pipyter/Pigent version and payload that tests exercise.
- The local DeepSeek configuration is valid and independent after migration; AutoDL is not a runtime dependency.
- No credential value is committed, printed, copied to a project file, or returned by a read API.
- Dedicated and Workspace Pigent views share one session, event cursor, ToolSurface registry, and action implementation.
- User turns, assistant output, Tasks, tool calls, delegates, artifacts, interactions, errors, aborts, and receipts are all represented.
- Every visible action has a real handler and deterministic pending/success/failure state.
- The ten public tool names remain unchanged.
- Kernel execution has one queue/registry authority across all callers.
- Temporary uv environments expire safely and can be promoted.
- Maintained uv environments live under the Pipyter config root, persist across restart, and are manageable from Web and Pigent.
- Existing file, Notebook, persistent Shell, remote Runtime, and Ask/Plan/Auto behavior does not regress.
- Python tests, Pigent host checks, web typecheck/build/tests, browser flows, and package smoke pass.

## Stop conditions

- Do not write AutoDL secrets into this repository or a workspace.
- Do not copy AutoDL session/event/artifact/runtime-token/bridge-token state to local.
- Do not use the stale globally installed Pipyter `0.1.1` for acceptance.
- Do not claim the local Agent works while the bundled Pigent payload is missing.
- Do not fork the frontend into separate dedicated and embedded card implementations.
- Do not expose raw internal Node RPC events or raw Jupyter connection secrets to React.
- Do not create global/user Jupyter kernelspecs outside the Pipyter config root.
- Do not let Notebook, Inspect, REST execute, and Pigent maintain independent Kernel locks.
- Do not automatically delete maintained environments or uv's global cache.
- Do not ship copied tool-ui code without preserving its MIT notice and recording provenance.
- Do not publish a release without explicit user approval.
