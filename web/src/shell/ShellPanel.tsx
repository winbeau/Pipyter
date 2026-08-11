import { Columns2, Maximize2, Minimize2, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useShell } from './store'
import type { TerminalSession } from './types'

function keyData(event: React.KeyboardEvent<HTMLTextAreaElement>): string | null {
  if (event.ctrlKey && !event.altKey && !event.metaKey && event.key.length === 1) return String.fromCharCode(event.key.toUpperCase().charCodeAt(0) - 64)
  const special: Record<string, string> = { Enter: '\r', Backspace: '\x7f', Tab: '\t', Escape: '\x1b', ArrowUp: '\x1b[A', ArrowDown: '\x1b[B', ArrowRight: '\x1b[C', ArrowLeft: '\x1b[D', Home: '\x1b[H', End: '\x1b[F', Delete: '\x1b[3~', PageUp: '\x1b[5~', PageDown: '\x1b[6~' }
  if (special[event.key]) return special[event.key]
  if (!event.ctrlKey && !event.metaKey && event.key.length === 1) return event.key
  return null
}
function duration(createdAt: string, now: number) { const seconds = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 1000)); const minutes = Math.floor(seconds / 60); return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s` }
function visibleTerminalText(value: string) {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b(?:\[[0-?]*[ -\/]*[@-~]|[@-_])/g, '')
    .replace(/\r(?!\n)/g, '')
}

function Pane({ session, output, active, onFocus }: { session: TerminalSession; output: string; active: boolean; onFocus(): void }) {
  const { actions } = useShell(); const areaRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLTextAreaElement>(null); const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (active) inputRef.current?.focus() }, [active, session.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [output])
  useEffect(() => { const area = areaRef.current; if (!area) return; const observer = new ResizeObserver(([entry]) => { const cols = Math.max(20, Math.floor(entry.contentRect.width / 7.8)); const rows = Math.max(4, Math.floor(entry.contentRect.height / 18)); actions.resize(session.id, cols, rows) }); observer.observe(area); return () => observer.disconnect() }, [actions, session.id])
  return <div ref={areaRef} className={`shell-pane${active ? ' is-active' : ''}`} onMouseDown={() => { onFocus(); inputRef.current?.focus() }}>
    <pre>{visibleTerminalText(output) || (session.status === 'running' ? '' : `[${session.status}${session.last_exit_code == null ? '' : ` ${session.last_exit_code}`}]`)}</pre><div ref={bottomRef} />
    <textarea ref={inputRef} aria-label={`Shell input for ${session.name}`} value="" spellCheck={false} onChange={() => undefined} onPaste={(event) => { event.preventDefault(); actions.send(session.id, event.clipboardData.getData('text')) }} onKeyDown={(event) => { const data = keyData(event); if (data !== null) { event.preventDefault(); event.stopPropagation(); actions.send(session.id, data) } }} />
  </div>
}

export function ShellPanel({ onClose }: { onClose(): void }) {
  const { state, actions } = useShell(); const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { if (!state.sessions.length && state.connectionState === 'connected') void actions.create() }, [actions, state.connectionState, state.sessions.length])
  const active = state.sessions.find((item) => item.id === state.activeSessionId)
  const MIN_PANEL = 160, MAX_PANEL = () => Math.min(650, Math.max(MIN_PANEL, window.innerHeight - 160))
  const beginResize = (event: React.PointerEvent) => { const startY = event.clientY, startHeight = state.panelHeight; const move = (next: PointerEvent) => actions.setHeight(Math.max(MIN_PANEL, Math.min(MAX_PANEL(), startHeight + startY - next.clientY))); const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end) }
  const stepHeight = (delta: number) => actions.setHeight(Math.max(MIN_PANEL, Math.min(MAX_PANEL(), state.panelHeight + delta)))
  return <section className={`shell-panel${state.maximized ? ' is-maximized' : ''}`} style={state.maximized ? undefined : { height: state.panelHeight }} onKeyDown={(event) => { if (event.altKey && event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && state.sessions.length > 1) { event.preventDefault(); const index = state.sessions.findIndex((item) => item.id === state.activeSessionId); const delta = event.key === 'ArrowRight' ? 1 : -1; actions.select(state.sessions[(index + delta + state.sessions.length) % state.sessions.length].id) } }}>
    {!state.maximized && <div className="shell-resize-handle" role="slider" tabIndex={0} aria-label="调整 Shell 面板高度" aria-orientation="vertical" aria-valuemin={MIN_PANEL} aria-valuemax={MAX_PANEL()} aria-valuenow={state.panelHeight} onPointerDown={beginResize} onKeyDown={(event) => { if (event.key === 'ArrowUp') { event.preventDefault(); stepHeight(20) } else if (event.key === 'ArrowDown') { event.preventDefault(); stepHeight(-20) } else if (event.key === 'Home') { event.preventDefault(); actions.setHeight(MIN_PANEL) } else if (event.key === 'End') { event.preventDefault(); actions.setHeight(MAX_PANEL()) } }} />}
    <header className="shell-header"><div className="shell-tabs">{state.sessions.map((session) => <div key={session.id} className={`shell-tab${session.id === state.activeSessionId ? ' is-active' : ''}`}><button type="button" className="shell-tab-select" onClick={() => actions.select(session.id)} aria-label={`选择 Shell session ${session.name}`} title={`${session.executable} · ${session.cwd}`}><i className={`shell-dot is-${session.status}`} />{session.name}</button><button type="button" className="shell-tab-close" onClick={() => void actions.close(session.id)} aria-label={`关闭 ${session.name}`}>×</button></div>)}<button type="button" className="shell-add" onClick={() => void actions.create()} aria-label="新建 Shell session"><Plus size={14} /></button></div>
      <div className="shell-actions"><button type="button" onClick={() => actions.clear()} aria-label="清空可见缓冲区"><Trash2 size={13} />清空</button><button type="button" onClick={() => void actions.split()} disabled={state.panes.length >= 2} aria-label="拆分 Shell"><Columns2 size={13} /></button><button type="button" onClick={() => actions.setMaximized(!state.maximized)} aria-label={state.maximized ? '恢复' : '最大化'}>{state.maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button><button type="button" onClick={() => void actions.refresh()} aria-label="重新连接"><RotateCcw size={13} /></button><button type="button" onClick={onClose} aria-label="收起 Shell"><X size={13} /></button></div>
    </header>
    <div className={`shell-panes count-${state.panes.length || 1}`}>{state.panes.map((pane) => { const session = state.sessions.find((item) => item.id === pane.sessionId); return session ? <Pane key={pane.id} session={session} output={state.outputBuffers[session.id] ?? ''} active={session.id === state.activeSessionId} onFocus={() => actions.select(session.id)} /> : null })}</div>
    <footer className="shell-footer"><span><i className={`shell-dot ${state.connectionState === 'connected' ? 'is-running' : 'is-exited'}`} />{state.connectionState}</span>{active && <><span>{active.executable}</span><span title={active.cwd}>cwd: {active.cwd}</span><span>{active.last_exit_code == null ? 'exit: —' : `exit: ${active.last_exit_code}`}</span><span>{duration(active.created_at, now)}</span><span>UTF-8</span></>}</footer>
    {state.error && <div className="shell-error">{state.error}</div>}
  </section>
}
