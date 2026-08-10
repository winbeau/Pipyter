# Pipyter Architecture Guide

## Product Goal

Pipyter provides a public web entry point for private compute workspaces.

- Public domain: `https://pipyter.icthub.top`
- Public control plane: `huawei-jump`
- Current compute node: `h100-server`
- User client: Windows Edge
- JupyterLab, kernels, terminals, project files, and BeauPi run on the compute node, not on `huawei-jump`.

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

The user then signs in at `pipyter.icthub.top`, opens the linked workspace, and uses the remote JupyterLab and BeauPi environment through the browser.

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
    ├── BeauPi runtime
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

It must not execute notebooks, run shells, mount user project directories, or host BeauPi tool execution. Provider API keys should not appear in gateway logs or browser URLs.

## Compute Runtime Responsibilities

The installed `pipyter` package on `h100-server` owns:

- registering the node and sending heartbeats;
- resolving a linked project directory;
- starting and stopping one workspace runtime;
- spawning Jupyter Server, kernels, terminals, and BeauPi;
- exposing one authenticated private runtime endpoint to `huawei-jump`;
- keeping notebook variables, GPU objects, figures, files, and agent context on the compute node;
- reconnecting existing browser sessions without restarting kernels unnecessarily.

Jupyter and BeauPi processes should listen on loopback or a protected private interface. Firewall access to the runtime endpoint must be limited to `huawei-jump`, and control-plane-to-runtime traffic must be authenticated.

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
5. Credentials are stored in the user config directory or OS keyring with restrictive permissions.

The CLI must never ask for the user's web password. Browser login may use any configured OAuth/OIDC provider; the CLI protocol remains Pipyter's device flow.

### Directory Binding

Account credentials and project metadata must be separate:

```text
~/.config/pipyter/credentials.json   # secret account/node credentials
<project>/.pipyter/project.toml      # non-secret project and workspace IDs
```

`pipyter project link .` binds the current directory to the signed-in account. Configuration lookup walks from the current directory toward the filesystem root; the nearest `.pipyter/project.toml` wins. This provides both project-level and nested directory-level bindings without placing access tokens in the repository.

A convenience form such as `pipyter auth login --project .` may perform login and linking together, but it must still keep secrets outside the project directory.

## Browser Access Flow

1. The user opens `https://pipyter.icthub.top` and signs in.
2. The control plane lists only projects and workspaces authorized for that account.
3. Opening a workspace creates or resumes a runtime session on its registered node.
4. The router maps a stable path such as `/w/<workspace-id>/` to the correct runtime.
5. JupyterLab HTTP requests and WebSocket streams are proxied to `h100-server`.
6. The Pipyter JupyterLab extension communicates with BeauPi through the runtime bridge on the same compute node.
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
├── engines/
│   ├── jupyterlab/          # IDE and compute engine
│   └── beaupi/              # Agent engine
├── src/pipyter/
│   ├── cli/                 # auth, project, node, up, down, doctor
│   ├── control/             # users, projects, nodes, sessions, routing metadata
│   ├── runtime/             # node agent, process manager, Jupyter and BeauPi lifecycle
│   ├── auth/                # browser, device, node, and runtime credentials
│   └── workspace/           # directory binding and workspace state
├── web/                     # public login and workspace selection UI
├── packages/
│   ├── lab-extension/       # Pipyter JupyterLab integration
│   ├── agent-panel/         # BeauPi browser panel
│   ├── context/             # notebook, kernel, file, figure, and terminal context
│   └── protocol/            # stable control-plane and runtime message contracts
├── services/
│   ├── gateway/             # authenticated HTTP/WebSocket routing on huawei-jump
│   └── runtime-bridge/      # Jupyter, kernel, and BeauPi integration on compute nodes
├── configs/
├── scripts/
├── tests/
├── docs/
├── THIRD_PARTY_LICENSES/
└── UPSTREAM.md
```

Create directories only when their implementation begins; do not add empty scaffolding.

## Dependency and Security Rules

- Keep Pipyter product logic outside `engines/` unless an engine itself must change.
- Do not couple BeauPi directly to JupyterLab internals. Use `packages/protocol/` and `services/runtime-bridge/`.
- The browser must never receive a reusable node credential or raw Jupyter server token.
- Control-plane sessions, node credentials, and workspace process credentials are separate and narrowly scoped.
- Validate the account, project, workspace, node, and path on every session creation or resume.
- Preserve Jupyter origin/CSRF protections and use secure, HTTP-only, same-site cookies at the public gateway.
- Agent permissions remain explicit: read, edit, execute, network, and dangerous operations.
- Provider secrets stay outside notebooks and tracked project files.
- Preserve JupyterLab BSD-3-Clause and BeauPi MIT notices, and record upstream snapshots in `UPSTREAM.md`.

## v0.1 Completion Path

Implement the shortest end-to-end path before Figure Studio or broad multi-user features:

1. Install the `pipyter` CLI/runtime package on `h100-server`.
2. Complete browser-approved `pipyter auth login`.
3. Link one directory to one account and project.
4. Register `h100-server` and report runtime health to `huawei-jump`.
5. Sign in at `pipyter.icthub.top` and see the linked workspace.
6. Start or resume JupyterLab and BeauPi on `h100-server`.
7. Proxy Jupyter HTTP and WebSocket traffic through `huawei-jump`.
8. Edit files, run a notebook cell, open a terminal, and stream a BeauPi response from Edge.
9. Disconnect and reconnect without losing the active kernel session.

After this path works, add Figure Studio, figure/code synchronization, advanced agent context, collaboration, and multi-node scheduling.

## Change Placement

- Public login, account, project, node, and routing behavior → control plane
- Jupyter, kernel, terminal, file, and BeauPi process behavior → compute runtime
- Browser integration → `web/`, `packages/lab-extension/`, or `packages/agent-panel/`
- Cross-process behavior → `packages/protocol/` plus the relevant bridge
- Generic Jupyter behavior → `engines/jupyterlab/`
- Generic BeauPi behavior → `engines/beaupi/`

For `engines/beaupi/`, work only on the `pipyter-dev` branch and never commit Pipyter changes directly to `main`. Follow each engine's local `AGENTS.md` before changing engine code.
