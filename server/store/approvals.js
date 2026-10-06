/*
 * Approval workflow (migration 016). A record staff create without approval
 * rights is `pending` until an admin approves it; an amendment of an
 * official invoice or order by such staff is kept here, original beside
 * proposal, until an admin decides. Supabase only. Before the migration every
 * record simply counts as approved and nothing here blocks anything.
 */
import { supabase } from './supabase.js'

export const APPROVAL_HINT = 'This needs the database migration 016: run server/migrations/016_approvals.sql in the Supabase SQL editor first.'
const missing = e => ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e?.code)
const invalid = (message, status = 400) => Object.assign(new Error(message), { expose: true, status })
const fail = (e, ctx) => (missing(e) ? invalid(APPROVAL_HINT, 409) : new Error(`${ctx}: ${e.message}`))
const unwrap = ({ data, error }, ctx) => { if (error) throw fail(error, ctx); return data }
const text = (s, max = 2000) => String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)

export const APPROVAL_TABLES = { quote: 'quotes', purchase_order: 'purchase_orders', client: 'clients', supplier: 'suppliers' }
export const APPROVAL_MODULE = { quote: 'invoices', purchase_order: 'purchase_orders', client: 'clients', supplier: 'suppliers' }
const table = type => { const t = APPROVAL_TABLES[type]; if (!t) throw invalid('unknown record type', 404); return t }
const COLS = 'id,approval,submitted_by,approved_by,approved_at,approval_note'

/** The approval state of a record; a record from before the migration is approved. */
export async function getApproval(type, id) {
  const { data, error } = await supabase.from(table(type)).select(COLS).eq('id', Number(id)).limit(1)
  if (error) { if (missing(error)) return { id: Number(id), approval: 'approved', submitted_by: null, legacy: true }; throw fail(error, 'getApproval') }
  return data?.[0] ?? null
}
/** Record who created something: official at once for someone who may approve, pending otherwise. Never throws. */
export async function stampSubmission(type, id, { userId, approved }) {
  const row = approved ? { submitted_by: userId, approval: 'approved', approved_by: userId, approved_at: new Date().toISOString() } : { submitted_by: userId, approval: 'pending' }
  const { error } = await supabase.from(table(type)).update(row).eq('id', Number(id))
  if (error && !missing(error)) console.error('[approvals] stamp', error.message)
  return approved ? 'approved' : (error ? 'approved' : 'pending')
}
/** A rejected record edited by its author goes back for review. */
export async function resubmit(type, id, userId) {
  const { error } = await supabase.from(table(type)).update({ approval: 'pending', submitted_by: userId, approved_by: null, approved_at: null, approval_note: '' }).eq('id', Number(id))
  if (error && !missing(error)) throw fail(error, 'resubmit')
}
export async function decide(type, id, { decision, by, note = '' }) {
  if (!['approved', 'rejected'].includes(decision)) throw invalid('decision must be approved or rejected')
  return unwrap(await supabase.from(table(type)).update({ approval: decision, approved_by: by, approved_at: new Date().toISOString(), approval_note: text(note, 1000) }).eq('id', Number(id)).select().single(), 'decide')
}

const LABEL = {
  quote: r => ({ number: r.number, title: r.title || r.client_name, party: r.client_name, total: r.total, currency: r.currency, link: `/quotes/${r.id}` }),
  purchase_order: r => ({ number: r.number, title: r.title || r.supplier_name, party: r.supplier_name, total: r.total, currency: r.currency, link: `/purchase-orders/${r.id}` }),
  client: r => ({ number: '', title: r.name, party: '', link: `/clients/${r.id}` }),
  supplier: r => ({ number: '', title: r.company_name, party: r.contact_person, link: `/suppliers/${r.id}` }),
}
const names = async ids => {
  const list = [...new Set(ids.filter(Boolean))]
  if (!list.length) return {}
  const { data } = await supabase.from('profiles').select('id,name,email').in('id', list)
  return Object.fromEntries((data || []).map(p => [p.id, p.name || p.email]))
}
/** Everything waiting for a decision, of the given record types, newest first. */
export async function listPending(types) {
  const out = []
  for (const type of types) {
    const { data, error } = await supabase.from(table(type)).select('*').eq('approval', 'pending').order('created_at', { ascending: false }).limit(200)
    if (error) { if (missing(error)) continue; throw fail(error, 'listPending') }
    for (const r of data || []) out.push({ type, id: r.id, submitted_by: r.submitted_by, created_at: r.created_at, ...LABEL[type](r) })
  }
  const who = await names(out.map(o => o.submitted_by))
  return out.map(o => ({ ...o, submitted_name: who[o.submitted_by] || 'Unknown' })).sort((a, b) => b.created_at.localeCompare(a.created_at))
}
export async function countPending() {
  let n = 0
  for (const t of Object.values(APPROVAL_TABLES)) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: false }).eq('approval', 'pending').limit(1)
    if (!error) n += count ?? 0
  }
  return n
}

/* ----------------------------------------------------------- amendments --- */
const pick = (o, keys) => Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k] ?? null]))
export async function createAmendment({ entity, before, patch, reason = '', user }) {
  if (!['quote', 'purchase_order'].includes(entity)) throw invalid('Only invoices and orders can be amended.')
  const open = (unwrap(await supabase.from('amendments').select('id').eq('entity', entity).eq('entity_id', before.id).eq('status', 'pending').limit(1), 'createAmendment:open')) ?? []
  if (open.length) throw invalid('An amendment of this document is already waiting for approval. Ask for it to be decided or cancelled first.', 409)
  const keys = Object.keys(patch)
  if (!keys.length) throw invalid('Nothing to amend.')
  return unwrap(await supabase.from('amendments').insert({
    entity, entity_id: before.id, entity_number: before.number || '', original: pick(before, keys), proposed: patch, reason: text(reason, 1000),
    initiated_by: user.id, initiated_name: user.name || user.email || '',
  }).select().single(), 'createAmendment')
}
export async function listAmendments({ status = 'all', entity = null, entity_id = null, limit = 200 } = {}) {
  let q = supabase.from('amendments').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status !== 'all') q = q.eq('status', status)
  if (entity) q = q.eq('entity', entity)
  if (entity_id != null) q = q.eq('entity_id', Number(entity_id))
  const { data, error } = await q
  if (error) { if (missing(error)) return []; throw fail(error, 'listAmendments') }
  return data || []
}
export async function getAmendment(id) { return (unwrap(await supabase.from('amendments').select('*').eq('id', Number(id)).limit(1), 'getAmendment'))?.[0] ?? null }
export async function closeAmendment(id, { status, by, byName, note = '' }) {
  return unwrap(await supabase.from('amendments').update({ status, reviewed_by: by, reviewed_name: byName || '', reviewed_at: new Date().toISOString(), review_note: text(note, 1000) }).eq('id', Number(id)).eq('status', 'pending').select().single(), 'closeAmendment')
}
