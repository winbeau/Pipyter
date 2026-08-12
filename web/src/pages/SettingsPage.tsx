import { useState, type CSSProperties } from 'react'
import { codeThemeOptions, setAppearance, useAppearance } from '../appearance'
import { SettingsDesign } from '../design/pages/SettingsDesign'
import { ProviderSettings } from '../settings/ProviderSettings'

type Section = 'general' | 'workspace' | 'kernels' | 'figures' | 'agent' | 'providers' | 'permissions' | 'appearance' | 'account'

const navStyle = (active: boolean): CSSProperties => ({
  padding: '9px 10px',
  borderRadius: 8,
  fontSize: 13.5,
  cursor: 'pointer',
  marginBottom: 2,
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

export function SettingsPage() {
  const appearance = useAppearance()
  const [section, setSection] = useState<Section>('general')
  const [autosave, setAutosave] = useState(true)
  const [indexing, setIndexing] = useState(true)
  const [hiddenFiles, setHiddenFiles] = useState(false)
  const [ctxNotebook, setCtxNotebook] = useState(true)
  const [ctxFigure, setCtxFigure] = useState(true)
  const [ctxTerminal, setCtxTerminal] = useState(false)

  return (
    <SettingsDesign
      isGeneral={section === 'general'}
      isWorkspace={section === 'workspace'}
      isKernels={section === 'kernels'}
      isFigures={section === 'figures'}
      isAgent={section === 'agent'}
      isProviders={section === 'providers'}
      isPermissions={section === 'permissions'}
      isAppearance={section === 'appearance'}
      isAccount={section === 'account'}
      codeTheme={appearance.codeTheme}
      codeThemeOptions={codeThemeOptions}
      density={appearance.density}
      onCodeThemeChange={(codeTheme) => setAppearance({ codeTheme })}
      onDensityChange={(density) => setAppearance({ density })}
      providersContent={<ProviderSettings />}
      navGeneralStyle={navStyle(section === 'general')}
      navWorkspaceStyle={navStyle(section === 'workspace')}
      navKernelsStyle={navStyle(section === 'kernels')}
      navFiguresStyle={navStyle(section === 'figures')}
      navAgentStyle={navStyle(section === 'agent')}
      navProvidersStyle={navStyle(section === 'providers')}
      navPermissionsStyle={navStyle(section === 'permissions')}
      navAppearanceStyle={navStyle(section === 'appearance')}
      navAccountStyle={navStyle(section === 'account')}
      autosaveToggleStyle={toggleStyle(autosave)}
      autosaveKnobStyle={knobStyle(autosave)}
      indexingToggleStyle={toggleStyle(indexing)}
      indexingKnobStyle={knobStyle(indexing)}
      hiddenToggleStyle={toggleStyle(hiddenFiles)}
      hiddenKnobStyle={knobStyle(hiddenFiles)}
      ctxNotebookToggleStyle={toggleStyle(ctxNotebook)}
      ctxNotebookKnobStyle={knobStyle(ctxNotebook)}
      ctxFigureToggleStyle={toggleStyle(ctxFigure)}
      ctxFigureKnobStyle={knobStyle(ctxFigure)}
      ctxTerminalToggleStyle={toggleStyle(ctxTerminal)}
      ctxTerminalKnobStyle={knobStyle(ctxTerminal)}
      goGeneral={() => setSection('general')}
      goWorkspace={() => setSection('workspace')}
      goKernels={() => setSection('kernels')}
      goFigures={() => setSection('figures')}
      goAgent={() => setSection('agent')}
      goProviders={() => setSection('providers')}
      goPermissions={() => setSection('permissions')}
      goAppearance={() => setSection('appearance')}
      goAccount={() => setSection('account')}
      toggleAutosave={() => setAutosave((on) => !on)}
      toggleIndexing={() => setIndexing((on) => !on)}
      toggleHidden={() => setHiddenFiles((on) => !on)}
      toggleCtxNotebook={() => setCtxNotebook((on) => !on)}
      toggleCtxFigure={() => setCtxFigure((on) => !on)}
      toggleCtxTerminal={() => setCtxTerminal((on) => !on)}
    />
  )
}
