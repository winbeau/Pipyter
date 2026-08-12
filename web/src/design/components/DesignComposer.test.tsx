import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DesignComposer } from './DesignComposer'

const models = [
  { id: 'deepseek:flash', provider: 'deepseek', model: 'deepseek-v4-flash', label: 'deepseek-v4-flash', configured: true },
  { id: 'deepseek:pro', provider: 'deepseek', model: 'deepseek-v4-pro', label: 'deepseek-v4-pro', configured: true },
]
const props = { models, model: models[0], mode: 'ask' as const, running: false, stopping: false, disabled: false, onRefreshModels: vi.fn(), onModel: vi.fn(), onMode: vi.fn(), onSend: vi.fn(), onStop: vi.fn() }

describe('DesignComposer', () => {
  it('sends through the real callback and switches real mode/model selections', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn(), onMode = vi.fn(), onModel = vi.fn(), onRefreshModels = vi.fn()
    render(<DesignComposer {...props} onSend={onSend} onMode={onMode} onModel={onModel} onRefreshModels={onRefreshModels} />)
    await user.type(screen.getByLabelText('Message Pigent'), '运行测试')
    await user.click(screen.getByRole('button', { name: '发送消息' }))
    expect(onSend).toHaveBeenCalledWith('运行测试')
    await user.click(screen.getByRole('combobox', { name: 'Pigent mode' }))
    await user.click(screen.getByRole('button', { name: /Auto/ }))
    expect(onMode).toHaveBeenCalledWith('auto')
    await user.click(screen.getByRole('button', { name: 'Pigent model' }))
    expect(onRefreshModels).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /deepseek-v4-pro/ }))
    expect(onModel).toHaveBeenCalledWith(models[1])
    expect(screen.queryByRole('button', { name: 'Thinking strength' })).toBeNull()
    expect(screen.queryByLabelText(/context used/)).toBeNull()
  })

  it('shows stop instead of send while a run is active', async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()
    render(<DesignComposer {...props} running onStop={onStop} />)
    expect(screen.queryByRole('button', { name: '发送消息' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '停止运行' }))
    expect(onStop).toHaveBeenCalled()
  })

  it('closes an open menu from document Escape', async () => {
    const user = userEvent.setup()
    render(<DesignComposer {...props} />)
    await user.click(screen.getByRole('button', { name: 'Pigent model' }))
    expect(screen.getByText('Models')).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Models')).toBeNull()
  })
})
