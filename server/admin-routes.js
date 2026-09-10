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

const router = Router()
router.use(authenticate)

let svc = null
const supabase = () => svc ??= import('./store/supabase.js').then(m => m.supabase)

/** async handler wrapper: known input errors -> 400, anything else -> 500 (logged, not leaked) */
const h = fn => async (req, res) => {
  try { await fn(req, res) }
  catch (e) {
    if (e.expose) return res.status(e.status || 400).json({ error: e.message })
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
  const count = async (table, filter) => {
    let q = sb.from(table).select('*', { count: 'exact', head: true })
    if (filter) q = q.eq(...filter)
    return (await q).count ?? 0
  }
  res.json({
    products: await count('products'),
    posts: await count('posts'),
    enquiriesNew: await count('enquiries', ['status', 'new']),
    users: await count('profiles', ['active', true]),
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
  list: content.listProducts, get: content.getProduct,
  create: exposing(content.createProduct), update: exposing(content.updateProduct), remove: content.deleteProduct,
}, PERMISSIONS.products)

mountContent('posts', 'post', {
  list: content.listPosts, get: content.getPost,
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

export default router
