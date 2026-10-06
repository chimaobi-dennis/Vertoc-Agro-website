/*
 * The pieces migration 015 adds outside bidding: one-time email codes,
 * portal notifications, account links shared by the client and investor
 * portals, client accounts and payments, and the investment section.
 * Supabase only. Problems a person can fix are thrown with expose: true.
 */
import { randomBytes, randomInt, createHash } from 'node:crypto'
import { supabase } from './supabase.js'
import { insertNumbered } from './procurement.js'

export const PORTALS_HINT = 'This needs the database migration 015: run server/migrations/015_portals_permissions.sql in the Supabase SQL editor first.'
const missing = e => ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e?.code)
const invalid = (message, status = 400) => Object.assign(new Error(message), { expose: true, status })
const fail = (e, ctx) => (missing(e) ? invalid(PORTALS_HINT, 409) : new Error(`${ctx}: ${e.message}`))
const unwrap = ({ data, error }, ctx) => { if (error) throw fail(error, ctx); return data }
const tt = (s, max = 200) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const text = (s, max = 5000) => String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)
const money = v => Math.round((Number(v) || 0) * 100) / 100
const sha256 = s => createHash('sha256').update(String(s)).digest('hex')
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const has = (o, k) => o != null && o[k] !== undefined
const currencyCode = (c, fallback = 'NGN') => { const s = String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); return s.length === 3 ? s : fallback }
const dateOnly = (v, label) => { const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw invalid(`${label} must be a date`); return s }
const moment = (v, label) => { const d = new Date(v); if (Number.isNaN(d.getTime())) throw invalid(`${label} must be a date and time`); return d.toISOString() }
const today = () => new Date().toISOString().slice(0, 10)
const like = s => String(s || '').replace(/[%_\\,()]/g, m => (m === ',' || m === '(' || m === ')' ? '' : `\\${m}`))

