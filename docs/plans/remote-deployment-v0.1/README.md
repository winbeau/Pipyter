# Pipyter remote deployment v0.1

## Goal

Deliver the shortest secure path from the current single-machine Workspace runtime to:

```text
LAN browser
  -> Pi5 web gateway on a non-standard port
  -> direct private LAN TCP
  -> AutoDL Pipyter compute runtime
```

Then retain a clean upgrade path to:

```text
pipyter.icthub.top public control plane
  -> account/OIDC browser login
  -> Pipyter CLI device authorization
  -> node/workspace registry
  -> authenticated runtime routing
```

The first deployment proves one account, one Pi5 gateway, one AutoDL node and one running Workspace. It does not pretend that a directory prefix is a multi-user security boundary.

## Three supported access modes

The split deployment extends Pipyter; it does not replace the existing local product path.

| Mode | Frontend | Runtime/data plane | Entry point | Authentication boundary |
| --- | --- | --- | --- | --- |
| Local all-in-one | bundled portal on the same machine | same machine and OS user | `pipyter lab <workspace>` | loopback/local user; no remote Runtime token by default |
| LAN split | a LAN frontend host such as the user's machine or Pi5 | GPU server such as AutoDL | GPU: `pipyter node serve <workspace>`; frontend: static gateway | direct private TCP, source firewall and Runtime token |
| Public control plane | public jump host at `pipyter.icthub.top` | private GPU node | control/gateway service plus `pipyter node serve` | browser account session, device flow, node credential and authorized routing |

Compatibility rules:

1. `pipyter lab` remains the default local one-command path and continues to serve same-origin `/api` routes.
2. The bundled `runtime-config.js` defaults to a same-origin local Runtime, so installing split-deployment files cannot redirect local users.
3. Runtime token enforcement is opt-in for local `create_app()`/`pipyter lab`, but mandatory for a non-loopback `pipyter node serve` bind.
4. Node/Workspace selectors work in all modes. Local mode exposes one `Local Runtime / Current workspace` target; LAN/public modes supply additional authorized targets.
5. The public mode reuses the compute-node Runtime contract rather than changing Notebook, Shell or Pigent execution ownership.

## Phase 1 topology: Pi5 and AutoDL

```text
Browser on LAN
  |
  | HTTP + WebSocket
  | http://192.168.3.250:8080
  v
Pi5 nginx
  |-- /                       static Pipyter web build
  |-- /nodes/autodl/api/*     reverse proxy
  |
  |  direct LAN TCP; injects a Runtime Bearer credential
  v
AutoDL <private-lan-ip>:8765
  |
  `-- pipyter node serve <workspace> --host <private-lan-ip>
