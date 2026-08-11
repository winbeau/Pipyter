import { ArrowUp, Square } from 'lucide-react'
import { useState } from 'react'
export function Composer({ onSend, running = false, compact = false }: { onSend(content: string): Promise<void> | void; running?: boolean; compact?: boolean }) {
  const [value, setValue] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => { const content = value.trim(); if (!content || busy) return; setBusy(true); try { await onSend(content); setValue('') } finally { setBusy(false) } }
  return <div className={`pigent-composer${compact ? ' is-compact' : ''}`}><textarea value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit() } }} placeholder="向 Pigent 提问或下达任务…" aria-label="Message Pigent" rows={compact ? 1 : 2} /><button type="button" onClick={() => void submit()} disabled={!value.trim() || busy} aria-label={running ? '发送后续消息' : '发送消息'}>{running ? <Square size={13} /> : <ArrowUp size={15} />}</button></div>
}
