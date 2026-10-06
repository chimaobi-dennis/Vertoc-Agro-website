/*
 * Investor profile change requests (migration 019). Anything already on an
 * investor's record changes only through a request: a reason, supporting
 * documents where the kind of change needs them, review by Investment staff
 * (who recommend) and acceptance by an Admin (who applies it). Every request
 * keeps what it replaced, who touched it and when. Supabase only.
 */
import { supabase } from './supabase.js'
import { CONTROLLED_FIELDS, cleanInvestor, getInvestor } from './portals.js'

export const CHANGES_HINT = 'This needs the database migration 019: run server/migrations/019_investor_profiles.sql in the Supabase SQL editor first.'
const missing = e => ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e?.code)
const invalid = (message, status = 400) => Object.assign(new Error(message), { expose: true, status })
const fail = (e, ctx) => (missing(e) ? invalid(CHANGES_HINT, 409) : new Error(`${ctx}: ${e.message}`))
const unwrap = ({ data, error }, ctx) => { if (error) throw fail(error, ctx); return data }
const text = (s, max = 2000) => String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)

export const SUPPORT_LABEL = 'Change request support'
export const PICTURE_LABEL = 'Profile picture'
export const REQUEST_STATUSES = ['draft', 'submitted', 'under_review', 'resubmission_required', 'approved', 'rejected', 'cancelled']
export const REQUEST_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under review', resubmission_required: 'Resubmission required', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' }

/** What can be asked to change, grouped by the paperwork each kind of change needs. */
export const CHANGE_GROUPS = {
  name: { label: 'Name', required: true, docs: 'A valid government-issued ID, plus an affidavit, marriage certificate or deed poll where the name itself changes.', fields: { name: 'Full name or company name', title: 'Title', first_name: 'First name', middle_name: 'Middle name', last_name: 'Last name' } },
  phone: { label: 'Phone number', required: true, docs: 'A valid means of identification showing you.', fields: { phone: 'Phone number' } },
  email: { label: 'Email address', required: false, docs: 'Only to correct an error. A supporting document helps but is not required.', fields: { email: 'Email address' } },
  address: { label: 'Address', required: true, docs: 'Proof of address: a recent utility bill, tenancy agreement or bank statement.', fields: { address: 'Residential address' } },
  dob: { label: 'Date of birth and nationality', required: true, docs: 'A valid government-issued ID that shows the correct details.', fields: { date_of_birth: 'Date of birth', nationality: 'Nationality' } },
  origin: { label: 'State of origin and LGA', required: false, docs: 'Optional.', fields: { state_of_origin: 'State of origin', lga: 'LGA' } },
  identification: { label: 'Identification', required: true, docs: 'The new identification document.', fields: { id_type: 'Means of identification', id_number: 'Identification number' } },
  bank: { label: 'Bank details', required: true, docs: 'A bank statement or a letter from your bank in the account name.', fields: { bank_name: 'Bank', bank_account_name: 'Account name', bank_account_number: 'Account number' } },
  picture: { label: 'Profile picture', required: false, docs: 'The new picture is the document.', fields: { avatar: 'Profile picture' } },
}
const FIELD_GROUP = Object.fromEntries(Object.entries(CHANGE_GROUPS).flatMap(([g, d]) => Object.keys(d.fields).map(f => [f, g])))
const FIELD_LABEL = Object.fromEntries(Object.values(CHANGE_GROUPS).flatMap(d => Object.entries(d.fields)))
export const changeMeta = () => CHANGE_GROUPS

const asText = v => (v == null ? '' : String(v))
const hist = (row, by, action, note = '') => [...(row.history || []), { at: new Date().toISOString(), by, action, note: text(note, 1000) }]

async function supportDocs(investorId, ids, { label }) {
  if (!ids.length) return []
  const docs = unwrap(await supabase.from('documents').select('id,name,label,content_type,bytes,created_at,status,investor_id').in('id', ids.map(Number)), 'supportDocs') ?? []
  for (const id of ids) {
    const d = docs.find(x => x.id === Number(id))
    if (!d || d.investor_id !== investorId || d.status !== 'ready' || d.label !== label) throw invalid('One of the attached documents could not be found. Upload it again.')
  }
  return docs
}

