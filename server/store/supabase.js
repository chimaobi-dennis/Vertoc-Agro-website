import { stateByName } from '../ng-states.js'
/*
 * Supabase (Postgres) driver.
 *
 * Talks to Postgres with the service_role key, which bypasses Row Level
 * Security — so this module must only ever run on the server. The key must
 * never appear in a VITE_* variable, because Vite inlines those into the
 * browser bundle.
 *
 * jsonb columns come back already parsed, and `featured` is a real boolean,
 * so this driver needs none of the SQLite driver's encoding round-trips.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { slugify } from './slugify.js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error('Supabase driver selected but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
}

export const supabase = createSupabaseClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Unwrap a PostgREST response, turning its error into a thrown Error. */
function unwrap({ data, error }, context) {
  if (error) throw new Error(`${context}: ${error.message}`)
  return data
}

const byIdOrSlug = (q, value) => {
  const n = Number(value)
  return Number.isInteger(n) && String(n) === String(value)
    ? q.eq('id', n)
    : q.eq('slug', String(value))
}

/* ----------------------------------------------------------- products --- */

export async function listProducts({ status = 'published', limit = 100, offset = 0 } = {}) {
  let q = supabase.from('products').select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)
  if (status !== 'all') q = q.eq('status', status)
  return unwrap(await q, 'listProducts') ?? []
}

/** Public callers see published rows only; pass { status: 'all' } for admin/MCP. */
export async function getProduct(slugOrId, { status = 'published' } = {}) {
  let q = byIdOrSlug(supabase.from('products').select('*'), slugOrId)
  if (status !== 'all') q = q.eq('status', status)
  const rows = unwrap(await q.limit(1), 'getProduct')
  return rows?.[0] ?? null
}

export async function createProduct(input) {
  if (!input?.name) throw new Error('name is required')
  const slug = slugify(input.slug || input.name)
  if (await getProduct(slug, { status: 'all' })) throw new Error(`a product with slug "${slug}" already exists`)

  const row = {
    slug,
    name: input.name,
    category: input.category ?? 'Agro',
    summary: input.summary ?? '',
    description: input.description ?? '',
    image: input.image ?? '',
    origin: input.origin ?? '',
    processing: input.processing ?? '',
    packaging: input.packaging ?? '',
    moq: input.moq ?? '',
    grade: input.grade ?? '',
    hs_code: input.hs_code ?? '',
    applications: input.applications ?? [],
    certifications: input.certifications ?? [],
    specs: input.specs ?? [],
    featured: Boolean(input.featured),
    status: input.status ?? 'published',
    sort_order: input.sort_order ?? 0,
  }
  const data = unwrap(await supabase.from('products').insert(row).select().single(), 'createProduct')
  return data
}

const PRODUCT_PATCHABLE = [
  'name', 'category', 'summary', 'description', 'image', 'origin', 'processing',
  'packaging', 'moq', 'grade', 'hs_code', 'applications', 'certifications',
  'specs', 'featured', 'status', 'sort_order',
]

export async function updateProduct(slugOrId, patch) {
  const existing = await getProduct(slugOrId, { status: 'all' })
  if (!existing) throw new Error(`no product found for "${slugOrId}"`)

  const row = {}
  for (const f of PRODUCT_PATCHABLE) if (patch[f] !== undefined) row[f] = patch[f]
  if (patch.featured !== undefined) row.featured = Boolean(patch.featured)
  if (patch.slug !== undefined) row.slug = slugify(patch.slug)
  if (!Object.keys(row).length) return existing

  return unwrap(
    await supabase.from('products').update(row).eq('id', existing.id).select().single(),
    'updateProduct'
  )
}

export async function deleteProduct(slugOrId) {
  const existing = await getProduct(slugOrId, { status: 'all' })
  if (!existing) throw new Error(`no product found for "${slugOrId}"`)
  unwrap(await supabase.from('products').delete().eq('id', existing.id), 'deleteProduct')
  return { deleted: true, slug: existing.slug, name: existing.name }
}

/* -------------------------------------------------------------- posts --- */

export async function listPosts({ status = 'published', limit = 100, offset = 0 } = {}) {
  let q = supabase.from('posts').select('*')
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)
  if (status !== 'all') q = q.eq('status', status)
  return unwrap(await q, 'listPosts') ?? []
}

export async function getPost(slugOrId, { status = 'published' } = {}) {
  let q = byIdOrSlug(supabase.from('posts').select('*'), slugOrId)
  if (status !== 'all') q = q.eq('status', status)
  const rows = unwrap(await q.limit(1), 'getPost')
  return rows?.[0] ?? null
}

export async function createPost(input) {
  if (!input?.title) throw new Error('title is required')
  const slug = slugify(input.slug || input.title)
  if (await getPost(slug, { status: 'all' })) throw new Error(`a post with slug "${slug}" already exists`)

  const row = {
    slug,
    title: input.title,
    excerpt: input.excerpt ?? '',
    body: input.body ?? '',
    category: input.category ?? 'Insights',
    image: input.image ?? '',
    author: input.author ?? 'Vertoc Agro',
    read_time: input.read_time ?? '5 min read',
    status: input.status ?? 'published',
    published_at: input.published_at ?? new Date().toISOString().slice(0, 10),
  }
  return unwrap(await supabase.from('posts').insert(row).select().single(), 'createPost')
}

const POST_PATCHABLE = [
  'title', 'excerpt', 'body', 'category', 'image',
  'author', 'read_time', 'status', 'published_at',
]

export async function updatePost(slugOrId, patch) {
  const existing = await getPost(slugOrId, { status: 'all' })
  if (!existing) throw new Error(`no post found for "${slugOrId}"`)

  const row = {}
  for (const f of POST_PATCHABLE) if (patch[f] !== undefined) row[f] = patch[f]
  if (patch.slug !== undefined) row.slug = slugify(patch.slug)
  if (!Object.keys(row).length) return existing

  return unwrap(
    await supabase.from('posts').update(row).eq('id', existing.id).select().single(),
    'updatePost'
  )
}

export async function deletePost(slugOrId) {
  const existing = await getPost(slugOrId, { status: 'all' })
  if (!existing) throw new Error(`no post found for "${slugOrId}"`)
  unwrap(await supabase.from('posts').delete().eq('id', existing.id), 'deletePost')
  return { deleted: true, slug: existing.slug, title: existing.title }
}

/* ---------------------------------------------------------- enquiries --- */

export async function createEnquiry(input) {
  if (!input?.name) throw new Error('name is required')
  if (!input?.email) throw new Error('email is required')
  const row = {
    kind: input.kind === 'quote' ? 'quote' : 'contact',
    name: input.name,
    email: input.email,
    phone: input.phone ?? '',
    subject: input.subject ?? '',
    message: input.message ?? '',
    commodity: input.commodity ?? '',
    quantity: input.quantity ?? '',
    destination: input.destination ?? '',
  }
  return unwrap(await supabase.from('enquiries').insert(row).select().single(), 'createEnquiry')
}

export async function getEnquiry(id) {
  const rows = unwrap(await supabase.from('enquiries').select('*').eq('id', Number(id)).limit(1), 'getEnquiry')
  return rows?.[0] ?? null
}

export async function listEnquiries({ status = 'all', kind = 'all', limit = 50, offset = 0 } = {}) {
  let q = supabase.from('enquiries').select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)
  if (status !== 'all') q = q.eq('status', status)
  if (kind !== 'all') q = q.eq('kind', kind)
  return unwrap(await q, 'listEnquiries') ?? []
}

export async function updateEnquiryStatus(id, status) {
  return updateEnquiry(id, { status })
}

/* ============================================= PHASE 2: CLIENTS + INBOX == */

/* ------------------------------------------------------ custom fields --- */
// One implementation serves both client_fields and quote_fields: the user
// decides what each record tracks, and the form, table and exports follow.

export const FIELD_TYPES = ['text', 'textarea', 'email', 'phone', 'number', 'date', 'select', 'checkbox', 'url', 'image', 'file']
export const FILE_TYPES = ['image', 'file']

const fieldKey = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

function fieldStore(table) {
  const ctx = op => `${op} ${table}`
  const list = async () => unwrap(await supabase.from(table).select('*').order('sort_order').order('id'), ctx('list')) ?? []
  const get = async id => (unwrap(await supabase.from(table).select('*').eq('id', Number(id)).limit(1), ctx('get')))?.[0] ?? null
  const create = async input => {
    const label = String(input?.label || '').trim()
    if (!label) throw new Error('label is required')
    const key = fieldKey(input.key || label)
    if (!key) throw new Error('could not derive a key from that label')
    const type = input.type || 'text'
    if (!FIELD_TYPES.includes(type)) throw new Error(`type must be one of: ${FIELD_TYPES.join(', ')}`)
    const options = type === 'select' ? (Array.isArray(input.options) ? input.options.map(String).map(o => o.trim()).filter(Boolean) : []) : []
    if (type === 'select' && !options.length) throw new Error('a select field needs at least one option')
    const { data: last } = await supabase.from(table).select('sort_order').order('sort_order', { ascending: false }).limit(1)
    const row = { key, label, type, options, required: Boolean(input.required), show_in_list: input.show_in_list !== false, sort_order: (last?.[0]?.sort_order ?? 0) + 10 }
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? `a field with key "${key}" already exists` : error.message)
    return data
  }
  const update = async (id, patch) => {
    const existing = await get(id)
    if (!existing) throw new Error(`no field with id ${id}`)
    const row = {}
    if (patch.label !== undefined) { row.label = String(patch.label).trim(); if (!row.label) throw new Error('label cannot be empty') }
    if (patch.type !== undefined) { if (!FIELD_TYPES.includes(patch.type)) throw new Error(`type must be one of: ${FIELD_TYPES.join(', ')}`); row.type = patch.type }
    if (patch.options !== undefined) row.options = Array.isArray(patch.options) ? patch.options.map(String).map(o => o.trim()).filter(Boolean) : []
    if (patch.required !== undefined) row.required = Boolean(patch.required)
    if (patch.show_in_list !== undefined) row.show_in_list = Boolean(patch.show_in_list)
    if (patch.sort_order !== undefined) row.sort_order = Number(patch.sort_order) || 0
    if (!Object.keys(row).length) return existing
    return unwrap(await supabase.from(table).update(row).eq('id', existing.id).select().single(), ctx('update'))
  }
  const remove = async id => {
    const f = await get(id)
    if (!f) throw new Error(`no field with id ${id}`)
    unwrap(await supabase.from(table).delete().eq('id', f.id), ctx('delete'))
    return { deleted: true, id: f.id, key: f.key, label: f.label }
  }
  const reorder = async ids => {
    if (!Array.isArray(ids) || !ids.length) throw new Error('ids must be a non-empty array')
    for (let i = 0; i < ids.length; i++) {
      unwrap(await supabase.from(table).update({ sort_order: (i + 1) * 10 }).eq('id', Number(ids[i])), ctx('reorder'))
    }
    return list()
  }
  return { list, get, create, update, remove, reorder }
}

const clientFields = fieldStore('client_fields')
const quoteFields = fieldStore('quote_fields')

export const listClientFields = clientFields.list, getClientField = clientFields.get, createClientField = clientFields.create,
  updateClientField = clientFields.update, deleteClientField = clientFields.remove, reorderClientFields = clientFields.reorder
export const listQuoteFields = quoteFields.list, getQuoteField = quoteFields.get, createQuoteField = quoteFields.create,
  updateQuoteField = quoteFields.update, deleteQuoteField = quoteFields.remove, reorderQuoteFields = quoteFields.reorder

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Validate and clean a record's dynamic data against the current field
 * definitions. File and image values are `{ id, name }` references to rows in
 * `documents`; they are verified to exist so a record can never point at a
 * file that was never uploaded.
 */
