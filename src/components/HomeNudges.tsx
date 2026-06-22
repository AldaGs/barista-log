import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, Share, X } from 'lucide-react'
import { lastBackupAt } from '@/lib/backup'
import { canInstall, isIos, isStandalone, onInstallChange, promptInstall } from '@/lib/pwa'

/** Days without a backup before we surface a reminder on Home. */
const BACKUP_STALE_DAYS = 30
const INSTALL_DISMISS_KEY = 'barista-install-dismissed'
const BACKUP_DISMISS_KEY = 'barista-backup-nudge-dismissed'

/** Don't re-nag about a dismissed nudge for this long. */
const DISMISS_COOLDOWN = 14 * 86_400_000

function dismissed(key: string): boolean {
  const v = Number(localStorage.getItem(key))
  return v > 0 && Date.now() - v < DISMISS_COOLDOWN
}

function NudgeCard({
  children,
  onDismiss,
}: {
  children: React.ReactNode
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="card flex items-start gap-3 border-brand/40 bg-brand/5 p-4">
      <div className="flex-1">{children}</div>
      <button
        onClick={onDismiss}
        className="-m-1 p-1 text-muted hover:text-text"
        aria-label={t('common.dismiss')}
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function HomeNudges({ hasData }: { hasData: boolean }) {
  const { t } = useTranslation()
  const [, bump] = useState(0)
  const [installHidden, setInstallHidden] = useState(() => dismissed(INSTALL_DISMISS_KEY))
  const [backupHidden, setBackupHidden] = useState(() => dismissed(BACKUP_DISMISS_KEY))

  useEffect(() => onInstallChange(() => bump((n) => n + 1)), [])

  // --- Install nudge: Chromium prompt, or iOS manual instructions -----------
  const showInstall =
    !installHidden && !isStandalone() && hasData && (canInstall() || isIos())

  // --- Backup nudge: have data, but no recent export ------------------------
  const last = lastBackupAt()
  const backupStale = last == null || Date.now() - last > BACKUP_STALE_DAYS * 86_400_000
  const showBackup = !backupHidden && hasData && backupStale

  if (!showInstall && !showBackup) return null

  const dismiss = (key: string, set: (v: boolean) => void) => {
    localStorage.setItem(key, String(Date.now()))
    set(true)
  }

  return (
    <div className="space-y-3">
      {showInstall && (
        <NudgeCard onDismiss={() => dismiss(INSTALL_DISMISS_KEY, setInstallHidden)}>
          <p className="font-medium">{t('install.title')}</p>
          <p className="mt-0.5 text-sm text-muted">{t('install.body')}</p>
          {canInstall() ? (
            <button
              className="btn-primary mt-2"
              onClick={async () => {
                await promptInstall()
              }}
            >
              <Download size={16} /> {t('install.action')}
            </button>
          ) : (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand">
              <Share size={16} /> {t('install.iosHint')}
            </p>
          )}
        </NudgeCard>
      )}

      {showBackup && (
        <NudgeCard onDismiss={() => dismiss(BACKUP_DISMISS_KEY, setBackupHidden)}>
          <p className="font-medium">{t('backup.nudgeTitle')}</p>
          <p className="mt-0.5 text-sm text-muted">
            {last == null
              ? t('backup.nudgeNever')
              : t('backup.nudgeStale', { date: new Date(last).toLocaleDateString() })}
          </p>
          <Link to="/settings" className="btn-ghost mt-2">
            <Download size={16} /> {t('backup.nudgeAction')}
          </Link>
        </NudgeCard>
      )}
    </div>
  )
}
