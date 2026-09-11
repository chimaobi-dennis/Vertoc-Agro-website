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

export async function createQuote(input, actorId = null) {
  const settings = await getSettings()
  const fields = await listQuoteFields()
  const client_id = idOrNull(input?.client_id)
  const client = client_id != null ? await getClient(client_id) : null
  if (client_id != null && !client) throw new Error(`no client with id ${client_id}`)
  const items = normaliseItems(input?.items ?? [])
  const totals = quoteTotals({ items, discount: input?.discount, tax_rate: input?.tax_rate })
  const data = await cleanFieldData(input?.data || {}, fields)
  const number = unwrap(await supabase.rpc('next_quote_number'), 'createQuote:number')
  const row = {
    number, token: randomBytes(24).toString('base64url'),
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
  const q = unwrap(await supabase.from('quotes').insert(row).select().single(), 'createQuote')
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
  if (!q || q.status === 'draft') return null
  if (!['accept', 'decline'].includes(action)) throw new Error('action must be accept or decline')
  if (['accepted', 'declined'].includes(q.status)) throw new Error('This quote has already been answered.')
  if (q.status === 'expired' || isExpired(q)) {
    if (q.status !== 'expired') await supabase.from('quotes').update({ status: 'expired' }).eq('id', q.id)
    throw new Error('This quote has expired. Please contact us for an updated one.')
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
    sent_at: q.sent_at, responded_at: q.responded_at, response_note: q.response_note,
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
