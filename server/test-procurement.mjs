/*
 * End-to-end test of procurement against a running backend: bidding
 * opportunities, bids (with and without a supplier account), documents,
 * statuses and their emails, requests for information, awards, purchase
 * orders, the procurement inbox and the permissions that keep it apart
 * from sales. Needs migration 014. Removes everything it created, even if
 * a step fails.
 *
 *   node server/test-procurement.mjs       (backend on :8787)
 *
 * Never emails anyone. With EMAIL_DRY_RUN=1 on the backend the emails are
 * logged as sent and checked; without it (production) the procurement
 * notifications are switched off for the run, every call is made with
 * notify: false, and the steps that would send are reported as skipped.
 * Steps behind the captcha (bidding and registering without an account)
 * run only where the backend has no TURNSTILE_SECRET_KEY.
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const API = process.env.API_URL || 'http://localhost:8787'
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
const ANON = process.env.VITE_SUPABASE_ANON_KEY
  || readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim()
const die = m => { console.error('✗ ' + m); process.exit(1) }
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) die('server/.env needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
if (!ANON) die('VITE_SUPABASE_ANON_KEY is empty in ../.env')

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, noSession)
const anonClient = () => createClient(SUPABASE_URL, ANON, noSession)

const RUN = Date.now()
const PASS = 'E2e-Test-Passw0rd!'
const staff = { admin: { email: `e2e-proc-admin-${RUN}@vertocagro.invalid`, role: 'admin' }, buyer: { email: `e2e-proc-buyer-${RUN}@vertocagro.invalid`, role: 'procurement' }, sales: { email: `e2e-proc-sales-${RUN}@vertocagro.invalid`, role: 'sales' } }
const SUP = { email: `e2e-supplier-${RUN}@e2e.invalid`, company: `e2e-Kano Grains ${RUN}` }        // bids first, registers later
const SUP2 = { email: `e2e-supplier2-${RUN}@e2e.invalid`, company: `e2e-Oyo Farms ${RUN}` }       // account first
const results = []
const paths = []            // storage objects to remove
let settingsBefore, secretWas = null, secretTouched = false

const show = v => (v && typeof v === 'object' ? (v.summary ?? v.number ?? (v.id != null ? `#${v.id}` : JSON.stringify(v).slice(0, 80))) : (v ?? ''))
const pause = () => (process.env.STEP_DELAY_MS ? new Promise(r => setTimeout(r, Number(process.env.STEP_DELAY_MS))) : null)
const step = async (name, fn) => { await pause(); try { const v = await fn(); results.push(['✓', name, show(v)]); return v } catch (e) { results.push(['✗', name, e.message]); throw e } }
const skip = (name, why) => results.push(['·', name, `SKIPPED — ${why}`])
const call = async (url, { method = 'GET', body, token, headers = {} } = {}, attempt = 0) => {
  let r
  try { r = await fetch(`${API}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body && JSON.stringify(body) }) }
  catch (e) { if (attempt < 1) { await new Promise(x => setTimeout(x, 2000)); return call(url, { method, body, token, headers }, 1) } throw e }
  if ([502, 503, 504].includes(r.status) && attempt < 1 && method === 'GET') { await new Promise(x => setTimeout(x, 2000)); return call(url, { method, body, token, headers }, 1) }
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(`${r.status} ${d.error || ''}`.trim()), { status: r.status, code: d.code })
  return d
}
const as = who => (path, o = {}) => call(`/api/admin${path}`, { ...o, token: staff[who].token })
const admin = as('admin'), buyer = as('buyer'), sales = as('sales')
const pub = (path, o = {}) => call(`/api${path}`, o)
const refused = async (fn, re, label) => { try { await fn() } catch (e) { if (re.test(e.message)) return e.message.slice(0, 3) + ' ✓'; throw e } throw new Error(`was allowed (${label})`) }
const inHours = h => new Date(Date.now() + h * 3600e3).toISOString()
const day = d => new Date(Date.now() + d * 86400e3).toISOString().slice(0, 10)
const mailTo = async (to, like) => (await svc.from('messages').select('*').eq('to_email', to).ilike('subject', like).order('id', { ascending: false }).limit(1)).data?.[0] ?? null
const tokenIn = (m, page) => (String(m?.html || '').match(new RegExp(`/supplier/${page}\\?token=([0-9a-f]{64})`)) || [])[1]
const signIn = async (email, password) => { const { data, error } = await anonClient().auth.signInWithPassword({ email, password }); if (error) throw error; return data.session.access_token }
const upload = async (startUrl, o, name, type, bytes) => {
  const s = await call(startUrl, { ...o, method: 'POST', body: { name, content_type: type, bytes: bytes.length, label: 'CAC documents' } })
  paths.push(s.upload.path)
  const { error } = await anonClient().storage.from('documents').uploadToSignedUrl(s.upload.path, s.upload.token, new Blob([bytes], { type }), { contentType: type, upsert: false })
  if (error) throw new Error('storage: ' + error.message)
  return call(`${startUrl}/${s.document.id}/complete`, { ...o, method: 'POST' })
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
const bidBody = (o = {}) => ({ company_name: SUP.company, contact_person: 'Musa Abdullahi', phone: '+234 803 000 0000', email: SUP.email, address: '12 Market Road, Kano', quantity: 400, price: 640000, commodity_location: 'Kano', delivery_date: day(30), accepts_terms: true, confirmed: true, note: 'e2e bid', ...o })

try {
  /* ------------------------------------------------------------ setup --- */
  await step('three staff accounts: admin, procurement, sales', async () => {
    for (const s of Object.values(staff)) {
      const { data, error } = await svc.auth.admin.createUser({ email: s.email, password: PASS, email_confirm: true }); if (error) throw error
      s.id = data.user.id
      const { error: pe } = await svc.from('profiles').upsert({ id: s.id, email: s.email, name: `E2E ${s.role}`, role: s.role, active: true }, { onConflict: 'id' })
      if (pe) throw new Error(/procurement/.test(pe.message) ? 'migration 014 is not applied (no "procurement" role): run server/migrations/014_procurement.sql' : pe.message)
      s.token = await signIn(s.email, PASS)
    }
    return Object.values(staff).map(s => s.role).join(', ')
  })
  const S = await step('GET /settings has the procurement group', async () => { const s = await admin('/settings'); if (!s.procurement || s.procurement.default_currency == null) throw new Error('no procurement settings'); return s })
  const DRY = Boolean(S.email.dry_run)
  settingsBefore = (await svc.from('settings').select('value').eq('key', 'procurement').maybeSingle()).data?.value ?? null
  await step(DRY ? 'PUT /settings procurement (notifications on, dry run)' : 'PUT /settings procurement: notifications OFF for this run (live email)', async () => {
    const s = await admin('/settings', { method: 'PUT', body: { procurement: { default_currency: 'ngn', default_unit: 'MT', ack_bids: DRY, notify_bids: DRY, notify_status: DRY, notify_to: DRY ? 'procurement@e2e.invalid' : '' } } })
    if (s.procurement.default_currency !== 'NGN' || s.procurement.ack_bids !== DRY) throw new Error(JSON.stringify(s.procurement)); return `currency ${s.procurement.default_currency} · emails ${DRY ? 'logged, never sent' : 'off'}`
  })
  await step('bad procurement notification address refused', () => refused(() => admin('/settings', { method: 'PUT', body: { procurement: { notify_to: 'nope' } } }), /valid email/, 'bad address'))

  /* ------------------------------------------------------ permissions --- */
  await step('GET /me: admin and procurement may, sales may not', async () => {
    const [a, b, c] = await Promise.all([admin('/me'), buyer('/me'), sales('/me')])
    if (!a.permissions.procurement || !b.permissions.procurement || c.permissions.procurement || b.permissions.quotes) throw new Error(JSON.stringify([a.permissions, b.permissions, c.permissions]))
    return 'procurement ✓ (admin, procurement)'
  })
  await step('sales cannot open procurement', () => refused(() => sales('/tenders'), /^403/, 'sales → tenders'))
  await step('procurement cannot open sales', () => refused(() => buyer('/quotes'), /^403/, 'procurement → invoices'))
  await step('sales cannot read the procurement inbox', () => refused(() => sales('/procurement/messages/threads'), /^403/, 'sales → procurement inbox'))
  await step('procurement cannot read the sales inbox', () => refused(() => buyer('/messages/threads'), /^403/, 'procurement → sales inbox'))

  /* ---------------------------------------------------------- tenders --- */
  await step('an opportunity needs a closing date', () => refused(() => buyer('/tenders', { method: 'POST', body: { commodity: 'Soybeans', quantity: 1000 } }), /closing date/, 'no closing'))
  await step('an opportunity needs a quantity', () => refused(() => buyer('/tenders', { method: 'POST', body: { commodity: 'Soybeans', quantity: 0, closes_at: inHours(48) } }), /quantity/, 'no quantity'))
  await step('bids cannot close before they open', () => refused(() => buyer('/tenders', { method: 'POST', body: { commodity: 'Soybeans', quantity: 10, opens_at: inHours(48), closes_at: inHours(24) } }), /close after/, 'closes first'))
  const tender = await step('POST /tenders (draft, numbered, defaults from settings)', async () => {
    const t = await buyer('/tenders', { method: 'POST', body: { title: 'e2e-Soybeans supply opportunity', commodity: 'Soybeans', quantity: 1000, specification: 'Export quality\nMoisture 12% max\nForeign matter 1% max', delivery_location: 'Ibadan, Oyo State', delivery_period: 'Within 30 days of award', asking_price: 650000, requirements: 'CAC documents; quality certificate', closes_at: inHours(72) } })
    if (!/^VB-\d{4}-\d{4,6}$/.test(t.number) || t.status !== 'draft' || t.state !== 'draft' || t.currency !== 'NGN' || t.unit !== 'MT' || !/Payment on delivery/.test(t.payment_terms) || t.asking_price !== 650000) throw new Error(JSON.stringify(t).slice(0, 300))
    return t
  })
  await step('a draft is not on the website', async () => { const l = await pub('/tenders'); if (l.some(t => t.number === tender.number)) throw new Error('listed'); const r = await fetch(`${API}/api/tenders/${tender.number}`); if (r.status !== 404) throw new Error('detail ' + r.status); return 'hidden ✓' })
  await step('publishing with a closing date in the past is refused', () => refused(() => buyer(`/tenders/${tender.id}`, { method: 'PATCH', body: { status: 'published', opens_at: inHours(-48), closes_at: inHours(-1) } }), /already passed/, 'past closing'))
  await step('PATCH /tenders/:id status=published → open on the website', async () => {
    const t = await buyer(`/tenders/${tender.id}`, { method: 'PATCH', body: { status: 'published' } }); if (t.state !== 'open') throw new Error(t.state)
    const l = await pub('/tenders'); const p = l.find(x => x.number === tender.number)
    if (!p || !p.accepting_bids || p.asking_price !== 650000 || p.id !== undefined || p.created_by !== undefined) throw new Error(JSON.stringify(p))
    const d = await pub(`/tenders/${tender.number.toLowerCase()}`); if (!/I confirm/.test(d.declaration) || d.state !== 'open') throw new Error('detail')
    return `${p.number} · asking ${p.asking_price} ${p.currency}/${p.unit} · closes ${p.closes_at.slice(0, 10)}`
  })
  const upcoming = await step('an opportunity that opens later is "upcoming" and takes no bids', async () => {
    const t = await buyer('/tenders', { method: 'POST', body: { title: 'e2e-Maize supply opportunity', commodity: 'Maize', quantity: 500, asking_price: 420000, opens_at: inHours(24), closes_at: inHours(96), status: 'published' } })
    if (t.state !== 'upcoming') throw new Error(t.state)
    await refused(() => pub(`/tenders/${t.number}/bids`, { method: 'POST', body: bidBody() }), /not open for bids yet/, 'bid on upcoming')
    return t
  })
  await step('a custom number keeps the prefix and year', async () => { const y = new Date().getFullYear(); const t = await buyer(`/tenders/${upcoming.id}`, { method: 'PATCH', body: { number: '9042' } }); if (t.number !== `VB-${y}-9042`) throw new Error(t.number); await refused(() => buyer(`/tenders/${upcoming.id}`, { method: 'PATCH', body: { number: tender.number } }), /already in use/, 'duplicate number'); return t.number })

  /* ------------------------------------------- a bid without an account --- */
  const probe = await fetch(`${API}/api/tenders/${tender.number}/bids`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bidBody({ confirmed: false })) })
  const probed = await probe.json().catch(() => ({}))
  const OPEN = probe.status === 400 && /tick the confirmation/.test(probed.error || '')   // no captcha in front of us
  if (!OPEN && !/Captcha/i.test(probed.error || '')) throw new Error(`unexpected answer to a bid: ${probe.status} ${probed.error}`)
  let guest = null
  if (!OPEN) skip('bidding and registering without an account', 'the backend enforces the captcha; the supplier account is created directly instead')
  else {
    await step('a bid must say whether the payment terms are accepted', () => refused(() => pub(`/tenders/${tender.number}/bids`, { method: 'POST', body: bidBody({ accepts_terms: undefined }) }), /payment terms/, 'no answer'))
    await step('a bid needs a price', () => refused(() => pub(`/tenders/${tender.number}/bids`, { method: 'POST', body: bidBody({ price: 0 }) }), /proposed price/, 'no price'))
    await step('a bid needs a delivery date that is not in the past', () => refused(() => pub(`/tenders/${tender.number}/bids`, { method: 'POST', body: bidBody({ delivery_date: day(-2) }) }), /in the past/, 'past delivery'))
    await step('the honeypot swallows bots quietly', async () => { const r = await fetch(`${API}/api/tenders/${tender.number}/bids`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bidBody({ website: 'http://spam' })) }); if (r.status !== 202) throw new Error(r.status); return '202, nothing stored' })
    guest = await step('POST /api/tenders/:number/bids without an account', async () => {
      const r = await pub(`/tenders/${tender.number}/bids`, { method: 'POST', body: bidBody({ total: 1 }) })
      if (!r.id || !/^[0-9a-f]{48}$/.test(r.upload_token)) throw new Error(JSON.stringify(r))
      const b = await buyer(`/bids/${r.id}`)
      if (b.total !== 256000000 || b.status !== 'open' || b.currency !== 'NGN' || b.unit !== 'MT' || !b.supplier || b.supplier.source !== 'bid' || b.supplier.has_account || b.vs_asking !== -10000 || b.ip !== undefined || b.upload_token_hash !== undefined) throw new Error(JSON.stringify(b).slice(0, 300))
      return { ...r, supplier_id: b.supplier.id, summary: `#${r.id} · total ${b.total} (computed) · ${b.vs_asking} vs asking · supplier record started` }
    })
    if (DRY) await step('the supplier gets a confirmation, the team a notice (dry run)', async () => {
      const a = await mailTo(SUP.email, 'We received your bid%'), n = await mailTo('procurement@e2e.invalid', 'New bid from%')
      if (!a || a.scope !== 'procurement' || a.bid_id !== guest.id || a.supplier_id !== guest.supplier_id || !/640,000/.test(a.body)) throw new Error('ack: ' + JSON.stringify(a)?.slice(0, 200))
      if (!n || n.headers?.internal !== true || !/10,000\.00 below/.test(n.body)) throw new Error('notice: ' + JSON.stringify(n)?.slice(0, 200))
      return `"${a.subject}" · "${n.subject}"`
    })
    await step('a second bid from the same address is refused', () => refused(() => pub(`/tenders/${tender.number}/bids`, { method: 'POST', body: bidBody({ price: 600000 }) }), /already submitted/, 'duplicate bid'))
    await step('documents go in with the upload token', async () => { const d = await upload(`/api/bids/${guest.id}/files`, { headers: { 'X-Upload-Token': guest.upload_token } }, 'e2e-cac.pdf', 'application/pdf', PDF); if (d.name !== 'e2e-cac.pdf' || d.label !== 'CAC documents' || d.path !== undefined) throw new Error(JSON.stringify(d)); return `${d.name} · ${d.bytes} B · ${d.label}` })
    await step('a wrong upload token is refused', () => refused(() => pub(`/bids/${guest.id}/files`, { method: 'POST', headers: { 'X-Upload-Token': 'a'.repeat(48) }, body: { name: 'x.pdf', content_type: 'application/pdf', bytes: 10 } }), /^403/, 'bad token'))
    await step('a file type that is not allowed is refused', () => refused(() => pub(`/bids/${guest.id}/files`, { method: 'POST', headers: { 'X-Upload-Token': guest.upload_token }, body: { name: 'x.exe', content_type: 'application/x-msdownload', bytes: 10 } }), /not allowed/, 'exe'))
  }

  /* ---------------------------------------------------- supplier accounts --- */
  let sup = null        // { token, id } the first supplier, signed in
  if (OPEN && DRY) {
    await step('POST /api/supplier/register (same address as the bid)', async () => {
      await refused(() => pub('/supplier/register', { method: 'POST', body: { company_name: SUP.company, contact_person: 'Musa', phone: '1', email: SUP.email, password: 'short' } }), /at least 8/, 'weak password')
      const r = await pub('/supplier/register', { method: 'POST', body: { company_name: SUP.company, contact_person: 'Musa Abdullahi', phone: '+234 803 000 0000', email: SUP.email, address: 'ignored: the record has one', password: PASS } })
      if (!r.ok) throw new Error(JSON.stringify(r)); return 'confirmation email logged'
    })
    await step('registering twice is refused', () => refused(() => pub('/supplier/register', { method: 'POST', body: { company_name: 'x', contact_person: 'x', phone: '1', email: SUP.email, password: PASS } }), /already exists/, 'second account'))
    await step('no staff profile was made for the supplier', async () => { const { data: u } = await svc.from('suppliers').select('user_id').ilike('email', SUP.email).single(); const { data: p } = await svc.from('profiles').select('id').eq('id', u.user_id); if (p.length) throw new Error('a profile exists'); return 'not under Users ✓' })
    await step('before confirming, the account cannot be used', async () => {
      let t; try { t = await signIn(SUP.email, PASS) } catch (e) { if (/not confirmed/i.test(e.message)) return 'sign-in refused by Supabase ✓'; throw e }
      return refused(() => pub('/supplier/me', { token: t }), /confirm your email/, 'unverified')
    })
    const verify = await step('the confirmation link carries a one-time token', async () => { const m = await mailTo(SUP.email, 'Confirm your%'); const t = tokenIn(m, 'verify'); if (!t || m.headers?.internal !== true) throw new Error('no token in the email'); return { t, summary: 'hidden from conversations ✓' } })
    await step('POST /api/supplier/verify', async () => { const r = await pub('/supplier/verify', { method: 'POST', body: { token: verify.t } }); if (r.email !== SUP.email) throw new Error(JSON.stringify(r)); await refused(() => pub('/supplier/verify', { method: 'POST', body: { token: verify.t } }), /no longer valid/, 'second use'); return 'confirmed; the link works once' })
    await step('forgot → reset → sign in with the new password', async () => {
      await pub('/supplier/forgot', { method: 'POST', body: { email: SUP.email } })
      const t = tokenIn(await mailTo(SUP.email, 'Choose a new password%'), 'reset'); if (!t) throw new Error('no reset token')
      await refused(() => pub('/supplier/reset', { method: 'POST', body: { token: t, password: 'short' } }), /at least 8/, 'weak')
      await pub('/supplier/reset', { method: 'POST', body: { token: t, password: PASS + '2' } })
      await refused(() => pub('/supplier/reset', { method: 'POST', body: { token: t, password: PASS + '3' } }), /no longer valid/, 'second use')
      SUP.password = PASS + '2'; return 'ok'
    })
    await step('forgot answers the same for an unknown address', async () => { const r = await pub('/supplier/forgot', { method: 'POST', body: { email: `nobody-${RUN}@e2e.invalid` } }); if (!r.ok) throw new Error('leaks'); return 'no leak ✓' })
    sup = await step('the bid made before the account is in the dashboard', async () => {
      const token = await signIn(SUP.email, SUP.password); const me = await pub('/supplier/me', { token })
      if (me.counts.bids !== 1 || me.company_name !== SUP.company || me.address !== '12 Market Road, Kano' || me.notes !== undefined || me.status !== undefined) throw new Error(JSON.stringify(me))
      return { token, id: me.id, summary: `${me.company_name}: ${me.counts.bids} bid` }
    })
  } else {
    sup = await step('supplier account (created directly)', async () => {
      const { data, error } = await svc.auth.admin.createUser({ email: SUP.email, password: PASS, email_confirm: true, user_metadata: { account_type: 'supplier' } }); if (error) throw error
      await svc.from('profiles').delete().eq('id', data.user.id).eq('active', false)
      const { data: s, error: se } = await svc.from('suppliers').insert({ user_id: data.user.id, company_name: SUP.company, contact_person: 'Musa Abdullahi', email: SUP.email, phone: '+234 803 000 0000', address: '12 Market Road, Kano', source: 'signup', verified_at: new Date().toISOString() }).select().single(); if (se) throw se
      SUP.password = PASS; const token = await signIn(SUP.email, PASS)
      const r = await pub(`/tenders/${tender.number}/bids`, { method: 'POST', token, body: bidBody({ email: 'ignored@e2e.invalid' }) })
      guest = { id: r.id, supplier_id: s.id }
      return { token, id: s.id, summary: `#${s.id} with bid #${r.id}` }
    })
  }
  await step('a staff account is not a supplier account', () => refused(() => pub('/supplier/me', { token: staff.admin.token }), /not a supplier account/, 'staff as supplier'))
  await step('a supplier account cannot reach the panel', () => refused(() => call('/api/admin/me', { token: sup.token }), /^403/, 'supplier as staff'))

  /* ------------------------------------------------ a bid with an account --- */
  const sup2 = await step('a second supplier, account first', async () => {
    const { data, error } = await svc.auth.admin.createUser({ email: SUP2.email, password: PASS, email_confirm: true, user_metadata: { account_type: 'supplier' } }); if (error) throw error
    await svc.from('profiles').delete().eq('id', data.user.id).eq('active', false)
    const { data: s, error: se } = await svc.from('suppliers').insert({ user_id: data.user.id, company_name: SUP2.company, contact_person: 'Bisi Ade', email: SUP2.email, phone: '+234 805 000 0000', address: 'Ring Road, Ibadan', source: 'signup', verified_at: new Date().toISOString() }).select().single(); if (se) throw se
    return { token: await signIn(SUP2.email, PASS), id: s.id, summary: `#${s.id}` }
  })
  const bid2 = await step('POST /api/tenders/:number/bids signed in (profile fills the form)', async () => {
    const r = await pub(`/tenders/${tender.number}/bids`, { method: 'POST', token: sup2.token, body: { email: 'someone-else@e2e.invalid', quantity: 1000, price: 665000, commodity_location: 'Ibadan', delivery_date: day(20), accepts_terms: false, terms_note: '50% advance', confirmed: true } })
    if (!r.id || r.upload_token) throw new Error(JSON.stringify(r))
    const b = await pub(`/supplier/bids/${r.id}`, { token: sup2.token })
    if (b.email !== SUP2.email || b.company_name !== SUP2.company || b.total !== 665000000 || b.accepts_terms !== false || b.status !== 'open' || b.label !== 'Open' || b.internal_notes !== undefined || !b.tender || b.tender.number !== tender.number) throw new Error(JSON.stringify(b).slice(0, 300))
    return { id: r.id, summary: `#${r.id} · under ${b.email} · ${b.total} · does not accept the terms` }
  })
  await step('a supplier sees only their own bids', async () => { const l = await pub('/supplier/bids', { token: sup2.token }); if (l.length !== 1 || l[0].id !== bid2.id) throw new Error(l.length); await refused(() => pub(`/supplier/bids/${guest.id}`, { token: sup2.token }), /^404/, 'someone else\'s bid'); return '1 bid; the other supplier\'s is 404' })
  await step('supplier documents: upload, open, delete', async () => {
    const d = await upload(`/api/supplier/bids/${bid2.id}/files`, { token: sup2.token }, 'e2e-quality.pdf', 'application/pdf', PDF)
    const u = await pub(`/supplier/bids/${bid2.id}/files/${d.id}/url`, { token: sup2.token }); if (!/^https?:\/\//.test(u.url)) throw new Error('no url')
    await refused(() => pub(`/supplier/bids/${bid2.id}/files/${d.id}/url`, { token: sup.token }), /^404/, 'someone else\'s file')
    const d2 = await upload(`/api/supplier/bids/${bid2.id}/files`, { token: sup2.token }, 'e2e-extra.pdf', 'application/pdf', PDF)
    await pub(`/supplier/bids/${bid2.id}/files/${d2.id}`, { method: 'DELETE', token: sup2.token })
    const b = await pub(`/supplier/bids/${bid2.id}`, { token: sup2.token }); if (b.documents.length !== 1) throw new Error(b.documents.length + ' documents'); return '1 kept, 1 deleted'
  })
  await step('PATCH /api/supplier/me', async () => { const m = await pub('/supplier/me', { method: 'PATCH', token: sup2.token, body: { commodities: 'Soybeans, maize', status: 'blocked', notes: 'x', email: 'x@e2e.invalid' } }); if (m.commodities !== 'Soybeans, maize' || m.email !== SUP2.email) throw new Error(JSON.stringify(m)); return m.commodities })

  /* ------------------------------------------------- comparing the bids --- */
  await step('GET /tenders/:id lists and counts the bids', async () => { const t = await buyer(`/tenders/${tender.id}`); if (t.bids.length !== 2 || t.counts.total !== 2 || t.counts.open !== 2 || !/\/bidding\//.test(t.link)) throw new Error(JSON.stringify(t.counts)); return `${t.counts.total} bids · ${t.link}` })
  await step('GET /bids sorted by price, against the asking price', async () => {
    const l = await buyer(`/bids?tender_id=${tender.id}&sort=price`)
    if (l.length !== 2 || l[0].id !== guest.id || l[0].vs_asking !== -10000 || l[0].vs_asking_pct !== -1.5 || l[1].vs_asking !== 15000 || l[0].covers_pct !== 40 || l[1].covers_pct !== 100 || l[1].documents !== 1) throw new Error(JSON.stringify(l.map(b => [b.id, b.price, b.vs_asking, b.vs_asking_pct, b.covers_pct, b.documents])))
    return l.map(b => `${b.company_name.slice(4, 8)} ${b.price} (${b.vs_asking_pct}%) covers ${b.covers_pct}%`).join(' · ')
  })
  await step('filters: price, quantity, location, supplier, terms', async () => {
    const q = p => buyer(`/bids?tender_id=${tender.id}&${p}`).then(l => l.map(b => b.id).join())
    const got = [await q('max_price=650000'), await q('min_quantity=500'), await q('location=ibadan'), await q(`q=${encodeURIComponent('kano grains')}`), await q('accepts_terms=false'), await q('sort=quantity')]
    const want = [String(guest.id), String(bid2.id), String(bid2.id), String(guest.id), String(bid2.id), `${bid2.id},${guest.id}`]
    if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(JSON.stringify(got)); return '6 filters ✓'
  })
  await step('GET /tenders lists with bid counts and the lowest price', async () => { const l = await buyer('/tenders?q=e2e-Soybeans'); const t = l.find(x => x.id === tender.id); if (!t || t.bids.total !== 2 || t.lowest_price !== 640000) throw new Error(JSON.stringify(t)); return `lowest ${t.lowest_price}` })

  /* ------------------------------------------------------------ status --- */
  const N = DRY ? {} : { notify: false }
  await step('PATCH /bids/:id status=under_review (the supplier is told)', async () => {
    const b = await buyer(`/bids/${guest.id}`, { method: 'PATCH', body: { status: 'under_review', internal_notes: 'e2e internal', ...N } })
    if (b.status !== 'under_review' || b.label !== 'Under review' || b.notified !== DRY || !b.status_changed_at) throw new Error(JSON.stringify(b).slice(0, 200))
    if (DRY) { const m = await mailTo(SUP.email, 'Your bid for%'); if (!m || !/Under review/.test(m.subject) || !/now reviewing/.test(m.body) || m.bid_id !== guest.id) throw new Error('no status email') }
    const mine = await pub(`/supplier/bids/${guest.id}`, { token: sup.token }); if (mine.status !== 'under_review' || mine.internal_notes !== undefined) throw new Error('supplier view')
    return `${b.label}${DRY ? ' · email logged' : ''}`
  })
  await step('shortlisted, with a note the supplier reads', async () => {
    const b = await buyer(`/bids/${guest.id}`, { method: 'PATCH', body: { status: 'shortlisted', status_note: 'Keep the stock until the 20th.', ...N } })
    const mine = await pub(`/supplier/bids/${guest.id}`, { token: sup.token }); if (mine.status_note !== 'Keep the stock until the 20th.' || mine.label !== 'Shortlisted') throw new Error(JSON.stringify(mine).slice(0, 200))
    if (DRY) { const m = await mailTo(SUP.email, 'Your bid for%Shortlisted'); if (!m || !/Keep the stock/.test(m.body)) throw new Error('note not in the email') }
    return b.label
  })
  await step('only known statuses; only the supplier withdraws', async () => { await refused(() => buyer(`/bids/${guest.id}`, { method: 'PATCH', body: { status: 'lost' } }), /must be one of/, 'bad status'); return refused(() => buyer(`/bids/${guest.id}`, { method: 'PATCH', body: { status: 'withdrawn' } }), /Only the supplier/, 'staff withdraw') })

  /* ------------------------------------------ requests for information --- */
  const asked = await step('POST /bids/:id/requests', async () => {
    await refused(() => buyer(`/bids/${guest.id}/requests`, { method: 'POST', body: { question: ' ' } }), /what you need/, 'empty question')
    const b = await buyer(`/bids/${guest.id}/requests`, { method: 'POST', body: { question: 'Please confirm the bag size and upload the moisture analysis.', ...N } })
    if (b.requests.length !== 1 || b.requests[0].answered_at || b.notified !== DRY) throw new Error(JSON.stringify(b.requests))
    if (DRY) { const m = await mailTo(SUP.email, 'More information needed%'); if (!m || !/bag size/.test(m.body)) throw new Error('no request email') }
    return b.requests[0]
  })
  await step('the supplier sees it and answers', async () => {
    const me = await pub('/supplier/me', { token: sup.token }); if (me.counts.requests_open !== 1) throw new Error('open requests ' + me.counts.requests_open)
    await refused(() => pub(`/supplier/bids/${bid2.id}/requests/${asked.id}/answer`, { method: 'POST', token: sup2.token, body: { answer: 'not mine' } }), /^404/, 'someone else\'s request')
    const b = await pub(`/supplier/bids/${guest.id}/requests/${asked.id}/answer`, { method: 'POST', token: sup.token, body: { answer: '100 kg jute bags. Analysis uploaded.' } })
    if (b.requests[0].answer !== '100 kg jute bags. Analysis uploaded.' || !b.requests[0].answered_at) throw new Error(JSON.stringify(b.requests))
    const a = await buyer(`/bids/${guest.id}`); if (!a.requests[0].answered_at) throw new Error('panel'); const l = await buyer(`/bids?tender_id=${tender.id}`); if (l.find(x => x.id === guest.id).requests_open !== 0) throw new Error('still open')
    if (DRY) { const m = await mailTo('procurement@e2e.invalid', '%answered a request%'); if (!m || !/jute bags/.test(m.body)) throw new Error('team not told') }
    return 'answered' + (DRY ? ' · team notified' : '')
  })

  /* -------------------------------------- writing to the shortlisted --- */
  if (DRY) await step('POST /tenders/:id/message to the shortlisted suppliers', async () => {
    const r = await buyer(`/tenders/${tender.id}/message`, { method: 'POST', body: { statuses: ['shortlisted'], subject: 'e2e-Site visit for {{tender_number}}', body: 'Dear {{name}},\n\nWe would like to inspect the stock of {{supplier_name}}.' } })
    if (r.sent.length !== 1 || r.failed.length) throw new Error(JSON.stringify(r))
    const m = await mailTo(SUP.email, 'e2e-Site visit%'); if (!m || m.subject !== `e2e-Site visit for ${tender.number}` || !/Dear Musa Abdullahi/.test(m.body) || !m.body.includes(SUP.company) || m.supplier_id !== sup.id) throw new Error(JSON.stringify(m)?.slice(0, 200))
    return `1 email, addressed by name`
  }); else skip('writing to the shortlisted suppliers', 'it would send a real email')

  /* ------------------------------------------------------------- award --- */
  await step('awarding a bid marks the opportunity awarded', async () => {
    const b = await buyer(`/bids/${guest.id}`, { method: 'PATCH', body: { status: 'awarded', ...N } }); if (b.status !== 'awarded') throw new Error(b.status)
    const t = await buyer(`/tenders/${tender.id}`); if (t.status !== 'awarded' || t.counts.awarded !== 1) throw new Error(t.status)
    const p = await pub(`/tenders/${tender.number}`); if (p.state !== 'awarded' || p.accepting_bids) throw new Error('public ' + p.state)
    await refused(() => pub(`/tenders/${tender.number}/bids`, { method: 'POST', token: sup2.token, body: { quantity: 1, price: 1, commodity_location: 'x', delivery_date: day(5), accepts_terms: true, confirmed: true } }), /closed for bids/, 'bid after award')
    return 'awarded · closed for bids'
  })
  await step('POST /tenders/:id/close-out: the rest are not selected', async () => {
    const r = await buyer(`/tenders/${tender.id}/close-out`, { method: 'POST', body: { note: 'Thank you for bidding.', ...N } }); if (r.changed !== 1 || r.notified !== (DRY ? 1 : 0)) throw new Error(JSON.stringify(r).slice(0, 120))
    const mine = await pub(`/supplier/bids/${bid2.id}`, { token: sup2.token }); if (mine.status !== 'not_selected' || mine.can_withdraw || mine.status_note !== 'Thank you for bidding.') throw new Error(JSON.stringify(mine).slice(0, 200))
    await refused(() => pub(`/supplier/bids/${bid2.id}/withdraw`, { method: 'POST', token: sup2.token }), /no longer be withdrawn/, 'withdraw after decision')
    return `${r.changed} bid closed out`
  })
  await step('taking the award back reopens nothing, but closes the opportunity', async () => { await buyer(`/bids/${guest.id}`, { method: 'PATCH', body: { status: 'shortlisted', notify: false } }); const t = await buyer(`/tenders/${tender.id}`); if (t.status !== 'closed') throw new Error(t.status); await buyer(`/bids/${guest.id}`, { method: 'PATCH', body: { status: 'awarded', notify: false } }); return (await buyer(`/tenders/${tender.id}`)).status })

  /* --------------------------------------------------- withdraw a bid --- */
  await step('a supplier withdraws a live bid and may bid again', async () => {
    const t = await buyer('/tenders', { method: 'POST', body: { title: 'e2e-Cocoa supply opportunity', commodity: 'Cocoa', quantity: 50, asking_price: 4000000, closes_at: inHours(48), status: 'published' } })
    const body = { quantity: 50, price: 3900000, commodity_location: 'Ondo', delivery_date: day(10), accepts_terms: true, confirmed: true }
    const a = await pub(`/tenders/${t.number}/bids`, { method: 'POST', token: sup2.token, body })
    await refused(() => pub(`/tenders/${t.number}/bids`, { method: 'POST', token: sup2.token, body }), /already submitted/, 'twice')
    const w = await pub(`/supplier/bids/${a.id}/withdraw`, { method: 'POST', token: sup2.token }); if (w.status !== 'withdrawn') throw new Error(w.status)
    await refused(() => buyer(`/bids/${a.id}`, { method: 'PATCH', body: { status: 'under_review' } }), /withdrawn by the supplier/, 'revive')
    const b = await pub(`/tenders/${t.number}/bids`, { method: 'POST', token: sup2.token, body: { ...body, price: 3850000 } })
    await refused(() => buyer(`/tenders/${t.id}`, { method: 'DELETE' }), /Cancel it instead/, 'delete with bids')
    await buyer(`/bids/${a.id}`, { method: 'DELETE' }); await buyer(`/bids/${b.id}`, { method: 'DELETE' })
    return (await buyer(`/tenders/${t.id}`, { method: 'DELETE' })).deleted ? 'withdrawn → bid again → cleaned up' : 'not deleted'
  })

  /* --------------------------------------------------- purchase orders --- */
  const order = await step('POST /purchase-orders from the awarded bid (LPO)', async () => {
    const o = await buyer('/purchase-orders', { method: 'POST', body: { bid_id: guest.id, tax_rate: 7.5 } })
    if (!/^LPO-\d{4}-\d{4,6}$/.test(o.number) || o.kind !== 'lpo' || o.status !== 'draft' || o.supplier_id !== sup.id || o.supplier_name !== SUP.company || o.supplier_email !== SUP.email || o.items.length !== 1 || o.items[0].quantity !== 400 || o.items[0].unit_price !== 640000 || o.subtotal !== 256000000 || o.total !== 275200000 || o.currency !== 'NGN' || o.delivery_location !== 'Ibadan, Oyo State' || !/Payment on delivery/.test(o.payment_terms) || !o.title.includes(tender.number) || !/\/po\//.test(o.link)) throw new Error(JSON.stringify(o).slice(0, 400))
    return o
  })
  await step('PATCH kind → PO takes the other prefix; and back', async () => { const o = await buyer(`/purchase-orders/${order.id}`, { method: 'PATCH', body: { kind: 'po' } }); if (!/^PO-\d{4}-\d{4,6}$/.test(o.number)) throw new Error(o.number); const back = await buyer(`/purchase-orders/${order.id}`, { method: 'PATCH', body: { kind: 'lpo', number: order.number.split('-')[2], title: 'e2e-' + order.title } }); if (back.number !== order.number) throw new Error(back.number); return `${o.number} → ${back.number}` })
  await step('a standalone PO for a supplier typed by hand', async () => {
    await refused(() => buyer('/purchase-orders', { method: 'POST', body: { kind: 'po', items: [{ description: 'x', quantity: 1, unit_price: 1 }] } }), /choose a supplier/, 'no supplier')
    const o = await buyer('/purchase-orders', { method: 'POST', body: { kind: 'po', supplier_name: 'e2e-Walk-in Supplier', title: 'e2e-bags', items: [{ description: 'Jute bags', quantity: 1000, unit: 'pcs', unit_price: 850 }], discount: 50000 } })
    if (!/^PO-/.test(o.number) || o.total !== 800000 || o.supplier_id !== null) throw new Error(JSON.stringify(o).slice(0, 200))
    return (await buyer(`/purchase-orders/${o.id}`, { method: 'DELETE' })).deleted && o.number
  })
  await step('GET /purchase-orders/:id/pdf is a PDF', async () => { const r = await fetch(`${API}/api/admin/purchase-orders/${order.id}/pdf`, { headers: { Authorization: `Bearer ${staff.buyer.token}` } }); const b = Buffer.from(await r.arrayBuffer()); if (r.status !== 200 || b.subarray(0, 4).toString() !== '%PDF') throw new Error(r.status); return `${b.length} bytes` })
  await step('a draft order cannot be answered yet', async () => { const r = await fetch(`${API}/api/po/${order.token}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'acknowledge' }) }); if (r.status !== 409) throw new Error(r.status); return '409 ✓' })
  if (DRY) await step('POST /purchase-orders/:id/send (dry run: PDF attached and filed, → issued)', async () => {
    const r = await buyer(`/purchase-orders/${order.id}/send`, { method: 'POST', body: {} })
    if (r.order.status !== 'issued' || !r.order.issued_at || r.message.status !== 'sent' || r.message.scope !== 'procurement' || r.message.po_id !== order.id || r.message.supplier_id !== sup.id || !r.message.attachments.some(a => a.name === `${order.number}.pdf` && a.document_id)) throw new Error(JSON.stringify(r).slice(0, 300))
    const docs = await buyer(`/documents?supplier_id=${sup.id}`); const d = docs.find(x => x.name === `${order.number}.pdf`); if (!d) throw new Error('PDF not under the supplier'); paths.push(d.path)
    return `"${r.message.subject}" · PDF filed under the supplier`
  })
  else await step('PATCH /purchase-orders/:id status=issued (manual; sending would email)', async () => (await buyer(`/purchase-orders/${order.id}`, { method: 'PATCH', body: { status: 'issued' } })).status)
  await step('the supplier opens the link, downloads, acknowledges', async () => {
    const v = await pub(`/po/${order.token}`); if (v.status !== 'issued' || v.kind_label !== 'Local Purchase Order' || v.internal_notes !== undefined || v.token !== undefined || v.supplier_email !== undefined || !v.company?.name) throw new Error(JSON.stringify(v).slice(0, 300))
    const seen = await buyer(`/purchase-orders/${order.id}`); if (!seen.viewed_at) throw new Error('not marked viewed')
    const p = await fetch(`${API}/api/po/${order.token}/pdf?download=1`); if (p.status !== 200 || !/pdf/.test(p.headers.get('content-type')) || !/attachment/.test(p.headers.get('content-disposition'))) throw new Error('pdf ' + p.status)
    await (DRY ? Promise.resolve() : admin('/settings', { method: 'PUT', body: { procurement: { notify_bids: false } } }))
    const a = await pub(`/po/${order.token}/respond`, { method: 'POST', body: { action: 'acknowledge', note: 'e2e loading starts Monday' } }); if (a.status !== 'acknowledged') throw new Error(a.status)
    await refused(() => pub(`/po/${order.token}/respond`, { method: 'POST', body: { action: 'decline' } }), /already been answered/, 'second answer')
    if (DRY) { const m = await mailTo('procurement@e2e.invalid', '%acknowledged%'); if (!m || !m.subject.includes(order.number)) throw new Error('team not told') }
    return 'viewed → acknowledged' + (DRY ? ' · team notified' : '')
  })
  await step('an acknowledged order is locked', async () => { await refused(() => buyer(`/purchase-orders/${order.id}`, { method: 'PATCH', body: { discount: 1 } }), /locked/, 'edit'); await refused(() => buyer(`/purchase-orders/${order.id}`, { method: 'DELETE' }), /Cancel it instead/, 'delete'); return (await buyer(`/purchase-orders/${order.id}`, { method: 'PATCH', body: { internal_notes: 'e2e ok', status: 'fulfilled' } })).status })
  await step('the order is in the supplier\'s dashboard and on the bid', async () => {
    const l = await pub('/supplier/orders', { token: sup.token }); if (l.length !== 1 || l[0].number !== order.number || l[0].token !== order.token || l[0].internal_notes !== undefined) throw new Error(JSON.stringify(l))
    const b = await pub(`/supplier/bids/${guest.id}`, { token: sup.token }); if (b.orders?.[0]?.number !== order.number) throw new Error('not on the bid')
    if ((await pub('/supplier/orders', { token: sup2.token })).length) throw new Error('the other supplier sees it')
    return `${l[0].kind_label} ${l[0].number} · ${l[0].status}`
  })
  await step('GET /purchase-orders filters', async () => { const [a, b, c] = await Promise.all([buyer(`/purchase-orders?supplier_id=${sup.id}`), buyer('/purchase-orders?kind=po&status=fulfilled'), buyer(`/purchase-orders?tender_id=${tender.id}`)]); if (a.length !== 1 || b.some(o => o.id === order.id) || c.length !== 1) throw new Error([a.length, b.length, c.length].join()); return 'supplier, kind, opportunity ✓' })

  /* -------------------------------------------------------- suppliers --- */
  await step('GET /suppliers and /suppliers/:id', async () => {
    const l = await buyer(`/suppliers?q=${encodeURIComponent('e2e-')}`); const a = l.find(s => s.id === sup.id)
    if (!a || a.bids !== 1 || a.awarded !== 1 || !a.has_account || a.auth_token_hash !== undefined) throw new Error(JSON.stringify(a))
    const d = await buyer(`/suppliers/${sup.id}`); if (d.bids.length !== 1 || d.orders.length !== 1 || d.account?.email !== SUP.email) throw new Error(JSON.stringify(d).slice(0, 200))
    return `${l.length} matching · ${a.company_name}: ${a.bids} bid, ${a.awarded} awarded, account ✓`
  })
  const manual = await step('POST /suppliers by hand; the email is unique', async () => {
    await refused(() => buyer('/suppliers', { method: 'POST', body: { company_name: '' } }), /company name/, 'no name')
    const s = await buyer('/suppliers', { method: 'POST', body: { company_name: `e2e-Manual Supplier ${RUN}`, email: `E2E-Manual-${RUN}@e2e.invalid`, notes: 'met at the fair' } })
    if (s.email !== `e2e-manual-${RUN}@e2e.invalid` || s.source !== 'admin' || s.has_account) throw new Error(JSON.stringify(s))
    await refused(() => buyer('/suppliers', { method: 'POST', body: { company_name: 'e2e-dup', email: s.email } }), /already exists/, 'duplicate email')
    return s
  })
  await step('PATCH /suppliers/:id; an account\'s sign-in address is fixed', async () => { const s = await buyer(`/suppliers/${manual.id}`, { method: 'PATCH', body: { phone: '0800', status: 'archived' } }); if (s.phone !== '0800' || s.status !== 'archived') throw new Error(JSON.stringify(s)); return refused(() => buyer(`/suppliers/${sup.id}`, { method: 'PATCH', body: { email: 'other@e2e.invalid' } }), /signs in with/, 'change sign-in email') })
  await step('a blocked supplier is locked out', async () => { await buyer(`/suppliers/${sup2.id}`, { method: 'PATCH', body: { status: 'blocked' } }); await refused(() => pub('/supplier/me', { token: sup2.token }), /suspended/, 'blocked'); await buyer(`/suppliers/${sup2.id}`, { method: 'PATCH', body: { status: 'active' } }); return (await pub('/supplier/me', { token: sup2.token })).company_name && 'blocked → 403 → restored' })
  await step('DELETE /suppliers/:id: refused with orders, fine without', async () => { await refused(() => buyer(`/suppliers/${sup.id}`, { method: 'DELETE' }), /Archive the supplier/, 'delete with orders'); return (await buyer(`/suppliers/${manual.id}`, { method: 'DELETE' })).deleted })

  /* -------------------------------------------------------- documents --- */
  await step('documents: each side handles its own', async () => {
    const mine = await buyer(`/documents?bid_id=${guest.id}`)
    await refused(() => sales(`/documents?supplier_id=${sup.id}`), /^403/, 'sales → supplier files')
    await refused(() => buyer('/documents'), /^403/, 'procurement → client files')
    if (mine.length) { await refused(() => sales(`/documents/${mine[0].id}/url`), /^403/, 'sales → a supplier file'); const u = await buyer(`/documents/${mine[0].id}/url`); if (!u.url) throw new Error('no url') }
    const all = await sales('/documents'); if (all.some(d => d.supplier_id != null || d.bid_id != null)) throw new Error('supplier files in the sales list')
    return `${mine.length} on the bid · gated both ways`
  })

  /* ------------------------------------------------------------ inbox --- */
  if (DRY) {
    const sent = await step('POST /procurement/messages to a supplier', async () => {
      const m = await buyer('/procurement/messages', { method: 'POST', body: { supplier_id: sup.id, to: SUP.email, subject: 'e2e-Loading schedule', body: 'Dear Musa,\n\nWhen can loading start?' } })
      if (m.scope !== 'procurement' || m.supplier_id !== sup.id || m.client_id !== null || m.thread_key !== `s${sup.id}|e2e-loading schedule`) throw new Error(JSON.stringify(m).slice(0, 300))
      return m
    })
    await step('it is in the procurement inbox, not in sales', async () => {
      const p = await buyer('/procurement/messages/threads'); const t = p.find(x => x.key === sent.thread_key)
      if (!t || t.name !== SUP.company || t.supplier_id !== sup.id || !t.awaiting_reply) throw new Error(JSON.stringify(t))
      if (p.some(x => /Confirm your|Choose a new password|New bid from/.test(x.subject))) throw new Error('account links or team notices are listed')
      const s = await admin('/messages/threads'); if (s.some(x => x.key === sent.thread_key || x.email === SUP.email)) throw new Error('listed under sales')
      await refused(() => admin(`/messages/${sent.id}`), /^404/, 'sales route, procurement message')
      await refused(() => admin(`/messages/thread?key=${encodeURIComponent(sent.thread_key)}`), /^404/, 'sales route, supplier thread')
      const rows = await buyer(`/procurement/messages/thread?key=${encodeURIComponent(sent.thread_key)}`); if (rows.length !== 1) throw new Error(rows.length + ' rows')
      return `${p.length} procurement threads, incl. the bid's automatic emails`
    })
    const { data: sec } = await svc.from('settings').select('value').eq('key', 'secrets').maybeSingle(); secretWas = sec?.value?.resend_webhook_secret ?? null
    const whsec = 'whsec_' + Buffer.from('e2e-proc-webhook-' + RUN).toString('base64')
    secretTouched = true
    await admin('/settings/secrets/resend_webhook_secret', { method: 'PUT', body: { value: whsec } })
    const hook = async data => { const body = JSON.stringify({ type: 'email.received', created_at: new Date().toISOString(), data }); const id = 'msg_' + Math.random().toString(36).slice(2), ts = Math.floor(Date.now() / 1000); const sig = createHmac('sha256', Buffer.from(whsec.slice(6), 'base64')).update(`${id}.${ts}.${body}`).digest('base64'); const r = await fetch(`${API}/api/webhooks/resend`, { method: 'POST', headers: { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': 'v1,' + sig, 'Content-Type': 'application/json' }, body }); if (!r.ok) throw new Error('webhook ' + r.status); return r.json() }
    await step('the supplier\'s reply lands in the procurement inbox', async () => {
      const before = await admin('/stats')
      const r = await hook({ email_id: `e2e-proc-${RUN}`, from: `Musa Abdullahi <${SUP.email}>`, to: ['sales@reply.vertocagro.com'], subject: 'Re: e2e-Loading schedule', text: 'Monday morning.\n\nOn Mon, 28 Sep 2026 Vertoc wrote:\n> When can loading start?', headers: { 'in-reply-to': sent.provider_message_id } })
      const m = await buyer(`/procurement/messages/${r.id}`); if (m.scope !== 'procurement' || m.supplier_id !== sup.id || m.client_id !== null) throw new Error(JSON.stringify(m).slice(0, 200))
      const t = (await buyer('/procurement/messages/threads?unread=1')).find(x => x.key === sent.thread_key); if (!t || t.unread !== 1 || t.count !== 2 || t.awaiting_reply) throw new Error(JSON.stringify(t))
      const after = await admin('/stats'); if (after.procUnread !== before.procUnread + 1 || after.inboundUnread !== before.inboundUnread) throw new Error(`procUnread ${before.procUnread}→${after.procUnread}, sales ${before.inboundUnread}→${after.inboundUnread}`)
      const rows = await buyer(`/procurement/messages/thread?key=${encodeURIComponent(sent.thread_key)}`); if (rows[1].text !== 'Monday morning.' || !rows[1].quoted) throw new Error('quoted history not folded')
      await buyer('/procurement/messages/thread/read', { method: 'POST', body: { key: sent.thread_key } }); if ((await admin('/stats')).procUnread !== before.procUnread) throw new Error('still unread')
      return 'threaded under the supplier · counted apart from sales · read'
    })
    await step('a reply keeps the thread; an order number files mail under the order', async () => {
      const r = await buyer('/procurement/messages', { method: 'POST', body: { reply_to_id: sent.id, body: 'Thank you, see you Monday.' } }); if (r.thread_key !== sent.thread_key || r.subject !== 'Re: e2e-Loading schedule' || r.to_email !== SUP.email) throw new Error(JSON.stringify(r).slice(0, 200))
      const h2 = await hook({ email_id: `e2e-proc-${RUN}-b`, from: `Stranger <e2e-stranger-${RUN}@e2e.invalid>`, to: ['sales@reply.vertocagro.com'], subject: `e2e-Question about ${order.number}`, text: 'Which gate?' })
      const m = await buyer(`/procurement/messages/${h2.id}`); if (m.po_id !== order.id || m.supplier_id !== sup.id) throw new Error(JSON.stringify(m).slice(0, 200))
      return 'reply threaded · order mail linked'
    })
    await step('label a procurement thread', async () => { const l = await buyer('/procurement/messages/thread/label', { method: 'PUT', body: { key: sent.thread_key, label: 'On hold' } }); if (l.label?.name !== 'On hold') throw new Error(JSON.stringify(l)); await buyer('/procurement/messages/thread/label', { method: 'PUT', body: { key: sent.thread_key, label: '' } }); return 'On hold → cleared' })
    await step('GET /procurement/templates/:key/render', async () => { const r = await buyer(`/procurement/templates/supplier_blank/render?bid_id=${guest.id}`); if (!/Dear Musa Abdullahi/.test(r.body)) throw new Error(r.body); await refused(() => buyer('/procurement/templates/quote/render'), /^404/, 'a sales template'); return r.body.split('\n')[0] })
  } else skip('procurement inbox: send, receive, thread', 'it would send a real email; read-only checks ran')
  await step('GET /stats and /procurement/overview', async () => { const [s, o] = await Promise.all([admin('/stats'), buyer('/procurement/overview')]); for (const k of ['tendersOpen', 'bidsNew', 'suppliers', 'ordersOpen', 'procUnread', 'inboundUnread']) if (typeof s[k] !== 'number') throw new Error('missing ' + k); if (!Array.isArray(o.open) || !Array.isArray(o.recent_bids)) throw new Error('overview'); return `open ${s.tendersOpen} · new bids ${s.bidsNew} · suppliers ${s.suppliers} · orders out ${s.ordersOpen}` })
  await step('the audit log names who did what', async () => { const rows = (await admin('/audit?limit=300')).filter(r => [staff.buyer.email, 'supplier'].includes(r.actor_label) && ['tender', 'bid', 'supplier', 'purchase_order'].includes(r.entity)); const acts = [...new Set(rows.map(r => `${r.entity}:${r.action}`))]; for (const a of ['tender:create', 'bid:create', 'bid:status', 'purchase_order:create', 'purchase_order:acknowledged']) if (!acts.includes(a)) throw new Error('missing ' + a + ' in ' + acts.join(', ')); return `${rows.length} rows, ${acts.length} kinds` })
} catch (e) {
  if (!results.some(r => r[0] === '✗')) results.push(['✗', 'unexpected', e.message])
} finally {
  const quiet = p => p.then(() => {}, () => {})
  const ids = async (table, col, pattern) => ((await svc.from(table).select('id').ilike(col, pattern)).data || []).map(r => r.id)
  const tids = await ids('tenders', 'title', 'e2e-%').catch(() => [])
  const sids = await ids('suppliers', 'company_name', 'e2e-%').catch(() => [])
  const { data: docs } = await svc.from('documents').select('path').or(`supplier_id.in.(${sids.join(',') || 0}),name.ilike.e2e-%`).then(r => r, () => ({ data: [] }))
  const all = [...new Set([...paths, ...(docs || []).map(d => d.path)])]
  if (all.length) await quiet(svc.storage.from('documents').remove(all))
  await quiet(svc.from('messages').delete().like('to_email', '%@e2e.invalid'))
  await quiet(svc.from('messages').delete().like('from_email', '%@e2e.invalid'))
  await quiet(svc.from('purchase_orders').delete().or('title.ilike.e2e-%,supplier_name.ilike.e2e-%'))
  if (tids.length) await quiet(svc.from('tenders').delete().in('id', tids))          // bids and their requests go with them
  await quiet(svc.from('documents').delete().like('name', 'e2e-%'))
  if (sids.length) await quiet(svc.from('suppliers').delete().in('id', sids))
  await quiet(svc.from('audit_log').delete().eq('actor_label', 'supplier').or('after->>email.ilike.%@e2e.invalid,after->>supplier.ilike.e2e-%,before->>company_name.ilike.e2e-%,after->>number.ilike.%PO-%'))
  if (settingsBefore !== undefined) await quiet(settingsBefore ? svc.from('settings').upsert({ key: 'procurement', value: settingsBefore }, { onConflict: 'key' }) : svc.from('settings').delete().eq('key', 'procurement'))
  if (secretTouched) {   // put the webhook secret back exactly as it was
    const { data: sec } = await svc.from('settings').select('value').eq('key', 'secrets').maybeSingle()
    const v = { ...(sec?.value || {}) }; if (secretWas) v.resend_webhook_secret = secretWas; else delete v.resend_webhook_secret
    await quiet(svc.from('settings').upsert({ key: 'secrets', value: v }, { onConflict: 'key' }))
  }
  const { data: u } = await svc.auth.admin.listUsers({ perPage: 1000 })
  for (const x of (u?.users || []).filter(x => x.email?.endsWith(`-${RUN}@vertocagro.invalid`) || x.email?.endsWith(`-${RUN}@e2e.invalid`))) {
    await quiet(svc.from('audit_log').delete().eq('actor_id', x.id)); await quiet(svc.from('audit_log').delete().eq('actor_label', x.email))
    await svc.auth.admin.deleteUser(x.id).catch(() => {})
  }
  console.log()
  for (const [s, n, v] of results) console.log(` ${s} ${n.padEnd(58)} ${v}`)
  const failed = results.filter(r => r[0] === '✗').length
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED — test accounts, suppliers, opportunities, bids, orders and files removed')
  process.exit(failed ? 1 : 0)
}
