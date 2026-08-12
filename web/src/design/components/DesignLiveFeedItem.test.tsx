import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FeedItem } from '../../pigent/types'
import { DesignLiveFeed, DesignLiveFeedItem, groupDesignLiveFeed } from './DesignLiveFeedItem'

const props = { onRetry: vi.fn(), onOpenShell: vi.fn(), onResolve: vi.fn(), artifactUrl: vi.fn(() => '') }

function tool(id: string, name: string, action?: string): FeedItem {
  return {
    kind: 'tool',
    id,
    surface: {
      id, toolCallId: id, tool: name, action, state: 'succeeded', actions: [], raw: {},
      input: name === 'notebook' ? { action, path: `${id}.ipynb`, cell_id: `${id}-cell` } : { path: `${id}.txt`, name: id },
      output: { summary: `${name} completed`, data: { path: name === 'notebook' ? `${id}.ipynb` : `${id}.txt`, content: `${id} content` } },
    },
  }
}

function userMessage(id: string): FeedItem {
  return { kind: 'user', id, message: { clientMessageId: id, content: id, behavior: 'prompt', state: 'settled', createdAt: '2026-08-12T00:00:00Z' } }
}

function bash(id: string, stdout = '', outputTail = ''): FeedItem {
  return {
    kind: 'tool', id,
    surface: {
      id, toolCallId: id, tool: 'bash', state: 'succeeded', actions: [], raw: {},
      input: { command: `secret-command-${id}` },
      output: { summary: 'command completed', data: { stdout, output_tail: outputTail } },
    },
  }
}

function notebookInsert(id: string, path: string, action: 'insert_cell' | 'add_markdown', source: string, cell: Record<string, unknown>): FeedItem {
  return {
    kind: 'tool', id,
    surface: {
      id, toolCallId: id, tool: 'notebook', action, state: 'succeeded', actions: [], raw: {},
      input: { action, path, source },
      output: { summary: 'Notebook insert completed', data: { path, cell: { source, ...cell } } },
    },
  }
}

