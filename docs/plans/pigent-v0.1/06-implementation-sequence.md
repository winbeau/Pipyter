# Implementation sequence and verification gates

## Delivery principle

Deliver the shortest runnable chain while preserving four non-negotiable architecture decisions:

1. `engines/` stays ignored and is never a build/runtime dependency.
2. copied first-party Pigent code lives and evolves under tracked `packages/pigent/`.
3. Auto executes with the same practical authority as the Pipyter Runtime OS user.
4. Pigent model configuration persists only in `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json` and `auth.json`.

Build two end-to-end Agent slices before broad polish:

```text
text workspace slice
Notebook / Kernel / visual slice
```

Implement the new UI against deterministic demo events early, but do not declare the migration complete until it is connected to live Pigent and persistent Shell state.

## Phase 0: Freeze contracts, names, and design baseline

### Changes

- Freeze the ten public tool names and action schemas.
- Freeze Ask/Plan/Auto; new schemas reject `pilot` and legacy state maps it to `auto`.
- Add shared request/result/error, revision, event, interaction, Tasks, artifact, PigentSession, and TerminalSession contracts.
- Define `PIGENT_PROTOCOL_VERSION` and stable error/event codes.
- Freeze `uv tool install pipyter` as the recommended user install path and the two-file Pigent config schema/permissions/selection authority.
- Record the three named HTML files as the visual source of truth.
- Extract baseline dimensions/tokens:
  - 84 px global rail;
  - 236 px Pigent session list;
  - 300 px optional detail panel;
  - 360 px Workspace Pigent panel;
  - 220 px Shell panel;
  - Ask/Plan/Auto selector;
  - `--pigent`, `--pigent-soft`, `--pigent-dark`.

### Focused checks

- Python model round trips.
- TypeScript schema/type fixtures.
- Cross-language golden JSON.
- Reject unknown tool names/actions/statuses/modes/protocol versions.
- Legacy mode fixture maps `pilot → auto` exactly once.
- Render the HTML references at 1360×860 and 1440×900 for comparison fixtures.

### Exit gate

No implementation invents a public field, mode, event, or visible layout state outside the shared contract/design plan.

## Phase 1: Copy and productize first-party Pigent runtime

### Changes

Create tracked `packages/pigent/` and directly copy:

```text
engines/beaupi/packages/ai           → packages/pigent/ai
engines/beaupi/packages/agent        → packages/pigent/agent
engines/beaupi/packages/coding-agent → packages/pigent/runtime
```

Then:

- remove copied `node_modules`, dist, caches, logs, release archives, sessions, and user config;
- establish a private local Node workspace and exact package lock;
- create `packages/pigent/host`;
- rename internal package identities to `@pipyter/pigent-*`;
- replace standalone config/product paths with exact Pipyter-provided `settings.json` and `auth.json` paths;
- narrow `settings.json` to provider/model choice plus non-secret protocol/model definitions, and extend the copied auth envelope so `auth.json` supplies provider API addresses, secret headers, and credentials;
- pass `modelsPath: null`, use an in-memory model store, and remove project/`.beaupi` config discovery plus `models.json`/`models-store.json` from the shipped host graph;
- start a deterministic faux-provider Agent session;
- prune TUI/CLI, old built-in tools, install/update, remote/privilege/background/workflow, standalone server/storage, and project auto-discovery after a compiling baseline exists.

Do not rewrite the Agent loop, model runtime, Tasks, AgentPool, JSONL framing, session branching, or compaction in Python.

### Focused checks

- typecheck copied packages before and after namespace conversion;
- faux-provider prompt/stream/abort/session restore;
- Dynamic Tasks compare-and-swap tests;
- AgentPool parallel/structured-result tests;
- import/bundle graph has no path into `engines/`;
- host model initialization reads only injected `settings.json`/`auth.json`; no `getAgentDir()` fallback or third model file exists;
- no old CLI/TUI entry is part of the host bundle;
- `git check-ignore engines/beaupi/package.json` reports the root ignore rule;
- `git ls-files engines` is empty.

### Exit gate

A Pigent-branded host starts entirely from tracked source with `engines/` temporarily absent.

## Phase 2: Python tool bridge and two vertical slices

### Changes

Add a compact `src/pipyter/pigent` layer:

