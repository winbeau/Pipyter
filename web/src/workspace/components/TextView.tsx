import { useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { indentUnit } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import type { ViewUpdate } from '@codemirror/view'
import { useWorkspace } from '../store'
import { IconSave, IconSpinner } from '../icons'
import { jupyterCodeTheme, jupyterFileEditorTheme } from '../editor/jupyterTheme'

export function TextView({ path }: { path: string }) {
  const { state, actions } = useWorkspace()
  const content = state.texts[path] ?? ''
  const dirty = state.dirty[path] ?? false
  const [saving, setSaving] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const isPython = path.toLowerCase().endsWith('.py')
  const pythonExtensions = useMemo(
    () => [python(), indentUnit.of('    '), EditorState.tabSize.of(4), jupyterCodeTheme, jupyterFileEditorTheme],
    [],
  )

  const updateTextareaCursor = (element: HTMLTextAreaElement) => {
    const before = element.value.slice(0, element.selectionStart)
    setCursor({
      line: before.split('\n').length,
      column: before.length - before.lastIndexOf('\n'),
    })
  }

  const updateCodeCursor = (update: ViewUpdate) => {
    const position = update.state.selection.main.head
    const line = update.state.doc.lineAt(position)
    setCursor({ line: line.number, column: position - line.from + 1 })
  }

  const save = async () => {
    setSaving(true)
    await actions.saveDoc(path)
    setSaving(false)
  }

  const updateContent = (value: string) => {
    actions.setText(path, value)
    actions.markDirty(path)
  }

  return (
    <div className="ws-textview">
      <div className="ws-textview-toolbar">
        <button type="button" disabled={!dirty} title="保存" onClick={() => void save()}>
          {saving ? <IconSpinner size={13} /> : <IconSave size={13} />}
        </button>
        <span className="ws-textview-path">{path}</span>
        <span className="ws-textview-cursor">Ln {cursor.line}, Col {cursor.column}</span>
      </div>
      {isPython ? (
        <CodeMirror
          className="ws-textview-code-editor"
          value={content}
          aria-label={`Python 文件 ${path}`}
          extensions={pythonExtensions}
          height="100%"
          indentWithTab
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            tabSize: 4,
          }}
          onChange={(value, update) => {
            updateContent(value)
            updateCodeCursor(update)
          }}
          onUpdate={(update) => {
            if (update.selectionSet) updateCodeCursor(update)
          }}
        />
      ) : (
        <textarea
          className="ws-textview-editor"
          value={content}
          spellCheck={false}
          onChange={(event) => {
            updateContent(event.target.value)
            updateTextareaCursor(event.target)
          }}
          onKeyUp={(event) => updateTextareaCursor(event.currentTarget)}
          onClick={(event) => updateTextareaCursor(event.currentTarget)}
        />
      )}
    </div>
  )
}
