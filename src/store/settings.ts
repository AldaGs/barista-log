import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TempUnit } from '@/lib/units'
import type { FlowRate } from '@/db/types'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Lang = 'en' | 'es'
export type AccentId = 'midnight' | 'plum' | 'teal' | 'coffee'

/**
 * Default pour speeds in grams of water per second, by flow rate. Used to
 * estimate how long each pour should take so the brew player can show when to
 * finish (finalize) the pour within a step's time window.
 */
export const DEFAULT_POUR_RATES: Record<FlowRate, number> = {
  slow: 3,
  medium: 5,
  fast: 8,
}

/** Accent presets. `brand`/`accent` are "r g b" triplets used in CSS vars. */
export const ACCENTS: Record<
  AccentId,
  { brandLight: string; brandDark: string; accent: string }
> = {
  midnight: { brandLight: '64 86 214', brandDark: '116 134 248', accent: '120 196 214' },
  plum: { brandLight: '124 78 214', brandDark: '167 130 247', accent: '210 150 235' },
  teal: { brandLight: '20 142 150', brandDark: '60 196 196', accent: '150 210 180' },
  coffee: { brandLight: '176 110 64', brandDark: '201 138 90', accent: '122 188 165' },
}

interface SupabaseConfig {
  url: string
  anonKey: string
}

interface SettingsState {
  theme: ThemeMode
  lang: Lang
  accent: AccentId
  tempUnit: TempUnit
  /** grams of water per second for each pour flow rate */
  pourRates: Record<FlowRate, number>
  /** master switch for audio + haptic step cues */
  cuesEnabled: boolean
  /** cue loudness as the peak WebAudio gain (0..1) */
  cueVolume: number
  /** seconds of beeps before each step ends (0 = off) */
  stepEndCountdown: number
  /** beep when the active pour should be finished */
  pourMarkCue: boolean
  supabase: SupabaseConfig | null
  setTheme: (t: ThemeMode) => void
  setLang: (l: Lang) => void
  setAccent: (a: AccentId) => void
  setTempUnit: (u: TempUnit) => void
  setPourRate: (rate: FlowRate, gramsPerSec: number) => void
  resetPourRates: () => void
  setCuesEnabled: (on: boolean) => void
  setCueVolume: (v: number) => void
  setStepEndCountdown: (secs: number) => void
  setPourMarkCue: (on: boolean) => void
  setSupabase: (c: SupabaseConfig | null) => void
}

/** Default cue loudness (peak WebAudio gain). */
export const DEFAULT_CUE_VOLUME = 0.25

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      lang: (navigator.language?.startsWith('es') ? 'es' : 'en') as Lang,
      accent: 'midnight',
      tempUnit: 'C',
      pourRates: { ...DEFAULT_POUR_RATES },
      cuesEnabled: true,
      cueVolume: DEFAULT_CUE_VOLUME,
      stepEndCountdown: 3,
      pourMarkCue: true,
      supabase: null,
      setTheme: (theme) => set({ theme }),
      setLang: (lang) => set({ lang }),
      setAccent: (accent) => set({ accent }),
      setTempUnit: (tempUnit) => set({ tempUnit }),
      setPourRate: (rate, gramsPerSec) =>
        set((s) => ({ pourRates: { ...s.pourRates, [rate]: gramsPerSec } })),
      resetPourRates: () => set({ pourRates: { ...DEFAULT_POUR_RATES } }),
      setCuesEnabled: (cuesEnabled) => set({ cuesEnabled }),
      setCueVolume: (cueVolume) => set({ cueVolume: Math.min(1, Math.max(0, cueVolume)) }),
      setStepEndCountdown: (stepEndCountdown) => set({ stepEndCountdown }),
      setPourMarkCue: (pourMarkCue) => set({ pourMarkCue }),
      setSupabase: (supabase) => set({ supabase }),
    }),
    { name: 'barista-settings' },
  ),
)

function isDark(theme: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return theme === 'dark' || (theme === 'system' && prefersDark)
}

/** Resolve theme to an effective light/dark and apply the .dark class. */
export function applyTheme(theme: ThemeMode) {
  const dark = isDark(theme)
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', dark ? '#0d0e15' : '#f7f8fb')
}

/** Apply the chosen accent to the brand CSS variables (light/dark aware). */
export function applyAccent(accent: AccentId, theme: ThemeMode) {
  const a = ACCENTS[accent] ?? ACCENTS.midnight
  const root = document.documentElement
  root.style.setProperty('--brand', isDark(theme) ? a.brandDark : a.brandLight)
  root.style.setProperty('--accent', a.accent)
}