/* -------------------------------------------------------- email codes --- */
// A six-digit code, emailed, good for ten minutes and five tries. Only its hash is stored.
export const OTP_MINUTES = 10
export async function issueOtp(purpose, refId, email) {
  if (!EMAIL_RE.test(String(email || ''))) throw invalid('There is no email address on record to send a code to. Please contact us.', 409)
  const { data: last, error } = await supabase.from('otp_codes').select('created_at').eq('purpose', purpose).eq('ref_id', Number(refId)).order('created_at', { ascending: false }).limit(1)
  if (error) throw fail(error, 'issueOtp')
  const wait = last?.[0] ? 60 - Math.floor((Date.now() - Date.parse(last[0].created_at)) / 1000) : 0
  if (wait > 0) throw Object.assign(invalid(`A code was just sent. You can ask for a new one in ${wait} seconds.`, 429), { retry_after: wait })
  const code = String(randomInt(0, 1000000)).padStart(6, '0')
  // Older codes for the same thing stop working.
  await supabase.from('otp_codes').update({ used_at: new Date().toISOString() }).eq('purpose', purpose).eq('ref_id', Number(refId)).is('used_at', null)
  unwrap(await supabase.from('otp_codes').insert({ purpose, ref_id: Number(refId), email: String(email).toLowerCase(), code_hash: sha256(`${purpose}:${refId}:${code}`), expires_at: new Date(Date.now() + OTP_MINUTES * 60000).toISOString() }), 'issueOtp:insert')
  return { code, minutes: OTP_MINUTES }
}
/** Throws unless `code` is the live code; a correct code is used up. */
export async function consumeOtp(purpose, refId, code) {
  // The table is asked first: before migration 015 there are no codes, and callers skip the step on that error.
  const { data, error } = await supabase.from('otp_codes').select('*').eq('purpose', purpose).eq('ref_id', Number(refId)).is('used_at', null).order('created_at', { ascending: false }).limit(1)
  if (error) throw fail(error, 'consumeOtp')
  const c = String(code || '').replace(/\D/g, '')
  if (c.length !== 6) throw invalid('Enter the 6-digit code we emailed you.')
  const row = data?.[0]
  if (!row) throw invalid('Ask for a code first.', 409)
  if (row.expires_at < new Date().toISOString()) throw invalid('That code has expired. Ask for a new one.', 410)
  if (row.attempts >= 5) throw invalid('Too many wrong tries. Ask for a new code.', 429)
  if (row.code_hash !== sha256(`${purpose}:${refId}:${c}`)) {
    await supabase.from('otp_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id)
    throw invalid('That code is not right. Check the email and try again.')
  }
  await supabase.from('otp_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id)
  return true
}
export const maskEmail = e => { const [u, d] = String(e || '').split('@'); return d ? `${u.slice(0, 2)}${'*'.repeat(Math.max(2, u.length - 2))}@${d}` : '' }

/* ------------------------------------------------------ notifications --- */
/** A line under Notifications in someone's portal. Never throws. */
export async function notify(audience, audienceId, { title, body = '', link = '' }) {
  if (audienceId == null) return null
  try { const { data } = await supabase.from('notifications').insert({ audience, audience_id: Number(audienceId), title: tt(title, 200), body: text(body, 1000), link: tt(link, 300) }).select().single(); return data } catch { return null }
}
export async function listNotifications(audience, audienceId, { limit = 100 } = {}) {
  const { data, error } = await supabase.from('notifications').select('id,title,body,link,read_at,created_at').eq('audience', audience).eq('audience_id', Number(audienceId)).order('created_at', { ascending: false }).limit(limit)
  if (error) { if (missing(error)) return []; throw fail(error, 'listNotifications') }
  return data || []
}
export async function readNotifications(audience, audienceId, ids = null) {
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('audience', audience).eq('audience_id', Number(audienceId)).is('read_at', null)
  if (Array.isArray(ids) && ids.length) q = q.in('id', ids.map(Number))
  await q
  return { ok: true }
}

/* ------------------------------------------- account links (any portal) --- */
// One-time links to confirm an email address or choose a new password, for
// the tables that hold portal accounts (clients, investors).
const ACCOUNT_TABLES = ['clients', 'investors']
const table = t => { if (!ACCOUNT_TABLES.includes(t)) throw new Error('bad account table'); return t }
export async function issueAccountToken(t, id, kind, hours = 24) {
  const token = randomBytes(32).toString('hex')
  unwrap(await supabase.from(table(t)).update({ auth_token_hash: sha256(token), auth_token_kind: kind, auth_token_expires: new Date(Date.now() + hours * 3600e3).toISOString() }).eq('id', Number(id)).select('id').single(), 'issueAccountToken')
  return token
}
export async function accountForToken(t, token, kind, { consume = false } = {}) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return null
  const kinds = [].concat(kind)   // 'reset' and 'invite' links both let the owner choose a password
  const row = (unwrap(await supabase.from(table(t)).select('*').eq('auth_token_hash', sha256(token)).in('auth_token_kind', kinds).limit(1), 'accountForToken'))?.[0]
  if (!row || !row.auth_token_expires || row.auth_token_expires < new Date().toISOString()) return null
  if (consume) await clearAccountToken(t, row.id)
  return row
}
export async function clearAccountToken(t, id) {
  await supabase.from(table(t)).update({ auth_token_hash: null, auth_token_kind: null, auth_token_expires: null }).eq('id', Number(id))
}
/** An invited person chose a password: the login now exists, so tie it to their record. */
export async function attachAccountUser(t, id, userId) {
  return unwrap(await supabase.from(table(t)).update({ user_id: String(userId) }).eq('id', Number(id)).select().single(), 'attachAccountUser')
}
/** Staff invite someone: make sure the record carries the address the link goes to. */
export async function setAccountEmail(t, id, email) {
  const e = tt(email, 200).toLowerCase(); if (!EMAIL_RE.test(e)) throw invalid('Please enter a valid email address.')
  const { data, error } = await supabase.from(table(t)).update({ email: e }).eq('id', Number(id)).select().single()
  if (error) throw (error.code === '23505' ? invalid('Another record already uses this email address.', 409) : fail(error, 'setAccountEmail'))
  return data
}
export async function accountByUser(t, userId) {
  return (unwrap(await supabase.from(table(t)).select('*').eq('user_id', String(userId)).limit(1), 'accountByUser'))?.[0] ?? null
}
export async function accountByEmail(t, email) {
  const e = tt(email, 200).toLowerCase(); if (!e) return null
  return (unwrap(await supabase.from(table(t)).select('*').ilike('email', like(e)).limit(1), 'accountByEmail'))?.[0] ?? null
}
export async function markAccountVerified(t, id) {
  return unwrap(await supabase.from(table(t)).update({ verified_at: new Date().toISOString() }).eq('id', Number(id)).select().single(), 'markAccountVerified')
}

/* ------------------------------------------------------ client accounts --- */
const CLIENT_KEYS = ['company', 'contact_person', 'email', 'phone', 'country', 'address', 'registration_number', 'tax_id', 'commodities']
/** What a client may see of their own record. */
export const publicClient = c => ({ id: c.id, name: c.name, email: c.email || c.data?.email || '', verified: Boolean(c.verified_at), created_at: c.created_at, ...Object.fromEntries(CLIENT_KEYS.filter(k => k !== 'email').map(k => [k, c.data?.[k] ?? ''])) })
function clientData(input, existing = {}) {
  const data = { ...existing }
  for (const k of CLIENT_KEYS) if (has(input, k)) data[k] = k === 'address' || k === 'commodities' ? text(input[k], 1000) : tt(input[k], 200)
  return data
}
/** A staff-made record that carries this email and has no account yet. */
export async function findClientRecordByEmail(email) {
  const e = tt(email, 200).toLowerCase(); if (!e) return null
  return (unwrap(await supabase.from('clients').select('*').ilike('data->>email', like(e)).is('user_id', null).order('created_at', { ascending: true }).limit(1), 'findClientRecordByEmail'))?.[0] ?? null
}
export async function createClientAccount(input, userId) {
  const name = tt(input.company_name || input.name, 200); if (!name) throw invalid('Please enter your company name.')
  const email = tt(input.email, 200).toLowerCase()
  const data = clientData({ ...input, company: name, email })
  const { data: row, error } = await supabase.from('clients').insert({ name, data, status: 'active', user_id: userId, email, source: 'signup' }).select().single()
  if (error) throw (error.code === '23505' ? invalid('An account already exists for this email address.', 409) : fail(error, 'createClientAccount'))
  return row
}
export async function attachClientAccount(id, userId, input) {
  const cur = unwrap(await supabase.from('clients').select('*').eq('id', Number(id)).single(), 'attachClientAccount:get')
  // Keep what staff recorded; fill only the gaps from the registration form.
  const filled = clientData(Object.fromEntries(Object.entries(input).filter(([k, v]) => v && !cur.data?.[k])), cur.data || {})
  const { data, error } = await supabase.from('clients').update({ user_id: userId, email: tt(input.email, 200).toLowerCase(), data: filled }).eq('id', cur.id).select().single()
  if (error) throw (error.code === '23505' ? invalid('An account already exists for this email address.', 409) : fail(error, 'attachClientAccount'))
  return data
}
export async function detachClientAccount(id) { await supabase.from('clients').update({ user_id: null, email: '', auth_token_hash: null }).eq('id', Number(id)) }
export async function updateClientAccount(id, input) {
  const cur = unwrap(await supabase.from('clients').select('*').eq('id', Number(id)).single(), 'updateClientAccount:get')
  const allowed = Object.fromEntries(CLIENT_KEYS.filter(k => k !== 'email' && has(input, k)).map(k => [k, input[k]]))
  const row = { data: clientData(allowed, cur.data || {}) }
  if (has(input, 'company_name')) { const n = tt(input.company_name, 200); if (!n) throw invalid('Please enter your company name.'); row.name = n; row.data.company = n }
  return unwrap(await supabase.from('clients').update(row).eq('id', cur.id).select().single(), 'updateClientAccount')
}

/* ------------------------------------------------------------ payments --- */
export const PAYMENT_STATUSES = ['submitted', 'confirmed', 'rejected']
const payNumeric = p => ({ ...p, amount: Number(p.amount) })
export async function listPayments({ client_id = null, quote_id = null, status = 'all', limit = 2000 } = {}) {
  let q = supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(limit)
  if (client_id != null) q = q.eq('client_id', Number(client_id))
  if (quote_id != null) q = q.eq('quote_id', Number(quote_id))
  if (PAYMENT_STATUSES.includes(status)) q = q.eq('status', status)
  const { data, error } = await q
  if (error) { if (missing(error)) return []; throw fail(error, 'listPayments') }
  const rows = (data || []).map(payNumeric)
  if (!rows.length) return rows
  const qids = [...new Set(rows.map(r => r.quote_id).filter(v => v != null))], cids = [...new Set(rows.map(r => r.client_id).filter(v => v != null))]
  const [quotes, clients] = await Promise.all([
    qids.length ? supabase.from('quotes').select('id,number,total,currency,client_name').in('id', qids).then(r => r.data || []) : [],
    cids.length ? supabase.from('clients').select('id,name').in('id', cids).then(r => r.data || []) : [],
  ])
  return rows.map(r => ({ ...r, quote: quotes.find(x => x.id === r.quote_id) || null, client_name: clients.find(x => x.id === r.client_id)?.name || quotes.find(x => x.id === r.quote_id)?.client_name || '' }))
}
export async function getPayment(id) {
  const { data, error } = await supabase.from('payments').select('*').eq('id', Number(id)).limit(1)
  if (error) throw fail(error, 'getPayment')
  return data?.[0] ? payNumeric(data[0]) : null
}
export async function createPayment(input = {}, { source = 'staff', actorId = null, clientId = null } = {}) {
  const amount = money(input.amount); if (!(amount > 0)) throw invalid('Please enter the amount paid.')
  let quote = null
  if (input.quote_id != null && input.quote_id !== '') {
    quote = (unwrap(await supabase.from('quotes').select('id,client_id,currency,number,status').eq('id', Number(input.quote_id)).limit(1), 'createPayment:quote'))?.[0]
    if (!quote || (clientId != null && quote.client_id !== Number(clientId))) throw invalid('invoice not found', 404)
  }
  const client_id = clientId ?? (input.client_id != null && input.client_id !== '' ? Number(input.client_id) : quote?.client_id ?? null)
  const row = {
    client_id, quote_id: quote?.id ?? null, amount, currency: currencyCode(input.currency || quote?.currency, 'USD'),
    paid_on: input.paid_on ? dateOnly(input.paid_on, 'Payment date') : today(), method: tt(input.method, 60), reference: tt(input.reference, 120), note: text(input.note, 1000),
    status: source === 'staff' && input.status === 'confirmed' ? 'confirmed' : 'submitted', source, created_by: actorId,
    ...(source === 'staff' && input.status === 'confirmed' ? { reviewed_by: actorId, reviewed_at: new Date().toISOString() } : {}),
  }
  if (row.paid_on > today()) throw invalid('The payment date cannot be in the future.')
  return payNumeric(unwrap(await supabase.from('payments').insert(row).select().single(), 'createPayment'))
}
export async function setPaymentReceipt(id, documentId) {
  return payNumeric(unwrap(await supabase.from('payments').update({ receipt_document_id: Number(documentId) }).eq('id', Number(id)).select().single(), 'setPaymentReceipt'))
}
export async function updatePayment(id, patch = {}, actor = null) {
  const cur = await getPayment(id); if (!cur) throw invalid('payment not found', 404)
  const row = {}
  if (has(patch, 'amount')) { row.amount = money(patch.amount); if (!(row.amount > 0)) throw invalid('Please enter the amount paid.') }
  if (has(patch, 'currency')) row.currency = currencyCode(patch.currency, cur.currency)
  if (has(patch, 'paid_on')) row.paid_on = patch.paid_on ? dateOnly(patch.paid_on, 'Payment date') : null
  for (const [k, max] of [['method', 60], ['reference', 120]]) if (has(patch, k)) row[k] = tt(patch[k], max)
  if (has(patch, 'note')) row.note = text(patch.note, 1000)
  if (has(patch, 'status_note')) row.status_note = text(patch.status_note, 1000)
  let reviewed = false
  if (has(patch, 'status') && patch.status !== cur.status) {
    if (!PAYMENT_STATUSES.includes(patch.status)) throw invalid(`status must be one of: ${PAYMENT_STATUSES.join(', ')}`)
    Object.assign(row, { status: patch.status, reviewed_by: actor?.id ?? null, reviewed_at: new Date().toISOString() }); reviewed = true
  }
  if (!Object.keys(row).length) return { payment: cur, reviewed: false }
  return { payment: payNumeric(unwrap(await supabase.from('payments').update(row).eq('id', cur.id).select().single(), 'updatePayment')), reviewed, previous: cur.status }
}
export async function deletePayment(id) {
  const cur = await getPayment(id); if (!cur) throw invalid('payment not found', 404)
  unwrap(await supabase.from('payments').delete().eq('id', cur.id), 'deletePayment')
  return { deleted: true, id: cur.id }
}
/** Confirmed and awaiting amounts per invoice: { [quote_id]: { paid, pending } }. */
export function paidByQuote(payments) {
  const out = {}
  for (const p of payments) { if (p.quote_id == null || p.status === 'rejected') continue; const o = (out[p.quote_id] ||= { paid: 0, pending: 0 }); if (p.status === 'confirmed') o.paid = money(o.paid + p.amount); else o.pending = money(o.pending + p.amount) }
  return out
}
/** A client's invoices (never drafts), with what has been paid against each. */
export async function listClientInvoices(clientId) {
  const quotes = unwrap(await supabase.from('quotes').select('id,number,token,title,status,currency,total,valid_until,sent_at,created_at,responded_at').eq('client_id', Number(clientId)).neq('status', 'draft').order('created_at', { ascending: false }).limit(500), 'listClientInvoices') ?? []
  const pay = paidByQuote(await listPayments({ client_id: clientId }))
  return quotes.map(q => { const p = pay[q.id] || { paid: 0, pending: 0 }; return { ...q, total: Number(q.total), paid: p.paid, pending: p.pending, balance: money(Math.max(0, Number(q.total) - p.paid)) } })
}

/* --------------------------------------------------------- investments --- */
export const OPPORTUNITY_STATUSES = ['draft', 'published', 'closed', 'cancelled']
export const INVESTMENT_STATUSES = ['pending', 'active', 'matured', 'paid_out', 'rejected', 'cancelled']
export const INVESTMENT_LABELS = { pending: 'Awaiting approval', active: 'Active', matured: 'Matured', paid_out: 'Paid out', rejected: 'Not approved', cancelled: 'Cancelled' }
const COMMITTED = ['pending', 'active', 'matured']
export function opportunityState(o, now = Date.now()) {
  if (o.status !== 'published') return o.status
  if (Date.parse(o.opens_at) > now) return 'upcoming'
  if (o.closes_at && Date.parse(o.closes_at) <= now) return 'closed'
  return 'open'
}
const oppNumeric = o => ({ ...o, min_amount: Number(o.min_amount), capacity: o.capacity == null ? null : Number(o.capacity), expected_return_pct: o.expected_return_pct == null ? null : Number(o.expected_return_pct), state: opportunityState(o) })
const invNumeric = i => ({ ...i, amount: Number(i.amount), expected_return: i.expected_return == null ? null : Number(i.expected_return),
  // An active investment past its maturity date reads as matured.
  state: i.status === 'active' && i.maturity_date && i.maturity_date <= today() ? 'matured' : i.status })
function cleanOpportunity(input, { partial = false, existing = null } = {}) {
  const row = {}
  if (!partial || has(input, 'title')) { row.title = tt(input.title, 200); if (!row.title) throw invalid('Please give the opportunity a title.') }
  if (has(input, 'summary')) row.summary = text(input.summary, 500)
  if (has(input, 'description')) row.description = text(input.description, 8000)
  if (!partial || has(input, 'currency')) row.currency = currencyCode(input.currency)
  if (!partial || has(input, 'min_amount')) { row.min_amount = money(input.min_amount); if (row.min_amount < 0) throw invalid('The minimum amount cannot be negative.') }
  if (has(input, 'capacity')) { row.capacity = input.capacity == null || input.capacity === '' ? null : money(input.capacity); if (row.capacity != null && row.capacity <= 0) throw invalid('The capacity must be more than zero, or left empty.') }
  if (!partial || has(input, 'tenor_months')) { row.tenor_months = Math.round(Number(input.tenor_months)); if (!(row.tenor_months >= 1 && row.tenor_months <= 600)) throw invalid('The tenor must be at least one month.') }
  if (has(input, 'expected_return_pct')) { row.expected_return_pct = input.expected_return_pct == null || input.expected_return_pct === '' ? null : Math.round(Number(input.expected_return_pct) * 1000) / 1000; if (row.expected_return_pct != null && !(row.expected_return_pct >= 0 && row.expected_return_pct <= 1000)) throw invalid('The expected return must be a percentage.') }
  if (has(input, 'return_note')) row.return_note = text(input.return_note, 1000)
  if (has(input, 'opens_at') && input.opens_at) row.opens_at = moment(input.opens_at, 'Opening date')
  if (has(input, 'closes_at')) row.closes_at = input.closes_at ? moment(input.closes_at, 'Closing date') : null
  if (has(input, 'status')) { if (!OPPORTUNITY_STATUSES.includes(input.status)) throw invalid(`status must be one of: ${OPPORTUNITY_STATUSES.join(', ')}`); row.status = input.status }
  const opens = row.opens_at ?? existing?.opens_at ?? new Date().toISOString(), closes = has(row, 'closes_at') ? row.closes_at : existing?.closes_at
  if (closes && Date.parse(closes) <= Date.parse(opens)) throw invalid('The closing date must be after the opening date.')
  return row
}
async function committedBy(ids) {
  if (!ids.length) return {}
  const rows = unwrap(await supabase.from('investments').select('opportunity_id,amount,status').in('opportunity_id', ids), 'committed') ?? []
  const out = {}
  for (const r of rows) { const o = (out[r.opportunity_id] ||= { committed: 0, active: 0, investors: 0, pending: 0 }); if (COMMITTED.includes(r.status)) { o.committed = money(o.committed + Number(r.amount)); o.investors++ } if (['active', 'matured'].includes(r.status)) o.active = money(o.active + Number(r.amount)); if (r.status === 'pending') o.pending++ }
  return out
}
const withFunds = (o, c) => { const f = c[o.id] || { committed: 0, active: 0, investors: 0, pending: 0 }; return { ...o, ...f, available: o.capacity == null ? null : money(Math.max(0, o.capacity - f.committed)) } }
export async function listOpportunities({ status = 'all', limit = 500 } = {}) {
  let q = supabase.from('investment_opportunities').select('*').order('created_at', { ascending: false }).limit(limit)
  if (OPPORTUNITY_STATUSES.includes(status)) q = q.eq('status', status)
  const rows = (unwrap(await q, 'listOpportunities') ?? []).map(oppNumeric)
  const c = await committedBy(rows.map(r => r.id))
  return rows.map(o => withFunds(o, c))
}
const oppRow = async idOrNumber => {
  const s = String(idOrNumber ?? '').trim()
  const q = /^\d+$/.test(s) ? supabase.from('investment_opportunities').select('*').eq('id', Number(s)) : supabase.from('investment_opportunities').select('*').eq('number', s.toUpperCase())
  return (unwrap(await q.limit(1), 'getOpportunity'))?.[0] ?? null
}
export async function getOpportunity(idOrNumber) { const o = await oppRow(idOrNumber); if (!o) return null; const n = oppNumeric(o); return withFunds(n, await committedBy([n.id])) }
export async function createOpportunity(input, actorId = null) {
  const row = { summary: '', description: '', return_note: '', status: 'draft', ...cleanOpportunity(input), created_by: actorId }
  return oppNumeric(await insertNumbered('investment_opportunities', 'IO', row, input?.number, 'Opportunity'))
}
export async function updateOpportunity(id, patch) {
  const cur = await oppRow(id); if (!cur) throw invalid('opportunity not found', 404)
  const row = cleanOpportunity(patch, { partial: true, existing: cur })
  if (!Object.keys(row).length) return oppNumeric(cur)
  return oppNumeric(unwrap(await supabase.from('investment_opportunities').update(row).eq('id', cur.id).select().single(), 'updateOpportunity'))
}
export async function deleteOpportunity(id) {
  const cur = await oppRow(id); if (!cur) throw invalid('opportunity not found', 404)
  const used = unwrap(await supabase.from('investments').select('id').eq('opportunity_id', cur.id).limit(1), 'deleteOpportunity:used') ?? []
  if (used.length) throw invalid('People have applied to this opportunity. Close or cancel it instead of deleting it.')
  unwrap(await supabase.from('investment_opportunities').delete().eq('id', cur.id), 'deleteOpportunity')
  return { deleted: true, id: cur.id, number: cur.number }
}
/* The cover picture of an opportunity is an ordinary document under this label (no extra column to migrate). */
export const COVER_LABEL = 'Cover image'
export async function opportunityCovers(ids) {
  if (!ids.length) return {}
  const { data, error } = await supabase.from('documents').select('id,name,opportunity_id,label,status,content_type,created_at').in('opportunity_id', ids.map(Number)).eq('label', COVER_LABEL).eq('status', 'ready').order('created_at', { ascending: false })
  if (error) { if (missing(error)) return {}; throw fail(error, 'opportunityCovers') }
  const out = {}; for (const d of data || []) out[d.opportunity_id] ??= d     // newest wins
  return out
}
export async function setDocumentLabel(id, label) {
  const l = tt(label, 80)
  return unwrap(await supabase.from('documents').update({ label: l }).eq('id', Number(id)).select().single(), 'setDocumentLabel')
}
/** What an investor sees of an opportunity: no internal fields, no other investors. */
export const publicOpportunity = o => ({ number: o.number, title: o.title, summary: o.summary, description: o.description, currency: o.currency, min_amount: o.min_amount, tenor_months: o.tenor_months,
  expected_return_pct: o.expected_return_pct, return_note: o.return_note, opens_at: o.opens_at, closes_at: o.closes_at, state: o.state, accepting: o.state === 'open' && (o.available == null || o.available >= Math.max(o.min_amount, 0.01)),
  capacity: o.capacity, available: o.available, filled_pct: o.capacity ? Math.min(100, Math.round(o.committed / o.capacity * 100)) : null })

/* investors */
export const KYC_STATUSES = ['pending', 'verified', 'rejected']
const INVESTOR_KEYS = [['name', 200], ['phone', 60], ['id_type', 60], ['id_number', 80], ['bank_name', 120], ['bank_account_name', 160], ['bank_account_number', 40],
  ['first_name', 80], ['middle_name', 80], ['last_name', 80], ['nickname', 60], ['alt_phone', 60], ['state_of_origin', 80], ['lga', 80], ['nationality', 80]]
export const INVESTOR_TITLES = ['Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Prof.', 'Chief', 'Alhaji', 'Alhaja', 'Barr.', 'Engr.', 'Rev.', 'Odogwu', 'Pastor']
/** Values that, once on record, only change through an approved change request (name, contact, identity, bank, picture). */
export const CONTROLLED_FIELDS = ['name', 'title', 'first_name', 'middle_name', 'last_name', 'phone', 'email', 'address', 'state_of_origin', 'lga', 'date_of_birth', 'nationality', 'id_type', 'id_number', 'bank_name', 'bank_account_name', 'bank_account_number']
export const safeInvestor = i => { if (!i) return i; const { auth_token_hash, auth_token_kind, auth_token_expires, ...rest } = i; return rest }
export const publicInvestor = i => { const { notes, status, user_id, ...rest } = safeInvestor(i); return { ...rest, verified: Boolean(i.verified_at) } }
export function cleanInvestor(input, { partial = false, existing = null } = {}) {
  const row = {}
  for (const [k, max] of INVESTOR_KEYS) if (has(input, k)) row[k] = tt(input[k], max)
  if (has(input, 'title')) {
    const t = tt(input.title, 12)
    if (t && !INVESTOR_TITLES.includes(t) && !/^[A-Za-z.]{1,5}$/.test(t)) throw invalid('Choose a title from the list, or type your own (up to 5 letters).')
    row.title = t
  }
  if (has(input, 'investor_type')) row.investor_type = input.investor_type === 'company' ? 'company' : 'individual'
  if (has(input, 'date_of_birth')) {
    if (!input.date_of_birth) row.date_of_birth = null
    else { const d = String(input.date_of_birth).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)) || d > today() || d < '1900-01-01') throw invalid('Please enter a valid date of birth.'); row.date_of_birth = d }
  }
  // An individual's name is made from the parts, unless a name is already on record (changing it takes a change request).
  const parts = ['first_name', 'middle_name', 'last_name']
  if (!has(input, 'name') && parts.some(k => has(row, k)) && !(existing?.name)) row.name = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')
  if (!partial && !row.name) throw invalid('Please enter your full name or company name.')
  if (has(row, 'name') && !row.name) throw invalid('Please enter your full name or company name.')
  if (has(input, 'address')) row.address = text(input.address, 500)
  return row
}
export async function createInvestor(input, userId) {
  const email = tt(input.email, 200).toLowerCase(); if (!EMAIL_RE.test(email)) throw invalid('Please enter a valid email address.')
  const { data, error } = await supabase.from('investors').insert({ ...cleanInvestor(input), email, user_id: userId }).select().single()
  if (error) throw (error.code === '23505' ? invalid('An account already exists for this email address.', 409) : fail(error, 'createInvestor'))
  return data
}
export async function updateInvestor(id, patch, { staff = false } = {}) {
  const cur = staff ? null : await getInvestor(id)
  const row = cleanInvestor(patch, { partial: true, existing: cur })
  if (!staff) {
    // What is already on record is official: it changes only through an approved change request.
    for (const k of CONTROLLED_FIELDS) {
      if (!has(row, k)) continue
      const was = cur?.[k] == null ? '' : String(cur[k])
      if (was !== '' && was !== String(row[k] ?? '')) throw invalid('Some of these details are already on record, so they change only through a change request with a reason and supporting documents.', 409)
    }
  }
  if (staff) {
    if (has(patch, 'notes')) row.notes = text(patch.notes, 5000)
    if (has(patch, 'status')) { if (!['active', 'blocked'].includes(patch.status)) throw invalid('status must be active or blocked'); row.status = patch.status }
    if (has(patch, 'kyc_status')) { if (!KYC_STATUSES.includes(patch.kyc_status)) throw invalid(`KYC status must be one of: ${KYC_STATUSES.join(', ')}`); row.kyc_status = patch.kyc_status }
  }
  if (!Object.keys(row).length) return getInvestor(id)
  return unwrap(await supabase.from('investors').update(row).eq('id', Number(id)).select().single(), 'updateInvestor')
}
export async function attachInvestorAvatar(id, docId) { return unwrap(await supabase.from('investors').update({ avatar_document_id: Number(docId) }).eq('id', Number(id)).select('id').single(), 'attachInvestorAvatar') }
export async function getInvestor(id) { return (unwrap(await supabase.from('investors').select('*').eq('id', Number(id)).limit(1), 'getInvestor'))?.[0] ?? null }
export async function deleteInvestor(id) {
  const cur = await getInvestor(id); if (!cur) throw invalid('investor not found', 404)
  const used = unwrap(await supabase.from('investments').select('id').eq('investor_id', cur.id).limit(1), 'deleteInvestor:used') ?? []
  if (used.length) throw invalid('This investor has investments on record. Block the account instead of deleting it.')
  const docs = (await supabase.from('documents').select('path').eq('investor_id', cur.id)).data || []
  if (docs.length) await supabase.storage.from('documents').remove(docs.map(d => d.path)).catch(() => {})
  unwrap(await supabase.from('investors').delete().eq('id', cur.id), 'deleteInvestor')
  if (cur.user_id) await supabase.auth.admin.deleteUser(cur.user_id).catch(() => {})
  return { deleted: true, id: cur.id, name: cur.name }
}
export async function listInvestors({ q = '', limit = 2000 } = {}) {
  let qry = supabase.from('investors').select('*').order('created_at', { ascending: false }).limit(limit)
  const term = String(q || '').replace(/[%,()*]/g, ' ').trim()
  if (term) qry = qry.or(['name', 'email', 'phone'].map(c => `${c}.ilike.%${term}%`).join(','))
  const rows = unwrap(await qry, 'listInvestors') ?? []
  if (!rows.length) return []
  const inv = unwrap(await supabase.from('investments').select('investor_id,amount,status').in('investor_id', rows.map(r => r.id)), 'listInvestors:investments') ?? []
  return rows.map(r => { const mine = inv.filter(i => i.investor_id === r.id); return { ...safeInvestor(r), investments: mine.length, invested: money(mine.filter(i => ['active', 'matured'].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0)) } })
}