- `bridge.py`: authenticated dispatch and trusted session/runtime lookup;
- `modes.py`: Ask/Plan/Auto action validation;
- `tools.py`: `read`, `view`, `write`, `update`, `bash`;
- `notebook.py`: stable cell/document operations;
- `inspect.py`: bounded Kernel inspection and artifacts;
- shared revisions, idempotency, cancellation, and result envelopes.

Refactor existing owners instead of duplicating them:

- file operations reuse/strengthen `workspace.files`;
- structured writes remain atomic and revision-aware;
- Notebook operations use nbformat stable IDs and locks;
- Kernel operations use the current Workspace-bound Kernel;
- one-shot/Agent command execution remains Python-owned and runs as the runtime OS user;
- relative cwd/path defaults to the Workspace, while Auto may use any path/cwd allowed by that OS identity.

### Text workspace slice

```text
read target
→ tasks snapshot
→ update/write
→ bash focused check
→ read/view result
→ tasks done
```

### Notebook/Kernel/visual slice

```text
notebook.read_cell
→ notebook.update_cell
→ notebook.run_cell in current Kernel
→ inspect.dataframe or inspect.figure
→ view artifact
→ tasks done
```

### Focused checks

- malformed/NUL path rejection and normal OS permission errors;
- relative and absolute path behavior under a disposable runtime user;
- bounded directory listing through `read`;
- read/view media separation;
- exact replacement uniqueness and patch validation;
- stale structured revision rejection;
- per-target concurrent mutation serialization;
- idempotent retry;
- Ask/Plan mutation/execute denial and Auto allow;
- Auto cwd outside the linked Workspace;
- process timeout/cancel and bounded output;
- child process environment contains no provider/bridge secrets;
- nbformat validity and stable cell IDs;
- current-Kernel ownership and execution queue;
- output persistence and source-change conflict;
- bounded DataFrame/Figure/object inspection;
- artifact authorization and expiry.

### Exit gate

Both vertical slices succeed through one authenticated Python dispatch path, with Auto behavior matching a direct operation by the same runtime user.

## Phase 3: Pigent tools, orchestration, modes, and public sessions

### Changes

In `packages/pigent/host`:

- register exactly ten ToolDefinitions;
- project Ask/Plan/Auto action schemas;
- adapt `tasks` over copied Dynamic Tasks;
- adapt `delegate` over copied AgentPool;
- route Python-owned tools through the bridge;
- translate internal runtime events to stable Pigent events;
- support prompt/follow-up/steer/abort/mode change/reconnect/shutdown.

In Python/public API:

- add lazy `PigentManager` process supervision;
- add session REST endpoints and versioned event WebSocket;
- add event cursor/replay and reconnect snapshot;
- persist selected mode, execution identity, Tasks snapshot, active calls, and interactions;
- add active document/cell/Kernel context updates;
- add sanitized config/auth endpoints that atomically update the two files and never return secrets;
- resolve the model from explicit `settings.json.defaultProvider/defaultModel` plus the selected provider's API address/credential availability in `auth.json`; return `model_configuration_required` rather than guessing;
- add PTY/browser interaction handoff events for commands requiring direct user input;
- keep optional operation-review preference separate from capability.

### Mode behavior

- Ask: non-mutating read/view/Notebook-read/Kernel-status/Inspect and non-writing delegate profiles.
- Plan: Ask plus Tasks.
- Auto: all ten tools/actions and implementation delegates with runtime-user authority.
- No requested/effective mode split.
- No Auto degradation, workspace-only sandbox, network denylist, privilege denylist, or hidden execution tier.

### Focused checks

- exactly ten Auto tools advertised;
- Ask/Plan schemas omit mutating/executing actions;
- old tool aliases and Pilot mode are absent from new sessions;
- fake mode in arguments does not change trusted session mode;
- `pilot` persisted state imports as `auto`;
- Tasks revision/status mapping;
- delegate profile mapping, parallel calls, no nested delegation, structured result;
- Auto implementation child edits/executes through the same bridge;
- malformed JSONL and host crash recovery;
- cancellation reaches Python/Kernel/process work;
- event cursor replays exactly once;
- interactive input bytes never enter Agent events/logs;
- host restart does not duplicate accepted mutation;
- UI model changes persist to `settings.json`, and CLI/env/browser/session/project values cannot override the selected pair;
- malformed config is preserved and disables only Pigent model turns;
- no `models.json`, `models-store.json`, or `.beaupi` user file is read/written.

