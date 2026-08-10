# Pipyter

AI-native scientific workspace built around Jupyter, remote compute, and agent-assisted research workflows.

## Repository layout

- `web/` — standalone React + TypeScript portal.
- `scripts/` — local development helpers.
- `AGENT.md` — architecture and contribution guidance.
- `draft.md` — current product and interaction draft.
- `engines/` — local upstream JupyterLab and BeauPi checkouts; intentionally ignored by this repository.

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
pnpm build
```
