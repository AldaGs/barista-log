import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ensureSeedData } from './db/dexie'
import { applyTheme, useSettings } from './store/settings'
import './i18n'
import './styles/index.css'

// Apply theme before first paint and keep it in sync.
applyTheme(useSettings.getState().theme)
useSettings.subscribe((s) => applyTheme(s.theme))
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => applyTheme(useSettings.getState().theme))

ensureSeedData()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
