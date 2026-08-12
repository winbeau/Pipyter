import { useRuntime } from './RuntimeProvider'

export function RuntimeSelector() {
  const runtime = useRuntime()
  const workspaces = runtime.target.node.workspaces ?? []
  return (
    <div className="runtime-selector" aria-label="Runtime target">
      <label>
        <span>Node</span>
        <select value={runtime.target.node.id} onChange={(event) => runtime.selectNode(event.target.value)}>
          {runtime.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
        </select>
      </label>
      <label>
        <span>Workspace</span>
        <select value={runtime.target.workspace.id} onChange={(event) => runtime.selectWorkspace(event.target.value)}>
          {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>
      </label>
    </div>
  )
}
