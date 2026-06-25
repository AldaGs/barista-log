import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { BrewResumeBar } from './BrewResumeBar'
import { ColdSteepBar } from './ColdSteepBar'
import { useNavTabs } from '@/store/navTabs'

export function AppLayout() {
  const location = useLocation()
  const remember = useNavTabs((s) => s.remember)

  // Record the current location against its tab so tapping that tab again
  // restores this exact sub-window (see navTabs store).
  useEffect(() => {
    remember(location.pathname, location.search)
  }, [location.pathname, location.search, remember])

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <ColdSteepBar />
      <BrewResumeBar />
      <BottomNav />
    </div>
  )
}
