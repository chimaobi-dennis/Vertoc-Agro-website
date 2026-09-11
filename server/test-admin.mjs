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
const step = async (name, fn) => {
  try { const v = await fn(); results.push(['✓', name, show(v)]); return v }
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
    if (!/^VQ-\d{4}-\d{4}$/.test(q.number)) throw new Error('number ' + q.number)
    if (Number(q.subtotal) !== 48500 || Number(q.total) !== 51600) throw new Error(`subtotal ${q.subtotal} total ${q.total}`)
    if (q.client_email !== 'buyer3@e2e.invalid' || q.currency !== 'EUR' || q.status !== 'draft') throw new Error('snapshot/currency/status')
    return q
  })
  await step('PATCH /quotes/:id recomputes totals', async () => { const q = await api(`/quotes/${quote.id}`, { method: 'PATCH', body: { discount: 0 } }); if (Number(q.total) !== 52137.5) throw new Error('total ' + q.total); return q.total })
  await step('GET /quotes/:id/pdf is a PDF', async () => { const r = await fetch(`${API}/api/admin/quotes/${quote.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } }); const b = Buffer.from(await r.arrayBuffer()); if (r.status !== 200 || b.subarray(0, 4).toString() !== '%PDF') throw new Error('status ' + r.status); return `${b.length} bytes` })
  await step('public link is 404 while draft', async () => { const r = await fetch(`${API}/api/q/${quote.token}`); if (r.status !== 404) throw new Error('got ' + r.status); return '404 ✓' })

  if (S.email.dry_run) {
    await step('POST /quotes/:id/send (dry run: PDF attached, logged, → sent)', async () => {
      const r = await api(`/quotes/${quote.id}/send`, { method: 'POST', body: { subject: 'e2e-quote send' } })
      if (r.message.status !== 'sent' || r.quote.status !== 'sent' || !r.message.attachments?.some(a => a.name === `${quote.number}.pdf`)) throw new Error(JSON.stringify(r.message).slice(0, 120))
      if (!r.message.html.includes(`/q/${quote.token}`)) throw new Error('link missing from email')
      return `msg #${r.message.id} ${r.message.provider_id}`
    })
    const enq2 = await step('seed enquiry, reply via POST /messages (dry run)', async () => {
      const { data, error } = await svc.from('enquiries').insert({ kind: 'quote', name: 'e2e-enquirer2', email: 'q2@e2e.invalid', commodity: 'Sesame' }).select().single(); if (error) throw error
      const m = await api('/messages', { method: 'POST', body: { enquiry_id: data.id, to: data.email, subject: 'e2e-reply', body: 'Hello from the e2e test.' } })
      if (m.status !== 'sent' || m.enquiry_id !== data.id) throw new Error(JSON.stringify(m).slice(0, 100)); return data.id
    })
    await step('reply moved the enquiry new → contacted', async () => { const e = await api(`/enquiries/${enq2}`); if (e.status !== 'contacted') throw new Error(e.status); return e.status })
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
    await step('POST /templates/quote/preview returns branded HTML', async () => { const r = await api('/templates/quote/preview', { method: 'POST', body: { subject: 'S {{quote_number}}', body: 'B {{client_name}}' } }); if (!r.subject.startsWith('S VQ-') || !r.html.includes('B Alessia')) throw new Error(JSON.stringify(r).slice(0, 80)); return r.subject })
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
    const payload = JSON.stringify({ type: 'email.received', created_at: new Date().toISOString(), data: { email_id: emailId, from: 'Buyer Three <buyer3@e2e.invalid>', to: ['sales@vertocagro.com'], subject: `Re: e2e-quote ${quote.number}`, text: 'e2e inbound body', headers: { 'in-reply-to': '<x@e2e>' }, attachments: [] } })
    await step('webhook rejects a bad signature', async () => { const r = await fetch(`${API}/api/webhooks/resend`, { method: 'POST', headers: signed(payload, 'whsec_' + Buffer.from('wrong').toString('base64')), body: payload }); if (r.status !== 401) throw new Error('got ' + r.status); return '401 ✓' })
    const inbound = await step('webhook email.received → inbox row (dry run: body from payload)', async () => {
      if (!S.email.dry_run) throw new Error('backend not in EMAIL_DRY_RUN=1; skipping ingestion')
      const r = await fetch(`${API}/api/webhooks/resend`, { method: 'POST', headers: signed(payload), body: payload }); const d = await r.json()
      if (r.status !== 200 || !d.created) throw new Error(r.status + ' ' + JSON.stringify(d))
      const m = await api(`/messages/${d.id}`)
      if (m.direction !== 'in' || m.client_id !== client2.id || m.quote_id !== quote.id || m.from_name !== 'Buyer Three' || m.read_at) throw new Error(JSON.stringify(m).slice(0, 140))
      return m
    }).catch(() => null)
    if (inbound) {
      await step('webhook retry is idempotent', async () => { const r = await fetch(`${API}/api/webhooks/resend`, { method: 'POST', headers: signed(payload), body: payload }); const d = await r.json(); if (d.created !== false || d.id !== inbound.id) throw new Error(JSON.stringify(d)); return 'same row ✓' })
      await step('GET /messages?direction=in&unread=1 lists it; stats count it', async () => { const l = await api('/messages?direction=in&unread=1'); if (!l.some(m => m.id === inbound.id)) throw new Error('missing'); const s = await api('/stats'); if (!(s.inboundUnread >= 1)) throw new Error('stats ' + s.inboundUnread); return `${l.length} unread` })
      await step('POST /messages/:id/read', async () => { const m = await api(`/messages/${inbound.id}/read`, { method: 'POST', body: {} }); if (!m.read_at) throw new Error('not read'); return 'read ✓' })
      await step('client hub sees the inbound email', async () => { const l = await api(`/messages?client_id=${client2.id}&direction=in`); if (!l.some(m => m.id === inbound.id)) throw new Error('missing'); return l.length })
    }
    await step('DELETE /settings/secrets/resend_webhook_secret', async () => { await api('/settings/secrets/resend_webhook_secret', { method: 'DELETE' }); return 'removed' })
    if (S.email.dry_run) {
      await step('POST /users/invite goes through the template (dry run)', async () => {
        const inv = await api('/users/invite', { method: 'POST', body: { email: `e2e-invite-${Date.now()}@vertocagro.invalid`, name: 'E2E Invitee', role: 'sales' } })
        if (inv.via !== 'resend' || !inv.message_id) throw new Error(JSON.stringify(inv))
        const m = await api(`/messages/${inv.message_id}`); if (!/invited/i.test(m.subject) || !m.html.includes('/staff360/set-password')) throw new Error(m.subject)
        await svc.auth.admin.deleteUser(inv.id); return `via resend, msg #${m.id}`
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
  await svc.from('email_templates').delete().eq('key', 'e2e_never')
  await svc.from('documents').delete().like('name', 'e2e-%')
  await svc.from('quotes').delete().like('title', 'e2e-%')
  await svc.from('quote_fields').delete().like('key', 'e2e_%')
  for (const [key, value] of Object.entries(settingsBefore)) {
    if (value) await svc.from('settings').upsert({ key, value }, { onConflict: 'key' })
    else if (key === 'secrets') await svc.from('settings').delete().eq('key', 'secrets')
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
