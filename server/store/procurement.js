/*
 * Procurement store — the sourcing leg, beside sales (Supabase only).
 *
 *   suppliers        the procurement "clients": records staff keep and accounts suppliers open
 *   tenders          bidding opportunities published on the site
 *   bids             what a supplier offers on a tender; staff move its status along
 *   bid requests     requests for additional information, and the supplier's answers
 *   purchase orders  PO / LPO issued to a supplier — what an invoice is to sales
 *
 * Validation problems are thrown with `expose: true` (safe to show to whoever
 * called); database failures are not, and a missing migration says which
 * file to run. Needs server/migrations/014_procurement.sql.
 */
import { randomBytes, createHash } from 'node:crypto'
import { supabase, getSettings, normaliseItems, quoteTotals } from './supabase.js'

export const UPGRADE_HINT = 'This needs the database migration 015: run server/migrations/015_portals_permissions.sql in the Supabase SQL editor first.'
export const PROCUREMENT_MIGRATION_HINT = 'Procurement needs the database migration 014: run server/migrations/014_procurement.sql in the Supabase SQL editor first.'
const errText = e => `${e?.message || ''} ${e?.details || ''}`
const missingSchema = e => ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e?.code)
const invalid = (message, status = 400) => Object.assign(new Error(message), { expose: true, status })
const fail = (e, ctx) => (missingSchema(e) ? invalid(PROCUREMENT_MIGRATION_HINT, 409) : new Error(`${ctx}: ${e.message}`))
const unwrap = ({ data, error }, ctx) => { if (error) throw fail(error, ctx); return data }

const tt = (s, max = 200) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const text = (s, max = 5000) => String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)   // keeps line breaks
const money = v => Math.round((Number(v) || 0) * 100) / 100
const qty3 = v => Math.round((Number(v) || 0) * 1000) / 1000
const idOrNull = v => (v == null || v === '' ? null : Number(v))
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const sha256 = s => createHash('sha256').update(String(s)).digest('hex')
const like = s => String(s || '').replace(/[%,()*]/g, ' ').trim()
const currencyCode = (c, fallback = 'NGN') => { const s = String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); return s.length === 3 ? s : fallback }
const dateOnly = (v, label) => { const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw invalid(`${label} must be a date`); return s }
const moment = (v, label) => { const d = new Date(v); if (v == null || v === '' || Number.isNaN(d.getTime())) throw invalid(`${label} must be a date and time`); return d.toISOString() }
const has = (o, k) => o != null && o[k] !== undefined

/* ------------------------------------------------------------ numbers --- */
// VB-2026-0001 (bidding opportunity), PO-2026-0001, LPO-2026-0001. The
// prefix and the year are fixed; staff may choose the digits, otherwise the
// next free number for the year is used. `number` is unique in the
// database, so two people creating at once are settled by retrying.
export const TENDER_PREFIX = 'VB'
const numberRe = prefix => new RegExp(`^${prefix}-(\\d{4})-(\\d{1,6})$`)
const numberOf = (prefix, year, n) => `${prefix}-${year}-${String(n).padStart(4, '0')}`
function parseNumber(input, prefix, year, what) {
  const s = String(input ?? '').trim().toUpperCase()
  const example = numberOf(prefix, year, 1)
  let digits
  if (/^\d{1,6}$/.test(s)) digits = s
  else { const m = numberRe(prefix).exec(s); if (!m || Number(m[1]) !== year) throw invalid(`${what} numbers look like ${example}; only the digits after ${prefix}-${year}- can be changed`); digits = m[2] }
  const n = Number(digits)
  if (!Number.isInteger(n) || n < 1) throw invalid(`The ${what.toLowerCase()} number must be 1 or higher (e.g. ${example})`)
  return numberOf(prefix, year, n)
}
async function highest(table, prefix, year) {
  const rows = unwrap(await supabase.from(table).select('number').like('number', `${prefix}-${year}-%`), 'highestNumber')
  const re = numberRe(prefix)
  return (rows || []).reduce((max, r) => { const m = re.exec(r.number); return m ? Math.max(max, Number(m[2])) : max }, 0)
}
const isDuplicateNumber = e => e?.code === '23505' && /number/i.test(errText(e))
export async function insertNumbered(table, prefix, row, manualInput, what) {
  const year = new Date().getFullYear()
  const manual = manualInput != null && String(manualInput).trim() !== '' ? parseNumber(manualInput, prefix, year, what) : null
  for (let attempt = 0; attempt < 6; attempt++) {
    const number = manual || numberOf(prefix, year, await highest(table, prefix, year) + 1)
    const { data, error } = await supabase.from(table).insert({ ...row, number }).select().single()
    if (!error) return data
    if (!isDuplicateNumber(error)) throw fail(error, `create ${what.toLowerCase()}`)
    if (manual) throw invalid(`${number} is already in use`)
  }
  throw new Error(`could not allocate a ${what.toLowerCase()} number; please try again`)
}

/* ---------------------------------------------------------- suppliers --- */

export const SUPPLIER_STATUSES = ['active', 'blocked', 'archived']
/** Never hand the one-time token fields to anyone. */
export const safeSupplier = s => { if (!s) return s; const { auth_token_hash, auth_token_kind, auth_token_expires, ...rest } = s; return { ...rest, has_account: Boolean(s.user_id) } }

function cleanSupplier(input = {}, { partial = false } = {}) {
  const row = {}
  if (!partial || has(input, 'company_name')) { const n = tt(input.company_name, 200); if (!n) throw invalid('Please enter the company name.'); row.company_name = n }
  if (has(input, 'contact_person')) row.contact_person = tt(input.contact_person, 120)
  if (has(input, 'email')) { const e = tt(input.email, 200).toLowerCase(); if (e && !EMAIL_RE.test(e)) throw invalid('Please enter a valid email address.'); row.email = e }
  if (has(input, 'phone')) row.phone = tt(input.phone, 60)
  if (has(input, 'address')) row.address = text(input.address, 500)
  if (has(input, 'commodities')) row.commodities = tt(input.commodities, 500)
  if (has(input, 'notes')) row.notes = text(input.notes, 5000)
  if (has(input, 'status')) { if (!SUPPLIER_STATUSES.includes(input.status)) throw invalid(`status must be one of: ${SUPPLIER_STATUSES.join(', ')}`); row.status = input.status }
  return row
}
const dupEmail = e => e?.code === '23505' && /email/i.test(errText(e))

export async function listSuppliers({ status = 'active', q = '', limit = 1000 } = {}) {
  let qry = supabase.from('suppliers').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status !== 'all') qry = qry.eq('status', status)
  const term = like(q)
  if (term) qry = qry.or(['company_name', 'contact_person', 'email', 'phone', 'commodities'].map(c => `${c}.ilike.%${term}%`).join(','))
  const rows = unwrap(await qry, 'listSuppliers') ?? []
  if (!rows.length) return []
  const bids = unwrap(await supabase.from('bids').select('supplier_id,status,created_at').in('supplier_id', rows.map(r => r.id)), 'listSuppliers:bids') ?? []
  return rows.map(r => {
    const mine = bids.filter(b => b.supplier_id === r.id)
    return { ...safeSupplier(r), bids: mine.length, awarded: mine.filter(b => b.status === 'awarded').length, last_bid_at: mine.reduce((m, b) => (b.created_at > m ? b.created_at : m), '') || null }
  })
}
const supplierRow = async id => (unwrap(await supabase.from('suppliers').select('*').eq('id', Number(id)).limit(1), 'getSupplier'))?.[0] ?? null
export async function getSupplier(id) { return safeSupplier(await supplierRow(id)) }
export async function getSupplierByUser(userId) {
  return safeSupplier((unwrap(await supabase.from('suppliers').select('*').eq('user_id', String(userId)).limit(1), 'getSupplierByUser'))?.[0] ?? null)
}
export async function findSupplierByEmail(email) {
  const e = tt(email, 200).toLowerCase(); if (!e) return null
  return safeSupplier((unwrap(await supabase.from('suppliers').select('*').ilike('email', e.replace(/[%_\\]/g, m => `\\${m}`)).limit(1), 'findSupplierByEmail'))?.[0] ?? null)
}
export async function createSupplier(input, { source = 'admin', actorId = null, userId = null } = {}) {
  const row = { contact_person: '', email: '', phone: '', address: '', commodities: '', notes: '', ...cleanSupplier(input), status: 'active', source, created_by: actorId, ...(userId ? { user_id: userId } : {}) }
  if (source !== 'admin') row.notes = ''
  const { data, error } = await supabase.from('suppliers').insert(row).select().single()
  if (error) throw (dupEmail(error) ? invalid('A supplier with this email address already exists.', 409) : fail(error, 'createSupplier'))
  return safeSupplier(data)
}
export async function updateSupplier(id, patch) {
  const cur = await supplierRow(id); if (!cur) throw invalid('supplier not found', 404)
  const row = cleanSupplier(patch, { partial: true })
  if (!Object.keys(row).length) return safeSupplier(cur)
  // The email of an account is its sign-in address: changing the record must not detach the two.
  if (row.email !== undefined && cur.user_id && row.email !== cur.email) throw invalid('This supplier signs in with that email address, so it cannot be changed here.')
  const { data, error } = await supabase.from('suppliers').update(row).eq('id', cur.id).select().single()
  if (error) throw (dupEmail(error) ? invalid('Another supplier already uses this email address.', 409) : fail(error, 'updateSupplier'))
  return safeSupplier(data)
}
export async function deleteSupplier(id) {
  const cur = await supplierRow(id); if (!cur) throw invalid('supplier not found', 404)
  const orders = unwrap(await supabase.from('purchase_orders').select('id,status').eq('supplier_id', cur.id).neq('status', 'draft').limit(1), 'deleteSupplier:orders') ?? []
  if (orders.length) throw invalid('This supplier has purchase orders. Archive the supplier instead of deleting it.')
  const docs = unwrap(await supabase.from('documents').select('path').eq('supplier_id', cur.id), 'deleteSupplier:documents') ?? []
  if (docs.length) await supabase.storage.from('documents').remove(docs.map(d => d.path)).catch(() => {})
  unwrap(await supabase.from('suppliers').delete().eq('id', cur.id), 'deleteSupplier')
  if (cur.user_id) await supabase.auth.admin.deleteUser(cur.user_id).catch(() => {})
  return { deleted: true, id: cur.id, name: cur.company_name, had_account: Boolean(cur.user_id) }
}

