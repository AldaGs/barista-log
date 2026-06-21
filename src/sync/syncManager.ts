import { create } from 'zustand'
import { getSupabase } from './supabaseClient'
import { syncNow } from './syncEngine'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'disabled'

interface SyncState {
  status: SyncStatus
  lastSyncedAt: number | null
  error: string | null
  set: (p: Partial<SyncState>) => void
}

export const useSyncStatus = create<SyncState>((set) => ({
  status: 'disabled',
  lastSyncedAt: Number(localStorage.getItem('barista-last-synced')) || null,
  error: null,
  set: (p) => set(p),
}))

let timer: number | null = null
let running = false

/** Run a sync immediately (used by "Sync now" and on sign-in). */
export async function runSync(): Promise<void> {
  if (running) return
  if (!getSupabase()) {
    useSyncStatus.getState().set({ status: 'disabled' })
    return
  }
  if (!navigator.onLine) {
    useSyncStatus.getState().set({ status: 'offline' })
    return
  }
  running = true
  useSyncStatus.getState().set({ status: 'syncing', error: null })
  try {
    const res = await syncNow()
    if ('skipped' in res) {
      useSyncStatus.getState().set({ status: 'disabled' })
    } else {
      localStorage.setItem('barista-last-synced', String(res.at))
      useSyncStatus.getState().set({ status: 'idle', lastSyncedAt: res.at })
    }
  } catch (e) {
    useSyncStatus.getState().set({ status: 'error', error: (e as Error).message })
  } finally {
    running = false
  }
}

/** Debounced trigger called after every local write. Safe when cloud is off. */
export function triggerSync(): void {
  if (!getSupabase() || !navigator.onLine) return
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => void runSync(), 1500)
}

/** Wire up background triggers once, at app start. */
export function initSync(): void {
  window.addEventListener('online', () => void runSync())
  window.addEventListener('offline', () =>
    useSyncStatus.getState().set({ status: 'offline' }),
  )
  // Initial sync if already connected + signed in.
  void runSync()
}
