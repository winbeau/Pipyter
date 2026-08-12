import { CheckCircle2, ExternalLink, Hand } from 'lucide-react'
import { useState } from 'react'
import type { PigentInteraction } from '../types'

export function InteractionCard({ interaction, revision = 1, resolved = false, density = 'comfortable', onOpenShell, onResolve }: {
  interaction: PigentInteraction
  revision?: number
  resolved?: boolean
  density?: 'comfortable' | 'compact'
  onOpenShell(id?: string): void
  onResolve?(interactionId: string, revision: number, actionId: string): Promise<void>
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const decide = async (actionId: string) => {
    if (!onResolve || pending || resolved) return
    setPending(actionId); setError(null)
    try { await onResolve(interaction.interaction_id, revision, actionId) }
    catch (value) { setError(value instanceof Error ? value.message : String(value)) }
    finally { setPending(null) }
  }
  if (resolved) return <article className={`pigent-card pigent-interaction-card is-${density} is-resolved`} role="status"><header><span><CheckCircle2 />Resolved</span></header><p>{interaction.summary}</p></article>
  return <article className={`pigent-card pigent-interaction-card is-${density}`} role="group" aria-labelledby={`${interaction.interaction_id}-title`} aria-describedby={`${interaction.interaction_id}-description`} aria-busy={Boolean(pending)}><header><span id={`${interaction.interaction_id}-title`}><Hand />需要你的操作</span><small>{interaction.kind}</small></header><p id={`${interaction.interaction_id}-description`}>{interaction.summary}</p>{interaction.command_preview && <code>{interaction.command_preview}</code>}<div className="pigent-card-actions">{interaction.choices.includes('open_shell') && <button type="button" className="is-primary" disabled={Boolean(pending)} onClick={() => { onOpenShell(interaction.shell_session_id); void decide('open_shell') }}><ExternalLink />打开 Shell</button>}{interaction.choices.includes('cancel') && <button type="button" disabled={Boolean(pending)} onClick={() => void decide('cancel')}>取消</button>}{interaction.choices.includes('allow_once') && <button type="button" className="is-primary" disabled={Boolean(pending)} onClick={() => void decide('allow_once')}>{pending === 'allow_once' ? '处理中…' : '允许一次'}</button>}{interaction.choices.includes('reject') && <button type="button" disabled={Boolean(pending)} onClick={() => void decide('reject')}>拒绝</button>}</div>{error && <div className="pigent-inline-error" role="alert">{error}</div>}</article>
}
