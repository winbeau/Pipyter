import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { EditorView } from '@codemirror/view'
import { jupyterCodeTheme } from './jupyterTheme'

export type CodeCellEditorProps = {
  value: string
  active: boolean
  ariaLabel: string
  onActivate: () => void
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

export function CodeCellEditor({
  value,
  active,
  ariaLabel,
  onActivate,
  onChange,
  onKeyDown,
}: CodeCellEditorProps) {
  const viewRef = useRef<EditorView | null>(null)
  const extensions = useMemo(() => [python(), EditorView.lineWrapping, jupyterCodeTheme], [])

  useEffect(() => {
    if (!active) return
    const frame = window.requestAnimationFrame(() => viewRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [active])

  return (
    <div
      className="ws-code-editor"
      data-editor-active={active ? 'true' : 'false'}
      onMouseDown={(event) => {
        event.stopPropagation()
        onActivate()
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDownCapture={onKeyDown}
    >
      <CodeMirror
        value={value}
        aria-label={ariaLabel}
        placeholder="输入代码…"
        extensions={extensions}
        height="auto"
        minHeight="46px"
        indentWithTab
        basicSetup={{
          lineNumbers: false,
          highlightActiveLineGutter: false,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: true,
          crosshairCursor: false,
          highlightActiveLine: false,
          highlightSelectionMatches: true,
          tabSize: 4,
        }}
        onCreateEditor={(view) => {
          viewRef.current = view
          if (active) view.focus()
        }}
        onFocus={onActivate}
        onChange={onChange}
      />
    </div>
  )
}
