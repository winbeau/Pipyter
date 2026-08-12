import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InteractionCard } from './InteractionCard'

const interaction = { version: 1 as const, interaction_id: 'i', session_id: 's', tool_call_id: 'c', kind: 'review_request' as const, summary: 'Allow?', choices: ['allow_once', 'reject'] as const }

describe('InteractionCard', () => {
  it('locks one decision and invokes real resolver', async () => {
    const resolve = vi.fn().mockResolvedValue(undefined)
    render(<InteractionCard interaction={{ ...interaction, choices: [...interaction.choices] }} revision={3} onOpenShell={vi.fn()} onResolve={resolve} />)
    await userEvent.click(screen.getByRole('button', { name: '允许一次' }))
    expect(resolve).toHaveBeenCalledWith('i', 3, 'allow_once')
  })

  it('renders receipt state without decision buttons', () => {
    render(<InteractionCard interaction={{ ...interaction, choices: [...interaction.choices] }} resolved onOpenShell={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Resolved')
    expect(screen.queryByRole('button', { name: '允许一次' })).toBeNull()
  })
})
