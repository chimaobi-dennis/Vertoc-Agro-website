import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, authConfigured } from '../lib/supabase'
import { adminFetch } from '../lib/adminApi'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)        // profile + permissions from the backend
  const [error, setError] = useState(null)  // why /me was refused (inactive, no profile…)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authConfigured) return
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
