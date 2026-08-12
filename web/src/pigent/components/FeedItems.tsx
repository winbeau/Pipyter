import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { AssistantMessage } from './AssistantMessage'
import { InteractionCard } from './InteractionCard'
import { UserMessage } from './UserMessage'
import { ArtifactSurface, FallbackSurface, ToolSurface } from '../tool-ui/surfaces'
import type { FeedItem, OptimisticUserMessage, PigentInteraction } from '../types'

export function FeedItemView({ item, compact = false, onRetry, onOpenShell, onResolve, artifactUrl }: {
  item: FeedItem
  compact?: boolean
  onRetry(message: OptimisticUserMessage): void
  onOpenShell(id?: string): void
  onResolve(interactionId: string, revision: number, actionId: string): Promise<void>
  artifactUrl(id: string, download?: boolean): string
}) {
  if (item.kind === 'user') return <UserMessage message={item.message} onRetry={onRetry} />
  if (item.kind === 'assistant') return <AssistantMessage text={item.text} timestamp={item.timestamp} thinking={item.thinking} compact={compact} />
  if (item.kind === 'tool') return <ToolSurface surface={item.surface} density={compact ? 'compact' : 'comfortable'} />
  if (item.kind === 'artifact') return <ArtifactSurface event={item.event} density={compact ? 'compact' : 'comfortable'} artifactUrl={artifactUrl} />
  if (item.kind === 'interaction') {
    const interaction = (item.event.payload?.interaction ?? item.event.payload) as unknown as PigentInteraction
    if (!interaction?.interaction_id) return <FallbackSurface event={item.event} />
    return <InteractionCard interaction={interaction} revision={Number(item.event.payload?.revision ?? 1)} resolved={item.event.type === 'interaction.resolved' || (interaction as PigentInteraction & { state?: string }).state === 'resolved'} density={compact ? 'compact' : 'comfortable'} onOpenShell={onOpenShell} onResolve={onResolve} />
  }
  const text = String(item.event.payload?.message ?? item.event.payload?.summary ?? item.event.type)
  if (item.event.type === 'settled') return text && text !== 'settled' ? <article className="pigent-settled" role="status"><CheckCircle2 />{text}</article> : null
  return <article className="pigent-error-event" role="alert"><AlertCircle />{text}</article>
}
