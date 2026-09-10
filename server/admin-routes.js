/*
 * /api/admin/* — everything the admin panel calls.
 *
 * Every route sits behind authenticate(); role checks are per-route. All
 * mutations go through the same content core the public site and MCP use,
 * and every one of them writes an audit row.
 */
import express, { Router } from 'express'
import { authenticate, requireRole, PERMISSIONS } from './auth.js'
import { audit } from './audit.js'
import * as content from './content.js'
import { deliver, sendQuote, resolveResendKey, dryRun, quoteLink, publicUrl } from './messaging.js'
import { renderQuotePdf } from './quote-pdf.js'
import { encryptSecret, sha256, newToken } from './secrets.js'
import { refreshMcpSettings } from './mcp-auth.js'

const router = Router()
router.use(authenticate)

let svc = null
const supabase = () => svc ??= import('./store/supabase.js').then(m => m.supabase)

/** async handler wrapper: known input errors -> 400, anything else -> 500 (logged, not leaked) */
const h = fn => async (req, res) => {
  try { await fn(req, res) }
  catch (e) {
    if (e.expose) return res.status(e.status || 400).json({ error: e.message, ...(e.message_id ? { message_id: e.message_id } : {}) })
    console.error('[admin]', req.method, req.path, e.message)
    res.status(500).json({ error: 'Something went wrong on our side.' })
  }
}
const bad = (message, status = 400) => Object.assign(new Error(message), { expose: true, status })

/* ------------------------------------------------------------ session --- */

router.get('/me', h(async (req, res) => {
  const permissions = Object.fromEntries(
    Object.entries(PERMISSIONS).map(([k, roles]) => [k, roles.includes(req.user.role)])
  )
  res.json({ ...req.user, permissions })
}))

router.get('/stats', h(async (_req, res) => {
  const sb = await supabase()
  // A count of 0 rather than a 500 if a later migration is not applied yet.
  const count = async (table, where) => {
    try {
      let q = sb.from(table).select('*', { count: 'exact', head: true })
      if (where) q = where(q)
      const { count: n, error } = await q
      return error ? 0 : (n ?? 0)
    } catch { return 0 }
  }
  res.json({
    clients: await count('clients', q => q.eq('status', 'active')),
    products: await count('products'),
    posts: await count('posts'),
    enquiriesNew: await count('enquiries', q => q.eq('status', 'new')),
    users: await count('profiles', q => q.eq('active', true)),
    quotesOpen: await count('quotes', q => q.in('status', ['sent', 'viewed'])),
    purchasesPending: await count('purchases', q => q.eq('status', 'pending')),
  })
}))

/* --------------------------------------------------- products & posts --- */

function mountContent(path, entity, api, roles) {
  const guard = requireRole(...roles)

  router.get(`/${path}`, guard, h(async (req, res) => {
    res.json(await api.list({ status: req.query.status || 'all', limit: 500 }))
  }))

  router.get(`/${path}/:key`, guard, h(async (req, res) => {
    const row = await api.get(req.params.key)
    if (!row) throw bad(`${entity} not found`, 404)
    res.json(row)
  }))

  router.post(`/${path}`, guard, h(async (req, res) => {
    const after = await api.create(req.body)
    await audit({ actor: req.user, action: 'create', entity, entityId: after.slug, after })
    res.status(201).json(after)
  }))

  router.patch(`/${path}/:key`, guard, h(async (req, res) => {
    const before = await api.get(req.params.key)
    if (!before) throw bad(`${entity} not found`, 404)
    const after = await api.update(req.params.key, req.body)
    await audit({ actor: req.user, action: 'update', entity, entityId: after.slug, before, after })
    res.json(after)
  }))

  router.delete(`/${path}/:key`, guard, h(async (req, res) => {
    const before = await api.get(req.params.key)
    if (!before) throw bad(`${entity} not found`, 404)
    await api.remove(req.params.key)
    await audit({ actor: req.user, action: 'delete', entity, entityId: before.slug, before })
    res.json({ deleted: true, slug: before.slug })
  }))
}

