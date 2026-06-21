import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { ACCENTS, useSettings, type AccentId, type Lang, type ThemeMode } from '@/store/settings'
import type { TempUnit } from '@/lib/units'
import { exportBackup, importBackup } from '@/lib/backup'
import { CloudSync } from './CloudSync'

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
      <CloudSync />
    </div>
  )
}
