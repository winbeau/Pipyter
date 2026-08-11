# PyPI payload, build and release strategy

## Goal

Make the recommended user command `uv tool install pipyter` install all Pigent product code and runtime assets needed by Pipyter from one PyPI distribution, without requiring a separate global npm package, running npm lifecycle scripts on the user’s machine, or downloading executable code on first launch. Conventional `pip install pipyter` remains a supported packaging/clean-environment path.

## Recommended first release

Ship one portable `pipyter` sdist/wheel containing:

- Python Pigent supervisor, bridge, policies, and protocol models;
- tracked first-party `packages/pigent/` TypeScript source in the sdist;
- a generated production Node runtime payload in both sdist and wheel;
- exact runtime manifest and file hashes;
- required JavaScript/WASM assets;
- metadata/notices required by external bundled dependencies.

Require system Node.js `>=22.19.0` for Pigent execution. Keep the wheel `py3-none-any` only if the final payload contains no platform-specific native modules.

This is the shortest reliable way to satisfy “Pigent ships with the PyPI package” while preserving cross-platform Python packaging. Python package metadata cannot install Node itself, so `pipyter doctor` must make the prerequisite explicit.

Recommended user lifecycle:

```text
uv tool install pipyter
uv tool upgrade pipyter
uv tool uninstall pipyter
```

The isolated uv tool environment is disposable; user configuration remains under `${XDG_CONFIG_HOME:-~/.config}/pipyter/` and survives upgrades/reinstallation.

## Why not bundle a standalone binary first

A Bun/standalone executable would remove the Node prerequisite, but it changes `pipyter` from one universal wheel into a release matrix:

```text
linux x86_64
linux arm64
macOS x86_64
macOS arm64
Windows x86_64
Windows arm64 (if supported)
```

It also requires platform wheel tags, binary signing/notarization decisions, larger artifacts, and source-install behavior for unsupported targets. Treat this as a later optimization after the host protocol and release pipeline are stable.

## Tracked first-party Pigent workspace

`packages/pigent/` contains the directly copied and then productized AI, Agent, runtime, and host source described in [BeauPi first-party code embedding](08-beaupi-first-party-embedding.md).

Release requirements:

- committed package lock for external npm dependencies;
- local workspace links only among `@pipyter/pigent-ai`, `@pipyter/pigent-agent`, `@pipyter/pigent-runtime`, and `@pipyter/pigent-host`;
- no dependency, file link, import, or build read from `engines/beaupi`;
- runtime identity configured as Pigent;
- no postinstall migration;
- no project extension auto-discovery;
- no TUI/native clipboard requirement;
- build succeeds when `engines/` is absent.

`engines/beaupi` remains an ignored local source/reference directory. The direct copy happens during implementation, never during package build or user installation.

## Runtime payload build

Add `scripts/build-pigent-runtime.mjs` or an equivalent deterministic script.

Suggested build flow:

1. Remove the staging directory.
2. Validate Node version.
3. Run the locked install under `packages/pigent/` with lifecycle scripts disabled:

   ```text
   npm ci --omit=optional --ignore-scripts
   ```

4. Typecheck/test retained first-party packages and build the Pigent host entrypoint.
5. Bundle/copy only runtime-reachable JavaScript, JSON, WASM, worker files, and required external dependency metadata.
6. Remove tests, examples, source maps, TUI/CLI assets, docs not used at runtime, package-manager caches, and optional native modules.
7. Reject every `.node`, unexpected executable, escaping symlink, credential/config file, `engines/` path, and unreviewed binary unless the release intentionally switches to platform wheels.
8. Generate `manifest.json` with Pipyter/Pigent/protocol versions, Node minimum, file hashes, and reproducible build metadata.
9. Run a host handshake smoke test from outside the repository with `engines/` unavailable.
10. Copy staging to a generated build artifact consumed by Hatchling.

Do not run any copied standalone `postinstall.mjs` or config migration behavior during Pipyter build/install.

## Payload layout in the wheel

```text
pipyter/
├── pigent/
└── _vendor/
    └── pigent/
        ├── manifest.json
        ├── host.mjs
        ├── package.json
        ├── node_modules/ or bundled chunks
        └── dependency-manifest.json
```