// The content core throws plain Errors for input problems (missing name,
// duplicate slug). Mark those as exposable so the panel shows the message.
const exposing = fn => async (...a) => {
  try { return await fn(...a) } catch (e) { throw Object.assign(e, { expose: true }) }
}

mountContent('products', 'product', {
  list: content.listProducts, get: k => content.getProduct(k, { status: 'all' }),
  create: exposing(content.createProduct), update: exposing(content.updateProduct), remove: content.deleteProduct,
}, PERMISSIONS.products)

mountContent('posts', 'post', {
  list: content.listPosts, get: k => content.getPost(k, { status: 'all' }),
  create: exposing(content.createPost), update: exposing(content.updatePost), remove: content.deletePost,
}, PERMISSIONS.posts)

/* -------------------------------------------------------------- users --- */

const ROLES = ['admin', 'editor', 'sales']
const isEmail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || ''))

router.get('/users', requireRole('admin'), h(async (_req, res) => {
  const sb = await supabase()
  const { data, error } = await sb.from('profiles')
    .select('id, email, name, role, active, created_at').order('created_at')
  if (error) throw new Error(error.message)
  res.json(data)
}))

router.post('/users/invite', requireRole('admin'), h(async (req, res) => {
  const { email, name = '', role = 'editor' } = req.body || {}
  if (!isEmail(email)) throw bad('Please enter a valid email address.')
  if (!ROLES.includes(role)) throw bad(`Role must be one of: ${ROLES.join(', ')}.`)

  const sb = await supabase()
  const redirectTo = `${process.env.ADMIN_URL || ''}/admin/set-password`
  const { data, error } = await sb.auth.admin.inviteUserByEmail(email, { data: { name }, redirectTo })
  if (error) throw bad(error.message.includes('already') ? 'That email already has an account.' : error.message)

  // The auth trigger created an INACTIVE profile; this upsert activates it with the chosen role.
  const { error: pErr } = await sb.from('profiles')
    .upsert({ id: data.user.id, email, name, role, active: true }, { onConflict: 'id' })
  if (pErr) throw new Error(pErr.message)

  await audit({ actor: req.user, action: 'invite', entity: 'user', entityId: data.user.id, after: { email, name, role } })
  res.status(201).json({ id: data.user.id, email, name, role, active: true })
}))

router.patch('/users/:id', requireRole('admin'), h(async (req, res) => {
  const { id } = req.params
  const patch = {}
  if (req.body.role !== undefined) {
    if (!ROLES.includes(req.body.role)) throw bad(`Role must be one of: ${ROLES.join(', ')}.`)
    patch.role = req.body.role
  }
  if (req.body.active !== undefined) patch.active = Boolean(req.body.active)
  if (req.body.name !== undefined) patch.name = String(req.body.name).slice(0, 120)
  if (!Object.keys(patch).length) throw bad('Nothing to update.')

  const sb = await supabase()
  const { data: before } = await sb.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!before) throw bad('User not found.', 404)

  // Lock-out guards: you cannot remove your own admin access, and the last
  // active admin cannot be demoted or deactivated by anyone.
  const losesAdmin = before.role === 'admin' && (patch.role && patch.role !== 'admin' || patch.active === false)
  if (losesAdmin) {
    if (id === req.user.id) throw bad("You can't remove your own admin access.")
    const { count } = await sb.from('profiles').select('*', { count: 'exact', head: true })
      .eq('role', 'admin').eq('active', true)
    if ((count ?? 0) <= 1) throw bad('This is the last active admin; promote someone else first.')
  }

  const { data: after, error } = await sb.from('profiles').update(patch).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  await audit({ actor: req.user, action: 'update', entity: 'user', entityId: id, before, after })
  res.json(after)
}))

/* -------------------------------------------------------------- audit --- */

router.get('/audit', requireRole('admin'), h(async (req, res) => {
  const sb = await supabase()
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  res.json(data)
}))

