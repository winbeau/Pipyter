import type { CSSProperties } from 'react'

type PilotPanelProps = {
  open: boolean
  collapsed: boolean
  toggleStyle: CSSProperties
  onToggle: () => void
}

/**
 * Pilot sidebar preserved from the original Workspace design (static demo
 * content). Agent backend work is intentionally out of scope for v0.1.
 */
export function PilotPanel({ open, collapsed, toggleStyle, onToggle }: PilotPanelProps) {
  if (!open) {
    return (
      <div
        style={{
          width: '40px',
          flexShrink: 0,
          background: 'var(--surface-2)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '16px',
          gap: '10px',
          cursor: 'pointer',
        } as CSSProperties}
        onClick={onToggle}
        title="展开 Pilot"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6">
          <circle cx="10" cy="10" r="6.5" />
          <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
        </svg>
        <span style={{ writingMode: 'vertical-rl', fontSize: '11px', color: 'var(--text-2)', letterSpacing: '.05em' } as CSSProperties}>
          PILOT
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '400px',
        flexShrink: 0,
        background: 'var(--dark-bg)',
        borderLeft: '1px solid var(--dark-border)',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--dark-text)',
        minWidth: 0,
      } as CSSProperties}
    >
      <div
        style={{
          height: '54px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          borderBottom: '1px solid var(--dark-border)',
        } as CSSProperties}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' } as CSSProperties}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--dark-text)" strokeWidth="1.6">
            <circle cx="10" cy="10" r="6.5" />
            <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
          </svg>
          <span style={{ fontSize: '13.5px', fontWeight: 600 } as CSSProperties}>Pilot</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9FCB8F', marginLeft: '4px' } as CSSProperties}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7FB77E', animation: 'pulse-dot 2s infinite' } as CSSProperties} />
            Active
          </span>
        </div>
        <svg
          width="15"
          height="15"
          viewBox="0 0 20 20"
          fill="none"
          stroke="var(--dark-text-2)"
          strokeWidth="1.6"
          style={{ cursor: 'pointer' } as CSSProperties}
          onClick={onToggle}
        >
          <path d="M13 4l-6 6 6 6" />
        </svg>
      </div>

      <div
        style={{ padding: '12px 18px', borderBottom: '1px solid var(--dark-border)', display: 'flex', flexWrap: 'wrap', gap: '6px' } as CSSProperties}
      >
        {['sparsity_curve_analysis.ipynb', 'compute_sparsity.py', 'Cell [1]'].map((chip) => (
          <div
            key={chip}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              background: 'var(--dark-surface-2)',
              borderRadius: '20px',
              fontSize: '11px',
              color: 'var(--dark-text-2)',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            } as CSSProperties}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2.5" y="2" width="11" height="12" rx="1" />
            </svg>
            {chip}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px', fontSize: '12px', lineHeight: 1.7, minHeight: 0 } as CSSProperties}>
        <SectionTitle>当前任务</SectionTitle>
        <div style={{ background: 'var(--dark-surface)', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px' } as CSSProperties}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } as CSSProperties}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', fontWeight: 600 } as CSSProperties}>sparsity_drop_investigation</span>
            <span style={{ fontSize: '10.5px', color: 'var(--dark-text-2)' } as CSSProperties}>2 / 4</span>
          </div>
          <div style={{ height: '4px', borderRadius: '2px', background: 'var(--dark-surface-2)', overflow: 'hidden', marginBottom: '10px' } as CSSProperties}>
            <div style={{ width: '50%', height: '100%', background: 'var(--accent)' } as CSSProperties} />
          </div>
          <TaskDone label="定位骤降层区间" />
          <TaskDone label="读取 compute_sparsity.py" />
          <TaskTodo label="调整滑动窗口并重新运行" />
          <TaskTodo label="验证相邻层稀疏度一致性" />
        </div>

        <SectionTitle>建议操作</SectionTitle>
        <div style={{ background: 'var(--dark-surface)', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px' } as CSSProperties}>
          <div style={{ marginBottom: '10px' } as CSSProperties}>
            将 <span style={{ fontFamily: 'var(--mono)' } as CSSProperties}>window</span> 从 4 改为 8，重新计算 layer 12–20 的稀疏度。
          </div>
          <div style={{ display: 'flex', gap: '8px' } as CSSProperties}>
            <div style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' } as CSSProperties}>
              采纳
            </div>
            <div style={{ padding: '6px 14px', border: '1px solid var(--dark-border)', color: 'var(--dark-text-2)', borderRadius: '7px', fontSize: '11.5px', cursor: 'pointer' } as CSSProperties}>
              忽略
            </div>
          </div>
        </div>

        <SectionTitle>Diff · compute_sparsity.py</SectionTitle>
        <div style={{ background: 'var(--dark-surface)', borderRadius: '10px', padding: '10px 12px', marginBottom: '18px', fontFamily: 'var(--mono)', fontSize: '11px', overflow: 'auto' } as CSSProperties}>
          <div style={{ color: 'var(--dark-text-2)' } as CSSProperties}>…</div>
          <div style={{ background: 'rgba(224,108,90,.15)', color: '#E39A85', padding: '2px 6px' } as CSSProperties}>-127 curve = layer_sparsity(logs, window=4)</div>
          <div style={{ background: 'rgba(127,187,106,.15)', color: '#9FCB8F', padding: '2px 6px' } as CSSProperties}>+127 curve = layer_sparsity(logs, window=8)</div>
          <div style={{ color: 'var(--dark-text-2)' } as CSSProperties}>…</div>
        </div>

        <SectionTitle>终端输出</SectionTitle>
        <div style={{ background: 'var(--dark-surface)', borderRadius: '10px', padding: '10px 12px', marginBottom: '18px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--dark-text-2)', overflow: 'auto' } as CSSProperties}>
          <div>$ python3 compute_sparsity.py --layers 12-20</div>
          <div>layer 12 sparsity 0.71</div>
          <div>layer 15 sparsity 0.68</div>
          <div>layer 18 sparsity 0.66</div>
          <div style={{ color: '#9FCB8F' } as CSSProperties}>✓ exited 0</div>
        </div>

        <SectionTitle>工具调用</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' } as CSSProperties}>
          {['Read(compute_sparsity.py)', 'Update(compute_sparsity.py)', 'Bash(python3 compute_sparsity.py)'].map((call) => (
            <div
              key={call}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'var(--dark-surface)',
                borderRadius: '8px',
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                color: 'var(--dark-text-2)',
              } as CSSProperties}
            >
              <span>{call}</span>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: '14px 18px 18px', borderTop: '1px solid var(--dark-border)' } as CSSProperties}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--dark-surface)',
            border: '1px solid var(--dark-border)',
            borderRadius: '22px',
            padding: '9px 14px',
          } as CSSProperties}
        >
          <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--dark-text-2)' } as CSSProperties}>向 Pilot 提问或下达任务…</span>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--dark-text-2)" strokeWidth="1.6">
            <path d="M4 10h12M11 5l5 5-5 5" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: '10.5px',
        fontWeight: 600,
        color: 'var(--dark-text-2)',
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        marginBottom: '8px',
      } as CSSProperties}
    >
      {children}
    </div>
  )
}

function TaskDone({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px', color: '#9FCB8F' } as CSSProperties}>
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 8.5l3 3 7-8" />
      </svg>
      <span style={{ textDecoration: 'line-through', color: 'var(--dark-text-2)' } as CSSProperties}>{label}</span>
    </div>
  )
}

function TaskTodo({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' } as CSSProperties}>
      <span style={{ width: '11px', height: '11px', border: '1.5px solid var(--dark-text-2)', borderRadius: '3px', flexShrink: 0 } as CSSProperties} />
      {label}
    </div>
  )
}
