import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function ThinkingLine({ text, compact }: { text: string; compact: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setTruncated(node.scrollWidth > node.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [text])

  return <div ref={ref} className={`pigent-assistant-thinking${compact ? ' is-compact' : ''}${truncated ? ' is-truncated' : ''}`} title={truncated ? text : undefined}>{text}</div>
}

export function AssistantMessage({ text, timestamp, thinking = false, compact = false }: { text: string; timestamp: string; thinking?: boolean; compact?: boolean }) {
  if (thinking) return <ThinkingLine text={text} compact={compact} />

  // Final assistant output remains a normal Markdown message, without a
  // repeated Pigent logo or a secondary copy control in the conversation.
  return <article className={`pigent-assistant-event${compact ? ' is-compact' : ''}`} data-timestamp={timestamp}><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}<span className="sr-only"> (opens in a new tab)</span></a>, code: ({ children, className }) => <code className={className}>{children}</code> }}>{text}</ReactMarkdown></article>
}
