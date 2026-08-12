import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ToolSurfaceModel } from '../types'
import { ToolSurface } from './surfaces'

const surface: ToolSurfaceModel = {
  id: 'surface:call', toolCallId: 'call', tool: 'bash', action: 'run', state: 'succeeded', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z', durationMs: 1000,
  output: { summary: 'Ran tests', data: { stdout: '19 tests passed', exit_code: 0 } }, error: {}, receipt: {}, actions: [], raw: {},
}

describe('ToolSurface', () => {
  it('renders tool output statically without a disclosure control', () => {
    render(<ToolSurface surface={surface} />)
    expect(screen.getByText('Ran tests')).toBeVisible()
    expect(screen.getByText(/19 tests passed/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /bash/i })).toBeNull()
  })

  it('keeps local file actions visible without adding a disclosure control', () => {
    const { container } = render(<ToolSurface surface={{ ...surface, tool: 'read', actions: [{ id: 'open', label: 'Open', value: 'src/model.py' }] }} />)
    expect(screen.getByRole('button', { name: 'Open' })).toBeVisible()
    expect(container.querySelector('details')).toBeNull()
  })
})
