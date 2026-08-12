import type { ToolSurfaceModel } from '../pigent/types'

export type DesignToolKind = 'read' | 'write' | 'update' | 'view' | 'bash' | 'notebook' | 'kernel' | 'inspect' | 'agent' | 'unknown'

export type DesignDiffLine = {
  number: number | null
  text: string
  tone: 'plain' | 'added' | 'removed'
}

export type DesignToolPresentation = {
  kind: DesignToolKind
  family: string
  action?: string
  target: string
  path?: string
  additions: number
  deletions: number
  summary: string
}

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function textValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function numberValue(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value))
}

export function outputEnvelope(surface: ToolSurfaceModel): Record<string, unknown> {
  return objectValue(surface.output)
}

export function outputData(surface: ToolSurfaceModel): Record<string, unknown> {
  const output = outputEnvelope(surface)
  const data = objectValue(output.data)
  return Object.keys(data).length ? data : output
}

export function baseName(path: string): string {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? path
}

export function parseUnifiedDiff(diff: string): DesignDiffLine[] {
  let oldLine = 1
  let newLine = 1
  const lines: DesignDiffLine[] = []
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (match) { oldLine = Number(match[1]); newLine = Number(match[2]) }
      continue
    }
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('\\ No newline') || !line) continue
    if (line.startsWith('+')) { lines.push({ number: newLine++, text: line.slice(1), tone: 'added' }); continue }
    if (line.startsWith('-')) { lines.push({ number: oldLine++, text: line.slice(1), tone: 'removed' }); continue }
    lines.push({ number: newLine++, text: line.startsWith(' ') ? line.slice(1) : line, tone: 'plain' })
    oldLine += 1
  }
  return lines
}

function firstLine(value: string, limit = 88): string {
  const line = value.trim().split(/\r?\n/, 1)[0] ?? ''
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line
}

function notebookTarget(input: Record<string, unknown>, data: Record<string, unknown>): { target: string; path?: string } {
  const cell = objectValue(data.cell)
  const deleted = objectValue(data.deleted)
  const path = textValue(data.path, textValue(input.path))
  const index = numberValue(data.index, cell.index, deleted.index)
  const cellId = textValue(cell.cell_id, textValue(deleted.cell_id, textValue(data.cell_id, textValue(input.cell_id))))
  const cellLabel = index !== undefined ? `Cell ${index + 1}` : cellId ? `Cell ${cellId.slice(0, 8)}` : 'Cell'
  return { path: path || undefined, target: `${path ? baseName(path) : 'Notebook'} · ${cellLabel}` }
}

function kernelName(input: Record<string, unknown>, data: Record<string, unknown>, operation: Record<string, unknown>): string {
  const environment = objectValue(data.environment)
  return textValue(data.display_name,
    textValue(data.name,
      textValue(environment.display_name,
        textValue(environment.name,
          textValue(input.display_name,
            textValue(input.name))))))
}

const notebookAliases: Record<string, string> = {
  read_cell: 'Read', update_cell: 'Update', insert_cell: 'Insert', delete_cell: 'Delete', move_cell: 'Move',
  run_cell: 'Run', add_markdown: 'Write', clear_output: 'Clear',
}
const kernelAliases: Record<string, string> = {
  status: 'Status', execute: 'Run', interrupt: 'Interrupt', restart: 'Restart', shutdown: 'Stop',
  list_environments: 'List', operation_status: 'Progress', create_temporary: 'Create', create_maintained: 'Create',
  sync_environment: 'Sync', start_environment: 'Start', promote_environment: 'Promote', delete_environment: 'Delete',
}
const inspectAliases: Record<string, string> = {
  variables: 'Variables', variable: 'Variable', dataframe: 'Table', figure: 'Figure', object: 'Object',
}
const agentAliases: Record<string, string> = {
  analysis: 'Analyzer', research: 'Researcher', review: 'Reviewer', implementation: 'Implementer',
}

export function projectDesignTool(surface: ToolSurfaceModel): DesignToolPresentation {
  const input = objectValue(surface.input)
  const output = outputEnvelope(surface)
  const data = outputData(surface)
  const operation = objectValue(surface.operation)
  const action = surface.action || textValue(input.action, textValue(data.action))
  const summary = textValue(output.summary, textValue(surface.raw.summary, surface.state === 'running' ? 'Running' : 'Completed'))
  const path = textValue(data.path, textValue(input.path))
  const diff = textValue(data.diff)
  const diffLines = diff ? parseUnifiedDiff(diff) : []
  const writeContent = surface.tool === 'write' ? textValue(input.content) : ''
  const additions = diffLines.filter((line) => line.tone === 'added').length || (writeContent ? writeContent.replace(/\n$/, '').split('\n').length : 0)
  const deletions = diffLines.filter((line) => line.tone === 'removed').length

  if (surface.tool === 'read') {
    const offset = numberValue(data.offset, input.offset)
    const limit = numberValue(input.limit)
    const range = offset && limit ? ` · L${offset}–${offset + limit - 1}` : offset ? ` · L${offset}` : ''
    return { kind: 'read', family: 'Read', target: `${path ? baseName(path) : summary}${range}`, path: path || undefined, additions, deletions, summary }
  }
  if (surface.tool === 'write') return { kind: 'write', family: 'Write', target: path ? baseName(path) : summary, path: path || undefined, additions, deletions, summary }
  if (surface.tool === 'update') return { kind: 'update', family: 'Update', target: path ? baseName(path) : summary, path: path || undefined, additions, deletions, summary }
  if (surface.tool === 'view') {
    const source = objectValue(input.source)
    const sourcePath = textValue(source.path, path)
    return { kind: 'view', family: 'View', target: sourcePath ? baseName(sourcePath) : textValue(data.figure_id, textValue(data.artifact_id, summary)), path: sourcePath || undefined, additions, deletions, summary }
  }
  if (surface.tool === 'bash') {
    const command = textValue(data.command, textValue(input.command))
    return { kind: 'bash', family: 'Bash', target: firstLine(command || summary), additions, deletions, summary }
  }
  if (surface.tool === 'notebook') {
    const notebook = notebookTarget(input, data)
    return { kind: 'notebook', family: 'Notebook', action: notebookAliases[action] ?? 'Cell', target: notebook.target, path: notebook.path, additions, deletions, summary }
  }
  if (surface.tool === 'kernel') {
    const name = kernelName(input, data, operation)
    const code = textValue(input.code)
    const environmentKind = action === 'create_temporary' ? 'Temporary' : action === 'create_maintained' ? 'Maintained' : ''
    const target = name ? name : environmentKind || (action === 'execute' && code ? firstLine(code) : summary)
    return { kind: 'kernel', family: 'Kernel', action: kernelAliases[action] ?? 'Status', target, additions, deletions, summary }
  }
  if (surface.tool === 'inspect') {
    const name = textValue(input.name)
    return { kind: 'inspect', family: 'Inspect', action: inspectAliases[action] ?? 'Read', target: name || summary, additions, deletions, summary }
  }
  if (surface.tool === 'delegate') {
    const profile = action || textValue(input.profile, textValue(surface.raw.profile))
    return { kind: 'agent', family: 'Agent', action: agentAliases[profile] ?? 'Agent', target: firstLine(textValue(input.task, summary)), additions, deletions, summary }
  }
  return { kind: 'unknown', family: surface.tool || 'Tool', action: action || undefined, target: summary, additions, deletions, summary }
}
