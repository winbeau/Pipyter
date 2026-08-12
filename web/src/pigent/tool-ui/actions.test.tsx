import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SurfaceActions } from './actions'

const open = vi.fn()
Object.defineProperty(window, 'open', { value: open, configurable: true })

describe('SurfaceActions', () => {
  it('executes expand and href-backed open/download actions', async () => {
    const onExpand = vi.fn()
    render(<SurfaceActions onExpand={onExpand} actions={[
      { id: 'expand', label: 'Expand' },
      { id: 'open', label: 'Open', href: 'https://runtime.test/artifact' },
      { id: 'download', label: 'Download', href: 'https://runtime.test/artifact?download=true' },
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: /Expand/ }))
    expect(onExpand).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: /Open/ }))
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://runtime.test/artifact', '_blank', 'noopener,noreferrer'))
    fireEvent.click(screen.getByRole('button', { name: /Download/ }))
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://runtime.test/artifact?download=true', '_blank', 'noopener,noreferrer'))
  })
})
