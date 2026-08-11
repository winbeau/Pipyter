import { useState, type CSSProperties } from 'react'
import { WorkspaceApp } from '../workspace/WorkspaceApp'

export function WorkspacePage() {
  const [pilotOpen, setPilotOpen] = useState(false)
  const pilotToggleStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    background: pilotOpen ? 'var(--pilot-soft)' : 'transparent',
    color: pilotOpen ? 'var(--pilot-dark)' : 'var(--text-2)',
    transition: 'background-color 120ms ease, color 120ms ease',
  }

  return (
    <WorkspaceApp
      pilotOpen={pilotOpen}
      pilotCollapsed={!pilotOpen}
      pilotToggleStyle={pilotToggleStyle}
      togglePilot={() => setPilotOpen((open) => !open)}
    />
  )
}
