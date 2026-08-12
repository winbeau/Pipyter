import type { ToolSurfaceModel } from '../pigent/types'

export type PrototypeToolKind = 'read' | 'write' | 'update'

export type PrototypeLine = {
  number: number | null
  text: string
  tone: 'plain' | 'added' | 'removed'
}

export type PrototypeToolProjection = {
  id: string
  kind: PrototypeToolKind
  label: 'Read' | 'Write' | 'Update'
  filename: string
  path: string
  additions: number
  deletions: number
  lines: PrototypeLine[]
  surface: ToolSurfaceModel
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function fileName(path: string): string {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? path
}

function contentLines(content: string, offset = 1): PrototypeLine[] {
  return content.replace(/\n$/, '').split('\n').map((line, index) => ({ number: offset + index, text: line, tone: 'plain' }))
}

function diffLines(diff: string): PrototypeLine[] {
  let oldLine = 1
  let newLine = 1
  const lines: PrototypeLine[] = []
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (match) { oldLine = Number(match[1]); newLine = Number(match[2]) }
      continue
    }
    if (line.startsWith('---') || line.startsWith('+++') || !line) continue
    if (line.startsWith('+')) { lines.push({ number: newLine++, text: line.slice(1), tone: 'added' }); continue }
    if (line.startsWith('-')) { lines.push({ number: oldLine++, text: line.slice(1), tone: 'removed' }); continue }
    lines.push({ number: newLine++, text: line.startsWith(' ') ? line.slice(1) : line, tone: 'plain' })
    oldLine += 1
  }
  return lines
}

export function projectPrototypeTool(surface: ToolSurfaceModel): PrototypeToolProjection {
  const output = record(surface.output)
  const data = record(output.data)
  const input = record(surface.input)
  const path = text(data.path) || text(input.path) || text(surface.raw.path) || 'untitled.txt'
  const diff = text(data.diff) || text(surface.raw.diff)
  const kind: PrototypeToolKind = surface.tool === 'read' ? 'read' : surface.tool === 'write' ? 'write' : 'update'
  const parsed = diff ? diffLines(diff) : []
  const content = text(data.content) || text(input.content)
  const additions = parsed.filter((line) => line.tone === 'added').length || (kind === 'write' ? content.split('\n').length : 0)
  const deletions = parsed.filter((line) => line.tone === 'removed').length
  const offset = typeof data.offset === 'number' ? data.offset : typeof input.offset === 'number' ? input.offset : 1
  const lines = kind === 'read'
    ? contentLines(content, offset)
    : parsed.length
      ? parsed.map((line) => kind === 'write' ? { ...line, tone: 'added' as const } : line)
      : contentLines(content).map((line) => ({ ...line, tone: kind === 'write' ? 'added' as const : 'plain' as const }))
  return {
    id: surface.id,
    kind,
    label: kind === 'read' ? 'Read' : kind === 'write' ? 'Write' : 'Update',
    filename: fileName(path),
    path,
    additions,
    deletions,
    lines,
    surface,
  }
}

const createdContent = `export type AgentMode = 'ask' | 'plan' | 'auto'\n\nexport const DEFAULT_MODE: AgentMode = 'ask'\n\nexport function canWrite(mode: AgentMode) {\n  return mode === 'auto'\n}`

export const DESIGN_TOOL_SURFACES: ToolSurfaceModel[] = [
  {
    id: 'design-read', toolCallId: 'design-read', tool: 'read', state: 'succeeded', actions: [], raw: {},
    input: { path: 'src/pigent/modes.ts', offset: 1, limit: 12 },
    output: { summary: 'Read src/pigent/modes.ts', data: { path: '/home/winbeau/Projects/Pipyter/src/pigent/modes.ts', offset: 1, content: `export const modes = ['ask', 'plan', 'auto'] as const\n\nexport type PigentMode = typeof modes[number]\n\nexport function modeLabel(mode: PigentMode) {\n  return mode[0].toUpperCase() + mode.slice(1)\n}` } },
    error: {}, receipt: {},
  },
  {
    id: 'design-created', toolCallId: 'design-created', tool: 'write', state: 'succeeded', actions: [], raw: {},
    input: { path: 'src/pigent/agent-mode.ts', content: createdContent },
    output: { summary: 'Wrote src/pigent/agent-mode.ts', data: { path: '/home/winbeau/Projects/Pipyter/src/pigent/agent-mode.ts', diff: `--- src/pigent/agent-mode.ts\n+++ src/pigent/agent-mode.ts\n@@ -0,0 +1,7 @@\n+${createdContent.replaceAll('\n', '\n+')}` } },
    error: {}, receipt: {},
  },
  {
    id: 'design-edited', toolCallId: 'design-edited', tool: 'update', state: 'succeeded', actions: [], raw: {},
    input: { path: 'src/pigent/composer.ts', strategy: 'replace' },
    output: { summary: 'Updated src/pigent/composer.ts', data: { path: '/home/winbeau/Projects/Pipyter/src/pigent/composer.ts', diff: `--- src/pigent/composer.ts\n+++ src/pigent/composer.ts\n@@ -18,5 +18,6 @@\n export function submitPrompt(value: string) {\n-  return value.trim()\n+  const prompt = value.trim()\n+  return prompt || null\n }` } },
    error: {}, receipt: {},
  },
]
