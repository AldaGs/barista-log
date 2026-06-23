import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomNav } from './BottomNav'
import { BrewResumeBar } from './BrewResumeBar'
import { ColdSteepBar } from './ColdSteepBar'

export function AppLayout() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
        {/* Footer with privacy/terms links — present on every page (incl. the
            home page) so it's reachable for users and for OAuth verification. */}
        <footer className="mt-8 border-t border-border pt-4 text-center text-xs text-muted">
          <a className="underline hover:text-text" href="/privacy.html">
            {t('settings.privacyPolicy')}
          </a>
          <span className="px-2">·</span>
          <a className="underline hover:text-text" href="/terms.html">
            {t('settings.termsOfService')}
          </a>
        </footer>
      </main>
      <ColdSteepBar />
      <BrewResumeBar />
      <BottomNav />
    </div>
  )
}
