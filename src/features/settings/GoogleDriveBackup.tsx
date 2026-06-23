import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HardDriveDownload, HardDriveUpload, Trash2, Cloud } from 'lucide-react'
import {
  isDriveConfigured,
  isDriveConnected,
  lastDriveSyncAt,
  connectDrive,
  disconnectDrive,
  backupToDrive,
  restoreFromDrive,
  removeDriveBackup,
} from '@/sync/googleDrive'

/**
 * Optional one-tap backup to the user's own Google Drive (appData folder only —
 * we never see their other files, and nothing is stored on our servers).
 * Hidden entirely unless a Google client id is configured at build time.
 */
export function GoogleDriveBackup() {
  const { t } = useTranslation()
  const [connected, setConnected] = useState(isDriveConnected())
  const [busy, setBusy] = useState<null | 'connect' | 'backup' | 'restore' | 'remove'>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [last, setLast] = useState<number | null>(lastDriveSyncAt())

  if (!isDriveConfigured()) return null

  async function run(
    kind: 'connect' | 'backup' | 'restore' | 'remove',
    fn: () => Promise<unknown>,
    ok: string,
  ) {
    setBusy(kind)
    setErr(null)
    setMsg(null)
    try {
      const result = await fn()
      if ((kind === 'restore' || kind === 'remove') && result === false) {
        setMsg(t('settings.driveNoBackup'))
      } else {
        setMsg(ok)
      }
      setConnected(isDriveConnected())
      setLast(lastDriveSyncAt())
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Cloud size={18} className={connected ? 'text-accent' : 'text-muted'} />
        <h2 className="font-semibold">{t('settings.driveTitle')}</h2>
        <span className="ml-auto text-sm text-muted">
          {connected ? t('settings.connected') : t('settings.notConnected')}
        </span>
      </div>
      <p className="text-sm text-muted">{t('settings.driveNote')}</p>
      <p className="text-xs text-muted">
        <a className="underline hover:text-text" href="/privacy.html" target="_blank" rel="noopener">
          {t('settings.privacyPolicy')}
        </a>
        {' · '}
        <a className="underline hover:text-text" href="/terms.html" target="_blank" rel="noopener">
          {t('settings.termsOfService')}
        </a>
      </p>

      {!connected ? (
        <button
          className="btn-primary w-full"
          disabled={busy !== null}
          onClick={() => run('connect', connectDrive, t('settings.driveConnected'))}
        >
          {busy === 'connect' ? t('settings.driveConnecting') : t('settings.driveConnect')}
        </button>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="btn-primary flex-1"
              disabled={busy !== null}
              onClick={() => run('backup', backupToDrive, t('settings.driveBackedUp'))}
            >
              <HardDriveUpload size={18} />
              {busy === 'backup' ? t('settings.driveBackingUp') : t('settings.driveBackup')}
            </button>
            <button
              className="btn-ghost flex-1"
              disabled={busy !== null}
              onClick={() => run('restore', restoreFromDrive, t('settings.driveRestored'))}
            >
              <HardDriveDownload size={18} />
              {busy === 'restore' ? t('settings.driveRestoring') : t('settings.driveRestore')}
            </button>
          </div>
          <button
            className="flex w-full items-center justify-center gap-2 text-sm text-red-500 hover:text-red-600"
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm(t('settings.driveRemoveConfirm'))) {
                void run('remove', removeDriveBackup, t('settings.driveRemoved'))
              }
            }}
          >
            <Trash2 size={16} />
            {busy === 'remove' ? t('settings.driveRemoving') : t('settings.driveRemove')}
          </button>
          <button
            className="text-sm text-muted hover:text-text"
            onClick={() => {
              disconnectDrive()
              setConnected(false)
              setLast(null)
              setMsg(null)
              setErr(null)
            }}
          >
            {t('settings.driveDisconnect')}
          </button>
        </>
      )}

      {last && <p className="text-sm text-muted">{t('settings.driveLast', { date: new Date(last).toLocaleString() })}</p>}
      {msg && <p className="text-sm text-accent">{msg}</p>}
      {err && <p className="text-sm text-red-500">{err}</p>}
    </section>
  )
}
