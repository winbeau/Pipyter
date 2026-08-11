# Pipyter Architecture Guide

## Product Goal

Pipyter provides a public web entry point for private compute workspaces.

The product-facing Agent name is **Pigent**. `engines/beaupi/` is an ignored local first-party source/reference tree; implementation code is copied into tracked `packages/pigent/` and then maintained directly by Pipyter. The implementation plan is in `docs/plans/pigent-v0.1/`.

- Public domain: `https://pipyter.icthub.top`
- Public control plane: `huawei-jump`
- Current compute node: `h100-server`
- User client: Windows Edge
- JupyterLab, kernels, Shell sessions, project files, and Pigent run on the compute node, not on `huawei-jump`.

The intended experience is:

```bash
uv tool install pipyter       # preferred CLI installation
# or: uv add pipyter
# or: pip install pipyter

pipyter auth login
cd /path/to/project
pipyter project link .
pipyter up .
```

The user then signs in at `pipyter.icthub.top`, opens the linked workspace, and uses the remote JupyterLab and Pigent environment through the browser.

## Deployment Topology

```text
Windows Edge
     │
     │ HTTPS / WebSocket
     ▼
pipyter.icthub.top
     │
     ▼
huawei-jump
├── TLS ingress
├── Web portal
├── Account and device login
├── Project / workspace registry
├── Node and session registry
└── Authenticated HTTP/WebSocket router
     │
     │ private network, preferably direct and persistent
     ▼
h100-server
└── Pipyter Runtime
    ├── Node agent and heartbeat
    ├── Workspace process manager
    ├── Jupyter Server / JupyterLab
    ├── Kernels and terminals
    ├── tracked/bundled Pigent runtime
    ├── Runtime bridge
    └── Project files and local secrets
```

`huawei-jump` is the **control plane and gateway**. `h100-server` is the **runtime and data plane**.

Because `huawei-jump` can reach `h100-server`, v0.1 should use direct private TCP routing from the gateway to the runtime. Do not build a custom tunnel first. Add an outbound persistent mTLS tunnel only for future compute nodes that cannot accept private inbound connections.

## Control Plane Responsibilities

The public service on `huawei-jump` owns:

- browser account login and session cookies;
- CLI device authorization for `pipyter auth login`;
- users, projects, workspaces, node registrations, and access control;
- workspace discovery and authenticated routing;
- runtime health, session state, and audit metadata;
- the public portal and static control-plane assets.

It must not execute notebooks, run Shells, mount user project directories, or host Pigent tool execution. Provider API keys should not appear in gateway logs or browser URLs.

## Compute Runtime Responsibilities

The installed `pipyter` package on `h100-server` owns:

- registering the node and sending heartbeats;
- resolving a linked project directory;
- starting and stopping one workspace runtime;
- spawning Jupyter Server, kernels, persistent Shell sessions, and Pigent;
- exposing one authenticated private runtime endpoint to `huawei-jump`;
- keeping notebook variables, GPU objects, figures, files, and agent context on the compute node;
- reconnecting existing browser sessions without restarting kernels unnecessarily.

Jupyter and Pigent processes should listen on loopback or a protected private interface. Firewall access to the runtime endpoint must be limited to `huawei-jump`, and control-plane-to-runtime traffic must be authenticated.

## Account, Project, and Directory Binding

Use four explicit objects:

```text
Account   Pipyter web identity
Node      Registered compute server, such as h100-server
Project   Account-owned logical project and access policy
Workspace A project directory running on one node
```

### Device Login

`pipyter auth login` should use a device-authorization flow similar to GitHub CLI and Tailscale:

1. The CLI requests a short-lived device code from `pipyter.icthub.top`.
2. It prints a verification URL and code, and may open Edge automatically.
3. The user signs in and approves the compute-node login in the browser.
4. The CLI polls until approval and receives a scoped refresh credential.
5. Account/node credentials are stored in the OS keyring or a separately scoped restrictive control-plane credential backend; they are never stored in Pigent's provider `auth.json`.

The CLI must never ask for the user's web password. Browser login may use any configured OAuth/OIDC provider; the CLI protocol remains Pipyter's device flow.

### Directory Binding

Account credentials, Pigent provider configuration, and project metadata must remain separate:

```text
OS keyring / scoped control credential backend     # secret Pipyter account/node credentials
~/.config/pipyter/pigent/settings.json             # provider/model choice and non-secret protocol/model definitions
~/.config/pipyter/pigent/auth.json                 # provider API address and API-key/OAuth credentials
<project>/.pipyter/project.toml                    # non-secret project and workspace IDs
```

