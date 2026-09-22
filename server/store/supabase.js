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
export const STAT_ICON_NAMES = ['Anchor', 'Award', 'BadgeCheck', 'Beef', 'Boxes', 'Building2', 'CalendarCheck', 'Coins', 'Container', 'Eye', 'Factory', 'Globe', 'Handshake', 'HeartHandshake', 'Landmark', 'Leaf', 'Lightbulb', 'MapPin', 'Package', 'Plane', 'Recycle', 'Scale', 'Shield', 'ShieldCheck', 'Ship', 'ShoppingBag', 'Sprout', 'Star', 'Store', 'Target', 'Tractor', 'TrendingUp', 'Truck', 'Users', 'UtensilsCrossed', 'Warehouse', 'Wheat']
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

/* ------------------------------------------------------ company profile --- */
// The About page (mission, vision, registrations, core values, industries)
// and the homepage's mission/vision cards. Settings row 'about'.
export const DEFAULT_ABOUT = {
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
  const value = { mission, vision, mission_short: t(input.mission_short, 200), vision_short: t(input.vision_short, 200), registrations, values, industries }
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
