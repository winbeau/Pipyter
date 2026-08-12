import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PigentHeader } from './PigentHeader'

describe('PigentHeader', () => {
  it('keeps a stop-task action available while a run is active', async () => {
    const onStop = vi.fn().mockResolvedValue(undefined)
    render(<PigentHeader runActive onStop={onStop} />)
    await userEvent.click(screen.getByRole('button', { name: '停止任务' }))
    expect(onStop).toHaveBeenCalledOnce()
  })
})
