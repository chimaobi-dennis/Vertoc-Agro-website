/*
 * End-to-end test of the admin panel API against a running backend.
 *
 * Creates a throwaway admin, signs in exactly as the browser does (anon key),
 * exercises every admin route including the role and lock-out guards, and
 * removes everything it created — even if a step fails.
 *
 *   node server/test-admin.mjs            (backend on :8787, migration 002 applied)
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const API = process.env.API_URL || 'http://localhost:8787'
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
const ANON = process.env.VITE_SUPABASE_ANON_KEY
  || readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim()

const die = m => { console.error('✗ ' + m); process.exit(1) }
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) die('server/.env needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
if (!ANON) die('VITE_SUPABASE_ANON_KEY is empty in ../.env')

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const svc  = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, noSession)
const anon = createClient(SUPABASE_URL, ANON, noSession)

const EMAIL = `e2e-${Date.now()}@vertocagro.invalid`
const PASS  = 'E2e-Test-Passw0rd!'
const results = []
let userId = null, token = '', uploadPath = null

const step = async (name, fn) => {
  try { const v = await fn(); results.push(['✓', name, v ?? '']); return v }
  catch (e) { results.push(['✗', name, e.message]); throw e }
}
const api = async (path, { method = 'GET', body } = {}) => {
  const r = await fetch(`${API}/api/admin${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body && JSON.stringify(body),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${r.status} ${d.error || ''}`.trim())
  return d
}
/** Assert a call is refused with a message matching `re`. */
const refused = async (fn, re, label) => {
  try { await fn() } catch (e) { if (re.test(e.message)) return e.message.slice(0, 3) + ' ✓'; throw e }
  throw new Error(`was allowed (${label})`)
}

try {
  await step('create throwaway admin', async () => {
    const { data, error } = await svc.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true })
    if (error) throw error; userId = data.user.id
    const { error: pe } = await svc.from('profiles')
      .upsert({ id: userId, email: EMAIL, name: 'E2E', role: 'admin', active: true }, { onConflict: 'id' })
    if (pe) throw pe; return userId.slice(0, 8)
  })
  await step('sign in with anon key (as the browser does)', async () => {
    const { data, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASS })
    if (error) throw error; token = data.session.access_token; return 'session ok'
  })
  await step('GET /me', async () => {
    const m = await api('/me'); if (m.role !== 'admin') throw new Error('role=' + m.role)
    return `admin; can: ${Object.keys(m.permissions).filter(k => m.permissions[k]).join(', ')}`
  })
  await step('GET /stats', async () => JSON.stringify(await api('/stats')))

  const slug = `e2e-test-product-${Date.now()}`
  await step('POST /products', async () => (await api('/products', { method: 'POST', body: { name: 'E2E Test Product', slug, applications: ['test'], status: 'draft' } })).slug)
  await step('PATCH /products/:slug', async () => (await api(`/products/${slug}`, { method: 'PATCH', body: { moq: '1 MT', featured: true } })).moq)
  await step('GET /products/:slug', async () => (await api(`/products/${slug}`)).name)
  await step('draft hidden from public API', async () => {
    const r = await fetch(`${API}/api/products/${slug}`); if (r.status !== 404) throw new Error('public returned ' + r.status); return '404 ✓'
  })
  await step('duplicate slug rejected', () => refused(() => api('/products', { method: 'POST', body: { name: 'Dup', slug } }), /already exists/, 'duplicate'))
  await step('DELETE /products/:slug', async () => (await api(`/products/${slug}`, { method: 'DELETE' })).deleted)

  const pslug = `e2e-test-post-${Date.now()}`
  await step('POST /posts', async () => (await api('/posts', { method: 'POST', body: { title: 'E2E Post', slug: pslug, body: 'hello\n\n## heading\n\nworld', status: 'draft' } })).slug)
  await step('DELETE /posts/:slug', async () => (await api(`/posts/${pslug}`, { method: 'DELETE' })).deleted)

  await step('POST /upload (1px png)', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const r = await api('/upload', { method: 'POST', body: { filename: 'e2e.png', contentType: 'image/png', data: png } })
    uploadPath = r.path; return r.url.replace(/^.*\/media\//, 'media/')
  })
  await step('upload rejects non-image', () => refused(() => api('/upload', { method: 'POST', body: { filename: 'x.txt', contentType: 'text/plain', data: 'aGVsbG8=' } }), /Only JPEG/, 'text upload'))

  await step('GET /users', async () => `${(await api('/users')).length} users`)
  await step('self-demotion blocked', () => refused(() => api(`/users/${userId}`, { method: 'PATCH', body: { role: 'editor' } }), /own admin/, 'self-demote'))

  await step('audit log recorded this run', async () => {
    const rows = (await api('/audit?limit=100')).filter(r => r.actor_label === EMAIL)
    if (rows.length < 6) throw new Error(`only ${rows.length} rows`)
    return `${rows.length} rows: ${[...new Set(rows.map(r => r.action))].join(', ')}`
  })

  // Role and active flag are re-read from the profile on EVERY request — the
  // token stays valid, yet access must change immediately.
  await step('role downgrade applies without re-login', async () => {
    await svc.from('profiles').update({ role: 'sales' }).eq('id', userId)
    return refused(() => api('/products'), /^403/, 'sales reading products')
  })
  await step('deactivation applies without re-login', async () => {
    await svc.from('profiles').update({ active: false, role: 'admin' }).eq('id', userId)
    return refused(() => api('/me'), /^403/, 'inactive /me')
  })
} catch { /* recorded; fall through to cleanup */ }
finally {
  if (uploadPath) await svc.storage.from('media').remove([uploadPath]).catch(() => {})
  await svc.from('products').delete().like('slug', 'e2e-test-%')
  await svc.from('posts').delete().like('slug', 'e2e-test-%')
  if (userId) {
    await svc.from('audit_log').delete().eq('actor_label', EMAIL)
    await svc.auth.admin.deleteUser(userId).catch(() => {})
  }
  console.log()
  for (const [s, n, v] of results) console.log(` ${s} ${n.padEnd(44)} ${v}`)
  const failed = results.filter(r => r[0] === '✗').length
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED — throwaway admin and test data removed')
  process.exit(failed ? 1 : 0)
}
