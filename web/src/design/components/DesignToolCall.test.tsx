import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DESIGN_TOOL_SURFACES } from '../pigentToolPrototype'
import { DesignToolCall } from './DesignToolCall'

describe('DesignToolCall', () => {
  it('starts as one line and toggles a line-numbered Read preview', async () => {
    const user = userEvent.setup()
    render(<DesignToolCall surface={DESIGN_TOOL_SURFACES[0]!} />)
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveTextContent('Read')
    expect(trigger).toHaveTextContent('modes.ts')
    expect(screen.queryByRole('region')).toBeNull()
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: /Read preview/ })).toHaveTextContent("export const modes = ['ask', 'plan', 'auto'] as const")
    await user.click(trigger)
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('shows Write additions and zero deletions before expansion', () => {
    const { container } = render(<DesignToolCall surface={DESIGN_TOOL_SURFACES[1]!} />)
    expect(screen.getByRole('button')).toHaveTextContent('Writeagent-mode.ts+7-0')
    expect(container.querySelector('.design-tool-call')).toHaveClass('is-write')
  })
})
