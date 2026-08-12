import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssistantMessage } from './AssistantMessage'

describe('AssistantMessage', () => {
  it('renders final output as normal markdown without a Pigent logo or copy control', () => {
    const { container } = render(<AssistantMessage text="**完成**\n\n结果已保存。" timestamp="2026-08-12T00:00:00Z" />)

    expect(screen.getByText('完成')).toBeVisible()
    expect(screen.getByText('完成').tagName).toBe('STRONG')
    expect(container.querySelector('article')?.textContent).toContain('结果已保存。')
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })

  it('renders thinking as a bold italic single line without a logo', () => {
    const { container } = render(<AssistantMessage text="正在检查 notebook 的运行环境……" timestamp="2026-08-12T00:00:00Z" thinking />)
    const line = screen.getByText('正在检查 notebook 的运行环境……')

    expect(line).toHaveClass('pigent-assistant-thinking')
    expect(line).not.toHaveClass('pigent-assistant-event')
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })
})
