import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesignPage } from './DesignPage'

const mocks = vi.hoisted(() => ({
  usePigent: vi.fn(),
  loadEarlier: vi.fn(async () => undefined),
}))

vi.mock('../pigent/store', () => ({
  usePigent: () => mocks.usePigent(),
  currentTasks: () => null,
}))
vi.mock('../pigent/feed', () => ({ projectFeed: (events: unknown[]) => events }))
vi.mock('../design/components/DesignLiveFeedItem', () => ({
  DesignLiveFeed: ({ items }: { items: Array<{ id: string }> }) => <div data-testid="feed">{items.map((item) => <span key={item.id}>{item.id}</span>)}</div>,
}))
vi.mock('../design/components/DesignSidebar', () => ({ DesignSidebar: () => <aside /> }))
vi.mock('../design/components/DesignComposer', () => ({ DesignComposer: () => <div /> }))
vi.mock('../pigent/components/TaskCard', () => ({ TaskCard: () => <div /> }))

function event(id: number) {
  return { id: `event-${id}`, event_id: String(id) }
}

function context(overrides: Record<string, unknown> = {}) {
  const state = {
    sessions: [{ id: 'session-1', title: 'Session 1' }],
    activeSessionId: 'session-1',
    eventsById: { 1: event(1) },
    userMessages: [],
    historyHasMore: true,
    historyLoading: false,
    connectionState: 'connected',
    capabilities: { tools: ['read'] },
    model: { model: 'deepseek-v4' },
    modelChoices: [],
    pendingModel: null,
    mode: 'auto',
    pendingMode: null,
    runActive: false,
    stopping: false,
    error: null,
    ...overrides,
  }
  return {
    state,
    actions: {
      loadEarlier: mocks.loadEarlier,
      newSession: vi.fn(), projectCreationOptions: vi.fn(), newProject: vi.fn(), selectSession: vi.fn(), renameSession: vi.fn(), deleteSession: vi.fn(),
      retry: vi.fn(), openShell: vi.fn(), resolveInteraction: vi.fn(), artifactUrl: vi.fn(),
      refreshCapabilities: vi.fn(), setModel: vi.fn(), setMode: vi.fn(), send: vi.fn(), stop: vi.fn(),
    },
  }
}

describe('DesignPage history scrolling', () => {
  let scrollHeight = 1000
  let clientHeight = 300

  beforeEach(() => {
    scrollHeight = 1000
    clientHeight = 300
    mocks.loadEarlier.mockClear()
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => scrollHeight })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => clientHeight })
  })

  it('opens at the newest message and removes the manual history button', () => {
    mocks.usePigent.mockReturnValue(context())
    const { container } = render(<DesignPage />)
    expect(container.querySelector('.design-thread')).toHaveProperty('scrollTop', 1000)
    expect(screen.queryByRole('button', { name: /加载更早/ })).toBeNull()
  })

  it('loads near the top and preserves the viewport anchor after prepending history', () => {
    let value = context()
    mocks.usePigent.mockImplementation(() => value)
    const { container, rerender } = render(<DesignPage />)
    const thread = container.querySelector('.design-thread') as HTMLDivElement

    thread.scrollTop = 40
    fireEvent.scroll(thread)
    expect(mocks.loadEarlier).toHaveBeenCalledTimes(1)

    value = context({ historyLoading: true })
    rerender(<DesignPage />)
    scrollHeight = 1400
    value = context({ eventsById: { 0: event(0), 1: event(1) }, historyLoading: false })
    rerender(<DesignPage />)
    expect(thread.scrollTop).toBe(440)
  })

  it('follows new messages near the bottom but leaves an upward-reading viewport alone', () => {
    let value = context({ historyHasMore: false })
    mocks.usePigent.mockImplementation(() => value)
    const { container, rerender } = render(<DesignPage />)
    const thread = container.querySelector('.design-thread') as HTMLDivElement

    thread.scrollTop = 680
    fireEvent.scroll(thread)
    scrollHeight = 1120
    value = context({ historyHasMore: false, eventsById: { 1: event(1), 2: event(2) } })
    rerender(<DesignPage />)
    expect(thread.scrollTop).toBe(1120)

    thread.scrollTop = 300
    fireEvent.scroll(thread)
    scrollHeight = 1260
    value = context({ historyHasMore: false, eventsById: { 1: event(1), 2: event(2), 3: event(3) } })
    rerender(<DesignPage />)
    expect(thread.scrollTop).toBe(300)
  })

  it('scrolls a newly selected session directly to its latest message', () => {
    let value = context()
    mocks.usePigent.mockImplementation(() => value)
    const { container, rerender } = render(<DesignPage />)
    const thread = container.querySelector('.design-thread') as HTMLDivElement
    thread.scrollTop = 120
    scrollHeight = 1800
    value = context({
      activeSessionId: 'session-2',
      sessions: [{ id: 'session-2', title: 'Session 2' }],
      eventsById: { 9: event(9) },
    })
    rerender(<DesignPage />)
    expect(thread.scrollTop).toBe(1800)
  })
})
