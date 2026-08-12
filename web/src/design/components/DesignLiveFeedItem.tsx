import { AlertCircle, CheckCircle2, ChevronRight, RotateCcw } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArtifactSurface } from '../../pigent/tool-ui/surfaces'
import { InteractionCard } from '../../pigent/components/InteractionCard'
import type { FeedItem, OptimisticUserMessage, PigentInteraction } from '../../pigent/types'
import { DesignJupyterCell, DesignLiveToolCall } from './DesignLiveToolCall'

type ToolFeedItem = Extract<FeedItem, { kind: 'tool' }>

export type DesignLiveFeedRow =
  | { kind: 'item'; id: string; item: FeedItem }
  | { kind: 'read-group'; id: string; items: ToolFeedItem[] }
  | { kind: 'notebook-insert-group'; id: string; path: string; items: ToolFeedItem[] }

function notebookAction(item: ToolFeedItem): string {
  if (item.surface.action) return item.surface.action
  const input = item.surface.input
  return input && typeof input === 'object' && !Array.isArray(input) && typeof (input as Record<string, unknown>).action === 'string'
    ? String((input as Record<string, unknown>).action)
    : ''
}

export function isDesignReadTool(item: FeedItem): boolean {
  if (item.kind !== 'tool') return false
  if (item.surface.tool === 'read' || item.surface.tool === 'view' || item.surface.tool === 'inspect' || item.surface.tool === 'bash') return true
  return item.surface.tool === 'notebook' && notebookAction(item) === 'read_cell'
}

function isNotebookInsert(item: FeedItem): boolean {
  return item.kind === 'tool'
    && item.surface.tool === 'notebook'
    && (notebookAction(item) === 'insert_cell' || notebookAction(item) === 'add_markdown')
}

function notebookInsertData(item: ToolFeedItem): Record<string, unknown> {
  const output = record(item.surface.output)
  const data = record(output.data)
  return Object.keys(data).length ? data : output
}

function notebookInsertPath(item: ToolFeedItem): string {
  const input = record(item.surface.input)
  const data = notebookInsertData(item)
  return typeof data.path === 'string' ? data.path : typeof input.path === 'string' ? input.path : ''
}

export function groupDesignLiveFeed(items: FeedItem[]): DesignLiveFeedRow[] {
  const rows: DesignLiveFeedRow[] = []
  let pendingRead: ToolFeedItem[] = []
  let pendingInsert: ToolFeedItem[] = []
  let pendingInsertPath = ''
  const flushRead = () => {
    if (pendingRead.length > 0) rows.push({ kind: 'read-group', id: `read-group:${pendingRead[0].id}`, items: pendingRead })
    pendingRead = []
  }
  const flushInsert = () => {
    if (pendingInsert.length === 1) rows.push({ kind: 'item', id: pendingInsert[0].id, item: pendingInsert[0] })
    if (pendingInsert.length > 1) rows.push({ kind: 'notebook-insert-group', id: `notebook-insert-group:${pendingInsert[0].id}`, path: pendingInsertPath, items: pendingInsert })
    pendingInsert = []
    pendingInsertPath = ''
  }

  for (const item of items) {
    // Tasks have their own persistent surface above the composer and do not break a
    // sequence of otherwise consecutive visible read activity.
    if (item.kind === 'tool' && item.surface.tool === 'tasks') continue
    if (isDesignReadTool(item)) {
      flushInsert()
      pendingRead.push(item as ToolFeedItem)
      continue
    }
    if (isNotebookInsert(item)) {
      const insert = item as ToolFeedItem
      flushRead()
      const path = notebookInsertPath(insert)
      if (!path) {
        flushInsert()
        rows.push({ kind: 'item', id: insert.id, item: insert })
        continue
      }
      if (pendingInsert.length > 0 && pendingInsertPath !== path) flushInsert()
      pendingInsertPath = path
      pendingInsert.push(insert)
      continue
    }
    flushRead()
    flushInsert()
    rows.push({ kind: 'item', id: item.id, item })
  }
  flushRead()
  flushInsert()
  return rows
}