export async function cleanFieldData(data, fields) {
  const out = {}, errors = [], refs = []
  for (const f of fields) {
    let v = data?.[f.key]
    if (f.type === 'checkbox') { out[f.key] = Boolean(v); continue }
    if (FILE_TYPES.includes(f.type)) {
      if (v == null || v === '') { out[f.key] = null; if (f.required) errors.push(`${f.label} is required`); continue }
      const id = Number(typeof v === 'object' ? v.id : v)
      if (!Number.isInteger(id) || id <= 0) { errors.push(`${f.label} must be an uploaded file`); continue }
      refs.push([f, id]); continue
    }
    v = v == null ? '' : String(v).trim()
    if (f.required && !v) { errors.push(`${f.label} is required`); continue }
    if (v) {
      if (f.type === 'email' && !EMAIL_RE.test(v)) errors.push(`${f.label} must be a valid email`)
      else if (f.type === 'number' && Number.isNaN(Number(v))) errors.push(`${f.label} must be a number`)
      else if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push(`${f.label} must be a date (YYYY-MM-DD)`)
      else if (f.type === 'url' && !/^https?:\/\//i.test(v)) errors.push(`${f.label} must start with http:// or https://`)
      else if (f.type === 'select' && !(f.options || []).includes(v)) errors.push(`${f.label} must be one of: ${(f.options || []).join(', ')}`)
    }
    out[f.key] = v
  }
  if (refs.length) {
    const docs = unwrap(await supabase.from('documents').select('id, name, kind').in('id', refs.map(r => r[1])).eq('status', 'ready'), 'cleanFieldData:documents') ?? []
    for (const [f, id] of refs) {
      const d = docs.find(x => x.id === id)
      if (!d) { errors.push(`${f.label}: that file no longer exists`); continue }
      if (f.type === 'image' && d.kind !== 'image') { errors.push(`${f.label} must be an image`); continue }
      out[f.key] = { id: d.id, name: d.name }
    }
  }
  if (errors.length) throw new Error(errors.join('; '))
  return out
}
export const cleanClientData = cleanFieldData

/** Document ids referenced by file/image fields in a data object. */
const fileRefs = (data, fields) => fields.filter(f => FILE_TYPES.includes(f.type)).map(f => data?.[f.key]?.id).filter(Boolean)

/* ------------------------------------------------------------ clients --- */

export async function listClients({ status = 'active', limit = 500, offset = 0 } = {}) {
  let q = supabase.from('clients').select('*').order('name').range(offset, offset + limit - 1)
  if (status !== 'all') q = q.eq('status', status)
  return unwrap(await q, 'listClients') ?? []
}

export async function getClient(id) {
  const rows = unwrap(await supabase.from('clients').select('*').eq('id', Number(id)).limit(1), 'getClient')
  return rows?.[0] ?? null
}

export async function createClient(input, actorId = null) {
  const name = String(input?.name || '').trim()
  if (!name) throw new Error('name is required')
  const fields = await listClientFields()
  const data = await cleanFieldData(input.data || {}, fields)
  const row = { name, data, status: input.status === 'archived' ? 'archived' : 'active', created_by: actorId }
  const c = unwrap(await supabase.from('clients').insert(row).select().single(), 'createClient')
  await adoptDocuments(fileRefs(data, fields), { client_id: c.id })
  return c
}

export async function updateClient(id, patch) {
  const existing = await getClient(id)
  if (!existing) throw new Error(`no client with id ${id}`)
  const row = {}
  if (patch.name !== undefined) { row.name = String(patch.name).trim(); if (!row.name) throw new Error('name cannot be empty') }
  if (patch.status !== undefined) { if (!['active', 'archived'].includes(patch.status)) throw new Error('status must be active or archived'); row.status = patch.status }
  let fields = null
  if (patch.data !== undefined) { fields = await listClientFields(); row.data = await cleanFieldData({ ...existing.data, ...patch.data }, fields) }
  if (!Object.keys(row).length) return existing
  const c = unwrap(await supabase.from('clients').update(row).eq('id', existing.id).select().single(), 'updateClient')
  if (fields) await adoptDocuments(fileRefs(c.data, fields), { client_id: c.id })
  return c
}

export async function deleteClient(id) {
  const existing = await getClient(id)
  if (!existing) throw new Error(`no client with id ${id}`)
  // Files belong to the client: remove them from storage before the row
  // cascade drops their records.
  const docs = unwrap(await supabase.from('documents').select('path').eq('client_id', existing.id), 'deleteClient:docs') ?? []
  if (docs.length) await supabase.storage.from('documents').remove(docs.map(d => d.path))
  unwrap(await supabase.from('clients').delete().eq('id', existing.id), 'deleteClient')
  return { deleted: true, id: existing.id, name: existing.name }
}

export async function listClientEnquiries(clientId) {
  return unwrap(await supabase.from('enquiries').select('*').eq('client_id', Number(clientId)).order('created_at', { ascending: false }), 'listClientEnquiries') ?? []
}

/* ---------------------------------------------------- enquiry pipeline --- */

export const ENQUIRY_STAGES = {
  quote:   ['new', 'contacted', 'quoted', 'won', 'lost', 'archived'],
  contact: ['new', 'replied', 'archived'],
}

export async function updateEnquiry(id, patch) {
  const existing = await getEnquiry(id)
  if (!existing) throw new Error(`no enquiry found with id ${id}`)
  const row = {}
  if (patch.status !== undefined) {
    const allowed = ENQUIRY_STAGES[existing.kind] || ENQUIRY_STAGES.contact
    if (!allowed.includes(patch.status)) throw new Error(`status for a ${existing.kind} enquiry must be one of: ${allowed.join(', ')}`)
    if (patch.status !== existing.status) { row.status = patch.status; row.status_changed_at = new Date().toISOString() }
  }
  if (patch.client_id !== undefined) {
    if (patch.client_id === null || patch.client_id === '') row.client_id = null
    else { const c = await getClient(patch.client_id); if (!c) throw new Error(`no client with id ${patch.client_id}`); row.client_id = c.id }
  }
  if (patch.notes !== undefined) row.notes = String(patch.notes).slice(0, 10000)
  if (!Object.keys(row).length) return existing
  return unwrap(await supabase.from('enquiries').update(row).eq('id', existing.id).select().single(), 'updateEnquiry')
}

/* ===================== PHASE 3: DOCUMENTS, QUOTES, MESSAGES, PURCHASES == */

const str = (v, max = 10000) => String(v ?? '').trim().slice(0, max)
const money = v => Math.round((Number(v) || 0) * 100) / 100
const currencyCode = c => { const s = String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); return s.length === 3 ? s : 'USD' }
const dateOnly = v => { const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new Error('dates must be YYYY-MM-DD'); return s }
const addDays = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const idOrNull = v => (v == null || v === '' ? null : Number(v))

/* ----------------------------------------------------------- settings --- */

export const DEFAULT_SETTINGS = {
  site: {
    name: 'Vertoc Agro', legal_name: 'Vertoc Agro Products Limited', tagline: 'Premium Agricultural Commodities',
    description: 'Cultivation, sourcing, processing, storage, logistics, and export of premium agricultural commodities across Nigeria and beyond.',
    logo: '/assets/img/logo.png', favicon: '/assets/img/favicon.png',
    email: 'sales@vertocagro.com', phone: '+234 913 500 9001', whatsapp: '2349135009001',
    address: 'Akala Express Way, Ibadan, Oyo State, Nigeria', hours: 'Mon - Fri: 8:00 AM - 5:00 PM (WAT)', hours_short: 'Mon-Fri 8AM-5PM',
    facebook: 'https://facebook.com/VertocAgro', instagram: 'https://instagram.com/vertocagro', linkedin: 'https://linkedin.com/company/vertocagro',
    twitter: 'https://x.com/vertocagro', threads: 'https://www.threads.com/@vertocagro',
  },
  company: { name: 'Vertoc Agro', address: 'Akala Express Way, Ibadan, Oyo State, Nigeria', phone: '+234 913 500 9001', email: 'sales@vertocagro.com', website: 'https://vertocagro.com' },
  quotes: { default_currency: 'USD', valid_days: 14, terms: '', payment_text: '' },
  email: {
    from: 'Vertoc Agro <sales@vertocagro.com>', reply_to: 'sales@vertocagro.com', signature: 'Vertoc Agro\n+234 913 500 9001\nsales@vertocagro.com',
    inbound_address: '',        // address clients reply to once Resend receiving is set up; used as Reply-To when set
    ack_enquiries: true,        // confirm website quote requests to the sender automatically
    notify_enquiries: true,     // email the team when a quote request arrives
    notify_reviews: true,       // email the team when a client submits a review on the website
    notify_to: '',              // team address for notifications; falls back to reply_to
    notify_inbound: true, notify_responses: true,
  },
  mcp: { enabled: true, token_hash: '', token_hint: '', rotated_at: null },
}
const SETTING_GROUPS = Object.keys(DEFAULT_SETTINGS)

export async function getSettings() {
  const rows = unwrap(await supabase.from('settings').select('key, value').in('key', SETTING_GROUPS), 'getSettings') ?? []
  const out = structuredClone(DEFAULT_SETTINGS)
  for (const r of rows) if (out[r.key] && r.value && typeof r.value === 'object') out[r.key] = { ...out[r.key], ...r.value }
  return out
}

export async function updateSettings(patch) {
  const current = await getSettings()
  const next = {}
  for (const [group, val] of Object.entries(patch || {})) {
    if (!SETTING_GROUPS.includes(group)) throw new Error(`unknown settings group "${group}"`)
    if (!val || typeof val !== 'object') throw new Error(`${group} must be an object`)
    const merged = { ...current[group] }
    for (const [k, v] of Object.entries(val)) {
      if (!(k in DEFAULT_SETTINGS[group])) continue
      const d = DEFAULT_SETTINGS[group][k]
      if (typeof d === 'number') merged[k] = Number(v) || 0
      else if (typeof d === 'boolean') merged[k] = Boolean(v)
      else if (d === null) merged[k] = v == null ? null : String(v)
      else merged[k] = String(v ?? '').trim().slice(0, 4000)
    }
    if (group === 'quotes') { merged.default_currency = currencyCode(merged.default_currency); merged.valid_days = Math.min(Math.max(Math.round(merged.valid_days) || 14, 1), 365) }
    if (group === 'email' && merged.from && !/^(.+<)?[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>?$/.test(merged.from)) throw new Error('From must look like "Name <address@domain>" or a plain address')
    if (group === 'site') for (const k of ['facebook', 'instagram', 'linkedin', 'twitter', 'threads']) if (merged[k] && !/^https?:\/\//i.test(merged[k])) throw new Error(`${k} must start with http:// or https://`)
    unwrap(await supabase.from('settings').upsert({ key: group, value: merged }, { onConflict: 'key' }), 'updateSettings')
    next[group] = merged
  }
  return { ...current, ...next }
}

/** Encrypted secrets row. Values are opaque records from secrets.js. */
export async function readSecrets() {
  const rows = unwrap(await supabase.from('settings').select('value').eq('key', 'secrets').limit(1), 'readSecrets')
  return rows?.[0]?.value ?? {}
}
export async function writeSecret(name, record) {
  const all = await readSecrets()
  if (record == null) delete all[name]; else all[name] = record
  unwrap(await supabase.from('settings').upsert({ key: 'secrets', value: all }, { onConflict: 'key' }), 'writeSecret')
  return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { hint: v.hint, set_at: v.set_at }]))
}

/* ---------------------------------------------------------- documents --- */

export const DOC_TYPES = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/csv': 'csv', 'text/plain': 'txt',
}
export const DOC_MAX_BYTES = 20 * 1024 * 1024
const safeName = n => String(n || 'file').replace(/[\\/]+/g, '-').replace(/[^\w.\- ()]+/g, '-').replace(/\s+/g, ' ').trim().slice(-120) || 'file'

/**
 * Step 1 of an upload: validate, record the file as `pending`, and hand the
 * browser a signed upload URL so the bytes go straight to storage (Vercel
 * caps function bodies at 4.5 MB; documents can be 20 MB).
 */
export async function createDocument({ client_id = null, quote_id = null, name, content_type, bytes }, actorId = null) {
  const ct = String(content_type || '').toLowerCase().split(';')[0].trim()
  if (!DOC_TYPES[ct]) throw new Error('That file type is not allowed. Use images, PDF, Word, Excel, PowerPoint, CSV or text files.')
  const size = Number(bytes) || 0
  if (size <= 0) throw new Error('File appears to be empty.')
  if (size > DOC_MAX_BYTES) throw new Error('Files must be under 20 MB.')
  client_id = idOrNull(client_id); quote_id = idOrNull(quote_id)
  if (client_id != null) { const c = await getClient(client_id); if (!c) throw new Error(`no client with id ${client_id}`) }
  if (quote_id != null) { const q = await getQuote(quote_id); if (!q) throw new Error(`no quote with id ${quote_id}`); client_id ??= q.client_id }
  const clean = safeName(name)
  const folder = client_id ? `clients/${client_id}` : quote_id ? `quotes/${quote_id}` : 'shared'
  const path = `${folder}/${Date.now()}-${randomBytes(4).toString('hex')}-${clean.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`
  const row = { client_id, quote_id, name: clean, path, content_type: ct, bytes: size, kind: ct.startsWith('image/') ? 'image' : 'file', status: 'pending', uploaded_by: actorId }
  const document = unwrap(await supabase.from('documents').insert(row).select().single(), 'createDocument')
  const signed = unwrap(await supabase.storage.from('documents').createSignedUploadUrl(path), 'createDocument:sign')
  return { document, upload: { path, token: signed.token, signedUrl: signed.signedUrl } }
}

/** Step 2: the browser reports the upload finished; we confirm the object exists. */
export async function completeDocument(id) {
  const doc = await getDocument(id, { any: true })
  if (!doc) throw new Error(`no document with id ${id}`)
  if (doc.status === 'ready') return doc
  const cut = doc.path.lastIndexOf('/')
  const dir = doc.path.slice(0, cut), base = doc.path.slice(cut + 1)
  const objs = unwrap(await supabase.storage.from('documents').list(dir, { search: base, limit: 10 }), 'completeDocument:list') ?? []
  const obj = objs.find(o => o.name === base)
  if (!obj) throw new Error('The upload did not complete. Please try again.')
  const patch = { status: 'ready' }
  const size = Number(obj.metadata?.size); if (size > 0) patch.bytes = size
  return unwrap(await supabase.from('documents').update(patch).eq('id', doc.id).select().single(), 'completeDocument')
}

export async function getDocument(id, { any = false } = {}) {
  let q = supabase.from('documents').select('*').eq('id', Number(id))
  if (!any) q = q.eq('status', 'ready')
  return (unwrap(await q.limit(1), 'getDocument'))?.[0] ?? null
}

export async function listDocuments({ client_id, quote_id, limit = 200 } = {}) {
  let q = supabase.from('documents').select('*').eq('status', 'ready').order('created_at', { ascending: false }).limit(limit)
  if (client_id != null) q = q.eq('client_id', Number(client_id))
  if (quote_id != null) q = q.eq('quote_id', Number(quote_id))
  return unwrap(await q, 'listDocuments') ?? []
}

/** Short-lived signed URL. `download` forces an attachment disposition. */
export async function documentUrl(id, { download = false, expires = 3600 } = {}) {
  const document = await getDocument(id)
  if (!document) throw new Error(`no document with id ${id}`)
  const { signedUrl } = unwrap(await supabase.storage.from('documents').createSignedUrl(document.path, expires, download ? { download: document.name } : {}), 'documentUrl')
  return { url: signedUrl, expires_in: expires, document }
}

export async function downloadDocument(id) {
  const document = await getDocument(id)
  if (!document) throw new Error(`no document with id ${id}`)
  const blob = unwrap(await supabase.storage.from('documents').download(document.path), 'downloadDocument')
  return { document, content: Buffer.from(await blob.arrayBuffer()) }
}

export async function deleteDocument(id) {
  const doc = await getDocument(id, { any: true })
  if (!doc) throw new Error(`no document with id ${id}`)
  await supabase.storage.from('documents').remove([doc.path])
  unwrap(await supabase.from('documents').delete().eq('id', doc.id), 'deleteDocument')
  return { deleted: true, id: doc.id, name: doc.name }
}

/** A file the server already holds (inbound attachment): store it and record it as ready. */
export async function createDocumentFromBuffer({ client_id = null, quote_id = null, name, content_type, content, folder = 'inbound' }, actorId = null) {
  const ct = String(content_type || '').toLowerCase().split(';')[0].trim()
  if (!DOC_TYPES[ct]) throw new Error(`attachment type not allowed: ${ct}`)
  if (!content?.length) throw new Error('empty attachment')
  if (content.length > DOC_MAX_BYTES) throw new Error('attachment over 20 MB')
  const clean = safeName(name)
  const path = `${folder}/${Date.now()}-${randomBytes(4).toString('hex')}-${clean.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`
  unwrap(await supabase.storage.from('documents').upload(path, content, { contentType: ct, upsert: false }), 'createDocumentFromBuffer:upload')
  const row = { client_id: idOrNull(client_id), quote_id: idOrNull(quote_id), name: clean, path, content_type: ct, bytes: content.length, kind: ct.startsWith('image/') ? 'image' : 'file', status: 'ready', uploaded_by: actorId }
  return unwrap(await supabase.from('documents').insert(row).select().single(), 'createDocumentFromBuffer')
}

/** Attach still-unowned documents (uploaded before the record existed) to it. */
async function adoptDocuments(ids, owner) {
  if (!ids.length) return
  for (const [col, val] of Object.entries(owner)) {
    if (val == null) continue
    unwrap(await supabase.from('documents').update({ [col]: val }).in('id', ids).is(col, null), 'adoptDocuments')
  }
}

