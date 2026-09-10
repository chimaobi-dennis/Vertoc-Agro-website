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
import { createClient } from '@supabase/supabase-js'
import { slugify } from './slugify.js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error('Supabase driver selected but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
}

export const supabase = createClient(url, key, {
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
  if (!['new', 'read', 'archived'].includes(status)) {
    throw new Error('status must be one of: new, read, archived')
  }
  const existing = await getEnquiry(id)
  if (!existing) throw new Error(`no enquiry found with id ${id}`)
  return unwrap(
    await supabase.from('enquiries').update({ status }).eq('id', existing.id).select().single(),
    'updateEnquiryStatus'
  )
}
