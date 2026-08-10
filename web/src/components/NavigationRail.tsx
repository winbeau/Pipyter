export type PageId = 'home' | 'workspace' | 'pilot' | 'figures' | 'settings'

type NavigationRailProps = {
  page: PageId
  onNavigate: (page: PageId) => void
}

type NavItem = {
  id: string
  label: string
  page: PageId
  icon: 'home' | 'workspace' | 'figure' | 'agent' | 'settings'
}

const items: NavItem[] = [
  { id: 'home', label: 'Home', page: 'home', icon: 'home' },
  { id: 'workspace', label: 'Workspace', page: 'workspace', icon: 'workspace' },
  { id: 'figures', label: 'Figures', page: 'figures', icon: 'figure' },
  { id: 'agent', label: 'Agent', page: 'pilot', icon: 'agent' },
  { id: 'settings', label: 'Settings', page: 'settings', icon: 'settings' },
]

function NavIcon({ name }: { name: NavItem['icon'] }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
  }

  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 9 10 3l7 6"/><path d="M5 8v8h10V8"/></svg>
    case 'workspace':
      return <svg {...common}><rect x="2.5" y="2.5" width="15" height="15" rx="2"/><path d="M8 2.5v15"/></svg>
    case 'figure':
      return <svg {...common}><rect x="2.5" y="3" width="15" height="14" rx="1.5"/><path d="m5.5 13.5 3-3.5 2.5 2.5 3.5-4.5"/></svg>
    case 'agent':
      return <svg {...common}><circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none"/><path d="M10 1.8v1.7M10 16.5v1.7M1.8 10h1.7M16.5 10h1.7"/></svg>
    case 'settings':
      return <svg {...common}><circle cx="10" cy="10" r="2.6"/><path d="M10 3v2M10 15v2M17 10h-2M5 10H3M14.8 5.2l-1.4 1.4M6.6 13.4l-1.4 1.4M14.8 14.8l-1.4-1.4M6.6 6.6 5.2 5.2"/></svg>
  }
}

export function NavigationRail({ page, onNavigate }: NavigationRailProps) {
  return (
    <aside className="navigation-rail" aria-label="主导航">
      <button className="brand-mark" onClick={() => onNavigate('home')} aria-label="返回首页">P</button>
      <nav className="rail-items">
        {items.map((item) => {
          const active = item.id === page || (item.id === 'agent' && page === 'pilot')
          return (
            <button
              type="button"
              className={`rail-item${active ? ' rail-item-active' : ''}`}
              key={item.id}
              onClick={() => onNavigate(item.page)}
              aria-current={active ? 'page' : undefined}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="rail-spacer" />
      <div className="user-avatar" title="王贝">王</div>
    </aside>
  )
}
