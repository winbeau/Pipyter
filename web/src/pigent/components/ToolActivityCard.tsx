import { Bot, Check, CircleEllipsis, Code2, FileSearch, FlaskConical, Image, TerminalSquare } from 'lucide-react'
import type { PigentEvent } from '../types'
function text(payload: Record<string, unknown> | undefined, key: string, fallback = '') { const value = payload?.[key]; return typeof value === 'string' ? value : fallback }
export function ToolActivityCard({ event, density = 'comfortable', reviewBeforeApply = false }: { event: PigentEvent; density?: 'comfortable' | 'compact'; reviewBeforeApply?: boolean }) {
  const payload = event.payload; const tool = text(payload, 'tool', event.type.split('.')[0]); const summary = text(payload, 'summary', text(payload, 'message', event.type.replace('.', ' · ')))
  const family = ['write','update','bash'].includes(tool) ? 'mutation' : tool === 'delegate' || event.type.startsWith('delegate') ? 'delegate' : ['notebook','kernel'].includes(tool) || event.type === 'kernel.updated' ? 'kernel' : 'read'
  const Icon = family === 'mutation' ? TerminalSquare : family === 'delegate' ? Bot : family === 'kernel' ? FlaskConical : FileSearch
  const output = text(payload, 'output'); const diff = text(payload, 'diff'); const artifact = payload?.artifact as Record<string, unknown> | undefined
  return <article className={`pigent-card pigent-tool-card is-${density} family-${family}`}><header><span><Icon size={15} />{tool}</span><small>{event.type.endsWith('.end') ? <Check size={12} /> : <CircleEllipsis size={12} />}{event.type.split('.')[1] || 'event'}</small></header><p>{summary}</p>
    {diff && <pre className="pigent-diff"><Code2 size={13} />{diff}</pre>}{output && <pre className="pigent-output">{output}</pre>}
    {artifact && <div className="pigent-artifact"><Image size={16} /><span>{String(artifact.kind || 'artifact')} · {String(artifact.mime || '')}</span></div>}
    {(diff || event.type === 'artifact.created') && <div className="pigent-card-actions">{reviewBeforeApply ? <><button type="button" className="is-primary">Apply</button><button type="button">Revert</button></> : <><button type="button">Revert</button><button type="button">Undo</button></>}</div>}
  </article>
}
