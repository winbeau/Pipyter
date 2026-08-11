import { useWorkspace } from '../store'
import { IconKernel, IconTerminal } from '../icons'

export function StatusBar() {
  const { state, actions } = useWorkspace()
  const activeDoc = state.openDocs.find((doc) => doc.path === state.active) ?? null
  const dirty = activeDoc ? state.dirty[activeDoc.path] : false
  const kernel = state.kernels.find((item) => item.id === state.kernelId) ?? null
  const demoOnly = state.mode === 'demo'

  return (
    <div className="ws-statusbar">
      <button
        type="button"
        className={`ws-status-item ws-status-connection ${demoOnly ? 'ws-status-demo' : ''}`}
        title={demoOnly ? 'Runtime API 不可用，点击重连' : '点击重连'}
        onClick={() => void actions.reconnect()}
      >
        <span className={`ws-dot ${demoOnly ? 'ws-dot-demo' : ''} ${state.busy ? 'ws-dot-busy' : ''}`} />
        {state.mode === 'connecting' ? '连接中…' : demoOnly ? '演示模式' : '已同步'}
      </button>
      <div className="ws-status-spacer" />
      {activeDoc && (
        <>
          <span className="ws-status-item" title={activeDoc.path}>{dirty ? '● 未保存' : '已保存'}</span>
          <span className="ws-status-item ws-status-doc" title={activeDoc.path}>
            {activeDoc.path.split('/').pop()}
          </span>
        </>
      )}
      {kernel && (
        <span className="ws-status-item">
          <IconKernel size={11} />
          {kernel.name} · {state.busy ? 'Busy' : 'Idle'}
        </span>
      )}
      {!kernel && (
        <span className="ws-status-item">
          <IconKernel size={11} /> 未连接 Kernel
        </span>
      )}
      <span className="ws-status-item" title="缩进"><IconTerminal size={11} /> 4 空格</span>
      <span className="ws-status-item" title="Notebook 可信状态">可信</span>
      <span className="ws-status-item">UTF-8</span>
      <span className="ws-status-item ws-status-right" title="协议版本">protocol {state.workspace?.protocol_version ?? '0.1'}</span>
    </div>
  )
}
