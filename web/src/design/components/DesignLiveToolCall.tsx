import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ToolSurfaceModel } from '../../pigent/types'
import { objectValue, outputData, outputEnvelope, parseUnifiedDiff, projectDesignTool, textValue } from '../toolPresentation'

function json(value: unknown): string {
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

function firstNonEmptyLine(value: string): string {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? ''
}

function CodeLines({ content, offset = 1 }: { content: string; offset?: number }) {
  const lines = content.replace(/\n$/, '').split('\n')
  return <div className="design-code-preview">{lines.map((line, index) => <div className="design-code-line is-plain" key={index}><span className="design-code-marker" /><span className="design-code-number">{offset + index}</span><code>{line || ' '}</code></div>)}</div>
}

function Diff({ value }: { value: string }) {
  return <div className="design-code-preview">{parseUnifiedDiff(value).map((line, index) => <div className={`design-code-line is-${line.tone}`} key={`${line.number}-${index}`}><span className="design-code-marker">{line.tone === 'added' ? '+' : line.tone === 'removed' ? '−' : ''}</span><span className="design-code-number">{line.number ?? ''}</span><code>{line.text || ' '}</code></div>)}</div>
}

function WritePreview({ content }: { content: string }) {
  const lines = content.replace(/\n$/, '').split('\n')
  return <div className="design-code-preview">{lines.map((line, index) => <div className="design-code-line is-added" key={index}><span className="design-code-marker">+</span><span className="design-code-number">{index + 1}</span><code>{line || ' '}</code></div>)}</div>
}

function Outputs({ outputs }: { outputs: unknown[] }) {
  return <div className="design-live-outputs">{outputs.map((value, index) => {
    const output = objectValue(value)
    const type = textValue(output.output_type, textValue(output.type, 'output'))
    const text = textValue(output.text, textValue(output.evalue))
    const traceback = Array.isArray(output.traceback) ? output.traceback.join('\n') : ''
    const data = objectValue(output.data)
    const visible = text || traceback || (Object.keys(data).length ? json(data) : '')
    return <pre className={`design-live-console is-${type === 'error' ? 'error' : 'output'}`} key={index}><span>{type}</span>{visible}</pre>
  })}</div>
}

/**
 * Notebook output uses the same small, explicit renderer as the workspace
 * notebook.  Tool payloads are intentionally treated as untrusted data: only
 * well-known mime types are promoted to rich output, everything else remains
 * a readable text/JSON preview.
 */
function JupyterOutput({ output, index }: { output: unknown; index: number }) {
  const value = objectValue(output)
  const outputType = textValue(value.output_type, textValue(value.type, 'output'))
  const data = objectValue(value.data)
  const streamText = textValue(value.text)
  const traceback = Array.isArray(value.traceback) ? value.traceback.join('\n') : ''
  const plain = textValue(data['text/plain'], streamText || textValue(value.evalue))
  const markdown = textValue(data['text/markdown'])
  const html = textValue(data['text/html'])
  const svg = textValue(data['image/svg+xml'])
  const png = textValue(data['image/png'])
  const jsonData = data['application/json']

  return <div className={`design-jupyter-output is-${outputType === 'error' ? 'error' : 'result'}`} data-output-index={index}>
    <div className="design-jupyter-output-prompt">{outputType === 'error' ? 'Error:' : 'Out:'}</div>
    <div className="design-jupyter-output-body">
      {outputType === 'error' ? <pre className="design-jupyter-output-text">{traceback || plain || 'Error'}</pre>
        : markdown ? <div className="design-jupyter-markdown design-jupyter-output-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{markdown}</ReactMarkdown></div>
          : html ? <div className="design-jupyter-output-html" dangerouslySetInnerHTML={{ __html: html }} />
            : svg ? <img className="design-jupyter-output-image" src={svg.startsWith('data:') ? svg : `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt="Notebook SVG output" />
              : png ? <img className="design-jupyter-output-image" src={`data:image/png;base64,${png}`} alt="Notebook PNG output" />
                : jsonData !== undefined ? <pre className="design-jupyter-output-text">{json(jsonData)}</pre>
                  : <pre className="design-jupyter-output-text">{plain || (Object.keys(data).length ? json(data) : '')}</pre>}
    </div>
  </div>
}

export function DesignJupyterCell({
  source,
  cellType,
  executionCount,
  outputs,
}: {
  source: string
  cellType: string
  executionCount?: number | null
  outputs: unknown[]
}) {
  const markdown = cellType === 'markdown'
  return <div className={`design-jupyter-cell is-${markdown ? 'markdown' : 'code'}`}>
    {markdown ? <div className="design-jupyter-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{source}</ReactMarkdown></div>
      : <div className="design-jupyter-code-row">
        <div className="design-jupyter-prompt">{executionCount == null ? 'In [ ]:' : `In [${executionCount}]:`}</div>
        <CodeLines content={source} offset={1} />
      </div>}
    {outputs.length > 0 && <div className="design-jupyter-outputs">{outputs.map((output, index) => <JupyterOutput key={index} output={output} index={index} />)}</div>}
  </div>
}

function Directory({ entries }: { entries: unknown[] }) {
  return <div className="design-live-table"><table><tbody>{entries.map((value, index) => { const entry = objectValue(value); return <tr key={index}><td>{textValue(entry.kind, textValue(entry.type))}</td><td>{textValue(entry.path, textValue(entry.name))}</td><td>{typeof entry.size === 'number' ? entry.size.toLocaleString() : ''}</td></tr> })}</tbody></table></div>
}

function actionName(surface: ToolSurfaceModel): string {
  const input = objectValue(surface.input)
  return (surface.action || textValue(input.action)).trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function canExpandDetail(surface: ToolSurfaceModel): boolean {
  const tool = surface.tool.trim().toLowerCase()
  const action = actionName(surface)

  if (tool === 'write' || tool === 'update' || tool === 'delegate' || tool === 'agent') return true
  if (tool === 'kernel') return action === 'execute' || action === 'run'
  if (tool === 'notebook') {
    return new Set([
      'update', 'update_cell',
      'delete', 'delete_cell',
      'run', 'run_cell',
      'insert', 'insert_cell',
      'write', 'add_markdown',
    ]).has(action)
  }
  return false
}

function Detail({ surface }: { surface: ToolSurfaceModel }) {
  const input = objectValue(surface.input)
  const output = outputEnvelope(surface)
  const data = outputData(surface)
  const diff = textValue(data.diff)
  const content = textValue(data.content)
  const writtenContent = surface.tool === 'write' ? textValue(input.content) : ''
  const cell = objectValue(data.cell)
  const deleted = objectValue(data.deleted)
  const cellSource = textValue(cell.source, textValue(deleted.source))
  const notebookCell = Object.keys(cell).length > 0 ? cell : deleted
  const notebookCellType = textValue(notebookCell.cell_type, actionName(surface) === 'add_markdown' ? 'markdown' : 'code')
  const notebookExecutionCount = typeof notebookCell.execution_count === 'number' ? notebookCell.execution_count : null
  const stdout = textValue(data.stdout)
  const stderr = textValue(data.stderr)
  const commandOutput = textValue(data.output_tail, textValue(data.output))
  const outputs = Array.isArray(data.outputs) ? data.outputs : Array.isArray(notebookCell.outputs) ? notebookCell.outputs : []
  const entries = Array.isArray(data.entries) ? data.entries : []
  const result = data.result
  const delegated = objectValue(result)
  const operation = objectValue(surface.operation)
  const progress = objectValue(operation.progress)
  const error = objectValue(surface.error)
  const imageUrl = textValue(data.data_url)
  const path = textValue(data.path, textValue(input.path))
  const source = objectValue(input.source)
  const header = path || textValue(source.path) || textValue(data.command, textValue(input.command)) || textValue(output.summary, surface.tool)

  if (surface.tool === 'bash') {
    return <div className="design-tool-call-detail design-live-tool-detail">
      {(stdout || commandOutput) && <pre className="design-live-console is-output"><span>stdout</span>{stdout || commandOutput}</pre>}
      {stderr && <pre className="design-live-console is-error"><span>stderr</span>{stderr}</pre>}
    </div>
  }

  return <div className="design-tool-call-detail design-live-tool-detail">
    <div className="design-tool-call-path">{header}</div>
    {Object.keys(progress).length > 0 && <div className="design-live-progress" role="status"><strong>{textValue(progress.phase, surface.action)}</strong><span>{textValue(progress.message)}</span>{typeof progress.total === 'number' && <progress value={Number(progress.completed ?? 0)} max={progress.total} />}</div>}
    {diff && <Diff value={diff} />}
    {!diff && writtenContent && <WritePreview content={writtenContent} />}
    {!diff && !writtenContent && content && <CodeLines content={content} offset={typeof data.offset === 'number' ? data.offset : 1} />}
    {!diff && surface.tool === 'notebook' && cellSource && <DesignJupyterCell source={cellSource} cellType={notebookCellType} executionCount={notebookExecutionCount} outputs={outputs} />}
    {!diff && surface.tool !== 'notebook' && cellSource && <CodeLines content={cellSource} offset={1} />}
    {entries.length > 0 && <Directory entries={entries} />}
    {imageUrl && <div className="design-live-image"><img alt="Tool result preview" src={imageUrl} /></div>}
    {outputs.length > 0 && surface.tool !== 'notebook' && <Outputs outputs={outputs} />}
    {(stdout || commandOutput) && <pre className="design-live-console is-output"><span>stdout</span>{stdout || commandOutput}</pre>}
    {stderr && <pre className="design-live-console is-error"><span>stderr</span>{stderr}</pre>}
    {result !== undefined && surface.tool === 'inspect' && <pre className="design-live-structured">{json(result)}</pre>}
    {surface.tool === 'delegate' && (textValue(delegated.summary) || textValue(delegated.status)) && <div className="design-live-agent-result"><strong>{textValue(delegated.status, surface.state)}</strong><p>{textValue(delegated.summary)}</p></div>}
    {Object.keys(error).length > 0 && <pre className="design-live-console is-error"><span>error</span>{json(error)}</pre>}
    {!diff && !writtenContent && !content && !cellSource && !entries.length && !imageUrl && !outputs.length && !stdout && !commandOutput && !stderr && result === undefined && Object.keys(progress).length === 0 && Object.keys(error).length === 0 && <pre className="design-live-structured">{json(data)}</pre>}
  </div>
}

export function DesignLiveToolCall({ surface }: { surface: ToolSurfaceModel }) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const presentation = projectDesignTool(surface)
  const expandable = canExpandDetail(surface)
  const data = outputData(surface)
  const bashOutput = firstNonEmptyLine(textValue(data.stdout,
    textValue(data.output_tail,
      textValue(data.output,
        textValue(data.stderr)))))
  const visibleTarget = surface.tool === 'bash' ? bashOutput || presentation.summary : presentation.target
  const label = <>
    {presentation.action ? <span className="design-tool-compound"><span className="design-tool-family">{presentation.family}</span><span className="design-tool-action">{presentation.action}</span></span> : <span className="design-tool-call-badge">{presentation.family}</span>}
    <span className="design-tool-call-file">{visibleTarget}</span>
    {(presentation.additions > 0 || presentation.deletions > 0) && <span className="design-tool-call-stats"><b>+{presentation.additions}</b><i>-{presentation.deletions}</i></span>}
  </>

  return <section className={`design-tool-call design-live-tool is-${presentation.kind} state-${surface.state}${open ? ' is-open' : ''}`} data-tool={surface.tool}>
    {expandable ? <>
      <button type="button" className="design-tool-call-trigger" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((value) => !value)}>
        {label}
        <ChevronRight className="design-tool-call-chevron" aria-hidden="true" />
      </button>
      {open && <div id={detailsId}><Detail surface={surface} /></div>}
    </> : <div className="design-tool-call-trigger is-static">{label}</div>}
  </section>
}
