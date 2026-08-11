# Pigent v0.1 implementation plan

## Decision summary

Pigent exposes ten stable, LLM-visible tools:

```text
Workspace       read · view · write · update · bash
Notebook        notebook · kernel · inspect
Orchestration   tasks · delegate
```

Key decisions:

1. **Use `view`, not `watch`.** `view` means “inspect this visual artifact”; `watch` remains available for a future event/subscription feature.
2. **Pigent is the only product-facing Agent name.** Pi/BeauPi may appear only in historical/local source context while the migration is in progress.
3. **There are exactly three modes: Ask, Plan, Auto.** Pilot is removed. Legacy Pilot session state maps directly to Auto.
4. **Auto has user-equivalent execution capability.** Pigent runs with the same filesystem, process, network, device, and program access as the Pipyter Runtime OS user. Pipyter does not add a workspace-only command sandbox or hidden restricted Auto tier.
5. **Python owns runtime integration and correctness.** Files, Notebook documents, current Kernels, inspection, artifacts, Shell processes, revisions, cancellation, and public APIs remain Pipyter services. This ownership prevents duplicate implementations; it does not reduce Auto’s OS-level authority.
6. **BeauPi code becomes first-party Pipyter code.** Keep `engines/` ignored, directly `cp -R` useful BeauPi `ai`, `agent`, and `coding-agent` sources into tracked `packages/pigent/`, then rename, prune, and modify them in place. Build/install/runtime must not depend on `engines/` or an external BeauPi package.
7. **The three latest HTML designs are authoritative for Pigent and Shell UI.** Use `/pigent`, the light Pigent session page, the 360 px Workspace panel, Ask/Plan/Auto selector, and the 220 px persistent multi-session Shell panel.
8. **Ship Pigent inside the `pipyter` PyPI distribution.** Recommend `uv tool install pipyter`; the first portable release embeds a deterministic Node payload and requires Node.js `>=22.19`, while a later release may use platform wheels with a standalone binary.
9. **Use exactly two persistent Pigent model-config files.** `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json` owns provider/model selection and non-secret protocol/model definitions; `auth.json` owns provider API addresses plus API-key/OAuth credentials. Do not create/read `models.json` or `models-store.json` and do not inherit `.beaupi` state.

## Product boundary

```text
Browser / future clients
        │
        │ Pipyter REST + WebSocket
        ▼
Pipyter Runtime API (Python)
  ├── authenticated runtime/session identity
  ├── files and structured revisions
  ├── Notebook documents and active cell context
  ├── current Jupyter Kernel bindings
  ├── variable/DataFrame/Figure inspection
  ├── persistent user Shell/PTY sessions
  ├── Pigent process supervision
  └── public session/event broker
        │ private local tool bridge
        ▼
Pigent Host (bundled Node runtime)
  ├── copied first-party AI/provider runtime
  ├── copied AgentSession/runtime core
  ├── ten public ToolDefinitions
  ├── copied Dynamic Tasks runtime
  ├── copied AgentPool delegate runtime
  ├── Ask/Plan/Auto projection
  └── streamed internal events
```

The browser never talks to the Node child directly. The Node child does not implement a second copy of Notebook, Kernel, Shell, or public API state. Auto tool calls reach those Python-owned runtime services and execute as the same OS user that owns the Pipyter runtime.

## Three tool layers

| Layer | Public tools | Owning implementation |
| --- | --- | --- |
| Workspace | `read`, `view`, `write`, `update`, `bash` | Pipyter Python services exposed through custom Pigent ToolDefinitions |
| Notebook Runtime | `notebook`, `kernel`, `inspect` | Pipyter Notebook/Kernel/artifact services |
| Orchestration | `tasks`, `delegate` | copied first-party Dynamic Tasks and AgentPool adapters in Pigent |

File search, directory listing, Git, Python scripts, package managers, and environment inspection do not become separate tools. `read` handles text and bounded directory listings; Auto uses full `bash` for general user operations.

## Mode contract

| Mode | Purpose | Mutation/execution |
| --- | --- | --- |
| Ask | inspect and answer | no mutation or execution actions |
| Plan | inspect, delegate analysis, maintain Tasks | Tasks only; no files/Notebook/Kernel/Shell mutation |
| Auto | complete the requested work | all ten tools and valid actions, with runtime-user authority |

Auto is not degraded into another mode when the runtime is unsandboxed. The runtime user is the boundary. Operations requiring passwords, hardware keys, OAuth/browser verification, or other direct input pause for a PTY/browser handoff; they are not relabelled as forbidden.

## Naming contract

