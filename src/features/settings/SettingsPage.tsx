import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Upload, HelpCircle, ChevronRight, ShieldCheck, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { getProfile } from '@/db/repo'
import { ProfileAvatar } from '@/features/profile/ProfileAvatar'
import { ACCENTS, useSettings, type AccentId, type Lang, type ThemeMode } from '@/store/settings'
import type { TempUnit } from '@/lib/units'
import { exportBackup, importBackup, lastBackupAt } from '@/lib/backup'
import { ensurePersistence, formatBytes, getStorageStatus, type StorageStatus } from '@/lib/storage'
// Supabase cloud sync disabled 2026-06-23 — see note by its render below.
// import { CloudSync } from './CloudSync'
import { GoogleDriveBackup } from './GoogleDriveBackup'

/** Days after which we nudge the user to make a fresh backup. */
const BACKUP_STALE_DAYS = 30

function StorageSection({ onBackup }: { onBackup: number }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [requesting, setRequesting] = useState(false)

  const refresh = () => getStorageStatus().then(setStatus)
  useEffect(() => {
    refresh()
  }, [onBackup])

  if (!status?.supported) return null

  const last = lastBackupAt()
  const staleMs = BACKUP_STALE_DAYS * 86_400_000
  const backupStale = last == null || Date.now() - last > staleMs

  const request = async () => {
    setRequesting(true)
    await ensurePersistence()
    await refresh()
    setRequesting(false)
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">{t('settings.storage')}</h2>

      <div className="flex items-start gap-3">
        {status.persisted ? (
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-500" />
        ) : (
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-amber-500" />
        )}
        <div className="flex-1 text-sm">
          <p className="font-medium">
            {status.persisted ? t('settings.storagePersisted') : t('settings.storageBestEffort')}
          </p>
          <p className="text-muted">
            {status.persisted ? t('settings.storagePersistedHint') : t('settings.storageBestEffortHint')}
          </p>
          {status.usage != null && (
            <p className="mt-1 text-xs text-muted">
              {t('settings.storageUsage', { used: formatBytes(status.usage) })}
            </p>
          )}
        </div>
      </div>

      {!status.persisted && (
        <button className="btn-ghost w-full" onClick={request} disabled={requesting}>
          {t('settings.storageRequest')}
        </button>
      )}

      <div className={`rounded-lg p-2 text-xs ${backupStale ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'text-muted'}`}>
        {last == null
          ? t('settings.backupNever')
          : t('settings.backupLast', { date: new Date(last).toLocaleDateString() })}
      </div>
    </section>
  )
}

function SegGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`btn ${value === o.value ? 'bg-brand text-brand-fg' : 'btn-ghost'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const profile = useLiveQuery(getProfile, [])
  const [backupTick, setBackupTick] = useState(0)

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} />

      {/* Profile */}
      <Link to="/profile" className="card flex items-center gap-3 p-4 hover:border-brand">
        <ProfileAvatar icon={profile?.avatarIcon} photo={profile?.photo} size={44} />
        <span className="flex-1">
          <span className="block font-medium">
            {profile?.displayName?.trim() || t('profile.open')}
          </span>
          <span className="block text-sm text-muted">{t('profile.subtitle')}</span>
        </span>
        <ChevronRight size={18} className="text-muted" />
      </Link>

      {/* Help */}
      <Link to="/help" className="card flex items-center gap-3 p-4 hover:border-brand">
        <HelpCircle size={20} className="text-brand" />
        <span className="flex-1 font-medium">{t('help.open')}</span>
        <ChevronRight size={18} className="text-muted" />
      </Link>

      {/* Appearance */}
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">{t('settings.appearance')}</h2>
        <div>
          <span className="label">{t('settings.theme')}</span>
          <SegGroup<ThemeMode>
            value={s.theme}
            onChange={s.setTheme}
            options={[
              { value: 'light', label: t('settings.light') },
              { value: 'dark', label: t('settings.dark') },
              { value: 'system', label: t('settings.system') },
            ]}
          />
        </div>
        <div>
          <span className="label">{t('settings.language')}</span>
          <SegGroup<Lang>
            value={s.lang}
            onChange={s.setLang}
            options={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Español' },
            ]}
          />
        </div>
        <div>
          <span className="label">{t('settings.accent')}</span>
          <div className="flex gap-3">
            {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
              const active = s.accent === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => s.setAccent(id)}
                  className="flex flex-col items-center gap-1"
                  aria-label={t(`settings.accent${id[0].toUpperCase()}${id.slice(1)}`)}
                >
                  <span
                    className={`h-9 w-9 rounded-full border-2 transition ${active ? 'border-text scale-110' : 'border-transparent'}`}
                    style={{ background: `rgb(${ACCENTS[id].brandDark})` }}
                  />
                  <span className={`text-xs ${active ? 'text-text' : 'text-muted'}`}>
                    {t(`settings.accent${id[0].toUpperCase()}${id.slice(1)}`)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <span className="label">{t('settings.tempUnit')}</span>
          <SegGroup<TempUnit>
            value={s.tempUnit}
            onChange={s.setTempUnit}
            options={[
              { value: 'C', label: '°C' },
              { value: 'F', label: '°F' },
            ]}
          />
        </div>
      </section>

      {/* Brewing */}
      <section className="card space-y-4 p-4">
        <div>
          <h2 className="font-semibold">{t('settings.brewing')}</h2>
          <p className="text-xs text-muted">{t('settings.pourRatesHint')}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(['slow', 'medium', 'fast'] as const).map((rate) => (
            <label key={rate} className="flex flex-col gap-1">
              <span className="label !mb-0">{t('step.flow_' + rate)}</span>
              <div className="flex items-center gap-1">
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  step={0.5}
                  value={s.pourRates[rate]}
                  onChange={(e) => s.setPourRate(rate, Math.max(0, Number(e.target.value)))}
                />
                <span className="text-xs text-muted">{t('settings.gramsPerSec')}</span>
              </div>
            </label>
          ))}
        </div>
        <button className="btn-ghost w-full" onClick={s.resetPourRates}>
          {t('settings.resetDefaults')}
        </button>

        <div className="border-t border-border/60 pt-4">
          <span className="label">{t('settings.cues')}</span>
          <p className="mb-2 text-xs text-muted">{t('settings.cuesHint')}</p>
          <SegGroup<string>
            value={s.cuesEnabled ? 'on' : 'off'}
            onChange={(v) => s.setCuesEnabled(v === 'on')}
            options={[
              { value: 'on', label: t('settings.on') },
              { value: 'off', label: t('settings.off') },
            ]}
          />
        </div>

        <div className={s.cuesEnabled ? '' : 'pointer-events-none opacity-50'}>
          <div className="flex items-center justify-between">
            <span className="label">{t('settings.cueVolume')}</span>
            <span className="text-xs text-muted">{Math.round(s.cueVolume * 100)}%</span>
          </div>
          <p className="mb-2 text-xs text-muted">{t('settings.cueVolumeHint')}</p>
          <input
            type="range"
            className="w-full accent-brand"
            min={0}
            max={100}
            step={5}
            value={Math.round(s.cueVolume * 100)}
            disabled={!s.cuesEnabled}
            aria-label={t('settings.cueVolume')}
            onChange={(e) => s.setCueVolume(Number(e.target.value) / 100)}
          />
        </div>

        <div className="border-t border-border/60 pt-4">
          <span className="label">{t('settings.stepEndCue')}</span>
          <p className="mb-2 text-xs text-muted">{t('settings.stepEndCueHint')}</p>
          <SegGroup<string>
            value={String(s.stepEndCountdown)}
            onChange={(v) => s.setStepEndCountdown(Number(v))}
            options={[
              { value: '0', label: t('settings.off') },
              { value: '3', label: '3s' },
              { value: '5', label: '5s' },
            ]}
          />
        </div>

        <div>
          <span className="label">{t('settings.pourMarkCue')}</span>
          <p className="mb-2 text-xs text-muted">{t('settings.pourMarkCueHint')}</p>
          <SegGroup<string>
            value={s.pourMarkCue ? 'on' : 'off'}
            onChange={(v) => s.setPourMarkCue(v === 'on')}
            options={[
              { value: 'on', label: t('settings.on') },
              { value: 'off', label: t('settings.off') },
            ]}
          />
        </div>
      </section>

      {/* Data */}
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">{t('settings.data')}</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="btn-ghost flex-1"
            onClick={async () => {
              await exportBackup()
              setBackupTick((n) => n + 1)
            }}
          >
            <Download size={18} /> {t('settings.exportJson')}
          </button>
          <button className="btn-ghost flex-1" onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> {t('settings.importJson')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) {
                await importBackup(f)
                e.target.value = ''
              }
            }}
          />
        </div>
      </section>

      {/* Google Drive backup (only renders if configured) */}
      <GoogleDriveBackup />

      {/* Storage durability */}
      <StorageSection onBackup={backupTick} />

      {/* Supabase cloud sync — DISABLED 2026-06-23 (replaced by Google Drive
          backup above; we no longer store user data on our own servers). The
          component still exists; re-enable here and flip SUPABASE_ENABLED in
          supabaseClient.ts to bring it back. */}
      {/* <CloudSync /> */}
    </div>
  )
}
