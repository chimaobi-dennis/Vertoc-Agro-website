/*
 * Accounts for the client portal and the investment portal.
 *
 * Like suppliers, clients and investors sign in with Supabase Auth through
 * a browser client of their own (own storage key), so a client session, an
 * investor session, a supplier session and a staff session can sit in the
 * same browser without replacing one another. The backend checks each
 * against its own table; none can be used on another side.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { fileType, FILE_MAX_BYTES } from './procurement'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const BASE = import.meta.env.VITE_API_BASE || ''

function createPortal(kind) {
  let client
  // Made on first use: visitors who never open a portal never create its client.
  const auth = () => (client !== undefined ? client : (client = url && key ? createClient(url, key, { auth: { storageKey: `vertoc-${kind}-auth`, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null))

  /** Call /api/*. With `auth` (the default) the account's token is sent when there is a session. */
  async function api(path, { method = 'GET', body, auth: withAuth = true } = {}) {
    const { data: { session } = {} } = withAuth && auth() ? await auth().auth.getSession() : {}
    const res = await fetch(`${BASE}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.error || `Something went wrong (${res.status}). Please try again.`), { status: res.status, code: data.code })
    return data
  }

  /** One file: its details through our API, the bytes straight to storage, then a confirm call. */
  async function upload(file, startPath, extra = {}) {
    if (file.size > FILE_MAX_BYTES) throw new Error(`${file.name} is over 20 MB.`)
    if (!auth()) throw new Error('Uploads are not available right now.')
    const content_type = fileType(file)
    const { document, upload: target } = await api(startPath, { method: 'POST', body: { name: file.name, content_type, bytes: file.size, ...extra } })
    const { error } = await auth().storage.from('documents').uploadToSignedUrl(target.path, target.token, file, { contentType: content_type, upsert: false })
    if (error) throw new Error(error.message || 'The upload failed. Please try again.')
    return api(`${startPath}/${document.id}/complete`, { method: 'POST' })
  }

  const Ctx = createContext({ session: null, me: null, loading: false, ready: true, error: null, signIn: async () => {}, signOut: async () => {}, refresh: async () => {} })

  function Provider({ children }) {
    const [session, setSession] = useState(undefined)   // undefined = not read yet
    const [me, setMe] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      const a = auth()
      if (!a) { setSession(null); setLoading(false); return }
      a.auth.getSession().then(({ data }) => setSession(data.session))
      const { data: sub } = a.auth.onAuthStateChange((event, s) => setSession(prev => {
        if (event === 'SIGNED_OUT' || !s) return null
        return prev && prev.user?.id === s.user?.id ? prev : s   // same user: keep the object, pages must not remount on a token refresh
      }))
      return () => sub.subscription.unsubscribe()
    }, [])

    const load = useCallback(async () => {
      try { const m = await api(`/${kind}/me`); setMe(m); setError(null); return m }
      catch (e) { setMe(null); setError({ message: e.message, code: e.code, status: e.status }); return null }
    }, [])
    useEffect(() => {
      if (session === undefined) return
      if (!session) { setMe(null); setError(null); setLoading(false); return }
      let alive = true
      setLoading(true)
      load().finally(() => alive && setLoading(false))
      return () => { alive = false }
    }, [session, load])

    const signIn = useCallback(async (email, password) => {
      const a = auth()
      if (!a) throw new Error('Sign-in is not available right now.')
      const { data, error: e } = await a.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password })
      if (e) throw Object.assign(new Error(/not confirmed/i.test(e.message) ? 'Please confirm your email address first: use the link we emailed you.' : /invalid/i.test(e.message) ? 'The email address or password is not right.' : e.message), { code: /not confirmed/i.test(e.message) ? 'unverified' : undefined })
      // The account must belong to this portal: check before the pages see the session.
      const res = await fetch(`${BASE}/api/${kind}/me`, { headers: { Authorization: `Bearer ${data.session.access_token}` } })
      if (!res.ok) { const d = await res.json().catch(() => ({})); await a.auth.signOut(); throw Object.assign(new Error(d.error || 'This account cannot be used here.'), { status: res.status, code: d.code }) }
      return data.session
    }, [])
    const signOut = useCallback(async () => { await auth()?.auth.signOut(); setMe(null); setError(null) }, [])

    const value = useMemo(() => ({ session, me, error, loading, ready: session !== undefined && !loading, signIn, signOut, refresh: load }), [session, me, error, loading, signIn, signOut, load])
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
  }

  /** Check the current password, then set a new one. */
  async function changePassword(email, current, next) {
    const a = auth(); if (!a) throw new Error('This is not available right now.')
    const { error: wrong } = await a.auth.signInWithPassword({ email, password: current })
    if (wrong) throw new Error('Your current password is not right.')
    const { error } = await a.auth.updateUser({ password: next })
    if (error) throw new Error(error.message)
  }

  return { kind, api, upload, Provider, use: () => useContext(Ctx), changePassword }
}

export const clientPortal = createPortal('client')
export const investorPortal = createPortal('investor')