| Surface | Name |
| --- | --- |
| Product title | `Pigent` |
| Python package | `pipyter.pigent` |
| Optional console launcher | `pigent` |
| Runtime process | `pigent-host` |
| Public page/route | `/pigent` |
| Public API prefix | `/api/v1/pigent` |
| Project-local state | `<workspace>/.pipyter/pigent/` |
| User model config | `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json` |
| User provider API/auth | `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/auth.json` |
| Environment prefix | `PIGENT_` |
| Tracked Node source | `packages/pigent/` |
| Ignored local source checkout | `engines/beaupi/` |

Generic implementation types such as `Agent`, `AgentSession`, `ToolDefinition`, or `Model` do not need cosmetic renaming.

## Recommended repository layout

Create directories only when implementation begins:

```text
Pipyter/
├── src/pipyter/
│   ├── pigent/
│   │   ├── manager.py          # copied host process lifecycle/health
│   │   ├── client.py           # strict JSONL client/event correlation
│   │   ├── bridge.py           # authenticated tool dispatch
│   │   ├── modes.py            # Ask/Plan/Auto schema enforcement
│   │   ├── tools.py            # file/view/write/update/bash adapters
│   │   ├── notebook.py         # stable cell/revision operations
│   │   ├── inspect.py          # bounded inspection/artifacts
│   │   └── models.py           # Python protocol models
│   ├── terminal/
│   │   ├── manager.py          # one-shot compatibility/Agent command path
│   │   └── session_manager.py  # persistent human Shell/PTY sessions
│   └── _vendor/pigent/         # generated wheel payload, not hand-edited
├── packages/
│   ├── pigent/
│   │   ├── ai/                 # copied BeauPi AI code, then renamed/pruned
│   │   ├── agent/              # copied Agent loop/state code
│   │   ├── runtime/            # copied coding-agent runtime core
│   │   ├── host/               # Pipyter-specific executable entry
│   │   ├── package.json
│   │   └── package-lock.json
│   └── protocol/
│       ├── src/pigent.ts
│       └── schemas/pigent-*.schema.json
├── web/src/pigent/             # shared dedicated/Workspace Pigent UI
├── scripts/
│   └── build-pigent-runtime.mjs
└── tests/
    ├── test_pigent_tools.py
    ├── test_pigent_notebook.py
    ├── test_pigent_modes.py
    ├── test_pigent_runtime.py
    ├── test_terminal_sessions.py
    └── test_pigent_package.py
```

Account, project, node, workspace, and public Pigent session summaries remain behind `pipyter.control`. Full conversations, Notebook data, variables, Shell buffers, and artifacts stay on the compute runtime.

## Milestone implementation summaries

### M0: Contract, modes, and first-party source baseline

- Freeze ten tool names, action schemas, results/errors, events, session state, and TerminalSession contracts.
- Freeze Ask/Plan/Auto and legacy `pilot → auto` migration.
- Direct-copy BeauPi `ai`, `agent`, and `coding-agent` package trees into `packages/pigent/`.
- Establish a compiling tracked baseline with no import/build dependency on `engines/`.
- Add product package identities and a minimal Pigent host entry.
- Inject exact Pipyter `settings.json`/`auth.json` paths; disable standalone project config, `models.json`, `models-store.json`, and `.beaupi` discovery.

Exit: Python/TypeScript fixtures agree, and a faux-provider Pigent session starts entirely from tracked source while `engines/` remains ignored.

### M1: Workspace execution slice

Implement:

```text
prompt → Pigent → tasks → read → update → bash verification → tasks done
```

- Route `read`, `view`, `write`, `update`, and `bash` through the authenticated Python bridge.
- Keep revision/atomicity/idempotency for structured operations.
- Let Auto target any path/command available to the runtime OS user; use the linked workspace only as the default cwd.
- Stream Agent/tool/task/process events through Pipyter.

Exit: a clean build can modify and verify a text file and run a command without any global npm package or `engines/` checkout.

### M2: Notebook Runtime slice

Implement all eight Notebook actions, current-Kernel execution, and bounded `inspect` for variables, DataFrames, figures, and object metadata.

Exit: Pigent modifies a stable cell ID, runs it in the Notebook’s bound Kernel, persists outputs, inspects the result, and verifies a visual artifact with `view`.

### M3: Auto and orchestration

- Project Ask, Plan, and Auto schemas.
- Wrap copied Dynamic Tasks as `tasks` and AgentPool as `delegate`.
- Give Auto all valid tool actions with runtime-user authority.
- Add direct PTY/browser handoff for genuinely interactive commands.
- Map old mode state to Auto and remove legacy fields on rewrite.

Exit: Auto completes both vertical slices end to end; Ask/Plan cannot mutate; no hidden restricted Auto or Pilot mode exists.

### M4: Persistent Shell and Pigent UI

- Replace the old `/pilot` surface with canonical `/pigent` plus a compatibility redirect.
- Build shared Pigent cards, mode selector, composer, context chips, session list, and detail panel.
- Replace the dark static Workspace panel with the new 360 px light Pigent panel.
- Replace one-shot visual terminal state with persistent Shell sessions, tabs, streaming, resize, maximize, close, and later split panes.
- Share the active Pigent session between the dedicated page and Workspace panel.

