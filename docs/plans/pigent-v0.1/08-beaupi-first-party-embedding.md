# BeauPi first-party code embedding

## Goal

Use the existing BeauPi code as first-party Pipyter implementation code:

```text
engines/beaupi/                 ignored local source
        │ direct cp -R
        ▼
packages/pigent/                tracked Pipyter source of truth
        │ build
        ▼
build/pigent-runtime/           generated Node payload
        │ Hatchling include
        ▼
pipyter wheel/sdist
```

This is not an external package integration and not a runtime dependency on `engines/`. After the copy, Pipyter owns and evolves the copied code directly.

## Hard repository rules

1. Keep the existing root `.gitignore` rule:

   ```gitignore
   engines/
   ```

2. `git ls-files engines` must remain empty.
3. No tracked TypeScript, Python, package manifest, build script, test, or runtime manifest may import/read `engines/beaupi`.
4. The copy is a development migration action, not a build step.
5. CI, sdist builds, wheel builds, and clean installs must work when `engines/` does not exist.
6. Do not use Git submodules, symlinks, `file:../../engines/...` dependencies, or a globally installed BeauPi package.
7. Do not keep a separate Pipyter patch layer around BeauPi. Modify the copied Pigent code in place.
8. BeauPi copyright/upstream synchronization is not a migration gate; this is first-party code from the same author.

## Target source layout

Use one self-contained Node workspace under the tracked `packages/pigent/` directory:

```text
packages/pigent/
├── package.json                 # private workspace/build commands
├── package-lock.json            # exact Node dependency graph
├── tsconfig.json
├── scripts/
│   ├── build-runtime.mjs
│   └── check-engine-independence.mjs
├── ai/                          # copied and renamed BeauPi ai package
│   ├── package.json
│   └── src/
├── agent/                       # copied and renamed BeauPi agent package
│   ├── package.json
│   └── src/
├── runtime/                     # copied/cut coding-agent runtime
│   ├── package.json
│   └── src/
├── host/                        # Pipyter-specific Pigent process entry
│   ├── package.json
│   └── src/
└── test/
```

Recommended package identities:

```text
@pipyter/pigent-ai
@pipyter/pigent-agent
@pipyter/pigent-runtime
@pipyter/pigent-host
```

Preserving the original `ai → agent → coding-agent` package boundaries during the first copy reduces import churn and makes it possible to establish a compiling baseline before pruning. They are internal first-party packages and are never published separately.

The `web/` project can continue using pnpm independently. Pigent runtime packaging should use its own committed lock and deterministic commands under `packages/pigent/` rather than forcing an immediate repository-wide JavaScript workspace conversion.

## Direct copy baseline

The initial migration may be deliberately broad:

```bash
mkdir -p packages/pigent
cp -R engines/beaupi/packages/ai packages/pigent/ai
cp -R engines/beaupi/packages/agent packages/pigent/agent
cp -R engines/beaupi/packages/coding-agent packages/pigent/runtime
```

Immediately remove copied build/install artifacts that are not source:

```text
node_modules/
dist/
coverage/
.artifacts/
*.log
npm caches
standalone release archives
```

Then add `packages/pigent/host` as new Pipyter code.

Do not try to hand-select individual files before the first compiling checkpoint. A broad `cp -R` followed by graph-based deletion is less likely to omit an indirect Agent/session/provider dependency.

## Code to retain

### From `packages/ai`

Retain the model/provider and streaming substrate needed by configured Pigent models:

- model and provider types;
- stream/event abstractions;
- OpenAI-compatible, Anthropic, Google, OpenRouter, DeepSeek, and explicitly supported provider adapters;
- faux provider for deterministic tests;
- credential resolution abstractions, rewritten to use Pipyter-owned stores;
- model catalogs actually exposed by Pipyter;
- message transformation and token/usage accounting;
- image input support required by `view`.

Prune providers only after dependency and product-support decisions are explicit. Do not prematurely rewrite the model transport layer in Python.

### From `packages/agent`

Retain:

- Agent loop;
- Agent state and messages;
- transport/stream function contracts;
- attachment and tool result handling;
- cancellation/abort handling;
- system prompt/harness pieces that are genuinely reusable after Pigent-specific prompt replacement;
- deterministic harness/faux-provider support used by tests.

### From `packages/coding-agent`

Retain the runtime pieces that avoid rebuilding a mature Agent host:

- SDK session creation and `AgentSessionRuntime`;
- `ToolDefinition` and tool lifecycle wrapping;
- strict JSONL/RPC framing and request correlation;
- session branching, compaction, persistence, and recovery;
- Dynamic Tasks runtime and compare-and-swap behavior;
- AgentPool, profiles, parallel sub-agent execution, cancellation, and structured results;
- core state/config abstractions that can be renamed to Pipyter paths;
- event translation inputs;
- resource loading only where Pipyter explicitly supplies resources;
- policy/audit event infrastructure, repurposed for Ask/Plan projection, operation facts, and interaction events rather than command restriction.