/* ------------------------------------------------------------- upload --- */
// Images arrive as base64 JSON (no multipart parser needed, works on Vercel).
// This route has its own larger body limit; app.js skips the global parser
// for it.

const MAX_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

router.post('/upload', express.json({ limit: '12mb' }), requireRole(...PERMISSIONS.products), h(async (req, res) => {
  const { filename = 'upload', contentType, data } = req.body || {}
  if (!IMAGE_TYPES.has(contentType)) throw bad('Only JPEG, PNG, WebP, GIF or AVIF images are allowed.')
  if (!data) throw bad('No file data received.')

  const buffer = Buffer.from(String(data).replace(/^data:[^;]+;base64,/, ''), 'base64')
  if (!buffer.length) throw bad('File appears to be empty.')
  if (buffer.length > MAX_BYTES) throw bad('Image must be under 8 MB.')

  const safe = String(filename).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80)
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safe}`

  const sb = await supabase()
  const { error } = await sb.storage.from('media').upload(path, buffer, { contentType, upsert: false })
  if (error) throw new Error(error.message)
  const { data: pub } = sb.storage.from('media').getPublicUrl(path)

  await audit({ actor: req.user, action: 'upload', entity: 'media', entityId: path, after: { url: pub.publicUrl, bytes: buffer.length } })
  res.status(201).json({ url: pub.publicUrl, path })
}))

/* ================================================ PHASE 2: CRM + INBOX ==== */

const crm   = requireRole(...PERMISSIONS.clients)
const inbox = requireRole(...PERMISSIONS.quotes)

/* user-defined fields: one mount for client_fields and quote_fields */
function mountFields(path, entity, api, guard) {
  router.get(`/${path}`, guard, h(async (_req, res) => res.json(await api.list())))
  router.post(`/${path}`, guard, h(async (req, res) => {
    const after = await exposing(api.create)(req.body)
    await audit({ actor: req.user, action: 'create', entity, entityId: after.key, after })
    res.status(201).json(after)
  }))
  router.put(`/${path}/order`, guard, h(async (req, res) => res.json(await exposing(api.reorder)(req.body?.ids))))
  router.patch(`/${path}/:id`, guard, h(async (req, res) => {
    const before = await api.get(req.params.id)
    if (!before) throw bad('field not found', 404)
    const after = await exposing(api.update)(req.params.id, req.body)
    await audit({ actor: req.user, action: 'update', entity, entityId: after.key, before, after })
    res.json(after)
  }))
  router.delete(`/${path}/:id`, guard, h(async (req, res) => {
    const before = await api.get(req.params.id)
    if (!before) throw bad('field not found', 404)
    const r = await api.remove(req.params.id)
    await audit({ actor: req.user, action: 'delete', entity, entityId: before.key, before })
    res.json(r)
  }))
}
mountFields('client-fields', 'client_field', { list: content.listClientFields, get: content.getClientField, create: content.createClientField, update: content.updateClientField, remove: content.deleteClientField, reorder: content.reorderClientFields }, crm)
mountFields('quote-fields', 'quote_field', { list: content.listQuoteFields, get: content.getQuoteField, create: content.createQuoteField, update: content.updateQuoteField, remove: content.deleteQuoteField, reorder: content.reorderQuoteFields }, inbox)

/* clients */
router.get('/clients', crm, h(async (req, res) => {
  res.json(await content.listClients({ status: req.query.status || 'active' }))
}))

router.get('/clients/:id', crm, h(async (req, res) => {
  const c = await content.getClient(req.params.id)
  if (!c) throw bad('client not found', 404)
  res.json({ ...c, enquiries: await content.listClientEnquiries(c.id) })
}))

router.post('/clients', crm, h(async (req, res) => {
  const after = await exposing(content.createClient)(req.body, req.user.id)
  await audit({ actor: req.user, action: 'create', entity: 'client', entityId: after.id, after })
  res.status(201).json(after)
}))

router.patch('/clients/:id', crm, h(async (req, res) => {
  const before = await content.getClient(req.params.id)
  if (!before) throw bad('client not found', 404)
  const after = await exposing(content.updateClient)(req.params.id, req.body)
  await audit({ actor: req.user, action: 'update', entity: 'client', entityId: after.id, before, after })
  res.json(after)
}))

router.delete('/clients/:id', crm, h(async (req, res) => {
  const before = await content.getClient(req.params.id)
  if (!before) throw bad('client not found', 404)
  const r = await content.deleteClient(req.params.id)
  await audit({ actor: req.user, action: 'delete', entity: 'client', entityId: before.id, before })
  res.json(r)
}))

/* enquiries (quote requests + contact messages) */
router.get('/enquiries', inbox, h(async (req, res) => {
  res.json(await content.listEnquiries({ kind: req.query.kind || 'all', status: req.query.status || 'all', limit: 500 }))
}))

router.get('/enquiries/:id', inbox, h(async (req, res) => {
  const e = await content.getEnquiry(req.params.id)
  if (!e) throw bad('enquiry not found', 404)
  res.json(e)
}))

router.patch('/enquiries/:id', inbox, h(async (req, res) => {
  const before = await content.getEnquiry(req.params.id)
  if (!before) throw bad('enquiry not found', 404)
  const after = await exposing(content.updateEnquiry)(req.params.id, req.body)
  await audit({ actor: req.user, action: 'update', entity: 'enquiry', entityId: after.id, before, after })
  res.json(after)
}))

/* ============== PHASE 3: SETTINGS, DOCUMENTS, QUOTES, EMAIL, PURCHASES ==== */

const mail = requireRole(...PERMISSIONS.email)
const settingsAdmin = requireRole(...PERMISSIONS.settings)
const idOrNull = v => (v == null || v === '' ? null : Number(v))
const SECRET_NAMES = { resend_api_key: /^re_[A-Za-z0-9_]{10,}$/ }

/** Settings as the panel may see them: no token hash, no secret values. */
function safeSettings(s) {
  const { mcp, ...rest } = s
  return { ...rest, mcp: { enabled: mcp.enabled, token_hint: mcp.token_hint, rotated_at: mcp.rotated_at } }
}

router.get('/settings', h(async (req, res) => {
  const s = await content.getSettings()
  const { source } = await resolveResendKey()
  const out = { ...safeSettings(s), email: { ...s.email, configured: Boolean(source), source, dry_run: dryRun() }, public_url: publicUrl() }
  if (req.user.role === 'admin') {
    const secrets = await content.readSecrets()
    out.secrets = Object.fromEntries(Object.entries(secrets).map(([k, v]) => [k, { hint: v.hint, set_at: v.set_at }]))
    out.mcp = { ...out.mcp, endpoint: `${publicUrl()}/mcp`, env_token: Boolean(process.env.VERTOC_MCP_TOKEN) }
    out.env = { resend: Boolean(process.env.RESEND_API_KEY), turnstile: Boolean(process.env.TURNSTILE_SECRET_KEY), site_url: process.env.SITE_URL || null }
  }
  res.json(out)
}))

router.put('/settings', settingsAdmin, h(async (req, res) => {
  const patch = { ...(req.body || {}) }
  if (patch.mcp) patch.mcp = { enabled: patch.mcp.enabled }   // the token is managed below, never set directly
  delete patch.secrets
  const before = await content.getSettings()
  const after = await exposing(content.updateSettings)(patch)
  if (patch.mcp) refreshMcpSettings()
  const groups = Object.keys(patch)
  await audit({ actor: req.user, action: 'update', entity: 'settings', entityId: groups.join(','),
    before: Object.fromEntries(groups.map(g => [g, safeSettings(before)[g]])), after: Object.fromEntries(groups.map(g => [g, safeSettings(after)[g]])) })
  res.json(safeSettings(after))
}))

/* MCP access token: generated here, shown once, stored as a hash. */
router.post('/settings/mcp/token', settingsAdmin, h(async (req, res) => {
  const token = newToken(32)
  await content.updateSettings({ mcp: { enabled: true, token_hash: sha256(token), token_hint: token.slice(-4), rotated_at: new Date().toISOString() } })
  refreshMcpSettings()
  await audit({ actor: req.user, action: 'rotate', entity: 'mcp_token', after: { hint: token.slice(-4) } })
  res.status(201).json({ token, hint: token.slice(-4), endpoint: `${publicUrl()}/mcp` })
}))
router.delete('/settings/mcp/token', settingsAdmin, h(async (req, res) => {
  await content.updateSettings({ mcp: { token_hash: '', token_hint: '', rotated_at: new Date().toISOString() } })
  refreshMcpSettings()
  await audit({ actor: req.user, action: 'revoke', entity: 'mcp_token' })
  res.json({ revoked: true })
}))

/* Secrets (API keys) set from the panel: write-only, encrypted at rest. */
router.put('/settings/secrets/:name', settingsAdmin, h(async (req, res) => {
  const { name } = req.params
  if (!SECRET_NAMES[name]) throw bad('Unknown secret.', 404)
  const value = String(req.body?.value || '').trim()
  if (!value) throw bad('Enter a value.')
  if (!SECRET_NAMES[name].test(value)) throw bad(name === 'resend_api_key' ? 'That does not look like a Resend API key (they start with re_).' : 'Invalid value.')
  const list = await content.writeSecret(name, encryptSecret(value))
  await audit({ actor: req.user, action: 'update', entity: 'secret', entityId: name, after: { hint: value.slice(-4) } })
  res.json(list)
}))
router.delete('/settings/secrets/:name', settingsAdmin, h(async (req, res) => {
  const { name } = req.params
  if (!SECRET_NAMES[name]) throw bad('Unknown secret.', 404)
  const list = await content.writeSecret(name, null)
  await audit({ actor: req.user, action: 'delete', entity: 'secret', entityId: name })
  res.json(list)
}))

/* documents: metadata here, bytes straight to storage via signed URLs */
router.get('/documents', crm, h(async (req, res) => {
  res.json(await content.listDocuments({ client_id: idOrNull(req.query.client_id), quote_id: idOrNull(req.query.quote_id) }))
}))
router.post('/documents', crm, h(async (req, res) => {
  res.status(201).json(await exposing(content.createDocument)(req.body || {}, req.user.id))
}))
router.post('/documents/:id/complete', crm, h(async (req, res) => {
  const doc = await exposing(content.completeDocument)(req.params.id)
  await audit({ actor: req.user, action: 'upload', entity: 'document', entityId: doc.id, after: { name: doc.name, bytes: doc.bytes, client_id: doc.client_id, quote_id: doc.quote_id } })
  res.json(doc)
}))
router.get('/documents/:id/url', crm, h(async (req, res) => {
  res.json(await exposing(content.documentUrl)(req.params.id, { download: req.query.download === '1' }))
}))
router.delete('/documents/:id', crm, h(async (req, res) => {
  const before = await content.getDocument(req.params.id, { any: true })
  if (!before) throw bad('document not found', 404)
  const r = await content.deleteDocument(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'document', entityId: before.id, before })
  res.json(r)
}))

/* quotes */
router.get('/quotes', inbox, h(async (req, res) => {
  res.json(await content.listQuotes({ status: req.query.status || 'all', client_id: idOrNull(req.query.client_id) }))
}))
router.get('/quotes/:id', inbox, h(async (req, res) => {
  const q = await content.getQuote(req.params.id)
  if (!q) throw bad('quote not found', 404)
  const [messages, documents] = await Promise.all([content.listMessages({ quote_id: q.id }), content.listDocuments({ quote_id: q.id })])
  res.json({ ...q, messages, documents, link: quoteLink(q) })
}))
router.post('/quotes', inbox, h(async (req, res) => {
  const after = await exposing(content.createQuote)(req.body || {}, req.user.id)
  await audit({ actor: req.user, action: 'create', entity: 'quote', entityId: after.id, after })
  res.status(201).json({ ...after, link: quoteLink(after) })
}))
router.patch('/quotes/:id', inbox, h(async (req, res) => {
  const before = await content.getQuote(req.params.id)
  if (!before) throw bad('quote not found', 404)
  const after = await exposing(content.updateQuote)(before.id, req.body || {})
  await audit({ actor: req.user, action: 'update', entity: 'quote', entityId: after.id, before, after })
  res.json({ ...after, link: quoteLink(after) })
}))
router.delete('/quotes/:id', inbox, h(async (req, res) => {
  const before = await content.getQuote(req.params.id)
  if (!before) throw bad('quote not found', 404)
  const r = await content.deleteQuote(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'quote', entityId: before.id, before })
  res.json(r)
}))
router.get('/quotes/:id/pdf', inbox, h(async (req, res) => {
  const q = await content.getQuote(req.params.id)
  if (!q) throw bad('quote not found', 404)
  const [settings, fields] = await Promise.all([content.getSettings(), content.listQuoteFields()])
  const pdf = renderQuotePdf(q, settings, fields, quoteLink(q))
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${q.number}.pdf"`)
  res.send(pdf)
}))
router.post('/quotes/:id/send', mail, h(async (req, res) => {
  const b = req.body || {}
  const r = await sendQuote(req.params.id, { actor: req.user, to: b.to, subject: b.subject, body: b.body, attachmentIds: b.attachment_ids || [] })
  res.json({ ...r, link: quoteLink(r.quote) })
}))
router.post('/quotes/:id/convert', crm, h(async (req, res) => {
  const after = await exposing(content.convertQuoteToPurchase)(req.params.id, req.user.id)
  await audit({ actor: req.user, action: 'create', entity: 'purchase', entityId: after.id, after })
  res.status(201).json(after)
}))

