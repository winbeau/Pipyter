import { useEffect, useState, type CSSProperties } from 'react'
import { WorkspaceProvider, useWorkspace } from './store'
import { demoNotebookPath } from './demo'
import MenuBar from './components/MenuBar'
import { LeftPanel } from './components/LeftPanel'
import { StatusBar } from './components/StatusBar'
import { TerminalPanel } from './components/TerminalPanel'
import { NotebookView } from './components/NotebookView'
import { TextView } from './components/TextView'
import { ImageView } from './components/ImageView'
import { DialogHost } from './components/Dialogs'
import { PilotPanel } from './components/PilotPanel'
import { IconClose, IconFileType, IconSpinner, IconChevronDown } from './icons'

type PilotProps = {
  pilotOpen: boolean
  pilotCollapsed: boolean
  pilotToggleStyle: CSSProperties
  togglePilot: () => void
}

function WorkspaceShell({ pilotOpen, pilotCollapsed, pilotToggleStyle, togglePilot }: PilotProps) {
  const { state, actions } = useWorkspace()

  useEffect(() => {
    if (state.mode === 'demo' && state.openDocs.length === 0 && state.entries !== null) {
      void actions.openDoc(demoNotebookPath, 'notebook')
    }
  }, [state.mode, state.openDocs.length, state.entries, actions])

  const activeDoc = state.openDocs.find((doc) => doc.path === state.active) ?? null

  return (
    <div className="ws-shell">
      <MenuBar />
      <div className="ws-body">
        <LeftPanel />
        <div className="ws-main">
          <div className="ws-tabbar">
            {state.openDocs.map((doc) => {
              const dirty = state.dirty[doc.path]
              const active = doc.path === state.active
              return (
                <div
                  key={doc.path}
                  className={`ws-tab${active ? ' ws-tab-active' : ''}`}
                  onClick={() => actions.setActive(doc.path)}
                >
                  <IconFileType kind={doc.kind === 'notebook' ? 'notebook' : doc.kind === 'image' ? 'image' : 'file'} size={13} />
                  <span className="ws-tab-name" title={doc.path}>{doc.path.split('/').pop()}</span>
                  {dirty && <span className="ws-tab-dirty">●</span>}
                  <button
                    type="button"
                    className="ws-tab-close"
                    title="关闭"
                    onClick={(event) => {
                      event.stopPropagation()
                      actions.closeDoc(doc.path)
                    }}
                  >
                    <IconClose size={11} />
                  </button>
                </div>
              )
            })}
            <div className="ws-tabbar-spacer" />
            <button type="button" className="ws-pilot-toggle" style={pilotToggleStyle} onClick={togglePilot}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="10" r="6.5" />
                <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
              </svg>
              <span style={{ fontSize: '12px', fontWeight: 500 }}>Pilot</span>
            </button>
            <button
              type="button"
              className="ws-tabbar-toggle"
              title={state.bottomOpen ? '收起底部终端' : '展开底部终端'}
              onClick={() => actions.setBottomOpen(!state.bottomOpen)}
            >
              <IconChevronDown size={13} style={{ transform: state.bottomOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
          <div className="ws-docs">
            {state.mode === 'connecting' ? (
              <div className="ws-empty-state">
                <IconSpinner size={18} />
                <p>正在连接 Runtime API…</p>
              </div>
            ) : activeDoc === null ? (
              <div className="ws-empty-state">
                <p>从左侧文件树打开文档，或双击 Notebook 开始。</p>
                <p className="ws-empty-hint">
                  {state.mode === 'demo' ? '演示模式：展示的是内置示例数据' : `工作区：${state.workspace?.name ?? ''}`}
                </p>
              </div>
            ) : activeDoc.kind === 'notebook' ? (
              <NotebookView key={activeDoc.path} path={activeDoc.path} />
            ) : activeDoc.kind === 'image' ? (
              <ImageView key={activeDoc.path} path={activeDoc.path} />
            ) : (
              <TextView key={activeDoc.path} path={activeDoc.path} />
            )}
          </div>
          {state.bottomOpen && (
            <div className="ws-bottom">
              <TerminalPanel />
            </div>
          )}
        </div>
        <PilotPanel open={pilotOpen} collapsed={pilotCollapsed} toggleStyle={pilotToggleStyle} onToggle={togglePilot} />
      </div>
      <StatusBar />
      <DialogHost />
      {state.toast && <div className="ws-toast">{state.toast}</div>}
    </div>
  )
}

export function WorkspaceApp(props: PilotProps) {
  return (
    <WorkspaceProvider>
      <WorkspaceShell {...props} />
    </WorkspaceProvider>
  )
}
