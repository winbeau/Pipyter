import { Circle, FolderPlus, LoaderCircle, Plus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import type { PigentProjectCreate, PigentProjectCreationOptions } from '../../pigent/api'
import type { PigentSession } from '../../pigent/types'

type OpenMenu = { sessionId: string; x: number; y: number }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function DesignNewProjectDialog({ onClose, onLoadOptions, onCreate }: {
  onClose(): void
  onLoadOptions(): Promise<PigentProjectCreationOptions>
  onCreate(options: PigentProjectCreate): Promise<void> | void
}) {
  const workspaceListId = useId()
  const titleId = useId()
  const workspaceId = useId()
  const kernelId = useId()
  const [options, setOptions] = useState<PigentProjectCreationOptions | null>(null)
  const [workspace, setWorkspace] = useState('.')
  const [kernelName, setKernelName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const loadOptions = async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const next = await onLoadOptions()
      if (request !== requestRef.current) return
      setOptions(next)
      setWorkspace(next.defaultWorkspace || '.')
      setKernelName('')
    } catch (loadError) {
      if (request === requestRef.current) setError(errorMessage(loadError))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    void loadOptions()
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) { event.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { requestRef.current += 1; document.removeEventListener('keydown', onKeyDown) }
  }, [])

  const submit = async () => {
    const directory = workspace.trim()
    if (!directory || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({ workspace: directory, kernelName: kernelName || null })
      onClose()
    } catch (createError) {
      setError(errorMessage(createError))
      setSubmitting(false)
    }
  }

  return <div className="design-project-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }}>
    <section className="design-project-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="design-project-dialog-header">
        <div><h2 id={titleId}>新建项目</h2><p>为新对话指定工作目录与 Kernel。</p></div>
        <button type="button" aria-label="关闭新建项目" disabled={submitting} onClick={onClose}><X /></button>
      </header>
      {loading && <div className="design-project-state" role="status"><LoaderCircle className="is-spinning" /><span>正在读取 Workspace 与 Kernel…</span></div>}
      {!loading && !options && <div className="design-project-state is-error" role="alert"><strong>无法读取项目选项</strong><span>{error || 'Runtime 暂不可用'}</span><button type="button" onClick={() => void loadOptions()}>重试</button></div>}
      {!loading && options && <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <div className="design-project-field">
          <label htmlFor={workspaceId}>Workspace directory</label>
          <input id={workspaceId} autoFocus list={workspaceListId} value={workspace} onChange={(event) => setWorkspace(event.target.value)} placeholder="输入项目目录" spellCheck={false} />
          <datalist id={workspaceListId}><option value={options.defaultWorkspace || '.'}>当前 Workspace</option></datalist>
          <small>输入当前 Runtime Workspace 内的目录，可使用相对路径或其绝对路径。</small>
        </div>
        <div className="design-project-field">
          <label htmlFor={kernelId}>Kernel</label>
          <select id={kernelId} value={kernelName} onChange={(event) => setKernelName(event.target.value)}>
            <option value="">暂不选择</option>
            {options.kernels.map((kernel) => <option key={kernel.name} value={kernel.name}>{kernel.display_name || kernel.name}{kernel.language ? ` · ${kernel.language}` : ''}</option>)}
          </select>
          {options.kernels.length === 0 && <small className="is-empty">未发现可用 Kernel；仍可创建项目并稍后选择。</small>}
        </div>
        {error && <div className="design-project-inline-error" role="alert">{error}</div>}
        <footer className="design-project-dialog-actions">
          <button type="button" disabled={submitting} onClick={onClose}>取消</button>
          <button type="submit" className="is-primary" disabled={!workspace.trim() || submitting}>{submitting ? '正在创建…' : '创建项目'}</button>
        </footer>
      </form>}
    </section>
  </div>
}