Respect `XDG_CONFIG_HOME` when set. Pigent creates only `settings.json` and `auth.json` in its user config directory, uses `0700/0600` permissions, and must not create/read `models.json`, `models-store.json`, project model settings, or standalone `.beaupi`/`.pi` user state. Model choice comes from `settings.json.defaultProvider/defaultModel`; provider API address and credential availability come from `auth.json`. Browser/session/CLI/environment state cannot become an independent model-selection or endpoint authority.

`pipyter project link .` binds the current directory to the signed-in account. Configuration lookup walks from the current directory toward the filesystem root; the nearest `.pipyter/project.toml` wins. This provides both project-level and nested directory-level bindings without placing access tokens in the repository.

A convenience form such as `pipyter auth login --project .` may perform login and linking together, but it must still keep secrets outside the project directory.

## Browser Access Flow

1. The user opens `https://pipyter.icthub.top` and signs in.
2. The control plane lists only projects and workspaces authorized for that account.
3. Opening a workspace creates or resumes a runtime session on its registered node.
4. The router maps a stable path such as `/w/<workspace-id>/` to the correct runtime.
5. JupyterLab HTTP requests and WebSocket streams are proxied to `h100-server`.
6. The Pipyter Workspace communicates with Pigent through the runtime bridge on the same compute node.
7. Kernel execution, shell commands, file edits, and agent tools happen on `h100-server`; only UI data and streamed results cross the gateway.

The runtime session must remain pinned to one compute node and project directory. Reconnecting the browser must not silently move it to another node.

## Low-Latency Rules

- Prefer direct private routing from `huawei-jump` to `h100-server` over SSH-per-request or nested reverse proxies.
- Maintain long-lived HTTP and WebSocket connections; never create an SSH process for each browser request.
- Disable proxy buffering for terminals, kernels, events, and agent streaming.
- Preserve WebSocket binary frames and configure long idle timeouts for notebook and terminal sessions.
- Cache versioned JupyterLab static assets at the browser or public gateway, while keeping dynamic APIs uncached.
- Keep TLS termination on `huawei-jump`; use authenticated private transport or mTLS to the runtime.
- Prefer direct DNS to `huawei-jump` for dynamic workspace traffic. Use a CDN only for immutable static assets if an extra proxy hop increases interactive latency.
- Measure browser-to-gateway and gateway-to-runtime latency separately before optimizing application code.

## Repository Responsibilities

```text
Pipyter/
├── engines/                 # ignored local source/reference checkouts only
│   ├── jupyterlab/
│   └── beaupi/
├── src/pipyter/
│   ├── cli/                 # auth, project, node, up, down, doctor
│   ├── control/             # users, projects, nodes, sessions, routing metadata
│   ├── runtime/             # node agent, process manager, Jupyter and Pigent lifecycle
│   ├── auth/                # browser, device, node, and runtime credentials
│   └── workspace/           # directory binding and workspace state
├── web/                     # public login and workspace selection UI
├── packages/
│   ├── lab-extension/       # Pipyter JupyterLab integration
│   ├── pigent/             # copied first-party AI/Agent/runtime/host source
│   ├── agent-panel/         # deprecated name; migrate UI to web/src/pigent
│   ├── context/             # notebook, kernel, file, figure, and terminal context
│   └── protocol/            # stable control-plane and runtime message contracts
├── services/
│   ├── gateway/             # authenticated HTTP/WebSocket routing on huawei-jump
│   └── runtime-bridge/      # Jupyter, Kernel, Shell, and Pigent integration on compute nodes
├── configs/
├── scripts/
├── tests/
├── docs/
├── THIRD_PARTY_LICENSES/
└── UPSTREAM.md
```

Create directories only when their implementation begins; do not add empty scaffolding.

## Dependency and Security Rules