/* investments (applications) */
async function decorate(rows) {
  if (!rows.length) return rows
  const [opps, people, payouts] = await Promise.all([
    supabase.from('investment_opportunities').select('id,number,title,currency,tenor_months,expected_return_pct').in('id', [...new Set(rows.map(r => r.opportunity_id))]).then(r => r.data || []),
    supabase.from('investors').select('id,name,email,kyc_status').in('id', [...new Set(rows.map(r => r.investor_id))]).then(r => r.data || []),
    supabase.from('investment_payouts').select('*').in('investment_id', rows.map(r => r.id)).order('paid_on', { ascending: true }).then(r => r.data || []),
  ])
  return rows.map(r => { const mine = payouts.filter(p => p.investment_id === r.id).map(p => ({ ...p, amount: Number(p.amount) })); return { ...r, opportunity: opps.find(o => o.id === r.opportunity_id) || null, investor: people.find(p => p.id === r.investor_id) || null, payouts: mine, paid: money(mine.reduce((s, p) => s + p.amount, 0)) } })
}
export async function listInvestments({ investor_id = null, opportunity_id = null, status = 'all', limit = 2000 } = {}) {
  let q = supabase.from('investments').select('*').order('created_at', { ascending: false }).limit(limit)
  if (investor_id != null) q = q.eq('investor_id', Number(investor_id))
  if (opportunity_id != null) q = q.eq('opportunity_id', Number(opportunity_id))
  if (INVESTMENT_STATUSES.includes(status)) q = q.eq('status', status)
  const { data, error } = await q
  if (error) { if (missing(error)) return []; throw fail(error, 'listInvestments') }
  return decorate((data || []).map(invNumeric))
}
export async function getInvestment(id) {
  const { data, error } = await supabase.from('investments').select('*').eq('id', Number(id)).limit(1)
  if (error) throw fail(error, 'getInvestment')
  return data?.[0] ? (await decorate([invNumeric(data[0])]))[0] : null
}
const addMonths = (date, n) => { const d = new Date(`${date}T00:00:00Z`); const day = d.getUTCDate(); d.setUTCMonth(d.getUTCMonth() + n); if (d.getUTCDate() < day) d.setUTCDate(0); return d.toISOString().slice(0, 10) }
/** An investor applies to an open opportunity. */
export async function createInvestment(investor, opportunityNumber, input = {}) {
  const o = await getOpportunity(opportunityNumber)
  if (!o || !['published', 'closed'].includes(o.status)) throw invalid('This investment opportunity was not found.', 404)
  if (o.state !== 'open') throw invalid(o.state === 'upcoming' ? 'This opportunity is not open yet.' : 'This opportunity is closed.', 409)
  if (investor.status === 'blocked') throw invalid('This account cannot invest at the moment. Please contact us.', 403)
  const amount = money(input.amount); if (!(amount > 0)) throw invalid('Please enter the amount you want to invest.')
  if (amount < o.min_amount) throw invalid(`The minimum investment is ${o.currency} ${o.min_amount.toLocaleString('en-NG')}.`)
  if (o.available != null && amount > o.available + 0.005) throw invalid(o.available > 0 ? `Only ${o.currency} ${o.available.toLocaleString('en-NG')} is still available in this opportunity.` : 'This opportunity is fully subscribed.', 409)
  if (!input.confirmed || input.confirmed === 'false') throw invalid('Please confirm that you have read the terms of this opportunity.')
  const row = { opportunity_id: o.id, investor_id: investor.id, amount, currency: o.currency, status: 'pending', note: text(input.note, 2000) }
  const inv = invNumeric(await insertNumbered('investments', 'IV', row, null, 'Investment'))
  return { investment: inv, opportunity: o }
}
/** Staff move an application along: approve (it becomes active), reject, mark matured or paid out. */
export async function updateInvestment(id, patch = {}, actor = null) {
  const cur = await getInvestment(id); if (!cur) throw invalid('investment not found', 404)
  const row = {}
  if (has(patch, 'internal_notes')) row.internal_notes = text(patch.internal_notes, 5000)
  if (has(patch, 'status_note')) row.status_note = text(patch.status_note, 2000)
  if (has(patch, 'amount') && cur.status === 'pending') { row.amount = money(patch.amount); if (!(row.amount > 0)) throw invalid('The amount must be more than zero.') }
  let changed = false
  const status = has(patch, 'status') ? patch.status : cur.status
  if (status !== cur.status) {
    if (!INVESTMENT_STATUSES.includes(status)) throw invalid(`status must be one of: ${INVESTMENT_STATUSES.join(', ')}`)
    Object.assign(row, { status, reviewed_by: actor?.id ?? null, reviewed_at: new Date().toISOString() }); changed = true
  }
  if (status === 'active' && (changed || has(patch, 'start_date') || has(patch, 'maturity_date') || has(patch, 'expected_return'))) {
    const o = cur.opportunity || {}
    const amount = row.amount ?? cur.amount
    row.start_date = patch.start_date ? dateOnly(patch.start_date, 'Start date') : (cur.start_date || today())
    row.maturity_date = patch.maturity_date ? dateOnly(patch.maturity_date, 'Maturity date') : (changed || has(patch, 'start_date') ? addMonths(row.start_date, o.tenor_months || 12) : cur.maturity_date)
    if (row.maturity_date <= row.start_date) throw invalid('The maturity date must be after the start date.')
    row.expected_return = has(patch, 'expected_return') && patch.expected_return !== '' && patch.expected_return != null ? money(patch.expected_return) : (cur.expected_return ?? (o.expected_return_pct != null ? money(amount * Number(o.expected_return_pct) / 100) : null))
  }
  if (!Object.keys(row).length) return { investment: cur, changed: false }
  unwrap(await supabase.from('investments').update(row).eq('id', cur.id).select().single(), 'updateInvestment')
  return { investment: await getInvestment(cur.id), changed, previous: cur.status }
}
export async function setInvestmentProof(id, documentId) { await supabase.from('investments').update({ proof_document_id: Number(documentId) }).eq('id', Number(id)) }
export async function deleteInvestment(id) {
  const cur = await getInvestment(id); if (!cur) throw invalid('investment not found', 404)
  if (!['pending', 'rejected', 'cancelled'].includes(cur.status)) throw invalid('An investment that was approved stays on record. Cancel it instead.')
  unwrap(await supabase.from('investments').delete().eq('id', cur.id), 'deleteInvestment')
  return { deleted: true, id: cur.id, number: cur.number }
}
export async function addPayout(investmentId, input = {}, actorId = null) {
  const inv = await getInvestment(investmentId); if (!inv) throw invalid('investment not found', 404)
  if (!['active', 'matured', 'paid_out'].includes(inv.status)) throw invalid('Payments can be recorded once the investment is active.', 409)
  const amount = money(input.amount); if (!(amount > 0)) throw invalid('Please enter the amount paid.')
  const row = { investment_id: inv.id, kind: input.kind === 'principal' ? 'principal' : 'return', amount, paid_on: input.paid_on ? dateOnly(input.paid_on, 'Payment date') : today(), reference: tt(input.reference, 120), note: text(input.note, 1000), created_by: actorId }
  const payout = unwrap(await supabase.from('investment_payouts').insert(row).select().single(), 'addPayout')
  return { payout: { ...payout, amount: Number(payout.amount) }, investment: await getInvestment(inv.id) }
}
export async function deletePayout(investmentId, payoutId) {
  unwrap(await supabase.from('investment_payouts').delete().eq('id', Number(payoutId)).eq('investment_id', Number(investmentId)), 'deletePayout')
  return getInvestment(investmentId)
}
/** What an investor sees of their own investment. */
export const publicInvestment = i => ({ id: i.id, number: i.number, amount: i.amount, currency: i.currency, status: i.state, label: INVESTMENT_LABELS[i.state], status_note: i.status_note, note: i.note,
  start_date: i.start_date, maturity_date: i.maturity_date, expected_return: i.expected_return, created_at: i.created_at, has_proof: i.proof_document_id != null,
  opportunity: i.opportunity && { number: i.opportunity.number, title: i.opportunity.title, tenor_months: i.opportunity.tenor_months, expected_return_pct: i.opportunity.expected_return_pct == null ? null : Number(i.opportunity.expected_return_pct) },
  payouts: (i.payouts || []).map(p => ({ id: p.id, kind: p.kind, amount: p.amount, paid_on: p.paid_on, reference: p.reference, note: p.note })), paid: i.paid })
/** Totals for the panel and the reports page. */
export async function investmentTotals() {
  const { data, error } = await supabase.from('investments').select('amount,status,maturity_date,currency')
  if (error) return { committed: 0, active: 0, pending: 0, maturing_soon: 0, investors: 0 }
  const soon = new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10)
  const sum = list => money(list.reduce((s, i) => s + Number(i.amount), 0))
  const { count } = await supabase.from('investors').select('*', { count: 'exact', head: true })
  return { committed: sum(data.filter(i => COMMITTED.includes(i.status))), active: sum(data.filter(i => i.status === 'active')), pending: data.filter(i => i.status === 'pending').length, maturing_soon: data.filter(i => i.status === 'active' && i.maturity_date && i.maturity_date <= soon).length, investors: count ?? 0 }
}
