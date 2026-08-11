import { ChartNoAxesCombined, House, Orbit, PanelsTopLeft, Settings, type LucideIcon } from 'lucide-react'
export type PageId = 'home' | 'workspace' | 'pigent' | 'figures' | 'settings'
type Props = { page: PageId; onNavigate(page: PageId): void }
type NavItem = { id: PageId; label: string; icon: LucideIcon }
const items: NavItem[] = [
  { id: 'home', label: 'Home', icon: House }, { id: 'workspace', label: 'Workspace', icon: PanelsTopLeft },
  { id: 'figures', label: 'Figures', icon: ChartNoAxesCombined }, { id: 'pigent', label: 'Pigent', icon: Orbit }, { id: 'settings', label: 'Settings', icon: Settings },
]
export function NavigationRail({ page, onNavigate }: Props) { return <aside className="navigation-rail" aria-label="主导航"><button className="brand-mark" onClick={() => onNavigate('home')} aria-label="返回首页">P</button><nav className="rail-items">{items.map((item) => { const Icon = item.icon; return <button type="button" className={`rail-item${page === item.id ? ' rail-item-active' : ''}`} key={item.id} onClick={() => onNavigate(item.id)} aria-current={page === item.id ? 'page' : undefined}><Icon size={21} strokeWidth={1.7} aria-hidden="true" /><span>{item.label}</span></button> })}</nav><div className="rail-spacer" /><div className="user-avatar" title="王贝">王</div></aside> }
