import type { MaintenanceKind, MaintenanceTask } from '@/db/types'

/**
 * Maintenance "due" logic. A task with an interval and a last-done date is
 * either ok, due soon, or overdue; one-off jobs (no interval) and never-done
 * jobs surface as needing attention so they don't get forgotten.
 */

export type MaintenanceStatus = 'ok' | 'soon' | 'overdue' | 'unknown'

/** How many days before the due date we start nudging. */
const SOON_DAYS = 3
const DAY = 86_400_000

export interface MaintenanceState {
  status: MaintenanceStatus
  /** epoch ms the task is next due, or null when it can't be computed */
  dueAt: number | null
  /** whole days until due (negative = overdue), or null */
  daysLeft: number | null
}

export function maintenanceState(task: MaintenanceTask, nowMs = Date.now()): MaintenanceState {
  if (!task.intervalDays || !task.lastDoneAt) {
    // No schedule, or never logged: unknown until the user marks it done once.
    return { status: 'unknown', dueAt: null, daysLeft: null }
  }
  const dueAt = task.lastDoneAt + task.intervalDays * DAY
  const daysLeft = Math.floor((dueAt - nowMs) / DAY)
  const status: MaintenanceStatus =
    daysLeft < 0 ? 'overdue' : daysLeft <= SOON_DAYS ? 'soon' : 'ok'
  return { status, dueAt, daysLeft }
}

/** Tasks that want attention right now (overdue), most overdue first. */
export function dueTasks(tasks: MaintenanceTask[], nowMs = Date.now()): MaintenanceTask[] {
  return tasks
    .filter((t) => maintenanceState(t, nowMs).status === 'overdue')
    .sort((a, b) => (a.lastDoneAt ?? 0) - (b.lastDoneAt ?? 0))
}

/** Sensible default recurrence (days) for each kind — directional, editable. */
export const KIND_DEFAULT_INTERVAL: Record<MaintenanceKind, number | undefined> = {
  descale: 90,
  backflush: 7,
  'clean-grinder': 30,
  'replace-filter': 60,
  'replace-burr': 365,
  'clean-brewer': 14,
  other: undefined,
}

export const MAINTENANCE_KINDS: MaintenanceKind[] = [
  'descale',
  'backflush',
  'clean-grinder',
  'replace-filter',
  'replace-burr',
  'clean-brewer',
  'other',
]