export function DesignSidebar({ sessions, activeId, onNew, onLoadProjectOptions, onNewProject, onSelect, onRename, onDelete }: {
  sessions: readonly PigentSession[]
  activeId: string | null
  onNew(): Promise<void> | void
  onLoadProjectOptions(): Promise<PigentProjectCreationOptions>
  onNewProject(options: PigentProjectCreate): Promise<void> | void
  onSelect(id: string): void
  onRename(id: string, title: string): Promise<void> | void
  onDelete(id: string): Promise<void> | void
}) {
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const [projectOpen, setProjectOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const menuPrefix = useId()
  const closeMenu = (restoreFocus = false) => {
    const sessionId = menu?.sessionId
    setMenu(null)
    if (restoreFocus && sessionId) triggerRefs.current.get(sessionId)?.focus()
  }
  const openMenu = (sessionId: string, x: number, y: number) => {
    const width = 148, height = 222
    setMenu({ sessionId, x: Math.max(8, Math.min(x, window.innerWidth - width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - height - 8)) })
  }
  useEffect(() => {
    if (!menu) return
    queueMicrotask(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus())
    const onPointerDown = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null) }
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeMenu(true) } }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [menu])
  const onContextMenu = (event: MouseEvent<HTMLButtonElement>, sessionId: string) => {
    event.preventDefault(); onSelect(sessionId); openMenu(sessionId, event.clientX, event.clientY)
  }
  const onSessionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, sessionId: string) => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault(); onSelect(sessionId)
    const bounds = event.currentTarget.getBoundingClientRect(); openMenu(sessionId, bounds.left + 24, bounds.bottom + 4)
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1 + items.length) % items.length : (current - 1 + items.length) % items.length
    items[next]?.focus()
  }
  const rename = async (session: PigentSession) => {
    const title = window.prompt('重命名会话', session.title ?? '')?.trim()
    setMenu(null)
    if (title && title !== session.title) await onRename(session.id, title)
  }
  const remove = async (session: PigentSession) => {
    setMenu(null)
    if (window.confirm(`删除“${session.title || '未命名会话'}”？`)) await onDelete(session.id)
  }
  return <aside className="design-sidebar" aria-label="Design conversations">
    <div className="design-sidebar-actions">
      <button type="button" className="design-sidebar-primary" onClick={() => void onNew()}><span><Plus /></span>新建对话</button>
      <button type="button" className="design-sidebar-project" onClick={() => setProjectOpen(true)}><span><FolderPlus /></span>新建项目</button>
    </div>
    <nav className="design-session-list" aria-label="Pigent sessions">
      {sessions.map((session) => {
        const selected = activeId === session.id, menuOpen = menu?.sessionId === session.id, title = session.title || '未命名会话'
        return <div className={`design-session-row${selected ? ' is-selected' : ''}${menuOpen ? ' is-menu-open' : ''}`} key={session.id}>
          <button type="button" ref={(node) => { if (node) triggerRefs.current.set(session.id, node); else triggerRefs.current.delete(session.id) }} className="design-session-select" aria-current={selected ? 'page' : undefined} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? `${menuPrefix}-${session.id}` : undefined} onClick={() => { onSelect(session.id); setMenu(null) }} onContextMenu={(event) => onContextMenu(event, session.id)} onKeyDown={(event) => onSessionKeyDown(event, session.id)}><Circle /><span>{title}</span></button>
          {menuOpen && <div ref={menuRef} id={`${menuPrefix}-${session.id}`} className="design-session-menu" style={{ '--menu-x': `${menu.x}px`, '--menu-y': `${menu.y}px` } as CSSProperties} role="menu" aria-label={`管理 ${title}`} onKeyDown={onMenuKeyDown}>
            <div className="design-session-menu-group"><button type="button" role="menuitem" onClick={() => { onSelect(session.id); setMenu(null) }}><span>打开方式</span><span className="design-session-submenu" aria-hidden="true">›</span></button></div>
            <div className="design-session-menu-group"><button type="button" role="menuitem" onClick={() => { onSelect(session.id); setMenu(null) }}>置顶</button><button type="button" role="menuitem" onClick={() => setMenu(null)}>标记为未读</button><button type="button" role="menuitem" onClick={() => void rename(session)}>重命名</button><button type="button" role="menuitem" onClick={() => { void onNew(); setMenu(null) }}>分叉</button></div>
            <div className="design-session-menu-group"><button type="button" role="menuitem" className="is-danger" onClick={() => void remove(session)}>删除</button></div>
          </div>}
        </div>
      })}
    </nav>
    {projectOpen && <DesignNewProjectDialog onClose={() => setProjectOpen(false)} onLoadOptions={onLoadProjectOptions} onCreate={onNewProject} />}
  </aside>
}