/* messages (one-to-one email) */
router.get('/messages', mail, h(async (req, res) => {
  res.json(await content.listMessages({ client_id: idOrNull(req.query.client_id), quote_id: idOrNull(req.query.quote_id), enquiry_id: idOrNull(req.query.enquiry_id) }))
}))
router.get('/messages/:id', mail, h(async (req, res) => {
  const m = await content.getMessage(req.params.id)
  if (!m) throw bad('message not found', 404)
  res.json(m)
}))
router.post('/messages', mail, h(async (req, res) => {
  const b = req.body || {}
  let clientId = idOrNull(b.client_id), enquiryId = idOrNull(b.enquiry_id), toName = b.to_name
  if (clientId != null) { const c = await content.getClient(clientId); if (!c) throw bad('client not found', 404); toName ??= c.name }
  if (enquiryId != null) { const e = await content.getEnquiry(enquiryId); if (!e) throw bad('enquiry not found', 404); toName ??= e.name; clientId ??= e.client_id }
  const msg = await deliver({ actor: req.user, to: b.to, toName, subject: b.subject, body: b.body, attachmentIds: b.attachment_ids || [], clientId, enquiryId })
  res.status(201).json(msg)
}))

/* purchases */
router.get('/purchases', crm, h(async (req, res) => {
  res.json(await content.listPurchases({ client_id: idOrNull(req.query.client_id), status: req.query.status || 'all' }))
}))
router.post('/purchases', crm, h(async (req, res) => {
  const after = await exposing(content.createPurchase)(req.body || {}, req.user.id)
  await audit({ actor: req.user, action: 'create', entity: 'purchase', entityId: after.id, after })
  res.status(201).json(after)
}))
router.patch('/purchases/:id', crm, h(async (req, res) => {
  const before = await content.getPurchase(req.params.id)
  if (!before) throw bad('purchase not found', 404)
  const after = await exposing(content.updatePurchase)(before.id, req.body || {})
  await audit({ actor: req.user, action: 'update', entity: 'purchase', entityId: after.id, before, after })
  res.json(after)
}))
router.delete('/purchases/:id', crm, h(async (req, res) => {
  const before = await content.getPurchase(req.params.id)
  if (!before) throw bad('purchase not found', 404)
  const r = await content.deletePurchase(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'purchase', entityId: before.id, before })
  res.json(r)
}))

export default router
