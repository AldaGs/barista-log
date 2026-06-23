import { buildBackup, applyBackup, markBackedUp, type Backup } from '@/lib/backup'

/**
 * Optional cloud backup to the user's OWN Google Drive — nothing is stored on a
 * server we control. We request only the `drive.appdata` scope, which grants
 * access to a hidden, per-app folder: we can read/write the single backup file
 * we create there and CANNOT see any of the user's other Drive files.
 *
 * Auth uses Google Identity Services (browser token flow). The access token
 * lives in memory for ~1h and is never persisted; there is no refresh token and
 * no secret, so there is nothing on our side that could leak a user's data.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE_NAME = 'barista-backup.json'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

const CONNECTED_KEY = 'barista-drive-connected'
const LAST_DRIVE_SYNC_KEY = 'barista-drive-synced-at'

export const isDriveConfigured = () => !!CLIENT_ID

/** True once the user has connected Drive at least once on this device. */
export const isDriveConnected = () => localStorage.getItem(CONNECTED_KEY) === '1'

export function lastDriveSyncAt(): number | null {
  const v = Number(localStorage.getItem(LAST_DRIVE_SYNC_KEY))
  return v > 0 ? v : null
}

// --- Minimal typings for the GIS global we load at runtime ------------------
interface TokenResponse {
  access_token?: string
  error?: string
}
interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void
  callback: (resp: TokenResponse) => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (resp: TokenResponse) => void
          }) => TokenClient
        }
      }
    }
  }
}

let gisPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google sign-in'))
    document.head.appendChild(s)
  })
  return gisPromise
}

let accessToken: string | null = null
let tokenClient: TokenClient | null = null

/**
 * Get a usable access token. `interactive` shows Google's account/consent popup
 * (required the first time); otherwise we reuse the in-memory token and only
 * prompt if it's missing.
 */
async function getToken(interactive: boolean): Promise<string> {
  if (accessToken && !interactive) return accessToken
  if (!CLIENT_ID) throw new Error('Google Drive is not configured')
  await loadGis()

  if (!tokenClient) {
    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // replaced per-request below
    })
  }

  return new Promise<string>((resolve, reject) => {
    tokenClient!.callback = (resp) => {
      if (resp.error || !resp.access_token) {
        reject(new Error(resp.error ?? 'Authorization failed'))
        return
      }
      accessToken = resp.access_token
      localStorage.setItem(CONNECTED_KEY, '1')
      resolve(accessToken)
    }
    // '' = silent if already granted; 'consent' forces the picker the first time.
    tokenClient!.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  })
}

async function driveFetch(input: string, init: RequestInit, token: string) {
  const res = await fetch(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    // Token expired — re-auth silently once and retry.
    const fresh = await getToken(true)
    return fetch(input, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${fresh}` },
    })
  }
  return res
}

/** Locate our backup file in the appData folder, if it exists. */
async function findFileId(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name = '${FILE_NAME}'`)
  const url =
    `https://www.googleapis.com/drive/v3/files` +
    `?spaces=appDataFolder&q=${q}&fields=files(id)&pageSize=1`
  const res = await driveFetch(url, { method: 'GET' }, token)
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`)
  const json = (await res.json()) as { files?: { id: string }[] }
  return json.files?.[0]?.id ?? null
}

/** Connect (or re-authorize) Google Drive. Shows the consent popup. */
export async function connectDrive() {
  await getToken(true)
}

/** Forget the Drive connection on this device (does not delete the file). */
export function disconnectDrive() {
  accessToken = null
  localStorage.removeItem(CONNECTED_KEY)
  localStorage.removeItem(LAST_DRIVE_SYNC_KEY)
}

/** Push the current local data up to the user's Drive (create or overwrite). */
export async function backupToDrive() {
  const token = await getToken(isDriveConnected() ? false : true)
  const backup = await buildBackup()
  const body = JSON.stringify(backup)
  const existing = await findFileId(token)

  if (existing) {
    const res = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body },
      token,
    )
    if (!res.ok) throw new Error(`Drive upload failed (${res.status})`)
  } else {
    // Multipart create: metadata part + file content part.
    const boundary = 'baristaBackup' + Date.now()
    const metadata = { name: FILE_NAME, parents: ['appDataFolder'] }
    const multipart =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${body}\r\n` +
      `--${boundary}--`
    const res = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      },
      token,
    )
    if (!res.ok) throw new Error(`Drive create failed (${res.status})`)
  }

  const ts = Date.now()
  localStorage.setItem(LAST_DRIVE_SYNC_KEY, String(ts))
  markBackedUp()
  return ts
}

/**
 * Permanently delete the backup file from the user's Drive.
 * Returns false if there was no backup to remove.
 */
export async function removeDriveBackup(): Promise<boolean> {
  const token = await getToken(isDriveConnected() ? false : true)
  const id = await findFileId(token)
  if (!id) return false
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${id}`,
    { method: 'DELETE' },
    token,
  )
  // 204 = deleted, 404 = already gone (treat as success).
  if (!res.ok && res.status !== 404) throw new Error(`Drive delete failed (${res.status})`)
  localStorage.removeItem(LAST_DRIVE_SYNC_KEY)
  return true
}

/**
 * Pull the backup file from Drive and merge it into the local DB.
 * Returns false if no backup exists in the user's Drive yet.
 */
export async function restoreFromDrive(): Promise<boolean> {
  const token = await getToken(isDriveConnected() ? false : true)
  const id = await findFileId(token)
  if (!id) return false
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    { method: 'GET' },
    token,
  )
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`)
  const parsed = (await res.json()) as Backup
  await applyBackup(parsed)
  localStorage.setItem(LAST_DRIVE_SYNC_KEY, String(Date.now()))
  return true
}