### Exit gate

A real model or faux provider completes both vertical slices through the copied Pigent runtime, and reconnect restores session/mode/Tasks/events without duplicate effects.

## Phase 4: Persistent user Shell runtime

### Changes

Keep `/api/v1/terminals/execute` temporarily for compatibility/Pigent one-shot command calls, but introduce a real `TerminalSessionManager`:

```text
GET    /api/v1/terminals
POST   /api/v1/terminals
GET    /api/v1/terminals/{id}
DELETE /api/v1/terminals/{id}
POST   /api/v1/terminals/{id}/resize
WS     /api/v1/terminals/{id}/stream
```

Responsibilities:

- create persistent PTY/Shell processes as the runtime user;
- independent cwd/environment per session;
- binary/text stream framing and bounded replay cursor;
- raw input, resize, exit, signal, close, and shutdown;
- survive browser reconnect while runtime lives;
- integrate Running panel and runtime shutdown;
- attach Pigent interactive commands to a Shell session when needed.

Use a platform adapter behind one interface; Jupyter/terminado may be reused where appropriate. Do not make React own process state.

### Focused checks

- two sessions have independent cwd/environment/output;
- bash and Python/REPL sessions accept interactive input;
- resize reaches the PTY;
- clear is client buffer behavior and does not kill the process;
- close terminates only the selected owned session;
- reconnect resumes stream from cursor;
- runtime shutdown cleans all owned processes;
- Ctrl+C/Ctrl+D semantics;
- interaction handoff focuses the correct session;
- no terminal authentication input in logs/events.

### Exit gate

Persistent Shell sessions work independently of the old one-shot command buffer and support the design’s tabs/reconnect requirements.

## Phase 5: Pigent and Shell React migration

Follow [07-pigent-shell-ui-migration.md](07-pigent-shell-ui-migration.md).

### Changes

- canonical `#/pigent`; redirect old `#/pilot` bookmark;
- PageId/NavigationRail label/icon/route migration;
- `--pilot-*` → `--pigent-*` and removal of old visible labels;
- shared Pigent feature components and store;
- dedicated 236 px session list + main feed + optional 300 px detail panel;
- 360 px light Workspace Pigent panel without the old collapsed rail;
- shared active session and event cursor across both views;
- Ask/Plan/Auto selector and live mode changes;
- Tasks/tool/delegate/diff/output/artifact/interaction cards;
- sticky composer and context chips;
- new 220 px Shell panel with tabs, new/clear/close, resize, maximize/restore, status footer, and split panes after single-pane stability;
- update Home/Figures/Settings Pigent copy;
- retain deterministic demo state for static preview.

### Focused checks

- `pnpm typecheck` and `pnpm build`;
- no visible Pilot label and no `.ws-pilot-*`/`--pilot-*` source token;
- `/pigent` navigation and old-route redirect;
- screenshots at 1360×860 and 1440×900 against design structure/tokens;
- dedicated/embedded views import shared cards and mode selector;
- one live session moves between views without restart/event duplication;
- Pigent panel open/close and 360 px geometry;
- Shell 220 px default, resize, tabs, reconnect, maximize/restore, close, split;
- Notebook/file/Kernel Workspace regression;
- accessibility/focus/reduced-motion/terminal-key behavior.

### Exit gate

The running web application matches the named designs and uses live Pigent and Shell services rather than static legacy blocks.

## Phase 6: PyPI payload and release readiness

### Changes

- add deterministic `packages/pigent` runtime builder and exact lock;
- generate manifest/hash/dependency metadata;
- force-include payload in wheel and sdist;
- add `pigent` console launcher;
- initialize `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/{settings.json,auth.json}` with `0700/0600` permissions, locks, and atomic writes;
- extend RuntimeState, `doctor`, `status`, `up/down`, and clean shutdown;
- rebuild ignored `src/pipyter/static` from web source;
- add clean-install and cross-platform CI.

### Focused checks