Use `importlib.resources` to locate assets; never assume a source checkout path.

`manifest.json` example:

```json
{
  "runtime": "pigent-host",
  "runtime_version": "0.1.0",
  "pipyter_version": "0.2.0",
  "source_package": "packages/pigent",
  "host_protocol_version": "0.1",
  "tool_protocol_version": "0.1",
  "node_min": "22.19.0",
  "portable": true,
  "files": {
    "host.mjs": "sha256:..."
  }
}
```

The manifest describes the shipped first-party Pigent payload and has no external BeauPi engine requirement.

## Hatchling changes

Extend `pyproject.toml` wheel/sdist force-includes for the generated payload. Keep the generated location distinct from hand-written `src/pipyter` source so stale artifacts are detectable.

Conceptually:

```toml
[tool.hatch.build.targets.sdist]
include = [
  "/src",
  "/packages/protocol",
  "/packages/pigent",
  "/README.md",
  "/LICENSE",
]

[tool.hatch.build.targets.sdist.force-include]
"build/pigent-runtime" = "src/pipyter/_vendor/pigent"

[tool.hatch.build.targets.wheel.force-include]
"build/pigent-runtime" = "pipyter/_vendor/pigent"
```

Exact paths may differ based on the build hook. The build must fail if the payload or manifest is absent/mismatched for a release build.

The uploaded sdist must already contain the generated payload so downstream `pip install` from sdist does not need npm or network access. A PEP 517 build from the released sdist should only copy/verify it.

## Python entrypoints

Keep the existing:

```toml
pipyter = "pipyter.cli.main:main"
```

Add a thin launcher from the same wheel:

```toml
pigent = "pipyter.pigent.cli:main"
```

Recommended commands:

```text
pigent --version
pigent doctor
pigent rpc --workspace <path>   # developer/headless integration
```

Normal users still launch `pipyter lab`; Pipyter starts Pigent lazily. The separate console script makes the unified product name visible and gives packaging diagnostics a direct entrypoint without publishing another PyPI project.

Do not expose copied standalone `beaupi` or `pi` binaries from the Pipyter wheel; ship only the Pigent entrypoint.

## Runtime discovery

`pipyter.pigent.resources` should:

1. locate `manifest.json` with `importlib.resources`;
2. verify required files/hashes when requested by doctor/release smoke;
3. resolve Node in this order:
   - explicit trusted `PIGENT_NODE` setting;
   - configured Pipyter runtime setting;
   - `node` on PATH;
4. execute `node --version` without a shell;
5. reject versions below the manifest minimum;
6. construct argv as a list, never a shell command string;
7. set the host package directory explicitly.

Do not auto-download Node or silently use a user-local binary workaround when the prerequisite is absent.

## Optional dependency behavior

Pigent assets can ship in the base wheel while runtime activation remains optional:

- `pipyter lab` and non-Agent Workspace APIs work without Node;
- the Pigent page/panel reports unavailable with the exact doctor finding;
- first Agent session starts only when Node and payload pass health checks;
- no import of Pigent should slow basic CLI commands materially.

A Python extra such as `pipyter[pigent]` does not solve the Node prerequisite and would misleadingly imply that pip can install it. Do not use an extra solely for branding.

## Source and versioning

- `src/pipyter/_version.py` remains the Pipyter release source of truth.
- Pigent host uses the same product release version or records an explicit host version in its manifest.
- copied first-party Pigent packages normally share the Pipyter product release version or an explicitly recorded internal runtime version.
- Tool/host/event protocol versions are independent from the Python package version.
- Any incompatible public Pigent protocol change requires a protocol version bump and compatibility decision.
- Update `CHANGELOG.md`, runtime manifest, package lock, and package version in the same release change.

## Naming and configuration migration

The embedded runtime must use:

```text
${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json
${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/auth.json
<workspace>/.pipyter/pigent/     # sessions/tasks/events/artifacts, never model credentials
PIGENT_*
```

`settings.json` owns the explicit default provider/model and non-secret provider protocol/model definitions. `auth.json` owns provider API base URLs, secret headers, and API-key/OAuth credentials. Initialize directories as `0700` and both files as `0600`, with locking and atomic writes.