describe('DesignLiveFeedItem', () => {
  it('hides Tasks tool rows because the snapshot is persistent above the composer', () => {
    const item: FeedItem = { kind: 'tool', id: 'tasks', surface: { id: 'tasks', toolCallId: 'tasks', tool: 'tasks', action: 'patch', state: 'succeeded', actions: [], raw: {} } }
    const { container } = render(<DesignLiveFeedItem item={item} {...props} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Tasks')).toBeNull()
  })

  it('renders assistant text without a copy control', () => {
    const item: FeedItem = { kind: 'assistant', id: 'assistant', text: '完成', timestamp: '2026-08-12T00:00:00Z', thinking: false }
    const { container } = render(<DesignLiveFeedItem item={item} {...props} />)
    expect(screen.getByText('完成')).toBeVisible()
    expect(screen.queryByRole('button', { name: '复制回复' })).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('shows thinking as a logo-free single line', () => {
    const item: FeedItem = { kind: 'assistant', id: 'thinking', text: 'The running lab server cannot see uv in its PATH.', timestamp: '2026-08-12T00:00:00Z', thinking: true }
    const { container } = render(<DesignLiveFeedItem item={item} {...props} />)
    expect(screen.getByText(/running lab server/)).toHaveClass('design-live-thinking')
    expect(container.querySelector('svg')).toBeNull()
  })

  it('groups consecutive passive activity, including Bash, without letting hidden Tasks break it', () => {
    const rows = groupDesignLiveFeed([
      tool('read-1', 'read'), bash('bash-1', 'ok'), tool('view-1', 'view'), tool('tasks-1', 'tasks'), tool('read-2', 'read'),
      userMessage('boundary'), tool('inspect-1', 'inspect'),
    ])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ kind: 'read-group', items: [{ id: 'read-1' }, { id: 'bash-1' }, { id: 'view-1' }, { id: 'read-2' }] })
    expect(rows[1]).toMatchObject({ kind: 'item', item: { id: 'boundary' } })
    expect(rows[2]).toMatchObject({ kind: 'read-group', items: [{ id: 'inspect-1' }] })
  })

  it('shows a non-interactive compact category count for even a single passive call', () => {
    const { container } = render(<DesignLiveFeed items={[tool('read-1', 'read')]} {...props} />)
    expect(screen.getByText('Read')).toBeVisible()
    expect(screen.getByText('×1')).toBeVisible()
    expect(container.querySelector('.design-tool-call-chevron')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('read-1.txt')).toBeNull()
  })

  it('shows compact counts without exposing or expanding the underlying calls', () => {
    const { container } =
    render(<DesignLiveFeed items={[
      tool('read-1', 'read'), tool('read-2', 'read'), tool('view-1', 'view'), tool('inspect-1', 'inspect'),
      tool('notebook-1', 'notebook', 'read_cell'), tool('notebook-2', 'notebook', 'read_cell'),
    ]} {...props} />)

    expect(container.querySelector('.design-read-group-trigger')).toHaveTextContent('Read×2View×1Inspect×1Notebook Read×2')
    expect(container.querySelector('.design-tool-call-chevron')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('read-1.txt')).toBeNull()
    expect(screen.queryByText(/\.ipynb · Cell/)).toBeNull()
  })

  it('shows only the latest Bash call with a usable first output line and never its command', () => {
    render(<DesignLiveFeed items={[
      bash('bash-1', '\n first result\nsecond line'),
      bash('bash-2'),
      bash('bash-3', '   ', '\n final result\nmore detail'),
    ]} {...props} />)

    expect(screen.getByText('Bash')).toBeVisible()
    expect(screen.getByText('×3')).toBeVisible()
    expect(screen.getByText('final result')).toBeVisible()
    expect(screen.queryByText('first result')).toBeNull()
    expect(screen.queryByText(/secret-command/)).toBeNull()
  })

  it('does not aggregate notebook mutations with read activity', () => {
    const rows = groupDesignLiveFeed([tool('read-1', 'read'), tool('notebook-update', 'notebook', 'update_cell'), tool('read-2', 'read')])
    expect(rows.map((row) => row.kind)).toEqual(['read-group', 'item', 'read-group'])
  })

  it('groups consecutive insert and markdown calls for the same notebook while Tasks remain invisible', () => {
    const rows = groupDesignLiveFeed([
      notebookInsert('insert-1', 'reports/analysis.ipynb', 'insert_cell', 'x = 1', { index: 2 }),
      tool('tasks-1', 'tasks'),
      notebookInsert('insert-2', 'reports/analysis.ipynb', 'add_markdown', '# Result', { index: 3 }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'notebook-insert-group', path: 'reports/analysis.ipynb', items: [{ id: 'insert-1' }, { id: 'insert-2' }] })
  })

  it('keeps a single insert and inserts for different notebook paths as ordinary tool calls', () => {
    const single = groupDesignLiveFeed([notebookInsert('insert-1', 'one.ipynb', 'insert_cell', 'x = 1', { index: 0 })])
    const different = groupDesignLiveFeed([
      notebookInsert('insert-1', 'one.ipynb', 'insert_cell', 'x = 1', { index: 0 }),
      notebookInsert('insert-2', 'two.ipynb', 'insert_cell', 'y = 2', { index: 0 }),
    ])
    expect(single).toMatchObject([{ kind: 'item', item: { id: 'insert-1' } }])
    expect(different).toMatchObject([{ kind: 'item', item: { id: 'insert-1' } }, { kind: 'item', item: { id: 'insert-2' } }])
  })

  it('expands an insert batch into indexed Cell tabs and displays only the selected source', async () => {
    const user = userEvent.setup()
    const { container } = render(<DesignLiveFeed items={[
      notebookInsert('insert-1', 'reports/analysis.ipynb', 'insert_cell', 'first = 1\nprint(first)', { index: 4 }),
      notebookInsert('insert-2', 'reports/analysis.ipynb', 'add_markdown', '## Summary\n\nDetails', { one_based_index: 9 }),
    ]} {...props} />)

    const trigger = screen.getByRole('button', { name: /Notebook.*Insert.*×2.*analysis\.ipynb/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('.design-notebook-insert-source')).toBeNull()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tab', { name: 'Cell 5' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Cell 9' })).toHaveAttribute('aria-selected', 'false')
    expect(container.querySelector('.design-notebook-insert-source')?.textContent).toBe('first = 1\nprint(first)')
    expect(container.querySelector('.design-notebook-insert-source')).not.toHaveTextContent('Summary')

    await user.click(screen.getByRole('tab', { name: 'Cell 9' }))
    expect(screen.getByRole('tab', { name: 'Cell 9' })).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelector('.design-notebook-insert-source')?.textContent).toBe('## Summary\n\nDetails')
    expect(container.querySelector('.design-notebook-insert-source')).not.toHaveTextContent('first = 1')
  })
})
