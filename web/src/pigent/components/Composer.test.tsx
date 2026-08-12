import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Composer } from './Composer'

const props = { mode: 'ask' as const, pendingMode: null, onMode: vi.fn(), model: { provider: 'faux', model: 'm' }, modelChoices: [{ id: 'm', label: 'm', provider: 'faux', model: 'm', configured: true }], pendingModel: null, onModel: vi.fn() }

describe('Composer', () => {
  it('sends and clears only after acceptance', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer {...props} onSend={onSend} onStop={vi.fn()} />)
    const input = screen.getByLabelText('Message Pigent')
    await userEvent.type(input, 'hello{enter}')
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('hello'))
    expect(input).toHaveValue('')
  })

  it('exposes a real stop handler and stopping state', async () => {
    const onStop = vi.fn().mockResolvedValue(undefined)
    render(<Composer {...props} running stopping={false} onSend={vi.fn()} onStop={onStop} />)
    await userEvent.click(screen.getByLabelText('停止运行'))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('supports Shift+Enter newline', () => {
    render(<Composer {...props} onSend={vi.fn()} onStop={vi.fn()} />)
    const input = screen.getByLabelText('Message Pigent')
    fireEvent.change(input, { target: { value: 'one' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(input).toHaveValue('one')
  })
})
