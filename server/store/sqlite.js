/* SQLite driver — used for local development and as the default store. */
/*
 * The single content core.
 *
 * Both the public REST API and the MCP tools Claude calls go through these
 * functions, so a product created by chatting with Claude and one created by
 * any other path are written exactly the same way.
 */
import { db } from '../db.js'
import { slugify } from './slugify.js'

const PRODUCT_FIELDS = [
  'name', 'category', 'summary', 'description', 'image',
  'origin', 'processing', 'packaging', 'moq', 'grade', 'hs_code',
  'featured', 'status', 'sort_order',
]
const POST_FIELDS = [
  'title', 'excerpt', 'body', 'category', 'image',
  'author', 'read_time', 'status', 'published_at',
]

const JSON_FIELDS = ['specs', 'applications', 'certifications']
const parseProduct = r => {
  if (!r) return null
  const out = { ...r, featured: !!r.featured }
  for (const f of JSON_FIELDS) out[f] = safeJson(r[f], [])
  return out
}
const safeJson = (s, fb) => { try { return JSON.parse(s) } catch { return fb } }

/* ----------------------------------------------------------- products --- */

export async function listProducts({ status = 'published', limit = 100, offset = 0 } = {}) {
  const where = status === 'all' ? '' : 'WHERE status = ?'
  const args = status === 'all' ? [] : [status]
  return db
    .prepare(`SELECT * FROM products ${where} ORDER BY sort_order, id LIMIT ? OFFSET ?`)
    .all(...args, limit, offset)
    .map(parseProduct)
}

export async function getProduct(slugOrId, { status = 'published' } = {}) {
  const row = db
    .prepare("SELECT * FROM products WHERE (slug = ? OR id = ?) AND (? = 'all' OR status = ?)")
    .get(String(slugOrId), Number(slugOrId) || -1, status, status)
  return parseProduct(row)
}

export async function createProduct(input) {
  if (!input?.name) throw new Error('name is required')
  const slug = slugify(input.slug || input.name)
  if (await getProduct(slug, { status: 'all' })) throw new Error(`a product with slug "${slug}" already exists`)

  const cols = ['slug', ...PRODUCT_FIELDS, ...JSON_FIELDS]
  const vals = [
    slug,
    input.name,
    input.category ?? 'Agro',
    input.summary ?? '',
    input.description ?? '',
    input.image ?? '',
    input.origin ?? '',
    input.processing ?? '',
    input.packaging ?? '',
    input.moq ?? '',
    input.grade ?? '',
    input.hs_code ?? '',
    input.featured ? 1 : 0,
    input.status ?? 'published',
    input.sort_order ?? 0,
    ...JSON_FIELDS.map(f => JSON.stringify(input[f] ?? [])),
  ]
  db.prepare(
    `INSERT INTO products (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  ).run(...vals)
  return await getProduct(slug)
}

export async function updateProduct(slugOrId, patch) {
  const existing = await getProduct(slugOrId, { status: 'all' })
  if (!existing) throw new Error(`no product found for "${slugOrId}"`)

  const sets = [], args = []
  for (const f of PRODUCT_FIELDS) {
    if (patch[f] === undefined) continue
    sets.push(`${f} = ?`)
    args.push(f === 'featured' ? (patch[f] ? 1 : 0) : patch[f])
  }
  for (const f of JSON_FIELDS) {
    if (patch[f] === undefined) continue
    sets.push(`${f} = ?`); args.push(JSON.stringify(patch[f]))
  }
  if (patch.slug !== undefined) { sets.push('slug = ?'); args.push(slugify(patch.slug)) }
  if (!sets.length) return existing

  sets.push(`updated_at = datetime('now')`)
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...args, existing.id)
  return await getProduct(patch.slug ? slugify(patch.slug) : existing.slug)
}

export async function deleteProduct(slugOrId) {
  const existing = await getProduct(slugOrId, { status: 'all' })
  if (!existing) throw new Error(`no product found for "${slugOrId}"`)
  db.prepare('DELETE FROM products WHERE id = ?').run(existing.id)
  return { deleted: true, slug: existing.slug, name: existing.name }
}

/* -------------------------------------------------------------- posts --- */

export async function listPosts({ status = 'published', limit = 100, offset = 0 } = {}) {
  const where = status === 'all' ? '' : 'WHERE status = ?'
  const args = status === 'all' ? [] : [status]
  return db
    .prepare(`SELECT * FROM posts ${where} ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, offset)
}

export async function getPost(slugOrId, { status = 'published' } = {}) {
  return db
    .prepare("SELECT * FROM posts WHERE (slug = ? OR id = ?) AND (? = 'all' OR status = ?)")
    .get(String(slugOrId), Number(slugOrId) || -1, status, status) ?? null
}