/* ------------------------------------------------------------- quotes --- */

export const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired']

export function normaliseItems(items) {
  if (!Array.isArray(items)) throw new Error('items must be an array')
  if (items.length > 100) throw new Error('a quote can have at most 100 line items')
  return items.map((it, i) => {
    const description = str(it?.description, 500)
    if (!description) throw new Error(`line ${i + 1} needs a description`)
    const quantity = Math.round((Number(it.quantity ?? 1)) * 1000) / 1000
    if (!(quantity > 0)) throw new Error(`line ${i + 1}: quantity must be greater than zero`)
    const unit_price = money(it.unit_price)
    if (unit_price < 0) throw new Error(`line ${i + 1}: unit price cannot be negative`)
    return { description, quantity, unit: str(it.unit, 30), unit_price, total: money(quantity * unit_price) }
  })
}

export function quoteTotals({ items = [], discount = 0, tax_rate = 0 }) {
  const subtotal = money(items.reduce((s, it) => s + (Number(it.total) || 0), 0))
  const d = money(discount)
  if (d < 0) throw new Error('discount cannot be negative')
  if (d > subtotal) throw new Error('discount cannot exceed the subtotal')
  const t = Number(tax_rate) || 0
  if (t < 0 || t > 100) throw new Error('tax rate must be between 0 and 100')
  const taxable = money(subtotal - d)
  return { subtotal, discount: d, tax_rate: t, total: money(taxable + taxable * t / 100) }
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

export async function listQuotes({ status = 'all', client_id, limit = 500, offset = 0 } = {}) {
  let q = supabase.from('quotes').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (status === 'open') q = q.in('status', ['sent', 'viewed'])
  else if (status !== 'all') q = q.eq('status', status)
  if (client_id != null) q = q.eq('client_id', Number(client_id))
  return unwrap(await q, 'listQuotes') ?? []
}

export async function getQuote(id) {
  return (unwrap(await supabase.from('quotes').select('*').eq('id', Number(id)).limit(1), 'getQuote'))?.[0] ?? null
}

export async function getQuoteByToken(token) {
  if (!TOKEN_RE.test(String(token || ''))) return null
  return (unwrap(await supabase.from('quotes').select('*').eq('token', String(token)).limit(1), 'getQuoteByToken'))?.[0] ?? null
}

/* ---------------------------------------------------- invoice numbers --- */
// VA-YYYY-NNNN. The prefix and the year are fixed; staff may choose the
// digits after them, otherwise the next free number for the year is used
// (so a manual VA-2026-0020 is followed by VA-2026-0021). `number` is
// unique in the database, so two people creating at the same moment are
// resolved by retrying with the next number.
export const NUMBER_PREFIX = 'VA'
const NUMBER_RE = /^([A-Z]{2})-(\d{4})-(\d{1,6})$/
const numberOf = (year, n) => `${NUMBER_PREFIX}-${year}-${String(n).padStart(4, '0')}`
const yearOf = number => Number(NUMBER_RE.exec(String(number || ''))?.[2]) || null

/** Accepts "6", "0006" or "VA-2026-0006"; returns the canonical number for `year` or throws. */
export function parseQuoteNumber(input, year) {
  const s = String(input ?? '').trim().toUpperCase()
  const example = numberOf(year, 1)
  let digits
  if (/^\d{1,6}$/.test(s)) digits = s
  else {
    const m = NUMBER_RE.exec(s)
    if (!m || m[1] !== NUMBER_PREFIX || Number(m[2]) !== year) throw new Error(`Invoice numbers look like ${example}; only the digits after ${NUMBER_PREFIX}-${year}- can be changed`)
    digits = m[3]
  }
  const n = Number(digits)
  if (!Number.isInteger(n) || n < 1) throw new Error(`The invoice number must be 1 or higher (e.g. ${example})`)
  return numberOf(year, n)
}

/** Highest number already used for a year, manual or automatic. */
async function highestQuoteNumber(year) {
  const rows = unwrap(await supabase.from('quotes').select('number').like('number', `${NUMBER_PREFIX}-${year}-%`), 'highestQuoteNumber')
  return (rows || []).reduce((max, r) => { const m = NUMBER_RE.exec(r.number); return m ? Math.max(max, Number(m[3])) : max }, 0)
}
const isDuplicateNumber = error => error?.code === '23505' && /number/i.test(`${error.message} ${error.details}`)

export async function createQuote(input, actorId = null) {
  const settings = await getSettings()
  const fields = await listQuoteFields()
  const client_id = idOrNull(input?.client_id)
  const client = client_id != null ? await getClient(client_id) : null
  if (client_id != null && !client) throw new Error(`no client with id ${client_id}`)
  const items = normaliseItems(input?.items ?? [])
  const totals = quoteTotals({ items, discount: input?.discount, tax_rate: input?.tax_rate })
  const data = await cleanFieldData(input?.data || {}, fields)
  const year = new Date().getFullYear()
  const manual = input?.number != null && String(input.number).trim() !== '' ? parseQuoteNumber(input.number, year) : null
  const row = {
    token: randomBytes(24).toString('base64url'),
    client_id: client?.id ?? null,
    client_name: str(input?.client_name ?? client?.name, 200),
    client_email: str(input?.client_email ?? client?.data?.email, 200),
    title: str(input?.title, 200),
    status: 'draft',
    currency: currencyCode(input?.currency || settings.quotes.default_currency),
    items, ...totals,
    notes: str(input?.notes), terms: input?.terms !== undefined ? str(input.terms) : (settings.quotes.terms || ''), internal_notes: str(input?.internal_notes),
    data,
    valid_until: input?.valid_until ? dateOnly(input.valid_until) : addDays(settings.quotes.valid_days || 14),
    created_by: actorId,
  }
  let q = null
  for (let attempt = 0; attempt < 6 && !q; attempt++) {
    const number = manual || numberOf(year, await highestQuoteNumber(year) + 1)
    const { data: inserted, error } = await supabase.from('quotes').insert({ ...row, number }).select().single()
    if (!error) q = inserted
    else if (!isDuplicateNumber(error)) throw new Error(`createQuote: ${error.message}`)
    else if (manual) throw new Error(`${number} is already used by another invoice`)
  }
  if (!q) throw new Error('could not allocate an invoice number; please try again')
  await adoptDocuments(fileRefs(q.data, fields), { quote_id: q.id, client_id: q.client_id })
  return q
}

const QUOTE_LOCKED = ['items', 'discount', 'tax_rate', 'currency']

export async function updateQuote(id, patch) {
  const existing = await getQuote(id)
  if (!existing) throw new Error(`no quote with id ${id}`)
  if (existing.status === 'accepted' && QUOTE_LOCKED.some(k => patch[k] !== undefined)) {
    throw new Error('this quote was accepted by the client; prices are locked. Create a new quote instead.')
  }
  const row = {}
  if (patch.client_id !== undefined) {
    const cid = idOrNull(patch.client_id)
    if (cid == null) row.client_id = null
    else {
      const c = await getClient(cid); if (!c) throw new Error(`no client with id ${cid}`)
      row.client_id = c.id
      if (patch.client_name === undefined) row.client_name = c.name
      if (patch.client_email === undefined) row.client_email = str(c.data?.email, 200)
    }
  }
  for (const k of ['client_name', 'client_email', 'title']) if (patch[k] !== undefined) row[k] = str(patch[k], 200)
  if (patch.number !== undefined && String(patch.number).trim() !== '') {
    const number = parseQuoteNumber(patch.number, yearOf(existing.number) || new Date(existing.created_at).getFullYear())
    if (number !== existing.number) {
      if (existing.status === 'accepted') throw new Error('this invoice was accepted by the client; its number is locked.')
      const clash = await getQuoteByNumber(number)
      if (clash && clash.id !== existing.id) throw new Error(`${number} is already used by another invoice`)
      row.number = number
    }
  }
  for (const k of ['notes', 'terms', 'internal_notes', 'response_note']) if (patch[k] !== undefined) row[k] = str(patch[k])
  if (patch.currency !== undefined) row.currency = currencyCode(patch.currency)
  if (patch.valid_until !== undefined) row.valid_until = patch.valid_until ? dateOnly(patch.valid_until) : null
  if (patch.items !== undefined) row.items = normaliseItems(patch.items)
  if (patch.items !== undefined || patch.discount !== undefined || patch.tax_rate !== undefined) {
    Object.assign(row, quoteTotals({ items: row.items ?? existing.items, discount: patch.discount ?? existing.discount, tax_rate: patch.tax_rate ?? existing.tax_rate }))
  }
  let fields = null
  if (patch.data !== undefined) { fields = await listQuoteFields(); row.data = await cleanFieldData({ ...existing.data, ...patch.data }, fields) }
  if (patch.status !== undefined && patch.status !== existing.status) {
    if (!QUOTE_STATUSES.includes(patch.status)) throw new Error(`status must be one of: ${QUOTE_STATUSES.join(', ')}`)
    row.status = patch.status
    const now = new Date().toISOString()
    if (patch.status === 'sent' && !existing.sent_at) row.sent_at = now
    if (['accepted', 'declined'].includes(patch.status)) row.responded_at = now
  }
  if (!Object.keys(row).length) return existing
  const q = unwrap(await supabase.from('quotes').update(row).eq('id', existing.id).select().single(), 'updateQuote')
  if (fields) await adoptDocuments(fileRefs(q.data, fields), { quote_id: q.id, client_id: q.client_id })
  return q
}

export async function deleteQuote(id) {
  const q = await getQuote(id)
  if (!q) throw new Error(`no quote with id ${id}`)
  unwrap(await supabase.from('quotes').delete().eq('id', q.id), 'deleteQuote')
  return { deleted: true, id: q.id, number: q.number }
}

/** Called after a successful send: the quote is now live at its public link. */
export async function markQuoteSent(id, { to } = {}) {
  const q = await getQuote(id)
  if (!q) throw new Error(`no quote with id ${id}`)
  const row = {}
  if (['draft', 'expired'].includes(q.status)) row.status = 'sent'
  if (!q.sent_at) row.sent_at = new Date().toISOString()
  if (to && to !== q.client_email) row.client_email = str(to, 200)
  if (!Object.keys(row).length) return q
  return unwrap(await supabase.from('quotes').update(row).eq('id', q.id).select().single(), 'markQuoteSent')
}

/** First open of the public link flips sent -> viewed. */
export async function markQuoteViewed(id) {
  const q = await getQuote(id)
  if (!q || q.status !== 'sent') return q
  return unwrap(await supabase.from('quotes').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', q.id).select().single(), 'markQuoteViewed')
}

const isExpired = q => q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10)

/** The client's answer from the public page. Returns the updated quote. */
export async function respondToQuote(token, action, note = '') {
  const q = await getQuoteByToken(token)
  if (!q) return null
  if (!['accept', 'decline'].includes(action)) throw new Error('action must be accept or decline')
  if (['accepted', 'declined'].includes(q.status)) throw new Error('This invoice has already been answered.')
  if (q.status === 'expired' || isExpired(q)) {
    if (q.status !== 'expired') await supabase.from('quotes').update({ status: 'expired' }).eq('id', q.id)
    throw new Error('This invoice has expired. Please contact us for an updated one.')
  }
  const row = { status: action === 'accept' ? 'accepted' : 'declined', responded_at: new Date().toISOString(), response_note: str(note, 2000) }
  return unwrap(await supabase.from('quotes').update(row).eq('id', q.id).select().single(), 'respondToQuote')
}

/** What the public page and the PDF may see: no internal notes, no ids. */
export function publicQuote(q, settings, fields = []) {
  const expired = q.status === 'expired' || (['sent', 'viewed'].includes(q.status) && isExpired(q))
  return {
    number: q.number, title: q.title, status: expired ? 'expired' : q.status,
    client_name: q.client_name, currency: q.currency, items: q.items,
    subtotal: q.subtotal, discount: q.discount, tax_rate: q.tax_rate, total: q.total,
    notes: q.notes, terms: q.terms, valid_until: q.valid_until,
    sent_at: q.sent_at, date: q.sent_at || q.created_at, responded_at: q.responded_at, response_note: q.response_note,
    fields: fields.map(f => ({ label: f.label, value: f.type === 'checkbox' ? (q.data?.[f.key] ? 'Yes' : '') : (q.data?.[f.key] && typeof q.data[f.key] === 'object' ? q.data[f.key].name : q.data?.[f.key] ?? '') })).filter(f => f.value),
    company: settings.company, payment_text: settings.quotes.payment_text,
  }
}

/* ---------------------------------------------------------- shipments --- */
// An invoice can leave on several trucks, vessels or flights. A shipment
// takes a share of each invoice line (items: [{index, percent}]); per line,
// the shares of the non-cancelled shipments never exceed 100. `percent` is
// the value-weighted share of the whole invoice, kept for lists. Checkpoints
// are the pins staff drop state by state; the last one is the current
// location. Needs migrations 010 + 011.
export const SHIPMENT_STATUSES = ['planned', 'in_transit', 'delivered', 'cancelled']
export const SHIPMENT_MODES = ['road', 'sea', 'air']
export const SHIPMENTS_MIGRATION_HINT = 'Shipments need the database migration 010: run server/migrations/010_shipments.sql in the Supabase SQL editor first.'
export const SHIPMENT_DETAILS_HINT = 'Shipments need the database migration 011: run server/migrations/011_shipment_details.sql in the Supabase SQL editor first.'
const errText = e => String(e?.message || '')
const missingShipments = e => e?.code === '42P01' || e?.code === 'PGRST205' || /relation "public\.?shipment|table 'public\.shipment|shipment[_a-z]* does not exist/i.test(errText(e))
const missingColumns = e => e?.code === '42703' || e?.code === 'PGRST204' || /column .*(items|mode|eta)/i.test(errText(e))
const shipErr = (e, ctx) => (missingShipments(e) ? Object.assign(new Error(SHIPMENTS_MIGRATION_HINT), { expose: true, status: 409 })
  : missingColumns(e) ? Object.assign(new Error(SHIPMENT_DETAILS_HINT), { expose: true, status: 409 }) : new Error(`${ctx}: ${e.message}`))
const pct = v => Math.round((Number(v) || 0) * 100) / 100
const coord = (v, max) => { const n = Number(v); return v == null || v === '' || !Number.isFinite(n) || Math.abs(n) > max ? null : Math.round(n * 1e5) / 1e5 }
const cleanDate = v => { if (v == null || v === '') return null; const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new Error('expected date of arrival must be a date (YYYY-MM-DD)'); return s }
// {name, state, lat, lng}; a known state fills in the capital's coordinates.
function cleanPoint(p, label, { required = true } = {}) {
  const name = tt(p?.name, 120), st = stateByName(p?.state)
  let lat = coord(p?.lat, 90), lng = coord(p?.lng, 180)
  if ((lat == null || lng == null) && st) { lat = st.lat; lng = st.lng }
  if (!name && !st) { if (required) throw new Error(`${label}: pick a state or a port, or give a place name`); return { name: '', state: '', lat: null, lng: null } }
  if (lat == null || lng == null) throw new Error(`${label}: "${name}" needs coordinates — pick a state or a port, or enter latitude and longitude`)
  return { name: name || `${st.capital}, ${st.state}`, state: st ? st.state : tt(p?.state, 40), lat, lng }
}
const lineAmount = it => (Number(it?.quantity) || 0) * (Number(it?.unit_price) || 0)
/** The share of invoice line i a shipment carries; shipments from before per-line shares carry `percent` of every line. */
const lineShareOf = (s, i) => { const own = Array.isArray(s.items) && s.items.length ? s.items : null; if (!own) return Number(s.percent) || 0; const x = own.find(l => Number(l.index) === i); return x ? Number(x.percent) || 0 : 0 }
/** Per invoice line: what the (non-cancelled) shipments already take and what is left. */
const lineShares = (quote, shipments) => (quote.items || []).map((it, i) => {
  const shipped = Math.min(100, pct(shipments.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + lineShareOf(s, i), 0)))
  return { index: i, description: it.description || `Line ${i + 1}`, quantity: Number(it.quantity) || 0, unit: it.unit || '', shipped, remaining: pct(100 - shipped) }
})
/** Value-weighted share of the whole invoice (plain average when nothing is priced). */
function valueShare(quote, items) {
  const lines = quote.items || [], subtotal = lines.reduce((s, it) => s + lineAmount(it), 0)
  const share = subtotal > 0 ? items.reduce((s, x) => s + lineAmount(lines[x.index]) * x.percent / 100, 0) / subtotal * 100
    : items.reduce((s, x) => s + x.percent, 0) / Math.max(1, lines.length)
  return Math.max(0.01, pct(share))
}
// items as [{index, percent}] (or {index: percent}); `percent` alone means the same share of every line.
function cleanShipmentItems(input, quote, lines) {
  let raw = Array.isArray(input?.items) ? input.items : (input?.items && typeof input.items === 'object' ? Object.entries(input.items).map(([index, percent]) => ({ index, percent })) : null)
  if (!raw && input?.percent != null) raw = lines.map(l => ({ index: l.index, percent: input.percent }))
  if (!raw) throw new Error('say which share of each line goes on this shipment')
  const out = []
  for (const r of raw) {
    const i = Number(r?.index); const line = lines[i]
    if (!Number.isInteger(i) || !line) throw new Error(`line ${Number.isInteger(i) ? i + 1 : '?'} is not on this invoice`)
    const p = pct(r?.percent); if (p < 0 || p > 100) throw new Error(`the share of "${line.description}" must be between 0 and 100%`)
    if (p === 0) continue
    if (p > line.remaining + 0.001) throw new Error(`only ${line.remaining}% of "${line.description}" is left to ship`)
    if (out.some(x => x.index === i)) throw new Error(`"${line.description}" is listed twice`)
    out.push({ index: i, description: line.description, quantity: line.quantity, unit: line.unit, percent: p })
  }
  if (!out.length) throw new Error('give at least one line a share above 0%')
  return out.sort((a, b) => a.index - b.index)
}
const cleanMode = m => { if (m == null || m === '') return 'road'; if (!SHIPMENT_MODES.includes(m)) throw new Error(`mode must be one of ${SHIPMENT_MODES.join(', ')}`); return m }
const withCheckpoints = async rows => {
  if (!rows.length) return rows
  const { data, error } = await supabase.from('shipment_checkpoints').select('*').in('shipment_id', rows.map(r => r.id)).order('created_at', { ascending: true }).order('id', { ascending: true })
  if (error) throw shipErr(error, 'listCheckpoints')
  const by = new Map(rows.map(r => [r.id, []])); for (const c of data || []) by.get(c.shipment_id)?.push(c)
  return rows.map(r => ({ ...r, percent: Number(r.percent), items: Array.isArray(r.items) ? r.items : [], mode: r.mode || 'road', eta: r.eta || null, checkpoints: by.get(r.id) || [] }))
}
async function shipmentsOf(quote) {
  const { data, error } = await supabase.from('shipments').select('*').eq('quote_id', quote.id).order('number', { ascending: true })
  if (error) throw shipErr(error, 'listShipments')
  return withCheckpoints(data || [])
}
const summarise = (quote, items) => {
  const lines = lineShares(quote, items)
  const subtotal = (quote.items || []).reduce((s, it) => s + lineAmount(it), 0)
  const remaining = subtotal > 0 ? pct(lines.reduce((s, l) => s + lineAmount(quote.items[l.index]) * l.remaining / 100, 0) / subtotal * 100) : pct(lines.reduce((s, l) => s + l.remaining, 0) / Math.max(1, lines.length))
  return { items, lines, remaining, shipped: pct(100 - remaining), can_create: lines.some(l => l.remaining > 0) && quote.status !== 'declined' }
}
export async function listShipments(quote_id) {
  const q = await getQuote(quote_id)
  if (!q) throw new Error(`no invoice with id ${quote_id}`)
  return summarise(q, await shipmentsOf(q))
}
export async function getShipment(id) {
  const { data, error } = await supabase.from('shipments').select('*').eq('id', Number(id)).limit(1)
  if (error) throw shipErr(error, 'getShipment')
  const row = (await withCheckpoints(data || []))[0]
  if (!row) return null
  const quote = await getQuote(row.quote_id)
  const others = quote ? (await shipmentsOf(quote)).filter(x => x.id !== row.id) : []
  return {
    ...row,
    quote: quote && { id: quote.id, number: quote.number, title: quote.title, items: quote.items, currency: quote.currency, status: quote.status },
    lines_for_edit: quote ? lineShares(quote, others) : [],   // what this shipment may take, its own share excluded
  }
}
export async function createShipment(quote_id, input = {}, actorId = null) {
  const q = await getQuote(quote_id)
  if (!q) throw new Error(`no invoice with id ${quote_id}`)
  if (q.status === 'declined') throw new Error('this invoice was declined by the client — nothing to ship')
  const all = await listShipments(q.id)
  if (!all.can_create) throw new Error('this invoice is fully allocated — nothing left to ship')
  const items = cleanShipmentItems(input, q, all.lines)
  const row = {
    quote_id: q.id, number: all.items.length + 1, percent: valueShare(q, items), items, status: 'planned',
    mode: cleanMode(input.mode), vehicle: tt(input.vehicle, 160), eta: cleanDate(input.eta),
    origin: cleanPoint(input.origin, 'From'), destination: cleanPoint(input.destination, 'To'),
    notes: tt(input.notes, 1000), created_by: actorId,
  }
  const { data, error } = await supabase.from('shipments').insert(row).select().single()
  if (error) throw shipErr(error, 'createShipment')
  // Two staff creating at once could overshoot a line: re-check and undo if so.
  const after = lineShares(q, await shipmentsOf(q))
  const over = after.find(l => l.shipped > 100.001 || (l.remaining < 0))
  if (over || after.some((l, i) => l.shipped > 100 && items.some(x => x.index === i))) { await supabase.from('shipments').delete().eq('id', data.id); throw new Error('another shipment was created at the same time — check what is left and try again') }
  return (await withCheckpoints([data]))[0]
}
export async function updateShipment(id, patch = {}, actorId = null) {
  const cur = await getShipment(id)
  if (!cur) throw new Error(`no shipment with id ${id}`)
  const quote = await getQuote(cur.quote_id)
  const row = { updated_at: new Date().toISOString() }
  if (patch.origin !== undefined) row.origin = cleanPoint(patch.origin, 'From')
  if (patch.destination !== undefined) row.destination = cleanPoint(patch.destination, 'To')
  if (patch.vehicle !== undefined) row.vehicle = tt(patch.vehicle, 160)
  if (patch.notes !== undefined) row.notes = tt(patch.notes, 1000)
  if (patch.mode !== undefined) row.mode = cleanMode(patch.mode)
  if (patch.eta !== undefined) row.eta = cleanDate(patch.eta)
  const willBeActive = (patch.status ?? cur.status) !== 'cancelled'
  if (patch.items !== undefined || patch.percent !== undefined) {
    // A cancelled shipment may hold any share; it is checked again when reopened.
    const room = willBeActive ? cur.lines_for_edit : cur.lines_for_edit.map(l => ({ ...l, remaining: 100 }))
    row.items = cleanShipmentItems(patch, quote, room); row.percent = valueShare(quote, row.items)
  }
  if (patch.status !== undefined) {
    if (!SHIPMENT_STATUSES.includes(patch.status)) throw new Error(`status must be one of ${SHIPMENT_STATUSES.join(', ')}`)
    if (patch.status !== 'cancelled' && cur.status === 'cancelled') {
      const items = row.items || (cur.items.length ? cur.items : cur.lines_for_edit.map(l => ({ index: l.index, description: l.description, percent: cur.percent })))
      for (const x of items) { const l = cur.lines_for_edit[x.index]; if (l && Number(x.percent) > l.remaining + 0.001) throw new Error(`only ${l.remaining}% of "${l.description}" is left to ship — reduce this shipment's share first`) }
    }
    row.status = patch.status
    row.delivered_at = patch.status === 'delivered' ? (cur.delivered_at || new Date().toISOString()) : null
  }
  const { data, error } = await supabase.from('shipments').update(row).eq('id', cur.id).select().single()
  if (error) throw shipErr(error, 'updateShipment')
  // Delivered: pin it at the destination unless the last pin already is.
  if (row.status === 'delivered' && data.destination?.lat != null) {
    const last = cur.checkpoints[cur.checkpoints.length - 1]
    if (!last || last.lat !== data.destination.lat || last.lng !== data.destination.lng) {
      const { error: ce } = await supabase.from('shipment_checkpoints').insert({ shipment_id: cur.id, name: data.destination.name, state: data.destination.state || '', lat: data.destination.lat, lng: data.destination.lng, note: 'Delivered', created_by: actorId })
      if (ce) throw shipErr(ce, 'deliverShipment')
    }
  }
  return getShipment(cur.id)
}
export async function deleteShipment(id) {
  const cur = await getShipment(id)
  if (!cur) throw new Error(`no shipment with id ${id}`)
  const { error } = await supabase.from('shipments').delete().eq('id', cur.id)
  if (error) throw shipErr(error, 'deleteShipment')
  return { deleted: true, id: cur.id, quote_id: cur.quote_id }
}
export async function addCheckpoint(shipment_id, input = {}, actorId = null) {
  const cur = await getShipment(shipment_id)
  if (!cur) throw new Error(`no shipment with id ${shipment_id}`)
  if (cur.status === 'delivered' || cur.status === 'cancelled') throw new Error(`this shipment is ${cur.status} — reopen it to add locations`)
  const p = cleanPoint({ ...input, name: input.name || '' }, 'Location')
  if (!p.name) throw new Error('Location: pick a state or click the map')
  const { error } = await supabase.from('shipment_checkpoints').insert({ shipment_id: cur.id, name: p.name, state: p.state, lat: p.lat, lng: p.lng, note: tt(input.note, 500), created_by: actorId })
  if (error) throw shipErr(error, 'addCheckpoint')
  const { error: ue } = await supabase.from('shipments').update({ status: cur.status === 'planned' ? 'in_transit' : cur.status, updated_at: new Date().toISOString() }).eq('id', cur.id)
  if (ue) throw shipErr(ue, 'addCheckpoint')
  return getShipment(cur.id)
}
export async function deleteCheckpoint(shipment_id, checkpoint_id) {
  const cur = await getShipment(shipment_id)
  if (!cur) throw new Error(`no shipment with id ${shipment_id}`)
  const { error } = await supabase.from('shipment_checkpoints').delete().eq('id', Number(checkpoint_id)).eq('shipment_id', cur.id)
  if (error) throw shipErr(error, 'deleteCheckpoint')
  await supabase.from('shipments').update({ updated_at: new Date().toISOString() }).eq('id', cur.id)
  return getShipment(cur.id)
}
/** What the client sees on the invoice link. */
export const publicShipment = s => ({
  id: s.id, number: s.number, percent: Number(s.percent), items: s.items || [], status: s.status, mode: s.mode || 'road', vehicle: s.vehicle, eta: s.eta || null,
  origin: s.origin, destination: s.destination, notes: s.notes,
  created_at: s.created_at, updated_at: s.updated_at, delivered_at: s.delivered_at,
  checkpoints: (s.checkpoints || []).map(c => ({ id: c.id, name: c.name, state: c.state, lat: c.lat, lng: c.lng, note: c.note, created_at: c.created_at })),
})

