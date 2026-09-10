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

/* ------------------------------------------------------ client fields --- */

export const FIELD_TYPES = ['text', 'textarea', 'email', 'phone', 'number', 'date', 'select', 'checkbox', 'url']

const fieldKey = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

export async function listClientFields() {
  return unwrap(await supabase.from('client_fields').select('*').order('sort_order').order('id'), 'listClientFields') ?? []
}

export async function getClientField(id) {
  const rows = unwrap(await supabase.from('client_fields').select('*').eq('id', Number(id)).limit(1), 'getClientField')
  return rows?.[0] ?? null
}

export async function createClientField(input) {
  const label = String(input?.label || '').trim()
  if (!label) throw new Error('label is required')
  const key = fieldKey(input.key || label)
  if (!key) throw new Error('could not derive a key from that label')
  const type = input.type || 'text'
  if (!FIELD_TYPES.includes(type)) throw new Error(`type must be one of: ${FIELD_TYPES.join(', ')}`)
  const options = type === 'select' ? (Array.isArray(input.options) ? input.options.map(String).map(o => o.trim()).filter(Boolean) : []) : []
  if (type === 'select' && !options.length) throw new Error('a select field needs at least one option')
  const { data: last } = await supabase.from('client_fields').select('sort_order').order('sort_order', { ascending: false }).limit(1)
  const row = { key, label, type, options, required: Boolean(input.required), show_in_list: input.show_in_list !== false, sort_order: (last?.[0]?.sort_order ?? 0) + 10 }
  const { data, error } = await supabase.from('client_fields').insert(row).select().single()
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? `a field with key "${key}" already exists` : error.message)
  return data
}

export async function updateClientField(id, patch) {
  const existing = await getClientField(id)
  if (!existing) throw new Error(`no field with id ${id}`)
  const row = {}
  if (patch.label !== undefined) { row.label = String(patch.label).trim(); if (!row.label) throw new Error('label cannot be empty') }
  if (patch.type !== undefined) { if (!FIELD_TYPES.includes(patch.type)) throw new Error(`type must be one of: ${FIELD_TYPES.join(', ')}`); row.type = patch.type }
  if (patch.options !== undefined) row.options = Array.isArray(patch.options) ? patch.options.map(String).map(o => o.trim()).filter(Boolean) : []
  if (patch.required !== undefined) row.required = Boolean(patch.required)
  if (patch.show_in_list !== undefined) row.show_in_list = Boolean(patch.show_in_list)
  if (patch.sort_order !== undefined) row.sort_order = Number(patch.sort_order) || 0
  if (!Object.keys(row).length) return existing
  return unwrap(await supabase.from('client_fields').update(row).eq('id', existing.id).select().single(), 'updateClientField')
}

export async function deleteClientField(id) {
  const f = await getClientField(id)
  if (!f) throw new Error(`no field with id ${id}`)
  unwrap(await supabase.from('client_fields').delete().eq('id', f.id), 'deleteClientField')
  return { deleted: true, id: f.id, key: f.key, label: f.label }
}

export async function reorderClientFields(ids) {
  if (!Array.isArray(ids) || !ids.length) throw new Error('ids must be a non-empty array')
  for (let i = 0; i < ids.length; i++) {
    unwrap(await supabase.from('client_fields').update({ sort_order: (i + 1) * 10 }).eq('id', Number(ids[i])), 'reorderClientFields')
  }
  return listClientFields()
}

/* ------------------------------------------------------------ clients --- */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Validate and clean a client's dynamic data against the current field definitions. */
export function cleanClientData(data, fields) {
  const out = {}, errors = []
  for (const f of fields) {
    let v = data?.[f.key]
    if (f.type === 'checkbox') { out[f.key] = Boolean(v); continue }
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
  if (errors.length) throw new Error(errors.join('; '))
  return out
}

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
  const data = cleanClientData(input.data || {}, await listClientFields())
  const row = { name, data, status: input.status === 'archived' ? 'archived' : 'active', created_by: actorId }
  return unwrap(await supabase.from('clients').insert(row).select().single(), 'createClient')
}

export async function updateClient(id, patch) {
  const existing = await getClient(id)
  if (!existing) throw new Error(`no client with id ${id}`)
  const row = {}
  if (patch.name !== undefined) { row.name = String(patch.name).trim(); if (!row.name) throw new Error('name cannot be empty') }
  if (patch.status !== undefined) { if (!['active', 'archived'].includes(patch.status)) throw new Error('status must be active or archived'); row.status = patch.status }
  if (patch.data !== undefined) row.data = cleanClientData({ ...existing.data, ...patch.data }, await listClientFields())
  if (!Object.keys(row).length) return existing
  return unwrap(await supabase.from('clients').update(row).eq('id', existing.id).select().single(), 'updateClient')
}

export async function deleteClient(id) {
  const existing = await getClient(id)
  if (!existing) throw new Error(`no client with id ${id}`)
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