/** A one-time link token (confirm email / reset password). Only its hash is stored. */
export async function issueSupplierToken(id, kind, hours = 24) {
  const token = randomBytes(32).toString('hex')
  unwrap(await supabase.from('suppliers').update({ auth_token_hash: sha256(token), auth_token_kind: kind, auth_token_expires: new Date(Date.now() + hours * 3600e3).toISOString() }).eq('id', Number(id)).select('id').single(), 'issueSupplierToken')
  return token
}
/** The supplier a token belongs to, or null. `consume` clears it so the link works once. */
export async function supplierForToken(token, kind, { consume = false } = {}) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return null
  const row = (unwrap(await supabase.from('suppliers').select('*').eq('auth_token_hash', sha256(token)).in('auth_token_kind', [].concat(kind)).limit(1), 'supplierForToken'))?.[0]
  if (!row || !row.auth_token_expires || row.auth_token_expires < new Date().toISOString()) return null
  if (consume) await supabase.from('suppliers').update({ auth_token_hash: null, auth_token_kind: null, auth_token_expires: null }).eq('id', row.id)
  return row
}
export async function attachSupplierAccount(id, userId) {
  return safeSupplier(unwrap(await supabase.from('suppliers').update({ user_id: userId }).eq('id', Number(id)).select().single(), 'attachSupplierAccount'))
}
/** Email confirmed: stamp it, and file the bids made with that address before the account existed. */
export async function markSupplierVerified(id) {
  const s = unwrap(await supabase.from('suppliers').update({ verified_at: new Date().toISOString() }).eq('id', Number(id)).select().single(), 'markSupplierVerified')
  if (s.email) await supabase.from('bids').update({ supplier_id: s.id }).is('supplier_id', null).ilike('email', s.email)
  return safeSupplier(s)
}

/* ------------------------------------------------------------ tenders --- */

export const TENDER_STATUSES = ['draft', 'published', 'closed', 'awarded', 'cancelled']
/** What a tender is right now: a published one is upcoming, open or closed by its dates. */
export function tenderState(t, now = Date.now()) {
  if (t.status !== 'published') return t.status
  if (Date.parse(t.opens_at) > now) return 'upcoming'
  if (Date.parse(t.closes_at) <= now) return 'closed'
  return 'open'
}

function cleanTender(input = {}, settings, { partial = false, existing = null } = {}) {
  const p = settings.procurement || {}
  const row = {}
  if (!partial || has(input, 'commodity')) { const c = tt(input.commodity, 120); if (!c) throw invalid('Please enter the commodity.'); row.commodity = c }
  if (!partial || has(input, 'title')) row.title = tt(input.title, 200) || `${row.commodity ?? existing?.commodity} supply opportunity`
  if (!partial || has(input, 'quantity')) { const n = qty3(input.quantity); if (!(n > 0)) throw invalid('The required quantity must be more than zero.'); row.quantity = n }
  if (!partial || has(input, 'unit')) row.unit = tt(input.unit, 20) || p.default_unit || 'MT'
  if (has(input, 'specification')) row.specification = text(input.specification, 4000)
  if (has(input, 'delivery_location')) row.delivery_location = tt(input.delivery_location, 200)
  if (has(input, 'delivery_period')) row.delivery_period = tt(input.delivery_period, 200)
  if (has(input, 'delivery_by')) row.delivery_by = input.delivery_by ? dateOnly(input.delivery_by, 'Delivery date') : null
  if (has(input, 'asking_price')) {
    if (input.asking_price == null || input.asking_price === '') row.asking_price = null
    else { const n = money(input.asking_price); if (n < 0) throw invalid('The asking price cannot be negative.'); row.asking_price = n }
  }
  if (!partial || has(input, 'currency')) row.currency = currencyCode(input.currency || p.default_currency)
  if (!partial || has(input, 'payment_terms')) row.payment_terms = has(input, 'payment_terms') ? text(input.payment_terms, 2000) : (p.payment_terms || '')
  if (has(input, 'requirements')) row.requirements = text(input.requirements, 4000)
  if (has(input, 'required_documents')) row.required_documents = [...new Set((Array.isArray(input.required_documents) ? input.required_documents : []).map(x => tt(x, 80)).filter(Boolean))].slice(0, 10)
  if (has(input, 'opens_at') && input.opens_at) row.opens_at = moment(input.opens_at, 'Bid opening')
  if (!partial || has(input, 'closes_at')) { if (!input.closes_at) throw invalid('Please set the bid closing date.'); row.closes_at = moment(input.closes_at, 'Bid closing') }
  if (has(input, 'status')) { if (!TENDER_STATUSES.includes(input.status)) throw invalid(`status must be one of: ${TENDER_STATUSES.join(', ')}`); row.status = input.status }
  const opens = row.opens_at ?? existing?.opens_at ?? new Date().toISOString(), closes = row.closes_at ?? existing?.closes_at
  if (closes && Date.parse(closes) <= Date.parse(opens)) throw invalid('Bids must close after they open.')
  // Publishing (or re-dating a published one) needs a closing date still ahead.
  const status = row.status ?? existing?.status ?? 'draft'
  if (status === 'published' && (row.status === 'published' && existing?.status !== 'published' || row.closes_at) && Date.parse(closes) <= Date.now()) throw invalid('The bid closing date has already passed. Move it forward to publish.')
  return row
}
const withState = t => ({ ...t, quantity: Number(t.quantity), asking_price: t.asking_price == null ? null : Number(t.asking_price), state: tenderState(t) })
/** Total requirement → total awarded → balance, for a tender and its bids. */
export function awardSummary(tender, bids) {
  const won = bids.filter(b => b.status === 'awarded')
  const awarded = qty3(won.reduce((s, b) => s + Number(b.awarded_quantity ?? b.quantity), 0))
  const value = money(won.reduce((s, b) => s + Number(b.awarded_quantity ?? b.quantity) * Number(b.awarded_price ?? b.price), 0))
  const required = Number(tender.quantity)
  return { required, awarded, balance: qty3(Math.max(0, required - awarded)), awarded_pct: required > 0 ? Math.round(awarded / required * 1000) / 10 : 0, suppliers: won.length, value }
}
const bidCounts = bids => { const c = { total: 0, open: 0, under_review: 0, shortlisted: 0, awarded: 0, not_selected: 0, withdrawn: 0 }; for (const b of bids) { c.total++; if (c[b.status] !== undefined) c[b.status]++ } return c }