## Code to remove

Remove from the tracked Pigent copy once the host compiles without it:

- terminal TUI and interactive CLI modes;
- themes, prompt widgets, clipboard integration, and terminal rendering assets;
- stock `read`, `write`, `edit`, and `bash` implementations that bypass the Pipyter Python bridge;
- remote SSH, privileged execution wrappers, background task tools, workflow tools, and generic web tools not in the ten-tool contract;
- standalone server package behavior;
- standalone storage packages that duplicate Pipyter session/control ownership;
- self-update, installer, postinstall, standalone first-run setup, and `.beaupi` migration code;
- `models.json`, `models-store.json`, project model settings, ambient model-selection overrides, and standalone config-directory discovery;
- project extension/package auto-discovery;
- arbitrary project skills loading unless later added through a Pipyter allowlist;
- export-HTML implementation and bundled vendor assets unless Pigent UI directly needs them;
- image resize/conversion paths that introduce native Node modules when Python/browser artifact rendering already owns the behavior;
- standalone docs/examples/evals/release scripts from the copied runtime;
- BeauPi CLI binaries and command names.

Deletion criterion: remove a feature at its owner/import root and update the dependency graph. Do not leave dead code excluded only by runtime flags.

## Naming conversion

After the broad copy compiles, convert product and package identities in the tracked copy:

```text
@earendil-works/pi-ai          → @pipyter/pigent-ai
@earendil-works/pi-agent-core  → @pipyter/pigent-agent
@earendil-works/pi-coding-agent→ @pipyter/pigent-runtime
BeauPi / Pi user-facing text   → Pigent
.beaupi / .pi paths            → Pipyter-provided paths
BEAUPI_* / PI_* runtime config → PIGENT_* or explicit host config
beaupi CLI/config assumptions  → removed
```

Generic internal class names such as `Agent`, `ToolDefinition`, `AgentPool`, `Model`, or `Session` do not need cosmetic renaming. Rename only package identities, public strings, persisted/config fields, and concepts that would leak standalone BeauPi behavior.

Normal runtime locations become:

```text
${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json
${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/auth.json
<workspace>/.pipyter/pigent/   # sessions/tasks/events/artifacts only
```

The host receives the two user file paths explicitly. `settings.json` owns the default provider/model and non-secret provider protocol/model definitions; `auth.json` owns provider API addresses, secret headers, and API-key/OAuth credentials. Extend the copied credential envelope accordingly, pass `modelsPath: null`, use an in-memory model store, disable project settings merge, and remove `models.json`/`models-store.json` plus `getAgentDir()` fallbacks from the shipped host graph. It never discovers or imports `.beaupi`/`.pi` state on its own. See [User installation and Pigent model configuration](09-user-install-model-config.md).

## Pipyter-specific host

`packages/pigent/host` is the only executable entrypoint shipped in Pipyter.

Responsibilities:

1. validate the Python-provided startup configuration;
2. initialize copied Pigent AI/Agent/runtime modules;
3. create a session with Pigent identity;
4. expose exactly ten public ToolDefinitions;
5. project Ask/Plan/Auto action schemas;
6. adapt `tasks` to the copied Dynamic Tasks runtime;
7. adapt `delegate` to the copied AgentPool;
8. route file/notebook/kernel/Shell tools to the authenticated Python bridge;
9. translate internal events to the stable Pigent host protocol;
10. support prompt, follow-up, steer, abort, mode change, reconnect, and shutdown.

The copied runtime must not launch its old CLI, TUI, default built-in tools, or resource discovery path.

## Full Auto execution after embedding

Removing stock tools does not reduce Pigent capability. It changes the owner of execution:

```text
Pigent Agent loop
  → ten Pigent tool adapters
  → Pipyter Python bridge
  → current runtime OS user / Notebook / Kernel / Shell
```

The new `bash` adapter must preserve user-equivalent execution:

- current runtime user;
- current/explicit cwd, including paths outside the linked workspace;
- inherited Pipyter-approved environment;
- available network and system programs;
- PTY handoff when direct user input is required;
- OS result returned without converting it into an artificial workspace-policy denial.

Structured `read/write/update/notebook` tools may keep atomicity and revision checks while still accepting targets allowed by the runtime identity.

## Build and dependency model

The tracked Pigent workspace owns all first-party Agent source. Its package lock contains only external npm dependencies and links between local Pigent workspace packages.

Build flow:

```text
packages/pigent source
  → npm ci --ignore-scripts
  → typecheck/test
  → bundle host entry and required workers/assets
  → build/pigent-runtime
  → manifest/hash verification
  → Hatchling wheel/sdist include
```

Requirements:

- no npm dependency on BeauPi/Pi package names after namespace migration;
- no read from `engines/` during install/build/test;
- no upstream `postinstall.mjs`;
- no global npm package;
- no first-launch code download;
- no native Node module in a universal `py3-none-any` wheel unless the release plan changes to platform wheels;
- generated payload includes only runtime-reachable code/assets.

