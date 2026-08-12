import { Check, Copy, Orbit } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function AssistantMessage({ text, timestamp, thinking = false, compact = false }: { text: string; timestamp: string; thinking?: boolean; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1200) }
  return <article className={`pigent-assistant-event${compact ? ' is-compact' : ''}${thinking ? ' is-thinking' : ''}`}><Orbit aria-hidden="true" /><div><div className="pigent-message-meta"><strong>{thinking ? 'Pigent status' : 'Pigent'}</strong><time dateTime={timestamp}>{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><button type="button" onClick={() => void copy()} aria-label="Copy assistant message">{copied ? <Check /> : <Copy />}</button></div><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}<span className="sr-only"> (opens in a new tab)</span></a>, code: ({ children, className }) => <code className={className}>{children}</code> }}>{text}</ReactMarkdown></div></article>
}
