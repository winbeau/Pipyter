import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../store'
import { demoNotebookPath } from '../demo'

type MenuEntry = { label?: string; action?: () => void; disabled?: boolean; divider?: boolean }

function MenuBar() {
  const { state, actions } = useWorkspace()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const activeDoc = state.openDocs.find((doc) => doc.path === state.active) ?? null

  useEffect(() => {
    if (!openMenu) return
    const close = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setOpenMenu(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [openMenu])

  const notebookActive = activeDoc?.kind === 'notebook'
  const demoOnly = state.mode === 'demo'

  const menus: Record<string, MenuEntry[]> = {
    File: [
      { label: '新建文件…', action: () => actions.showPrompt('新建文件', '文件名', 'untitled.py', (name) => void actions.newFile(state.cwd, name)) },
      { label: '新建文件夹…', action: () => actions.showPrompt('新建文件夹', '文件夹名', 'untitled', (name) => void actions.newFolder(state.cwd, name)) },
      { divider: true },
      { label: '保存', action: () => activeDoc && void actions.saveDoc(activeDoc.path), disabled: !activeDoc },
      { label: '刷新文件列表', action: () => void actions.refreshTree() },
      { divider: true },
      { label: '关闭标签', action: () => state.active && actions.closeDoc(state.active), disabled: !activeDoc },
      { label: '关闭全部', action: () => actions.closeAll(), disabled: state.openDocs.length === 0 },
    ],
    Edit: [
      { label: '插入 Cell（上方）', action: () => notebookActive && activeDoc && actions.insertCell(activeDoc.path, 0, 'code'), disabled: !notebookActive },
      { label: '插入 Cell（下方）', action: () => notebookActive && activeDoc && actions.insertCell(activeDoc.path, 0, 'code'), disabled: !notebookActive },
      { label: '清除全部输出', action: () => undefined, disabled: true },
    ],
    View: [
      { label: state.leftOpen ? '隐藏左侧面板' : '显示左侧面板', action: () => actions.setLeftOpen(!state.leftOpen) },
      { label: state.bottomOpen ? '隐藏底部终端' : '显示底部终端', action: () => actions.setBottomOpen(!state.bottomOpen) },
    ],
    Run: [
      { label: '运行 Cell（全部运行需要打开 Notebook）', action: () => notebookActive && activeDoc && void actions.runAll(activeDoc.path), disabled: !notebookActive },
      { label: '重启 Kernel', action: () => void actions.restartKernel(), disabled: !state.kernelId },
      { label: '中断 Kernel', action: () => void actions.interruptKernel(), disabled: !state.kernelId },
    ],
    Kernel: [
      { label: '启动 Python 3 Kernel', action: () => void actions.startKernel() },
      { label: '重启 Kernel', action: () => void actions.restartKernel(), disabled: !state.kernelId },
      { label: '中断执行', action: () => void actions.interruptKernel(), disabled: !state.busy },
      { label: '关闭 Kernel', action: () => state.kernelId && void actions.shutdownKernel(state.kernelId), disabled: !state.kernelId },
    ],
    Tabs: [
      ...state.openDocs.map((doc) => ({
        label: doc.path,
        action: () => actions.setActive(doc.path),
      })),
      { divider: true },
      { label: '关闭全部', action: () => actions.closeAll(), disabled: state.openDocs.length === 0 },
    ],
    Settings: [
      { label: '设置', action: () => actions.showSettings() },
      { label: '关于 Pipyter', action: () => actions.showAbout() },
    ],
    Help: [
      { label: '快捷键', action: () => actions.showToast('Cell 内：Shift+Enter 运行并前进 · Esc 退出编辑 · A/B 插入上下 Cell · D D 删除') },
      { label: '关于 Pipyter', action: () => actions.showAbout() },
    ],
  }

  const toggle = (name: string) => setOpenMenu((current) => (current === name ? null : name))

  return (
    <div className="ws-menubar" ref={barRef}>
      {Object.entries(menus).map(([name, entries]) => (
        <div className="ws-menu" key={name}>
          <button
            type="button"
            className={`ws-menu-trigger${openMenu === name ? ' ws-menu-open' : ''}`}
            onClick={() => toggle(name)}
          >
            {name}
          </button>
          {openMenu === name && (
            <div className="ws-menu-popover">
              {entries.map((entry, index) =>
                entry.divider ? (
                  <div className="ws-menu-divider" key={index} />
                ) : (
                  <button
                    type="button"
                    key={index}
                    className="ws-menu-item"
                    disabled={entry.disabled}
                    onClick={() => {
                      setOpenMenu(null)
                      entry.action?.()
                    }}
                  >
                    {entry.label ?? ''}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
      <div className="ws-menubar-spacer" />
      <div className="ws-menubar-meta">
        <button
          type="button"
          className="ws-kernel-badge ws-kernel-button"
          onClick={actions.showKernels}
          title="Kernels：选择 / 切换 / 管理"
        >
          <span className={`ws-dot ${state.busy ? 'ws-dot-busy' : ''}`} />
          Python 3{demoOnly ? ' · 演示' : ''}
          <span className="ws-kernel-caret">▾</span>
        </button>
      </div>
    </div>
  )
}

export default MenuBar
