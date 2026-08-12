# Pipyter

AI-native scientific workspace built around Jupyter, remote compute, and agent-assisted research workflows.

## Repository layout

- `web/` — standalone React + TypeScript portal.
- `scripts/` — local development helpers.
- `AGENT.md` — architecture and contribution guidance.
- `draft.md` — current product and interaction draft.
- `engines/` — ignored local source/reference checkouts; normal build/runtime code must not depend on them.
- `packages/pigent/` — tracked first-party Pigent AI/Agent/runtime/host source maintained directly in Pipyter.

## Architecture plans

- [Workspace v0.1](docs/plans/workspace-v0.1/README.md)
- [Pigent v0.1](docs/plans/pigent-v0.1/README.md) — ten Agent tools, Ask/Plan/Auto, full runtime-user execution, Pigent/Shell design migration, first-party BeauPi code embedding, and PyPI packaging
- [Pigent modern Web Agent v0.2](docs/plans/pigent-modern-v0.2/README.md) — local DeepSeek migration, tool-ui-derived interaction surfaces, trustworthy session UX, and temporary/maintained uv Kernel environments
- [Remote deployment v0.1](docs/plans/remote-deployment-v0.1/README.md) — Pi5 gateway, direct LAN AutoDL Runtime, non-80/443 reverse proxying, Runtime selection, and mutually exclusive user modes

## User installation

```bash
uv tool install pipyter
pipyter --version
```

`uv tool install` is the recommended user-level path. Pigent ships in the same PyPI distribution; it does not require a global npm/BeauPi package or first-launch code download. Pigent execution currently requires Node.js `>=22.19`, while ordinary Workspace features remain usable when Node is unavailable.

Pigent model/API configuration uses exactly:

```text
~/.config/pipyter/pigent/settings.json
~/.config/pipyter/pigent/auth.json
```

`settings.json` selects providers/models and stores non-secret model/protocol definitions; `auth.json` stores API-key/OAuth credentials. Pipyter does not use `models.json`, `models-store.json`, or automatically inherit `~/.beaupi/` configuration. `XDG_CONFIG_HOME` is respected when set.

To migrate only a trusted SSH host's selected DeepSeek provider without printing credentials:

```bash
pigent config migrate-ssh --source <trusted-ssh-alias> --provider deepseek --preview
pigent config migrate-ssh --source <trusted-ssh-alias> --provider deepseek --apply
```

The modern Pigent UI is served by `pipyter lab` on `http://127.0.0.1:8895` by default. It provides live optimistic messages and Stop/Abort, interaction receipts, shared Dedicated/Workspace ToolSurfaces, searchable/paged sessions, artifacts, and private temporary/maintained uv Kernel environments under the Pipyter config root.

## Web development

```bash
cd web
pnpm install
pnpm dev
```

Verification:

```bash
cd web
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```