/* ----------------------------------------------------------- messages --- */

export async function createMessage(row) {
  return unwrap(await supabase.from('messages').insert(row).select().single(), 'createMessage')
}
export async function updateMessage(id, patch) {
  return unwrap(await supabase.from('messages').update(patch).eq('id', Number(id)).select().single(), 'updateMessage')
}
export async function getMessage(id) {
  return (unwrap(await supabase.from('messages').select('*').eq('id', Number(id)).limit(1), 'getMessage'))?.[0] ?? null
}
export async function listMessages({ client_id, quote_id, enquiry_id, direction = 'all', unread = false, q = '', limit = 200 } = {}) {
  let qry = supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(limit)
  if (client_id != null) qry = qry.eq('client_id', Number(client_id))
  if (quote_id != null) qry = qry.eq('quote_id', Number(quote_id))
  if (enquiry_id != null) qry = qry.eq('enquiry_id', Number(enquiry_id))
  if (direction === 'in' || direction === 'out') qry = qry.eq('direction', direction)
  if (unread) qry = qry.eq('direction', 'in').is('read_at', null)
  const term = String(q || '').trim().replace(/[%,()]/g, '')
  if (term) qry = qry.or(`subject.ilike.%${term}%,from_email.ilike.%${term}%,to_email.ilike.%${term}%,from_name.ilike.%${term}%`)
  return unwrap(await qry, 'listMessages') ?? []
}
export async function markMessageRead(id, read = true) {
  return unwrap(await supabase.from('messages').update({ read_at: read ? new Date().toISOString() : null }).eq('id', Number(id)).select().single(), 'markMessageRead')
}
export async function getMessageByProviderId(providerId, direction = 'in') {
  return (unwrap(await supabase.from('messages').select('*').eq('provider_id', String(providerId)).eq('direction', direction).limit(1), 'getMessageByProviderId'))?.[0] ?? null
}
/** The most recent email we sent to this address — a reply usually belongs to that conversation. */
export async function latestOutboundTo(email) {
  return (unwrap(await supabase.from('messages').select('*').eq('direction', 'out').ilike('to_email', String(email)).order('created_at', { ascending: false }).limit(1), 'latestOutboundTo'))?.[0] ?? null
}
export async function countUnreadInbound() {
  const { count, error } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('direction', 'in').is('read_at', null)
  return error ? 0 : (count ?? 0)
}
export async function findClientByEmail(email) {
  const e = String(email || '').trim(); if (!e) return null
  return (unwrap(await supabase.from('clients').select('*').ilike('data->>email', e).order('status').limit(1), 'findClientByEmail'))?.[0] ?? null
}
/* ------------------------------------------------------ homepage stats --- */
// The four number tiles on the homepage ("8+ Years of Experience"). Stored in
// the settings table under 'homepage_stats' (outside the settings groups) and
// served with the public site data. Defaults equal the old hard-coded tiles.
export const STAT_ICON_NAMES = ['Anchor', 'Award', 'Earth', 'BadgeCheck', 'BadgeDollarSign', 'Beef', 'Boxes', 'Building2', 'CalendarCheck', 'Clock', 'Coins', 'Container', 'Eye', 'Factory', 'FlaskConical', 'Globe', 'Handshake', 'HeartHandshake', 'Landmark', 'Leaf', 'Lightbulb', 'Link2', 'MapPin', 'Package', 'PackageSearch', 'Plane', 'Recycle', 'Scale', 'Shield', 'ShieldCheck', 'Ship', 'ShoppingBag', 'Sprout', 'Star', 'Store', 'Target', 'Tractor', 'TrendingUp', 'Truck', 'UserCheck', 'Users', 'UtensilsCrossed', 'Warehouse', 'Wheat']
export const DEFAULT_STATS = [
  { icon: 'CalendarCheck', value: 8, suffix: '+', label: 'Years of Experience' },
  { icon: 'Globe', value: 12, suffix: '+', label: 'Export Countries' },
  { icon: 'Package', value: 30, suffix: '+', label: 'Commodities' },
  { icon: 'Users', value: 500, suffix: '+', label: 'Partner Farmers' },
]
export async function getHomepageStats() {
  const rows = unwrap(await supabase.from('settings').select('value').eq('key', 'homepage_stats').limit(1), 'getHomepageStats')
  const items = rows?.[0]?.value?.items
  return Array.isArray(items) && items.length ? items : structuredClone(DEFAULT_STATS)
}
export async function setHomepageStats(list) {
  if (!Array.isArray(list)) throw new Error('stats must be a list')
  const items = []
  for (const s of list.slice(0, 8)) {
    const label = String(s?.label || '').replace(/\s+/g, ' ').trim().slice(0, 40)
    const value = Math.max(0, Math.round(Number(s?.value)))
    if (!label || !Number.isFinite(value)) continue
    items.push({ icon: STAT_ICON_NAMES.includes(s?.icon) ? s.icon : 'Award', value, suffix: String(s?.suffix ?? '+').trim().slice(0, 3), label })
  }
  if (!items.length) throw new Error('keep at least one stat')
  unwrap(await supabase.from('settings').upsert({ key: 'homepage_stats', value: { items } }, { onConflict: 'key' }), 'setHomepageStats')
  return items
}

