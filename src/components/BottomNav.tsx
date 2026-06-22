import { NavLink } from 'react-router-dom'
import { Home, PlusCircle, History, Boxes, Settings, Dumbbell } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const items = [
  { to: '/', icon: Home, key: 'home', end: true },
  { to: '/history', icon: History, key: 'history', end: false },
  { to: '/recipe/new', icon: PlusCircle, key: 'new', end: false },
  { to: '/gym', icon: Dumbbell, key: 'gym', end: false },
  { to: '/beans', icon: Boxes, key: 'library', end: false },
  { to: '/settings', icon: Settings, key: 'settings', end: false },
] as const

export function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={key}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition ${
                isActive ? 'text-brand' : 'text-muted hover:text-text'
              }`
            }
          >
            <Icon size={22} strokeWidth={2} />
            <span>{t(`nav.${key}`)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
