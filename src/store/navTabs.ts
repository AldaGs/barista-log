import { create } from 'zustand'

/**
 * Native-app-style tab navigation.
 *
 * The bottom bar exposes five "tabs", each of which is really the root of its
 * own little navigation stack (Home → recipe → edit, Library → bean → cupping,
 * …). A browser router only knows one flat history, so switching tabs and
 * coming back would drop you at the tab root and lose whatever sub-window you
 * had open.
 *
 * To feel native we remember the *last* location visited inside each tab and
 * restore it when the tab is tapped again. Switching to Library and back to
 * Home returns you to the recipe you were editing, not the recipe list.
 *
 * State is intentionally in-memory only: a cold start should land on the tab
 * roots, the same way a freshly launched native app does.
 */

export type TabKey = 'home' | 'history' | 'gym' | 'library' | 'settings'

export const TAB_ROOT: Record<TabKey, string> = {
  home: '/',
  history: '/history',
  gym: '/gym',
  library: '/beans',
  settings: '/settings',
}

// Path prefixes that belong to a non-home tab. Anything not listed here
// (the index route, recipes, brewing, importing, …) lives under Home.
const ROUTE_TAB: { prefix: string; tab: TabKey }[] = [
  { prefix: '/history', tab: 'history' },
  { prefix: '/stats', tab: 'history' },
  { prefix: '/compare', tab: 'history' },
  { prefix: '/gym', tab: 'gym' },
  { prefix: '/beans', tab: 'library' },
  { prefix: '/bean', tab: 'library' },
  { prefix: '/cupping', tab: 'library' },
  { prefix: '/water', tab: 'library' },
  { prefix: '/equipment', tab: 'library' },
  { prefix: '/grinders', tab: 'library' },
  { prefix: '/gear', tab: 'library' },
  { prefix: '/maintenance', tab: 'library' },
  { prefix: '/labels', tab: 'library' },
  { prefix: '/settings', tab: 'settings' },
  { prefix: '/profile', tab: 'settings' },
  { prefix: '/help', tab: 'settings' },
]

/** Which tab does this pathname conceptually belong to? */
export function tabForPath(pathname: string): TabKey {
  for (const { prefix, tab } of ROUTE_TAB) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return tab
  }
  return 'home'
}

interface NavTabsState {
  /** Last full location (pathname + search) visited inside each tab. */
  lastLocation: Record<TabKey, string>
  remember: (pathname: string, search: string) => void
}

export const useNavTabs = create<NavTabsState>((set) => ({
  lastLocation: { ...TAB_ROOT },
  remember: (pathname, search) =>
    set((s) => ({
      lastLocation: {
        ...s.lastLocation,
        [tabForPath(pathname)]: pathname + search,
      },
    })),
}))
