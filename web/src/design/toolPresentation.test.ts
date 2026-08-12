import { describe, expect, it } from 'vitest'
import type { ToolSurfaceModel } from '../pigent/types'
import { projectDesignTool } from './toolPresentation'

const surface = (tool: string, action: string | undefined, input: Record<string, unknown>, output: Record<string, unknown> = {}): ToolSurfaceModel => ({
  id: `surface:${tool}`, toolCallId: `call:${tool}`, tool, action, state: 'succeeded', input, output, actions: [], raw: {},
})

describe('Design real tool aliases', () => {
  it('renders bash as a single Bash capsule', () => {
    const projected = projectDesignTool(surface('bash', undefined, { command: 'pnpm test\necho done' }))
    expect(projected).toMatchObject({ kind: 'bash', family: 'Bash', target: 'pnpm test' })
    expect(projected.action).toBeUndefined()
  })

  it('counts Write lines directly from the real input before the result returns', () => {
    expect(projectDesignTool(surface('write', undefined, { path: 'demo.txt', content: 'one\ntwo\nthree\n' }))).toMatchObject({
      kind: 'write', family: 'Write', target: 'demo.txt', additions: 3, deletions: 0,
    })
  })

  it('renders Notebook aliases with notebook filename and one-based cell number', () => {
    expect(projectDesignTool(surface('notebook', 'update_cell', { action: 'update_cell', path: 'reports/analysis.ipynb', cell_id: 'cell-4' }, {
      summary: 'Notebook update_cell completed', data: { path: 'reports/analysis.ipynb', cell: { index: 3, cell_id: 'cell-4', source: 'x = 2' } },
    }))).toMatchObject({ kind: 'notebook', family: 'Notebook', action: 'Update', target: 'analysis.ipynb · Cell 4' })
  })

  it('shows meaningful Kernel names without leaking internal environment ids', () => {
    expect(projectDesignTool(surface('kernel', 'execute', { action: 'execute', code: 'print(42)' }, {
      summary: 'Kernel execution completed', data: { name: 'Python 3 (analysis)' },
    }))).toMatchObject({ kind: 'kernel', family: 'Kernel', action: 'Run', target: 'Python 3 (analysis)' })
    expect(projectDesignTool(surface('kernel', 'sync_environment', { action: 'sync_environment', environment_id: 'env_internal_123' }, {
      summary: 'Kernel environment operation accepted', data: { environment_id: 'env_internal_123' },
    })).target).toBe('Kernel environment operation accepted')
  })

  it('renames Delegate profiles to Agent role nouns', () => {
    expect(projectDesignTool(surface('delegate', 'analysis', { profile: 'analysis', task: '检查性能异常' }))).toMatchObject({
      kind: 'agent', family: 'Agent', action: 'Analyzer', target: '检查性能异常',
    })
  })
})