export async function createPost(input) {
  if (!input?.title) throw new Error('title is required')
  const slug = slugify(input.slug || input.title)
  if (await getPost(slug, { status: 'all' })) throw new Error(`a post with slug "${slug}" already exists`)

  const cols = ['slug', ...POST_FIELDS]
  const vals = [
    slug,
    input.title,
    input.excerpt ?? '',
    input.body ?? '',
    input.category ?? 'Insights',
    input.image ?? '',
    input.author ?? 'Vertoc Agro',
    input.read_time ?? '5 min read',
    input.status ?? 'published',
    input.published_at ?? new Date().toISOString().slice(0, 10),
  ]
  db.prepare(
    `INSERT INTO posts (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  ).run(...vals)
  return await getPost(slug)
}

export async function updatePost(slugOrId, patch) {
  const existing = await getPost(slugOrId, { status: 'all' })
  if (!existing) throw new Error(`no post found for "${slugOrId}"`)

  const sets = [], args = []
  for (const f of POST_FIELDS) {
    if (patch[f] === undefined) continue
    sets.push(`${f} = ?`); args.push(patch[f])
  }
  if (patch.slug !== undefined) { sets.push('slug = ?'); args.push(slugify(patch.slug)) }
  if (!sets.length) return existing

  sets.push(`updated_at = datetime('now')`)
  db.prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`).run(...args, existing.id)
  return await getPost(patch.slug ? slugify(patch.slug) : existing.slug)
}

export async function deletePost(slugOrId) {
  const existing = await getPost(slugOrId, { status: 'all' })
  if (!existing) throw new Error(`no post found for "${slugOrId}"`)
  db.prepare('DELETE FROM posts WHERE id = ?').run(existing.id)
  return { deleted: true, slug: existing.slug, title: existing.title }
}


/* ---------------------------------------------------------- enquiries --- */

const ENQUIRY_FIELDS = [
  'kind', 'name', 'email', 'phone', 'subject',
  'message', 'commodity', 'quantity', 'destination',
]

export async function createEnquiry(input) {
  if (!input?.name) throw new Error('name is required')
  if (!input?.email) throw new Error('email is required')

  const cols = [...ENQUIRY_FIELDS]
  const vals = [
    input.kind === 'quote' ? 'quote' : 'contact',
    input.name, input.email,
    input.phone ?? '', input.subject ?? '', input.message ?? '',
    input.commodity ?? '', input.quantity ?? '', input.destination ?? '',
  ]
  const info = db.prepare(
    `INSERT INTO enquiries (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  ).run(...vals)
  return await getEnquiry(Number(info.lastInsertRowid))
}

export async function getEnquiry(id) {
  return db.prepare('SELECT * FROM enquiries WHERE id = ?').get(Number(id)) ?? null
}

export async function listEnquiries({ status = 'all', kind = 'all', limit = 50, offset = 0 } = {}) {
  const where = [], args = []
  if (status !== 'all') { where.push('status = ?'); args.push(status) }
  if (kind !== 'all') { where.push('kind = ?'); args.push(kind) }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''
  return db
    .prepare(`SELECT * FROM enquiries ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, offset)
}

export async function updateEnquiryStatus(id, status) {
  const existing = await getEnquiry(id)
  if (!existing) throw new Error(`no enquiry found with id ${id}`)
  if (!['new', 'read', 'archived'].includes(status)) {
    throw new Error("status must be one of: new, read, archived")
  }
  db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(status, existing.id)
  return await getEnquiry(id)
}

/* Phase 2 (clients, enquiry pipeline) is Supabase-only. The SQLite driver is a
   credential-less dev fallback for the public site and basic content. */
const needsSupabase = () => { throw new Error('Clients, quotes, documents, email and settings require Supabase (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)') }
export const listClientFields = needsSupabase, getClientField = needsSupabase, createClientField = needsSupabase,
  updateClientField = needsSupabase, deleteClientField = needsSupabase, reorderClientFields = needsSupabase,
  listClients = needsSupabase, getClient = needsSupabase, createClient = needsSupabase, updateClient = needsSupabase,
  deleteClient = needsSupabase, listClientEnquiries = needsSupabase, updateEnquiry = needsSupabase,
  // Phase 3 (documents, quotes, email, purchases, settings): Supabase-only too.
  listQuoteFields = needsSupabase, getQuoteField = needsSupabase, createQuoteField = needsSupabase, updateQuoteField = needsSupabase, deleteQuoteField = needsSupabase, reorderQuoteFields = needsSupabase,
  getSettings = needsSupabase, updateSettings = needsSupabase, readSecrets = needsSupabase, writeSecret = needsSupabase,
  createDocument = needsSupabase, completeDocument = needsSupabase, getDocument = needsSupabase, listDocuments = needsSupabase, documentUrl = needsSupabase, downloadDocument = needsSupabase, deleteDocument = needsSupabase,
  listQuotes = needsSupabase, getQuote = needsSupabase, getQuoteByToken = needsSupabase, createQuote = needsSupabase, updateQuote = needsSupabase, deleteQuote = needsSupabase, markQuoteSent = needsSupabase, markQuoteViewed = needsSupabase, respondToQuote = needsSupabase, publicQuote = needsSupabase, convertQuoteToPurchase = needsSupabase,
  createMessage = needsSupabase, updateMessage = needsSupabase, getMessage = needsSupabase, listMessages = needsSupabase, markMessageRead = needsSupabase, getMessageByProviderId = needsSupabase, latestOutboundTo = needsSupabase, countUnreadInbound = needsSupabase, findClientByEmail = needsSupabase, getQuoteByNumber = needsSupabase,
  listTemplates = needsSupabase, getTemplate = needsSupabase, upsertTemplate = needsSupabase, updateTemplate = needsSupabase, createDocumentFromBuffer = needsSupabase,
  listPurchases = needsSupabase, getPurchase = needsSupabase, createPurchase = needsSupabase, updatePurchase = needsSupabase, deletePurchase = needsSupabase