export async function listTenders({ status = 'all', q = '', limit = 500 } = {}) {
  let qry = supabase.from('tenders').select('*').order('created_at', { ascending: false }).limit(limit)
  if (TENDER_STATUSES.includes(status)) qry = qry.eq('status', status)
  const term = like(q)
  if (term) qry = qry.or(['number', 'title', 'commodity', 'delivery_location'].map(c => `${c}.ilike.%${term}%`).join(','))
  let rows = (unwrap(await qry, 'listTenders') ?? []).map(withState)
  if (['open', 'upcoming'].includes(status)) rows = rows.filter(t => t.state === status)
  if (!rows.length) return []
  const bids = unwrap(await supabase.from('bids').select('tender_id,status,price').in('tender_id', rows.map(r => r.id)), 'listTenders:bids') ?? []
  return rows.map(t => {
    const mine = bids.filter(b => b.tender_id === t.id), live = mine.filter(b => b.status !== 'withdrawn')
    return { ...t, bids: bidCounts(mine), lowest_price: live.length ? Math.min(...live.map(b => Number(b.price))) : null }
  })
}
const tenderRow = async idOrNumber => {
  const s = String(idOrNumber ?? '').trim()
  const qry = /^\d+$/.test(s) ? supabase.from('tenders').select('*').eq('id', Number(s)) : supabase.from('tenders').select('*').eq('number', s.toUpperCase())
  return (unwrap(await qry.limit(1), 'getTender'))?.[0] ?? null
}
export async function getTender(idOrNumber) { const t = await tenderRow(idOrNumber); return t ? withState(t) : null }
export async function createTender(input, actorId = null) {
  const settings = await getSettings()
  const row = { specification: '', delivery_location: '', delivery_period: '', requirements: '', status: 'draft', ...cleanTender(input, settings), created_by: actorId }
  const make = r => insertNumbered('tenders', TENDER_PREFIX, r, input?.number, 'Opportunity')
  try { return withState(await make(row)) }
  catch (e) {   // before migration 015 there is no list of required documents: save the rest
    if (!('required_documents' in row) || !/required_documents|database migration/.test(e.message)) throw e
    const { required_documents: _r, ...rest } = row
    return withState(await make(rest))
  }
}
export async function updateTender(id, patch) {
  const cur = await tenderRow(id); if (!cur) throw invalid('opportunity not found', 404)
  const row = cleanTender(patch, await getSettings(), { partial: true, existing: cur })
  if (has(patch, 'number') && String(patch.number).trim() !== '') {
    const number = parseNumber(patch.number, TENDER_PREFIX, Number(numberRe(TENDER_PREFIX).exec(cur.number)?.[1]) || new Date(cur.created_at).getFullYear(), 'Opportunity')
    if (number !== cur.number) { const clash = await tenderRow(number); if (clash && clash.id !== cur.id) throw invalid(`${number} is already in use`); row.number = number }
  }
  if (!Object.keys(row).length) return withState(cur)
  let saved = await supabase.from('tenders').update(row).eq('id', cur.id).select().single()
  if (saved.error && missingSchema(saved.error) && 'required_documents' in row) {   // before migration 015: save the rest
    const { required_documents: _r, ...rest } = row
    if (!Object.keys(rest).length) return withState(cur)
    saved = await supabase.from('tenders').update(rest).eq('id', cur.id).select().single()
  }
  return withState(unwrap(saved, 'updateTender'))
}
export async function deleteTender(id) {
  const cur = await tenderRow(id); if (!cur) throw invalid('opportunity not found', 404)
  const bids = unwrap(await supabase.from('bids').select('id').eq('tender_id', cur.id).limit(1), 'deleteTender:bids') ?? []
  if (bids.length) throw invalid('This opportunity has bids. Cancel it instead of deleting it, so the suppliers keep their record.')
  unwrap(await supabase.from('tenders').delete().eq('id', cur.id), 'deleteTender')
  return { deleted: true, id: cur.id, number: cur.number }
}
/** What the website shows: nothing internal, and whether bids are being taken. */
export const publicTender = t => ({
  number: t.number, title: t.title, commodity: t.commodity, quantity: Number(t.quantity), unit: t.unit, specification: t.specification,
  delivery_location: t.delivery_location, delivery_period: t.delivery_period, delivery_by: t.delivery_by,
  asking_price: t.asking_price == null ? null : Number(t.asking_price), currency: t.currency, payment_terms: t.payment_terms, requirements: t.requirements,
  opens_at: t.opens_at, closes_at: t.closes_at, state: tenderState(t), accepting_bids: tenderState(t) === 'open',
  required_documents: Array.isArray(t.required_documents) ? t.required_documents : [],
})
/** Opportunities for the website: open and upcoming first, then the ones closed in the last 30 days. */
export async function listPublicTenders() {
  const since = new Date(Date.now() - 30 * 86400e3).toISOString()
  const rows = unwrap(await supabase.from('tenders').select('*').in('status', ['published', 'closed', 'awarded']).gte('closes_at', since).order('closes_at', { ascending: true }).limit(200), 'listPublicTenders') ?? []
  const rank = { open: 0, upcoming: 1, closed: 2, awarded: 2 }
  return rows.map(publicTender).sort((a, b) => (rank[a.state] - rank[b.state]) || (a.state === 'open' || a.state === 'upcoming' ? a.closes_at.localeCompare(b.closes_at) : b.closes_at.localeCompare(a.closes_at)))
}
export async function getPublicTender(number) {
  const t = await tenderRow(String(number || '').toUpperCase())
  return t && ['published', 'closed', 'awarded'].includes(t.status) ? publicTender(t) : null
}

/* --------------------------------------------------------------- bids --- */

export const BID_STATUSES = ['open', 'under_review', 'shortlisted', 'awarded', 'not_selected', 'withdrawn']
export const BID_LABELS = { open: 'Open', under_review: 'Under review', shortlisted: 'Shortlisted', awarded: 'Awarded', not_selected: 'Not selected', withdrawn: 'Withdrawn' }
const BID_LIVE = ['open', 'under_review', 'shortlisted']
export const BID_DECLARATION = 'I confirm that the information provided is accurate and that I am able to supply the stated quantity in accordance with the specifications, delivery requirements and payment terms stated in this bidding opportunity.'
export const BID_MAX_FILES = 10
const truthy = v => v === true || v === 'true' || v === 1 || v === '1' || v === 'yes' || v === 'accept'
const falsy = v => v === false || v === 'false' || v === 0 || v === '0' || v === 'no' || v === 'decline'
const numeric = b => ({ ...b, quantity: Number(b.quantity), price: Number(b.price), total: Number(b.total), awarded_quantity: b.awarded_quantity == null ? null : Number(b.awarded_quantity), awarded_price: b.awarded_price == null ? null : Number(b.awarded_price) })
const bidRow = async id => { const r = (unwrap(await supabase.from('bids').select('*').eq('id', Number(id)).limit(1), 'getBid'))?.[0]; return r ? numeric(r) : null }
/** No upload token, no address of the machine that sent it. */
const safeBid = b => { if (!b) return b; const { upload_token_hash, upload_token_expires, ip, ...rest } = b; return rest }

/**
 * A supplier's offer on an open opportunity. `supplier` is the signed-in
 * account, if any; otherwise the supplier record is found (or started) from
 * the email address. Returns the bid and, for a bidder without an account,
 * a short-lived token that lets them attach their documents.
 */
export async function createBid(tenderNumber, input = {}, { supplier = null, ip = '' } = {}) {
  const tender = await tenderRow(tenderNumber)
  if (!tender || !['published', 'closed', 'awarded'].includes(tender.status)) throw invalid('This bidding opportunity was not found.', 404)
  const state = tenderState(tender)
  if (state !== 'open') throw invalid(state === 'upcoming' ? 'This opportunity is not open for bids yet.' : 'This opportunity is closed for bids.', 409)

  const company_name = tt(input.company_name ?? supplier?.company_name, 200); if (!company_name) throw invalid('Please enter your company name.')
  const contact_person = tt(input.contact_person ?? supplier?.contact_person, 120); if (!contact_person) throw invalid('Please enter the contact person.')
  const phone = tt(input.phone ?? supplier?.phone, 60); if (!phone) throw invalid('Please enter a phone number.')
  // An account bids under its own (confirmed) address.
  const email = supplier ? supplier.email : tt(input.email, 200).toLowerCase(); if (!EMAIL_RE.test(email)) throw invalid('Please enter a valid email address.')
  const address = text(input.address ?? supplier?.address, 500); if (!address) throw invalid('Please enter your company address.')
  const quantity = qty3(input.quantity); if (!(quantity > 0)) throw invalid('Please enter the quantity you can supply.')
  const price = money(input.price); if (!(price > 0)) throw invalid(`Please enter your proposed price per ${tender.unit}.`)
  const commodity_location = tt(input.commodity_location, 200); if (!commodity_location) throw invalid('Please say where the commodity is located.')
  if (!input.delivery_date) throw invalid('Please give your expected delivery date.')
  const delivery_date = dateOnly(input.delivery_date, 'Expected delivery date')
  if (delivery_date < new Date().toISOString().slice(0, 10)) throw invalid('The expected delivery date cannot be in the past.')
  if (!truthy(input.accepts_terms) && !falsy(input.accepts_terms)) throw invalid('Please say whether you accept the stated payment terms.')
  if (!truthy(input.confirmed)) throw invalid('Please tick the confirmation to submit your bid.')

  let owner = supplier
  if (!owner) {
    owner = await findSupplierByEmail(email)
    if (!owner) owner = await createSupplier({ company_name, contact_person, email, phone, address, commodities: tender.commodity }, { source: 'bid' }).catch(async e => (e.status === 409 ? findSupplierByEmail(email) : Promise.reject(e)))
  }
  if (owner?.status === 'blocked') throw invalid('We cannot accept bids from this supplier at the moment. Please contact us.', 403)

  const mine = unwrap(await supabase.from('bids').select('id,status').eq('tender_id', tender.id).or(`supplier_id.eq.${owner.id},email.ilike.${email.replace(/[%_\\,()]/g, '')}`), 'createBid:existing') ?? []
  if (mine.some(b => b.status !== 'withdrawn')) throw invalid('You have already submitted a bid for this opportunity. Withdraw it first if you want to submit a new one.', 409)

  const token = supplier ? null : randomBytes(24).toString('hex')
  const row = {
    tender_id: tender.id, supplier_id: owner.id, company_name, contact_person, phone, email, address,
    commodity: tt(input.commodity, 120) || tender.commodity, quantity, unit: tender.unit, price, currency: tender.currency, total: money(quantity * price),
    commodity_location, delivery_date, accepts_terms: truthy(input.accepts_terms), terms_note: text(input.terms_note, 1000), note: text(input.note, 3000),
    confirmed_at: new Date().toISOString(), status: 'open', ip: tt(ip, 80),
    ...(token ? { upload_token_hash: sha256(token), upload_token_expires: new Date(Date.now() + 2 * 3600e3).toISOString() } : {}),
  }
  const bid = numeric(unwrap(await supabase.from('bids').insert(row).select().single(), 'createBid'))
  return { bid: safeBid(bid), tender: withState(tender), supplier: owner, upload_token: token }
}
/** The bid a guest's upload token belongs to, while it is valid. */
export async function bidForUploadToken(bidId, token) {
  if (!/^[0-9a-f]{48}$/.test(String(token || ''))) return null
  const b = await bidRow(bidId)
  if (!b || b.upload_token_hash !== sha256(token) || !b.upload_token_expires || b.upload_token_expires < new Date().toISOString()) return null
  return b
}
export async function countBidFiles(bidId) {
  const { count, error } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('bid_id', Number(bidId))
  if (error) throw fail(error, 'countBidFiles')
  return count ?? 0
}

