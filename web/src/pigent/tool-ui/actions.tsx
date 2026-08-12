import { Check, Copy, Download, ExternalLink, FolderOpen, Maximize2 } from 'lucide-react'
import { useState } from 'react'
import type { ToolSurfaceAction } from '../types'

export function SurfaceActions({ actions, onOpen, onExpand }: { actions: ToolSurfaceAction[]; onOpen?(path: string, reveal: boolean): void; onExpand?(): void }) {
  const [pending, setPending] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const invoke = async (action: ToolSurfaceAction) => {
    if (pending) return
    setPending(action.id); setDone(null)
    try {
      if (action.id === 'copy' && action.value) await navigator.clipboard.writeText(action.value)
      else if ((action.id === 'open' || action.id === 'reveal') && action.value) onOpen?.(action.value, action.id === 'reveal')
      else if (action.id === 'open' && action.href) window.open(action.href, '_blank', 'noopener,noreferrer')
      else if (action.id === 'download' && action.href) window.open(action.href, '_blank', 'noopener,noreferrer')
      else if (action.id === 'expand' && onExpand) onExpand()
      else return
      setDone(action.id)
    } finally { setPending(null) }
  }
  const icon = (id: ToolSurfaceAction['id']) => id === 'copy' ? <Copy /> : id === 'download' ? <Download /> : id === 'open' ? <ExternalLink /> : id === 'reveal' ? <FolderOpen /> : <Maximize2 />
  return <div className="pigent-surface-actions" aria-busy={Boolean(pending)}>{actions.map((action) => <button key={action.id} type="button" disabled={Boolean(pending)} onClick={() => void invoke(action)}>{done === action.id ? <Check /> : icon(action.id)}{action.label}</button>)}</div>
}