Do not create, load, package, migrate, or document `models.json` or `models-store.json`. The host passes `modelsPath: null` and uses an in-memory model store. Model choice must not come from a CLI flag, ambient model variable, browser local storage, project config, or previous session; UI changes persist through the backend into `settings.json`. See [User installation and Pigent model configuration](09-user-install-model-config.md).

It must not automatically read or overwrite:

```text
~/.beaupi/
~/.pi/
.beaupi/
.pi/
BEAUPI_*
PI_CODING_AGENT_DIR
```

Do not add a first-run importer. If users later need old standalone BeauPi/Pi credentials or sessions, any explicit migration command must preview the transformation and copy only compatible `settings.json`/`auth.json` fields. Never silently merge stores because credentials, trusted extensions, project policy, model caches, and session formats differ.

## First-party source and external dependencies

The copied BeauPi implementation is first-party Pipyter/Pigent code and requires no separate engine package, copyright review phase, upstream synchronization gate, or BeauPi-specific release artifact.

Continue to record the package/version metadata required for external npm/Python runtime dependencies and JupyterLab integration, but keep that work separate from the first-party code-copy migration.

## Release checks

### Python and protocol

- `uv run pytest`
- protocol fixture/schema validation in Python and TypeScript
- CLI doctor/status/runtime tests
- Pigent bridge/session identity/mode/revision tests

### TypeScript host

- host typecheck
- focused unit tests for tool adapters, mode schema projection, result conversion, and JSONL framing
- copied runtime/session compatibility tests inside `packages/pigent/`

### Payload

- build from a clean staging directory
- `npm ci --omit=dev --omit=optional --ignore-scripts`
- no lifecycle scripts executed
- no `.node` files for a universal wheel
- no user credentials, generated `settings.json`/`auth.json`, sessions, model stores/caches, `.beaupi`, `.pi`, `engines/`, or repository-local absolute paths
- all manifest hashes match
- runtime starts from outside the source tree with no global npm package

### Wheel/sdist

- `uv build`
- inspect both archives
- verify Pigent payload, schemas, dependency manifest, and entrypoints
- verify no `__pycache__`, source credentials, logs, or unreviewed native binaries
- install wheel into a clean venv with Node present
- install sdist into a clean venv with npm/network unavailable
- run a separate `uv tool install` smoke from the built wheel/sdist index
- smoke:

  ```text
  pipyter --version
  pigent --version
  pipyter doctor <workspace>
  pigent doctor
  pipyter lab --no-browser
  ```
- verify first config initialization creates only `pigent/settings.json` and `pigent/auth.json` with restrictive permissions
- verify upgrade preserves valid config byte-for-byte and startup never creates `models.json`/`models-store.json`

- start host handshake and execute a fake-provider deterministic tool flow

### Missing-Node smoke

In a clean PATH without Node:

- `pipyter doctor` reports `pigent_node_ok: false` and the required version;
- `pipyter lab` still serves non-Agent Workspace functionality;
- Agent session creation returns a clear service-unavailable response;
- no npm/download fallback is attempted.

### Cross-platform matrix

At minimum:

- Ubuntu x86_64;
- macOS arm64;
- Windows x86_64;
- Python 3.10 through 3.13 in the supported matrix;
- Node 22 minimum and current supported LTS/current version.

If the supposedly portable payload fails because of native runtime requirements, stop and switch the packaging plan to platform-specific wheels rather than shipping a mislabeled `py3-none-any` wheel.

## Future standalone-binary path

After v0.1 is stable:

1. compile `pigent-host` as platform binaries;
2. produce platform-tagged `pipyter` wheels containing the matching binary;
3. keep one sdist with source and deterministic build documentation;
4. select the binary through the same manifest/resources API;
5. remove the external Node prerequisite only after every supported platform has a verified artifact.

The Python bridge/public protocol should not change during this packaging transition.

## Publication stop condition

Build and local-release verification are allowed as implementation work. Uploading to TestPyPI or PyPI requires explicit user approval and a new version; PyPI versions cannot be overwritten.