```

Decisions:

- Keep the browser on one origin. REST and WebSocket requests use the Pi5 origin.
- Do not expose the AutoDL Runtime API directly to the browser or public network.
- Route Pi5 directly to AutoDL's private LAN address; SSH is used only for deployment and maintenance.
- Restrict AutoDL port `8765` to the Pi5 source address with the host/network firewall, and still require the Runtime token.
- Give AutoDL a DHCP reservation or internal DNS name so the upstream address stays stable.
- Use nginx on Pi5 first because it is widely packaged and easy to inspect. A Caddy equivalent is provided for later VPS use.
- Use port `8080` on Pi5. Ports `80` and `443` remain unused.
- The Runtime token is injected by the gateway. It is never stored in frontend JavaScript, a URL, Workspace metadata, or Pigent provider configuration.

## CLI roles

```text
pipyter lab [PATH]
```

Local, interactive, single-machine development entry point. It serves the bundled frontend and Runtime API together and may open a browser.

```text
pipyter node serve PATH --host 127.0.0.1 --port 8765 --token-file PATH
```

Compute-node entry point for AutoDL and later nodes. It does not open a browser. A non-loopback bind requires an explicit Runtime token.

```text
pipyter admin
pipyter admin status
pipyter admin mode set single-user
pipyter admin mode set multi-user --users-root PATH
pipyter admin user add USER
pipyter admin user list
```

Deployment and user-layout administration. The no-subcommand form is interactive only on a real TTY; scripts use explicit subcommands.

## Mutually exclusive user modes

### Default: `single-user`

Normal installation remains:

```bash
uv tool install pipyter
```

The runtime executes as the installing/login OS user. Projects may be linked from arbitrary directories. Pigent model configuration remains exactly:

```text
${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/settings.json
${XDG_CONFIG_HOME:-~/.config}/pipyter/pigent/auth.json
```

No admin file is required for the implicit default. Writing admin configuration only makes the selected deployment mode explicit.

### Managed directory mode: `multi-user`

A configured users root contains one logical user directory per account:

```text
<users-root>/
  wenbiao_zhao/
    .pipyter/
      pigent/
        settings.json
        auth.json
      workspaces/
  zirui/
    .pipyter/
      pigent/
        settings.json
        auth.json
      workspaces/
```

For a managed user runtime, Pipyter supplies the trusted config-root override so Pigent still owns exactly two persistent model-configuration files under that user's Pipyter config root.

Mode rules:

1. `single-user` and `multi-user` are one enum, never two simultaneous flags.
2. Switching an initialized deployment is explicit and must not silently move or merge user data.
3. `pipyter lab`, `pipyter serve` and `pipyter up` are single-user commands and refuse to start while multi-user mode is active.
4. Multi-user Runtime startup requires `pipyter node serve --user <name>` and a Workspace inside that user's managed `workspaces/` root.
5. User names are validated and cannot contain path separators, `..`, or shell syntax.
6. Each runtime is pinned to one resolved user and Workspace root before startup.
7. Directory separation is organizational only when all runtimes share one Unix identity.
8. Public multi-user execution requires each Workspace to run as the matching OS user or container identity. Pigent Auto authority remains the runtime identity's real OS authority.

The control-plane admin configuration is global deployment metadata. It does not contain Provider API keys, account refresh tokens, node credentials, or Runtime proxy tokens.

## Credential domains

Pipyter keeps four credential purposes separate:

| Domain | Owner | Example storage | Never reused as |
| --- | --- | --- | --- |
| Browser/account session | public control plane | secure HttpOnly cookie / control DB | node or Provider credential |
| CLI account credential | Pipyter device flow | OS keyring or restricted control credential file | Provider credential |
| Node/runtime credential | node and gateway | restricted node/token file | browser or Provider credential |
| Provider credential | Pigent runtime user | `pipyter/pigent/auth.json` | account, node or proxy credential |

The CLI never asks for the user's web password. It requests a short-lived device code, opens or prints the browser verification URL, and polls until the browser-authorized account grants a scoped credential.

## Runtime HTTP and WebSocket security

When a Runtime token is configured:

- every public `/api/v1/*` HTTP request requires `Authorization: Bearer <token>`;
- every public Runtime WebSocket upgrade requires the same header;
- comparison is constant-time;
- invalid HTTP credentials return `401` without revealing token details;
- invalid WebSocket credentials close with policy code `1008` before acceptance;
- the private Pigent bridge keeps its own independent credential;
- CORS and WebSocket Origin allowlists are configurable, but neither replaces authentication.

The Pi5 gateway injects the Runtime authorization header for HTTP and WebSocket upgrade requests. The browser therefore receives no reusable AutoDL credential.

## Frontend runtime selection

The static web bundle loads a deployment-owned `runtime-config.js` before the React application. It contains non-secret routing metadata only:

```js
window.__PIPYTER_CONFIG__ = {
  nodes: [
    {
      id: "autodl",
      name: "AutoDL",
      apiBase: "/nodes/autodl",
      workspaces: [
        { id: "research", name: "Research workspace" }
      ]
    }
  ]
}
```

The Workspace page shows Node and Workspace selectors. Selecting a different target:

1. closes old Shell and Pigent WebSockets;
2. remounts target-bound stores;
3. uses one shared REST/WebSocket URL builder;
4. partitions persisted browser UI state by node/workspace key;
5. reconnects Workspace, Shell and Pigent against the selected API base.

`runtime-config.js` never carries Runtime, account, node, or Provider secrets. Each Workspace target must resolve to a unique API prefix because the v0.1 Runtime owns exactly one Workspace; duplicate prefixes are rejected instead of pretending a UI-only switch changed the backend. A configured `runtimeWorkspaceId` and Node ID are checked against `/api/v1/health` before the Workspace is opened. Remote targets set `allowDemo: false`, so 401/404/502 and routing failures appear as connection errors rather than fabricated demo data. In the public control-plane phase, the same UI model is populated from authenticated registry endpoints instead of a static file.

For v0.1, the portal is deployed at the origin root (`/`), with assets at `/assets/` and `runtime-config.js` at `/runtime-config.js`. Pi5 has a dedicated port and the public control plane has a dedicated domain, so a subpath deployment is intentionally out of scope rather than partially supported.

## Pigent settings in the web UI

The Settings page writes configuration through the selected Runtime:

```text
GET    /api/v1/pigent/config
PUT    /api/v1/pigent/config/model
GET    /api/v1/pigent/auth
PUT    /api/v1/pigent/auth/{provider_id}
DELETE /api/v1/pigent/auth/{provider_id}
```

Rules:

- model selection is persisted by the backend to that runtime user's `settings.json`;
- Provider endpoint and credentials are persisted by the backend to that runtime user's `auth.json`;
- raw keys/tokens are write-only and never returned to the browser;
- omitting a secret during an endpoint-only update preserves the existing secret;
- revision checks prevent silent clobbering by two browser tabs;
- all model/API calls originate from AutoDL, not from the Pi5 browser or gateway.

## Public VPS upgrade

Target topology:

```text
Browser
  -> pipyter.icthub.top
  -> public gateway/control plane
  -> authenticated node/workspace route
  -> compute Runtime
```

The public gateway owns:

- OAuth/OIDC browser login for `icthub.top` accounts;
- device-code creation and browser approval;
- accounts, projects, nodes, workspaces and ACLs;
- browser sessions, node registration, heartbeat and audit metadata;
- authenticated HTTP/WebSocket routing.

The compute node owns:

- project files, Notebook kernels and Shells;
- Pigent sessions and tools;
- user-specific `settings.json` and `auth.json`;
- outbound Provider API traffic.

### Non-80/443 constraint

A VPS origin can listen on `8080` for HTTP or `8443` for HTTPS. Direct URLs must include the port:

```text
http://host:8080
https://pipyter.icthub.top:8443
```

A portless `https://pipyter.icthub.top` necessarily reaches port `443` somewhere. If the VPS itself must not bind `443`, use an upstream edge such as Cloudflare on public `443` and proxy to the VPS origin on `8443`. Obtain the origin certificate with DNS-01 or an edge-managed origin certificate; HTTP-01/TLS-ALPN challenges normally require `80`/`443` on the origin.

## Deployment artifacts

```text
deploy/
  nginx/pipyter-lan.conf
  caddy/Caddyfile
  systemd/pipyter-node.service
  runtime-config.autodl.js
  README.md
```

No deployed secret is committed. Templates use placeholders or environment variables and deployment instructions create restrictive token files.

## Verification gate

Before Pi5/AutoDL deployment:

1. Python tests pass.
2. Web typecheck and production build pass.
3. Local unauthenticated `pipyter lab` still works on loopback.
4. Token-protected Runtime HTTP rejects missing/bad tokens and accepts the correct token.
5. Token-protected Shell/Pigent WebSocket upgrades reject missing credentials.
6. Frontend REST and WebSocket URL builders preserve the selected API base.
7. Node/Workspace switching remounts target-bound state.
8. Provider API responses never contain submitted keys/tokens.
9. Control/node credentials remain separate from `pigent/auth.json`.

Remote completion then requires:

1. `http://192.168.3.250:8080` loads the Pi5 static frontend.
2. `/nodes/autodl/api/v1/health` reaches AutoDL directly over the private LAN.
3. File read/write, a Notebook cell, persistent Shell and Pigent event stream work through nginx.
4. Restarting the AutoDL Runtime recovers without changing the browser URL; no SSH data tunnel is involved.
