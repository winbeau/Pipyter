import { normalizeApiBase } from '../api/client'

export type RuntimeWorkspaceConfig = {
  id: string
  name: string
  apiBase?: string
  runtimeWorkspaceId?: string
}

export type RuntimeNodeConfig = {
  id: string
  name: string
  apiBase?: string
  allowDemo?: boolean
  workspaces?: RuntimeWorkspaceConfig[]
}

export type PipyterRuntimeConfig = {
  nodes?: RuntimeNodeConfig[]
}

export type RuntimeTarget = {
  key: string
  node: RuntimeNodeConfig
  workspace: RuntimeWorkspaceConfig
  apiBase: string
  allowDemo: boolean
  expectedNodeId: string
  expectedWorkspaceId?: string
}

const fallbackNode: RuntimeNodeConfig = {
  id: 'local',
  name: 'Local Runtime',
  apiBase: '',
  allowDemo: true,
  workspaces: [{ id: 'current', name: 'Current workspace' }],
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)
}

function normalizeWorkspace(value: RuntimeWorkspaceConfig): RuntimeWorkspaceConfig | null {
  if (!validId(value?.id) || typeof value?.name !== 'string' || !value.name.trim()) return null
  return {
    id: value.id,
    name: value.name.trim(),
    apiBase: normalizeApiBase(value.apiBase),
    runtimeWorkspaceId: validId(value.runtimeWorkspaceId) ? value.runtimeWorkspaceId : undefined,
  }
}

function normalizeNode(value: RuntimeNodeConfig): RuntimeNodeConfig | null {
  if (!validId(value?.id) || typeof value?.name !== 'string' || !value.name.trim()) return null
  const workspaces = Array.isArray(value.workspaces)
    ? value.workspaces.map(normalizeWorkspace).filter((item): item is RuntimeWorkspaceConfig => item !== null)
    : []
  return {
    id: value.id,
    name: value.name.trim(),
    apiBase: normalizeApiBase(value.apiBase),
    allowDemo: value.allowDemo === true,
    workspaces: workspaces.length ? workspaces : [{ id: 'current', name: 'Current workspace' }],
  }
}

export function loadRuntimeConfig(): RuntimeNodeConfig[] {
  const raw = window.__PIPYTER_CONFIG__?.nodes
  if (!Array.isArray(raw)) return [fallbackNode]
  const nodes = raw.map(normalizeNode).filter((item): item is RuntimeNodeConfig => item !== null)
  if (!nodes.length) throw new Error('runtime-config.js does not contain a valid Runtime node')
  const routes = new Map<string, string>()
  for (const node of nodes) {
    for (const workspace of node.workspaces ?? []) {
      const route = normalizeApiBase(workspace.apiBase || node.apiBase)
      const owner = routes.get(route)
      const target = `${node.id}:${workspace.id}`
      if (owner) throw new Error(`Runtime targets ${owner} and ${target} share apiBase “${route || '/'}”`)
      routes.set(route, target)
    }
  }
  return nodes
}

export function resolveTarget(node: RuntimeNodeConfig, workspace: RuntimeWorkspaceConfig): RuntimeTarget {
  return {
    key: `${node.id}:${workspace.id}`,
    node,
    workspace,
    apiBase: normalizeApiBase(workspace.apiBase || node.apiBase),
    allowDemo: node.allowDemo === true,
    expectedNodeId: node.id,
    expectedWorkspaceId: workspace.runtimeWorkspaceId,
  }
}
