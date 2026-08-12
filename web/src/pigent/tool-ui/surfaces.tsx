import { Bot, CheckCircle2, CircleEllipsis, Code2, FileText, FlaskConical, Image, TerminalSquare, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ArtifactRef, PigentEvent, ToolSurfaceModel } from '../types'
import { SurfaceActions } from './actions'
import { safeRecord, safeText } from './contract'

function json(value: unknown) { try { return JSON.stringify(value, null, 2) } catch { return String(value) } }
function stateLabel(state: ToolSurfaceModel['state']) { return state.replaceAll('_', ' ') }
function facts(surface: ToolSurfaceModel) {
  const output = safeRecord(surface.output)
  const data = safeRecord(output.data)
  return [
    surface.durationMs != null ? `${surface.durationMs} ms` : null,
    typeof data.exit_code === 'number' ? `exit ${data.exit_code}` : null,
    data.truncated === true ? 'truncated' : null,
    typeof data.queue_depth === 'number' ? `queue ${data.queue_depth}` : null,
    typeof data.generation === 'number' ? `generation ${data.generation}` : null,
  ].filter(Boolean)
}

export function ToolSurface({ surface, density = 'comfortable' }: { surface: ToolSurfaceModel; density?: 'comfortable' | 'compact' }) {
  const [expanded, setExpanded] = useState(false)
  const output = safeRecord(surface.output)
  const data = safeRecord(output.data)
  const summary = safeText(output.summary, safeText(surface.raw.summary, `${surface.tool}${surface.action ? ` · ${surface.action}` : ''}`))
  const diff = safeText(data.diff, safeText(surface.raw.diff))
  const stdout = safeText(data.stdout, safeText(data.output, safeText(surface.raw.output)))
  const stderr = safeText(data.stderr)
  const Icon = ['write', 'update'].includes(surface.tool) ? FileText : surface.tool === 'bash' ? TerminalSquare : surface.tool === 'kernel' || surface.tool === 'notebook' || surface.tool === 'inspect' ? FlaskConical : surface.tool === 'delegate' ? Bot : Code2
  const receipt = safeRecord(surface.receipt)
  const operation = safeRecord(surface.operation)
  const progress = safeRecord(operation.progress)
  return <article className={`pigent-card pigent-tool-surface is-${density} state-${surface.state}`} aria-busy={surface.state === 'running' || surface.state === 'queued'}>
    <header><span><Icon />{surface.tool}{surface.action ? ` · ${surface.action}` : ''}</span><small>{surface.state === 'succeeded' ? <CheckCircle2 /> : surface.state === 'failed' ? <TriangleAlert /> : <CircleEllipsis />}{stateLabel(surface.state)}</small></header>
    <p>{summary}</p>
    {facts(surface).length > 0 && <div className="pigent-surface-facts">{facts(surface).map((fact) => <span key={String(fact)}>{fact}</span>)}</div>}
    {Object.keys(progress).length > 0 && <div className="pigent-operation-progress" role="status"><strong>{safeText(progress.phase)}</strong><span>{safeText(progress.message)}</span>{typeof progress.total === 'number' && <progress value={Number(progress.completed ?? 0)} max={progress.total} />}</div>}
    {diff && <pre className="pigent-diff">{diff}</pre>}
    {stdout && <pre className="pigent-output"><span>stdout</span>{stdout}</pre>}
    {stderr && <pre className="pigent-output is-stderr"><span>stderr</span>{stderr}</pre>}
    {Object.keys(receipt).length > 0 && <div className="pigent-receipt" role="status"><CheckCircle2 />{safeText(receipt.summary, safeText(receipt.outcome))}</div>}
    {expanded && <pre className="pigent-fallback-json">{json(surface.raw)}</pre>}
    <SurfaceActions actions={surface.actions.map((action) => action.id === 'expand' ? { ...action, label: expanded ? 'Collapse' : 'Expand' } : action)} onExpand={() => setExpanded((value) => !value)} onOpen={(path, reveal) => window.dispatchEvent(new CustomEvent('pipyter:open-path', { detail: { path, reveal } }))} />
  </article>
}

export function ArtifactSurface({ event, density = 'comfortable', artifactUrl }: { event: PigentEvent; density?: 'comfortable' | 'compact'; artifactUrl(id: string, download?: boolean): string }) {
  const artifact = safeRecord(event.payload?.artifact) as Partial<ArtifactRef> & Record<string, unknown>
  const table = safeRecord(event.payload?.table)
  const rows = Array.isArray(table.rows) ? table.rows.slice(0, 20) : []
  return <article className={`pigent-card pigent-artifact-surface is-${density}`}><header><span><Image />Artifact</span><small>{String(artifact.kind ?? 'artifact')}</small></header>
    <p>{String(artifact.mime ?? '')}{typeof artifact.size === 'number' ? ` · ${artifact.size} bytes` : ''}{artifact.width && artifact.height ? ` · ${artifact.width}×${artifact.height}` : ''}</p>
    {artifact.kind === 'image' && typeof artifact.id === 'string' && <img loading="lazy" alt="Pigent artifact preview" src={artifactUrl(artifact.id)} />}
    {rows.length > 0 && <div className="pigent-table-preview"><table><tbody>{rows.map((row, index) => <tr key={index}>{(Array.isArray(row) ? row : Object.values(safeRecord(row))).map((cell, cellIndex) => <td key={cellIndex}>{String(cell ?? '')}</td>)}</tr>)}</tbody></table></div>}
    {typeof artifact.id === 'string' && <SurfaceActions actions={[{ id: 'open', label: 'Open', href: artifactUrl(artifact.id) }, { id: 'download', label: 'Download', href: artifactUrl(artifact.id, true) }]} />}
  </article>
}

export function FallbackSurface({ event }: { event: PigentEvent }) {
  const value = useMemo(() => json(event.payload).slice(0, 16000), [event.payload])
  return <article className="pigent-card pigent-fallback-surface"><header><span><TriangleAlert />{event.type}</span><small>fallback</small></header><details><summary>Show bounded payload</summary><pre>{value}</pre></details></article>
}
