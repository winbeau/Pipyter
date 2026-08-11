import { useWorkspace } from '../store'
import { FileBrowser } from './FileBrowser'

/** Left column: file browser only. The collapse toggle sits at its bottom-right. */
export function LeftPanel() {
  const { state, actions } = useWorkspace()
  if (!state.leftOpen) {
    return (
      <div className="ws-left ws-left-collapsed" title="展开文件树">
        <button
          type="button"
          className="ws-left-expand"
          onClick={() => actions.setLeftOpen(true)}
          aria-label="展开文件树"
        >
          <span className="ws-left-expand-icon">▶</span>
        </button>
      </div>
    )
  }
  return (
    <div className="ws-left">
      <div className="ws-left-panel">
        <FileBrowser />
        <div className="ws-left-footer">
          <button
            type="button"
            className="ws-left-collapse-btn"
            title="收起文件树"
            onClick={() => actions.setLeftOpen(false)}
          >
            ◀ 收起
          </button>
        </div>
      </div>
    </div>
  )
}
