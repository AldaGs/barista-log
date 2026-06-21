import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'

/**
 * Force the hardware/browser back button to return to Home from any other
 * page. We push a sentinel history entry on each non-home route so the next
 * back press fires `popstate`, which we intercept to navigate Home instead of
 * stepping back through history. From Home, back behaves normally (exits).
 */
function useBackToHome() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname === '/') return
    window.history.pushState(null, '', window.location.href)
    const onPop = () => navigate('/')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [pathname, navigate])
}

export function AppLayout() {
  useBackToHome()
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