/* ------------------------------------------- gallery, FAQ, services --- */
// Page content edited in place on the public site by signed-in staff.
export const DEFAULT_GALLERY = [
  { src: '/assets/img/file_00000000a91c71f4907a39cb638741b8.png', alt: 'Vertoc Agro factory and processing facility', title: 'Factory', caption: 'Vertoc Agro factory and processing facility' },
  { src: '/assets/img/h11102d4d7702475faebf710f672b997dr.jpg', alt: 'Industrial processing equipment and storage tanks', title: 'Processing', caption: 'Industrial processing equipment and storage tanks' },
  { src: '/assets/img/img-20260701-wa0028.jpg', alt: 'Warehouse with stacked commodity bags ready for shipment', title: 'Warehouse', caption: 'Warehouse with stacked commodity bags ready for shipment' },
  { src: '/assets/img/img-20260702-wa0046.jpg', alt: 'Burlap sacks of agricultural commodities on pallets', title: 'Storage', caption: 'Burlap sacks of agricultural commodities on pallets' },
  { src: '/assets/img/ce0b7f_8e81ef90b3ec4f219e3d24d81c544cd5-mv2.jpg', alt: 'Traditional palm oil fruit processing in large cooking pots', title: 'Palm Oil', caption: 'Traditional palm oil fruit processing in large cooking pots' },
  { src: '/assets/img/img-20260702-wa0049.jpg', alt: 'Cocoa beans being weighed on a digital scale', title: 'Cocoa', caption: 'Cocoa beans being weighed on a digital scale' },
  { src: '/assets/img/vertocimage11.jpg', alt: 'Soybeans packed in large bulk sacks', title: 'Soybeans', caption: 'Soybeans packed in large bulk sacks' },
  { src: '/assets/img/vertocimage13.jpeg', alt: 'Maize harvest bagged at the farm', title: 'Maize', caption: 'Maize harvest bagged at the farm' },
  { src: '/assets/img/vertocimage14.jpeg', alt: 'Bulk sacks of dried maize kernels', title: 'Maize', caption: 'Bulk sacks of dried maize kernels' },
  { src: '/assets/img/vertocimage15.jpeg', alt: 'Stacked commodity bags ready for distribution', title: 'Storage', caption: 'Stacked commodity bags ready for distribution' },
]
export const DEFAULT_FAQ = [
  { q: 'What agricultural commodities does Vertoc Agro trade in?', a: 'We trade in a wide range of premium Nigerian agricultural commodities including palm oil, maize, soybeans, cocoa, plantain, cassava, sesame seeds, ginger, rice, sorghum, millet, and groundnuts. If you need a specific commodity not listed, please contact us and we will source it for you.' },
  { q: 'Do you export commodities outside Nigeria?', a: 'Yes, export services are a core part of our business. We handle end-to-end export management including documentation, compliance, customs clearance, and international shipping coordination. We currently export to over 25 countries across Africa, Europe, Asia, and the Americas.' },
  { q: 'What is your minimum order quantity?', a: 'Our minimum order quantities vary by commodity. For most products, we can accommodate orders starting from 5 metric tonnes. For export shipments, typical minimums range from 1 to 5 full container loads depending on the commodity. Contact us for specific details.' },
  { q: 'How do you ensure product quality?', a: 'Quality assurance is embedded in every stage of our process. We conduct rigorous field inspections, laboratory testing, and grading before acceptance. Our processing and warehousing facilities maintain strict hygiene and climate control standards. All shipments come with certificates of analysis and quality assurance documentation.' },
  { q: 'What payment terms do you offer?', a: 'We offer flexible payment terms depending on the relationship and order size. Standard terms include advance payment, letter of credit (LC), and payment against documents. For established partners, we may offer open account terms with approved credit limits.' },
  { q: 'How long does delivery take after placing an order?', a: 'Delivery timelines depend on the commodity, order size, and destination. Domestic deliveries within Nigeria typically take 3-10 business days. Export shipments require additional time for documentation and logistics, generally 2-6 weeks depending on the destination port.' },
  { q: 'Do you work with smallholder farmers?', a: 'Absolutely. Partnership with smallholder farmers is central to our mission. We work directly with farming cooperatives and individual farmers, providing training, fair pricing, and reliable offtake agreements that help improve their livelihoods and productivity.' },
  { q: 'Can I visit your processing or warehousing facilities?', a: 'Yes, we welcome facility visits by qualified buyers and partners. Please contact us to schedule a visit. Our team will arrange a guided tour of our processing plants, warehouses, or farm sourcing locations depending on your interests.' },
  { q: 'Do you provide commodity price forecasts?', a: 'We regularly publish market analysis and price outlooks on our blog. For contracted partners, we provide personalized market intelligence and pricing updates relevant to their specific commodities and trading windows.' },
  { q: 'How can I become a registered buyer or partner?', a: 'Simply fill out the contact form on our website or send us an email at sales@vertocagro.com with your company details and commodity requirements. Our business development team will reach out to discuss your needs and onboarding process.' },
]
export const DEFAULT_SERVICES = [
  { icon: 'TrendingUp', title: 'Agro Commodity Trading', description: 'We buy and sell high-quality agricultural commodities across local and international markets, ensuring competitive prices and reliable supply.' },
  { icon: 'PackageSearch', title: 'Commodity Sourcing & Aggregation', description: 'Direct sourcing from smallholder and commercial farmers, aggregating produce to meet bulk demand with strict quality standards.' },
  { icon: 'Factory', title: 'Processing', description: 'State-of-the-art processing facilities to clean, grade, and prepare commodities for market-ready distribution and export.' },
  { icon: 'Warehouse', title: 'Warehousing', description: 'Secure, climate-controlled storage solutions that preserve commodity quality from harvest to delivery.' },
  { icon: 'Ship', title: 'Export Services', description: 'End-to-end export management including documentation, compliance, customs clearance, and international shipping coordination.' },
  { icon: 'Truck', title: 'Supply Chain & Logistics', description: 'Efficient transportation and logistics network ensuring timely delivery from farm gate to final destination.' },
  { icon: 'Boxes', title: 'Bulk Supply', description: 'Large-volume supply agreements for manufacturers, exporters, and industrial buyers with consistent quality assurance.' },
  { icon: 'ShoppingCart', title: 'Procurement Services', description: 'Strategic procurement consulting to help clients source the right commodities at the best value for their operations.' },
]
const readItems = async (key, fallback) => {
  const rows = unwrap(await supabase.from('settings').select('value').eq('key', key).limit(1), 'read:' + key)
  const items = rows?.[0]?.value?.items
  return Array.isArray(items) && items.length ? items : structuredClone(fallback)
}
const writeItems = async (key, items) => { unwrap(await supabase.from('settings').upsert({ key, value: { items } }, { onConflict: 'key' }), 'write:' + key); return items }
const tt = (s, max) => String(s ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, max)
export const getGallery = () => readItems('gallery', DEFAULT_GALLERY)
export async function setGallery(list) {
  if (!Array.isArray(list)) throw new Error('gallery must be a list')
  const items = list.slice(0, 60).map(p => ({ src: tt(p?.src, 500), alt: tt(p?.alt, 200), title: tt(p?.title, 60), caption: tt(p?.caption, 200) })).filter(p => /^(\/|https?:\/\/)/.test(p.src))
  if (!items.length) throw new Error('keep at least one photo')
  return writeItems('gallery', items.map(p => ({ ...p, alt: p.alt || p.caption || p.title })))
}
export const getFaq = () => readItems('faq', DEFAULT_FAQ)
export async function setFaq(list) {
  if (!Array.isArray(list)) throw new Error('faq must be a list')
  const items = list.slice(0, 40).map(f => ({ q: tt(f?.q, 200), a: tt(f?.a, 2000) })).filter(f => f.q && f.a)
  if (!items.length) throw new Error('keep at least one question')
  return writeItems('faq', items)
}
export const getServices = () => readItems('services', DEFAULT_SERVICES)
export async function setServices(list) {
  if (!Array.isArray(list)) throw new Error('services must be a list')
  const items = list.slice(0, 16).map(s => ({ icon: STAT_ICON_NAMES.includes(s?.icon) ? s.icon : 'Star', title: tt(s?.title, 60), description: tt(s?.description, 400) })).filter(s => s.title)
  if (!items.length) throw new Error('keep at least one service')
  return writeItems('services', items)
}

/* ------------------------------------------------------------- hero --- */
// The homepage hero: badge, three title lines, subtitle and the trust chips. The Export
// Countries stat tile is appended to the chips automatically by the page.
export const DEFAULT_HERO = {
  badge: 'NEPC Registered Exporter',
  title_1: 'Premium Nigerian', title_accent: 'Agro Commodities', title_2: 'for the World',
  subtitle: 'Cultivation of crops, sourcing, processing, storage, logistics, and export of premium agricultural commodities. Certified quality, reliable logistics, FOB Lagos.',
  chips: [
    { icon: 'Ship', title: 'FOB Lagos', caption: 'Global Shipping' },
    { icon: 'FlaskConical', title: 'Lab Tested', caption: 'Quality Assured' },
  ],
}
export async function getHero() {
  const rows = unwrap(await supabase.from('settings').select('value').eq('key', 'hero').limit(1), 'getHero')
  const v = rows?.[0]?.value
  return v && typeof v === 'object' && v.title_1 ? { ...structuredClone(DEFAULT_HERO), ...v } : structuredClone(DEFAULT_HERO)
}
export async function setHero(input = {}) {
  const value = {
    badge: tt(input.badge, 60), title_1: tt(input.title_1, 60), title_accent: tt(input.title_accent, 60), title_2: tt(input.title_2, 60), subtitle: tt(input.subtitle, 400),
    chips: (Array.isArray(input.chips) ? input.chips : []).slice(0, 5).map(c => ({ icon: STAT_ICON_NAMES.includes(c?.icon) ? c.icon : 'Star', title: tt(c?.title, 30), caption: tt(c?.caption, 30) })).filter(c => c.title),
  }
  if (!value.title_1 && !value.title_accent && !value.title_2) throw new Error('the hero needs a title')
  unwrap(await supabase.from('settings').upsert({ key: 'hero', value }, { onConflict: 'key' }), 'setHero')
  return value
}

