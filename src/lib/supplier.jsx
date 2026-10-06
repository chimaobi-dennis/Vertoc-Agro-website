/*
 * Supplier accounts on the public site.
 *
 * Suppliers sign in with Supabase Auth like staff do, but through their own
 * client with its own storage key: a supplier session and a staff session
 * can live in the same browser without replacing each other, and neither
 * can be used for the other side (the backend checks suppliers against the
 * `suppliers` table and staff against `profiles`).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { fileType, FILE_MAX_BYTES } from './procurement'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const BASE = import.meta.env.VITE_API_BASE || ''

export const supplierAuth = url && key
  ? createClient(url, key, { auth: { storageKey: 'vertoc-supplier-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null

/** Call /api/*. With `auth` (the default) the supplier's token is sent when there is a session. */
export async function supplierFetch(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const { data: { session } = {} } = auth && supplierAuth ? await supplierAuth.auth.getSession() : {}
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Something went wrong (${res.status}). Please try again.`), { status: res.status, code: data.code })
  return data
}

/**
 * Attach one file to a bid: metadata through our API, the bytes straight to
 * storage on a signed upload URL, then a confirm call. `uploadToken` is the
 * short-lived token a bidder without an account gets with their bid;
 * without it the signed-in supplier's session is used.
 */
export async function uploadBidFile(file, { bidId, label = '', uploadToken = null }) {
  if (file.size > FILE_MAX_BYTES) throw new Error(`${file.name} is over 20 MB.`)
  if (!supplierAuth) throw new Error('Uploads are not available right now.')
  const content_type = fileType(file)
  const base = uploadToken ? `/bids/${bidId}/files` : `/supplier/bids/${bidId}/files`
  const opts = uploadToken ? { auth: false, headers: { 'X-Upload-Token': uploadToken } } : {}
  const { document, upload } = await supplierFetch(base, { ...opts, method: 'POST', body: { name: file.name, content_type, bytes: file.size, label } })
  const { error } = await supplierAuth.storage.from('documents').uploadToSignedUrl(upload.path, upload.token, file, { contentType: content_type, upsert: false })
  if (error) throw new Error(error.message || 'The upload failed. Please try again.')
  return supplierFetch(`${base}/${document.id}/complete`, { ...opts, method: 'POST' })
}

const Ctx = createContext({ session: null, me: null, loading: false, ready: true, error: null, signIn: async () => {}, signOut: async () => {}, refresh: async () => {} })

export function SupplierProvider({ children }) {
  const [session, setSession] = useState(undefined)   // undefined = not read yet
  const [me, setMe] = useState(null)
  const [error, setError] = useState(null)             // why the account cannot be used (unconfirmed, suspended…)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supplierAuth) { setSession(null); setLoading(false); return }
    supplierAuth.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supplierAuth.auth.onAuthStateChange((event, s) => setSession(prev => {
      if (event === 'SIGNED_OUT' || !s) return null
      return prev && prev.user?.id === s.user?.id ? prev : s   // same user: keep the object, pages must not remount on a token refresh
    }))
    return () => sub.subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    try { const m = await supplierFetch('/supplier/me'); setMe(m); setError(null); return m }
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
    if (!supplierAuth) throw new Error('Sign-in is not available right now.')
    const { data, error: e } = await supplierAuth.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password })
    if (e) throw Object.assign(new Error(/not confirmed/i.test(e.message) ? 'Please confirm your email address first: use the link we emailed you.' : /invalid/i.test(e.message) ? 'The email address or password is not right.' : e.message), { code: /not confirmed/i.test(e.message) ? 'unverified' : undefined })
    // The account must be a supplier's: check before the pages see the session.
    try { await fetchMe(data.session.access_token) }
    catch (x) { await supplierAuth.auth.signOut(); throw x }
    return data.session
  }, [])
  const signOut = useCallback(async () => { await supplierAuth?.auth.signOut(); setMe(null); setError(null) }, [])

  const value = useMemo(() => ({ session, me, error, loading, ready: session !== undefined && !loading, signIn, signOut, refresh: load }), [session, me, error, loading, signIn, signOut, load])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
async function fetchMe(token) {
  const res = await fetch(`${BASE}/api/supplier/me`, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'This account cannot be used here.'), { status: res.status, code: data.code })
  return data
}

export const useSupplier = () => useContext(Ctx)

/** One file to any supplier upload route: details through our API, bytes to storage, then a confirm call. */
export async function uploadSupplierFile(file, startPath, extra = {}) {
  if (file.size > FILE_MAX_BYTES) throw new Error(`${file.name} is over 20 MB.`)
  if (!supplierAuth) throw new Error('Uploads are not available right now.')
  const content_type = fileType(file)
  const { document, upload } = await supplierFetch(startPath, { method: 'POST', body: { name: file.name, content_type, bytes: file.size, ...extra } })
  const { error } = await supplierAuth.storage.from('documents').uploadToSignedUrl(upload.path, upload.token, file, { contentType: content_type, upsert: false })
  if (error) throw new Error(error.message || 'The upload failed. Please try again.')
  return supplierFetch(`${startPath}/${document.id}/complete`, { method: 'POST' })
}

/** Check the current password, then set a new one. */
export async function changeSupplierPassword(email, current, next) {
  if (!supplierAuth) throw new Error('This is not available right now.')
  const { error: wrong } = await supplierAuth.auth.signInWithPassword({ email, password: current })
  if (wrong) throw new Error('Your current password is not right.')
  const { error } = await supplierAuth.auth.updateUser({ password: next })
  if (error) throw new Error(error.message)
}
