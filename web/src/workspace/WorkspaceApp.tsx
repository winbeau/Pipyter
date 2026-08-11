import { useEffect } from 'react'
import { PigentWorkspacePanel } from '../pigent/PigentWorkspacePanel'
import { usePigent } from '../pigent/store'
import { ShellPanel } from '../shell/ShellPanel'
import { useShell } from '../shell/store'
import { demoNotebookPath } from './demo'
import { WorkspaceProvider, useWorkspace } from './store'
import { DialogHost } from './components/Dialogs'
import { ImageView } from './components/ImageView'
import { LeftPanel } from './components/LeftPanel'
import MenuBar from './components/MenuBar'
import { NotebookView } from './components/NotebookView'
import { StatusBar } from './components/StatusBar'
import { TextView } from './components/TextView'
import { IconClose, IconFileType, IconPigent, IconPlus, IconSpinner, IconTerminal } from './icons'

function WorkspaceShell() {
  const { state, actions } = useWorkspace(); const pigent = usePigent(); const shell = useShell()
  useEffect(() => { if (state.mode === 'demo' && state.openDocs.length === 0 && state.entries !== null) void actions.openDoc(demoNotebookPath, 'notebook') }, [state.mode, state.openDocs.length, state.entries, actions])
  useEffect(() => { const active = state.openDocs.find((doc) => doc.path === state.active); pigent.actions.setContext({ workspace: state.workspace?.name, activeDocument: active?.path, activeKernel: state.kernelId ?? undefined }) }, [state.active, state.kernelId, state.openDocs, state.workspace?.name, pigent.actions])
  useEffect(() => { if (shell.state.panelRequested) { actions.setBottomOpen(true); shell.actions.acknowledgePanel() } }, [actions, shell.actions, shell.state.panelRequested])
  const activeDoc = state.openDocs.find((doc) => doc.path === state.active) ?? null
  return <div className="ws-shell"><MenuBar /><div className="ws-body"><LeftPanel /><div className="ws-main"><div className="ws-tabbar">
    {state.openDocs.map((doc) => { const dirty = state.dirty[doc.path], active = doc.path === state.active; return <div key={doc.path} className={`ws-tab${active ? ' ws-tab-active' : ''}`} onClick={() => actions.setActive(doc.path)}><IconFileType kind={doc.kind === 'notebook' ? 'notebook' : doc.kind === 'image' ? 'image' : 'file'} name={doc.path} size={13} /><span className="ws-tab-name" title={doc.path}>{doc.path.split('/').pop()}</span>{dirty && <span className="ws-tab-dirty">●</span>}<button type="button" className="ws-tab-close" title="关闭" onClick={(event) => { event.stopPropagation(); actions.closeDoc(doc.path) }}><IconClose size={11} /></button></div> })}
    <button type="button" className="ws-tab-add" title="新建文件" onClick={() => actions.showPrompt('新建文件', '文件名', 'untitled.py', (name) => void actions.newFile(state.cwd, name))}><IconPlus size={15} /></button><div className="ws-tabbar-spacer" />
    <button type="button" className={`ws-pigent-toggle${pigent.state.open ? ' is-active' : ''}`} onClick={() => pigent.actions.setOpen(!pigent.state.open)} aria-pressed={pigent.state.open}><IconPigent size={14} /><span>Pigent</span></button>
    <button type="button" className={`ws-terminal-toggle${state.bottomOpen ? ' ws-terminal-toggle-active' : ''}`} title={state.bottomOpen ? '收起 Shell' : '展开 Shell'} onClick={() => actions.setBottomOpen(!state.bottomOpen)}><IconTerminal size={14} /><span>Shell</span></button>
  </div><div className="ws-docs">{state.mode === 'connecting' ? <div className="ws-empty-state"><IconSpinner size={18} /><p>正在连接 Runtime API…</p></div> : activeDoc === null ? <div className="ws-empty-state"><p>从左侧文件树打开文档，或双击 Notebook 开始。</p><p className="ws-empty-hint">{state.mode === 'demo' ? '演示模式：展示的是内置示例数据' : `工作区：${state.workspace?.name ?? ''}`}</p></div> : activeDoc.kind === 'notebook' ? <NotebookView key={activeDoc.path} path={activeDoc.path} /> : activeDoc.kind === 'image' ? <ImageView key={activeDoc.path} path={activeDoc.path} /> : <TextView key={activeDoc.path} path={activeDoc.path} />}</div>
    {state.bottomOpen && <div className="ws-bottom" style={shell.state.maximized ? undefined : { height: shell.state.panelHeight }}><ShellPanel onClose={() => actions.setBottomOpen(false)} /></div>}
  </div>{pigent.state.open && <PigentWorkspacePanel onClose={() => pigent.actions.setOpen(false)} />}</div><StatusBar /><DialogHost />{state.toast && <div className="ws-toast">{state.toast}</div>}</div>
}
export function WorkspaceApp() { return <WorkspaceProvider><WorkspaceShell /></WorkspaceProvider> }
