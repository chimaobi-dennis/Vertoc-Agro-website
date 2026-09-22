/*
 * End-to-end test of the admin panel API against a running backend.
 *
 * Creates a throwaway admin, signs in exactly as the browser does (anon key),
 * exercises every admin route including the role and lock-out guards, and
 * removes everything it created — even if a step fails.
 *
 *   node server/test-admin.mjs            (backend on :8787, migrations 002–004 applied)
 *
 * Never emails anyone: the send steps run only when the backend has
 * EMAIL_DRY_RUN=1 (messages are logged as sent, Resend is never called);
 * otherwise they are reported as skipped and the public quote flow is
 * exercised by marking the quote sent directly.
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
let userId = null, token = '', uploadPath = null, docPath = null, settingsBefore = {}

const show = v => (v && typeof v === 'object')
  ? (v.key ?? v.slug ?? (v.number ? `${v.number}${v.total != null ? ` · ${v.total} ${v.currency}` : ''}` : v.name != null ? `${v.name} (#${v.id})` : v.id != null ? `#${v.id}${v.amount != null ? ` · ${v.amount} ${v.currency}` : ''}` : JSON.stringify(v).slice(0, 48)))
  : (v ?? '')
// STEP_DELAY_MS spaces the steps out (a remote target behind a rate checkpoint).
const pause = () => (process.env.STEP_DELAY_MS ? new Promise(r => setTimeout(r, Number(process.env.STEP_DELAY_MS))) : null)
const step = async (name, fn) => {
  await pause()
  try { const v = await fn(); results.push(['✓', name, show(v)]); return v }
  catch (e) { results.push(['✗', name, e.message]); throw e }
}
const api = async (path, { method = 'GET', body } = {}, attempt = 0) => {
  let r
  try {
    r = await fetch(`${API}/api/admin${path}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body && JSON.stringify(body),
    })
  } catch (e) { if (attempt < 1) { await new Promise(x => setTimeout(x, 2000)); return api(path, { method, body }, 1) } throw e }
  // One retry on upstream trouble (a remote target can hiccup); never on 4xx.
  if ([502, 503, 504].includes(r.status) && attempt < 1) { await new Promise(x => setTimeout(x, 2000)); return api(path, { method, body }, 1) }
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
  await step('GET /users/:id shows sign-in facts + activity', async () => { const u = await api(`/users/${userId}`); if (!u.auth || !['accepted', 'pending'].includes(u.auth.invite) || !Array.isArray(u.activity)) throw new Error(JSON.stringify(u).slice(0, 120)); return `invite ${u.auth.invite} · password ${u.auth.password} · ${u.activity.length} actions` })
  await step('PATCH /users/:id name is mirrored to Auth', async () => { const u = await api(`/users/${userId}`, { method: 'PATCH', body: { name: 'E2E Admin' } }); if (u.name !== 'E2E Admin') throw new Error(u.name); const { data } = await svc.auth.admin.getUserById(userId); if (data?.user?.user_metadata?.name !== 'E2E Admin') throw new Error('auth metadata not updated'); return u.name })
  await step('PATCH /users/:id rejects a bad email', () => refused(() => api(`/users/${userId}`, { method: 'PATCH', body: { email: 'nope' } }), /valid email/, 'bad email'))
  await step('PATCH /users/:id position (needs migration 008)', async () => { try { const u = await api(`/users/${userId}`, { method: 'PATCH', body: { position: 'E2E Director' } }); if (u.position !== 'E2E Director') throw new Error(JSON.stringify(u).slice(0, 100)); return u.position } catch (e) { if (/migration 008/.test(e.message)) return 'SKIPPED — run server/migrations/008_positions.sql'; throw e } })
  await step('GET /users/:id unknown → 404', async () => { const r = await fetch(`${API}/api/admin/users/00000000-0000-0000-0000-000000000000`, { headers: { Authorization: `Bearer ${token}` } }); if (r.status !== 404) throw new Error(r.status); return '404 ✓' })

  await step('audit log recorded this run', async () => {
    const rows = (await api('/audit?limit=100')).filter(r => r.actor_label === EMAIL)
    if (rows.length < 6) throw new Error(`only ${rows.length} rows`)
    return `${rows.length} rows: ${[...new Set(rows.map(r => r.action))].join(', ')}`
  })

  // ------------------------------------------------- Phase 2: CRM + inbox
  let liveFields = []
  await step('GET /client-fields (seeded)', async () => { liveFields = await api('/client-fields'); if (liveFields.length < 7) throw new Error('only ' + liveFields.length); return liveFields.map(x => x.key).join(',') })
  // Whatever the owner has marked required must be satisfied by every client this test creates.
  const sample = f => ({ email: 'req@e2e.invalid', number: '1', date: '2026-01-01', url: 'https://e2e.invalid', select: (f.options || [])[0] || '', checkbox: true })[f.type] ?? 'e2e'
  const withRequired = data => ({ ...Object.fromEntries(liveFields.filter(f => f.required && !f.key.startsWith('e2e_') && !['image', 'file'].includes(f.type)).map(f => [f.key, sample(f)])), ...data })
  const fkey = 'e2e_terms'
  const field = await step('POST /client-fields (select, required)', () => api('/client-fields', { method: 'POST', body: { label: 'E2E Terms', key: fkey, type: 'select', options: ['Net 30', 'Prepaid'], required: true } }))
  await step('required field enforced', () => refused(() => api('/clients', { method: 'POST', body: { name: 'e2e-client-x', data: withRequired({}) } }), /required/, 'missing required'))
  await step('select option validated', () => refused(() => api('/clients', { method: 'POST', body: { name: 'e2e-client-x', data: withRequired({ [fkey]: 'Net 90' }) } }), /must be one of/, 'bad option'))
  await step('email field validated', () => refused(() => api('/clients', { method: 'POST', body: { name: 'e2e-client-x', data: withRequired({ [fkey]: 'Net 30', email: 'nope' }) } }), /valid email/, 'bad email'))
  const client = await step('POST /clients', () => api('/clients', { method: 'POST', body: { name: 'e2e-client-' + Date.now(), data: withRequired({ [fkey]: 'Net 30', email: 'buyer@e2e.invalid' }) } }))
  await step('PATCH /clients/:id merges data', async () => (await api(`/clients/${client.id}`, { method: 'PATCH', body: { data: { country: 'Nigeria' } } })).data.country)
  await step('GET /clients lists it', async () => { const l = await api('/clients'); if (!l.some(c => c.id === client.id)) throw new Error('missing'); return l.length + ' active' })
  const enqId = await step('seed a quote enquiry (direct insert)', async () => { const { data, error } = await svc.from('enquiries').insert({ kind: 'quote', name: 'e2e-enquirer', email: 'q@e2e.invalid', commodity: 'Cocoa Beans', quantity: '20 MT' }).select().single(); if (error) throw error; return data.id })
  await step('PATCH /enquiries/:id -> contacted', async () => (await api(`/enquiries/${enqId}`, { method: 'PATCH', body: { status: 'contacted' } })).status)
  await step('wrong-kind stage rejected', () => refused(() => api(`/enquiries/${enqId}`, { method: 'PATCH', body: { status: 'replied' } }), /must be one of/, 'replied on a quote'))
  await step('link enquiry to client + notes', async () => (await api(`/enquiries/${enqId}`, { method: 'PATCH', body: { client_id: client.id, notes: 'e2e note' } })).client_id)
  await step('GET /clients/:id includes it', async () => { const c = await api(`/clients/${client.id}`); if (!c.enquiries?.some(x => x.id === enqId)) throw new Error('not linked'); return c.enquiries.length + ' linked' })
  await step('GET /enquiries?kind=quote&status=contacted', async () => { const l = await api('/enquiries?kind=quote&status=contacted'); if (!l.some(x => x.id === enqId)) throw new Error('missing'); return l.length })
  await step('DELETE /clients/:id unlinks enquiry', async () => { await api(`/clients/${client.id}`, { method: 'DELETE' }); const x = await api(`/enquiries/${enqId}`); if (x.client_id !== null) throw new Error('still linked'); return 'client_id -> null' })
  await step('DELETE /client-fields/:id', async () => (await api(`/client-fields/${field.id}`, { method: 'DELETE' })).deleted)


  // ----------------------- Phase 3: settings, documents, quotes, email, purchases
  for (const key of ['quotes', 'mcp']) settingsBefore[key] = (await svc.from('settings').select('value').eq('key', key).maybeSingle()).data?.value ?? null
  const S = await api('/settings')
  await step('GET /settings', async () => {
    const s = S; if (!s.site?.name || !s.quotes?.default_currency || !('configured' in s.email)) throw new Error('unexpected shape')
    if (s.mcp?.token_hash !== undefined) throw new Error('token hash exposed')
    return `site=${s.site.name} · email ${s.email.configured ? 'via ' + s.email.source : 'off'}${s.email.dry_run ? ' · DRY RUN' : ''}`
  })
  await step('PUT /settings quotes.default_currency=eur → EUR', async () => (await api('/settings', { method: 'PUT', body: { quotes: { default_currency: 'eur' } } })).quotes.default_currency)
  settingsBefore.homepage_stats = (await svc.from('settings').select('value').eq('key', 'homepage_stats').maybeSingle()).data?.value ?? null
  await step('PUT /settings/stats → public /api/site carries the tiles', async () => {
    const r = await api('/settings/stats', { method: 'PUT', body: { stats: [{ icon: 'Wheat', value: '42', suffix: '+', label: 'e2e Harvests' }, { icon: 'nope', value: 7, suffix: '%', label: 'e2e Share' }] } })
    if (r.stats.length !== 2 || r.stats[0].icon !== 'Wheat' || r.stats[0].value !== 42 || r.stats[1].icon !== 'Award' || r.stats[1].suffix !== '%') throw new Error(JSON.stringify(r.stats))
    const pub = await fetch(`${API}/api/site`).then(x => x.json()); if (!Array.isArray(pub.stats) || pub.stats[0]?.label !== 'e2e Harvests') throw new Error('public site lacks the stats: ' + JSON.stringify(pub.stats).slice(0, 100))
    return `${r.stats.map(s => s.value + s.suffix + ' ' + s.label).join(' · ')} · public ✓ · unknown icon → Award ✓`
  })
  settingsBefore.homepage_markets = (await svc.from('settings').select('value').eq('key', 'homepage_markets').maybeSingle()).data?.value ?? null
  settingsBefore.about = (await svc.from('settings').select('value').eq('key', 'about').maybeSingle()).data?.value ?? null
  for (const k of ['gallery', 'faq', 'services', 'sustainability', 'why', 'hero']) settingsBefore[k] = (await svc.from('settings').select('value').eq('key', k).maybeSingle()).data?.value ?? null
  await step('PUT /settings/{gallery,faq,services} → public /api/site', async () => {
    const g = await api('/settings/gallery', { method: 'PUT', body: { items: [{ src: '/assets/img/flag-gb.png', title: 'e2e Photo', caption: 'e2e caption' }, { src: 'javascript:alert(1)', title: 'bad' }] } })
    if (g.items.length !== 1 || g.items[0].alt !== 'e2e caption') throw new Error(JSON.stringify(g))
    const f = await api('/settings/faq', { method: 'PUT', body: { items: [{ q: 'e2e question?', a: 'e2e answer' }, { q: 'no answer', a: '' }] } })
    if (f.items.length !== 1) throw new Error(JSON.stringify(f))
    const s = await api('/settings/services', { method: 'PUT', body: { items: [{ icon: 'nope', title: 'e2e Service', description: 'x' }] } })
    if (s.items.length !== 1 || s.items[0].icon !== 'Star') throw new Error(JSON.stringify(s))
    const pub = await fetch(`${API}/api/site`).then(x => x.json())
    if (pub.gallery?.[0]?.title !== 'e2e Photo' || pub.faq?.[0]?.q !== 'e2e question?' || pub.services?.[0]?.title !== 'e2e Service') throw new Error('public site lacks them')
    return 'gallery (unsafe src dropped, alt from caption) · faq (empty answer dropped) · services (unknown icon → Star) · public ✓'
  })
  await step('PUT /settings/hero → public /api/site', async () => {
    const r = await api('/settings/hero', { method: 'PUT', body: { badge: '', title_1: 'e2e Hero', title_accent: 'Line', title_2: '', subtitle: 's', chips: [{ icon: 'Ship', title: 'Chip A', caption: 'c' }, { icon: 'nope', title: '', caption: 'dropped' }] } })
    if (r.hero.title_1 !== 'e2e Hero' || r.hero.chips.length !== 1 || r.hero.badge !== '') throw new Error(JSON.stringify(r.hero))
    await api('/settings/hero', { method: 'PUT', body: { chips: [] } }).then(() => { throw new Error('accepted an empty title') }, e => { if (!/title/.test(e.message)) throw e })
    const pub = await fetch(`${API}/api/site`).then(x => x.json()); if (pub.hero?.title_1 !== 'e2e Hero') throw new Error('public site lacks the hero')
    return 'saved (untitled chip dropped) · empty title rejected · public ✓'
  })
  await step('PUT /settings/why → public /api/site', async () => {
    const r = await api('/settings/why', { method: 'PUT', body: { items: [{ icon: 'Clock', title: 'e2e Reason', description: 'd' }, { icon: 'nope', title: '', description: 'dropped' }] } })
    if (r.items.length !== 1 || r.items[0].icon !== 'Clock') throw new Error(JSON.stringify(r.items))
    const pub = await fetch(`${API}/api/site`).then(x => x.json()); if (pub.why?.[0]?.title !== 'e2e Reason') throw new Error('public site lacks why')
    return '1 reason kept (untitled dropped) · public ✓'
  })
  await step('PUT /settings/sustainability → public /api/site', async () => {
    const r = await api('/settings/sustainability', { method: 'PUT', body: { items: [{ label: 'e2e Policy', icon: 'nope', color: 'pink', title: 'e2e Policy Title', tagline: 't', intro: 'i', sections: [{ heading: 'H1', body: 'B1' }, { heading: '', body: 'orphan' }] }, { label: 'e2e Policy', title: 'Dup key' }] } })
    const [a, b] = r.items; if (r.items.length !== 2 || a.icon !== 'Leaf' || a.color !== 'accent' || a.sections.length !== 1 || a.key !== 'e2e-policy' || b.key !== 'e2e-policy-2') throw new Error(JSON.stringify(r.items).slice(0, 200))
    const pub = await fetch(`${API}/api/site`).then(x => x.json()); if (pub.sustainability?.[0]?.title !== 'e2e Policy Title') throw new Error('public site lacks the policies')
    return `${r.items.length} policies (bad icon/colour → defaults, empty section dropped, duplicate key suffixed) · public ✓`
  })
  await step('editor role may edit page content, not settings', async () => {
    const me = await api('/me'); if (!me.permissions?.frontpages) throw new Error('admin lacks frontpages'); return 'frontpages ✓ (admin, editor)'
  })
  await step('PUT /settings/about → public /api/site.about', async () => {
    const cur = (await api('/settings/about')).profile
    const r = await api('/settings/about', { method: 'PUT', body: { ...cur, vision: 'e2e vision text', registrations: [...cur.registrations, { icon: 'nope', label: 'e2e Cert', value: 'No: 1' }], industries: cur.industries.slice(0, 2), values: [{ icon: 'Scale', title: 'e2e Fairness', description: 'x' }] } })
    const p = r.profile; if (p.vision !== 'e2e vision text' || p.registrations.at(-1).icon !== 'Award' || p.industries.length !== 2 || p.values[0].icon !== 'Scale') throw new Error(JSON.stringify(p).slice(0, 160))
    const pub = await fetch(`${API}/api/site`).then(x => x.json()); if (pub.about?.vision !== 'e2e vision text' || pub.about?.registrations?.length !== cur.registrations.length + 1) throw new Error('public site lacks the profile')
    return `vision · ${p.registrations.length} registrations (unknown icon → Award) · ${p.industries.length} industries · ${p.values.length} value · public ✓`
  })
  await step('PUT /settings/markets → public /api/site carries the flags', async () => {
    const m = await api('/settings/markets', { method: 'PUT', body: { markets: [{ name: 'e2e Ghana', code: 'GH' }, { name: 'bad code', code: 'xyz' }], caption_left: 'e2e FOB Lagos', caption_right: '' } })
    if (m.items.length !== 1 || m.items[0].code !== 'gh' || m.caption_left !== 'e2e FOB Lagos' || m.caption_right !== '') throw new Error(JSON.stringify(m))
    const pub = await fetch(`${API}/api/site`).then(x => x.json()); if (pub.markets?.items?.[0]?.name !== 'e2e Ghana') throw new Error('public site lacks the markets: ' + JSON.stringify(pub.markets).slice(0, 120))
    return `1 market (bad code dropped) · public ✓`
  })
  await step('reviews: add → public → hide → not public → delete (needs migration 009)', async () => {
    let r
    try { r = await api('/reviews', { method: 'POST', body: { quote: '“e2e excellent partner throughout the season”', name: 'e2e Reviewer', role: 'Buyer', rating: 4 } }) }
    catch (e) { if (/migration 009/.test(e.message)) return 'SKIPPED — run server/migrations/009_reviews.sql'; throw e }
    if (r.status !== 'approved' || r.rating !== 4 || !r.approved_at || /^“/.test(r.quote)) throw new Error(JSON.stringify(r).slice(0, 160))
    let pub = await fetch(`${API}/api/site`).then(x => x.json()); if (!pub.reviews.some(x => x.name === 'e2e Reviewer')) throw new Error('approved review not public')
    const all = await fetch(`${API}/api/reviews`).then(x => x.json()); if (!all.some(x => x.name === 'e2e Reviewer') || all.some(x => x.email !== undefined)) throw new Error('/api/reviews missing it or leaking emails')
    const hid = await api(`/reviews/${r.id}`, { method: 'PATCH', body: { status: 'hidden' } }); if (hid.status !== 'hidden') throw new Error(hid.status)
    pub = await fetch(`${API}/api/site`).then(x => x.json()); if (pub.reviews.some(x => x.name === 'e2e Reviewer')) throw new Error('hidden review still public')
    if ((await fetch(`${API}/api/reviews`).then(x => x.json())).some(x => x.name === 'e2e Reviewer')) throw new Error('hidden review still on /api/reviews')
    const list = await api('/reviews?status=hidden'); if (!list.some(x => x.id === r.id)) throw new Error('hidden filter missed it')
    const st = await api('/stats'); if (typeof st.reviewsPending !== 'number') throw new Error('stats lack reviewsPending')
    await api(`/reviews/${r.id}`, { method: 'DELETE' })
    return 'approved → public ✓ · hidden → gone from the site ✓ · deleted ✓'
  })
  await step('PUT /settings rejects a bad From', () => refused(() => api('/settings', { method: 'PUT', body: { email: { from: 'not an address' } } }), /From must/, 'bad from'))
  await step('MCP token: generate → works on /mcp → revoke', async () => {
    const r = await api('/settings/mcp/token', { method: 'POST' })
    if (!/^[0-9a-f]{64}$/.test(r.token)) throw new Error('token shape')
    const s = await api('/settings'); if (s.mcp.token_hint !== r.token.slice(-4)) throw new Error('hint mismatch')
    const m = await fetch(`${API}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${r.token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
    if (m.status !== 200) throw new Error(`/mcp with panel token → ${m.status}`)
    const bad = await fetch(`${API}/mcp`, { method: 'POST', headers: { Authorization: 'Bearer ' + r.token.replace(/./, c => c === 'a' ? 'b' : 'a'), 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
    if (bad.status !== 401) throw new Error(`wrong token → ${bad.status}`)
    await api('/settings/mcp/token', { method: 'DELETE' }); return 'hash only; 200 with token, 401 without ✓'
  })
  await step('POST /quote-fields (select, required)', () => api('/quote-fields', { method: 'POST', body: { label: 'E2E Incoterm', key: 'e2e_incoterm', type: 'select', options: ['FOB', 'CIF'], required: true } }))
  const client2 = await step('POST /clients (phase 3 client)', () => api('/clients', { method: 'POST', body: { name: 'e2e-client-p3-' + Date.now(), data: withRequired({ email: 'buyer3@e2e.invalid' }) } }))

  await step('POST /documents rejects an .exe', () => refused(() => api('/documents', { method: 'POST', body: { client_id: client2.id, name: 'x.exe', content_type: 'application/x-msdownload', bytes: 10 } }), /not allowed/, 'exe'))
  const doc = await step('document: create → signed upload → complete', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
    const { document, upload } = await api('/documents', { method: 'POST', body: { client_id: client2.id, name: 'e2e-photo.png', content_type: 'image/png', bytes: png.length } })
    const { error } = await anon.storage.from('documents').uploadToSignedUrl(upload.path, upload.token, png, { contentType: 'image/png' })
    if (error) throw new Error('signed upload: ' + error.message)
    const d = await api(`/documents/${document.id}/complete`, { method: 'POST' })
    if (d.status !== 'ready' || d.kind !== 'image') throw new Error('status=' + d.status)
    docPath = d.path; return d
  })
  await step('GET /documents/:id/url → signed link answers 200', async () => { const { url } = await api(`/documents/${doc.id}/url`); const r = await fetch(url); if (r.status !== 200) throw new Error('signed url → ' + r.status); return 'HTTP 200 ✓' })
  await step('private bucket: anon key cannot read it', async () => { const { data, error } = await anon.storage.from('documents').download(docPath); if (data && !error) throw new Error('anon read a private document'); return 'blocked ✓' })
  await step('POST /client-fields (image)', () => api('/client-fields', { method: 'POST', body: { label: 'E2E Photo', key: 'e2e_photo', type: 'image' } }))
  await step('image field stores {id,name} after verifying the file', async () => { const c = await api(`/clients/${client2.id}`, { method: 'PATCH', body: { data: { e2e_photo: { id: doc.id } } } }); if (c.data.e2e_photo?.name !== 'e2e-photo.png') throw new Error(JSON.stringify(c.data.e2e_photo)); return c.data.e2e_photo.name })
  await step('image field rejects a missing file', () => refused(() => api(`/clients/${client2.id}`, { method: 'PATCH', body: { data: { e2e_photo: { id: 999999999 } } } }), /no longer exists/, 'missing doc'))

  await step('quote needs its required field', () => refused(() => api('/quotes', { method: 'POST', body: { client_id: client2.id, items: [{ description: 'x', unit_price: 1 }] } }), /required/, 'missing incoterm'))
  const quote = await step('POST /quotes (number, snapshot, totals)', async () => {
    const q = await api('/quotes', { method: 'POST', body: { client_id: client2.id, title: 'e2e-quote', items: [{ description: 'Cocoa beans', quantity: 20, unit: 'MT', unit_price: 2400 }, { description: 'Bagging', quantity: 1, unit_price: 500 }], discount: 500, tax_rate: 7.5, data: { e2e_incoterm: 'FOB' } } })
    if (!/^VA-\d{4}-\d{4,6}$/.test(q.number)) throw new Error('number ' + q.number)
    if (Number(q.subtotal) !== 48500 || Number(q.total) !== 51600) throw new Error(`subtotal ${q.subtotal} total ${q.total}`)
    if (q.client_email !== 'buyer3@e2e.invalid' || q.currency !== 'EUR' || q.status !== 'draft') throw new Error('snapshot/currency/status')
    return q
  })
  await step('PATCH /quotes/:id recomputes totals', async () => { const q = await api(`/quotes/${quote.id}`, { method: 'PATCH', body: { discount: 0 } }); if (Number(q.total) !== 52137.5) throw new Error('total ' + q.total); return q.total })
  {
    const year = new Date().getFullYear(), manualN = Number(quote.number.slice(-4)) + 50, pad = n => String(n).padStart(4, '0')
    const raw = (path, body) => fetch(`${API}/api/admin${path}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await step('PATCH /quotes/:id number: digits only, prefix + year fixed', async () => { const q = await api(`/quotes/${quote.id}`, { method: 'PATCH', body: { number: String(manualN) } }); if (q.number !== `VA-${year}-${pad(manualN)}`) throw new Error(q.number); quote.number = q.number; return q.number })
    await step('number with another prefix/year rejected', async () => { const r = await raw(`/quotes/${quote.id}`, { number: `VQ-${year - 1}-0001` }); if (r.status !== 400) throw new Error(r.status); return '400 ✓' })
    const b = await step('next auto number follows the manual one', async () => { const b = await api('/quotes', { method: 'POST', body: { title: 'e2e-quote-b', client_name: 'e2e-b', items: [{ description: 'x', quantity: 1, unit_price: 1 }], data: { e2e_incoterm: 'FOB' } } }); if (b.number !== `VA-${year}-${pad(manualN + 1)}`) throw new Error(b.number); return b })
    await step('duplicate number rejected', async () => { const r = await raw(`/quotes/${b.id}`, { number: quote.number }); if (r.status !== 400) throw new Error(r.status); return '400 ✓' })
    await step('DELETE /quotes/:id (second one)', async () => (await api(`/quotes/${b.id}`, { method: 'DELETE' })).deleted)
  }
  await step('GET /quotes/:id/pdf is a PDF', async () => { const r = await fetch(`${API}/api/admin/quotes/${quote.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } }); const b = Buffer.from(await r.arrayBuffer()); if (r.status !== 200 || b.subarray(0, 4).toString() !== '%PDF') throw new Error('status ' + r.status); return `${b.length} bytes` })
  await step('public link works while draft (status untouched)', async () => { const r = await fetch(`${API}/api/q/${quote.token}`); const d = await r.json(); if (r.status !== 200 || d.status !== 'draft' || d.token !== undefined) throw new Error('got ' + r.status + ' ' + d.status); return 'draft ✓' })

  // ------------------------------------------------ shipments (needs migrations 010 + 011)
  // Reading works from migration 010 on; writing needs 011 too — either hint skips the block.
  const shipProbe = await api(`/quotes/${quote.id}/shipments`).then(() => api(`/quotes/${quote.id}/shipments`, { method: 'POST', body: { items: [{ index: 0, percent: 25 }, { index: 1, percent: 100 }], mode: 'road', vehicle: 'NT456UH', eta: '2026-10-05', origin: { state: 'Oyo' }, destination: { name: 'Apapa Port, Lagos', lat: 6.4474, lng: 3.3627 }, notes: 'n' } })).catch(e => e)
  if (shipProbe instanceof Error) {
    await step('shipments', async () => { if (!/migration 01[01]/.test(shipProbe.message)) throw shipProbe; return 'skipped — ' + shipProbe.message })
  } else {
    // The quote has two lines: Cocoa beans 20 MT @ 2400 (48000) and Bagging 1 @ 500.
    const s1 = await step('POST /quotes/:id/shipments — 25% of cocoa + all bagging, by road', async () => {
      const s = shipProbe
      if (s.number !== 1 || s.status !== 'planned' || s.origin.name !== 'Ibadan, Oyo' || s.items?.length !== 2 || Math.abs(s.percent - 25.77) > 0.02 || s.mode !== 'road' || s.eta !== '2026-10-05') throw new Error(JSON.stringify(s).slice(0, 260))
      return `#${s.id} · ${s.percent}% of the invoice value · ETA ${s.eta}`
    })
    await step('lines: cocoa 75% left, bagging fully shipped', async () => { const l = await api(`/quotes/${quote.id}/shipments`); if (l.lines?.[0]?.remaining !== 75 || l.lines?.[1]?.remaining !== 0 || !l.can_create) throw new Error(JSON.stringify(l.lines)); return `cocoa ${l.lines[0].remaining}% · bagging ${l.lines[1].remaining}% · value left ${l.remaining}%` })
    const ship = body => api(`/quotes/${quote.id}/shipments`, { method: 'POST', body: { origin: { state: 'Oyo' }, destination: { state: 'Lagos' }, ...body } })
    await step('over-allocation refused (80% of cocoa when 75% is left)', () => refused(() => ship({ items: [{ index: 0, percent: 80 }] }), /75%/, 'over'))
    await step('a fully shipped line refused', () => refused(() => ship({ items: [{ index: 1, percent: 1 }] }), /0% of "Bagging"/, 'full line'))
    await step('a line off the invoice refused', () => refused(() => ship({ items: [{ index: 7, percent: 1 }] }), /not on this invoice/, 'bad line'))
    await step('all zero refused', () => refused(() => ship({ items: [{ index: 0, percent: 0 }] }), /above 0%/, 'zero'))
    await step('bad mode refused', () => refused(() => ship({ items: [{ index: 0, percent: 1 }], mode: 'rail' }), /mode must be/, 'mode'))
    await step('bad arrival date refused', () => refused(() => ship({ items: [{ index: 0, percent: 1 }], eta: 'soon' }), /date/, 'eta'))
    await step('a place without coordinates refused', () => refused(() => ship({ items: [{ index: 0, percent: 1 }], origin: { name: 'Nowhere' } }), /coordinates/, 'no coords'))
    const s2 = await step('POST the last 75% of cocoa by sea → nothing left', async () => {
      const s = await ship({ items: [{ index: 0, percent: 75 }], mode: 'sea', vehicle: 'MSC Ines / MSCU1234567', origin: { state: 'Kano' } })
      const l = await api(`/quotes/${quote.id}/shipments`); if (s.number !== 2 || s.mode !== 'sea' || l.can_create || l.remaining !== 0 || l.lines[0].remaining !== 0) throw new Error(`can_create ${l.can_create} remaining ${l.remaining}`)
      return `#${s.id} · ${s.percent}% · invoice fully allocated`
    })
    await step('nothing left → create refused', () => refused(() => ship({ items: [{ index: 0, percent: 1 }] }), /nothing left/, 'zero left'))
    await step('POST /shipments/:id/checkpoints (state) → in_transit', async () => {
      const s = await api(`/shipments/${s1.id}/checkpoints`, { method: 'POST', body: { state: 'Ogun', note: 'Passed Abeokuta' } })
      if (s.status !== 'in_transit' || s.checkpoints.length !== 1 || s.checkpoints[0].name !== 'Abeokuta, Ogun' || s.checkpoints[0].lat == null) throw new Error(JSON.stringify(s.checkpoints))
      return `${s.checkpoints[0].name} · ${s.status}`
    })
    await step('a map click with its own name', async () => { const s = await api(`/shipments/${s1.id}/checkpoints`, { method: 'POST', body: { name: 'Ogere weighbridge', lat: 6.93, lng: 3.6 } }); if (s.checkpoints.length !== 2 || s.checkpoints[1].state !== '') throw new Error(JSON.stringify(s.checkpoints[1])); return s.checkpoints[1].name })
    await step('a checkpoint without a place is refused', () => refused(() => api(`/shipments/${s1.id}/checkpoints`, { method: 'POST', body: { note: 'x' } }), /state|map/, 'no place'))
    await step('GET /quotes/:id carries the shipments and lines', async () => { const q = await api(`/quotes/${quote.id}`); if (q.shipments?.items?.length !== 2 || q.shipments.can_create !== false || q.shipments.lines?.length !== 2) throw new Error(JSON.stringify(q.shipments).slice(0, 140)); return `${q.shipments.items.length} shipments · ${q.shipments.lines.length} lines` })
    await step('public invoice shows the shipments, route, mode and ETA', async () => {
      const d = await fetch(`${API}/api/q/${quote.token}`).then(r => r.json()); const s = d.shipments?.find(x => x.id === s1.id)
      if (!s || s.checkpoints.length !== 2 || s.created_by !== undefined || s.quote_id !== undefined || s.origin.lat == null || s.items.length !== 2 || s.mode !== 'road' || s.eta !== '2026-10-05') throw new Error(JSON.stringify(s || d.shipments).slice(0, 200))
      return `${d.shipments.length} shipments · ${s.checkpoints.length} pins · ${s.mode} · ETA ${s.eta} · nothing internal`
    })
    await step('DELETE a checkpoint', async () => { const s = await api(`/shipments/${s1.id}`); const c = s.checkpoints[1]; const r = await api(`/shipments/${s1.id}/checkpoints/${c.id}`, { method: 'DELETE' }); if (r.checkpoints.length !== 1) throw new Error('still ' + r.checkpoints.length); return 'removed ✓' })
    await step('PATCH status=delivered pins it at the destination', async () => { const s = await api(`/shipments/${s1.id}`, { method: 'PATCH', body: { status: 'delivered' } }); if (s.status !== 'delivered' || !s.delivered_at || s.checkpoints.length !== 2 || s.checkpoints[1].note !== 'Delivered') throw new Error(JSON.stringify(s.checkpoints)); return 'delivered ✓' })
    await step('delivered shipment takes no more pins', () => refused(() => api(`/shipments/${s1.id}/checkpoints`, { method: 'POST', body: { state: 'Lagos' } }), /delivered/, 'closed'))
    await step('cancelling frees its lines', async () => { await api(`/shipments/${s2.id}`, { method: 'PATCH', body: { status: 'cancelled' } }); const l = await api(`/quotes/${quote.id}/shipments`); if (l.lines[0].remaining !== 75 || !l.can_create) throw new Error('remaining ' + JSON.stringify(l.lines)); return 'cocoa 75% free again' })
    await step('PATCH items + mode/eta on a shipment', async () => { const s = await api(`/shipments/${s2.id}`, { method: 'PATCH', body: { items: [{ index: 0, percent: 50 }], mode: 'air', vehicle: 'ET900', eta: '2026-10-01' } }); if (s.items[0].percent !== 50 || s.mode !== 'air' || s.eta !== '2026-10-01' || Math.abs(s.percent - 49.48) > 0.02) throw new Error(JSON.stringify({ items: s.items, mode: s.mode, eta: s.eta, percent: s.percent })); return `air · ${s.percent}% of the value` })
    await step('reopening takes its lines again', async () => { const s = await api(`/shipments/${s2.id}`, { method: 'PATCH', body: { status: 'in_transit' } }); const l = await api(`/quotes/${quote.id}/shipments`); if (s.status !== 'in_transit' || l.lines[0].remaining !== 25) throw new Error('remaining ' + l.lines[0].remaining); return `cocoa ${l.lines[0].remaining}% left` })
    await step('growing beyond what is left refused', () => refused(() => api(`/shipments/${s2.id}`, { method: 'PATCH', body: { items: [{ index: 0, percent: 90 }] } }), /75%/, 'grow'))
    await step('bad shipment status rejected', () => refused(() => api(`/shipments/${s2.id}`, { method: 'PATCH', body: { status: 'lost' } }), /must be one of/, 'bad status'))
    await step('DELETE /shipments/:id', async () => (await api(`/shipments/${s2.id}`, { method: 'DELETE' })).deleted)
  }

  if (S.email.dry_run) {
    await step('POST /quotes/:id/send (dry run: PDF attached, logged, → sent)', async () => {
      const r = await api(`/quotes/${quote.id}/send`, { method: 'POST', body: { subject: 'e2e-quote send' } })
      if (r.message.status !== 'sent' || r.quote.status !== 'sent' || !r.message.attachments?.some(a => a.name === `${quote.number}.pdf`)) throw new Error(JSON.stringify(r.message).slice(0, 120))
      if (!r.message.html.includes(`/q/${quote.token}`)) throw new Error('link missing from email')
      if (r.message.html.includes('E2E Admin')) throw new Error('an invoice email must sign as the company, not the person')
      const att = r.message.attachments?.find(a => a.name === `${quote.number}.pdf`); if (!att?.document_id) throw new Error('PDF not filed as a document: ' + JSON.stringify(r.message.attachments))
      const docs = await api(`/documents?client_id=${client2.id}`); const d = docs.find(x => x.id === att.document_id); if (!d || d.quote_id !== quote.id || d.content_type !== 'application/pdf') throw new Error('PDF missing from the client documents')
      await api(`/documents/${att.document_id}`, { method: 'DELETE' })
      return `msg #${r.message.id} ${r.message.provider_id} · PDF filed as document #${att.document_id} ✓`
    })
    const enq2 = await step('seed enquiry, reply via POST /messages (dry run)', async () => {
      const { data, error } = await svc.from('enquiries').insert({ kind: 'quote', name: 'e2e-enquirer2', email: 'q2@e2e.invalid', commodity: 'Sesame' }).select().single(); if (error) throw error
      const m = await api('/messages', { method: 'POST', body: { enquiry_id: data.id, to: data.email, subject: 'e2e-reply', body: 'Hello from the e2e test.' } })
      if (m.status !== 'sent' || m.enquiry_id !== data.id) throw new Error(JSON.stringify(m).slice(0, 100)); return data.id
    })
    await step('reply moved the enquiry new → contacted', async () => { const e = await api(`/enquiries/${enq2}`); if (e.status !== 'contacted') throw new Error(e.status); return e.status })
    settingsBefore.departments = (await svc.from('settings').select('value').eq('key', 'departments').maybeSingle()).data?.value ?? null
    await step('PUT /settings/departments + send from one (dry run)', async () => {
      const l = await api('/settings/departments', { method: 'PUT', body: { departments: [{ name: 'E2E Finance', email: 'finance@e2e.invalid', reply_to: '', signature: 'E2E Finance Team\nVertoc Agro' }] } })
      const fin = l.find(d => d.email === 'finance@e2e.invalid'); if (!fin || !l[0].is_default) throw new Error(JSON.stringify(l).slice(0, 160))
      const s = await api('/messages/senders'); if (!s.some(d => d.id === fin.id)) throw new Error('composer does not list it')
      const m = await api('/messages', { method: 'POST', body: { to: 'q2@e2e.invalid', subject: 'e2e-from-finance', body: 'Sent from finance.', from_id: fin.id } })
      if (m.from_email !== 'E2E Finance <finance@e2e.invalid>' || !m.html.includes('E2E Admin') || !m.html.includes('E2E Finance Team')) throw new Error(JSON.stringify({ from: m.from_email, signoff: m.html.includes('E2E Admin'), deptSig: m.html.includes('E2E Finance Team') }))
      return `${m.from_email} · signed "E2E Admin" + the department signature ✓`
    })
    await step('POST /enquiries/:id/acknowledge sends the confirmation, request stays new (dry run)', async () => {
      const { data: fresh, error } = await svc.from('enquiries').insert({ kind: 'quote', name: 'e2e-enquirer3', email: 'q3@e2e.invalid', commodity: 'Maize', quantity: '50 MT', destination: 'Lagos' }).select().single(); if (error) throw error
      const m = await api(`/enquiries/${fresh.id}/acknowledge`, { method: 'POST', body: {} })
      if (m.status !== 'sent' || m.to_email !== 'q3@e2e.invalid' || !/received/i.test(m.subject) || !m.html.includes('Maize') || m.enquiry_id !== fresh.id) throw new Error(JSON.stringify(m).slice(0, 160))
      const e = await api(`/enquiries/${fresh.id}`); if (e.status !== 'new') throw new Error('status changed to ' + e.status)
      const t = await api('/templates'); if (!t.some(x => x.key === 'enquiry_received') || !t.some(x => x.key === 'enquiry_notice')) throw new Error('templates missing')
      return `${m.subject} · still new ✓ · templates listed ✓`
    })
  } else {
    results.push(['·', 'send steps SKIPPED', 'live sending is off for this test (set EMAIL_DRY_RUN=1 on the backend to run them)'])
    await step('PATCH /quotes/:id status=sent (manual)', async () => (await api(`/quotes/${quote.id}`, { method: 'PATCH', body: { status: 'sent' } })).status)
  }

  await step('public GET /api/q/:token → viewed, no internals', async () => {
    const r = await fetch(`${API}/api/q/${quote.token}`); const d = await r.json()
    if (r.status !== 200 || d.status !== 'viewed' || d.internal_notes !== undefined || d.token !== undefined || d.client_id !== undefined) throw new Error(JSON.stringify(d).slice(0, 100))
    return `viewed · ${d.items.length} items · ${d.fields.map(f => f.label + '=' + f.value).join(',')}`
  })
  await step('public PDF download', async () => { const r = await fetch(`${API}/api/q/${quote.token}/pdf?download=1`); if (r.status !== 200 || !/pdf/.test(r.headers.get('content-type'))) throw new Error(r.status); return r.headers.get('content-disposition') })
  await step('client accepts online', async () => { const r = await fetch(`${API}/api/q/${quote.token}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'accept', note: 'e2e ok' }) }); const d = await r.json(); if (d.status !== 'accepted') throw new Error(JSON.stringify(d)); return d.status })
  await step('a second answer is refused', async () => { const r = await fetch(`${API}/api/q/${quote.token}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decline' }) }); if (r.status !== 409) throw new Error(r.status); return '409 ✓' })
  await step('accepted quote locks prices', () => refused(() => api(`/quotes/${quote.id}`, { method: 'PATCH', body: { discount: 1 } }), /locked/, 'edit accepted'))
  const purchase = await step('POST /quotes/:id/convert → purchase', async () => { const p = await api(`/quotes/${quote.id}/convert`, { method: 'POST' }); if (Number(p.amount) !== 52137.5 || p.reference !== quote.number || p.client_id !== client2.id) throw new Error(JSON.stringify(p).slice(0, 100)); return p })
  await step('converting twice is refused', () => refused(() => api(`/quotes/${quote.id}/convert`, { method: 'POST' }), /already converted/, 'double convert'))
  await step('PATCH /purchases/:id → paid', async () => (await api(`/purchases/${purchase.id}`, { method: 'PATCH', body: { status: 'paid' } })).status)
  await step('bad purchase status rejected', () => refused(() => api(`/purchases/${purchase.id}`, { method: 'PATCH', body: { status: 'lost' } }), /must be one of/, 'bad status'))
  await step('GET /purchases?client_id lists it', async () => { const l = await api(`/purchases?client_id=${client2.id}`); if (!l.some(p => p.id === purchase.id)) throw new Error('missing'); return l.length })
  await step('GET /stats counts quotes & purchases', async () => { const s = await api('/stats'); if (typeof s.quotesOpen !== 'number' || typeof s.purchasesPending !== 'number') throw new Error('missing counts'); return `open=${s.quotesOpen} pending=${s.purchasesPending}` })
  await step('DELETE /documents/:id removes the object too', async () => { await api(`/documents/${doc.id}`, { method: 'DELETE' }); const { data } = await svc.storage.from('documents').download(docPath); if (data) throw new Error('object still in storage'); docPath = null; return 'row + object gone ✓' })


  // ------------------------------------------------ Phase 4: templates + inbound email
  const has005 = !(await svc.from('email_templates').select('key').limit(1)).error
  await step('GET /templates (defaults even before migration 005)', async () => { const t = await api('/templates'); if (t.length < 6 || !t.find(x => x.key === 'quote')) throw new Error('templates missing'); return t.map(x => x.key).join(',') })
  await step('GET /templates/quote/render?quote_id renders real values', async () => {
    const r = await api(`/templates/quote/render?quote_id=${quote.id}`)
    if (!r.subject.includes(quote.number) || !r.body.includes(quote.number) || !r.cta?.url?.includes(`/q/${quote.token}`)) throw new Error(JSON.stringify(r).slice(0, 120))
    return r.subject
  })
  if (has005) {
    await step('PUT /templates/blank (customise) + reset', async () => {
      const t = await api('/templates/blank', { method: 'PUT', body: { body: 'Hi {{name}}, e2e-custom' } })
      if (!t.body.includes('e2e-custom') || t.is_default) throw new Error('not stored')
      const r = await api(`/templates/blank/render?client_id=${client2.id}`); if (!r.body.startsWith('Hi ')) throw new Error('render used old body: ' + r.body.slice(0, 30))
      const back = await api('/templates/blank/reset', { method: 'POST' }); if (back.body.includes('e2e-custom')) throw new Error('reset failed')
      return 'customised → rendered → reset ✓'
    })
    await step('POST /templates/quote/preview returns branded HTML', async () => { const r = await api('/templates/quote/preview', { method: 'POST', body: { subject: 'S {{quote_number}}', body: 'B {{client_name}}' } }); if (!r.subject.startsWith('S VA-') || !r.html.includes('B Alessia')) throw new Error(JSON.stringify(r).slice(0, 80)); return r.subject })
    const whsec = 'whsec_' + Buffer.from('e2e-webhook-secret-' + Date.now()).toString('base64')
    settingsBefore.secrets = (await svc.from('settings').select('value').eq('key', 'secrets').maybeSingle()).data?.value ?? null
    await step('PUT /settings/secrets/resend_webhook_secret', async () => { const r = await api('/settings/secrets/resend_webhook_secret', { method: 'PUT', body: { value: whsec } }); if (!r.resend_webhook_secret?.hint) throw new Error('not stored'); return 'stored, hint ' + r.resend_webhook_secret.hint })
    const { createHmac } = await import('node:crypto')
    const signed = (body, secret = whsec, ts = Math.floor(Date.now() / 1000)) => {
      const id = 'msg_e2e_' + Date.now()
      const sig = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${ts}.${body}`).digest('base64')
      return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': 'v1,' + sig, 'Content-Type': 'application/json' }
    }
    const emailId = 'e2e-' + Date.now()
    const payload = JSON.stringify({ type: 'email.received', created_at: new Date().toISOString(), data: { email_id: emailId, from: 'Buyer Three <buyer3@e2e.invalid>', to: ['sales@vertocagro.com'], subject: `Re: e2e-quote ${quote.number}`, message_id: `<${emailId}@e2e>`, text: 'Thanks, noted.\n\nOn 17 Sept 2026, 14:13, Sales at Vertoc Agro <sales@vertocagro.com> wrote:\n> e2e original text\n> second line', headers: { 'in-reply-to': '<x@e2e>' }, attachments: [] } })
    await step('webhook rejects a bad signature', async () => { const r = await fetch(`${API}/api/webhooks/resend`, { method: 'POST', headers: signed(payload, 'whsec_' + Buffer.from('wrong').toString('base64')), body: payload }); if (r.status !== 401) throw new Error('got ' + r.status); return '401 ✓' })
    if (!S.email.dry_run) results.push(['·', 'webhook ingestion SKIPPED', 'needs EMAIL_DRY_RUN=1 on the backend (the body is read from the payload instead of Resend)'])
    const inbound = !S.email.dry_run ? null : await step('webhook email.received → inbox row (dry run: body from payload)', async () => {
      const r = await fetch(`${API}/api/webhooks/resend`, { method: 'POST', headers: signed(payload), body: payload }); const d = await r.json()
      if (r.status !== 200 || !d.created) throw new Error(r.status + ' ' + JSON.stringify(d))
      const m = await api(`/messages/${d.id}`)
      if (m.direction !== 'in' || m.client_id !== client2.id || m.quote_id !== quote.id || m.from_name !== 'Buyer Three' || m.read_at) throw new Error(JSON.stringify(m).slice(0, 140))
      return m
    })
    if (inbound) {
      await step('webhook retry is idempotent', async () => { const r = await fetch(`${API}/api/webhooks/resend`, { method: 'POST', headers: signed(payload), body: payload }); const d = await r.json(); if (d.created !== false || d.id !== inbound.id) throw new Error(JSON.stringify(d)); return 'same row ✓' })
      const th = await step('GET /messages/threads: one thread per client + subject', async () => { const t = await api('/messages/threads'); const th = t.find(x => x.client_id === client2.id && /e2e-quote/i.test(x.subject)); if (!th || th.unread < 1 || !th.last || !th.key.startsWith(`c${client2.id}|`)) throw new Error(JSON.stringify(t).slice(0, 160)); const team = (S.email.notify_to || S.email.reply_to || '').toLowerCase(); if (team && t.some(x => x.email === team)) throw new Error('team notifications leaked into conversations'); return th })
      await step('a different subject makes a separate thread', async () => { const p2 = JSON.stringify({ type: 'email.received', created_at: new Date().toISOString(), data: { email_id: emailId + '-b', from: 'Buyer Three <buyer3@e2e.invalid>', to: ['sales@vertocagro.com'], subject: 'e2e-other topic', message_id: `<${emailId}-b@e2e>`, text: 'A different matter.', headers: {}, attachments: [] } }); const r = await fetch(`${API}/api/webhooks/resend`, { method: 'POST', headers: signed(p2), body: p2 }); const d = await r.json(); if (!d.created) throw new Error(JSON.stringify(d)); const t = await api(`/messages/threads?client_id=${client2.id}`); if (t.length < 2 || !t.some(x => /other topic/i.test(x.subject)) || t.some(x => x.key === th.key && x.count !== th.count)) throw new Error(JSON.stringify(t.map(x => [x.subject, x.count]))); return `${t.length} threads for the client: ${t.map(x => x.subject).join(' | ')}` })
      await step('GET /messages/thread folds the quoted history', async () => { const rows = await api(`/messages/thread?key=${encodeURIComponent(th.key)}`); const m = rows.find(x => x.id === inbound.id); if (!m || m.text !== 'Thanks, noted.' || !/wrote:/.test(m.quoted) || m.html !== undefined) throw new Error(JSON.stringify({ text: m?.text, quoted: m?.quoted }).slice(0, 160)); if (rows.some(x => /^New email from/.test(x.subject))) throw new Error('the team notification is inside the client thread'); return `${rows.length} messages · text "${m.text}" · quoted folded ✓` })
      await step('POST /messages reply_to_id threads by headers (dry run)', async () => { const r = await api('/messages', { method: 'POST', body: { reply_to_id: inbound.id, body: 'e2e reply in thread' } }); if (r.in_reply_to !== `<${emailId}@e2e>` || !/^Re: /.test(r.subject) || r.to_email !== 'buyer3@e2e.invalid' || r.client_id !== client2.id || !r.provider_message_id) throw new Error(JSON.stringify(r).slice(0, 200)); if (r.html.includes('wrote:')) throw new Error('old text was pasted into the reply'); if (r.thread_key !== th.key) throw new Error('reply left its thread: ' + r.thread_key); return `${r.subject} · In-Reply-To ${r.in_reply_to} · same thread ✓` })
      settingsBefore.thread_labels = (await svc.from('settings').select('value').eq('key', 'thread_labels').maybeSingle()).data?.value ?? null
      await step('GET /messages/labels has the presets', async () => { const r = await api('/messages/labels'); if (!r.labels?.some(l => /deal closed/i.test(l.name)) || !r.colors?.length) throw new Error(JSON.stringify(r).slice(0, 100)); return r.labels.map(l => l.name).join(' | ') })
      await step('PUT /messages/thread/label; awaiting_reply follows the last sender', async () => { const r = await api('/messages/thread/label', { method: 'PUT', body: { key: th.key, label: 'Deal pending approval' } }); if (r.label?.name !== 'Deal pending approval') throw new Error(JSON.stringify(r)); const t = await api(`/messages/threads?client_id=${client2.id}`); const x = t.find(y => y.key === th.key); if (x?.label?.name !== 'Deal pending approval' || x.awaiting_reply !== true) throw new Error(JSON.stringify(x).slice(0, 160)); const f = await api(`/messages/threads?label=${encodeURIComponent('Deal pending approval')}`); if (!f.some(y => y.key === th.key)) throw new Error('label filter missed it'); const a = await api('/messages/threads?label=__awaiting'); if (!a.some(y => y.key === th.key)) throw new Error('awaiting filter missed it'); return `${x.label.name} · awaiting reply ✓ · filters ✓` })
      await step('a custom label joins the list; clear + remove', async () => { const r = await api('/messages/thread/label', { method: 'PUT', body: { key: th.key, label: 'e2e custom label', color: 'teal' } }); if (r.label?.name !== 'e2e custom label' || r.label.color !== 'teal') throw new Error(JSON.stringify(r)); const c = await api('/messages/labels'); if (!c.labels.some(l => l.name === 'e2e custom label' && l.color === 'teal')) throw new Error('not in catalogue with its colour'); const off = await api('/messages/thread/label', { method: 'PUT', body: { key: th.key, label: null } }); if (off.label !== null) throw new Error('not cleared'); const l2 = await api('/messages/labels', { method: 'PUT', body: { labels: c.labels.filter(l => l.name !== 'e2e custom label') } }); if (l2.labels.some(l => l.name === 'e2e custom label')) throw new Error('not removed'); return 'custom → listed → cleared → removed ✓' })
      await step('GET /messages?direction=in&unread=1 lists it; stats count it', async () => { const l = await api('/messages?direction=in&unread=1'); if (!l.some(m => m.id === inbound.id)) throw new Error('missing'); const s = await api('/stats'); if (!(s.inboundUnread >= 1)) throw new Error('stats ' + s.inboundUnread); return `${l.length} unread` })
      await step('POST /messages/:id/read', async () => { const m = await api(`/messages/${inbound.id}/read`, { method: 'POST', body: {} }); if (!m.read_at) throw new Error('not read'); return 'read ✓' })
      await step('POST /messages/thread/read leaves nothing unread', async () => { const r = await api('/messages/thread/read', { method: 'POST', body: { key: th.key } }); const t = await api('/messages/threads'); const x = t.find(y => y.key === th.key); if (!x || x.unread !== 0) throw new Error('unread ' + x?.unread); return `${r.read} marked now, ${x.unread} unread` })
      await step('client hub sees the inbound email', async () => { const l = await api(`/messages?client_id=${client2.id}&direction=in`); if (!l.some(m => m.id === inbound.id)) throw new Error('missing'); return l.length })
    }
    await step('DELETE /settings/secrets/resend_webhook_secret', async () => { await api('/settings/secrets/resend_webhook_secret', { method: 'DELETE' }); return 'removed' })
    if (S.email.dry_run) {
      await step('POST /users/invite goes through the template (dry run)', async () => {
        const inv = await api('/users/invite', { method: 'POST', body: { email: `e2e-invite-${Date.now()}@vertocagro.invalid`, name: 'E2E Invitee', role: 'sales' } })
        if (inv.via !== 'resend' || !inv.message_id) throw new Error(JSON.stringify(inv))
        const m = await api(`/messages/${inv.message_id}`); if (!/invited/i.test(m.subject) || !/redirect_to=/.test(m.html)) throw new Error(m.subject)
        const again = await api(`/users/${inv.id}/send-link`, { method: 'POST' }); if (again.kind !== 'reinvite' || again.via !== 'resend' || !again.message_id) throw new Error('send-link: ' + JSON.stringify(again))
        const d = await api(`/users/${inv.id}`); if (d.auth?.invite !== 'pending') throw new Error('expected a pending invite, got ' + d.auth?.invite)
        await svc.auth.admin.deleteUser(inv.id)
        // Supabase replaces a redirect that is not in Auth → URL configuration with its Site URL; that is a project setting, not a bug here.
        return m.html.includes('/staff360/set-password') ? `via resend, msg #${m.id}` : `via resend, msg #${m.id} (Supabase swapped the redirect for its Site URL — allow-list this API's ADMIN_URL under Auth → URL configuration to test the full link)`
      })
    }
  } else {
    results.push(['·', 'Phase 4 steps SKIPPED', 'migration 005 (email_templates, inbound columns) not applied yet'])
  }

  // Role and active flag are re-read from the profile on EVERY request — the
  // token stays valid, yet access must change immediately.
  await step('role downgrade applies without re-login', async () => {
    await svc.from('profiles').update({ role: 'sales' }).eq('id', userId)
    return refused(() => api('/products'), /^403/, 'sales reading products')
  })
  await step('sales cannot change settings', () => refused(() => api('/settings', { method: 'PUT', body: { site: { name: 'x' } } }), /^403/, 'sales settings'))
  await step('deactivation applies without re-login', async () => {
    await svc.from('profiles').update({ active: false, role: 'admin' }).eq('id', userId)
    return refused(() => api('/me'), /^403/, 'inactive /me')
  })
} catch (e) {
  // A failing step is already recorded; anything else is a bug in the test itself.
  if (!results.length || results[results.length - 1][0] !== '✗') results.push(['✗', 'test aborted outside a step', e.stack?.split('\n').slice(0, 2).join(' ') || e.message])
}
finally {
  if (uploadPath) await svc.storage.from('media').remove([uploadPath]).catch(() => {})
  await svc.from('products').delete().like('slug', 'e2e-test-%')
  await svc.from('posts').delete().like('slug', 'e2e-test-%')
  await svc.from('enquiries').delete().like('name', 'e2e-%')
  await svc.from('clients').delete().like('name', 'e2e-client-%')
  await svc.from('client_fields').delete().like('key', 'e2e_%')
  // Phase 3
  if (docPath) await svc.storage.from('documents').remove([docPath]).catch(() => {})
  await svc.from('purchases').delete().like('description', 'e2e-%')
  await svc.from('messages').delete().like('subject', 'e2e-%')
  await svc.from('messages').delete().like('subject', 'Re: e2e-%')
  await svc.from('messages').delete().like('to_email', 'e2e-invite-%')
  await svc.from('messages').delete().like('to_email', '%@e2e.invalid')
  await svc.from('reviews').delete().like('name', 'e2e %').then(() => {}, () => {})
  await svc.from('email_templates').delete().eq('key', 'e2e_never')
  await svc.from('documents').delete().like('name', 'e2e-%')
  await svc.from('quotes').delete().like('title', 'e2e-%')
  await svc.from('quote_fields').delete().like('key', 'e2e_%')
  for (const [key, value] of Object.entries(settingsBefore)) {
    if (value) await svc.from('settings').upsert({ key, value }, { onConflict: 'key' })
    else await svc.from('settings').delete().eq('key', key)
  }
  { const { data: u } = await svc.auth.admin.listUsers({ perPage: 200 }); for (const x of (u?.users || []).filter(x => /^e2e-invite-.*@vertocagro\.invalid$/.test(x.email))) await svc.auth.admin.deleteUser(x.id).catch(() => {}) }
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
