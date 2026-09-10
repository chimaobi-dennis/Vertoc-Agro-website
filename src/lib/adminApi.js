import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_BASE || ''

/** Authenticated call to /api/admin/*. Throws with the server's message on failure. */
export async function adminFetch(path, { method = 'GET', body } = {}) {
  const { data: { session } = {} } = supabase ? await supabase.auth.getSession() : {}
  const res = await fetch(`${BASE}/api/admin${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status })
  return data
}

/** Same, for binary responses (PDF preview). Returns a Blob. */
export async function adminFetchBlob(path) {
  const { data: { session } = {} } = supabase ? await supabase.auth.getSession() : {}
  const res = await fetch(`${BASE}/api/admin${path}`, { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} })
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Request failed (${res.status})`) }
  return res.blob()
}
