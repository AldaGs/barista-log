import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { Field } from '@/components/ui'
import { useSettings } from '@/store/settings'
import { useAuth } from '@/sync/useAuth'
import { useSyncStatus, runSync } from '@/sync/syncManager'

export function CloudSync() {
  const { t } = useTranslation()
  const s = useSettings()
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const sync = useSyncStatus()

  const [url, setUrl] = useState(s.supabase?.url ?? '')
  const [key, setKey] = useState(s.supabase?.anonKey ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const connected = !!s.supabase

  async function handle(fn: () => Promise<void>, okMsg?: string) {
    setErr(null)
    setMsg(null)
    try {
      await fn()
      if (okMsg) setMsg(okMsg)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        {connected ? <Cloud size={18} className="text-accent" /> : <CloudOff size={18} className="text-muted" />}
        <h2 className="font-semibold">{t('settings.cloud')}</h2>
        <span className="ml-auto text-sm text-muted">
          {connected ? t('settings.connected') : t('settings.notConnected')}
        </span>
      </div>
      <p className="text-sm text-muted">{t('settings.localFirstNote')}</p>

      {/* Step 1 — connect a project */}
      {!connected ? (
        <>
          <Field label={t('settings.supabaseUrl')}>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
          </Field>
          <Field label={t('settings.supabaseKey')}>
            <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} />
          </Field>
          <button
            className="btn-primary w-full"
            disabled={!url || !key}
            onClick={() => s.setSupabase({ url: url.trim(), anonKey: key.trim() })}
          >
            {t('settings.connect')}
          </button>
        </>
      ) : (
        <>
          {/* Step 2 — auth + sync */}
          {loading ? null : user ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <span>
                  <span className="text-muted">{t('settings.signedInAs')} </span>
                  {user.email}
                </span>
                <button className="text-muted hover:text-text" onClick={() => handle(signOut)}>
                  {t('settings.signOut')}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button className="btn-primary flex-1" disabled={sync.status === 'syncing'} onClick={() => void runSync()}>
                  <RefreshCw size={16} className={sync.status === 'syncing' ? 'animate-spin' : ''} />
                  {sync.status === 'syncing' ? t('settings.syncing') : t('settings.syncNow')}
                </button>
              </div>

              <p className="text-sm text-muted">
                {sync.status === 'error' ? (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertTriangle size={14} /> {t('settings.syncError')}: {sync.error}
                  </span>
                ) : sync.status === 'offline' ? (
                  t('settings.syncOffline')
                ) : sync.lastSyncedAt ? (
                  `${t('settings.lastSynced')}: ${formatDistanceToNow(sync.lastSyncedAt, { addSuffix: true })}`
                ) : null}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label={t('settings.email')}>
                <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label={t('settings.password')}>
                <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={!email || !password} onClick={() => handle(() => signIn(email, password))}>
                  {t('settings.signIn')}
                </button>
                <button
                  className="btn-ghost flex-1"
                  disabled={!email || !password}
                  onClick={() => handle(() => signUp(email, password), t('settings.signUpCheckEmail'))}
                >
                  {t('settings.signUp')}
                </button>
              </div>
            </div>
          )}

          <button
            className="text-sm text-muted hover:text-text"
            onClick={() => {
              s.setSupabase(null)
              setMsg(null)
              setErr(null)
            }}
          >
            {t('settings.disconnect')}
          </button>
        </>
      )}

      {msg && <p className="text-sm text-accent">{msg}</p>}
      {err && <p className="text-sm text-red-500">{err}</p>}
    </section>
  )
}
