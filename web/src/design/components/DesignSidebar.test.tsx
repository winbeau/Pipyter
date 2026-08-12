import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PigentSession } from '../../pigent/types'
import { DesignSidebar } from './DesignSidebar'

const sessions = [
  { id: 's1', title: '工具调用展示', status: 'active' },
  { id: 's2', title: 'WSL连接测试', status: 'completed' },
] as PigentSession[]

const projectOptions = {
  defaultWorkspace: '/home/winbeau/Projects/Pipyter',
  kernels: [{ name: 'python3', display_name: 'Python 3', language: 'python' }],
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    sessions,
    activeId: 's1',
    onNew: vi.fn(),
    onLoadProjectOptions: vi.fn(async () => projectOptions),
    onNewProject: vi.fn(async () => undefined),
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
}

describe('DesignSidebar', () => {
  it('selects real sessions, creates a session, and exposes rename/delete from the context menu', async () => {
    const user = userEvent.setup()
    const onNew = vi.fn(), onSelect = vi.fn(), onRename = vi.fn(), onDelete = vi.fn()
    vi.spyOn(window, 'prompt').mockReturnValue('新标题')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<DesignSidebar {...props({ onNew, onSelect, onRename, onDelete })} />)
    await user.click(screen.getByRole('button', { name: '新建对话' }))
    expect(onNew).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'WSL连接测试' }))
    expect(onSelect).toHaveBeenCalledWith('s2')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'WSL连接测试' }), { clientX: 100, clientY: 120 })
    expect(screen.getByRole('menu', { name: '管理 WSL连接测试' })).toBeVisible()
    await user.click(screen.getByRole('menuitem', { name: '重命名' }))
    expect(onRename).toHaveBeenCalledWith('s2', '新标题')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'WSL连接测试' }), { clientX: 100, clientY: 120 })
    await user.click(screen.getByRole('menuitem', { name: '删除' }))
    expect(onDelete).toHaveBeenCalledWith('s2')
  })

  it('opens from the keyboard shortcut and closes from document Escape', () => {
    render(<DesignSidebar {...props()} />)
    const session = screen.getByRole('button', { name: '工具调用展示' })
    fireEvent.keyDown(session, { key: 'F10', shiftKey: true })
    expect(screen.getByRole('menu', { name: '管理 工具调用展示' })).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(session).toHaveFocus()
  })

  it('loads real project options and creates a project session without affecting normal new chat', async () => {
    const user = userEvent.setup()
    const onNew = vi.fn()
    const onLoadProjectOptions = vi.fn(async () => projectOptions)
    const onNewProject = vi.fn(async () => undefined)
    render(<DesignSidebar {...props({ onNew, onLoadProjectOptions, onNewProject })} />)

    await user.click(screen.getByRole('button', { name: '新建对话' }))
    expect(onNew).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: '新建项目' }))
    expect(await screen.findByRole('dialog', { name: '新建项目' })).toBeVisible()
    expect(onLoadProjectOptions).toHaveBeenCalledTimes(1)
    const workspace = await screen.findByLabelText('Workspace directory')
    expect(workspace).toHaveValue('/home/winbeau/Projects/Pipyter')
    await user.clear(workspace)
    await user.type(workspace, '/tmp/research')
    await user.selectOptions(screen.getByLabelText('Kernel'), 'python3')
    await user.click(screen.getByRole('button', { name: '创建项目' }))
    expect(onNewProject).toHaveBeenCalledWith({ workspace: '/tmp/research', kernelName: 'python3' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('supports no kernel, empty state, Escape, backdrop, and retrying option errors', async () => {
    const user = userEvent.setup()
    const onLoadProjectOptions = vi.fn()
      .mockRejectedValueOnce(new Error('runtime offline'))
      .mockResolvedValueOnce({ defaultWorkspace: '.', kernels: [] })
    const onNewProject = vi.fn(async () => undefined)
    render(<DesignSidebar {...props({ onLoadProjectOptions, onNewProject })} />)

    await user.click(screen.getByRole('button', { name: '新建项目' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('runtime offline')
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText(/未发现可用 Kernel/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: '创建项目' }))
    expect(onNewProject).toHaveBeenCalledWith({ workspace: '.', kernelName: null })

    await user.click(screen.getByRole('button', { name: '新建项目' }))
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: '新建项目' }))
    await screen.findByRole('dialog')
    fireEvent.mouseDown(document.querySelector('.design-project-backdrop')!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
