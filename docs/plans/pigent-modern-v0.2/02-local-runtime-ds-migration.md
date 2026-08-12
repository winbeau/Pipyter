# Local runtime and AutoDL DeepSeek migration

## Goal

Create a reproducible local Pigent development path and copy only the required AutoDL provider/model configuration into the local Pipyter user config.

After migration, local Pigent must call the provider directly. It must not proxy model traffic through AutoDL or require AutoDL to remain online.

## Current facts

### Local

```text
Repository/runtime:       0.1.4
Global `pipyter`:         0.1.1 (stale; do not use for acceptance)
Node:                     v24.16.0
uv:                       0.9.17
pnpm:                     10.14.0
Pigent config:            ~/.config/pipyter/pigent/
Default selection:        missing
Provider data:            placeholder `custom`
Source payload:           missing at src/pipyter/_vendor/pigent
```

The page can start from source, but capabilities correctly report that the Pigent host payload is unavailable.

### AutoDL

```text
Installed Pipyter:        0.1.4 via uv tool
Node:                     v24.19.0
Runtime workspace:        /root/pipyter-workspaces/research
Runtime bind:             0.0.0.0:6006
Pigent config:            /root/.config/pipyter/pigent/
Default model:            deepseek/deepseek-v4-flash
Configured providers:     deepseek, openai
```

No secret values belong in this document.

## Source-development runtime strategy

Choose one supported source path and make it explicit in developer documentation.

### Recommended path: build the local payload

```text
pnpm install --frozen-lockfile (only if lock/install state requires it)
node packages/pigent/scripts/check-engine-independence.mjs
node packages/pigent/scripts/build-runtime.mjs
uv run pipyter lab <workspace>
```

The exact repository scripts should remain the source of truth; documentation must not invent a second hand-written bundling command. The build must generate/verify the payload where `pipyter.pigent.resources` expects it in editable/source mode, or resource discovery must explicitly support the existing verified `build/pigent-runtime` artifact.

Preferred implementation:

1. Add a development resource resolver that accepts a verified repository payload only when running from a source checkout.
2. Validate manifest hashes and protocol versions exactly as the wheel path does.
3. Never search arbitrary parent directories or `engines/`.
4. `pipyter lab` reports one precise remediation when the payload is absent/stale.

Alternative release-like path:

```text
build web + Pigent payload
uv build
install the built wheel into a disposable uv/venv
run installed `pipyter lab`
```

Use this for package acceptance, not every edit-refresh frontend cycle.

## Migration scope

Copy:

- `settings.json` model selection and non-secret definitions;
- selected provider entries from `auth.json` including endpoint and credentials;
- file modes/ownership appropriate for the local user.

Default migration scope for this request:

```text
deepseek provider
+ defaultProvider/defaultModel/defaultThinkingLevel if present
+ supporting provider model definition if present
```

Do not copy `openai` by default merely because it exists remotely. Offer it as a separate selected provider in an explicit multi-select migration operation.

Never copy:

- `/root/.config/pipyter/runtime-token`;
- bridge/host startup credentials;
- `.pipyter/project.toml`;
- public Pigent sessions/events/tasks/artifacts;
- Kernel connection files or processes;
- Shell sessions or logs;
- AutoDL OS/environment configuration;
- `.beaupi`, `.pi`, model stores, caches, or browser state.

## Explicit migration command

Extend the existing dedicated `pigent` console script rather than adding another nested parser under the main CLI. The canonical commands are:

```text
pigent config migrate-ssh \
  --source autodl \
  --provider deepseek \
  --preview

pigent config migrate-ssh \
  --source autodl \
  --provider deepseek \
  --apply
```

### Source resolution

- `--source autodl` resolves through the user's trusted OpenSSH config.
- Do not accept passwords or private keys through arguments/chat.
- Optional `--source-config-dir` defaults to the remote Pipyter config resolver, not a guessed project path.
- The migration invokes `ssh` as argv without a local shell.
- AutoDL Pipyter 0.1.4 has no migration helper. v0.2 therefore ships a small versioned, read-only helper script as local package data and sends it to `ssh <alias> python3 -` over stdin; it is not persisted remotely. The helper reads only the two resolved Pigent config files, enforces provider filtering and file-mode/schema checks, and writes one envelope to stdout.
- The first response is a non-secret helper/version handshake. Apply proceeds only when envelope/schema versions are supported; no arbitrary remote Pipyter code is imported.
- Remote helper stdout is the minimal versioned envelope; stderr is diagnostic and redacted.

### Preview

Preview returns no secret material:

```text
Source Pipyter version
source config paths
settings/auth file modes
selected default provider/model
provider IDs available
per-provider: credential type, endpoint origin/path, literal-vs-env-reference
local destination and current revisions
planned create/replace/merge decisions
warnings and rollback backup paths
```

Preview validates:

- both JSON files parse;
- selected provider exists;
- default provider/model is internally consistent;
- local schema supports the remote version;
- selected endpoint is syntactically valid;
- target directory and permissions can be secured;
- local and remote Pipyter config schema versions are compatible.

### Apply

Apply performs:

1. acquire local config lock;
2. re-read and compare local revisions from preview, or require a fresh preview token;
3. create a timestamped local backup under a private directory;
4. retrieve only the selected records over SSH;
5. validate before writing;
6. write temporary files in the destination filesystem;
7. `fsync`, chmod `0600`, atomic replace;
8. reload/validate model configuration;
9. run a non-secret capabilities check;
10. leave backup and print rollback command.

Do not print the copied JSON or provider key.

## Merge policy

Default policy is safe, provider-scoped merge:

### `settings.json`

