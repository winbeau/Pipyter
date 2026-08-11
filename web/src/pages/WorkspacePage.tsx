import { useState, type CSSProperties } from 'react'
import { WorkspaceApp } from '../workspace/WorkspaceApp'

export function WorkspacePage() {
  const [pilotOpen, setPilotOpen] = useState(true)
  const pilotToggleStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 20,
    cursor: 'pointer',
    background: pilotOpen ? '#F2E1D2' : 'transparent',
    color: pilotOpen ? '#96481C' : '#6E6656',
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
