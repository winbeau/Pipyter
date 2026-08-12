// Deployment-owned, non-secret Runtime routing metadata.
// Pi5 replaces this file after `pnpm build`; the local default remains same-origin.
window.__PIPYTER_CONFIG__ = window.__PIPYTER_CONFIG__ || {
  nodes: [
    {
      id: 'local',
      name: 'Local Runtime',
      apiBase: '',
      allowDemo: true,
      workspaces: [{ id: 'current', name: 'Current workspace' }],
    },
  ],
}