/* ---------------------------------------------------- why choose us --- */
// The reasons on /industries/why-choose-us.
export const DEFAULT_WHY = [
  { icon: 'ShieldCheck', title: 'Certified Quality', description: 'All products meet international quality standards with full traceability and lab certification.' },
  { icon: 'Truck', title: 'Reliable Logistics', description: 'End-to-end shipping coordination from farm gate to FOB Lagos with real-time tracking.' },
  { icon: 'Factory', title: 'Modern Processing', description: 'State-of-the-art cleaning, sorting, drying, and packaging facilities ensuring premium grade.' },
  { icon: 'Handshake', title: 'Farmer Partnerships', description: 'Direct relationships with 500+ smallholder farmers across Nigeria for consistent supply.' },
  { icon: 'Award', title: 'NEPC Registered', description: 'Fully registered with the Nigerian Export Promotion Council for seamless export operations.' },
  { icon: 'Leaf', title: 'Sustainable Sourcing', description: 'Ethical and environmentally conscious practices that support local farming communities.' },
  { icon: 'BadgeCheck', title: 'Premium Quality Products', description: 'Rigorous quality control ensures every commodity meets international standards.' },
  { icon: 'Link2', title: 'Reliable Supply Chain', description: 'End-to-end logistics from farm to port with full traceability and transparency.' },
  { icon: 'BadgeDollarSign', title: 'Competitive Pricing', description: 'Direct farmer relationships and efficient operations translate to better prices.' },
  { icon: 'Clock', title: 'Timely Delivery', description: 'Commitment to on-time shipments with proactive communication at every stage.' },
  { icon: 'UserCheck', title: 'Experienced Team', description: 'Seasoned professionals with deep knowledge of Nigerian agriculture and global trade.' },
  { icon: 'Globe', title: 'Export Ready', description: 'Full export compliance, certifications, and documentation for international markets.' },
  { icon: 'Sprout', title: 'Sustainable Practices', description: 'Eco-friendly sourcing and processing methods that support long-term farm productivity.' },
  { icon: 'Handshake', title: 'Strong Relationships', description: 'Trusted partnerships with farmers, cooperatives, and buyers built over years.' },
]
export const getWhy = () => readItems('why', DEFAULT_WHY)
export async function setWhy(list) {
  if (!Array.isArray(list)) throw new Error('reasons must be a list')
  const items = list.slice(0, 16).map(s => ({ icon: STAT_ICON_NAMES.includes(s?.icon) ? s.icon : 'Star', title: tt(s?.title, 60), description: tt(s?.description, 300) })).filter(s => s.title)
  if (!items.length) throw new Error('keep at least one reason')
  return writeItems('why', items)
}

