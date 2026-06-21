import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, X } from 'lucide-react'
import { db } from '@/db/dexie'
import { getProfile, saveProfile } from '@/db/repo'
import type { BrewMethod } from '@/db/types'
import { PageHeader, Field } from '@/components/ui'
import { downscale } from '@/components/PhotoInput'
import { AVATAR_ICONS, type AvatarIconId, ProfileAvatar } from './ProfileAvatar'
import { useSettings } from '@/store/settings'
import { cToF, fToC } from '@/lib/units'

const num = (v: string) => (v === '' ? undefined : Number(v))

interface Form {
  displayName?: string
  avatarIcon?: string
  photo?: Blob
  cafe?: string
  bio?: string
  defaultMethod?: BrewMethod
  defaultBeanId?: string
  defaultGrinderId?: string
  defaultGearId?: string
  defaultRatio?: number
  defaultDoseIn?: number
  defaultWaterTemp?: number
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const tempUnit = useSettings((s) => s.tempUnit)

  const beans = useLiveQuery(() => db.beans.orderBy('name').toArray(), [])
  const grinders = useLiveQuery(() => db.grinders.orderBy('name').toArray(), [])
  const gear = useLiveQuery(() => db.gear.orderBy('name').toArray(), [])
  const profile = useLiveQuery(getProfile, [])

  const [form, setForm] = useState<Form>({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Hydrate once the stored profile loads.
  useEffect(() => {
    if (profile) {
      const { dirty: _d, syncedAt: _s, createdAt: _c, updatedAt: _u, id: _i, ...rest } = profile
      setForm(rest)
    }
  }, [profile])

  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setSaved(false)
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setBusy(true)
    try {
      set({ photo: await downscale(file, 256) })
    } finally {
      setBusy(false)
    }
  }

  const tempDisplay =
    form.defaultWaterTemp == null
      ? ''
      : tempUnit === 'C'
        ? form.defaultWaterTemp
        : cToF(form.defaultWaterTemp)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await saveProfile({
      displayName: form.displayName?.trim() || undefined,
      avatarIcon: form.avatarIcon,
      photo: form.photo,
      cafe: form.cafe?.trim() || undefined,
      bio: form.bio?.trim() || undefined,
      defaultMethod: form.defaultMethod,
      defaultBeanId: form.defaultBeanId,
      defaultGrinderId: form.defaultGrinderId,
      defaultGearId: form.defaultGearId,
      defaultRatio: form.defaultRatio,
      defaultDoseIn: form.defaultDoseIn,
      defaultWaterTemp: form.defaultWaterTemp,
    })
    setSaved(true)
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader title={t('profile.title')} back />

      {/* Identity */}
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">{t('profile.identity')}</h2>

        {/* avatar: live preview + photo/camera control */}
        <div className="flex items-center gap-4">
          <ProfileAvatar icon={form.avatarIcon} photo={form.photo} size={64} />
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={pickPhoto}
            />
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={18} /> {busy ? t('session.photoBusy') : t('profile.choosePhoto')}
            </button>
            {form.photo && (
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => set({ photo: undefined })}
              >
                <X size={16} /> {t('profile.removePhoto')}
              </button>
            )}
          </div>
        </div>

        {/* icon picker (used when no photo is set) */}
        <Field label={t('profile.icon')}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AVATAR_ICONS) as AvatarIconId[]).map((key) => {
              const Icon = AVATAR_ICONS[key]
              const active = form.avatarIcon === key && !form.photo
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  onClick={() => set({ avatarIcon: key, photo: undefined })}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                    active ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted'
                  }`}
                >
                  <Icon size={20} />
                </button>
              )
            })}
          </div>
        </Field>

        <Field label={t('profile.displayName')}>
          <input
            className="input"
            value={form.displayName ?? ''}
            onChange={(e) => set({ displayName: e.target.value })}
            placeholder="Jane"
          />
        </Field>
        <Field label={t('profile.cafe')} hint={t('common.optional')}>
          <input
            className="input"
            value={form.cafe ?? ''}
            onChange={(e) => set({ cafe: e.target.value })}
          />
        </Field>
        <Field label={t('profile.bio')} hint={t('common.optional')}>
          <textarea
            className="input min-h-20"
            value={form.bio ?? ''}
            onChange={(e) => set({ bio: e.target.value })}
          />
        </Field>
      </section>

      {/* Brewing defaults */}
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">{t('profile.defaults')}</h2>
        <p className="text-sm text-muted">{t('profile.defaultsIntro')}</p>

        <Field label={t('profile.defaultMethod')}>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => set({ defaultMethod: undefined })}
              className={`btn ${form.defaultMethod == null ? 'bg-brand text-brand-fg' : 'btn-ghost'}`}
            >
              {t('common.none')}
            </button>
            {(['espresso', 'brew'] as BrewMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ defaultMethod: m })}
                className={`btn ${form.defaultMethod === m ? 'bg-brand text-brand-fg' : 'btn-ghost'}`}
              >
                {t(`method.${m}`)}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('recipe.bean')} hint={t('common.optional')}>
            <select
              className="input"
              value={form.defaultBeanId ?? ''}
              onChange={(e) => set({ defaultBeanId: e.target.value || undefined })}
            >
              <option value="">{t('common.none')}</option>
              {beans?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('recipe.grinder')} hint={t('common.optional')}>
            <select
              className="input"
              value={form.defaultGrinderId ?? ''}
              onChange={(e) => set({ defaultGrinderId: e.target.value || undefined })}
            >
              <option value="">{t('common.none')}</option>
              {grinders?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('recipe.brewer')} hint={t('common.optional')}>
            <select
              className="input"
              value={form.defaultGearId ?? ''}
              onChange={(e) => set({ defaultGearId: e.target.value || undefined })}
            >
              <option value="">{t('common.none')}</option>
              {gear?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('profile.defaultRatio')}>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={form.defaultRatio ?? ''}
              onChange={(e) => set({ defaultRatio: num(e.target.value) })}
              placeholder="16"
            />
          </Field>
          <Field label={t('profile.defaultDose')}>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={form.defaultDoseIn ?? ''}
              onChange={(e) => set({ defaultDoseIn: num(e.target.value) })}
            />
          </Field>
          <Field label={`${t('profile.defaultTemp')} (°${tempUnit})`}>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={tempDisplay}
              onChange={(e) => {
                const v = num(e.target.value)
                set({ defaultWaterTemp: v == null ? undefined : tempUnit === 'C' ? v : fToC(v) })
              }}
            />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn bg-brand text-brand-fg">
          {t('common.save')}
        </button>
        {saved && <span className="text-sm text-muted">{t('profile.saved')}</span>}
      </div>
    </form>
  )
}
