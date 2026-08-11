import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { KernelOutput } from '../../../../packages/protocol/src/index'
import { useWorkspace } from '../store'
import type { CellModel } from '../types'
import { findAction } from '../keymap'
import { CodeCellEditor } from '../editor/CodeCellEditor'
import {
  IconCheck,
  IconChevronDown,
  IconChevronsDown,
  IconCode,
  IconChevronsUp,
  IconClose,
  IconCopy,
  IconCut,
  IconNotebook,
  IconMarkdown,
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
      {png ? (
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
  const [focusTarget, setFocusTarget] = useState<{ index: number; region: 'cell' | 'source' | 'output' }>({ index: 0, region: 'cell' })
  const [markdownEditorHeight, setMarkdownEditorHeight] = useState<number | null>(null)
  const [cellTypeMenuOpen, setCellTypeMenuOpen] = useState(false)
  const [clipboard, setClipboard] = useState<CellModel | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cellTypeControlRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])
  const deleteChordRef = useRef(0)
  const dirty = state.dirty[path] ?? false

  useEffect(() => {
    if (cells.length === 0) {
      setSelected(null)
      setEditing(null)
      return
    }
    if (selected === null || selected >= cells.length) setSelected(cells.length - 1)
    if (editing !== null && editing >= cells.length) setEditing(null)
  }, [cells.length, editing, selected])

  useEffect(() => {
    if (selected !== null) {
      cellRefs.current[selected]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selected])

  useEffect(() => {
    if (!cellTypeMenuOpen) return
    const closeOutside = (event: MouseEvent) => {
      if (!cellTypeControlRef.current?.contains(event.target as Node)) setCellTypeMenuOpen(false)
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setCellTypeMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [cellTypeMenuOpen])

  const busyCell = state.busyCell && state.busyCell.path === path ? state.busyCell.index : null

  const selectCell = (index: number, region: 'cell' | 'output' = 'cell') => {
    setSelected(index)
    setEditing(null)
    setMarkdownEditorHeight(null)
    setFocusTarget({ index, region })
    containerRef.current?.focus({ preventScroll: true })
  }

  const activateSource = (index: number) => {
    setSelected(index)
    setEditing(index)
    setFocusTarget({ index, region: 'source' })
  }

  const startEdit = (index: number) => {
    const markdown = cells[index]?.cellType === 'markdown'
    const measured = markdown
      ? cellRefs.current[index]?.querySelector<HTMLElement>('.ws-cell-markdown')?.getBoundingClientRect().height ?? null
      : null
    setMarkdownEditorHeight(measured)
    activateSource(index)
  }

  const insertCellAt = (index: number, cellType: 'code' | 'markdown' = 'code') => {
    actions.insertCell(path, index, cellType)
    setMarkdownEditorHeight(null)
    setFocusTarget({ index, region: 'source' })
    setSelected(index)
    setEditing(index)
  }

  const deleteCellAt = (index: number) => {
    actions.deleteCell(path, index)
    setEditing(null)
    setMarkdownEditorHeight(null)
    setSelected(cells.length <= 1 ? null : Math.min(index, cells.length - 2))
  }

  const duplicateCellAt = (index: number) => {
    actions.duplicateCell(path, index)
    setSelected(index + 1)
    setEditing(null)
    setMarkdownEditorHeight(null)
  }

  const moveCellAt = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= cells.length) return
    actions.moveCell(path, index, delta)
    setSelected(target)
    if (editing === index) setEditing(target)
  }

  const copyCellAt = (index: number) => {
    const cell = cells[index]
    if (cell) setClipboard({ ...cell, outputs: cell.outputs.map((output) => ({ ...output, data: { ...output.data } })) })
  }

  const cutCellAt = (index: number) => {
    const cell = cells[index]
    if (!cell) return
    setClipboard({ ...cell, outputs: cell.outputs.map((output) => ({ ...output, data: { ...output.data } })) })
    deleteCellAt(index)
  }

  const pasteCellAt = (index: number) => {
    if (!clipboard) return
    actions.insertCell(path, index + 1, clipboard.cellType, clipboard.source)
    setSelected(index + 1)
    setEditing(null)
    setMarkdownEditorHeight(null)
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
    setMarkdownEditorHeight(null)
    setFocusTarget({ index: Math.min(index + 1, current.length), region: 'cell' })
    containerRef.current?.focus({ preventScroll: true })
  }

  const runAll = () => void actions.runAll(path)

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (editing !== null || selected === null) return
    const plainKey = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
      ? event.key.toLowerCase()
      : null
    if (plainKey === 'd') {
      event.preventDefault()
      if (!event.repeat && Date.now() - deleteChordRef.current < 1200) {
        deleteChordRef.current = 0
        deleteCellAt(selected)
      } else if (!event.repeat) {
        deleteChordRef.current = Date.now()
      }
      return
    }
    deleteChordRef.current = 0
    if (plainKey === 'j' || plainKey === 'k') {
      event.preventDefault()
      const next = plainKey === 'j' ? selected + 1 : selected - 1
      if (next >= 0 && next < cells.length) setSelected(next)
      return
    }
    if (plainKey === 'c') {
      event.preventDefault()
      copyCellAt(selected)
      return
    }
    if (plainKey === 'x') {
      event.preventDefault()
      cutCellAt(selected)
      return
    }
    if (plainKey === 'v') {
      event.preventDefault()
      pasteCellAt(selected)
      return
    }
    const action = findAction(state.keymap, event)
    if (!action || event.repeat && action === 'deleteCell') return
    const current = cells
    const target = selected
    switch (action) {
      case 'enterEdit':
        event.preventDefault()
        startEdit(target)
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
          actions.insertCell(path, target + 1, clipboard.cellType, clipboard.source)
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

  const onEditKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    const action = findAction(state.keymap, event)
    const handle = () => {
      event.preventDefault()
      event.stopPropagation()
    }
    switch (action) {
      case 'exitEdit':
        handle()
        setEditing(null)
        setMarkdownEditorHeight(null)
        setFocusTarget({ index, region: 'cell' })
        containerRef.current?.focus({ preventScroll: true })
        break
      case 'runCellAdvance':
        handle()
        void runAndAdvance(index)
        break
      case 'runCell':
        handle()
        void runCellAt(index)
        break
      case 'runCellInsert':
        handle()
        void runCellAt(index)
        actions.insertCell(path, index + 1, 'code')
        setMarkdownEditorHeight(null)
        setFocusTarget({ index: index + 1, region: 'source' })
        setSelected(index + 1)
        setEditing(index + 1)
        break
      case 'runAll':
        handle()
        runAll()
        break
      case 'save':
        handle()
        void actions.saveDoc(path)
        break
      case 'interruptKernel':
        if (state.busy) {
          handle()
          void actions.interruptKernel()
        }
        break
      case 'restartKernel':
        if (state.kernelId) {
          handle()
          void actions.restartKernel()
        }
        break
      case 'clearOutput':
        handle()
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
      <button type="button" title="在上方插入 Cell" onClick={() => selected !== null && insertCellAt(selected, 'code')}>
        <IconPlus size={14} />
      </button>
      <button type="button" title="在下方插入 Cell" onClick={() => selected !== null && insertCellAt(selected + 1, 'code')}>
        <IconPlus size={14} style={{ transform: 'rotate(180deg)' }} />
      </button>
      <span className="ws-toolbar-sep" />
      <button type="button" title="剪切 Cell" disabled={selected === null} onClick={() => selected !== null && cutCellAt(selected)}>
        <IconCut size={14} />
      </button>
      <button type="button" title="复制 Cell" disabled={selected === null} onClick={() => selected !== null && copyCellAt(selected)}>
        <IconCopy size={14} />
      </button>
      <button type="button" title="粘贴 Cell" disabled={!clipboard || selected === null} onClick={() => selected !== null && pasteCellAt(selected)}>
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
      <div className="ws-celltype-control" ref={cellTypeControlRef}>
        <button
          type="button"
          className="ws-celltype-trigger"
          aria-haspopup="listbox"
          aria-expanded={cellTypeMenuOpen}
          disabled={selected === null}
          onClick={() => setCellTypeMenuOpen((open) => !open)}
          title="Cell 类型"
        >
          {selected !== null && cells[selected]?.cellType === 'markdown' ? <IconMarkdown size={14} /> : <IconCode size={14} />}
          <span>{selected !== null && cells[selected]?.cellType === 'markdown' ? 'Markdown' : 'Code'}</span>
          <IconChevronDown size={12} className={cellTypeMenuOpen ? 'ws-celltype-chevron-open' : undefined} />
        </button>
        {cellTypeMenuOpen && (
          <div className="ws-celltype-menu" role="listbox" aria-label="Cell 类型">
            {([
              { id: 'code' as const, label: 'Code', Icon: IconCode },
              { id: 'markdown' as const, label: 'Markdown', Icon: IconMarkdown },
            ]).map(({ id, label, Icon }) => {
              const active = selected !== null && cells[selected]?.cellType === id
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`ws-celltype-option${active ? ' ws-celltype-option-active' : ''}`}
                  key={id}
                  onClick={() => {
                    if (selected !== null) actions.updateCell(path, selected, { cellType: id })
                    setCellTypeMenuOpen(false)
                  }}
                >
                  <Icon size={15} />
                  <span className="ws-celltype-option-copy">
                    <strong>{label}</strong>
                  </span>
                  {active && <IconCheck size={13} />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const cellElement = (cell: CellModel, index: number) => {
    const isSelected = selected === index
    const isEditing = editing === index
    const isBusy = busyCell === index
    const isOutputSelected = isSelected && focusTarget.index === index && focusTarget.region === 'output'
    const id = `cell-${path.replace(/[^\w-]/g, '-')}-${index}`
    return (
      <div
        key={cell.id}
        id={id}
        data-cell-index={index}
        ref={(element) => {
          cellRefs.current[index] = element
        }}
        className={`ws-cell${isSelected ? ' ws-cell-selected' : ''}${isEditing ? ' ws-cell-editing' : ''}`}
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('.ws-code-editor, .ws-cell-markdown-editor, .ws-cell-actions')) return
          selectCell(index)
        }}
        onDoubleClick={() => startEdit(index)}
      >
        <CellGutter count={cell.executionCount} busy={isBusy} />
        <div className="ws-cell-body">
          {cell.cellType === 'code' ? (
            <>
              <div className="ws-cell-source">
                <CodeCellEditor
                  value={cell.source}
                  active={isEditing}
                  ariaLabel={`Code Cell ${index + 1}`}
                  onActivate={() => {
                    setMarkdownEditorHeight(null)
                    activateSource(index)
                  }}
                  onChange={(source) => actions.updateCell(path, index, { source })}
                  onKeyDown={(event) => onEditKeyDown(event, index)}
                />
              </div>
              {(cell.outputs.length > 0 || isBusy) && (
                <div
                  className={`ws-cell-outputs${isOutputSelected ? ' ws-cell-outputs-selected' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    selectCell(index, 'output')
                  }}
                >
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
                  rows={1}
                  style={markdownEditorHeight ? { height: Math.max(46, markdownEditorHeight - 2) } : undefined}
                  onChange={(event) => {
                    const minimum = Math.max(46, (markdownEditorHeight ?? 48) - 2)
                    event.currentTarget.style.height = 'auto'
                    const nextHeight = Math.max(minimum, event.currentTarget.scrollHeight)
                    event.currentTarget.style.height = `${nextHeight}px`
                    setMarkdownEditorHeight(nextHeight + 2)
                    actions.updateCell(path, index, { source: event.target.value })
                  }}
                  onKeyDown={(event) => onEditKeyDown(event, index)}
                  onFocus={() => activateSource(index)}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  spellCheck={false}
                  autoFocus
                />
              ) : (
                <div
                  className="ws-cell-markdown-rendered"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(cell.source) }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    startEdit(index)
                  }}
                />
              )}
            </div>
          )}
          <div
            className="ws-cell-actions"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" title="上移" disabled={index === 0} onClick={() => moveCellAt(index, -1)}>
              <IconChevronsUp size={12} />
            </button>
            <button type="button" title="下移" disabled={index === cells.length - 1} onClick={() => moveCellAt(index, 1)}>
              <IconChevronsDown size={12} />
            </button>
            <button type="button" title="复制" onClick={() => duplicateCellAt(index)}>
              <IconCopy size={12} />
            </button>
            <button type="button" title="删除" onClick={() => deleteCellAt(index)}>
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
          <div className="ws-cells">{cells.map((cell, index) => cellElement(cell, index))}</div>
          <button
            type="button"
            className="ws-add-cell"
            onClick={() => insertCellAt(cells.length, 'code')}
          >
            <IconPlus size={13} /> 添加 Cell
          </button>
        </div>
      </div>
    </div>
  )
}