- preserve unknown compatible local keys;
- set the selected default pair to the migrated DeepSeek pair;
- merge only selected provider definitions when definitions exist;
- reject conflicting schema versions or secret fields in settings;
- do not add a third config file.

### `auth.json`

- replace only the selected provider entry after explicit preview;
- preserve unrelated local providers;
- reject any provider ID collision unless preview marked it as replace;
- never resolve an environment reference on AutoDL and write the resolved secret locally. Preserve the reference only when the referenced variable is expected and available locally; otherwise mark migration blocked and explain that a literal credential or local variable setup is required.

For the audited DeepSeek entry, the remote credential is literal, so the migration can copy it directly through the private stream and write it locally with `0600` permissions.

## Backup and rollback

Private backups:

```text
${XDG_CONFIG_HOME:-~/.config}/pipyter/backups/pigent/
└── <UTC timestamp>-<migration-id>/
    ├── settings.json
    ├── auth.json
    └── manifest.json   # revisions, modes, source facts; no copied secret duplication beyond backup files
```

Directory mode `0700`, files `0600`.

Rollback command:

```text
pigent config rollback <migration-id>
```

Rollback also uses revision checks. It refuses to clobber subsequent edits unless `--force` is explicitly supplied after a second preview.

Backups retain credentials and therefore require the same confidentiality as active `auth.json`. Add a documented prune command; do not auto-upload or commit them.

## Local startup contract

Recommended developer command:

```text
cd /home/winbeau/Projects/Pipyter
uv run pipyter lab --no-browser --port 8895 <workspace>
```

Startup checks visible in `pipyter doctor` and capabilities:

```text
repository/runtime version
web static freshness
Pigent payload path + hash validity
Node minimum
uv minimum/availability for managed Kernel environments
settings/auth parse and permissions
explicit default provider/model
selected provider endpoint/credential availability
Kernel environment registry health
```

The Pigent page must distinguish:

- `model_configuration_required`;
- `provider_auth_required`;
- `payload_missing` or `payload_stale`;
- `node_missing/incompatible`;
- `uv_missing/incompatible` for environment management only;
- network/provider error;
- host startup/protocol error.

Do not flatten these into “disconnected” or fall back to demo mode for a configured local runtime unless the user explicitly opens a design/demo mode.

## Local DS smoke

Use a minimal request that does not mutate the workspace:

```text
Mode: Ask
Prompt: 回复字符串 PIGENT_LOCAL_DS_OK，不调用任何工具。
```

Acceptance evidence:

- session created locally;
- capabilities show selected provider/model configured;
- host starts from the local verified payload;
- assistant text streams and settles;
- provider/API key never appears in browser payload, logs, argv, event JSON, or child tool environment;
- disabling SSH/AutoDL after migration does not affect a second local turn.

Then run a bounded tool smoke in a disposable workspace:

```text
Auto: create a temporary text file, read it, and delete/restore via an explicit test fixture policy
```

Avoid using the repository working tree for destructive model acceptance.

## Frontend/backend development topology

Support two loops:

### Same-origin integrated loop

```text
uv run pipyter lab --port 8895 <workspace>
```

Use for real API/WebSocket/browser acceptance.

### Fast frontend loop

```bash
# terminal 1
uv run pipyter lab --no-browser --port 8895 <workspace>

# terminal 2
cd web
PIPYTER_DEV_RUNTIME=http://127.0.0.1:8895 pnpm dev
```

- `web/vite.config.ts` reads the non-secret proxy target from `PIPYTER_DEV_RUNTIME` (with one documented default) for REST and WebSocket traffic; do not hard-code 8765 while the documented Runtime uses 8895.
- Provider credentials remain in the backend config only.
- Flip PigentProvider's normal default to `allowDemo: false`. Demo fixtures are entered through an explicit design/demo switch; connection errors do not silently fabricate live state.

## Operational note: AutoDL duplicate processes

The audit found several parentless Pipyter node processes, while only one owned port 6006. Before future AutoDL deployments:

- identify the intended supervisor/launcher;
- stop stale processes gracefully;
- ensure the pid/log files correspond to the listening process;
- add single-instance lock or socket-bind failure handling;
- never make local config migration depend on cleaning these processes.

This is a remote deployment hygiene item, not part of the local secret-copy transaction.

## Tests

### Migration unit tests

- preview redacts literal and referenced secrets;
- provider-scoped merge preserves unrelated provider entries;
- revision conflict blocks apply;
- malformed remote or local JSON remains byte-for-byte unchanged;
- secret field in settings is rejected;
- permission and atomic replace behavior;
- rollback conflict and successful rollback;
- SSH argv construction has no local shell/string interpolation;
- streamed helper version handshake, provider filtering, and unsupported-envelope rejection.

### Integration tests

Use two temporary config homes and a fake SSH helper/process:

- remote DeepSeek → empty local;
- remote DeepSeek → local placeholder provider;
- selected provider missing;
- remote env reference unavailable locally;
- interrupted transfer before replace;
- failed post-write validation triggers rollback/no partial pair;
- successful apply leaves exactly `settings.json` and `auth.json` in `pigent/`.

### Package/source tests

- editable/source mode finds only a verified local payload;
- stale manifest is rejected;
- built wheel starts outside the repository;
- stale global `pipyter` is not accidentally used in scripted acceptance.

## Completion criteria

- The local config has a valid explicit DeepSeek default and selected provider entry.
- Original local files are recoverable from a private backup.
- No secret appears in Git status/diff, project `.pipyter`, logs, command arguments, browser reads, or plan artifacts.
- Local Pigent performs real model turns with AutoDL offline.
- Source and built-wheel paths both diagnose and load the intended Pigent payload.
