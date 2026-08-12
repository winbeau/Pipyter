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

  it('uses unified dropdowns and refreshes models when the model control opens', async () => {
    const onRefreshModels = vi.fn().mockResolvedValue(undefined)
    render(<Composer {...props} onRefreshModels={onRefreshModels} onSend={vi.fn()} onStop={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Pigent mode' })).toHaveTextContent('Ask')
    await userEvent.click(screen.getByRole('combobox', { name: 'Pigent model' }))
    expect(onRefreshModels).toHaveBeenCalledOnce()
  })

  it('supports keyboard navigation and Escape in the custom mode listbox', async () => {
    const onMode = vi.fn()
    render(<Composer {...props} onMode={onMode} onSend={vi.fn()} onStop={vi.fn()} />)
    const mode = screen.getByRole('combobox', { name: 'Pigent mode' })
    mode.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onMode).toHaveBeenCalledWith('plan')
    await userEvent.click(mode)
    expect(screen.getByRole('listbox', { name: 'Pigent mode options' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox', { name: 'Pigent mode options' })).toBeNull()
  })

  it('closes a custom listbox when clicking outside', async () => {
    render(<Composer {...props} onSend={vi.fn()} onStop={vi.fn()} />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Pigent mode' }))
    expect(screen.getByRole('listbox', { name: 'Pigent mode options' })).toBeVisible()
    await userEvent.click(screen.getByLabelText('Message Pigent'))
    expect(screen.queryByRole('listbox', { name: 'Pigent mode options' })).toBeNull()
  })
})
