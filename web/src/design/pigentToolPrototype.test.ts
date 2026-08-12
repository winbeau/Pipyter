import { describe, expect, it } from 'vitest'
import { DESIGN_TOOL_SURFACES, projectPrototypeTool } from './pigentToolPrototype'

describe('Pigent Design tool projection', () => {
  it('adapts the shared ToolSurfaceModel contract to Read, Write, and Update rows', () => {
    const [read, write, update] = DESIGN_TOOL_SURFACES.map(projectPrototypeTool)
    expect([read?.label, write?.label, update?.label]).toEqual(['Read', 'Write', 'Update'])
    expect(read?.filename).toBe('modes.ts')
    expect(write).toMatchObject({ additions: 7, deletions: 0 })
    expect(update).toMatchObject({ additions: 2, deletions: 1 })
    expect(update?.lines.some((line) => line.tone === 'removed')).toBe(true)
    expect(update?.lines.some((line) => line.tone === 'added')).toBe(true)
  })
})