/* -------------------------------------------------- sustainability --- */
// The five policy frameworks on /sustainability, each with its sections.
export const POLICY_COLORS = ['accent', 'primary', 'info', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']
export const DEFAULT_SUSTAINABILITY = [
  {
    key: 'esg', label: 'ESG Policy', icon: 'Leaf', color: 'accent',
    title: 'Environmental, Social & Governance Policy', tagline: 'Responsible growth that protects people and planet.',
    intro: 'Vertoc Agro Products Limited is committed to integrating Environmental, Social, and Governance (ESG) principles at the heart of our business strategy. We believe that sustainable commerce is not just ethical — it is essential for long-term value creation.',
    sections: [
      { heading: 'Environmental Commitment', body: 'We minimise our environmental footprint by promoting responsible land-use practices, reducing post-harvest losses through improved processing and storage, and optimising logistics to lower carbon emissions. We work exclusively with farmers and suppliers who adopt sustainable agronomic practices, including appropriate use of inputs, soil conservation, and water management. We actively monitor and seek to reduce greenhouse gas emissions across our supply chain, with a target of full Scope 1 and 2 mapping by 2026.' },
      { heading: 'Social Responsibility', body: 'Our business creates direct and indirect livelihoods for thousands of smallholder farmers, processors, and logistics providers across Nigeria. We pay fair prices, provide technical knowledge transfer, and ensure timely payments to all our suppliers. We invest in community development programmes in our source communities, including access to clean water, road infrastructure support, and educational sponsorships. We maintain a zero-tolerance policy for child labour, forced labour, and any form of exploitation throughout our value chain.' },
      { heading: 'Governance & Ethics', body: "Vertoc Agro operates with the highest standards of corporate governance. We maintain transparent financial reporting, uphold Anti-Bribery and Anti-Corruption (ABAC) standards aligned with the UK Bribery Act and Nigeria's EFCC/ICPC frameworks, and enforce a strict conflict-of-interest policy for all directors and employees. Our Board of Directors reviews ESG performance annually. We publish our ESG disclosures to relevant stakeholders and continuously improve our practices based on internationally recognised frameworks including GRI and UN SDGs." },
      { heading: 'Targets & Accountability', body: 'We set measurable ESG targets reviewed annually. Our key commitments include: achieving a fully documented and auditable supply chain by 2027; reducing food and commodity waste by 30% through improved storage and grading; ensuring 100% of our direct-sourcing contracts include a sustainability rider; and maintaining ISO 14001-aligned environmental management practices at our facilities.' },
    ],
  },
  {
    key: 'dei', label: 'DEI Policy', icon: 'Users', color: 'chart-2',
    title: 'Diversity, Equity & Inclusion Policy', tagline: 'Every voice matters. Every person belongs.',
    intro: 'Vertoc Agro Products Limited is dedicated to building a workplace and supply chain where diversity is celebrated, equity is practised, and inclusion is guaranteed. We recognise that diverse perspectives drive better decisions and stronger outcomes.',
    sections: [
      { heading: 'Our Commitment to Diversity', body: "We actively recruit from diverse talent pools across Nigeria and the global diaspora, without discrimination based on gender, age, ethnicity, religion, disability, sexual orientation, national origin, or socioeconomic background. We are committed to gender balance in our workforce and actively work to increase women's representation at all levels of the organisation, including leadership. By 2027, we target a minimum 40% female representation across all job grades." },
      { heading: 'Equity in Practice', body: 'Equity means ensuring fair access to opportunities, resources, and recognition. Vertoc Agro conducts annual equal-pay audits to identify and address any unjustified pay disparities. Promotion and performance review processes are standardised and transparent, with clear criteria accessible to all employees. We provide targeted support — including mentoring, training bursaries, and flexible working arrangements — to ensure that historically underrepresented groups can thrive and advance.' },
      { heading: 'Inclusive Culture', body: 'We foster a culture where all employees feel safe, respected, and empowered to contribute. Our Inclusion Charter commits every team leader to: conducting anonymous quarterly feedback surveys; acting on reported concerns within 10 working days; and completing mandatory unconscious-bias and inclusive-leadership training annually. We have zero tolerance for harassment, bullying, or discrimination in any form. Reports can be made confidentially via our independent Ethics Hotline.' },
      { heading: 'DEI in Our Supply Chain', body: 'Our DEI commitment extends beyond our own walls. We prioritise partnerships with women-owned, youth-led, and smallholder-farmer cooperatives. We embed DEI clauses in our supplier contracts and conduct periodic supplier assessments to verify compliance. We target 30% of our sourcing spend directed to women-led agricultural businesses by 2026.' },
    ],
  },
  {
    key: 'human-rights', label: 'Human Rights Policy', icon: 'HeartHandshake', color: 'chart-5',
    title: 'Human Rights Policy', tagline: 'Upholding dignity, rights and fair treatment for all.',
    intro: 'Vertoc Agro Products Limited respects and supports the protection of internationally recognised human rights as set out in the UN Guiding Principles on Business and Human Rights (UNGPs), the ILO Core Conventions, and the Universal Declaration of Human Rights.',
    sections: [
      { heading: 'Our Human Rights Commitments', body: 'We are committed to: (1) Prohibiting all forms of forced, bonded, trafficked, or compulsory labour in our operations and supply chain. (2) Prohibiting child labour — we do not employ persons under 18 years in any capacity and require the same of all suppliers. (3) Ensuring all workers receive at least the applicable minimum wage and have their labour rights respected, including the right to freedom of association and collective bargaining. (4) Providing safe, healthy, and dignified working conditions at all our facilities.' },
      { heading: 'Supply Chain Due Diligence', body: 'We conduct Human Rights Due Diligence (HRDD) across our supply chain. This includes risk-based assessments of all new and existing suppliers against ILO conventions and Nigerian labour law. Where risks are identified, we work with suppliers through capacity building and corrective action plans rather than immediate termination, unless the violation is severe. Suppliers who refuse to engage with our HRDD process or who commit grievous violations will be delisted.' },
      { heading: 'Land Rights & Communities', body: 'We respect the land rights of communities in our sourcing regions and do not engage with suppliers who have obtained land through forcible displacement, coercion, or without Free, Prior and Informed Consent (FPIC) from affected communities. We actively engage with host communities through structured community liaison programmes and provide accessible grievance mechanisms for community members who believe their rights have been affected by our activities.' },
      { heading: 'Grievance Mechanism & Remedy', body: "Any worker, supplier, community member, or stakeholder who believes their human rights have been violated in connection with Vertoc Agro's operations may submit a complaint through our confidential Ethics Hotline or in writing to our Compliance Officer. All complaints are investigated promptly and impartially, with a target of acknowledging receipt within 5 working days and providing a resolution or update within 30 working days. Where violations are confirmed, we provide appropriate remedy." },
    ],
  },
  {
    key: 'ims', label: 'IMS Policy', icon: 'ShieldCheck', color: 'info',
    title: 'Integrated Management System (IMS) Policy', tagline: 'Quality, safety and environment — managed as one.',
    intro: 'Vertoc Agro Products Limited operates an Integrated Management System (IMS) that combines Quality Management (ISO 9001), Food Safety Management (ISO 22000 / HACCP), and Environmental Management (ISO 14001) into a unified, auditable framework.',
    sections: [
      { heading: 'Quality Management', body: 'We are committed to consistently delivering agricultural commodities that meet or exceed customer specifications and applicable regulatory requirements. Our quality management processes cover procurement, processing, grading, storage, and export — with documented Standard Operating Procedures (SOPs) at every stage. We conduct regular internal audits and management reviews, and we set annual quality objectives. Customer feedback is systematically collected, analysed, and used to drive continuous improvement. Our target is to achieve and maintain a customer complaint rate of less than 1% of all transactions.' },
      { heading: 'Food Safety', body: 'All agricultural commodities handled by Vertoc Agro are subject to rigorous food safety controls based on Hazard Analysis and Critical Control Points (HACCP) principles. We identify, evaluate, and control food safety hazards including biological, chemical, and physical contaminants. Our facilities are maintained under strict hygiene and sanitation protocols. All relevant products carry required certifications including NAFDAC registration, SGS verification, and phytosanitary certification. We conduct pre-shipment inspections on all export consignments.' },
      { heading: 'Environmental Management', body: 'Our IMS includes environmental management commitments aligned with ISO 14001. We identify environmental aspects and impacts associated with our operations and set controls to minimise negative effects. This includes responsible waste management (packaging, food waste, and processing by-products), energy efficiency at our facilities, and ensuring our water use does not adversely impact local water bodies. Environmental performance is reviewed quarterly by our Operations Management Team.' },
      { heading: 'Continual Improvement & Compliance', body: 'We are committed to the continual improvement of our IMS through regular internal and external audits, corrective and preventive actions, and management reviews. We comply with all applicable Nigerian laws, export destination regulations, and international standards. All employees receive IMS training relevant to their role upon onboarding and annually thereafter. The IMS Policy is reviewed at least annually or following significant organisational changes by the Managing Director.' },
    ],
  },
  {
    key: 'eudr', label: 'EUDR Compliance', icon: 'Earth', color: 'chart-4',
    title: 'EU Deforestation Regulation (EUDR) Compliance', tagline: 'Deforestation-free supply chains — by regulation and by conviction.',
    intro: 'Vertoc Agro Products Limited fully supports the objectives of the EU Deforestation Regulation (EU) 2023/1115 (EUDR), which requires that commodities and products placed on the EU market must not have contributed to deforestation or forest degradation after December 31, 2020.',
    sections: [
      { heading: 'Scope of Our EUDR Obligations', body: 'The EUDR applies to several commodities in our portfolio that are exported to EU markets, including palm oil, cocoa, soybeans, and their derived products. As an operator placing these commodities on the EU market (directly or via intermediaries), Vertoc Agro accepts full responsibility for conducting due diligence to ensure these products are: (1) produced on land not subject to deforestation after 31 December 2020; (2) produced in compliance with the relevant legislation of the country of production; and (3) covered by a due diligence statement submitted to the EU Information System.' },
      { heading: 'Geolocation & Traceability', body: "We have invested in geolocation systems and supply chain traceability tools to map the exact plots of land from which our commodities originate. All supplying farmers and cooperatives are required to provide GPS coordinates of their farms, which are verified against satellite deforestation data using third-party databases including Global Forest Watch and the EU's own reference system. We are progressively onboarding all our supplier base into our traceability platform, with a target of 100% coverage for EU-destined commodities by end of 2025." },
      { heading: 'Due Diligence System', body: "Our EUDR Due Diligence System (DDS) includes three mandatory steps for every EU-destined consignment: (1) Information Collection — gathering evidence of origin, land-use status, legal compliance, and geolocation data from all relevant suppliers. (2) Risk Assessment — evaluating the risk of non-compliance using country and product-level risk benchmarks, including the EU's country benchmarking classification and independent audits. (3) Risk Mitigation — where standard or high risk is identified, additional supplier audits, third-party verification, and corrective actions are implemented before shipment is approved." },
      { heading: 'Legal Compliance & Certification', body: 'We require all suppliers of EUDR-relevant commodities to confirm compliance with Nigerian land and forest law, including the Forestry Law, Land Use Act, and NESREA regulations. We work with certification schemes — including RSPO for palm oil and Rainforest Alliance for cocoa — to strengthen our compliance evidence base. EUDR-specific declarations and supporting documentation are archived for a minimum of five years and are available for inspection by EU customs authorities or appointed competent authorities upon request.' },
    ],
  },
]
export const getSustainability = () => readItems('sustainability', DEFAULT_SUSTAINABILITY)
export async function setSustainability(list) {
  if (!Array.isArray(list)) throw new Error('policies must be a list')
  const slug = s => tt(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const items = list.slice(0, 12).map(p => ({
    key: slug(p?.key) || slug(p?.label) || 'policy', label: tt(p?.label, 40), icon: STAT_ICON_NAMES.includes(p?.icon) ? p.icon : 'Leaf',
    color: POLICY_COLORS.includes(p?.color) ? p.color : 'accent', title: tt(p?.title, 120), tagline: tt(p?.tagline, 160), intro: tt(p?.intro, 1000),
    sections: (Array.isArray(p?.sections) ? p.sections : []).slice(0, 8).map(s => ({ heading: tt(s?.heading, 80), body: tt(s?.body, 2000) })).filter(s => s.heading && s.body),
  })).filter(p => p.label && p.title)
  if (!items.length) throw new Error('keep at least one policy')
  const seen = new Set(); for (const p of items) { let k = p.key, n = 2; while (seen.has(k)) k = `${p.key}-${n++}`; p.key = k; seen.add(k) }
  return writeItems('sustainability', items)
}

/* ------------------------------------------------------ company profile --- */
// The About page (mission, vision, registrations, core values, industries)
// and the homepage's mission/vision cards. Settings row 'about'.
export const DEFAULT_ABOUT = {
  headline: 'Connecting Farmers with Global Markets',
  summary: 'Vertoc Agro Products Limited is a leading Nigerian agribusiness committed to the cultivation of crops, sourcing, processing, storage, logistics, and export of premium agricultural commodities across Nigeria and beyond.',
  slogan: 'Growing the Future, One Harvest at a Time.',
  mission: "To provide quality agricultural products while creating sustainable value for farmers, businesses, and global markets. We bridge the gap between farm and table with efficiency and excellence.",
  vision: "To become one of Africa's most trusted agro commodity companies, recognized for reliability, quality, and innovation in agricultural trade and export across international markets.",
  mission_short: 'Provide quality products while creating sustainable value for farmers and global markets.',
  vision_short: "Become Africa's most trusted agro commodity company recognized for reliability.",
  registrations: [
    { icon: 'Award', label: 'CAC Registered', value: 'RC No: 8464264' },
    { icon: 'Shield', label: 'NEPC Licensed', value: 'No: 0044255' },
  ],
  values: [
    { icon: 'Award', title: 'Excellence', description: 'We strive for the highest standards in every aspect of our operations.' },
    { icon: 'Shield', title: 'Integrity', description: 'Honest and transparent dealings with all our stakeholders.' },
    { icon: 'Users', title: 'Partnership', description: 'Building lasting relationships with farmers, buyers, and communities.' },
    { icon: 'HeartHandshake', title: 'Sustainability', description: 'Environmentally responsible practices for future generations.' },
  ],
  industries: [
    { icon: 'UtensilsCrossed', name: 'Food Manufacturers', description: 'Supplying raw materials for food processing and packaged goods production.' },
    { icon: 'Plane', name: 'Exporters', description: 'Partnering with export houses to fulfill international commodity contracts.' },
    { icon: 'ShoppingBag', name: 'FMCG Companies', description: 'Reliable bulk supply for fast-moving consumer goods manufacturers.' },
    { icon: 'Beef', name: 'Animal Feed Producers', description: 'Maize, soybeans, and cassava for livestock and poultry feed mills.' },
    { icon: 'Store', name: 'Wholesalers', description: 'Large-volume commodity supply for regional and national distributors.' },
    { icon: 'Building2', name: 'Retail Chains', description: 'Consistent quality and supply for supermarket and retail procurement.' },
    { icon: 'Factory', name: 'Industrial Buyers', description: 'Raw materials for biofuel, starch, oil extraction, and pharmaceutical industries.' },
  ],
}
const iconOr = (v, fallback) => (STAT_ICON_NAMES.includes(v) ? v : fallback)
export async function getCompanyProfile() {
  const rows = unwrap(await supabase.from('settings').select('value').eq('key', 'about').limit(1), 'getCompanyProfile')
  const v = rows?.[0]?.value
  return v && typeof v === 'object' && v.mission ? { ...structuredClone(DEFAULT_ABOUT), ...v } : structuredClone(DEFAULT_ABOUT)
}
export async function setCompanyProfile(input = {}) {
  const t = (s, max) => String(s ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, max)
  const mission = t(input.mission, 600), vision = t(input.vision, 600)
  if (!mission || !vision) throw new Error('mission and vision are required')
  const registrations = (Array.isArray(input.registrations) ? input.registrations : []).slice(0, 8)
    .map(r => ({ icon: iconOr(r?.icon, 'Award'), label: t(r?.label, 60), value: t(r?.value, 80) })).filter(r => r.label)
  const values = (Array.isArray(input.values) ? input.values : []).slice(0, 8)
    .map(x => ({ icon: iconOr(x?.icon, 'Award'), title: t(x?.title, 40), description: t(x?.description, 200) })).filter(x => x.title)
  const industries = (Array.isArray(input.industries) ? input.industries : []).slice(0, 12)
    .map(x => ({ icon: iconOr(x?.icon, 'Factory'), name: t(x?.name, 60), description: t(x?.description, 200) })).filter(x => x.name)
  const value = { headline: t(input.headline, 80), summary: t(input.summary, 600), slogan: t(input.slogan, 120), mission, vision, mission_short: t(input.mission_short, 200), vision_short: t(input.vision_short, 200), registrations, values, industries }
  unwrap(await supabase.from('settings').upsert({ key: 'about', value }, { onConflict: 'key' }), 'setCompanyProfile')
  return value
}

/* ---------------------------------------------- homepage markets + reviews --- */
// "Our Export Markets" flag tiles and "What Our Clients Say" cards, edited under
// Settings → Site. Same settings-row pattern as the stat tiles.
export const DEFAULT_MARKETS = {
  items: [
    { name: 'United Kingdom', code: 'gb' }, { name: 'Netherlands', code: 'nl' }, { name: 'Germany', code: 'de' }, { name: 'Turkey', code: 'tr' },
    { name: 'UAE', code: 'ae' }, { name: 'India', code: 'in' }, { name: 'China', code: 'cn' }, { name: 'USA', code: 'us' },
  ],
  caption_left: 'FOB Lagos', caption_right: '12+ Countries Served',
}
export const DEFAULT_REVIEWS = [
  { quote: 'Vertoc Agro has been our most reliable maize supplier for over two years. Their quality consistency is unmatched.', name: 'Sanjay', role: 'Procurement Manager of an Indian Based Food Processing company', rating: 5 },
  { quote: 'Working with Vertoc has been seamless. Their export documentation is always in order and shipments arrive on time.', name: 'Mitchell', role: 'Director of an International Grain company in the UK', rating: 5 },
  { quote: 'We switched to Vertoc for our palm oil supply and have never looked back. Competitive pricing and premium quality.', name: 'Johnson', role: 'CEO of a Food Processing Company in Nigeria', rating: 5 },
]
const tidy = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
export async function getHomepageMarkets() {
  const rows = unwrap(await supabase.from('settings').select('value').eq('key', 'homepage_markets').limit(1), 'getHomepageMarkets')
  const v = rows?.[0]?.value
  return Array.isArray(v?.items) && v.items.length ? { items: v.items, caption_left: v.caption_left ?? '', caption_right: v.caption_right ?? '' } : structuredClone(DEFAULT_MARKETS)
}
export async function setHomepageMarkets({ markets, caption_left, caption_right } = {}) {
  if (!Array.isArray(markets)) throw new Error('markets must be a list')
  const items = []
  for (const m of markets.slice(0, 24)) {
    const name = tidy(m?.name, 40), code = String(m?.code || '').trim().toLowerCase()
    if (!name || !/^[a-z]{2}$/.test(code)) continue
    items.push({ name, code })
  }
  if (!items.length) throw new Error('keep at least one market, each with a two-letter country code')
  const value = { items, caption_left: tidy(caption_left, 60), caption_right: tidy(caption_right, 60) }
  unwrap(await supabase.from('settings').upsert({ key: 'homepage_markets', value }, { onConflict: 'key' }), 'setHomepageMarkets')
  return value
}
/* ------------------------------------------------------------- reviews --- */
// Table `reviews` (migration 009): clients submit from the site (pending),
// staff approve/hide/add in the panel; only approved ones reach the homepage.
// Until the migration runs, the homepage shows DEFAULT_REVIEWS and the panel
// gets a clear hint instead of a 500.
export const REVIEW_STATUSES = ['pending', 'approved', 'hidden']
export const REVIEWS_MIGRATION_HINT = 'Reviews need the database migration 009: run server/migrations/009_reviews.sql in the Supabase SQL editor first.'
const missingReviews = e => e?.code === '42P01' || /relation "public\.?reviews" does not exist|reviews.*does not exist|schema cache/i.test(String(e?.message || ''))
const reviewErr = (e, ctx) => (missingReviews(e) ? Object.assign(new Error(REVIEWS_MIGRATION_HINT), { expose: true, status: 409 }) : new Error(`${ctx}: ${e.message}`))
const cleanQuote = s => tidy(s, 400).replace(/^[“"']+|[”"']+$/g, '')
const cleanRating = v => Math.min(5, Math.max(1, Math.round(Number(v)) || 5))
export async function listReviews({ status = 'all', limit = 200 } = {}) {
  let q = supabase.from('reviews').select('*').order('position').order('created_at', { ascending: false }).limit(limit)
  if (REVIEW_STATUSES.includes(status)) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw reviewErr(error, 'listReviews')
  return data ?? []
}
export async function listApprovedReviews({ limit = 6 } = {}) {
  const { data, error } = await supabase.from('reviews').select('id,quote,name,role,rating').eq('status', 'approved').order('position').order('created_at', { ascending: false }).limit(Math.min(Math.max(Number(limit) || 6, 1), 200))
  if (error) { if (missingReviews(error)) return structuredClone(DEFAULT_REVIEWS); throw new Error(`listApprovedReviews: ${error.message}`) }
  return data ?? []
}
export async function getReview(id) {
  const { data, error } = await supabase.from('reviews').select('*').eq('id', Number(id)).limit(1)
  if (error) throw reviewErr(error, 'getReview')
  return data?.[0] ?? null
}
export async function createReview(input, { status = 'approved', source = 'admin' } = {}) {
  const quote = cleanQuote(input?.quote), name = tidy(input?.name, 60)
  if (quote.length < 10) throw new Error('please write at least a sentence')
  if (!name) throw new Error('name is required')
  const st = REVIEW_STATUSES.includes(status) ? status : 'pending'
  const row = { quote, name, role: tidy(input?.role, 120), email: tidy(input?.email, 200).toLowerCase(), rating: cleanRating(input?.rating), status: st, source: source === 'website' ? 'website' : 'admin', approved_at: st === 'approved' ? new Date().toISOString() : null }
  const { data, error } = await supabase.from('reviews').insert(row).select().single()
  if (error) throw reviewErr(error, 'createReview')
  return data
}
export async function updateReview(id, patch) {
  const existing = await getReview(id)
  if (!existing) throw new Error(`no review with id ${id}`)
  const row = {}
  if (patch.quote !== undefined) { row.quote = cleanQuote(patch.quote); if (row.quote.length < 10) throw new Error('please write at least a sentence') }
  if (patch.name !== undefined) { row.name = tidy(patch.name, 60); if (!row.name) throw new Error('name is required') }
  if (patch.role !== undefined) row.role = tidy(patch.role, 120)
  if (patch.rating !== undefined) row.rating = cleanRating(patch.rating)
  if (patch.position !== undefined) row.position = Math.round(Number(patch.position)) || 0
  if (patch.status !== undefined && patch.status !== existing.status) {
    if (!REVIEW_STATUSES.includes(patch.status)) throw new Error(`status must be one of: ${REVIEW_STATUSES.join(', ')}`)
    row.status = patch.status
    if (patch.status === 'approved' && !existing.approved_at) row.approved_at = new Date().toISOString()
  }
  if (!Object.keys(row).length) return existing
  const { data, error } = await supabase.from('reviews').update(row).eq('id', existing.id).select().single()
  if (error) throw reviewErr(error, 'updateReview')
  return data
}
export async function deleteReview(id) {
  const r = await getReview(id)
  if (!r) throw new Error(`no review with id ${id}`)
  const { error } = await supabase.from('reviews').delete().eq('id', r.id)
  if (error) throw reviewErr(error, 'deleteReview')
  return { deleted: true, id: r.id }
}

/* --------------------------------------------------------- departments --- */
// Sender identities ("departments"): each is a From address with a display
// name, an optional reply-to and an optional signature. Stored in the
// settings table under 'departments' (outside the settings groups). The
// email settings' From is always available as the default sender.
const DEPT_RE = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/
const parseFrom = s => { const m = String(s || '').match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/); return m ? { name: (m[1] || '').trim(), email: m[2].trim() } : { name: '', email: String(s || '').trim() } }
export async function listDepartments() {
  const [settings, rows] = await Promise.all([getSettings(), supabase.from('settings').select('value').eq('key', 'departments').limit(1).then(r => unwrap(r, 'listDepartments') ?? [])])
  const base = parseFrom(settings.email.from)
  const def = { id: 'default', name: base.name || settings.company.name || 'Vertoc Agro', email: base.email, reply_to: settings.email.reply_to || '', signature: '', is_default: true }
  const items = (rows?.[0]?.value?.items || []).filter(d => d && d.id !== 'default').map(d => ({ ...d, is_default: false }))
  return [def, ...items]
}
export async function setDepartments(list) {
  if (!Array.isArray(list)) throw new Error('departments must be a list')
  const items = [], seen = new Set()
  for (const d of list.slice(0, 20)) {
    const name = String(d?.name || '').replace(/\s+/g, ' ').trim().slice(0, 60), email = String(d?.email || '').trim().toLowerCase()
    if (!name || !DEPT_RE.test(email) || seen.has(email)) continue
    seen.add(email)
    const reply_to = String(d?.reply_to || '').trim().toLowerCase(); if (reply_to && !DEPT_RE.test(reply_to)) throw new Error(`reply-to for ${name} is not a valid address`)
    items.push({ id: String(d?.id || '').match(/^[a-z0-9_-]{4,40}$/i) ? d.id : `d_${randomBytes(4).toString('hex')}`, name, email, reply_to, signature: String(d?.signature || '').trim().slice(0, 2000) })
  }
  unwrap(await supabase.from('settings').upsert({ key: 'departments', value: { items } }, { onConflict: 'key' }), 'setDepartments')
  return listDepartments()
}
/** The From line, reply-to and signature to send with, for a department id (or the default). */
export async function resolveSender(fromId, settings) {
  const s = settings || (await getSettings())
  const list = await listDepartments()
  const d = (fromId && list.find(x => x.id === fromId)) || list[0]
  return { id: d.id, name: d.name, from: `${d.name} <${d.email}>`, reply_to: d.reply_to || s.email.reply_to, signature: d.signature || s.email.signature }
}

/* ------------------------------------------------------- conversations --- */
// A conversation is every email with one client (or, for senders without a
// client record, one address). Quoted history at the bottom of a reply is
// split off so the panel can show just what was new.
const QUOTE_MARKERS = [
  /\n\s*On [^\n]{0,200}(?:\n[^\n]{0,200})?\bwrote:\s*\n/,   // Gmail, Apple Mail, Outlook mobile (may wrap)
  /\n\s*-{2,}\s*Original Message\s*-{2,}\s*\n/i,           // Outlook
  /\n\s*_{5,}\s*\n\s*From:\s/i,                            // Outlook (underscore rule)
  /\n\s*From:\s[^\n]+\n\s*(?:Sent|Date):\s/i,              // forwarded header block
  /\n\s*Le [^\n]{0,200}a écrit\s*:\s*\n/,                   // French clients
  /\n>(?:[^\n]*\n>)*[^\n]*$/,                                // trailing block of "> " lines
]
export function splitQuoted(text) {
  const t = String(text || '').replace(/\r\n/g, '\n').trim()
  const s = '\n' + t
  let cut = -1
  for (const re of QUOTE_MARKERS) { const m = re.exec(s); if (m && (cut < 0 || m.index < cut)) cut = m.index }
  if (cut < 0) return { text: t, quoted: '' }
  const visible = s.slice(1, cut).trim(), quoted = s.slice(cut).trim()
  return visible ? { text: visible, quoted } : { text: t, quoted: '' }
}
const counterpart = m => String((m.direction === 'in' ? m.from_email : m.to_email) || '').toLowerCase()
// Mail to the team itself (notifications, staff invites) is not part of a client conversation: new rows
// carry headers.internal, older ones are recognised by their recipient being one of our own addresses.
async function teamAddresses() {
  const [settings, staff] = await Promise.all([getSettings(), supabase.from('profiles').select('email').then(r => r.data || [])])
  const e = settings.email || {}
  const norm = s => (String(s || '').match(/<([^>]+)>/)?.[1] || String(s || '')).trim().toLowerCase()
  return { notify: new Set([e.from, e.reply_to, e.notify_to, e.inbound_address].map(norm).filter(Boolean)), staff: new Set(staff.map(p => norm(p.email)).filter(Boolean)) }
}
// Notifications go to the team's own addresses; staff invitations go to a staff address with no
// client record attached. Mail to a client record is a conversation even if that client happens to
// use a staff address (test clients do).
const isInternal = (m, team) => {
  if (m.headers?.internal === true) return true
  if (m.direction !== 'out') return false
  const to = String(m.to_email || '').toLowerCase()
  return team.notify.has(to) || (m.client_id == null && team.staff.has(to))
}

// A thread is one subject with one counterpart (client record, or bare address): "Re:" / "Fwd:"
// prefixes are ignored, so a reply stays in its thread and a new subject starts a new one.
const RE_PREFIX = /^\s*((re|fwd?|fw|aw|sv|tr|wg)\s*:\s*)+/i
export const cleanSubject = s => String(s || '').replace(RE_PREFIX, '').replace(/\s+/g, ' ').trim()
const normSubject = s => cleanSubject(s).toLowerCase() || '(no subject)'
const counterpartKey = m => (m.client_id != null ? `c${m.client_id}` : `e:${counterpart(m)}`)
export const threadKeyOf = m => `${counterpartKey(m)}|${normSubject(m.subject)}`
export function parseThreadKey(key) {
  const k = String(key || ''); const i = k.indexOf('|'); if (i < 0) return null
  const who = k.slice(0, i), subject = k.slice(i + 1)
  if (/^c\d+$/.test(who)) return { client_id: Number(who.slice(1)), email: null, subject }
  if (who.startsWith('e:') && who.length > 2) return { client_id: null, email: who.slice(2).toLowerCase().replace(/[%,()]/g, ''), subject }
  return null
}
const forCounterpart = (qry, k) => (k.client_id != null ? qry.eq('client_id', k.client_id) : qry.is('client_id', null).or(`from_email.ilike.${k.email},to_email.ilike.${k.email}`))

/* ------------------------------------------------------------- labels --- */
// Thread labels live in the settings table under 'thread_labels' (not a settings group, so they
// never reach GET /settings): { catalogue: [{ name, color }], threads: { [threadKey]: { label, at, by } } }.
export const LABEL_COLORS = ['green', 'amber', 'red', 'blue', 'purple', 'teal', 'pink', 'slate']
export const DEFAULT_LABELS = [
  { name: 'Waiting for client response', color: 'amber' },
  { name: 'Deal pending approval', color: 'blue' },
  { name: 'Deal closed', color: 'green' },
  { name: 'Follow up needed', color: 'red' },
  { name: 'On hold', color: 'slate' },
]
const cleanLabelName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40)
async function readLabelsRow() {
  const rows = unwrap(await supabase.from('settings').select('value').eq('key', 'thread_labels').limit(1), 'readLabels')
  const v = rows?.[0]?.value
  return { catalogue: Array.isArray(v?.catalogue) && v.catalogue.length ? v.catalogue : structuredClone(DEFAULT_LABELS), threads: v?.threads && typeof v.threads === 'object' ? v.threads : {} }
}
const writeLabelsRow = async v => unwrap(await supabase.from('settings').upsert({ key: 'thread_labels', value: v }, { onConflict: 'key' }), 'writeLabels')
export async function getLabelCatalogue() { return (await readLabelsRow()).catalogue }
export async function setLabelCatalogue(list) {
  if (!Array.isArray(list)) throw new Error('labels must be a list')
  const seen = new Set(), catalogue = []
  for (const l of list.slice(0, 30)) {
    const name = cleanLabelName(l?.name); if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase()); catalogue.push({ name, color: LABEL_COLORS.includes(l?.color) ? l.color : 'slate' })
  }
  if (!catalogue.length) throw new Error('keep at least one label')
  const row = await readLabelsRow()
  const keep = new Set(catalogue.map(c => c.name.toLowerCase()))   // threads whose label was removed lose it
  const threads = Object.fromEntries(Object.entries(row.threads).filter(([, t]) => keep.has(String(t.label).toLowerCase())))
  await writeLabelsRow({ catalogue, threads })
  return catalogue
}
/** Set (or, with an empty label, clear) the label on one thread. A new name joins the catalogue, with `color` when given. */
export async function setThreadLabel(key, label, actor = null, color = null) {
  if (!parseThreadKey(key)) throw new Error('unknown thread')
  const row = await readLabelsRow()
  const name = cleanLabelName(label)
  if (!name) { delete row.threads[key]; await writeLabelsRow(row); return null }
  const tone = LABEL_COLORS.includes(color) ? color : null
  let entry = row.catalogue.find(c => c.name.toLowerCase() === name.toLowerCase())
  if (!entry) { if (row.catalogue.length >= 30) throw new Error('too many labels; remove one first'); entry = { name, color: tone || 'slate' }; row.catalogue.push(entry) }
  else if (tone) entry.color = tone
  row.threads[key] = { label: entry.name, at: new Date().toISOString(), by: actor?.email || actor?.label || null }
  await writeLabelsRow(row)
  return { ...entry, at: row.threads[key].at }
}

export async function listThreads({ q = '', unread = false, label = '', client_id = null, limit = 1000 } = {}) {
  let qry = supabase.from('messages').select('id,client_id,direction,status,from_email,from_name,to_email,to_name,subject,body,created_at,read_at,attachments,headers').order('created_at', { ascending: false }).limit(limit)
  if (client_id != null) qry = qry.eq('client_id', Number(client_id))
  const [rows, team] = await Promise.all([qry.then(r => unwrap(r, 'listThreads') ?? []), teamAddresses()])
  const map = new Map()
  for (const m of rows) {
    if (isInternal(m, team)) continue
    const key = threadKeyOf(m); let t = map.get(key)
    if (!t) { t = { key, client_id: m.client_id ?? null, email: counterpart(m), name: '', subject: cleanSubject(m.subject) || '(no subject)', last: null, unread: 0, count: 0, updated_at: m.created_at }; map.set(key, t) }
    t.count++
    if (m.direction === 'in' && !m.read_at) t.unread++
    if (!t.last) { const { text } = splitQuoted(m.body); t.last = { id: m.id, direction: m.direction, snippet: text.replace(/\s+/g, ' ').slice(0, 140), created_at: m.created_at, status: m.status, attachments: m.attachments?.length || 0 } }
    if (!t.name) t.name = (m.direction === 'in' ? m.from_name : m.to_name) || ''
  }
  const ids = [...new Set([...map.values()].map(t => t.client_id).filter(v => v != null))]
  if (ids.length) {
    const clients = unwrap(await supabase.from('clients').select('id,name,data').in('id', ids), 'listThreads:clients') ?? []
    for (const t of map.values()) { const c = clients.find(x => x.id === t.client_id); if (c) { t.name = c.name; t.email = t.email || String(c.data?.email || '').toLowerCase() } }
  }
  const labels = await readLabelsRow()
  let list = [...map.values()]
  for (const t of list) {
    t.awaiting_reply = t.last?.direction === 'out'   // we spoke last: the ball is in their court
    const l = labels.threads[t.key]
    t.label = l ? { name: l.label, color: labels.catalogue.find(c => c.name === l.label)?.color || 'slate', at: l.at } : null
  }
  const term = String(q || '').trim().toLowerCase()
  if (term) list = list.filter(t => [t.name, t.email, t.subject, t.last?.snippet, t.label?.name].some(v => String(v || '').toLowerCase().includes(term)))
  if (unread) list = list.filter(t => t.unread > 0)
  const want = String(label || '').trim().toLowerCase()
  if (want === '__awaiting') list = list.filter(t => t.awaiting_reply)
  else if (want) list = list.filter(t => t.label?.name.toLowerCase() === want)
  return list
}
export async function getThread(key, { limit = 500 } = {}) {
  const k = parseThreadKey(key); if (!k) return null
  const qry = forCounterpart(supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(limit), k)
  const [rows, team] = await Promise.all([qry.then(r => unwrap(r, 'getThread') ?? []), teamAddresses()])
  return rows.filter(m => !isInternal(m, team) && normSubject(m.subject) === k.subject)
    .map(m => { const { text, quoted } = splitQuoted(m.body); return { ...m, html: undefined, text, quoted } })
}
export async function markThreadRead(key) {
  const k = parseThreadKey(key); if (!k) return 0
  const qry = forCounterpart(supabase.from('messages').select('id,subject').eq('direction', 'in').is('read_at', null), k)
  const ids = (unwrap(await qry, 'markThreadRead') ?? []).filter(m => normSubject(m.subject) === k.subject).map(m => m.id)
  if (!ids.length) return 0
  unwrap(await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', ids), 'markThreadRead:update')
  return ids.length
}

export async function getQuoteByNumber(number) {
  return (unwrap(await supabase.from('quotes').select('*').eq('number', String(number)).limit(1), 'getQuoteByNumber'))?.[0] ?? null
}

/* ---------------------------------------------------- email templates --- */

const TEMPLATE_PATCHABLE = ['name', 'description', 'subject', 'body', 'cta_label', 'enabled']
export async function listTemplates() {
  return unwrap(await supabase.from('email_templates').select('*').order('key'), 'listTemplates') ?? []
}
export async function getTemplate(key) {
  return (unwrap(await supabase.from('email_templates').select('*').eq('key', String(key)).limit(1), 'getTemplate'))?.[0] ?? null
}
export async function upsertTemplate(row) {
  return unwrap(await supabase.from('email_templates').upsert(row, { onConflict: 'key' }).select().single(), 'upsertTemplate')
}
export async function updateTemplate(key, patch) {
  const row = {}
  for (const k of TEMPLATE_PATCHABLE) if (patch[k] !== undefined) row[k] = k === 'enabled' ? Boolean(patch[k]) : str(patch[k], k === 'body' ? 20000 : 300)
  if (row.name === '') throw new Error('name cannot be empty')
  if (!Object.keys(row).length) return getTemplate(key)
  return unwrap(await supabase.from('email_templates').update(row).eq('key', String(key)).select().single(), 'updateTemplate')
}

/* ---------------------------------------------------------- purchases --- */

export const PURCHASE_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']

export async function listPurchases({ client_id, status = 'all', limit = 500 } = {}) {
  let q = supabase.from('purchases').select('*').order('purchased_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
  if (client_id != null) q = q.eq('client_id', Number(client_id))
  if (status !== 'all') q = q.eq('status', status)
  return unwrap(await q, 'listPurchases') ?? []
}
export async function getPurchase(id) {
  return (unwrap(await supabase.from('purchases').select('*').eq('id', Number(id)).limit(1), 'getPurchase'))?.[0] ?? null
}
export async function createPurchase(input, actorId = null) {
  const description = str(input?.description, 500)
  if (!description) throw new Error('description is required')
  const client_id = idOrNull(input?.client_id)
  if (client_id != null && !(await getClient(client_id))) throw new Error(`no client with id ${client_id}`)
  const quote_id = idOrNull(input?.quote_id)
  if (quote_id != null && !(await getQuote(quote_id))) throw new Error(`no quote with id ${quote_id}`)
  const status = input?.status ?? 'pending'
  if (!PURCHASE_STATUSES.includes(status)) throw new Error(`status must be one of: ${PURCHASE_STATUSES.join(', ')}`)
  const amount = money(input?.amount)
  if (amount < 0) throw new Error('amount cannot be negative')
  const row = {
    client_id, quote_id, description, reference: str(input?.reference, 120), currency: currencyCode(input?.currency),
    amount, status, items: Array.isArray(input?.items) ? input.items.slice(0, 100) : [], notes: str(input?.notes),
    purchased_at: input?.purchased_at ? dateOnly(input.purchased_at) : new Date().toISOString().slice(0, 10), created_by: actorId,
  }
  return unwrap(await supabase.from('purchases').insert(row).select().single(), 'createPurchase')
}
export async function updatePurchase(id, patch) {
  const existing = await getPurchase(id)
  if (!existing) throw new Error(`no purchase with id ${id}`)
  const row = {}
  if (patch.description !== undefined) { row.description = str(patch.description, 500); if (!row.description) throw new Error('description cannot be empty') }
  if (patch.reference !== undefined) row.reference = str(patch.reference, 120)
  if (patch.notes !== undefined) row.notes = str(patch.notes)
  if (patch.currency !== undefined) row.currency = currencyCode(patch.currency)
  if (patch.amount !== undefined) { row.amount = money(patch.amount); if (row.amount < 0) throw new Error('amount cannot be negative') }
  if (patch.status !== undefined) { if (!PURCHASE_STATUSES.includes(patch.status)) throw new Error(`status must be one of: ${PURCHASE_STATUSES.join(', ')}`); row.status = patch.status }
  if (patch.purchased_at !== undefined) row.purchased_at = dateOnly(patch.purchased_at)
  if (patch.client_id !== undefined) { const cid = idOrNull(patch.client_id); if (cid != null && !(await getClient(cid))) throw new Error(`no client with id ${cid}`); row.client_id = cid }
  if (!Object.keys(row).length) return existing
  return unwrap(await supabase.from('purchases').update(row).eq('id', existing.id).select().single(), 'updatePurchase')
}
export async function deletePurchase(id) {
  const p = await getPurchase(id)
  if (!p) throw new Error(`no purchase with id ${id}`)
  unwrap(await supabase.from('purchases').delete().eq('id', p.id), 'deletePurchase')
  return { deleted: true, id: p.id }
}

/** An accepted (or any sent) quote becomes an order, once. */
export async function convertQuoteToPurchase(id, actorId = null) {
  const q = await getQuote(id)
  if (!q) throw new Error(`no quote with id ${id}`)
  if (q.status === 'draft') throw new Error('send the quote before converting it to a purchase')
  const dup = unwrap(await supabase.from('purchases').select('id').eq('quote_id', q.id).limit(1), 'convertQuote:dup')
  if (dup?.length) throw new Error(`quote ${q.number} was already converted (purchase #${dup[0].id})`)
  return createPurchase({
    client_id: q.client_id, quote_id: q.id, reference: q.number,
    description: q.title || q.items.map(i => i.description).join(', ').slice(0, 500) || q.number,
    currency: q.currency, amount: q.total, items: q.items, status: 'pending',
  }, actorId)
}
