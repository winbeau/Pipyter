import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ToolSurfaceModel } from '../../pigent/types'
import { DesignLiveToolCall } from './DesignLiveToolCall'

const notebook: ToolSurfaceModel = {
  id: 'surface:notebook-1', toolCallId: 'notebook-1', tool: 'notebook', action: 'run_cell', state: 'succeeded',
  input: { action: 'run_cell', path: 'analysis.ipynb', cell_id: 'cell-1' },
  output: { summary: 'Ran cell', data: { path: 'analysis.ipynb', cell: { index: 1, cell_id: 'cell-1', source: 'print("ok")', outputs: [{ output_type: 'stream', text: 'ok\n' }] } } },
  actions: [], raw: {},
}

function surface(tool: string, action = '', overrides: Partial<ToolSurfaceModel> = {}): ToolSurfaceModel {
  return {
    id: `surface:${tool}:${action}`,
    toolCallId: `${tool}:${action}`,
    tool,
    action,
    state: 'succeeded',
    input: action ? { action } : {},
    output: { summary: `${tool} completed`, data: {} },
    actions: [],
    raw: {},
    ...overrides,
  }
}

describe('DesignLiveToolCall', () => {
  it('shows the semantic Notebook capsule and expands real result details', async () => {
    const user = userEvent.setup()
    render(<DesignLiveToolCall surface={notebook} />)
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveTextContent('NotebookRunanalysis.ipynb · Cell 2')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('print("ok")')).toBeVisible()
    expect(screen.getByText((_, node) => node?.tagName === 'PRE' && node.textContent?.includes('ok') === true)).toBeVisible()
  })

  it('renders markdown cells as Markdown and code cells with Jupyter prompts', async () => {
    const markdown = surface('notebook', 'update_cell', {
      input: { action: 'update_cell', path: 'notes.ipynb', cell_id: 'md-1' },
      output: { summary: 'updated', data: { path: 'notes.ipynb', cell: { index: 0, cell_id: 'md-1', cell_type: 'markdown', source: '# Heading\n\n**Rendered**' } } },
    })
    const markdownView = render(<DesignLiveToolCall surface={markdown} />)
    const { container } = markdownView
    await userEvent.setup().click(screen.getByRole('button'))
    expect(container.querySelector('.design-jupyter-markdown h1')).toHaveTextContent('Heading')
    expect(screen.getByText('Rendered')).toBeVisible()
    markdownView.unmount()

    const code = surface('notebook', 'run_cell', {
      input: { action: 'run_cell', path: 'notes.ipynb', cell_id: 'code-1' },
      output: { summary: 'ran', data: { path: 'notes.ipynb', cell: { index: 1, cell_id: 'code-1', cell_type: 'code', execution_count: 3, source: '2 + 2', outputs: [{ output_type: 'execute_result', data: { 'text/plain': '4' } }] } } },
    })
    const view = render(<DesignLiveToolCall surface={code} />)
    await userEvent.setup().click(view.getByRole('button'))
    expect(view.container.querySelector('.design-jupyter-prompt')).toHaveTextContent('In [3]:')
    expect(view.container.querySelector('.design-jupyter-output-text')).toHaveTextContent('4')
  })

  it('uses capsule shimmer instead of a left spinner while running', () => {
    const running = { ...notebook, state: 'running' as const }
    const { container } = render(<DesignLiveToolCall surface={running} />)
    expect(container.querySelector('.design-live-tool')).toHaveClass('state-running')
    expect(container.querySelector('.design-live-tool-spinner')).toBeNull()
    expect(screen.getByText('Notebook')).toBeVisible()
  })

  it.each([
    ['read', ''],
    ['view', ''],
    ['inspect', 'variable'],
    ['bash', 'run'],
    ['kernel', 'create_temporary'],
    ['kernel', 'status'],
    ['kernel', 'sync_environment'],
    ['kernel', 'list_environments'],
    ['kernel', 'start_environment'],
    ['kernel', 'promote_environment'],
    ['kernel', 'delete_environment'],
    ['kernel', 'interrupt'],
    ['kernel', 'restart'],
    ['kernel', 'shutdown'],
    ['notebook', 'read_cell'],
    ['notebook', 'move_cell'],
    ['notebook', 'clear_output'],
    ['custom_json_tool', 'query'],
  ])('renders %s %s as a static one-line call without disclosure controls', (tool, action) => {
    const { container } = render(<DesignLiveToolCall surface={surface(tool, action)} />)
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('[aria-expanded]')).toBeNull()
    expect(container.querySelector('.design-tool-call-chevron')).toBeNull()
    expect(container.querySelector('.design-tool-call-trigger')).toHaveClass('is-static')
  })

  it('shows only Bash output when a Bash call is rendered by itself', () => {
    render(<DesignLiveToolCall surface={surface('bash', 'run', {
      input: { command: 'printf secret-command' },
      output: { summary: 'Executed command', data: { stdout: '\n42 tests passed\nmore output' } },
    })} />)
    expect(screen.getByText('42 tests passed')).toBeVisible()
    expect(screen.queryByText(/secret-command/)).toBeNull()
  })

  it.each([
    ['write', ''],
    ['update', ''],
    ['delegate', 'analysis'],
    ['kernel', 'execute'],
    ['kernel', 'run'],
    ['notebook', 'update_cell'],
    ['notebook', 'delete_cell'],
    ['notebook', 'run_cell'],
    ['notebook', 'insert_cell'],
    ['notebook', 'add_markdown'],
  ])('keeps meaningful %s %s details expandable', (tool, action) => {
    const { container } = render(<DesignLiveToolCall surface={surface(tool, action)} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('.design-tool-call-chevron')).not.toBeNull()
  })
})
