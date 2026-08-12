import { AlertCircle, Clock3, RotateCcw } from 'lucide-react'
import type { OptimisticUserMessage } from '../types'

export function UserMessage({ message, onRetry }: { message: OptimisticUserMessage; onRetry?(message: OptimisticUserMessage): void }) {
  return <article className={`pigent-user-message state-${message.state}`}><div className="pigent-message-meta"><strong>You</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.content}</p><div className="pigent-user-state">{message.state === 'failed' ? <AlertCircle /> : <Clock3 />}{message.state}{message.error && <span>{message.error}</span>}{message.state === 'failed' && onRetry && <button type="button" onClick={() => onRetry(message)}><RotateCcw />Retry</button>}</div></article>
}
