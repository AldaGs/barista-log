import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ensureSeedData } from './db/dexie'
import { initSync } from './sync/syncManager'
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
initSync()

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