/**
 * Bids for the panel, filtered and ordered for comparison. Against the
 * asking price: `vs_asking` is the supplier's price minus ours per unit
 * (negative = cheaper than asked) and `vs_asking_pct` the same in percent.
 */
export async function listBids({ tender_id = null, supplier_id = null, status = 'all', q = '', min_price = null, max_price = null, min_quantity = null, max_quantity = null, location = '', accepts_terms = null, sort = 'date', dir = null, limit = 2000 } = {}) {
  let qry = supabase.from('bids').select('*').order('created_at', { ascending: false }).limit(limit)
  if (tender_id != null) qry = qry.eq('tender_id', Number(tender_id))
  if (supplier_id != null) qry = qry.eq('supplier_id', Number(supplier_id))
  if (BID_STATUSES.includes(status)) qry = qry.eq('status', status)
  else if (status === 'live') qry = qry.in('status', BID_LIVE)
  let rows = (unwrap(await qry, 'listBids') ?? []).map(numeric)
  const num = v => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
  const lo = num(min_price), hi = num(max_price), qlo = num(min_quantity), qhi = num(max_quantity)
  if (lo != null) rows = rows.filter(b => b.price >= lo)
  if (hi != null) rows = rows.filter(b => b.price <= hi)
  if (qlo != null) rows = rows.filter(b => b.quantity >= qlo)
  if (qhi != null) rows = rows.filter(b => b.quantity <= qhi)
  const loc = tt(location).toLowerCase(); if (loc) rows = rows.filter(b => b.commodity_location.toLowerCase().includes(loc))
  if (accepts_terms != null && accepts_terms !== '') rows = rows.filter(b => b.accepts_terms === truthy(accepts_terms))
  const term = tt(q).toLowerCase()
  if (term) rows = rows.filter(b => [b.company_name, b.contact_person, b.email, b.phone, b.commodity, b.commodity_location].some(v => String(v || '').toLowerCase().includes(term)))
  if (!rows.length) return []
  const ids = rows.map(b => b.id), tids = [...new Set(rows.map(b => b.tender_id))]
  const [tenders, docs, reqs] = await Promise.all([
    supabase.from('tenders').select('id,number,title,commodity,quantity,unit,asking_price,currency,status,opens_at,closes_at').in('id', tids).then(r => unwrap(r, 'listBids:tenders') ?? []),
    supabase.from('documents').select('bid_id').in('bid_id', ids).eq('status', 'ready').then(r => unwrap(r, 'listBids:documents') ?? []),
    supabase.from('bid_requests').select('bid_id,answered_at').in('bid_id', ids).then(r => unwrap(r, 'listBids:requests') ?? []),
  ])
  const out = rows.map(b => {
    const t = tenders.find(x => x.id === b.tender_id)
    const asking = t?.asking_price == null ? null : Number(t.asking_price)
    return {
      ...safeBid(b), label: BID_LABELS[b.status],
      tender: t ? { id: t.id, number: t.number, title: t.title, commodity: t.commodity, quantity: Number(t.quantity), unit: t.unit, asking_price: asking, currency: t.currency, state: tenderState(t) } : null,
      vs_asking: asking == null ? null : money(b.price - asking), vs_asking_pct: asking ? Math.round((b.price - asking) / asking * 1000) / 10 : null,
      covers_pct: t && Number(t.quantity) > 0 ? Math.round(b.quantity / Number(t.quantity) * 1000) / 10 : null,
      documents: docs.filter(d => d.bid_id === b.id).length,
      unlocked: Boolean(b.unlocked_at),
      requests_open: reqs.filter(r => r.bid_id === b.id && !r.answered_at).length, requests: reqs.filter(r => r.bid_id === b.id).length,
    }
  })
  // Among one supplier's bids on one opportunity, the newest that was not withdrawn is the active one.
  const groups = new Map()
  for (const b of out) { const k = `${b.tender_id}|${b.supplier_id ?? b.email.toLowerCase()}`; (groups.get(k) || groups.set(k, []).get(k)).push(b) }
  for (const g of groups.values()) {
    const active = g.filter(b => b.status !== 'withdrawn').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    for (const b of g) { b.submissions = g.length; b.latest = b === active; b.superseded = b.status === 'withdrawn' && Boolean(active) }
  }
  const by = { price: b => b.price, quantity: b => b.quantity, total: b => b.total, delivery: b => b.delivery_date || '9999', supplier: b => b.company_name.toLowerCase(), date: b => b.created_at }[sort] || (b => b.created_at)
  const down = (dir || (sort === 'date' || sort === 'quantity' ? 'desc' : 'asc')) === 'desc'
  return out.sort((a, b) => { const x = by(a), y = by(b); return (x < y ? -1 : x > y ? 1 : 0) * (down ? -1 : 1) })
}

async function bidExtras(b) {
  const [tender, supplier, documents, requests, orders] = await Promise.all([
    tenderRow(b.tender_id),
    b.supplier_id ? supplierRow(b.supplier_id) : null,
    supabase.from('documents').select('*').eq('bid_id', b.id).eq('status', 'ready').order('created_at', { ascending: true }).then(r => unwrap(r, 'getBid:documents') ?? []),
    supabase.from('bid_requests').select('*').eq('bid_id', b.id).order('asked_at', { ascending: true }).then(r => unwrap(r, 'getBid:requests') ?? []),
    supabase.from('purchase_orders').select('id,kind,number,token,status,total,currency,issued_at,responded_at').eq('bid_id', b.id).order('created_at', { ascending: true }).then(r => unwrap(r, 'getBid:orders') ?? []),
  ])
  const { data: revisions } = await supabase.from('bid_revisions').select('*').eq('bid_id', b.id).order('unlocked_at', { ascending: true })
  let history = []
  if (b.supplier_id) history = (unwrap(await supabase.from('bids').select('id,status,quantity,price,total,currency,unit,created_at,withdrawn_at').eq('tender_id', b.tender_id).eq('supplier_id', b.supplier_id).neq('id', b.id).order('created_at', { ascending: false }), 'getBid:history') ?? []).map(numeric)
  return { tender: tender && withState(tender), supplier: safeSupplier(supplier), documents, requests, orders, revisions: revisions || [], history }
}
export async function getBid(id) {
  const b = await bidRow(id); if (!b) return null
  const x = await bidExtras(b)
  const asking = x.tender?.asking_price ?? null
  return { ...safeBid(b), label: BID_LABELS[b.status], ...x, vs_asking: asking == null ? null : money(b.price - asking), vs_asking_pct: asking ? Math.round((b.price - asking) / asking * 1000) / 10 : null }
}

/** An awarded bid marks its opportunity awarded; taking the last award back closes it again. */
async function syncTenderAward(tenderId) {
  const t = await tenderRow(tenderId); if (!t) return
  const awarded = unwrap(await supabase.from('bids').select('id').eq('tender_id', t.id).eq('status', 'awarded').limit(1), 'syncTenderAward') ?? []
  if (awarded.length && ['published', 'closed'].includes(t.status)) await supabase.from('tenders').update({ status: 'awarded' }).eq('id', t.id)
  if (!awarded.length && t.status === 'awarded') await supabase.from('tenders').update({ status: 'closed' }).eq('id', t.id)
}
/**
 * Staff change a bid: its status (with a note the supplier sees) and the
 * internal notes. Returns { bid, changed, previous } so the caller can tell
 * the supplier when the status moved.
 */
