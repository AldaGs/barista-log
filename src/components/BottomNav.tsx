import { useLocation, useNavigate } from 'react-router-dom'
import { Home, History, Boxes, Settings, Dumbbell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TAB_ROOT, tabForPath, useNavTabs, type TabKey } from '@/store/navTabs'

const items = [
  { tab: 'home', icon: Home, key: 'home' },
  { tab: 'history', icon: History, key: 'history' },
  { tab: 'gym', icon: Dumbbell, key: 'gym' },
  { tab: 'library', icon: Boxes, key: 'library' },
  { tab: 'settings', icon: Settings, key: 'settings' },
] as const satisfies readonly { tab: TabKey; icon: typeof Home; key: string }[]

export function BottomNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const lastLocation = useNavTabs((s) => s.lastLocation)
  const skipNextHomeRecord = useNavTabs((s) => s.skipNextHomeRecord)
  const activeTab = tabForPath(location.pathname)

  const go = (tab: TabKey) => {
    // Re-tapping the active tab returns to its root (native behaviour);
    // otherwise restore wherever we last were inside that tab.
    const target = tab === activeTab ? TAB_ROOT[tab] : lastLocation[tab]
    if (target === '/') {
      navigate('/')
      return
    }
    // Splice Home in beneath the destination so the OS/swipe back gesture
    // always pops a non-Home tab back to Home, instead of unwinding the flat
    // browser history through whatever tabs were visited before (which made it
    // feel like a web page). Sub-windows opened from here still push normally.
    // The transient '/' must not overwrite the Home tab's saved sub-window.
    skipNextHomeRecord()
    navigate('/', { replace: true })
    navigate(target)
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ tab, icon: Icon, key }) => {
          const isActive = tab === activeTab
          return (
            <button
              key={key}
              onClick={() => go(tab)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition ${
                isActive ? 'text-brand' : 'text-muted hover:text-text'
              }`}
            >
              <Icon size={22} strokeWidth={2} />
              <span>{t(`nav.${key}`)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