function User({ message, onRetry }: { message: OptimisticUserMessage; onRetry(message: OptimisticUserMessage): void }) {
  return <article className={`design-live-user state-${message.state}`}><p>{message.content}</p>{message.state === 'failed' && <button type="button" onClick={() => onRetry(message)}><RotateCcw />重试</button>}</article>
}

function Thinking({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [truncated, setTruncated] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setTruncated(node.scrollWidth > node.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [text])
  return <div ref={ref} className={`design-live-thinking${truncated ? ' is-truncated' : ''}`} title={truncated ? text : undefined}>{text}</div>
}

function Assistant({ text, thinking }: { text: string; thinking: boolean }) {
  if (thinking) return <Thinking text={text} />
  // Assistant output is intentionally logo-free.  The tool stream already
  // communicates provenance through its capsules; a second Pigent mark beside
  // every message makes the conversation feel noisy and unlike the reference
  // UI.  Keep the final response as ordinary Markdown content.
  return <article className="design-live-assistant"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{text}</ReactMarkdown></article>
}

export function DesignLiveFeedItem({ item, onRetry, onOpenShell, onResolve, artifactUrl }: {
  item: FeedItem
  onRetry(message: OptimisticUserMessage): void
  onOpenShell(id?: string): void
  onResolve(interactionId: string, revision: number, actionId: string): Promise<void>
  artifactUrl(id: string, download?: boolean): string
}) {
  if (item.kind === 'user') return <User message={item.message} onRetry={onRetry} />
  if (item.kind === 'assistant') return <Assistant text={item.text} thinking={item.thinking} />
  if (item.kind === 'tool') return item.surface.tool === 'tasks' ? null : <DesignLiveToolCall surface={item.surface} />
  if (item.kind === 'artifact') return <ArtifactSurface event={item.event} artifactUrl={artifactUrl} />
  if (item.kind === 'interaction') {
    const interaction = (item.event.payload?.interaction ?? item.event.payload) as unknown as PigentInteraction
    if (!interaction?.interaction_id) return null
    return <InteractionCard interaction={interaction} revision={Number(item.event.payload?.revision ?? 1)} resolved={item.event.type === 'interaction.resolved' || (interaction as PigentInteraction & { state?: string }).state === 'resolved'} onOpenShell={onOpenShell} onResolve={onResolve} />
  }
  const text = String(item.event.payload?.message ?? item.event.payload?.summary ?? '')
  if (item.event.type === 'settled') return text ? <div className="design-live-status"><CheckCircle2 />{text}</div> : null
  return <div className="design-live-status is-error"><AlertCircle />{text || item.event.type}</div>
}

export function DesignLiveFeed({ items, ...props }: {
  items: FeedItem[]
  onRetry(message: OptimisticUserMessage): void
  onOpenShell(id?: string): void
  onResolve(interactionId: string, revision: number, actionId: string): Promise<void>
  artifactUrl(id: string, download?: boolean): string
}) {
  return <>{groupDesignLiveFeed(items).map((row) => {
    if (row.kind === 'read-group') return <DesignReadToolGroup key={row.id} items={row.items} />
    if (row.kind === 'notebook-insert-group') return <DesignNotebookInsertGroup key={row.id} items={row.items} path={row.path} />
    return <DesignLiveFeedItem key={row.id} item={row.item} {...props} />
  })}</>
}

function category(item: ToolFeedItem): { key: string; label: string } {
  if (item.surface.tool === 'notebook') return { key: 'notebook', label: 'Notebook Read' }
  const label = item.surface.tool === 'read' ? 'Read' : item.surface.tool === 'view' ? 'View' : item.surface.tool === 'bash' ? 'Bash' : 'Inspect'
  return { key: item.surface.tool, label }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function firstNonEmptyLine(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? ''
}

function bashOutput(item: ToolFeedItem): string {
  const output = record(item.surface.output)
  const data = record(output.data)
  return firstNonEmptyLine(data.stdout)
    || firstNonEmptyLine(data.output_tail)
    || firstNonEmptyLine(output.stdout)
    || firstNonEmptyLine(output.output_tail)
}

export function DesignReadToolGroup({ items }: { items: ToolFeedItem[] }) {
  const counts = items.reduce<Array<{ key: string; label: string; count: number }>>((result, item) => {
    const current = category(item)
    const existing = result.find((entry) => entry.key === current.key)
    if (existing) existing.count += 1
    else result.push({ ...current, count: 1 })
    return result
  }, [])
  const latestBashOutput = [...items].reverse().find((item) => item.surface.tool === 'bash' && bashOutput(item))
  const output = latestBashOutput ? bashOutput(latestBashOutput) : ''

  return <section className="design-tool-call design-read-group">
    <div className="design-tool-call-trigger design-read-group-trigger">
      <span className="design-read-group-counts">{counts.map((entry) => <span className={`design-read-group-count is-${entry.key}`} key={entry.key}><strong>{entry.label}</strong><span>×{entry.count}</span></span>)}</span>
      {output && <span className="design-read-group-output">{output}</span>}
    </div>
  </section>
}

function fileName(path: string): string {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? path
}

function numericValue(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value))
}