export async function updateBid(id, patch = {}, actor = null) {
  const cur = await bidRow(id); if (!cur) throw invalid('bid not found', 404)
  const row = {}
  if (has(patch, 'internal_notes')) row.internal_notes = text(patch.internal_notes, 5000)
  if (has(patch, 'status_note')) row.status_note = text(patch.status_note, 2000)
  let changed = false
  if (has(patch, 'status') && patch.status !== cur.status) {
    if (!BID_STATUSES.includes(patch.status)) throw invalid(`status must be one of: ${BID_STATUSES.join(', ')}`)
    if (patch.status === 'withdrawn') throw invalid('Only the supplier can withdraw a bid.')
    if (cur.status === 'withdrawn') throw invalid('This bid was withdrawn by the supplier.')
    Object.assign(row, { status: patch.status, status_changed_at: new Date().toISOString(), status_changed_by: actor?.id ?? null })
    if (!has(patch, 'status_note')) row.status_note = ''   // a note belongs to the status it was written for
    if (patch.status !== 'awarded') { row.awarded_quantity = null; row.awarded_price = null }
    changed = true
  }
  // An award names the quantity and the price (several suppliers can share one opportunity).
  const awarding = (row.status ?? cur.status) === 'awarded' && (changed || has(patch, 'awarded_quantity') || has(patch, 'awarded_price'))
  if (awarding) {
    const q = has(patch, 'awarded_quantity') && patch.awarded_quantity !== '' && patch.awarded_quantity != null ? qty3(patch.awarded_quantity) : (cur.awarded_quantity ?? cur.quantity)
    const pr = has(patch, 'awarded_price') && patch.awarded_price !== '' && patch.awarded_price != null ? money(patch.awarded_price) : (cur.awarded_price ?? cur.price)
    if (!(q > 0)) throw invalid('The awarded quantity must be more than zero.')
    if (q > cur.quantity + 0.0005) throw invalid(`This supplier offered ${cur.quantity} ${cur.unit}; the award cannot be more than that.`)
    if (!(pr > 0)) throw invalid('The awarded price must be more than zero.')
    const tender = await tenderRow(cur.tender_id)
    const awards = await supabase.from('bids').select('id,quantity,awarded_quantity').eq('tender_id', cur.tender_id).eq('status', 'awarded').neq('id', cur.id)
    if (!(awards.error && missingSchema(awards.error))) {   // before migration 015 an award is the whole bid, as it always was
      const others = (unwrap(awards, 'updateBid:awards') ?? []).reduce((sum, b) => sum + Number(b.awarded_quantity ?? b.quantity), 0)
      const left = qty3(Number(tender.quantity) - others)
      if (q > left + 0.0005) throw invalid(left > 0 ? `Only ${left} ${tender.unit} of this opportunity is still unallocated.` : 'This opportunity is fully awarded already.')
      row.awarded_quantity = q; row.awarded_price = pr
    }
  }
  if (!Object.keys(row).length) return { bid: safeBid(cur), changed: false, previous: cur.status }
  let { data: saved, error: saveErr } = await supabase.from('bids').update(row).eq('id', cur.id).select().single()
  if (saveErr && missingSchema(saveErr) && ('awarded_quantity' in row || 'awarded_price' in row)) {   // before migration 015: statuses work as before
    const { awarded_quantity: _q, awarded_price: _p, ...rest } = row
    if (!Object.keys(rest).length) throw invalid(UPGRADE_HINT, 409)
    ;({ data: saved, error: saveErr } = await supabase.from('bids').update(rest).eq('id', cur.id).select().single())
  }
  if (saveErr) throw (missingSchema(saveErr) ? invalid(UPGRADE_HINT, 409) : fail(saveErr, 'updateBid'))
  const bid = numeric(saved)
  if (changed && (bid.status === 'awarded' || cur.status === 'awarded')) await syncTenderAward(bid.tender_id)
  return { bid: { ...safeBid(bid), label: BID_LABELS[bid.status] }, changed, previous: cur.status }
}
export async function deleteBid(id) {
  const cur = await bidRow(id); if (!cur) throw invalid('bid not found', 404)
  const docs = unwrap(await supabase.from('documents').select('path').eq('bid_id', cur.id), 'deleteBid:documents') ?? []
  if (docs.length) await supabase.storage.from('documents').remove(docs.map(d => d.path)).catch(() => {})
  unwrap(await supabase.from('bids').delete().eq('id', cur.id), 'deleteBid')
  if (cur.status === 'awarded') await syncTenderAward(cur.tender_id)
  return { deleted: true, id: cur.id, company_name: cur.company_name }
}
/** Every bid still in play on an opportunity becomes "not selected". Returns the bids that changed. */
export async function closeOutTender(tenderId, actor = null, note = '') {
  const t = await tenderRow(tenderId); if (!t) throw invalid('opportunity not found', 404)
  const live = unwrap(await supabase.from('bids').select('id').eq('tender_id', t.id).in('status', BID_LIVE), 'closeOutTender') ?? []
  const out = []
  for (const b of live) out.push((await updateBid(b.id, { status: 'not_selected', ...(note ? { status_note: note } : {}) }, actor)).bid)
  if (t.status === 'published') await supabase.from('tenders').update({ status: 'closed' }).eq('id', t.id)
  return out
}

/* unlock: after the deadline, let one supplier adjust their own bid */
const BID_EDITABLE = ['quantity', 'price', 'total', 'commodity_location', 'delivery_date', 'accepts_terms', 'terms_note', 'note']
const snapshot = b => Object.fromEntries(BID_EDITABLE.map(k => [k, b[k]]))
export async function unlockBid(id, reason, actor = null) {
  const b = await bidRow(id); if (!b) throw invalid('bid not found', 404)
  if (b.status === 'withdrawn') throw invalid('This bid was withdrawn by the supplier.')
  if (b.status === 'awarded') throw invalid('This bid is awarded. Take the award back before unlocking it.')
  const why = text(reason, 1000); if (why.length < 5) throw invalid('Please give the reason for unlocking this bid.')
  if (b.unlocked_at) throw invalid('This bid is already unlocked.')
  if (!b.supplier_id) throw invalid('This bid has no supplier record to hand it back to.')
  const now = new Date().toISOString()
  const { error } = await supabase.from('bid_revisions').insert({ bid_id: b.id, reason: why, unlocked_by: actor?.id ?? null, unlocked_by_name: tt(actor?.name || actor?.email || '', 120), unlocked_at: now, before: snapshot(b) })
  if (error) throw (missingSchema(error) ? invalid(UPGRADE_HINT, 409) : fail(error, 'unlockBid'))
  const bid = numeric(unwrap(await supabase.from('bids').update({ unlocked_at: now, unlocked_by: actor?.id ?? null, unlock_reason: why }).eq('id', b.id).select().single(), 'unlockBid:update'))
  return { bid: safeBid(bid), before: snapshot(b) }
}
/** Take the unlock back without a change from the supplier. */
export async function lockBid(id) {
  const b = await bidRow(id); if (!b) throw invalid('bid not found', 404)
  if (!b.unlocked_at) return safeBid(b)
  await supabase.from('bid_revisions').delete().eq('bid_id', b.id).is('resubmitted_at', null)
  return safeBid(numeric(unwrap(await supabase.from('bids').update({ unlocked_at: null }).eq('id', b.id).select().single(), 'lockBid')))
}
/** The supplier resubmits an unlocked bid. Returns { bid, changes, before }. */
export async function reviseBid(supplierId, bidId, input = {}) {
  const b = await bidRow(bidId)
  if (!b || b.supplier_id !== Number(supplierId)) throw invalid('bid not found', 404)
  if (!b.unlocked_at) throw invalid('This bid is not open for changes.', 409)
  const tender = await tenderRow(b.tender_id)
  const quantity = has(input, 'quantity') ? qty3(input.quantity) : b.quantity; if (!(quantity > 0)) throw invalid('Please enter the quantity you can supply.')
  const price = has(input, 'price') ? money(input.price) : b.price; if (!(price > 0)) throw invalid(`Please enter your proposed price per ${b.unit}.`)
  const row = {
    quantity, price, total: money(quantity * price),
    commodity_location: has(input, 'commodity_location') ? tt(input.commodity_location, 200) : b.commodity_location,
    delivery_date: has(input, 'delivery_date') && input.delivery_date ? dateOnly(input.delivery_date, 'Expected delivery date') : b.delivery_date,
    accepts_terms: has(input, 'accepts_terms') ? truthy(input.accepts_terms) : b.accepts_terms,
    terms_note: has(input, 'terms_note') ? text(input.terms_note, 1000) : b.terms_note,
    note: has(input, 'note') ? text(input.note, 3000) : b.note,
  }
  if (!row.commodity_location) throw invalid('Please say where the commodity is located.')
  const before = snapshot(b)
  const same = (a, c) => (typeof a === 'number' || typeof c === 'number' ? Number(a) === Number(c) : String(a ?? '') === String(c ?? ''))
  const changes = BID_EDITABLE.filter(k => !same(before[k], row[k])).map(k => ({ field: k, from: before[k], to: row[k] }))
  const now = new Date().toISOString()
  const bid = numeric(unwrap(await supabase.from('bids').update({ ...row, unlocked_at: null, revision: (b.revision || 0) + 1, revised_at: now }).eq('id', b.id).select().single(), 'reviseBid'))
  await supabase.from('bid_revisions').update({ after: snapshot(bid), changes, resubmitted_at: now }).eq('bid_id', b.id).is('resubmitted_at', null)
  return { bid: safeBid(bid), changes, before, tender: tender && withState(tender) }
}

/* requests for additional information */
export async function askBid(bidId, question, actor = null) {
  const b = await bidRow(bidId); if (!b) throw invalid('bid not found', 404)
  if (b.status === 'withdrawn') throw invalid('This bid was withdrawn by the supplier.')
  const q = text(question, 3000); if (q.length < 5) throw invalid('Please write what you need from the supplier.')
  const request = unwrap(await supabase.from('bid_requests').insert({ bid_id: b.id, question: q, asked_by: actor?.id ?? null }).select().single(), 'askBid')
  return { request, bid: safeBid(b) }
}
export async function deleteBidRequest(bidId, requestId) {
  unwrap(await supabase.from('bid_requests').delete().eq('id', Number(requestId)).eq('bid_id', Number(bidId)), 'deleteBidRequest')
  return { deleted: true, id: Number(requestId) }
}

