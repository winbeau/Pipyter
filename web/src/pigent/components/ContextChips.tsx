import { FileText, GalleryHorizontal, NotebookPen, SquareTerminal } from 'lucide-react'
import type { PigentContext } from '../types'
export function ContextChips({ context, compact = false }: { context: PigentContext; compact?: boolean }) {
  const items = [
    context.activeDocument && { label: context.activeDocument, Icon: FileText },
    context.activeCell && { label: context.activeCell, Icon: NotebookPen },
    context.activeKernel && { label: context.activeKernel, Icon: SquareTerminal },
    context.figure && { label: context.figure, Icon: GalleryHorizontal },
  ].filter(Boolean) as { label: string; Icon: typeof FileText }[]
  if (!items.length) items.push({ label: context.workspace || '当前 Workspace', Icon: FileText })
  return <div className={`pigent-context-chips${compact ? ' is-compact' : ''}`} aria-label="Pigent context">{items.map(({ label, Icon }) => <span key={label} title={label}><Icon size={11} aria-hidden="true" />{label}</span>)}</div>
}
