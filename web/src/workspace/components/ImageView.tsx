import { useWorkspace } from '../store'

export function ImageView({ path }: { path: string }) {
  const { actions } = useWorkspace()
  return (
    <div className="ws-imageview">
      <div className="ws-imageview-toolbar">
        <span className="ws-textview-path">{path}</span>
      </div>
      <div className="ws-imageview-body">
        <img src={actions.imageUrl(path)} alt={path} />
      </div>
    </div>
  )
}
