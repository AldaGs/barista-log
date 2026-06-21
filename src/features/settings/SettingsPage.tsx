import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Upload, Cloud, CloudOff } from 'lucide-react'
import { PageHeader, Field } from '@/components/ui'
import { useSettings, type Lang, type ThemeMode } from '@/store/settings'
import type { TempUnit } from '@/lib/units'
import { exportBackup, importBackup } from '@/lib/backup'

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
  const [url, setUrl] = useState(s.supabase?.url ?? '')
  const [key, setKey] = useState(s.supabase?.anonKey ?? '')

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} />

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

      {/* Data */}
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">{t('settings.data')}</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn-ghost flex-1" onClick={exportBackup}>
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

      {/* Cloud */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          {s.supabase ? <Cloud size={18} className="text-accent" /> : <CloudOff size={18} className="text-muted" />}
          <h2 className="font-semibold">{t('settings.cloud')}</h2>
          <span className="ml-auto text-sm text-muted">
            {s.supabase ? t('settings.connected') : t('settings.notConnected')}
          </span>
        </div>
        <p className="text-sm text-muted">{t('settings.cloudIntro')}</p>
        <Field label={t('settings.supabaseUrl')}>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
        </Field>
        <Field label={t('settings.supabaseKey')}>
          <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            disabled={!url || !key}
            onClick={() => s.setSupabase({ url: url.trim(), anonKey: key.trim() })}
          >
            {t('settings.connect')}
          </button>
          {s.supabase && (
            <button
              className="btn-ghost"
              onClick={() => {
                s.setSupabase(null)
                setUrl('')
                setKey('')
              }}
            >
              {t('settings.disconnect')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
