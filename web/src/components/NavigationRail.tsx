import { Bot, ChartNoAxesCombined, House, PanelsTopLeft, Settings, type LucideIcon } from 'lucide-react'

export type PageId = 'home' | 'workspace' | 'pilot' | 'figures' | 'settings'

type NavigationRailProps = {
  page: PageId
  onNavigate: (page: PageId) => void
}

type NavItem = {
  id: string
  label: string
  page: PageId
  icon: LucideIcon
}

const items: NavItem[] = [
  { id: 'home', label: 'Home', page: 'home', icon: House },
  { id: 'workspace', label: 'Workspace', page: 'workspace', icon: PanelsTopLeft },
  { id: 'figures', label: 'Figures', page: 'figures', icon: ChartNoAxesCombined },
  { id: 'agent', label: 'Agent', page: 'pilot', icon: Bot },
  { id: 'settings', label: 'Settings', page: 'settings', icon: Settings },
]

export function NavigationRail({ page, onNavigate }: NavigationRailProps) {
  return (
    <aside className="navigation-rail" aria-label="主导航">
      <button className="brand-mark" onClick={() => onNavigate('home')} aria-label="返回首页">P</button>
      <nav className="rail-items">
        {items.map((item) => {
          const active = item.id === page || (item.id === 'agent' && page === 'pilot')
          const Icon = item.icon
          return (
            <button
              type="button"
              className={`rail-item${active ? ' rail-item-active' : ''}`}
              key={item.id}
              onClick={() => onNavigate(item.page)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
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