Exit: the React application matches the three named designs at baseline viewports and remains connected to live Pigent/Shell state across reconnects.

### M5: Public API, packaging, and release readiness

- Add Pigent session REST/WebSocket APIs and persistent TerminalSession APIs.
- Generate the Node runtime payload from tracked `packages/pigent/` source.
- Include the payload in sdist/wheel with hashes and Node requirement.
- Add the thin `pigent` launcher and extend `doctor`, `status`, shutdown, and clean-install smoke.
- Initialize `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/{settings.json,auth.json}` with restrictive permissions and expose sanitized config/auth APIs.
- Prove build/install succeeds when `engines/` is absent.

Exit: `uv tool install pipyter` provides Workspace, Pigent, and Shell runtime assets; no npm lifecycle runs on the user machine, no code is downloaded on first launch, and Pigent model configuration uses only `settings.json` plus `auth.json`.

## Detailed plans

- [Tool contracts and compatibility](01-tool-contracts.md)
- [Notebook, Kernel, Inspect and visual artifacts](02-notebook-runtime.md)
- [Ask, Plan and Auto execution](03-modes-permissions.md)
- [Python/Node runtime bridge and session lifecycle](04-runtime-bridge.md)
- [PyPI payload, build and release strategy](05-packaging-release.md)
- [Implementation sequence and verification gates](06-implementation-sequence.md)
- [Pigent and Shell UI migration](07-pigent-shell-ui-migration.md)
- [BeauPi first-party code embedding](08-beaupi-first-party-embedding.md)
- [User installation and Pigent model configuration](09-user-install-model-config.md)

## Compatibility strategy

| Legacy surface | Pigent surface | Migration |
| --- | --- | --- |
| mode `pilot` | mode `auto` | map during session import/state load; new schemas reject `pilot` |
| route `/pilot` | route `/pigent` | one browser redirect; no visible legacy label |
| `read` handles text and images | `read` for text; `view` for visuals | compatibility adapter during transition |
| `edit` | `update` | wrapper first, then remove old public name |
| `tasks_update` | `tasks` | adapter over copied Dynamic Tasks |
| `delegate_task` | `delegate` | adapter over copied AgentPool |
| `.beaupi` / `BEAUPI_*` | `~/.config/pipyter/pigent/{settings.json,auth.json}` / `PIGENT_*` | copied code receives exact Pipyter paths; no automatic standalone config import or third model file |
| ignored `engines/beaupi` source | tracked `packages/pigent` source | direct copy once, then Pipyter copy becomes source of truth |

New Pigent sessions expose only the new catalog. Historical events may retain old strings, but they do not alter current tool/mode schemas.

## Completion criteria

- Exactly ten Pigent tools are advertised in Auto.
- Ask/Plan expose only their non-mutating action subsets.
- Pilot is absent from mode schemas and visible UI; legacy state maps to Auto.
- Auto can perform commands and operations with the same practical authority as the runtime OS user.
- `view` handles file images and runtime visual artifacts; `read` handles text/directories.
- Notebook mutations use stable cell IDs and reject stale structured revisions.
- Notebook, Kernel, and Inspect share the active Workspace Kernel.
- Pigent dedicated page and Workspace panel share components and one live session.
- Shell tabs represent independent persistent PTY sessions, not one shared command buffer.
- `engines/` remains ignored and untracked.
- tracked source, CI, wheel, and sdist builds do not read `engines/beaupi` or install BeauPi separately.
- `uv tool install pipyter` is the recommended user path and contains the Pigent host payload in the same PyPI distribution.
- Pigent model/API configuration persists only in `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json` and `auth.json`; the former selects/defines models and the latter supplies provider API addresses/credentials, with no `models.json`, `models-store.json`, project model setting, or `.beaupi` inheritance.
- missing/incompatible Node or model configuration is diagnosed clearly while non-Agent Workspace features remain usable.
- Python tests, Pigent TypeScript checks, web build, browser flows, package inspection, and clean-install smoke pass.

## Stop conditions

- Do not reintroduce Pilot as a selectable mode.
- Do not add a workspace-only denylist or degraded Auto tier; OS identity is the execution boundary.
- Do not make `engines/beaupi` a tracked, build, install, or runtime dependency.
- Do not expose raw Node bridge credentials, provider secrets, terminal authentication input, or reusable Jupyter tokens.
- Do not expose raw internal Agent RPC events directly to the browser.
- Do not fake persistent Shell tabs using the existing stateless execute endpoint.
- Do not run npm lifecycle scripts during wheel installation or first launch.
- Do not add another persistent Pigent model-config file or silently select a model from CLI/env/browser/session/project state.
- Do not publish to PyPI without explicit user approval.
