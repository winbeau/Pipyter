import { useState, type CSSProperties } from 'react'
import { FiguresDesign } from '../design/pages/FiguresDesign'

type Layer = 'line1' | 'line2' | 'scatter' | 'legend' | 'xaxis' | 'yaxis'
type ExportFormat = 'png' | 'svg' | 'pdf'

const layerNames: Record<Layer, string> = {
  line1: 'Line 1',
  line2: 'Line 2',
  scatter: 'Scatter',
  legend: 'Legend',
  xaxis: 'X Axis',
  yaxis: 'Y Axis',
}

const layerStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '5px 8px',
  borderRadius: 6,
  cursor: 'pointer',
  background: active ? '#F2E1D2' : 'transparent',
  color: active ? '#96481C' : '#211C15',
  fontWeight: active ? 600 : 400,
})

const toggleStyle = (on: boolean): CSSProperties => ({
  width: 30,
  height: 17,
  borderRadius: 20,
  background: on ? '#C1622C' : '#E3DDCE',
  position: 'relative',
  cursor: 'pointer',
  flexShrink: 0,
})

const knobStyle = (on: boolean): CSSProperties => ({
  width: 13,
  height: 13,
  borderRadius: '50%',
  background: '#fff',
  position: 'absolute',
  top: 2,
  left: on ? 15 : 2,
  transition: 'left .15s',
})

const formatStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  textAlign: 'center',
  padding: 6,
  borderRadius: 6,
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  background: active ? '#F2E1D2' : 'transparent',
  color: active ? '#96481C' : '#6E6656',
  border: active ? 'none' : '1px solid #E3DDCE',
})

export function FiguresPage() {
  const [selectedLayer, setSelectedLayer] = useState<Layer>('line1')
  const [pigentOpen, setPigentOpen] = useState(false)
  const [frame, setFrame] = useState(true)
  const [tight, setTight] = useState(true)
  const [transparent, setTransparent] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('png')

  return (
    <FiguresDesign
      selectedLineName={layerNames[selectedLayer]}
      selectedLineLabelStyle={{ color: '#96481C', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}
      pigentOpen={pigentOpen}
      pigentToggleStyle={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        background: pigentOpen ? '#F2E1D2' : 'transparent',
        color: pigentOpen ? '#96481C' : '#6E6656',
        border: pigentOpen ? 'none' : '1px solid #E3DDCE',
      }}
      layerLine1Style={layerStyle(selectedLayer === 'line1')}
      layerLine2Style={layerStyle(selectedLayer === 'line2')}
      layerScatterStyle={layerStyle(selectedLayer === 'scatter')}
      layerLegendStyle={layerStyle(selectedLayer === 'legend')}
      layerXAxisStyle={layerStyle(selectedLayer === 'xaxis')}
      layerYAxisStyle={layerStyle(selectedLayer === 'yaxis')}
      frameToggleStyle={toggleStyle(frame)}
      frameToggleKnobStyle={knobStyle(frame)}
      tightToggleStyle={toggleStyle(tight)}
      tightToggleKnobStyle={knobStyle(tight)}
      transparentToggleStyle={toggleStyle(transparent)}
      transparentToggleKnobStyle={knobStyle(transparent)}
      formatPngStyle={formatStyle(format === 'png')}
      formatSvgStyle={formatStyle(format === 'svg')}
      formatPdfStyle={formatStyle(format === 'pdf')}
      togglePigent={() => setPigentOpen((open) => !open)}
      selectLine1={() => setSelectedLayer('line1')}
      selectLine2={() => setSelectedLayer('line2')}
      selectScatter={() => setSelectedLayer('scatter')}
      selectLegend={() => setSelectedLayer('legend')}
      selectXAxis={() => setSelectedLayer('xaxis')}
      selectYAxis={() => setSelectedLayer('yaxis')}
      toggleFrame={() => setFrame((on) => !on)}
      toggleTight={() => setTight((on) => !on)}
      toggleTransparent={() => setTransparent((on) => !on)}
      setFormatPng={() => setFormat('png')}
      setFormatSvg={() => setFormat('svg')}
      setFormatPdf={() => setFormat('pdf')}
    />
  )
}