The released sdist should contain both the tracked Pigent source needed for source distribution and the verified generated payload required for offline PEP 517 installation, as defined in `05-packaging-release.md`.

## Python integration boundary

Copied TypeScript code owns:

- model calls;
- Agent loop;
- conversation/session branch;
- Tasks orchestration;
- delegate/sub-agent orchestration;
- compaction;
- internal tool lifecycle events.

Python owns:

- Pipyter process supervision;
- authenticated runtime/session identity;
- files and structured mutation correctness;
- Notebook documents;
- current Jupyter Kernel;
- inspection and artifacts;
- Shell/process sessions;
- public REST/WebSocket APIs;
- wheel resource discovery and health diagnostics.

Do not move mature copied Agent behavior into Python merely to avoid compiling TypeScript.

## Migration sequence

### E0: Copy a compiling baseline

- create `packages/pigent/` private workspace;
- direct-copy `ai`, `agent`, and `coding-agent` package trees;
- remove generated/cache directories;
- establish exact package lock and baseline typecheck;
- record a temporary import graph.

Exit: copied code compiles from the tracked directory with no imports resolving into `engines/`.

### E1: Create Pigent package identities

- rename package manifests/imports to `@pipyter/pigent-*`;
- replace config/product paths;
- add Pigent host entry;
- disable old executable and default startup paths.

Exit: a deterministic faux-provider session starts as Pigent from `packages/pigent/host`.

### E2: Prune to the product graph

- select supported providers;
- remove TUI/CLI/old tools/remote/privilege/background/workflow/install/update code;
- remove dependencies that become unreachable;
- run bundle analysis and dead-import checks after each owner-level deletion.

Exit: only the Pigent host and its test/runtime graph build; no standalone BeauPi surface remains.

### E3: Connect Pipyter tools and orchestration

- register the ten adapters;
- connect Python bridge;
- connect copied Tasks and AgentPool;
- implement Ask/Plan/Auto projection;
- implement user-equivalent Auto `bash` and interactive PTY handoff;
- translate events to product contracts.

Exit: both text-workspace and Notebook/Kernel vertical slices run through the copied first-party runtime.

### E4: Make packaging independent of engines

- build deterministic runtime payload;
- add Hatchling includes;
- run host smoke outside the repository;
- build with `engines/` absent;
- install wheel/sdist in clean environments.

Exit: `uv tool install pipyter` provides Pigent without any BeauPi checkout/package/global installation, and the embedded runtime reads only Pipyter's two Pigent model-config files.

### E5: Remove temporary compatibility

- remove old package aliases;
- remove any copied but unreachable file;
- remove migration-only scripts that are no longer needed;
- update architecture docs to make `packages/pigent` the only Agent source of truth.

Exit: `rg` finds no build/runtime dependency on `engines/beaupi` and no product-facing BeauPi/Pi identity.

## Verification

### Repository independence

```text
git check-ignore engines/beaupi/package.json
git ls-files engines
```

Expected:

- the first command reports the root `engines/` ignore rule;
- the second command returns nothing.

Additionally run the Pigent build and Python package build after temporarily moving or omitting `engines/`.

### TypeScript

- exact-lock install with lifecycle scripts disabled;
- typecheck all retained Pigent workspace packages;
- focused tests for Agent loop/session restore/RPC framing;
- faux-provider vertical flows;
- Tasks compare-and-swap and AgentPool tests;
- tool schema projection for Ask/Plan/Auto;
- cancellation and interactive handoff;
- bundle graph contains no old CLI/TUI entry.

### Integration

- Python starts only the tracked/bundled Pigent host;
- ten tools appear, old tool names do not;
- file/Notebook/Kernel/Shell calls use the Python bridge;
- Auto executes with the same runtime user/cwd/environment behavior as a direct user operation;
- host restart does not duplicate accepted mutations;
- no `.beaupi` discovery or config migration occurs.

### Package

- wheel/sdist contain Pigent payload and required protocol assets;
- neither archive contains `engines/` paths;
- manifest contains Pipyter/Pigent/protocol versions, not an external engine dependency requirement;
- clean install works with the source repository and npm registry unavailable;
- missing Node disables Pigent cleanly while leaving non-Agent Workspace functionality available, unless a later platform-binary release removes the Node prerequisite.

## Stop conditions

- Do not make `engines/beaupi` a build or runtime dependency.
- Do not publish copied internal packages to npm as a prerequisite for Pipyter.
- Do not retain stock tools that bypass the Python bridge.
- Do not copy `node_modules`, dist outputs, caches, sessions, credentials, or user config.
- Do not spend a migration phase preserving a separate BeauPi product surface inside Pipyter.
- Do not replace copied, working Agent/Tasks/AgentPool code with a speculative Python rewrite.
