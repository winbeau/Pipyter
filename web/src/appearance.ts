import { useSyncExternalStore } from 'react'

export type CodeThemeId = 'jupyter' | 'feiyue' | 'pipyter'
export type WorkspaceDensity = 'comfortable' | 'compact'

export type AppearancePreferences = {
  codeTheme: CodeThemeId
  density: WorkspaceDensity
}

export type CodeThemeOption = {
  id: CodeThemeId
  label: string
  description: string
  background: string
  accent: string
}

export const codeThemeOptions: ReadonlyArray<CodeThemeOption> = [
  {
    id: 'jupyter',
    label: 'JupyterLab Light',
    description: 'JupyterLab 默认浅色编辑器与原生语法配色',
    background: '#ffffff',
    accent: '#1976d2',
  },
  {
    id: 'feiyue',
    label: 'Feiyue Soft',
    description: 'xju-feiyue 的低饱和暖色语法与柔和底色',
    background: '#ffffff',
    accent: '#0f7b6c',
  },
  {
    id: 'pipyter',
    label: 'Pipyter Clear',
    description: '更清晰的蓝紫层次，仍保持全浅色编辑区',
    background: '#ffffff',
    accent: '#4a67d6',
  },
]

const STORAGE_KEY = 'pipyter.appearance.v1'
const DEFAULT_APPEARANCE: AppearancePreferences = {
  codeTheme: 'jupyter',
  density: 'comfortable',
}

const isCodeTheme = (value: unknown): value is CodeThemeId =>
  value === 'jupyter' || value === 'feiyue' || value === 'pipyter'

const isDensity = (value: unknown): value is WorkspaceDensity =>
  value === 'comfortable' || value === 'compact'

function readAppearance(): AppearancePreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const parsed = JSON.parse(raw) as Partial<AppearancePreferences>
    return {
      codeTheme: isCodeTheme(parsed.codeTheme) ? parsed.codeTheme : DEFAULT_APPEARANCE.codeTheme,
      density: isDensity(parsed.density) ? parsed.density : DEFAULT_APPEARANCE.density,
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

let currentAppearance = readAppearance()
const listeners = new Set<() => void>()

function applyAppearance(preferences: AppearancePreferences): void {
  document.documentElement.dataset.codeTheme = preferences.codeTheme
  document.documentElement.dataset.workspaceDensity = preferences.density
}

function emitAppearance(): void {
  for (const listener of listeners) listener()
}

applyAppearance(currentAppearance)

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return
  currentAppearance = readAppearance()
  applyAppearance(currentAppearance)
  emitAppearance()
})

export function setAppearance(patch: Partial<AppearancePreferences>): void {
  const next = { ...currentAppearance, ...patch }
  if (next.codeTheme === currentAppearance.codeTheme && next.density === currentAppearance.density) return
  currentAppearance = next
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAppearance))
  applyAppearance(currentAppearance)
  emitAppearance()
}

export function useAppearance(): AppearancePreferences {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => currentAppearance,
    () => DEFAULT_APPEARANCE,
  )
}
