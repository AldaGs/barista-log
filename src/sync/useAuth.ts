import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from './supabaseClient'
import { runSync } from './syncManager'
import { useSettings } from '@/store/settings'

interface AuthApi {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): AuthApi {
  const supabaseCfg = useSettings((s) => s.supabase)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setUser(null)
      setLoading(false)
      return
    }
    setLoading(true)
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) void runSync()
    })
    return () => sub.subscription.unsubscribe()
  }, [supabaseCfg])

  async function signIn(email: string, password: string) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Cloud not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Cloud not configured')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await getSupabase()?.auth.signOut()
    setUser(null)
  }

  return { user, loading, signIn, signUp, signOut }
}