/* what a supplier sees of their own bids */
export const publicBid = (b, x = {}) => ({
  id: b.id, status: b.status, label: BID_LABELS[b.status], status_note: b.status_note, status_changed_at: b.status_changed_at, created_at: b.created_at,
  company_name: b.company_name, contact_person: b.contact_person, phone: b.phone, email: b.email, address: b.address,
  commodity: b.commodity, quantity: Number(b.quantity), unit: b.unit, price: Number(b.price), currency: b.currency, total: Number(b.total),
  commodity_location: b.commodity_location, delivery_date: b.delivery_date, accepts_terms: b.accepts_terms, terms_note: b.terms_note, note: b.note,
  // Documents can still be added to an awarded bid (we may ask for more); a bid that is out of the running is closed.
  can_withdraw: BID_LIVE.includes(b.status) && (x.tender ? tenderState(x.tender) === 'open' : true || Boolean(b.unlocked_at)) || (BID_LIVE.includes(b.status) && Boolean(b.unlocked_at)),
  can_attach: !['withdrawn', 'not_selected'].includes(b.status),
  can_edit: Boolean(b.unlocked_at) && b.status !== 'withdrawn', unlocked_at: b.unlocked_at || null, unlock_reason: b.unlock_reason || '', revision: b.revision || 0, revised_at: b.revised_at || null, withdrawn_at: b.withdrawn_at || null,
  awarded_quantity: b.awarded_quantity == null ? null : Number(b.awarded_quantity), awarded_price: b.awarded_price == null ? null : Number(b.awarded_price),
  ...(x.tender ? { tender: publicTender(x.tender) } : {}),
  // `mine`: uploaded by the supplier (no staff member behind it), so theirs to remove.
  ...(x.documents ? { documents: x.documents.map(d => ({ id: d.id, name: d.name, label: d.label || '', bytes: d.bytes, content_type: d.content_type, created_at: d.created_at, mine: d.uploaded_by == null })) } : {}),
  ...(x.requests ? { requests: x.requests.map(r => ({ id: r.id, question: r.question, asked_at: r.asked_at, answer: r.answer, answered_at: r.answered_at })) } : {}),
  ...(x.orders ? { orders: x.orders.filter(o => o.status !== 'draft').map(o => ({ kind: o.kind, number: o.number, token: o.token, status: o.status, total: Number(o.total), currency: o.currency, issued_at: o.issued_at })) } : {}),
})
export async function listSupplierBids(supplierId) {
  const rows = (unwrap(await supabase.from('bids').select('*').eq('supplier_id', Number(supplierId)).order('created_at', { ascending: false }).limit(500), 'listSupplierBids') ?? []).map(numeric)
  if (!rows.length) return []
  const ids = rows.map(b => b.id)
  const [tenders, reqs, orders] = await Promise.all([
    supabase.from('tenders').select('*').in('id', [...new Set(rows.map(b => b.tender_id))]).then(r => unwrap(r, 'listSupplierBids:tenders') ?? []),
    supabase.from('bid_requests').select('bid_id,answered_at').in('bid_id', ids).then(r => unwrap(r, 'listSupplierBids:requests') ?? []),
    supabase.from('purchase_orders').select('bid_id,kind,number,token,status,total,currency,issued_at').in('bid_id', ids).then(r => unwrap(r, 'listSupplierBids:orders') ?? []),
  ])
  return rows.map(b => ({
    ...publicBid(b, { tender: tenders.find(t => t.id === b.tender_id), orders: orders.filter(o => o.bid_id === b.id) }),
    requests_open: reqs.filter(r => r.bid_id === b.id && !r.answered_at).length,
  }))
}
export async function getSupplierBid(supplierId, bidId) {
  const b = await bidRow(bidId)
  if (!b || b.supplier_id !== Number(supplierId)) return null
  return { ...publicBid(b, await bidExtras(b)), _row: b }
}
export async function withdrawBid(supplierId, bidId) {
  const b = await bidRow(bidId)
  if (!b || b.supplier_id !== Number(supplierId)) throw invalid('bid not found', 404)
  if (!BID_LIVE.includes(b.status)) throw invalid(`This bid is ${BID_LABELS[b.status].toLowerCase()} and can no longer be withdrawn.`, 409)
  // After the deadline a bid stands, unless we unlocked it for the supplier.
  const tender = await tenderRow(b.tender_id)
  if (tender && tenderState(tender) !== 'open' && !b.unlocked_at) throw invalid('Bidding has closed, so this bid can no longer be withdrawn. Contact our procurement team if it needs to change.', 409)
  const now = new Date().toISOString()
  const row = { status: 'withdrawn', status_changed_at: now, status_changed_by: null }
  let r = await supabase.from('bids').update({ ...row, withdrawn_at: now, unlocked_at: null }).eq('id', b.id).select().single()
  if (r.error && missingSchema(r.error)) r = await supabase.from('bids').update(row).eq('id', b.id).select().single()   // before migration 015
  return numeric(unwrap(r, 'withdrawBid'))
}
export async function answerBidRequest(supplierId, bidId, requestId, answer) {
  const b = await bidRow(bidId)
  if (!b || b.supplier_id !== Number(supplierId)) throw invalid('bid not found', 404)
  const r = (unwrap(await supabase.from('bid_requests').select('*').eq('id', Number(requestId)).eq('bid_id', b.id).limit(1), 'answerBidRequest'))?.[0]
  if (!r) throw invalid('request not found', 404)
  const a = text(answer, 5000); if (a.length < 2) throw invalid('Please write your answer.')
  const request = unwrap(await supabase.from('bid_requests').update({ answer: a, answered_at: new Date().toISOString() }).eq('id', r.id).select().single(), 'answerBidRequest:update')
  return { request, bid: safeBid(b) }
}

/* ---------------------------------------------------- purchase orders --- */

export const PO_KINDS = ['po', 'lpo']
export const PO_KIND_LABELS = { po: 'Purchase Order', lpo: 'Local Purchase Order' }
export const PO_PREFIX = { po: 'PO', lpo: 'LPO' }
export const PO_STATUSES = ['draft', 'issued', 'acknowledged', 'declined', 'fulfilled', 'cancelled']
const PO_LOCKED = ['items', 'discount', 'tax_rate', 'currency', 'kind']
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/
const poNumeric = p => ({ ...p, discount: Number(p.discount), tax_rate: Number(p.tax_rate), subtotal: Number(p.subtotal), total: Number(p.total) })
const poRow = async id => { const r = (unwrap(await supabase.from('purchase_orders').select('*').eq('id', Number(id)).limit(1), 'getPurchaseOrder'))?.[0]; return r ? poNumeric(r) : null }

export async function listPurchaseOrders({ status = 'all', kind = 'all', supplier_id = null, tender_id = null, limit = 1000 } = {}) {
  let qry = supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }).limit(limit)
  if (PO_STATUSES.includes(status)) qry = qry.eq('status', status)
  else if (status === 'open') qry = qry.eq('status', 'issued')
  if (PO_KINDS.includes(kind)) qry = qry.eq('kind', kind)
  if (supplier_id != null) qry = qry.eq('supplier_id', Number(supplier_id))
  if (tender_id != null) qry = qry.eq('tender_id', Number(tender_id))
  return (unwrap(await qry, 'listPurchaseOrders') ?? []).map(poNumeric)
}
export const getPurchaseOrder = id => poRow(id)
export async function getPurchaseOrderByToken(token) {
  if (!TOKEN_RE.test(String(token || ''))) return null
  const r = (unwrap(await supabase.from('purchase_orders').select('*').eq('token', String(token)).limit(1), 'getPurchaseOrderByToken'))?.[0]
  return r ? poNumeric(r) : null
}
export async function getPurchaseOrderByNumber(number) {
  const r = (unwrap(await supabase.from('purchase_orders').select('*').eq('number', String(number).toUpperCase()).limit(1), 'getPurchaseOrderByNumber'))?.[0]
  return r ? poNumeric(r) : null
}
/**
 * A PO or LPO. With `bid_id` it starts from the awarded bid: supplier,
 * commodity, quantity, the supplier's price, and the opportunity's delivery
 * and payment terms — everything can still be edited before it is issued.
 */
