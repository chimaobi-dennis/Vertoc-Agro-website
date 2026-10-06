/*
 * End-to-end test of what migration 015 adds, against a running backend:
 * roles and permissions (built-in, custom, per person), the client portal
 * (registration, invoices, payments with receipts), and the investment
 * portal (opportunities, applications, approval, payouts). Removes
 * everything it created, even if a step fails.
 *
 *   node server/test-portals.mjs       (backend on :8787)
 *
 * Never emails anyone. The portal steps register accounts, which sends a
 * confirmation link: they run only where the backend has EMAIL_DRY_RUN=1
 * (emails are logged, never sent) and no captcha. Against a live backend
 * only the roles-and-permissions steps run; none of them sends anything.
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
const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, noSession)
const anonClient = () => createClient(SUPABASE_URL, ANON, noSession)

const RUN = Date.now()
const PASS = 'E2e-Test-Passw0rd!'
// role = the old enum column, key = the role of the permission table
const staff = {
  boss: { email: `e2e-port-super-${RUN}@vertocagro.invalid`, role: 'admin', key: 'super_admin' },
  fin: { email: `e2e-port-finance-${RUN}@vertocagro.invalid`, role: 'editor', key: 'finance' },
  inv: { email: `e2e-port-invest-${RUN}@vertocagro.invalid`, role: 'editor', key: 'investment' },
  temp: { email: `e2e-port-temp-${RUN}@vertocagro.invalid`, role: 'editor', key: 'editor' },
}
const CLIENT = { email: `e2e-client-${RUN}@e2e.invalid`, company: `e2e-Rotterdam Foods ${RUN}` }
const INVESTOR = { email: `e2e-investor-${RUN}@e2e.invalid`, name: `e2e-Ada Investor ${RUN}` }
const results = []
const paths = []
let roleKey = null, clientId = null, investorId = null, oppId = null, quoteId = null

const show = v => (v && typeof v === 'object' ? (v.summary ?? v.number ?? (v.id != null ? `#${v.id}` : JSON.stringify(v).slice(0, 80))) : (v ?? ''))
const step = async (name, fn) => { try { const v = await fn(); results.push(['✓', name, show(v)]); return v } catch (e) { results.push(['✗', name, e.message]); throw e } }
const skip = (name, why) => results.push(['·', name, `SKIPPED — ${why}`])
const call = async (url, { method = 'GET', body, token } = {}) => {
  const r = await fetch(`${API}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(`${r.status} ${d.error || ''}`.trim()), { status: r.status, code: d.code })
  return d
}
const as = who => (path, o = {}) => call(`/api/admin${path}`, { ...o, token: staff[who].token })
const boss = as('boss'), fin = as('fin'), inv = as('inv'), temp = as('temp')
const pub = (path, o = {}) => call(`/api${path}`, o)
const refused = async (fn, re, label) => { try { await fn() } catch (e) { if (re.test(e.message)) return e.message.slice(0, 3) + ' ✓'; throw e } throw new Error(`was allowed (${label})`) }
const day = d => new Date(Date.now() + d * 86400e3).toISOString().slice(0, 10)
const mailTo = async (to, like) => (await svc.from('messages').select('*').eq('to_email', to).ilike('subject', like).order('id', { ascending: false }).limit(1)).data?.[0] ?? null
const tokenIn = (m, portal, page) => (String(m?.html || '').match(new RegExp(`/${portal}/${page}\\?token=([0-9a-f]{64})`)) || [])[1]
const signIn = async (email, password) => { const { data, error } = await anonClient().auth.signInWithPassword({ email, password }); if (error) throw error; return data.session.access_token }
const upload = async (startUrl, token, name, extra = {}) => {
  const bytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
  const s = await call(startUrl, { token, method: 'POST', body: { name, content_type: 'application/pdf', bytes: bytes.length, ...extra } })
  paths.push(s.upload.path)
  const { error } = await anonClient().storage.from('documents').uploadToSignedUrl(s.upload.path, s.upload.token, new Blob([bytes], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false })
  if (error) throw new Error('storage: ' + error.message)
  return call(`${startUrl}/${s.document.id}/complete`, { token, method: 'POST' })
}

try {
  /* ------------------------------------------------------------ setup --- */
  await step('four staff accounts: super admin, finance, investment, editor', async () => {
    for (const s of Object.values(staff)) {
      const { data, error } = await svc.auth.admin.createUser({ email: s.email, password: PASS, email_confirm: true }); if (error) throw error
      s.id = data.user.id
      const { error: pe } = await svc.from('profiles').upsert({ id: s.id, email: s.email, name: `E2E ${s.key}`, role: s.role, role_key: s.key, active: true }, { onConflict: 'id' })
      if (pe) throw new Error(/role_key/.test(pe.message) ? 'migration 015 is not applied: run server/migrations/015_portals_permissions.sql' : pe.message)
      s.token = await signIn(s.email, PASS)
    }
    return Object.values(staff).map(s => s.key).join(', ')
  })
  const S = await boss('/settings')
  const DRY = Boolean(S.email.dry_run)

  /* -------------------------------------------- roles and permissions --- */
  await step('GET /me carries the role and what it may do', async () => {
    const m = await fin('/me'); if (m.role_key !== 'finance' || m.role_name !== 'Finance' || !m.can.payments.includes('approve') || m.can.bidding || !m.permissions.payments || m.permissions.bidding) throw new Error(JSON.stringify({ k: m.role_key, p: m.permissions }))
    const b = await boss('/me'); if (!b.can.staff.includes('manage') || !b.can.bidding.includes('unlock')) throw new Error('super admin lacks something')
    return `finance: ${Object.keys(m.can).join(', ')}`
  })
  await step('each role reaches its own modules only', async () => {
    await fin('/payments'); await fin('/reports'); await inv('/investments')
    await refused(() => fin('/tenders'), /^403/, 'finance opens bidding')
    await refused(() => fin('/users'), /^403/, 'finance opens staff')
    await refused(() => inv('/payments'), /^403/, 'investment opens payments')
    await refused(() => temp('/investments'), /^403/, 'editor opens investments')
    await refused(() => fin('/investment-opportunities', { method: 'POST', body: { title: 'x', min_amount: 1, tenor_months: 1 } }), /^403/, 'finance creates an opportunity')
    return 'finance: payments, reports · investment: investments · everything else 403'
  })
  const roles = await step('GET /roles: the table of modules, actions and built-in roles', async () => {
    const r = await boss('/roles'); const keys = r.roles.filter(x => x.system).map(x => x.key)
    for (const k of ['super_admin', 'admin', 'procurement', 'finance', 'logistics', 'investment']) if (!keys.includes(k)) throw new Error('missing ' + k)
    for (const m of ['staff', 'suppliers', 'clients', 'bidding', 'purchase_orders', 'invoices', 'shipments', 'investments', 'payments', 'reports', 'audit', 'settings']) if (!r.modules.some(x => x.key === m)) throw new Error('no module ' + m)
    for (const a of ['view', 'create', 'edit', 'approve', 'delete', 'export', 'award', 'unlock', 'manage']) if (!r.actions.some(x => x.key === a)) throw new Error('no action ' + a)
    if (!r.roles.find(x => x.key === 'admin').permissions.staff.includes('manage')) throw new Error('admin cannot manage staff')
    return { summary: `${r.modules.length} modules × ${r.actions.length} actions · ${keys.length} built-in roles`, ...r }
  })
  await step('a custom role: created, given to someone, enforced, edited', async () => {
    await refused(() => fin('/roles', { method: 'POST', body: { name: 'x' } }), /^403/, 'finance creates a role')
    await refused(() => boss('/roles/finance', { method: 'PATCH', body: { name: 'x' } }), /Built-in/, 'edit a built-in role')
    const r = await boss('/roles', { method: 'POST', body: { name: `e2e Warehouse ${RUN}`, description: 'Receives trucks', permissions: { shipments: ['approve'], bogus: ['view'], payments: ['fly'] } } })
    roleKey = r.key
    if (JSON.stringify(r.permissions) !== JSON.stringify({ shipments: ['view', 'approve'] })) throw new Error('permissions not cleaned: ' + JSON.stringify(r.permissions))
    await refused(() => boss('/roles', { method: 'POST', body: { name: `e2e Warehouse ${RUN}` } }), /already exists/, 'duplicate role')
    await refused(() => fin(`/users/${staff.temp.id}`, { method: 'PATCH', body: { role: roleKey } }), /^403/, 'finance changes a role')
    const u = await boss(`/users/${staff.temp.id}`, { method: 'PATCH', body: { role: roleKey } }); if (u.role_key !== roleKey) throw new Error(u.role_key)
    await temp('/deliveries'); await refused(() => temp('/products'), /^403/, 'warehouse opens products'); await refused(() => temp('/payments'), /^403/, 'warehouse opens payments')
    await boss(`/roles/${roleKey}`, { method: 'PATCH', body: { permissions: { shipments: ['view', 'approve'], payments: ['view'] } } })
    await new Promise(x => setTimeout(x, 400)); await temp('/payments')
    await refused(() => temp('/payments', { method: 'POST', body: { amount: 5 } }), /^403/, 'view-only role records a payment')
    await refused(() => boss(`/roles/${roleKey}`, { method: 'DELETE' }), /has this role/, 'delete a role in use')
    const list = await boss('/users'); const row = list.find(x => x.id === staff.temp.id); if (row.role_name !== `e2e Warehouse ${RUN}` || list[0].created_at < list[list.length - 1].created_at) throw new Error('staff list: role name or order')
    return `${roleKey}: shipments (+ payments view after the edit) · staff list newest first`
  })
  await step('permissions chosen for one person replace the role; both changes are audited', async () => {
    const u = await boss(`/users/${staff.temp.id}`, { method: 'PATCH', body: { permissions: { bidding: ['view'] } } }); if (!u.permissions?.bidding) throw new Error('not saved')
    await temp('/tenders'); await refused(() => temp('/deliveries'), /^403/, 'role still applies')
    const me = await temp('/me'); if (!me.custom_permissions || me.can.shipments) throw new Error('me: ' + JSON.stringify(me.can))
    await boss(`/users/${staff.temp.id}`, { method: 'PATCH', body: { permissions: null } }); await temp('/deliveries')
    const log = (await boss('/audit?limit=80')).filter(x => x.action === 'permissions')
    if (!log.some(x => x.entity === 'user' && x.entity_id === staff.temp.id && x.after?.added?.length) || !log.some(x => x.entity === 'role' && x.entity_id === roleKey)) throw new Error('audit: ' + JSON.stringify(log.slice(0, 2)))
    return 'own set → role again · audit rows say what was added and removed'
  })
  await step('nobody locks themselves out; the role can go once nobody has it', async () => {
    await refused(() => boss(`/users/${staff.boss.id}`, { method: 'PATCH', body: { role: 'editor' } }), /your own admin access/, 'demote yourself')
    await refused(() => boss(`/users/${staff.temp.id}`, { method: 'PATCH', body: { role: 'no_such_role' } }), /does not exist/, 'unknown role')
    await boss(`/users/${staff.temp.id}`, { method: 'PATCH', body: { role: 'editor' } })
    const d = await boss(`/roles/${roleKey}`, { method: 'DELETE' }); if (!d.deleted) throw new Error('not deleted'); roleKey = null
    return 'own access protected · unknown role refused · custom role deleted'
  })
  await step('GET /reports: one block per module the person may see', async () => {
    const all = await boss('/reports'); for (const k of ['invoices', 'payments', 'clients', 'bidding', 'purchase_orders', 'suppliers', 'deliveries', 'investments']) if (!all[k]) throw new Error('no ' + k)
    const f = await fin('/reports'); if (!f.payments || f.bidding || f.suppliers) throw new Error('finance sees ' + Object.keys(f).join())
    return `super admin: 8 blocks · finance: ${Object.keys(f).filter(k => !['from', 'to'].includes(k)).join(', ')}`
  })

  if (!DRY) skip('client portal and investment portal', 'registration sends a confirmation email; these run where EMAIL_DRY_RUN=1')
  else {
    /* ------------------------------------------------------ client portal --- */
    const reg = { company_name: CLIENT.company, contact_person: 'Jan de Vries', phone: '+31 10 000 0000', address: 'Wilhelminakade 1, Rotterdam', country: 'Netherlands', registration_number: 'KVK 12345678', email: CLIENT.email, password: PASS }
    let client = {}
    await step('a client registers, confirms by email, signs in', async () => {
      await refused(() => pub('/client/register', { method: 'POST', body: { ...reg, password: 'short' } }), /at least 8/, 'short password')
      await refused(() => pub('/client/register', { method: 'POST', body: { ...reg, address: '' } }), /company address/, 'no address')
      await pub('/client/register', { method: 'POST', body: reg })
      await refused(() => pub('/client/register', { method: 'POST', body: reg }), /^409/, 'register twice')
      const token = await signIn(CLIENT.email, PASS).catch(() => null)
      if (token) await refused(() => pub('/client/me', { token }), /^403/, 'use the portal before confirming')
      const m = await mailTo(CLIENT.email, '%confirm%'); const t = tokenIn(m, 'client', 'verify'); if (!t) throw new Error('no confirmation link in: ' + m?.subject)
      await refused(() => pub('/client/verify', { method: 'POST', body: { token: 'f'.repeat(64) } }), /^410/, 'made-up token')
      await pub('/client/verify', { method: 'POST', body: { token: t } })
      await refused(() => pub('/client/verify', { method: 'POST', body: { token: t } }), /^410/, 'link used twice')
      client.token = await signIn(CLIENT.email, PASS)
      const me = await pub('/client/me', { token: client.token }); clientId = me.id
      if (me.name !== CLIENT.company || me.registration_number !== 'KVK 12345678' || !me.verified || me.auth_token_hash !== undefined) throw new Error(JSON.stringify(me).slice(0, 200))
      const row = (await boss(`/clients/${clientId}`)); if (row.source !== 'signup' || !row.has_account || row.auth_token_hash !== undefined) throw new Error('panel record: ' + JSON.stringify({ s: row.source, a: row.has_account }))
      await refused(() => pub('/client/me', { token: staff.fin.token }), /^403/, 'a staff session in the client portal')
      await refused(() => call('/api/admin/me', { token: client.token }), /^40[13]/, 'a client session in the staff panel')
      return `${CLIENT.company} · confirmed · the panel shows a portal account`
    })
    await step('the client edits the profile, uploads a company document, changes nothing they should not', async () => {
      const me = await pub('/client/me', { method: 'PATCH', token: client.token, body: { phone: '+31 10 111 1111', tax_id: 'NL001', email: 'other@e2e.invalid', status: 'archived' } })
      if (me.phone !== '+31 10 111 1111' || me.tax_id !== 'NL001' || me.email !== CLIENT.email) throw new Error(JSON.stringify(me).slice(0, 200))
      const d = await upload('/api/client/documents', client.token, 'e2e-certificate.pdf', { label: 'Business registration certificate' }); if (d.label !== 'Business registration certificate') throw new Error(d.label)
      const docs = await pub('/client/documents', { token: client.token }); if (docs.items.length !== 1 || docs.labels.length < 3) throw new Error('documents')
      return 'phone and tax id saved · email and status untouched · 1 KYC document'
    })
    const quote = await step('an invoice for the client appears in their portal', async () => {
      const q = await boss('/quotes', { method: 'POST', body: { client_id: clientId, title: 'e2e-portal invoice', currency: 'USD', items: [{ description: 'Soybeans', quantity: 10, unit: 'MT', unit_price: 500 }] } }); quoteId = q.id
      if ((await pub('/client/invoices', { token: client.token })).length) throw new Error('a draft is visible to the client')
      await boss(`/quotes/${q.id}`, { method: 'PATCH', body: { status: 'accepted' } })
      const list = await pub('/client/invoices', { token: client.token }); if (list.length !== 1 || list[0].number !== q.number || list[0].balance !== 5000 || !list[0].token) throw new Error(JSON.stringify(list).slice(0, 200))
      return q
    })
    await step('the client reports a payment with its receipt; finance confirms it; the balance falls', async () => {
      await refused(() => pub('/client/payments', { method: 'POST', token: client.token, body: { quote_id: quote.id, amount: 0 } }), /amount paid/, 'no amount')
      await refused(() => pub('/client/payments', { method: 'POST', token: client.token, body: { quote_id: 999999999, amount: 5 } }), /^404/, "someone else's invoice")
      const p = await pub('/client/payments', { method: 'POST', token: client.token, body: { quote_id: quote.id, amount: 2000, paid_on: day(0), method: 'Bank transfer', reference: 'e2e-TRX-1', status: 'confirmed' } })
      if (p.status !== 'submitted' || p.invoice?.number !== quote.number) throw new Error(JSON.stringify(p))
      await upload(`/api/client/payments/${p.id}/receipt`, client.token, 'e2e-receipt.pdf')
      const mine = await pub('/client/payments', { token: client.token }); if (!mine[0].has_receipt) throw new Error('no receipt'); if (!(await pub(`/client/payments/${p.id}/receipt/url`, { token: client.token })).url) throw new Error('no url')
      const seen = (await fin('/payments?status=submitted')).find(x => x.id === p.id); if (!seen || seen.client_name !== CLIENT.company || seen.source !== 'client') throw new Error('finance does not see it')
      if (!(await fin(`/payments/${p.id}/receipt`)).url) throw new Error('finance cannot open the receipt')
      await refused(() => temp(`/payments/${p.id}`, { method: 'PATCH', body: { status: 'confirmed' } }), /^403/, 'editor confirms a payment')
      const done = await fin(`/payments/${p.id}`, { method: 'PATCH', body: { status: 'confirmed', status_note: 'Received with thanks' } }); if (done.status !== 'confirmed' || !done.reviewed_at) throw new Error(done.status)
      const inv2 = (await pub('/client/invoices', { token: client.token }))[0]; if (inv2.paid !== 2000 || inv2.balance !== 3000) throw new Error(JSON.stringify({ p: inv2.paid, b: inv2.balance }))
      const notes = await pub('/client/notifications', { token: client.token }); if (!notes.some(n => /confirmed/.test(n.title))) throw new Error('no notification')
      if (!(await mailTo(CLIENT.email, '%payment%confirmed%'))) throw new Error('no email')
      if (!(await mailTo(S.email.notify_to || 'x', '%payment receipt%')) && S.email.notify_to) throw new Error('team not told')
      await pub('/client/notifications/read', { method: 'POST', token: client.token, body: {} }); if ((await pub('/client/me', { token: client.token })).counts.unread !== 0) throw new Error('still unread')
      await refused(() => upload(`/api/client/payments/${p.id}/receipt`, client.token, 'e2e-again.pdf'), /can no longer be changed/, 'receipt after confirmation')
      return 'USD 2,000 of 5,000: submitted with receipt → confirmed by finance → balance 3,000 · client notified'
    })
    await step('forgotten password: link by email, new password, old one stops working', async () => {
      await pub('/client/forgot', { method: 'POST', body: { email: CLIENT.email } }); await pub('/client/forgot', { method: 'POST', body: { email: 'nobody@e2e.invalid' } })
      const t = tokenIn(await mailTo(CLIENT.email, '%password%'), 'client', 'reset'); if (!t) throw new Error('no reset link')
      await pub('/client/reset', { method: 'POST', body: { token: t, password: PASS + '2' } })
      await signIn(CLIENT.email, PASS + '2'); if (await signIn(CLIENT.email, PASS).catch(() => null)) throw new Error('old password still works')
      return 'reset by link · unknown address answered the same way'
    })

    /* -------------------------------------------------- investment portal --- */
    let investor = {}, opp, mine
    await step('an investor registers, confirms, completes the profile', async () => {
      const body = { name: INVESTOR.name, phone: '+234 800 000 0000', address: '1 Marina, Lagos', id_type: 'National ID (NIN)', id_number: '12345678901', bank_name: 'GTBank', bank_account_name: INVESTOR.name, bank_account_number: '0123456789', email: INVESTOR.email, password: PASS }
      await pub('/investor/register', { method: 'POST', body })
      const t = tokenIn(await mailTo(INVESTOR.email, '%confirm%'), 'investor', 'verify'); if (!t) throw new Error('no confirmation link')
      await pub('/investor/verify', { method: 'POST', body: { token: t } })
      investor.token = await signIn(INVESTOR.email, PASS)
      const me = await pub('/investor/me', { token: investor.token }); investorId = me.id
      if (me.kyc_status !== 'pending' || me.bank_account_number !== '0123456789' || me.notes !== undefined || me.auth_token_hash !== undefined) throw new Error(JSON.stringify(me).slice(0, 200))
      await upload('/api/investor/documents', investor.token, 'e2e-passport.pdf', { label: 'Means of identification' })
      await refused(() => pub('/client/me', { token: investor.token }), /^403/, 'an investor in the client portal')
      client.token = await signIn(CLIENT.email, PASS + '2')
      await refused(() => pub('/investor/me', { token: client.token }), /^403/, 'a client in the investment portal')
      const self = await pub('/investor/me', { method: 'PATCH', token: investor.token, body: { kyc_status: 'verified', status: 'active', notes: 'x' } }); if (self.kyc_status !== 'pending') throw new Error('an investor verified themselves')
      return `${INVESTOR.name} · KYC pending · 1 document`
    })
    await step('staff create an opportunity; investors see it once published', async () => {
      await refused(() => inv('/investment-opportunities', { method: 'POST', body: { title: '', min_amount: 1, tenor_months: 6 } }), /title/, 'no title')
      opp = await inv('/investment-opportunities', { method: 'POST', body: { title: `e2e-Soybean cycle ${RUN}`, summary: 'Six months', currency: 'NGN', min_amount: 500000, capacity: 2000000, tenor_months: 6, expected_return_pct: 12, closes_at: new Date(Date.now() + 30 * 86400e3).toISOString() } }); oppId = opp.id
      if (!/^IO-\d{4}-\d{4}$/.test(opp.number) || opp.status !== 'draft') throw new Error(opp.number)
      if ((await pub('/investor/opportunities', { token: investor.token })).some(o => o.number === opp.number)) throw new Error('a draft is visible')
      await inv(`/investment-opportunities/${opp.id}`, { method: 'PATCH', body: { status: 'published' } })
      const o = (await pub('/investor/opportunities', { token: investor.token })).find(x => x.number === opp.number)
      if (!o || o.state !== 'open' || !o.accepting || o.available !== 2000000 || o.id !== undefined || o.committed !== undefined) throw new Error(JSON.stringify(o))
      return `${opp.number}: min ₦500,000 · 6 months · 12% · capacity ₦2,000,000`
    })
    await step('the investor applies; the limits hold', async () => {
      const base = `/investor/opportunities/${opp.number}/invest`
      await refused(() => pub(base, { method: 'POST', token: investor.token, body: { amount: 100000, confirmed: true } }), /minimum investment/, 'below the minimum')
      await refused(() => pub(base, { method: 'POST', token: investor.token, body: { amount: 600000 } }), /confirm that you have read/, 'terms not confirmed')
      await refused(() => pub(base, { method: 'POST', token: investor.token, body: { amount: 2500000, confirmed: true } }), /still available/, 'over the capacity')
      mine = await pub(base, { method: 'POST', token: investor.token, body: { amount: 1000000, confirmed: true, note: 'e2e' } })
      if (!/^IV-\d{4}-\d{4}$/.test(mine.number) || mine.status !== 'pending' || mine.internal_notes !== undefined) throw new Error(JSON.stringify(mine).slice(0, 200))
      await upload(`/api/investor/investments/${mine.id}/proof`, investor.token, 'e2e-proof.pdf')
      const o = await pub(`/investor/opportunities/${opp.number}`, { token: investor.token }); if (o.available !== 1000000 || o.filled_pct !== 50) throw new Error(JSON.stringify({ a: o.available, f: o.filled_pct }))
      if ((await boss('/stats')).investmentsNew < 1) throw new Error('no badge')
      return `${mine.number}: ₦1,000,000 pending · proof uploaded · 50% subscribed`
    })
    await step('approve → active with dates and return; payouts; paid out', async () => {
      await refused(() => fin(`/investments/${mine.id}`, { method: 'PATCH', body: { status: 'active' } }), /^403/, 'finance approves an investment')
      await refused(() => inv(`/investments/${mine.id}/payouts`, { method: 'POST', body: { amount: 5 } }), /once the investment is active/, 'payout before approval')
      const k = await inv(`/investors/${investorId}`, { method: 'PATCH', body: { kyc_status: 'verified' } }); if (k.kyc_status !== 'verified') throw new Error('kyc')
      const a = await inv(`/investments/${mine.id}`, { method: 'PATCH', body: { status: 'active', start_date: day(0) } })
      if (a.status !== 'active' || a.expected_return !== 120000 || !a.maturity_date || a.maturity_date <= a.start_date) throw new Error(JSON.stringify({ s: a.status, r: a.expected_return, m: a.maturity_date }))
      const months = (new Date(a.maturity_date) - new Date(a.start_date)) / 86400e3; if (months < 180 || months > 185) throw new Error('tenor: ' + months)
      const p = await inv(`/investments/${mine.id}/payouts`, { method: 'POST', body: { kind: 'return', amount: 120000, reference: 'e2e-PAY-1' } }); if (p.paid !== 120000) throw new Error('paid ' + p.paid)
      await inv(`/investments/${mine.id}/payouts`, { method: 'POST', body: { kind: 'principal', amount: 1000000 } })
      await inv(`/investments/${mine.id}`, { method: 'PATCH', body: { status: 'paid_out' } })
      const v = await pub(`/investor/investments/${mine.id}`, { token: investor.token }); if (v.status !== 'paid_out' || v.paid !== 1120000 || v.payouts.length !== 2 || v.expected_return !== 120000) throw new Error(JSON.stringify(v).slice(0, 200))
      const me = await pub('/investor/me', { token: investor.token }); if (me.kyc_status !== 'verified' || me.counts.returns !== 120000) throw new Error(JSON.stringify(me.counts))
      const notes = await pub('/investor/notifications', { token: investor.token }); for (const re of [/verified/, /approved/, /paid you/, /paid out in full/]) if (!notes.some(n => re.test(n.title))) throw new Error('no notification ' + re)
      if (!(await mailTo(INVESTOR.email, '%approved%'))) throw new Error('no approval email')
      await refused(() => inv(`/investments/${mine.id}`, { method: 'DELETE' }), /stays on record/, 'delete an approved investment')
      await refused(() => inv(`/investment-opportunities/${opp.id}`, { method: 'DELETE' }), /applied to this opportunity/, 'delete a used opportunity')
      const t = (await inv('/investments')).totals; if (t.investors < 1) throw new Error('totals')
      const log = (await boss('/audit?limit=80')).filter(x => x.entity === 'investment' && Number(x.entity_id) === mine.id).map(x => x.action)
      for (const act of ['create', 'active', 'payout', 'paid_out']) if (!log.includes(act)) throw new Error('audit lacks ' + act + ': ' + log.join())
      return `KYC verified · active, ₦120,000 expected, matures ${a.maturity_date} · ₦1,120,000 paid · audit: ${[...new Set(log)].join(', ')}`
    })
  }
} catch (e) {
  results.push(['✗', 'stopped', e.message])
} finally {
  const quiet = async p => { try { await p } catch { /* best effort */ } }
  const docs = (await svc.from('documents').select('path').like('name', 'e2e-%')).data || []
  const all = [...new Set([...paths, ...docs.map(d => d.path)])]
  if (all.length) await quiet(svc.storage.from('documents').remove(all))
  await quiet(svc.from('documents').delete().like('name', 'e2e-%'))
  if (investorId) { const ids = ((await svc.from('investments').select('id').eq('investor_id', investorId)).data || []).map(x => x.id); if (ids.length) { await quiet(svc.from('investment_payouts').delete().in('investment_id', ids)); await quiet(svc.from('investments').delete().in('id', ids)) } await quiet(svc.from('notifications').delete().eq('audience', 'investor').eq('audience_id', investorId)) }
  await quiet(svc.from('investment_opportunities').delete().like('title', 'e2e-%'))
  for (const [table, email] of [['investors', INVESTOR.email], ['clients', CLIENT.email]]) {
    const rows = (await svc.from(table).select('id,user_id').eq('email', email)).data || []
    for (const r of rows) {
      if (table === 'clients') { await quiet(svc.from('payments').delete().eq('client_id', r.id)); await quiet(svc.from('quotes').delete().eq('client_id', r.id)); await quiet(svc.from('notifications').delete().eq('audience', 'client').eq('audience_id', r.id)) }
      await quiet(svc.from(table).delete().eq('id', r.id)); if (r.user_id) await quiet(svc.auth.admin.deleteUser(r.user_id))
    }
  }
  if (quoteId) await quiet(svc.from('quotes').delete().eq('id', quoteId))
  await quiet(svc.from('staff_roles').delete().like('name', 'e2e %'))
  await quiet(svc.from('messages').delete().like('to_email', '%@e2e.invalid'))
  await quiet(svc.from('audit_log').delete().in('actor_label', ['client', 'investor']).or('after->>email.ilike.%@e2e.invalid,after->>name.ilike.e2e-%,after->>investor.ilike.e2e-%,after->>client.ilike.e2e-%'))
  for (const s of Object.values(staff)) if (s.id) { await quiet(svc.from('audit_log').delete().eq('actor_id', s.id)); await quiet(svc.from('audit_log').delete().eq('entity_id', s.id)); await quiet(svc.from('profiles').delete().eq('id', s.id)); await quiet(svc.auth.admin.deleteUser(s.id)) }

  for (const [mark, name, note] of results) console.log(` ${mark} ${name}${note ? `  — ${note}` : ''}`)
  const failed = results.filter(r => r[0] === '✗').length
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED — test accounts, roles, the client, the investor and their records removed')
  process.exit(failed ? 1 : 0)
}