/** An investor asks for changes to what is on record. */
export async function createRequest(investor, { changes = {}, reason = '', document_ids = [], previous_id = null } = {}) {
  const cur = await getInvestor(investor.id)
  const open = unwrap(await supabase.from('investor_change_requests').select('id').eq('investor_id', cur.id).in('status', ['submitted', 'under_review']).limit(1), 'createRequest:open') ?? []
  if (open.length) throw invalid('You already have a change waiting for review. Wait for the decision, or cancel it first.', 409)
  let prev = null
  if (previous_id) {
    prev = unwrap(await supabase.from('investor_change_requests').select('*').eq('id', Number(previous_id)).eq('investor_id', cur.id).limit(1), 'createRequest:prev')?.[0]
    if (!prev || prev.status !== 'resubmission_required') throw invalid('That request is not waiting for a resubmission.', 409)
  }
  const out = {}
  for (const [field, value] of Object.entries(changes || {})) {
    if (!FIELD_GROUP[field]) throw invalid(`${field} cannot be changed here.`)
    if (field === 'avatar') {
      const [doc] = await supportDocs(cur.id, [value], { label: PICTURE_LABEL })
      if (!cur.avatar_document_id) throw invalid('You have no profile picture yet: add one directly.')
      if (doc.id === cur.avatar_document_id) continue
      out.avatar = { from: cur.avatar_document_id, to: doc.id }
      continue
    }
    const cleaned = cleanInvestor({ [field]: value }, { partial: true, existing: cur })
    let to = cleaned[field]
    if (field === 'email') { to = asText(value).trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw invalid('Please enter a valid email address.') }
    const from = field === 'date_of_birth' ? (cur.date_of_birth ? String(cur.date_of_birth).slice(0, 10) : '') : asText(cur[field])
    if (asText(to) === from) continue
    if (from === '' && field !== 'name' && CONTROLLED_FIELDS.includes(field)) throw invalid(`${FIELD_LABEL[field]} is not on your record yet: add it directly in your profile.`)
    out[field] = { from, to: asText(to) }
  }
  if (!Object.keys(out).length) throw invalid('Nothing is different from what we have on record.')
  if (text(reason).length < 5) throw invalid('Please tell us why the information needs to change.')
  const needs = [...new Set(Object.keys(out).map(f => FIELD_GROUP[f]))].filter(g => CHANGE_GROUPS[g].required)
  const ids = [...new Set((document_ids || []).map(Number))]
  const docs = await supportDocs(cur.id, ids, { label: SUPPORT_LABEL })
  if (needs.length && !docs.length) throw invalid(`Please attach a supporting document: ${needs.map(g => `${CHANGE_GROUPS[g].label.toLowerCase()} — ${CHANGE_GROUPS[g].docs}`).join(' ')}`)
  const row = unwrap(await supabase.from('investor_change_requests').insert({
    investor_id: cur.id, status: 'submitted', changes: out, reason: text(reason, 1500), document_ids: ids, previous_id: prev?.id ?? null,
    history: [{ at: new Date().toISOString(), by: cur.name, action: prev ? 'resubmitted' : 'submitted', note: text(reason, 1000) }],
  }).select().single(), 'createRequest')
  if (prev) unwrap(await supabase.from('investor_change_requests').update({ superseded_by: row.id, history: hist(prev, cur.name, 'superseded by a resubmission') }).eq('id', prev.id).select('id').single(), 'createRequest:link')
  return row
}

const withDocs = async (rows, extra = []) => {
  const ids = [...new Set(rows.flatMap(r => r.document_ids || []).concat(extra))]
  const docs = ids.length ? (unwrap(await supabase.from('documents').select('id,name,label,content_type,bytes,created_at').in('id', ids), 'withDocs') ?? []) : []
  return rows.map(r => ({ ...r, documents: (r.document_ids || []).map(id => docs.find(d => d.id === Number(id))).filter(Boolean) }))
}
export async function listRequests({ investor_id = null, status = 'all', limit = 300 } = {}) {
  let q = supabase.from('investor_change_requests').select('*').order('created_at', { ascending: false }).limit(limit)
  if (investor_id != null) q = q.eq('investor_id', Number(investor_id))
  if (status === 'open') q = q.in('status', ['submitted', 'under_review'])
  else if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) { if (missing(error)) return []; throw fail(error, 'listRequests') }
  const rows = await withDocs(data || [])
  const ids = [...new Set(rows.map(r => r.investor_id))]
  const people = ids.length ? (await supabase.from('investors').select('id,name,email,kyc_status').in('id', ids)).data || [] : []
  return rows.map(r => ({ ...r, investor: people.find(p => p.id === r.investor_id) || null }))
}
export async function getRequest(id) {
  const r = unwrap(await supabase.from('investor_change_requests').select('*').eq('id', Number(id)).limit(1), 'getRequest')?.[0]
  if (!r) return null
  const [row] = await withDocs([r])
  const investor = await getInvestor(r.investor_id)
  return { ...row, investor: investor && { id: investor.id, name: investor.name, email: investor.email, kyc_status: investor.kyc_status } }
}
export async function pendingRequests() {
  const { count, error } = await supabase.from('investor_change_requests').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'under_review'])
  return error ? 0 : (count ?? 0)
}