- Keep `engines/` ignored and out of normal build/runtime inputs.
- Copy BeauPi first-party code into tracked `packages/pigent/`, then modify that copy directly; do not depend on, patch around, or load the ignored checkout.
- Do not couple Pigent directly to JupyterLab internals. Use `packages/protocol/` and Python runtime services.
- The browser must never receive a reusable node credential or raw Jupyter server token.
- Control-plane sessions, node credentials, and workspace process credentials are separate and narrowly scoped.
- Validate the account, project, workspace, node, and path on every session creation or resume.
- Preserve Jupyter origin/CSRF protections and use secure, HTTP-only, same-site cookies at the public gateway.
- Ask and Plan remain non-mutating; Auto executes with the same practical authority as the Runtime OS user. Multi-user isolation belongs to OS/container identities, not command parsing.
- Provider secrets stay outside notebooks and tracked project files; Pigent model/API configuration is limited to `${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json` and `auth.json`.
- Preserve requirements for JupyterLab and external dependencies; BeauPi-derived Pigent code is maintained as first-party Pipyter source.

## v0.1 Completion Path

Implement the shortest end-to-end path before Figure Studio or broad multi-user features:

1. Install the `pipyter` CLI/runtime package on `h100-server`.
2. Complete browser-approved `pipyter auth login`.
3. Link one directory to one account and project.
4. Register `h100-server` and report runtime health to `huawei-jump`.
5. Sign in at `pipyter.icthub.top` and see the linked workspace.
6. Start or resume JupyterLab and bundled Pigent on `h100-server`.
7. Proxy Jupyter HTTP and WebSocket traffic through `huawei-jump`.
8. Edit files, run a Notebook cell, open a persistent Shell, and stream a Pigent response from Edge.
9. Disconnect and reconnect without losing the active Kernel, Pigent session/event cursor, or persistent Shell sessions.

After this path works, add Figure Studio, figure/code synchronization, advanced agent context, collaboration, and multi-node scheduling.

## Change Placement

- Public login, account, project, node, and routing behavior → control plane
- Jupyter, Kernel, Shell, file, and Pigent process behavior → compute runtime
- Browser Pigent integration → `web/src/pigent/` plus Workspace components
- Agent/model/session/orchestration behavior → tracked `packages/pigent/`
- Cross-process behavior → `packages/protocol/` plus the relevant Python bridge
- Generic installed Jupyter behavior → installed JupyterLab/Pipyter adapters
- Ignored `engines/` trees → manual source/reference only, never normal implementation targets

## Release and Publishing (PyPI)

### Versioning

- The single source of truth is `src/pipyter/_version.py` (e.g. `__version__ = "0.1.0"`).
- PyPI does not allow re-uploading an already published version: bump the version for every release.
- Keep the changelog and the version bump in the same commit.

### Preflight checklist

1. `uv run pytest` — the full suite must pass.
2. Build/typecheck tracked `packages/pigent/` and verify it succeeds with `engines/` absent.
3. `cd web && pnpm typecheck && pnpm build` — the portal build lands in ignored `src/pipyter/static`, which Hatchling includes in release artifacts.
4. Build the deterministic Pigent Node payload from tracked source.
5. `uv build` — creates the sdist and wheel.
6. Inspect both archives: they must contain Python modules, protocol schemas, web static assets, Pigent payload/manifest, both entrypoints, and no `engines/`, caches, sessions, credentials, user model config, or `__pycache__`.
7. Install the wheel into a clean venv and smoke-test `pipyter --version`, `pigent --version`, and `pipyter doctor .`.
8. Run a separate `uv tool install pipyter` smoke from the built distribution and verify first config initialization creates only `pigent/settings.json` and `pigent/auth.json`.

### Publishing

- The PyPI API token is stored outside the repository at `~/.config/pipyter/pypi-token` (mode `0600`). Never write it into project metadata, notebooks, browser URLs, frontend state, command history, or logs.
- Publish with uv; the token is read from the environment only, never placed on the command line:

  ```bash
  cd /home/winbeau/Projects/Pipyter
  uv build
  UV_PUBLISH_TOKEN="$(cat ~/.config/pipyter/pypi-token)" uv publish
  ```

- Optional rehearsal on TestPyPI before the real upload:

  ```bash
  UV_PUBLISH_TOKEN="$(cat ~/.config/pipyter/pypi-token)" uv publish --publish-url https://test.pypi.org/legacy/
  ```

- Stop condition: do not publish to PyPI without explicit user approval.

### Post-release verification

Recommended user-path smoke:

```bash
uv tool install --force pipyter
pipyter --version
```

Packaging-path smoke:

```bash
python3 -m venv /tmp/pipyter-check && /tmp/pipyter-check/bin/pip install pipyter
/tmp/pipyter-check/bin/pipyter --version
```

- Confirm the release exists at `https://pypi.org/project/pipyter/<version>/`.
- If the token was ever shared in chat or logs, rotate it at PyPI → Account settings → API tokens.
