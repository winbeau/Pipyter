import { useEffect, useState } from 'react'
import { NavigationRail, type PageId } from './components/NavigationRail'
import { FiguresPage } from './pages/FiguresPage'
import { HomePage } from './pages/HomePage'
import { PilotPage } from './pages/PilotPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkspacePage } from './pages/WorkspacePage'

const routes: Record<string, PageId> = {
  '': 'home',
  '/': 'home',
  '/home': 'home',
  '/workspace': 'workspace',
  '/pilot': 'pilot',
  '/figures': 'figures',
  '/settings': 'settings',
}

const paths: Record<PageId, string> = {
  home: '/',
  workspace: '/workspace',
  pilot: '/pilot',
  figures: '/figures',
  settings: '/settings',
}

const pageFromHash = () => routes[window.location.hash.slice(1)] ?? 'home'

export default function App() {
  const [page, setPage] = useState<PageId>(pageFromHash)

  useEffect(() => {
    const syncRoute = () => setPage(pageFromHash())
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const navigate = (nextPage: PageId) => {
    const nextHash = `#${paths[nextPage]}`
    if (window.location.hash === nextHash) setPage(nextPage)
    else window.location.hash = nextHash
  }

  return (
    <div className="app-viewport">
      <div className="app-shell">
        <NavigationRail page={page} onNavigate={navigate} />
        <main className="page-slot">
          {page === 'home' && <HomePage />}
          {page === 'workspace' && <WorkspacePage />}
          {page === 'pilot' && <PilotPage />}
          {page === 'figures' && <FiguresPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  )
}