function notebookInsertCell(item: ToolFeedItem, fallback: number): { label: string; source: string; cellType: string; executionCount: number | null; outputs: unknown[] } {
  const input = record(item.surface.input)
  const data = notebookInsertData(item)
  const cell = record(data.cell)
  const explicit = numericValue(cell.one_based_index, data.one_based_index, cell.cell_number, data.cell_number)
  const zeroBased = numericValue(cell.index, data.index)
  const number = explicit !== undefined ? Math.max(1, Math.trunc(explicit)) : zeroBased !== undefined ? Math.max(1, Math.trunc(zeroBased) + 1) : fallback + 1
  const source = typeof cell.source === 'string' ? cell.source : typeof data.source === 'string' ? data.source : typeof input.source === 'string' ? input.source : ''
  const cellType = typeof cell.cell_type === 'string' ? cell.cell_type : item.surface.action === 'add_markdown' ? 'markdown' : 'code'
  const executionCount = typeof cell.execution_count === 'number' ? cell.execution_count : null
  const outputs = Array.isArray(cell.outputs) ? cell.outputs : Array.isArray(data.outputs) ? data.outputs : []
  return { label: `Cell ${number}`, source, cellType, executionCount, outputs }
}

export function DesignNotebookInsertGroup({ items, path }: { items: ToolFeedItem[]; path: string }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(0)
  const detailsId = useId()
  const cells = items.map(notebookInsertCell)
  const active = cells[selected] ?? cells[0]

  return <section className={`design-tool-call design-notebook-insert-group${open ? ' is-open' : ''}`}>
    <button type="button" className="design-tool-call-trigger design-notebook-insert-trigger" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((value) => !value)}>
      <span className="design-notebook-insert-label"><strong>Notebook</strong><span aria-hidden="true">·</span><strong>Insert</strong><span>×{items.length}</span></span>
      <span className="design-tool-call-file">{fileName(path)}</span>
      <ChevronRight className="design-tool-call-chevron" aria-hidden="true" />
    </button>
    {open && <div className="design-notebook-insert-detail" id={detailsId}>
      <div className="design-notebook-insert-tabs" role="tablist" aria-label={`${fileName(path)} inserted cells`}>
        {cells.map((cell, index) => <button type="button" role="tab" aria-selected={selected === index} aria-controls={`${detailsId}-panel`} className={`design-notebook-insert-tab${selected === index ? ' is-active' : ''}`} key={`${items[index].id}:${cell.label}`} onClick={() => setSelected(index)}>{cell.label}</button>)}
      </div>
      <pre className="design-notebook-insert-source" id={`${detailsId}-panel`} role="tabpanel"><code>{active?.source || ' '}</code></pre>
    </div>}
  </section>
}
