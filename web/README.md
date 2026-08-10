# Pipyter Web Portal

The portal is a standalone Vite + React + TypeScript application managed from `web/` with pnpm. It contains its own package metadata, lockfile, install configuration, TypeScript configuration, and all UI implementation required at build time.

## React design integration

All UI from the eight repository-level `design/*.dc.html` prototypes is represented by native TSX:

- Five full page views live in `src/design/pages/*Design.tsx`.
- Interactive state lives in `src/pages/*Page.tsx` using React `useState`.
- The application shell from `Pipyter Final.dc.html` lives in `src/App.tsx` and `src/components/NavigationRail.tsx`.
- The standalone Workspace and Figure Studio prototypes are composed from that shared shell and their page components.

There are no copied `.dc.html` files, no imports from the former root `design/` directory, no `dangerouslySetInnerHTML`, and no runtime design-template parser. The original design directory has been removed after the React migration. See `src/design/README.md` for the complete mapping.

## Commands

Run from `web/`:

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```
