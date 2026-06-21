import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TempUnit } from '@/lib/units'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Lang = 'en' | 'es'

interface SupabaseConfig {
  url: string
  anonKey: string
}

interface SettingsState {
  theme: ThemeMode
  lang: Lang
  tempUnit: TempUnit
  supabase: SupabaseConfig | null
  setTheme: (t: ThemeMode) => void
  setLang: (l: Lang) => void
  setTempUnit: (u: TempUnit) => void
  setSupabase: (c: SupabaseConfig | null) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      lang: (navigator.language?.startsWith('es') ? 'es' : 'en') as Lang,
      tempUnit: 'C',
      supabase: null,
      setTheme: (theme) => set({ theme }),
      setLang: (lang) => set({ lang }),
      setTempUnit: (tempUnit) => set({ tempUnit }),
      setSupabase: (supabase) => set({ supabase }),
    }),
    { name: 'barista-settings' },
  ),
)

/** Resolve theme to an effective light/dark and apply the .dark class. */
export function applyTheme(theme: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', dark ? '#171210' : '#f7f4f0')
}
