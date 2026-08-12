import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadRuntimeConfig, resolveTarget, type RuntimeNodeConfig, type RuntimeTarget } from './config'

const STORAGE_KEY = 'pipyter.runtime.selection.v1'

type SavedSelection = { nodeId?: string; workspaceId?: string }

type RuntimeContextValue = {
  nodes: RuntimeNodeConfig[]
  target: RuntimeTarget
  selectNode(nodeId: string): void
  selectWorkspace(workspaceId: string): void
}

const Context = createContext<RuntimeContextValue | null>(null)

function loadSaved(): SavedSelection {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as SavedSelection
  } catch {
    return {}
  }
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const loaded = useMemo(() => {
    try {
      return { nodes: loadRuntimeConfig(), error: null as string | null }
    } catch (error) {
      return {
        nodes: [{ id: 'config-error', name: 'Invalid Runtime config', apiBase: '', workspaces: [{ id: 'current', name: 'Unavailable' }] }],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }, [])
  const nodes = loaded.nodes
  const saved = useMemo(loadSaved, [])
  const [nodeId, setNodeId] = useState(() => nodes.some((item) => item.id === saved.nodeId) ? saved.nodeId! : nodes[0].id)
  const node = nodes.find((item) => item.id === nodeId) ?? nodes[0]
  const workspaces = node.workspaces ?? []
  const [workspaceId, setWorkspaceId] = useState(() => workspaces.some((item) => item.id === saved.workspaceId) ? saved.workspaceId! : workspaces[0].id)
  const workspace = workspaces.find((item) => item.id === workspaceId) ?? workspaces[0]
  const target = useMemo(() => resolveTarget(node, workspace), [node, workspace])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodeId: node.id, workspaceId: workspace.id }))
  }, [node.id, workspace.id])

  const value = useMemo<RuntimeContextValue>(() => ({
    nodes,
    target,
    selectNode: (nextNodeId) => {
      const next = nodes.find((item) => item.id === nextNodeId)
      if (!next) return
      setNodeId(next.id)
      setWorkspaceId((next.workspaces ?? [])[0]?.id ?? 'current')
    },
    selectWorkspace: (nextWorkspaceId) => {
      if (workspaces.some((item) => item.id === nextWorkspaceId)) setWorkspaceId(nextWorkspaceId)
    },
  }), [nodes, target, workspaces])

  if (loaded.error) {
    return <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', color: '#c33f31' }}><h2>Invalid Pipyter Runtime configuration</h2><p>{loaded.error}</p><p>Fix runtime-config.js and reload the page.</p></div>
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useRuntime(): RuntimeContextValue {
  const value = useContext(Context)
  if (!value) throw new Error('useRuntime must be used inside RuntimeProvider')
  return value
}