export async function createPurchaseOrder(input = {}, actorId = null) {
  const settings = await getSettings(); const p = settings.procurement || {}
  const kind = PO_KINDS.includes(input.kind) ? input.kind : 'lpo'
  const bid = input.bid_id != null && input.bid_id !== '' ? await bidRow(input.bid_id) : null
  if (input.bid_id != null && input.bid_id !== '' && !bid) throw invalid('bid not found', 404)
  const tender = bid ? await tenderRow(bid.tender_id) : (input.tender_id != null && input.tender_id !== '' ? await tenderRow(input.tender_id) : null)
  const supplier_id = idOrNull(input.supplier_id) ?? bid?.supplier_id ?? null
  const supplier = supplier_id != null ? await supplierRow(supplier_id) : null
  if (supplier_id != null && !supplier) throw invalid('supplier not found', 404)
  const supplier_name = tt(input.supplier_name ?? supplier?.company_name ?? bid?.company_name, 200)
  if (!supplier_name) throw invalid('Please choose a supplier, or enter who this order is for.')
  const given = has(input, 'items') && Array.isArray(input.items) && input.items.length
  let items
  try { items = normaliseItems(given ? input.items : bid ? [{ description: [bid.commodity, tender?.specification ? tender.specification.split('\n')[0].slice(0, 200) : ''].filter(Boolean).join(' — '), quantity: bid.awarded_quantity ?? bid.quantity, unit: bid.unit, unit_price: bid.awarded_price ?? bid.price }] : []) } catch (e) { throw invalid(e.message.replace('a quote', 'an order')) }
  let totals; try { totals = quoteTotals({ items, discount: input.discount, tax_rate: input.tax_rate }) } catch (e) { throw invalid(e.message) }
  const row = {
    kind, token: randomBytes(24).toString('base64url'),
    supplier_id: supplier?.id ?? null, tender_id: tender?.id ?? null, bid_id: bid?.id ?? null,
    supplier_name, supplier_email: tt(input.supplier_email ?? supplier?.email ?? bid?.email, 200).toLowerCase(), supplier_address: text(input.supplier_address ?? supplier?.address ?? bid?.address, 500),
    title: tt(input.title, 200) || (tender ? `${tender.commodity} supply — ${tender.number}` : ''),
    currency: currencyCode(input.currency || bid?.currency || tender?.currency || p.default_currency),
    items, ...totals,
    delivery_location: tt(input.delivery_location ?? tender?.delivery_location, 200),
    delivery_date: input.delivery_date ? dateOnly(input.delivery_date, 'Delivery date') : (bid?.delivery_date ?? tender?.delivery_by ?? null),
    payment_terms: text(input.payment_terms ?? tender?.payment_terms ?? p.payment_terms, 2000),
    notes: text(input.notes ?? p.po_notes), terms: text(input.terms ?? p.po_terms), internal_notes: text(input.internal_notes),
    status: 'draft', created_by: actorId,
  }
  if (row.supplier_email && !EMAIL_RE.test(row.supplier_email)) throw invalid('Please enter a valid supplier email address.')
  return poNumeric(await insertNumbered('purchase_orders', PO_PREFIX[kind], row, input.number, PO_KIND_LABELS[kind]))
}
export async function updatePurchaseOrder(id, patch = {}) {
  const cur = await poRow(id); if (!cur) throw invalid('order not found', 404)
  if (['acknowledged', 'fulfilled'].includes(cur.status) && PO_LOCKED.some(k => has(patch, k))) throw invalid('The supplier has acknowledged this order, so its items and prices are locked. Raise a new order for changes.')
  const row = {}
  if (has(patch, 'supplier_id')) {
    const sid = idOrNull(patch.supplier_id)
    if (sid == null) row.supplier_id = null
    else { const s = await supplierRow(sid); if (!s) throw invalid('supplier not found', 404); row.supplier_id = s.id; if (!has(patch, 'supplier_name')) row.supplier_name = s.company_name; if (!has(patch, 'supplier_email')) row.supplier_email = s.email; if (!has(patch, 'supplier_address')) row.supplier_address = s.address }
  }
  if (has(patch, 'supplier_name')) { row.supplier_name = tt(patch.supplier_name, 200); if (!row.supplier_name) throw invalid('Please enter who this order is for.') }
  if (has(patch, 'supplier_email')) { row.supplier_email = tt(patch.supplier_email, 200).toLowerCase(); if (row.supplier_email && !EMAIL_RE.test(row.supplier_email)) throw invalid('Please enter a valid supplier email address.') }
  if (has(patch, 'supplier_address')) row.supplier_address = text(patch.supplier_address, 500)
  if (has(patch, 'title')) row.title = tt(patch.title, 200)
  if (has(patch, 'delivery_location')) row.delivery_location = tt(patch.delivery_location, 200)
  if (has(patch, 'delivery_date')) row.delivery_date = patch.delivery_date ? dateOnly(patch.delivery_date, 'Delivery date') : null
  for (const k of ['notes', 'terms', 'internal_notes', 'response_note']) if (has(patch, k)) row[k] = text(patch[k])
  if (has(patch, 'payment_terms')) row.payment_terms = text(patch.payment_terms, 2000)
  if (has(patch, 'currency')) row.currency = currencyCode(patch.currency)
  try {
    if (has(patch, 'items')) row.items = normaliseItems(patch.items)
    if (has(patch, 'items') || has(patch, 'discount') || has(patch, 'tax_rate')) Object.assign(row, quoteTotals({ items: row.items ?? cur.items, discount: patch.discount ?? cur.discount, tax_rate: patch.tax_rate ?? cur.tax_rate }))
  } catch (e) { throw invalid(e.message.replace('a quote', 'an order')) }
  // PO ⇄ LPO while it is a draft: the number takes the other prefix, same digits if they are free.
  const kind = has(patch, 'kind') && PO_KINDS.includes(patch.kind) ? patch.kind : cur.kind
  const year = Number(/-(\d{4})-/.exec(cur.number)?.[1]) || new Date(cur.created_at).getFullYear()
  let number = null
  if (kind !== cur.kind) {
    if (cur.status !== 'draft') throw invalid('Only a draft can change between PO and LPO.')
    row.kind = kind
    number = has(patch, 'number') && String(patch.number).trim() !== '' ? parseNumber(patch.number, PO_PREFIX[kind], year, PO_KIND_LABELS[kind]) : numberOf(PO_PREFIX[kind], year, await highest('purchase_orders', PO_PREFIX[kind], year) + 1)
  } else if (has(patch, 'number') && String(patch.number).trim() !== '') number = parseNumber(patch.number, PO_PREFIX[kind], year, PO_KIND_LABELS[kind])
  if (number && number !== cur.number) {
    if (['acknowledged', 'fulfilled'].includes(cur.status)) throw invalid('The supplier has acknowledged this order; its number is locked.')
    const clash = await getPurchaseOrderByNumber(number); if (clash && clash.id !== cur.id) throw invalid(`${number} is already in use`)
    row.number = number
  }
  if (has(patch, 'status') && patch.status !== cur.status) {
    if (!PO_STATUSES.includes(patch.status)) throw invalid(`status must be one of: ${PO_STATUSES.join(', ')}`)
    row.status = patch.status
    const now = new Date().toISOString()
    if (patch.status === 'issued' && !cur.issued_at) row.issued_at = now
    if (['acknowledged', 'declined'].includes(patch.status)) row.responded_at = now
  }
  if (!Object.keys(row).length) return cur
  return poNumeric(unwrap(await supabase.from('purchase_orders').update(row).eq('id', cur.id).select().single(), 'updatePurchaseOrder'))
}
export async function deletePurchaseOrder(id) {
  const cur = await poRow(id); if (!cur) throw invalid('order not found', 404)
  if (['acknowledged', 'fulfilled'].includes(cur.status)) throw invalid('The supplier has acknowledged this order. Cancel it instead of deleting it.')
  unwrap(await supabase.from('purchase_orders').delete().eq('id', cur.id), 'deletePurchaseOrder')
  return { deleted: true, id: cur.id, number: cur.number }
}
export async function markPurchaseOrderIssued(id) {
  const cur = await poRow(id); if (!cur) throw invalid('order not found', 404)
  const row = { issued_at: cur.issued_at || new Date().toISOString(), ...(['draft', 'declined', 'cancelled'].includes(cur.status) ? { status: 'issued', responded_at: null, response_note: '' } : {}) }
  return poNumeric(unwrap(await supabase.from('purchase_orders').update(row).eq('id', cur.id).select().single(), 'markPurchaseOrderIssued'))
}
export async function markPurchaseOrderViewed(id) {
  return poNumeric(unwrap(await supabase.from('purchase_orders').update({ viewed_at: new Date().toISOString() }).eq('id', Number(id)).is('viewed_at', null).select().maybeSingle(), 'markPurchaseOrderViewed') ?? await poRow(id))
}
/** The supplier's answer from their link. */
export async function respondToPurchaseOrder(token, action, note = '') {
  const po = await getPurchaseOrderByToken(token); if (!po) return null
  if (!['acknowledge', 'decline'].includes(action)) throw invalid('action must be acknowledge or decline')
  if (po.status === 'draft') throw invalid('This order has not been issued yet.', 409)
  if (['acknowledged', 'declined', 'fulfilled'].includes(po.status)) throw invalid('This order has already been answered.', 409)
  if (po.status === 'cancelled') throw invalid('This order was cancelled. Please contact us.', 409)
  return poNumeric(unwrap(await supabase.from('purchase_orders').update({ status: action === 'acknowledge' ? 'acknowledged' : 'declined', responded_at: new Date().toISOString(), response_note: text(note, 2000) }).eq('id', po.id).select().single(), 'respondToPurchaseOrder'))
}
/** What the supplier's page and the PDF may see: no internal notes, no ids. */
export function publicPurchaseOrder(po, settings) {
  return {
    kind: po.kind, kind_label: PO_KIND_LABELS[po.kind], number: po.number, title: po.title, status: po.status,
    supplier_name: po.supplier_name, supplier_address: po.supplier_address, currency: po.currency, items: po.items,
    subtotal: po.subtotal, discount: po.discount, tax_rate: po.tax_rate, total: po.total,
    delivery_location: po.delivery_location, delivery_date: po.delivery_date, payment_terms: po.payment_terms, notes: po.notes, terms: po.terms,
    date: po.issued_at || po.created_at, issued_at: po.issued_at, responded_at: po.responded_at, response_note: po.response_note,
    company: settings.company,
  }
}
export async function listSupplierOrders(supplierId) {
  const rows = unwrap(await supabase.from('purchase_orders').select('*').eq('supplier_id', Number(supplierId)).neq('status', 'draft').order('created_at', { ascending: false }).limit(200), 'listSupplierOrders') ?? []
  return rows.map(o => ({ kind: o.kind, kind_label: PO_KIND_LABELS[o.kind], number: o.number, token: o.token, title: o.title, status: o.status, total: Number(o.total), currency: o.currency, issued_at: o.issued_at, delivery_date: o.delivery_date, responded_at: o.responded_at }))
}

