import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, authConfigured } from '../lib/supabase'
import { adminFetch } from '../lib/adminApi'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  // undefined = not yet known. Until the stored session has been read, the
  // guards must keep showing the splash: treating "unknown" as "signed out"
  // bounced every hard reload through /admin/login and dropped the query
  // string (so ?tab= deep links and emailed links landed on the wrong tab).
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)        // profile + permissions from the backend
  const [error, setError] = useState(null)  // why /me was refused (inactive, no profile…)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authConfigured) { setSession(null); setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authConfigured || session === undefined) return
    if (!session) { setMe(null); setLoading(false); return }
    let alive = true
    setLoading(true)
    adminFetch('/me')
      .then(m => { if (alive) { setMe(m); setError(null) } })
      .catch(e => { if (alive) { setMe(null); setError(e.message) } })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [session])

  const signOut = useCallback(async () => { await supabase?.auth.signOut(); setMe(null) }, [])

  return <Ctx.Provider value={{ session, me, error, loading, signOut }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
