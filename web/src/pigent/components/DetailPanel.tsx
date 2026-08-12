import { PIGENT_ACTION_FILTERS } from '../../../../packages/protocol/src/pigent'
import type { PigentContext, PigentMode, PigentSession } from '../types'
import { ContextChips } from './ContextChips'
export function DetailPanel({ session, context, mode, tools }: { session?: PigentSession; context: PigentContext; mode: PigentMode; tools: readonly string[] }) {
  return <aside className="pigent-detail-panel"><div className="pigent-section-label">Context</div><ContextChips context={context} />
    <Detail label="Active model" value={session?.model ? `${session.model.provider} / ${session.model.model}` : '尚未配置'} />
    <div className="pigent-detail-block"><span>Effective tools · {mode}</span><div className="pigent-tool-pills">{tools.map((tool) => <i key={tool}>{tool}</i>)}</div></div>
    <Detail label="Runtime identity" value={session ? '当前 Runtime 用户（路径信息保持私有）' : '当前 Runtime 用户'} />
    <div className="pigent-detail-block"><span>Mode actions</span><small>Notebook: {PIGENT_ACTION_FILTERS.notebook[mode].join(', ') || 'none'}</small><small>Kernel: {PIGENT_ACTION_FILTERS.kernel[mode].join(', ') || 'none'}</small></div>
    <div className="pigent-detail-block"><span>Recommended next actions</span><ul><li>检查 Tasks 的运行项</li><li>需要直接输入时打开 Shell</li><li>完成后复核产物与摘要</li></ul></div>
  </aside>
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="pigent-detail-block"><span>{label}</span><strong>{value}</strong></div> }
