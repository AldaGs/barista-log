import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { BrewResumeBar } from './BrewResumeBar'
import { ColdSteepBar } from './ColdSteepBar'

export function AppLayout() {
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
