import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../store'
import { IconSave, IconSpinner } from '../icons'

export function TextView({ path }: { path: string }) {
  const { state, actions } = useWorkspace()
  const content = state.texts[path] ?? ''
  const dirty = state.dirty[path] ?? false
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })

  useEffect(() => {
    if (savingRef.current) return
    savingRef.current = true
    const timer = window.setTimeout(() => {
      savingRef.current = false
    }, 300)
    return () => window.clearTimeout(timer)
  }, [content])

  const updateCursor = (element: HTMLTextAreaElement) => {
    const before = element.value.slice(0, element.selectionStart)
    setCursor({
      line: before.split('\n').length,
      column: before.length - before.lastIndexOf('\n'),
    })
  }

  return (
    <div className="ws-textview">
      <div className="ws-textview-toolbar">
        <button type="button" disabled={!dirty} title="保存" onClick={async () => { setSaving(true); await actions.saveDoc(path); setSaving(false) }}>
          {saving ? <IconSpinner size={13} /> : <IconSave size={13} />}
        </button>
        <span className="ws-textview-path">{path}</span>
        <span className="ws-textview-cursor">Ln {cursor.line}, Col {cursor.column}</span>
      </div>
      <textarea
        className="ws-textview-editor"
        value={content}
        spellCheck={false}
        onChange={(event) => {
          actions.setText(path, event.target.value)
          actions.markDirty(path)
          updateCursor(event.target)
        }}
        onKeyUp={(event) => updateCursor(event.currentTarget)}
        onClick={(event) => updateCursor(event.currentTarget)}
      />
    </div>
  )
}