/* ------------------------------------------------- supplier shipments --- */
// Deliveries a supplier makes against a purchase order. The supplier
// creates them and reports where they are; staff see them on the order and
// confirm what arrived.
export const PO_SHIPMENT_STATUSES = ['planned', 'in_transit', 'delivered', 'confirmed', 'cancelled']
const shipNumeric = x => ({ ...x, quantity: Number(x.quantity), received_quantity: x.received_quantity == null ? null : Number(x.received_quantity), updates: Array.isArray(x.updates) ? x.updates : [] })
const shipFail = (e, ctx) => (missingSchema(e) ? invalid(UPGRADE_HINT, 409) : fail(e, ctx))
const orderedQuantity = po => qty3((po.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0))
export async function listPoShipments({ po_id = null, supplier_id = null, status = 'all', limit = 1000 } = {}) {
  let qry = supabase.from('po_shipments').select('*').order('created_at', { ascending: false }).limit(limit)
  if (po_id != null) qry = qry.eq('po_id', Number(po_id))
  if (supplier_id != null) qry = qry.eq('supplier_id', Number(supplier_id))
  if (PO_SHIPMENT_STATUSES.includes(status)) qry = qry.eq('status', status)
  const { data, error } = await qry
  if (error) { if (missingSchema(error)) return []; throw fail(error, 'listPoShipments') }
  const rows = (data || []).map(shipNumeric)
  if (!rows.length) return rows
  const orders = unwrap(await supabase.from('purchase_orders').select('id,number,kind,supplier_name,token,status').in('id', [...new Set(rows.map(r => r.po_id))]), 'listPoShipments:orders') ?? []
  return rows.map(r => ({ ...r, order: orders.find(o => o.id === r.po_id) || null }))
}
export async function getPoShipment(id) {
  const { data, error } = await supabase.from('po_shipments').select('*').eq('id', Number(id)).limit(1)
  if (error) throw shipFail(error, 'getPoShipment')
  return data?.[0] ? shipNumeric(data[0]) : null
}
/** Ordered → on the way → delivered → confirmed, for one order. */
export function fulfilment(po, shipments) {
  const live = shipments.filter(x => x.status !== 'cancelled')
  const sum = list => qty3(list.reduce((n, x) => n + x.quantity, 0))
  const ordered = orderedQuantity(po)
  const confirmed = qty3(live.filter(x => x.status === 'confirmed').reduce((n, x) => n + (x.received_quantity ?? x.quantity), 0))
  return { ordered, shipped: sum(live), in_transit: sum(live.filter(x => x.status === 'in_transit')), delivered: sum(live.filter(x => ['delivered', 'confirmed'].includes(x.status))), confirmed, remaining: qty3(Math.max(0, ordered - sum(live))), unit: po.items?.[0]?.unit || '' }
}
function cleanShipment(input, { partial = false } = {}) {
  const row = {}
  if (!partial || has(input, 'quantity')) { const q = qty3(input.quantity); if (!(q > 0)) throw invalid('Please enter the quantity on this shipment.'); row.quantity = q }
  for (const [k, max] of [['product', 200], ['unit', 20], ['truck_number', 40], ['driver_name', 120], ['driver_phone', 60], ['loading_location', 200], ['destination', 200], ['waybill', 80]]) if (has(input, k)) row[k] = tt(input[k], max)
  if (has(input, 'notes')) row.notes = text(input.notes, 2000)
  for (const k of ['loading_date', 'eta']) if (has(input, k)) row[k] = input[k] ? dateOnly(input[k], k === 'eta' ? 'Estimated arrival date' : 'Loading date') : null
  return row
}
export async function createPoShipment(poId, input = {}, { supplierId = null } = {}) {
  const po = await poRow(poId); if (!po) throw invalid('order not found', 404)
  if (supplierId != null && po.supplier_id !== Number(supplierId)) throw invalid('order not found', 404)
  if (!['issued', 'acknowledged'].includes(po.status)) throw invalid(po.status === 'draft' ? 'This order has not been issued yet.' : `This order is ${po.status}; no shipment can be added to it.`, 409)
  const row = cleanShipment(input)
  if (!row.truck_number) throw invalid('Please enter the truck registration number.')
  if (!row.driver_name) throw invalid("Please enter the driver's name.")
  const all = await listPoShipments({ po_id: po.id })
  const f = fulfilment(po, all)
  if (f.ordered > 0 && row.quantity > f.remaining + 0.0005) throw invalid(f.remaining > 0 ? `Only ${f.remaining} ${f.unit} of this order is still to be shipped.` : 'The whole order is already covered by shipments.')
  const now = new Date().toISOString()
  const full = { product: po.items?.[0]?.description || '', unit: po.items?.[0]?.unit || 'MT', destination: po.delivery_location || '', ...row, po_id: po.id, supplier_id: po.supplier_id, number: all.length + 1, status: 'planned',
    updates: [{ at: now, status: 'planned', location: row.loading_location || '', note: 'Shipment created', by: supplierId != null ? 'supplier' : 'staff' }] }
  const { data, error } = await supabase.from('po_shipments').insert(full).select().single()
  if (error) throw shipFail(error, 'createPoShipment')
  return { shipment: shipNumeric(data), order: po }
}
/** Details can change until the goods are delivered. */
export async function updatePoShipment(id, patch = {}, { supplierId = null } = {}) {
  const cur = await getPoShipment(id); if (!cur || (supplierId != null && cur.supplier_id !== Number(supplierId))) throw invalid('shipment not found', 404)
  if (['delivered', 'confirmed', 'cancelled'].includes(cur.status)) throw invalid(`This shipment is ${cur.status}; its details can no longer be changed.`, 409)
  const row = cleanShipment(patch, { partial: true })
  if (!Object.keys(row).length) return cur
  const { data, error } = await supabase.from('po_shipments').update(row).eq('id', cur.id).select().single()
  if (error) throw shipFail(error, 'updatePoShipment')
  return shipNumeric(data)
}
/** A location or status report: "left Kano", "at the Lokoja checkpoint", "delivered". */
export async function reportPoShipment(id, input = {}, { supplierId = null, by = 'staff' } = {}) {
  const cur = await getPoShipment(id); if (!cur || (supplierId != null && cur.supplier_id !== Number(supplierId))) throw invalid('shipment not found', 404)
  if (['confirmed', 'cancelled'].includes(cur.status)) throw invalid(`This shipment is ${cur.status}.`, 409)
  const allowed = supplierId != null ? ['planned', 'in_transit', 'delivered', 'cancelled'] : PO_SHIPMENT_STATUSES
  const status = has(input, 'status') && input.status ? input.status : (cur.status === 'planned' ? 'in_transit' : cur.status)
  if (!allowed.includes(status)) throw invalid(`status must be one of: ${allowed.join(', ')}`)
  if (supplierId != null && status === 'cancelled' && cur.status !== 'planned') throw invalid('A shipment that has left can no longer be cancelled here. Contact our team.', 409)
  const location = tt(input.location, 200), note = text(input.note, 1000)
  if (!location && !note && status === cur.status) throw invalid('Please say where the shipment is now.')
  const now = new Date().toISOString()
  const row = { status, current_location: location || cur.current_location, updates: [...cur.updates, { at: now, status, location, note, by }].slice(-200),
    ...(status === 'delivered' && !cur.delivered_at ? { delivered_at: now } : {}) }
  if (status === 'confirmed') {
    const r = has(input, 'received_quantity') && input.received_quantity !== '' && input.received_quantity != null ? qty3(input.received_quantity) : cur.quantity
    if (!(r >= 0)) throw invalid('The received quantity cannot be negative.')
    Object.assign(row, { confirmed_at: now, confirmed_by: input.actorId ?? null, received_quantity: r, delivered_at: cur.delivered_at || now })
  }
  const { data, error } = await supabase.from('po_shipments').update(row).eq('id', cur.id).select().single()
  if (error) throw shipFail(error, 'reportPoShipment')
  return shipNumeric(data)
}
export async function deletePoShipment(id) {
  const cur = await getPoShipment(id); if (!cur) throw invalid('shipment not found', 404)
  const docs = (await supabase.from('documents').select('path').eq('po_shipment_id', cur.id)).data || []
  if (docs.length) await supabase.storage.from('documents').remove(docs.map(d => d.path)).catch(() => {})
  const { error } = await supabase.from('po_shipments').delete().eq('id', cur.id)
  if (error) throw shipFail(error, 'deletePoShipment')
  return { deleted: true, id: cur.id }
}
/** What the supplier sees of a shipment. */
export const publicPoShipment = (x, docs = []) => ({
  id: x.id, number: x.number, product: x.product, quantity: x.quantity, unit: x.unit, truck_number: x.truck_number, driver_name: x.driver_name, driver_phone: x.driver_phone,
  loading_location: x.loading_location, destination: x.destination, loading_date: x.loading_date, eta: x.eta, waybill: x.waybill, notes: x.notes,
  status: x.status, current_location: x.current_location, updates: x.updates.map(u => ({ at: u.at, status: u.status, location: u.location, note: u.note, by: u.by === 'supplier' ? 'you' : 'Vertoc Agro' })),
  delivered_at: x.delivered_at, confirmed_at: x.confirmed_at, received_quantity: x.received_quantity, created_at: x.created_at,
  documents: docs.filter(d => d.po_shipment_id === x.id).map(d => ({ id: d.id, name: d.name, label: d.label || '', bytes: d.bytes, created_at: d.created_at })),
})

/* -------------------------------------------------------------- stats --- */
/** Counts for the panel's badges and dashboard; zeros until migration 014 is in. */
export async function procurementStats() {
  const count = async (table, where) => { try { let q = supabase.from(table).select('*', { count: 'exact', head: true }); if (where) q = where(q); const { count: n, error } = await q; return error ? 0 : (n ?? 0) } catch { return 0 } }
  const now = new Date().toISOString()
  const [tendersOpen, bidsNew, suppliers, ordersOpen, procUnread] = await Promise.all([
    count('tenders', q => q.eq('status', 'published').lte('opens_at', now).gt('closes_at', now)),
    count('bids', q => q.eq('status', 'open')),
    count('suppliers', q => q.eq('status', 'active')),
    count('purchase_orders', q => q.eq('status', 'issued')),
    count('messages', q => q.eq('scope', 'procurement').eq('direction', 'in').is('read_at', null)),
  ])
  return { tendersOpen, bidsNew, suppliers, ordersOpen, procUnread }
}
