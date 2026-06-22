import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { BrewResumeBar } from './BrewResumeBar'

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <BrewResumeBar />
      <BottomNav />
    </div>
  )
}
