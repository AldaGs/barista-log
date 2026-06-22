import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ensureSeedData } from './db/dexie'
import { migrateForkTitles } from './db/repo'
import { initSync } from './sync/syncManager'
import { ensurePersistence } from './lib/storage'
import './lib/pwa' // registers the beforeinstallprompt capture early
import { applyAccent, applyTheme, useSettings } from './store/settings'
import './i18n'
import './styles/index.css'

// Apply theme + accent before first paint and keep them in sync.
function applyAppearance() {
  const { theme, accent } = useSettings.getState()
  applyTheme(theme)
  applyAccent(accent, theme)
}
applyAppearance()
useSettings.subscribe(applyAppearance)
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', applyAppearance)

ensureSeedData()
// One-time cleanup of legacy stacked "(fork)" titles → cascade versions.
migrateForkTitles()
initSync()
// Ask the browser to keep our IndexedDB data durable (not auto-evicted).
ensurePersistence()

// Suppress the native long-press / right-click context menu for a more
// app-like feel (text selection callouts, "save image", etc.), while still
// allowing it on text fields so right-click paste keeps working.
window.addEventListener('contextmenu', (e) => {
  const el = e.target as HTMLElement | null
  if (el?.closest('input, textarea, [contenteditable="true"]')) return
  e.preventDefault()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>,
)
