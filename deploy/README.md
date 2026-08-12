# Pipyter Pi5 + AutoDL deployment

This is the **LAN split** deployment. It coexists with:

- local all-in-one: `pipyter lab <workspace>`;
- public control plane: jump-host frontend/router plus the same compute-node Runtime contract.

The LAN data path is direct TCP:

```text
Browser -> Pi5:8080 nginx -> AutoDL-private-IP:8765
```

SSH is used only to install, update and inspect AutoDL. It is not in the interactive HTTP/WebSocket path.

## 1. AutoDL compute node

Prerequisites already expected on AutoDL:

- Node.js 24
- `uv`
- a Pi5-reachable private LAN address

Install Pipyter from a checked-out repository or released package:

```bash
uv tool install --force pipyter
```

Create and link one Workspace:

```bash
mkdir -p ~/pipyter-workspaces/research
cd ~/pipyter-workspaces/research
pipyter project link . --name research
```

Create a Runtime token without putting it on a command line:

```bash
mkdir -p ~/.config/pipyter
umask 077
openssl rand -base64 48 | tr -d '\n' > ~/.config/pipyter/runtime-token
printf '\n' >> ~/.config/pipyter/runtime-token
chmod 600 ~/.config/pipyter/runtime-token
```

Start the first foreground smoke test. Replace the address with AutoDL's private LAN address:

```bash
pipyter node serve ~/pipyter-workspaces/research \
  --host 192.168.3.X \
  --port 8765 \
  --node-id autodl \
  --token-file ~/.config/pipyter/runtime-token \
  --allowed-origin http://192.168.3.250:8080
```

Limit TCP port `8765` to Pi5 (`192.168.3.250`) with the host firewall or network security policy. Do not expose it to the public Internet.

For a persistent user systemd service:

```bash
mkdir -p ~/.config/systemd/user ~/.config/pipyter
cp deploy/systemd/pipyter-node.service ~/.config/systemd/user/
cp deploy/node.env.example ~/.config/pipyter/node.env
# edit node.env with the real workspace and private address
systemctl --user daemon-reload
systemctl --user enable --now pipyter-node.service
```

If the AutoDL image does not run user systemd, use its process supervisor or a dedicated tmux session as a temporary fallback. The service command remains `pipyter node serve`, not `pipyter lab`.

## 2. Pi5 web gateway

Build the web portal on the development machine:

```bash
cd web
pnpm install --frozen-lockfile
pnpm build
```

Copy `src/pipyter/static/` to Pi5 `/opt/pipyter/web/`, then replace its `runtime-config.js` with `deploy/runtime-config.autodl.js`. Replace `runtimeWorkspaceId` with the `workspace_id` printed by `pipyter project link`; the frontend verifies the node/workspace identity returned by `/api/v1/health`.

Render `deploy/nginx/pipyter-lan.conf` by replacing:

- `__AUTODL_LAN_ADDRESS__` with AutoDL's private LAN address;
- `__PIPYTER_RUNTIME_TOKEN__` with the exact contents of AutoDL's restricted token file.

Install the result as an nginx site and listen on port `8080`. The Runtime token belongs only in the root-readable gateway configuration and AutoDL token file; never put it in `runtime-config.js` or browser storage. Provider keys can be submitted from HTTP compatibility mode, but the browser-to-Pi5 segment is unencrypted and the UI must display that warning. Pi5-to-AutoDL remains protected by the configured upstream transport.

Check configuration and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Open:

```text
http://192.168.3.250:8080/#/workspace
```

For confidential Provider-key transport, use the alternative `deploy/nginx/pipyter-lan-https.conf` on `8443` with a certificate trusted by the client device, or use `deploy/caddy/Caddyfile.https` with Caddy's internal CA and install that CA on the client. Update the node's allowed origin to:

```text
https://192.168.3.250:8443
```

Then open:

```text
https://192.168.3.250:8443/#/settings
```

Neither TLS option binds ports `80` or `443`.

## 3. Low-latency settings

The nginx template already enables the important interactive settings:

- direct private TCP instead of SSH tunneling;
- upstream keepalive;
- HTTP/1.1 WebSocket upgrade;
- proxy buffering disabled;
- request buffering disabled;
- one-hour read/send timeout for Shell and Pigent streams;
- TCP keepalive and a short connect timeout.

Use a DHCP reservation or internal DNS record for AutoDL so nginx does not depend on a changing address.

## 4. Verification

From Pi5, first verify direct reachability with the Runtime credential:

```bash
curl -fsS -H "Authorization: Bearer $PIPYTER_RUNTIME_TOKEN" \
  http://AUTODL_LAN_ADDRESS:8765/api/v1/health
```

Then verify the browser-facing route:

```bash
curl -fsS http://127.0.0.1:8080/nodes/autodl/api/v1/health
```

Finally test through the browser:

1. Workspace file listing and save.
2. Notebook cell execution.
3. Persistent Shell input/output and reconnect.
4. Pigent session/event stream.
5. Provider/model save works on both HTTP `:8080` and trusted HTTPS `:8443`; HTTP displays the unencrypted first-hop warning, while HTTPS does not. The raw key must never be returned by a GET response.

## 5. Public VPS later

Use the same same-origin routing model on `8080` or `8443`. A direct `https://pipyter.icthub.top:8443` URL includes the port. If users must open a portless HTTPS URL while the VPS itself cannot bind `443`, terminate public `443` at an upstream edge and forward to the VPS origin on `8443`.