export async function cancelRequest(investor, id) {
  const r = await getRequest(id)
  if (!r || r.investor_id !== investor.id) throw invalid('request not found', 404)
  if (!['submitted', 'under_review', 'resubmission_required'].includes(r.status)) throw invalid('This request was already decided.', 409)
  return unwrap(await supabase.from('investor_change_requests').update({ status: 'cancelled', history: hist(r, investor.name, 'cancelled by the investor') }).eq('id', r.id).select().single(), 'cancelRequest')
}

/** Apply an approved request to the official profile. */
async function apply(r) {
  const inv = await getInvestor(r.investor_id)
  const row = {}
  for (const [field, c] of Object.entries(r.changes)) {
    if (field === 'avatar') row.avatar_document_id = Number(c.to)
    else if (field === 'date_of_birth') row.date_of_birth = c.to || null
    else row[field] = c.to
  }
  // An individual's name follows its parts, unless the name itself was what changed.
  if (!('name' in row) && ['first_name', 'middle_name', 'last_name'].some(k => k in row)) {
    const m = { ...inv, ...row }
    const composed = [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ')
    if (composed) row.name = composed
  }
  if (row.email) {
    const taken = unwrap(await supabase.from('investors').select('id').ilike('email', row.email).neq('id', inv.id).limit(1), 'apply:email') ?? []
    if (taken.length) throw invalid('Another investor already uses that email address, so it cannot be applied.', 409)
    if (inv.user_id) { const { error } = await supabase.auth.admin.updateUserById(inv.user_id, { email: row.email, email_confirm: true }); if (error) throw invalid(error.message) }
  }
  return unwrap(await supabase.from('investors').update(row).eq('id', inv.id).select().single(), 'apply')
}

/**
 * Staff act on a request. `action`: start | approve | reject | resubmit.
 * Investment reviewers who are not Admins can only recommend; an Admin's approval applies the change.
 */
export async function reviewRequest(id, action, { user, isAdmin, note = '' }) {
  const r = await getRequest(id)
  if (!r) throw invalid('request not found', 404)
  if (!['submitted', 'under_review'].includes(r.status)) throw invalid(`This request is ${REQUEST_LABELS[r.status].toLowerCase()}; it cannot be reviewed again.`, 409)
  const by = user.name || user.email || 'staff'
  const upd = async patch => unwrap(await supabase.from('investor_change_requests').update(patch).eq('id', r.id).select().single(), 'reviewRequest')
  if (action === 'start') return r.status === 'under_review' ? r : upd({ status: 'under_review', history: hist(r, by, 'review started') })
  if (action === 'resubmit') {
    if (!text(note)) throw invalid('Please say what the investor should correct or add.')
    return upd({ status: 'resubmission_required', reviewer_id: user.id, reviewer_name: by, reviewed_at: new Date().toISOString(), review_note: text(note, 1000), history: hist(r, by, 'asked for a resubmission', note) })
  }
  if (action === 'reject') {
    if (!text(note)) throw invalid('Please give the reason for rejecting: the investor will see it.')
    return upd({ status: 'rejected', reviewer_id: user.id, reviewer_name: by, reviewed_at: new Date().toISOString(), review_note: text(note, 1000), history: hist(r, by, 'rejected', note) })
  }
  if (action !== 'approve') throw invalid('unknown action')
  if (!isAdmin) {
    if (r.recommended_by === user.id) throw invalid('You already recommended this. An Admin has to accept it.', 409)
    return upd({ status: 'under_review', recommended_by: user.id, recommended_name: by, recommended_at: new Date().toISOString(), history: hist(r, by, 'recommended approval; waiting for an Admin', note) })
  }
  const investor = await apply(r)
  const done = await upd({ status: 'approved', reviewer_id: user.id, reviewer_name: by, reviewed_at: new Date().toISOString(), review_note: text(note, 1000), history: hist(r, by, 'approved and applied', note) })
  return { ...done, investor }
}
