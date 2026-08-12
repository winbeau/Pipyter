import { useEffect, useState } from 'react'
import { NavigationRail, type PageId } from './components/NavigationRail'
import { FiguresPage } from './pages/FiguresPage'
import { HomePage } from './pages/HomePage'
import { DesignPage } from './pages/DesignPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { PigentProvider } from './pigent/store'
import { RuntimeProvider, useRuntime } from './runtime/RuntimeProvider'
import { ShellProvider } from './shell/store'

const routes: Record<string, PageId> = { '': 'home', '/': 'home', '/home': 'home', '/workspace': 'workspace', '/pigent': 'pigent', '/figures': 'figures', '/settings': 'settings' }
const paths: Record<PageId, string> = { home: '/', workspace: '/workspace', pigent: '/pigent', figures: '/figures', settings: '/settings' }
function pageFromHash(): PageId {
  const path = window.location.hash.slice(1)
  if (path === '/pilot' || path === '/design') {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/pigent`)
    return 'pigent'
  }
  return routes[path] ?? 'home'
}

function RuntimeBoundApp() {
  const [page, setPage] = useState<PageId>(pageFromHash)
  const { target } = useRuntime()
  useEffect(() => { const sync = () => setPage(pageFromHash()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync) }, [])
  const navigate = (next: PageId) => { const hash = `#${paths[next]}`; if (location.hash === hash) setPage(next); else location.hash = hash }
  return <ShellProvider key={target.key} apiBase={target.apiBase}><PigentProvider apiBase={target.apiBase} runtimeKey={target.key} allowDemo={target.allowDemo}><div className="app-viewport"><div className="app-shell"><NavigationRail page={page} onNavigate={navigate} /><main className="page-slot">{page === 'home' && <HomePage />}{page === 'workspace' && <WorkspacePage />}{page === 'pigent' && <DesignPage />}{page === 'figures' && <FiguresPage />}{page === 'settings' && <SettingsPage />}</main></div></div></PigentProvider></ShellProvider>
}

export default function App() {
  return <RuntimeProvider><RuntimeBoundApp /></RuntimeProvider>
}
