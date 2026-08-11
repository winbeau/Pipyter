import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../store'
import { IconClose, IconTerminal } from '../icons'

export function TerminalPanel() {
  const { state, actions } = useWorkspace()
  const [input, setInput] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [state.terminalLines])

  useEffect(() => {
    if (state.bottomOpen) inputRef.current?.focus()
  }, [state.bottomOpen])

  const submit = () => {
    const command = input.trim()
    if (!command) return
    setInput('')
    setHistoryIndex(-1)
    void actions.terminalRun(command)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      submit()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const history = state.terminalHistory
      if (history.length === 0) return
      const next = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(next)
      setInput(history[next])
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const history = state.terminalHistory
      if (historyIndex === -1) return
      const next = historyIndex + 1
      if (next >= history.length) {
        setHistoryIndex(-1)
        setInput('')
      } else {
        setHistoryIndex(next)
        setInput(history[next])
      }
    }
  }

  return (
    <div className="ws-terminal">
      <div className="ws-terminal-header">
        <span className="ws-terminal-title"><IconTerminal size={12} /> 终端</span>
        <span className="ws-panel-actions">
          <button type="button" title="清空输出" onClick={actions.terminalClear}>清空</button>
          <button type="button" title="收起终端" onClick={() => actions.setBottomOpen(false)}>
            <IconClose size={13} />
          </button>
        </span>
      </div>
      <div className="ws-terminal-body" ref={scrollRef}>
        {state.terminalLines.map((line, index) => (
          <div key={index} className={`ws-terminal-line ws-terminal-${line.kind}`}>
            {line.text}
          </div>
        ))}
        <div className="ws-terminal-input-row">
          <span className="ws-terminal-prompt">$</span>
          <input
            ref={inputRef}
            className="ws-terminal-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="输入命令，Enter 执行；↑/↓ 浏览历史"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}