- build succeeds with `engines/` absent;
- payload has no import/path/reference to `engines/beaupi`;
- no native `.node` files for a universal wheel;
- no npm lifecycle during wheel/sdist install;
- no global npm/BeauPi dependency;
- wheel and sdist install with network unavailable;
- `uv tool install pipyter` smoke from the built distribution and upgrade-preserves-config check;
- Node minimum detection;
- missing Node leaves non-Agent Workspace usable;
- host/tool faux-provider smoke outside repository;
- generated static UI contains Pigent and no visible Pilot labels;
- archive inspection excludes credentials, user config, sessions, model stores/caches, logs, and ignored engine trees;
- first config initialization creates exactly `settings.json` and `auth.json`, never `models.json` or `models-store.json`.

### Exit gate

`uv tool install pipyter` provides a verifiable Pigent payload, Workspace UI, and runtime services without `engines/` or a separately installed Agent package; model/API setup uses only `settings.json` and `auth.json`. Publication still requires explicit approval.

## Suggested file-level ownership

| Area | Primary files |
| --- | --- |
| Shared contracts | `src/pipyter/protocol`, `packages/protocol` |
| Copied Agent/model runtime | `packages/pigent/ai`, `packages/pigent/agent`, `packages/pigent/runtime` |
| Pigent executable host | `packages/pigent/host` |
| Workspace side effects | existing `workspace`, `terminal`, plus `pipyter.pigent.tools` |
| Notebook document | `pipyter.pigent.notebook` or refactored `workspace.notebooks` |
| Kernel and Inspect | existing `kernel` plus `pipyter.pigent.inspect` |
| Persistent Shell | `pipyter.terminal.session_manager` |
| Process lifecycle | `pipyter.pigent.manager`, existing runtime manager/state |
| Public Pigent/Shell API | `pipyter.server` routers/models |
| Browser Pigent UI | `web/src/pigent` plus Workspace integration |
| User model config | `pipyter.pigent.config`, copied/narrowed SettingsManager/AuthStorage, sanitized config/auth API |
| Packaging | `packages/pigent/scripts`, root build script, `pyproject.toml` |

Keep one owner for each behavior. TypeScript may validate/preflight, but Python owns actual runtime objects and OS process creation.

## Required test layers

### Unit

- schemas/results/events;
- paths/revisions/patches;
- Notebook cell operations;
- Ask/Plan/Auto projection;
- Tasks/delegate adapters;
- terminal session state/framing;
- payload manifest;
- config path resolution, two-file schema, permissions, locking, and model selection authority.

### Integration

- FastAPI internal bridge and public Pigent endpoints;
- actual Python Kernel execution;
- Python ↔ Node JSONL;
- copied Tasks/AgentPool with faux provider;
- persistent PTY stream and reconnect;
- process/host restart and cancellation.

### Browser

- `/pigent` route/session list/detail panel;
- Workspace Pigent panel;
- mode selector;
- streamed assistant/tool/task/delegate events;
- interaction-to-Shell handoff;
- active Notebook/Kernel context;
- image/figure rendering;
- multi-session Shell controls and reconnect.

### Package

- ignored/untracked `engines/` assertions;
- wheel/sdist contents;
- clean venv install;
- Node present/missing;
- no network/global npm/external BeauPi;
- `uv tool install` and config initialization/upgrade behavior;
- cross-platform host handshake.

## Final release-readiness checklist

1. Public tool list and Ask/Plan/Auto matrix match the plan.
2. Pilot is absent from selectable modes and visible product UI.
3. Auto operations match the runtime OS user’s practical authority.
4. copied first-party Pigent source is tracked under `packages/pigent/`.
5. build/test/install pass with `engines/` absent.
6. Python owns files, Notebook, Kernel, Inspect, artifacts, and Shell objects.
7. current Notebook and current Kernel are shared with Pigent.
8. persistent Shell tabs are independent PTY sessions.
9. revision/idempotency tests prevent lost or duplicate structured mutations.
10. dedicated and Workspace Pigent surfaces share one live session/event cursor.
11. Node payload is deterministic and self-contained in PyPI artifacts.
12. recommended `uv tool install pipyter` works from the built distribution.
13. Pigent model selection and credentials use only `settings.json` and `auth.json`; no model store, project override, or standalone config inheritance exists.
14. no secrets or terminal authentication input enter normal logs/events/model context.
15. release version is new and publication has explicit approval.
