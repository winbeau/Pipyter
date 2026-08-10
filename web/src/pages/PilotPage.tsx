import { useState, type CSSProperties } from 'react'
import { PilotDesign } from '../design/pages/PilotDesign'

export function PilotPage() {
  const [panelOpen, setPanelOpen] = useState(false)
  const panelToggleStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 20,
    cursor: 'pointer',
    background: panelOpen ? '#F2E1D2' : 'transparent',
    color: panelOpen ? '#96481C' : '#6E6656',
  }

  return (
    <PilotDesign
      panelOpen={panelOpen}
      panelToggleStyle={panelToggleStyle}
      togglePanel={() => setPanelOpen((open) => !open)}
    />
  )
}
