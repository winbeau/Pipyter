import { useEffect, useMemo, useRef, useState } from 'react'
import type { KernelOutput } from '../../../../packages/protocol/src/index'
import { useWorkspace } from '../store'
import type { CellModel } from '../types'
import { findAction } from '../keymap'
import {
  IconChevronsDown,
  IconChevronsUp,
  IconClose,
  IconCopy,
  IconCut,
  IconNotebook,
  IconPaste,
  IconPlay,
  IconRestart,
  IconSave,
  IconSpinner,
  IconStop,
  IconPlus,
} from '../icons'

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

export function OutputView({ output }: { output: KernelOutput }) {
  const [collapsed, setCollapsed] = useState(false)
  if (output.type === 'stream') {
    return <pre className="ws-output-stream">{output.text}</pre>
  }
  if (output.type === 'error') {
    const trace = output.traceback.length > 0 ? stripAnsi(output.traceback.join('\n')) : output.text
    const lines = trace.split('\n')
    const visible = lines.length > 12 ? lines.slice(0, 12).join('\n') + '\n… (traceback truncated)' : trace
    return <pre className="ws-output-error">{visible}</pre>
  }
  const data = output.data
  const png = typeof data['image/png'] === 'string' ? (data['image/png'] as string) : undefined
  const svg = typeof data['image/svg+xml'] === 'string' ? (data['image/svg+xml'] as string) : undefined
  const html = typeof data['text/html'] === 'string' ? (data['text/html'] as string) : undefined
  const markdown = typeof data['text/markdown'] === 'string' ? (data['text/markdown'] as string) : undefined
  const json = data['application/json']
  const plain = typeof data['text/plain'] === 'string' ? (data['text/plain'] as string) : output.text
  return (
    <div className="ws-output-block">
      <button type="button" className="ws-output-collapse" onClick={() => setCollapsed((value) => !value)}>
        {collapsed ? '▸' : '▾'}
      </button>
      {collapsed ? null : png ? (
        <img className="ws-output-image" src={`data:image/png;base64,${png}`} alt="figure output (png)" />
      ) : svg ? (
        <img className="ws-output-image" src={svg.startsWith('data:') ? svg : `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt="figure output (svg)" />
      ) : html ? (
        <iframe
          className="ws-output-html"
          sandbox="allow-same-origin"
          srcDoc={`<base target="_blank">${html}`}
          title="rich html output"
        />
      ) : markdown ? (
        <div className="ws-output-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
      ) : json !== undefined ? (
        <pre className="ws-output-result">{JSON.stringify(json, null, 2)}</pre>
      ) : (
        <pre className="ws-output-result">{plain || String(json ?? JSON.stringify(data))}</pre>
      )}
    </div>
  )
}

function renderMarkdown(source: string): string {
  const escaped = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  const lines = escaped.split('\n')
  const rendered = lines.map((line) => {
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      return `<h${level + 2}>${heading[2]}</h${level + 2}>`
    }
    if (line.trim() === '') return ''
    return `<p>${line}</p>`
  })
  return rendered.join('')
}

function CellGutter({ count, busy }: { count: number | null; busy: boolean }) {
  return (
    <div className="ws-cell-gutter">
      {busy ? (
        <span className="ws-cell-count-busy">In [*]</span>
      ) : count === null ? (
        <span className="ws-cell-count-none"> </span>
      ) : (
        <span className="ws-cell-count">[{count}]</span>
      )}
    </div>
  )
}

export function NotebookView({ path }: { path: string }) {
  const { state, actions } = useWorkspace()
  const cells = state.notebooks[path] ?? []
  const [selected, setSelected] = useState<number | null>(0)
  const [editing, setEditing] = useState<number | null>(null)
  const [clipboard, setClipboard] = useState<CellModel | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])
  const dirty = state.dirty[path] ?? false

  useEffect(() => {
    if (selected !== null) {
      cellRefs.current[selected]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selected])

  const busyCell = state.busyCell && state.busyCell.path === path ? state.busyCell.index : null

  const selectCell = (index: number) => {
    setSelected(index)
    setEditing(null)
    containerRef.current?.focus()
  }

  const startEdit = (index: number) => {
    setSelected(index)
    setEditing(index)
  }

  const runCellAt = async (index: number) => {
    await actions.runCell(path, index)
  }

  const runAndAdvance = async (index: number) => {
    await runCellAt(index)
    const current = state.notebooks[path] ?? cells
    if (index + 1 < current.length) {
      setSelected(index + 1)
    } else {
      actions.insertCell(path, current.length, 'code')
      setSelected(current.length)
    }
    setEditing(null)
  }

  const runAll = () => void actions.runAll(path)

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (editing !== null || selected === null) return
    const action = findAction(state.keymap, event)
    if (!action || event.repeat && action === 'deleteCell') return
    const current = cells
    const target = selected
    switch (action) {
      case 'enterEdit':
        event.preventDefault()
        setEditing(target)
        break
      case 'selectDown':
        event.preventDefault()
        if (target + 1 < current.length) setSelected(target + 1)
        break
      case 'selectUp':
        event.preventDefault()
        if (target > 0) setSelected(target - 1)
        break
      case 'insertAbove':
        event.preventDefault()
        actions.insertCell(path, target, 'code')
        setSelected(target)
        break
      case 'insertBelow':
        event.preventDefault()
        actions.insertCell(path, target + 1, 'code')
        setSelected(target + 1)
        break
      case 'deleteCell':
        event.preventDefault()
        actions.deleteCell(path, target)
        setSelected(Math.max(0, target - 1))
        break
      case 'toMarkdown':
        event.preventDefault()
        actions.updateCell(path, target, { cellType: 'markdown' })
        break
      case 'toCode':
        event.preventDefault()
        actions.updateCell(path, target, { cellType: 'code' })
        break
      case 'copyCell': {
        const cell = current[target]
        if (cell) setClipboard(cell)
        break
      }
      case 'cutCell': {
        const cell = current[target]
        if (cell) {
          event.preventDefault()
          setClipboard(cell)
          actions.deleteCell(path, target)
          setSelected(Math.max(0, target - 1))
        }
        break
      }
      case 'pasteCell':
        if (clipboard) {
          event.preventDefault()
          actions.insertCell(path, target + 1, clipboard.cellType)
          setSelected(target + 1)
        }
        break
      case 'save':
        event.preventDefault()
        void actions.saveDoc(path)
        break
      case 'runAll':
        event.preventDefault()
        runAll()
        break
      case 'interruptKernel':
        if (state.busy) void actions.interruptKernel()
        break
      case 'restartKernel':
        if (state.kernelId) void actions.restartKernel()
        break
      case 'clearOutput':
        for (let index = 0; index < current.length; index += 1) actions.clearCellOutputs(path, index)
        break
      default:
        break
    }
  }

  const onEditKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const action = findAction(state.keymap, event)
    switch (action) {
      case 'exitEdit':
        event.preventDefault()
        setEditing(null)
        containerRef.current?.focus()
        break
      case 'runCellAdvance':
        event.preventDefault()
        void runAndAdvance(index)
        break
      case 'runCell':
        event.preventDefault()
        void runCellAt(index)
        break
      case 'runCellInsert':
        event.preventDefault()
        void runCellAt(index)
        actions.insertCell(path, index + 1, 'code')
        setSelected(index + 1)
        setEditing(index + 1)
        break
      case 'save':
        event.preventDefault()
        void actions.saveDoc(path)
        break
      case 'interruptKernel':
        if (state.busy) void actions.interruptKernel()
        break
      case 'restartKernel':
        if (state.kernelId) void actions.restartKernel()
        break
      case 'clearOutput':
        for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) actions.clearCellOutputs(path, cellIndex)
        break
      default:
        break
    }
  }

  const toolbar = (
    <div className="ws-notebook-toolbar">
      <button type="button" title="保存 Notebook" disabled={!dirty} onClick={() => void actions.saveDoc(path)}>
        <IconSave size={14} />
      </button>
      <button type="button" title="在上方插入 Cell" onClick={() => selected !== null && actions.insertCell(path, selected, 'code')}>
        <IconPlus size={14} />
      </button>
      <button type="button" title="在下方插入 Cell" onClick={() => selected !== null && actions.insertCell(path, (selected ?? -1) + 1, 'code')}>
        <IconPlus size={14} style={{ transform: 'rotate(180deg)' }} />
      </button>
      <span className="ws-toolbar-sep" />
      <button type="button" title="剪切 Cell" disabled={selected === null} onClick={() => selected !== null && setClipboard(cells[selected])}>
        <IconCut size={14} />
      </button>
      <button type="button" title="复制 Cell" disabled={selected === null} onClick={() => selected !== null && setClipboard(cells[selected])}>
        <IconCopy size={14} />
      </button>
      <button type="button" title="粘贴 Cell" disabled={!clipboard} onClick={() => selected !== null && actions.insertCell(path, selected + 1, clipboard?.cellType ?? 'code')}>
        <IconPaste size={14} />
      </button>
      <span className="ws-toolbar-sep" />
      <button type="button" title="运行当前 Cell 并前进 (Shift+Enter)" disabled={selected === null || state.busy} onClick={() => selected !== null && void runAndAdvance(selected)}>
        <IconPlay size={14} />
      </button>
      <button type="button" title="中断 Kernel" disabled={!state.busy} onClick={() => void actions.interruptKernel()}>
        <IconStop size={14} />
      </button>
      <button type="button" title="重启 Kernel" disabled={!state.kernelId} onClick={() => void actions.restartKernel()}>
        <IconRestart size={14} />
      </button>
      <button type="button" title="运行全部 Cell" disabled={state.busy} onClick={runAll}>
        <IconPlay size={14} style={{ opacity: 0.55 }} />
        <IconPlay size={10} style={{ marginLeft: -6, opacity: 0.35 }} />
      </button>
      <span className="ws-toolbar-sep" />
      <select
        className="ws-celltype-select"
        value={selected !== null ? cells[selected]?.cellType ?? 'code' : 'code'}
        onChange={(event) => selected !== null && actions.updateCell(path, selected, { cellType: event.target.value as 'code' | 'markdown' })}
        title="Cell 类型"
      >
        <option value="code">Code</option>
        <option value="markdown">Markdown</option>
      </select>
    </div>
  )

  const cellElement = (cell: CellModel, index: number) => {
    const isSelected = selected === index
    const isEditing = editing === index
    const isBusy = busyCell === index
    const id = `cell-${path.replace(/[^\w-]/g, '-')}-${index}`
    return (
      <div
        key={cell.id}
        id={id}
        ref={(element) => {
          cellRefs.current[index] = element
        }}
        className={`ws-cell${isSelected ? ' ws-cell-selected' : ''}${isEditing ? ' ws-cell-editing' : ''}`}
        onClick={() => selectCell(index)}
        onDoubleClick={() => startEdit(index)}
      >
        <CellGutter count={cell.executionCount} busy={isBusy} />
        <div className="ws-cell-body">
          {cell.cellType === 'code' ? (
            <>
              <div className="ws-cell-source">
                {isEditing || cell.source === '' ? (
                  <textarea
                    className="ws-cell-textarea"
                    value={cell.source}
                    rows={Math.max(2, cell.source.split('\n').length + 1)}
                    onChange={(event) => actions.updateCell(path, index, { source: event.target.value })}
                    onKeyDown={(event) => onEditKeyDown(event, index)}
                    onFocus={() => setEditing(index)}
                    spellCheck={false}
                    autoFocus={isEditing}
                  />
                ) : (
                  <pre className="ws-cell-code" onClick={() => startEdit(index)}>{cell.source || ' '}</pre>
                )}
              </div>
              {(cell.outputs.length > 0 || isBusy) && (
                <div className="ws-cell-outputs">
                  {isBusy && (
                    <div className="ws-output-busy">
                      <IconSpinner size={13} /> 运行中…
                    </div>
                  )}
                  {cell.outputs.map((output, outputIndex) => (
                    <OutputView key={outputIndex} output={output} />
                  ))}
                  {cell.outputs.length > 0 && (
                    <button type="button" className="ws-clear-outputs" onClick={() => actions.clearCellOutputs(path, index)}>
                      <IconClose size={10} /> 清除输出
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="ws-cell-markdown">
              {isEditing ? (
                <textarea
                  className="ws-cell-textarea ws-cell-markdown-editor"
                  value={cell.source}
                  rows={Math.max(3, cell.source.split('\n').length + 1)}
                  onChange={(event) => actions.updateCell(path, index, { source: event.target.value })}
                  onKeyDown={(event) => onEditKeyDown(event, index)}
                  spellCheck={false}
                  autoFocus
                />
              ) : (
                <div
                  className="ws-cell-markdown-rendered"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(cell.source) }}
                  onClick={() => startEdit(index)}
                />
              )}
            </div>
          )}
          <div className="ws-cell-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" title="上移" disabled={index === 0} onClick={() => actions.moveCell(path, index, -1)}>
              <IconChevronsUp size={12} />
            </button>
            <button type="button" title="下移" disabled={index === cells.length - 1} onClick={() => actions.moveCell(path, index, 1)}>
              <IconChevronsDown size={12} />
            </button>
            <button type="button" title="复制" onClick={() => actions.duplicateCell(path, index)}>
              <IconCopy size={12} />
            </button>
            <button type="button" title="删除" onClick={() => actions.deleteCell(path, index)}>
              <IconClose size={12} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const notebookTitle = useMemo(() => path.split('/').pop() ?? path, [path])

  return (
    <div className="ws-notebook" tabIndex={0} onKeyDown={onKeyDown} ref={containerRef}>
      {toolbar}
      <div className="ws-notebook-scroll">
        <div className="ws-notebook-page">
          <h2 className="ws-notebook-title">{notebookTitle}</h2>
          <p className="ws-notebook-subtitle">
            {state.mode === 'demo' ? '演示数据 · ' : ''}最后编辑于{dirty ? '（有未保存修改）' : '最近'} · 由 Pilot 协作
          </p>
          <div className="ws-cells">{cells.map((cell, index) => cellElement(cell, index))}</div>
          <button
            type="button"
            className="ws-add-cell"
            onClick={() => {
              actions.insertCell(path, cells.length, 'code')
              setSelected(cells.length)
            }}
          >
            <IconPlus size={13} /> 添加 Cell
          </button>
        </div>
      </div>
    </div>
  )
}
