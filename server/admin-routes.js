/*
 * /api/admin/* — everything the admin panel calls.
 *
 * Every route sits behind authenticate(); role checks are per-route. All
 * mutations go through the same content core the public site and MCP use,
 * and every one of them writes an audit row.
 */
import express, { Router } from 'express'
import { authenticate, can, demand, forgetRole } from './auth.js'
import { ACTIONS, ACTION_LABELS, BUILT_IN_ROLES, MODULES, cleanPermissions, diffPermissions, enumFor, hasUser, menuFlags, seesAmounts } from './permissions.js'
import { audit } from './audit.js'
import * as content from './content.js'
import { deliver, sendQuote, inviteUser, sendSetPasswordLink, acknowledgeEnquiry, resolveResendKey, resolveWebhookSecret, dryRun, quoteLink, publicUrl, panelLink } from './messaging.js'
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, SAMPLE_VARS, renderTemplate, renderKey, templateFor } from './templates.js'
import { renderEmailHtml } from './email.js'
import { renderQuotePdf } from './quote-pdf.js'
import { encryptSecret, sha256, newToken } from './secrets.js'
import { refreshMcpSettings } from './mcp-auth.js'
import procurementRoutes from './procurement-routes.js'
import portalAdminRoutes from './portal-admin-routes.js'
import inventoryRoutes from './inventory-routes.js'
import approvalRoutes, { amend, mayApprove, requireApproved, submitted, withAmounts, maySeeAmounts } from './approval-routes.js'

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
  // `permissions`: what the menus show. `can`: every action, module by module.
  res.json({ ...req.user, perms: undefined, permissions: menuFlags(req.user.perms), can: req.user.perms, sees_amounts: seesAmounts(req.user.perms), role_name: BUILT_IN_ROLES[req.user.role_key]?.name || req.user.role_key })
}))

router.get('/stats', h(async (req, res) => {
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
  const unreadAll = await count('messages', q => q.eq('direction', 'in').is('read_at', null))
  res.json({
    clients: await count('clients', q => q.eq('status', 'active')),
    products: await count('products'),
    posts: await count('posts'),
    enquiriesNew: await count('enquiries', q => q.eq('status', 'new')),
    users: await count('profiles', q => q.eq('active', true)),
    investorChanges: hasUser(req.user, 'investments', 'view') ? await content.pendingRequests().catch(() => 0) : 0,
    inventoryOpen: hasUser(req.user, 'inventory', 'view') ? (await content.inventoryCounts().catch(() => ({ open: 0 }))).open : 0,
    approvalsPending: await Promise.resolve().then(async () => { const t = ['quote', 'purchase_order', 'client', 'supplier'].filter(x => mayApprove(req, x)); if (!t.length) return 0; return (await content.listPending(t)).length + (await content.listAmendments({ status: 'pending' })).filter(a => t.includes(a.entity)).length }).catch(() => 0),
    quotesOpen: await count('quotes', q => q.in('status', ['sent', 'viewed'])),
    purchasesPending: await count('purchases', q => q.eq('status', 'pending')),
    paymentsNew: await count('payments', q => q.eq('status', 'submitted')),
    investmentsNew: (await count('investments', q => q.eq('status', 'pending'))) + (hasUser(req.user, 'investments', 'view') ? await content.pendingRequests().catch(() => 0) : 0),
    deliveriesMoving: await count('po_shipments', q => q.in('status', ['in_transit', 'delivered'])),
    reviewsPending: await Promise.resolve().then(() => count('reviews', q => q.eq('status', 'pending'))).catch(() => 0),   // 0 until migration 009 exists
    // Procurement has its own inbox: its unread mail is counted apart (zeros until migration 014 exists).
    ...(proc => ({ ...proc, inboundUnread: Math.max(0, unreadAll - proc.procUnread) }))(await content.procurementStats().catch(() => ({ tendersOpen: 0, bidsNew: 0, suppliers: 0, ordersOpen: 0, procUnread: 0 }))),
  })
}))

/* --------------------------------------------------- products & posts --- */

function mountContent(path, entity, api, roles) {
  const guard = can('content')

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
})

mountContent('posts', 'post', {
  list: content.listPosts, get: k => content.getPost(k, { status: 'all' }),
  create: exposing(content.createPost), update: exposing(content.updatePost), remove: content.deletePost,
})

/* -------------------------------------------------------------- users --- */

const isEmail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || ''))
const ROLES_HINT = 'Roles and permissions need the database migration 015: run server/migrations/015_portals_permissions.sql in the Supabase SQL editor first.'
const noRolesTable = e => ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e?.code) || /role_key|staff_roles|permissions/.test(String(e?.message || ''))
async function customRoles() {
  const sb = await supabase()
  const { data, error } = await sb.from('staff_roles').select('*').order('created_at', { ascending: false })
  return error ? [] : data
}
/** A role key that exists (built-in or custom), or 400. */
async function roleOr400(key) {
  if (BUILT_IN_ROLES[key]) return key
  if ((await customRoles()).some(r => r.key === key)) return key
  throw bad('That role does not exist.')
}
const keyOf = p => p.role_key || ({ admin: 'super_admin' })[p.role] || p.role
const isSuper = p => (p.permissions ? cleanPermissions(p.permissions).staff?.includes('manage') : ['super_admin', 'admin'].includes(keyOf(p)))

router.get('/users', can('staff'), h(async (_req, res) => {
  const sb = await supabase()
  const { data, error } = await sb.from('profiles')
    .select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const custom = await customRoles()
  // Last sign-in comes from Supabase Auth; the list still loads without it.
  const seen = {}
  try { const { data: au } = await sb.auth.admin.listUsers({ perPage: 1000 }); for (const u of au?.users || []) seen[u.id] = u.last_sign_in_at || null } catch { /* optional */ }
  const nameOf = id => { const m = data.find(x => x.id === id); return m ? (m.name || m.email) : '' }
  res.json(data.map(p => ({ ...p, last_sign_in_at: seen[p.id] ?? null, reports_to_name: p.reports_to ? nameOf(p.reports_to) : '', role_key: keyOf(p), role_name: BUILT_IN_ROLES[keyOf(p)]?.name || custom.find(r => r.key === keyOf(p))?.name || keyOf(p), custom_permissions: Boolean(p.permissions) })))
}))

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Sign-in facts for one account from Supabase Auth. "Password set" is
// stamped by the set-password page (user_metadata.password_set_at); accounts
// from before that stamp existed count as set once they have signed in.
async function authDetails(sb, id) {
  const { data, error } = await sb.auth.admin.getUserById(id)
  if (error || !data?.user) return null
  const u = data.user
  const confirmed_at = u.email_confirmed_at || u.confirmed_at || null
  const password_set_at = u.user_metadata?.password_set_at || null
  return {
    invited_at: u.invited_at || null, confirmed_at, last_sign_in_at: u.last_sign_in_at || null, password_set_at,
    auth_created_at: u.created_at || null,
    invite: confirmed_at ? 'accepted' : 'pending',
    password: password_set_at ? 'set' : u.last_sign_in_at ? 'signed_in' : 'none',
  }
}

router.get('/users/:id', can('staff'), h(async (req, res) => {
  const { id } = req.params
  if (!UUID_RE.test(id)) throw bad('User not found.', 404)
  const sb = await supabase()
  const { data: p, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!p) throw bad('User not found.', 404)
  const [auth, activity] = await Promise.all([
    authDetails(sb, p.id),
    sb.from('audit_log').select('id, action, entity, entity_id, at').eq('actor_id', p.id).order('at', { ascending: false }).limit(20).then(r => r.data || []),
  ])
  const manager = p.reports_to ? (await sb.from('profiles').select('id,name,email,staff_id').eq('id', p.reports_to).maybeSingle()).data : null
  res.json({ ...p, role_key: keyOf(p), auth, activity, manager })
}))

// A fresh set-password link: the invitation again while it is still
// unaccepted, a one-time recovery link once the account is confirmed.
router.post('/users/:id/send-link', can('staff', 'edit'), h(async (req, res) => {
  const { id } = req.params
  if (!UUID_RE.test(id)) throw bad('User not found.', 404)
  const sb = await supabase()
  const { data: p } = await sb.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!p) throw bad('User not found.', 404)
  if (!p.active) throw bad('Activate the account first.')
  const redirectTo = `${process.env.ADMIN_URL || ''}/staff360/set-password`
  const r = await sendSetPasswordLink({ actor: req.user, profile: p, supabase: sb, redirectTo })
  await audit({ actor: req.user, action: r.kind, entity: 'user', entityId: p.id, after: { email: p.email, via: r.via, message_id: r.message?.id ?? null } })
  res.json({ kind: r.kind, via: r.via, message_id: r.message?.id ?? null, warning: r.warning })
}))

router.post('/users/invite', can('staff', 'create'), h(async (req, res) => {
  const { email, name = '' } = req.body || {}
  const position = String(req.body?.position || '').trim().slice(0, 80)
  if (!isEmail(email)) throw bad('Please enter a valid email address.')
  const role_key = await roleOr400(req.body?.role || 'editor')
  // Handing out anything but the plainest role is a permissions decision.
  if (role_key !== 'editor' || req.body?.permissions) demand(req, 'staff', 'manage')
  const permissions = req.body?.permissions ? cleanPermissions(req.body.permissions) : null
  const role = enumFor(role_key)

  const sb = await supabase()
  const redirectTo = `${process.env.ADMIN_URL || ''}/staff360/set-password`
  const { user, via, message, warning } = await inviteUser({ actor: req.user, email, name, role: BUILT_IN_ROLES[role_key]?.name || role_key, supabase: sb, redirectTo })

  // The auth trigger created an INACTIVE profile; this upsert activates it with the chosen role.
  const base = { id: user.id, email, name, role, active: true }
  const warnings = [warning]
  let row = { ...base, role_key, ...(permissions ? { permissions } : {}), ...(position ? { position } : {}) }
  let { error: pErr } = await sb.from('profiles').upsert(row, { onConflict: 'id' })
  if (pErr && /role_key|permissions/.test(pErr.message)) {   // migration 015 not applied yet: the old four roles still work
    if (!['admin', 'editor', 'sales', 'procurement'].includes(req.body?.role || 'editor')) { await sb.auth.admin.deleteUser(user.id).catch(() => {}); throw bad(ROLES_HINT, 409) }
    row = { ...base, role: req.body?.role || 'editor', ...(position ? { position } : {}) }
    ;({ error: pErr } = await sb.from('profiles').upsert(row, { onConflict: 'id' }))
  }
  if (pErr && position && /position/.test(pErr.message)) {   // migration 008 not applied yet: keep the invite, drop the position
    warnings.push('Position not saved: run server/migrations/008_positions.sql in the Supabase SQL editor.')
    const { position: _p, ...rest } = row
    ;({ error: pErr } = await sb.from('profiles').upsert(rest, { onConflict: 'id' }))
  }
  if (pErr) throw new Error(pErr.message)

  await audit({ actor: req.user, action: 'invite', entity: 'user', entityId: user.id, after: { email, name, role: role_key, ...(permissions ? { permissions } : {}), via } })
  const warn = warnings.filter(Boolean).join(' ')
  res.status(201).json({ id: user.id, email, name, role: row.role, role_key, active: true, position: warnings.length > 1 ? '' : position, via, message_id: message?.id ?? null, ...(warn ? { warning: warn } : {}) })
}))

router.patch('/users/:id', can('staff', 'edit'), h(async (req, res) => {
  const { id } = req.params
  const b = req.body || {}
  const patch = {}
  if (b.role !== undefined) { patch.role_key = await roleOr400(b.role); patch.role = enumFor(patch.role_key) }
  // `permissions`: this person's own set (replaces the role's); null hands them back to the role.
  if (b.permissions !== undefined) patch.permissions = b.permissions === null ? null : cleanPermissions(b.permissions)
  if (b.active !== undefined) patch.active = Boolean(b.active)
  if (b.name !== undefined) patch.name = String(b.name).trim().slice(0, 120)
  if (b.email !== undefined) {
    if (!isEmail(b.email)) throw bad('Please enter a valid email address.')
    patch.email = String(b.email).trim().toLowerCase()
  }
  if (b.position !== undefined) patch.position = String(b.position || '').trim().slice(0, 80)
  if (b.phone !== undefined) patch.phone = String(b.phone || '').trim().slice(0, 40)
  if (b.department !== undefined) patch.department = String(b.department || '').trim().slice(0, 80)
  // The Staff ID is given by the system and never changes: any value sent for it is ignored.
  if (b.reports_to !== undefined) {
    const to = b.reports_to || null
    if (to && !UUID_RE.test(to)) throw bad('Choose someone from the list.')
    if (to === id) throw bad('Nobody reports to themselves.')
    if (to) {
      const sbr = await supabase()
      // No loops: the chain above the new manager must not lead back to this person.
      let cur = to
      for (let i = 0; cur && i < 20; i++) {
        const { data: m } = await sbr.from('profiles').select('id,reports_to').eq('id', cur).maybeSingle()
        if (!m) throw bad('That person is not on the staff list.')
        if (m.reports_to === id) throw bad('That would make a loop: they already report to this person.')
        cur = m.reports_to
      }
    }
    patch.reports_to = to
  }
  if (!Object.keys(patch).length) throw bad('Nothing to update.')
  if (!UUID_RE.test(id)) throw bad('User not found.', 404)
  // Only someone who manages staff may change what a person can do.
  if (patch.role_key !== undefined || patch.permissions !== undefined) demand(req, 'staff', 'manage')

  const sb = await supabase()
  const { data: before } = await sb.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!before) throw bad('User not found.', 404)
  // Nobody below a Super Admin edits one.
  if (isSuper(before) && !hasUser(req.user, 'staff', 'manage')) throw bad('Only a Super Admin can change this account.', 403)

  // Lock-out guards: you cannot remove your own admin access, and the last
  // active Super Admin cannot be demoted or deactivated by anyone.
  const after_ = { ...before, ...patch }
  const losesAdmin = isSuper(before) && (!isSuper(after_) || patch.active === false)
  if (losesAdmin) {
    if (id === req.user.id) throw bad("You can't remove your own admin access.")
    const { data: rest } = await sb.from('profiles').select('*').eq('active', true).neq('id', id)
    if (!(rest || []).some(isSuper)) throw bad('This is the last active admin; promote someone else first.')
  }

  // Email and name live in Supabase Auth too (sign-in address, invite greeting).
  const emailChanged = patch.email !== undefined && patch.email !== before.email
  const nameChanged = patch.name !== undefined && patch.name !== before.name
  if (emailChanged || nameChanged) {
    const { error: aErr } = await sb.auth.admin.updateUserById(id, { ...(emailChanged ? { email: patch.email, email_confirm: true } : {}), ...(nameChanged ? { user_metadata: { name: patch.name } } : {}) })
    if (aErr) throw bad(/already|exists/i.test(aErr.message) ? 'That email already has an account.' : aErr.message)
  }
  let { data: after, error } = await sb.from('profiles').update(patch).eq('id', id).select().single()
  if (error && /role_key|permissions/.test(error.message)) {   // before migration 015: only the old four roles
    if (patch.permissions !== undefined || (b.role !== undefined && !['admin', 'editor', 'sales', 'procurement'].includes(b.role))) throw bad(ROLES_HINT, 409)
    const { role_key: _k, permissions: _p, ...old } = patch
    if (b.role !== undefined) old.role = b.role
    ;({ data: after, error } = await sb.from('profiles').update(old).eq('id', id).select().single())
  }
  if (error && /staff_id|phone|department|reports_to|avatar_url/.test(error.message)) throw bad('Staff profiles need the database migration 018: run server/migrations/018_staff_profiles.sql in the Supabase SQL editor first.', 409)
  if (error) throw /position/.test(error.message) ? bad('Positions need the database migration 008_positions.sql — run it in the Supabase SQL editor first.') : new Error(error.message)
  await audit({ actor: req.user, action: 'update', entity: 'user', entityId: id, before, after })
  // A change to what someone may do gets its own line in the log.
  if (patch.role_key !== undefined || patch.permissions !== undefined) {
    const sbp = async p => (p.permissions ? cleanPermissions(p.permissions) : BUILT_IN_ROLES[keyOf(p)]?.permissions || (await customRoles()).find(r => r.key === keyOf(p))?.permissions || {})
    await audit({ actor: req.user, action: 'permissions', entity: 'user', entityId: id, before: { role: keyOf(before), custom: Boolean(before.permissions) }, after: { staff: after.name || after.email, role: keyOf(after), custom: Boolean(after.permissions), ...diffPermissions(await sbp(before), await sbp(after)) } })
  }
  res.json({ ...after, role_key: keyOf(after) })
}))

/* roles: the built-in ones, and custom ones a Super Admin defines */
const roleKey = name => String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
router.get('/roles', can('staff'), h(async (_req, res) => {
  const sb = await supabase()
  const [custom, people] = await Promise.all([customRoles(), sb.from('profiles').select('*').then(r => r.data || [])])
  const count = key => people.filter(p => keyOf(p) === key).length
  res.json({
    modules: Object.entries(MODULES).map(([key, m]) => ({ key, ...m })), actions: ACTIONS.map(key => ({ key, label: ACTION_LABELS[key] })),
    roles: [
      ...Object.entries(BUILT_IN_ROLES).map(([key, r]) => ({ key, ...r, system: true, staff: count(key) })),
      ...custom.map(r => ({ key: r.key, name: r.name, description: r.description, permissions: cleanPermissions(r.permissions), system: false, staff: count(r.key), created_at: r.created_at })),
    ],
  })
}))
router.post('/roles', can('staff', 'manage'), h(async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60)
  if (!name) throw bad('Please name the role.')
  const key = roleKey(name)
  if (!key || BUILT_IN_ROLES[key] || (await customRoles()).some(r => r.key === key)) throw bad('A role with that name already exists.')
  const row = { key, name, description: String(req.body?.description || '').trim().slice(0, 300), permissions: cleanPermissions(req.body?.permissions), created_by: req.user.id }
  const { data, error } = await (await supabase()).from('staff_roles').insert(row).select().single()
  if (error) throw (noRolesTable(error) ? bad(ROLES_HINT, 409) : new Error(error.message))
  await audit({ actor: req.user, action: 'create', entity: 'role', entityId: key, after: { name, permissions: row.permissions } })
  res.status(201).json({ ...data, system: false, staff: 0 })
}))
router.patch('/roles/:key', can('staff', 'manage'), h(async (req, res) => {
  const key = req.params.key
  if (BUILT_IN_ROLES[key]) throw bad('Built-in roles cannot be changed. Copy it into a new role instead.')
  const before = (await customRoles()).find(r => r.key === key)
  if (!before) throw bad('role not found', 404)
  const patch = { updated_at: new Date().toISOString() }
  if (req.body?.name !== undefined) { patch.name = String(req.body.name).trim().slice(0, 60); if (!patch.name) throw bad('Please name the role.') }
  if (req.body?.description !== undefined) patch.description = String(req.body.description || '').trim().slice(0, 300)
  if (req.body?.permissions !== undefined) patch.permissions = cleanPermissions(req.body.permissions)
  const { data, error } = await (await supabase()).from('staff_roles').update(patch).eq('key', key).select().single()
  if (error) throw new Error(error.message)
  forgetRole(key)
  await audit({ actor: req.user, action: 'permissions', entity: 'role', entityId: key, before: { name: before.name }, after: { name: data.name, ...diffPermissions(cleanPermissions(before.permissions), cleanPermissions(data.permissions)) } })
  res.json({ ...data, system: false })
}))
router.delete('/roles/:key', can('staff', 'manage'), h(async (req, res) => {
  const key = req.params.key
  if (BUILT_IN_ROLES[key]) throw bad('Built-in roles cannot be deleted.')
  const sb = await supabase()
  const { count } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role_key', key)
  if (count) throw bad(`${count} staff member${count === 1 ? ' has' : 's have'} this role. Give them another role first.`)
  const { data: before } = await sb.from('staff_roles').select('*').eq('key', key).maybeSingle()
  if (!before) throw bad('role not found', 404)
  const { error } = await sb.from('staff_roles').delete().eq('key', key)
  if (error) throw new Error(error.message)
  forgetRole(key)
  await audit({ actor: req.user, action: 'delete', entity: 'role', entityId: key, before: { name: before.name, permissions: before.permissions } })
  res.json({ deleted: true, key })
}))

/* -------------------------------------------------------------- audit --- */

router.get('/audit', can('audit'), h(async (req, res) => {
  const sb = await supabase()
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  res.json(data)
}))

/* ------------------------------------------------------------ reviews --- */
// Same roles as the blog: content the public site shows.
const reviewsPerm = can('content')
router.get('/reviews', reviewsPerm, h(async (req, res) => res.json(await content.listReviews({ status: req.query.status || 'all' }))))
router.post('/reviews', reviewsPerm, h(async (req, res) => {
  const after = await exposing(content.createReview)(req.body || {}, { status: req.body?.status || 'approved', source: 'admin' })
  await audit({ actor: req.user, action: 'create', entity: 'review', entityId: after.id, after })
  res.status(201).json(after)
}))
router.patch('/reviews/:id', reviewsPerm, h(async (req, res) => {
  const before = await content.getReview(req.params.id)
  if (!before) throw bad('review not found', 404)
  const after = await exposing(content.updateReview)(before.id, req.body || {})
  await audit({ actor: req.user, action: before.status !== after.status ? after.status : 'update', entity: 'review', entityId: after.id, before, after })
  res.json(after)
}))
router.delete('/reviews/:id', reviewsPerm, h(async (req, res) => {
  const before = await content.getReview(req.params.id)
  if (!before) throw bad('review not found', 404)
  const r = await content.deleteReview(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'review', entityId: before.id, before })
  res.json(r)
}))

/* ------------------------------------------------------------- upload --- */
// Images arrive as base64 JSON (no multipart parser needed, works on Vercel).
// This route has its own larger body limit; app.js skips the global parser
// for it.

const MAX_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

router.post('/upload', express.json({ limit: '12mb' }), can('content'), h(async (req, res) => {
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

/* ------------------------------------------------------ staff profiles --- */
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
async function saveAvatar(targetId, body) {
  const { contentType, data } = body || {}
  if (!AVATAR_TYPES.has(contentType)) throw bad('Use a JPEG, PNG or WebP picture.')
  const buffer = Buffer.from(String(data || '').replace(/^data:[^;]+;base64,/, ''), 'base64')
  if (!buffer.length) throw bad('No picture received.')
  if (buffer.length > 4 * 1024 * 1024) throw bad('The picture must be under 4 MB.')
  const sb = await supabase()
  const path = `avatars/${targetId}-${Date.now()}.${contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'}`
  const { error } = await sb.storage.from('media').upload(path, buffer, { contentType, upsert: false })
  if (error) throw new Error(error.message)
  const url = sb.storage.from('media').getPublicUrl(path).data.publicUrl
  const { error: e2 } = await sb.from('profiles').update({ avatar_url: url }).eq('id', targetId)
  if (e2) throw /avatar_url/.test(e2.message) ? bad('Staff profiles need the database migration 018 first.', 409) : new Error(e2.message)
  return url
}
// Anyone signed in may change their own picture and phone number; the rest of the profile is staff management's.
// The people list a staff member may see: names for reporting lines and "reports to".
router.get('/directory', h(async (_req, res) => {
  const { data } = await (await supabase()).from('profiles').select('id,name,email,staff_id,avatar_url,department').eq('active', true).order('name')
  res.json(data || [])
}))
router.post('/me/avatar', express.json({ limit: '8mb' }), h(async (req, res) => {
  const url = await saveAvatar(req.user.id, req.body)
  await audit({ actor: req.user, action: 'update', entity: 'user', entityId: req.user.id, after: { avatar_url: url } })
  res.status(201).json({ url })
}))
router.patch('/me/profile', h(async (req, res) => {
  const patch = {}
  if (req.body?.phone !== undefined) patch.phone = String(req.body.phone || '').trim().slice(0, 40)
  if (req.body?.name !== undefined) { patch.name = String(req.body.name || '').trim().slice(0, 120); if (!patch.name) throw bad('Please enter your name.') }
  if (req.body?.avatar_url === '') patch.avatar_url = ''
  if (!Object.keys(patch).length) throw bad('Nothing to update.')
  const sb = await supabase()
  const { data, error } = await sb.from('profiles').update(patch).eq('id', req.user.id).select().single()
  if (error) throw /phone|avatar_url/.test(error.message) ? bad('Staff profiles need the database migration 018 first.', 409) : new Error(error.message)
  await audit({ actor: req.user, action: 'update', entity: 'user', entityId: req.user.id, after: patch })
  res.json({ name: data.name, phone: data.phone, avatar_url: data.avatar_url })
}))
router.post('/users/:id/avatar', express.json({ limit: '8mb' }), can('staff', 'edit'), h(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) throw bad('User not found.', 404)
  const url = await saveAvatar(req.params.id, req.body)
  await audit({ actor: req.user, action: 'update', entity: 'user', entityId: req.params.id, after: { avatar_url: url } })
  res.status(201).json({ url })
}))

/* ================================================ PHASE 2: CRM + INBOX ==== */

const crm   = can('clients')
const inbox = can('invoices')
const enq   = can('enquiries')
const ship  = can('shipments')

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
  const after = await submitted(req, 'client', await exposing(content.createClient)(req.body, req.user.id))
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
router.get('/enquiries', enq, h(async (req, res) => {
  res.json(await content.listEnquiries({ kind: req.query.kind || 'all', status: req.query.status || 'all', limit: 500 }))
}))

router.get('/enquiries/:id', enq, h(async (req, res) => {
  const e = await content.getEnquiry(req.params.id)
  if (!e) throw bad('enquiry not found', 404)
  res.json(e)
}))

// Send the "Quote request received" confirmation again (or for the first time, if it was off).
router.post('/enquiries/:id/acknowledge', enq, h(async (req, res) => {
  const e = await content.getEnquiry(req.params.id)
  if (!e) throw bad('enquiry not found', 404)
  const settings = await content.getSettings()
  const msg = await acknowledgeEnquiry(e, { settings: { ...settings, email: { ...settings.email, ack_enquiries: true } } })
  if (!msg) throw bad('The confirmation could not be sent. Check Settings → Email.', 502)
  await audit({ actor: req.user, action: 'acknowledge', entity: 'enquiry', entityId: e.id, after: { to: e.email, message_id: msg.id } })
  res.json(msg)
}))
router.patch('/enquiries/:id', enq, h(async (req, res) => {
  const before = await content.getEnquiry(req.params.id)
  if (!before) throw bad('enquiry not found', 404)
  const after = await exposing(content.updateEnquiry)(req.params.id, req.body)
  await audit({ actor: req.user, action: 'update', entity: 'enquiry', entityId: after.id, before, after })
  res.json(after)
}))

/* ============== PHASE 3: SETTINGS, DOCUMENTS, QUOTES, EMAIL, PURCHASES ==== */

const mail = can('messages')
const settingsAdmin = can('settings', 'edit')
const idOrNull = v => (v == null || v === '' ? null : Number(v))
const SECRET_NAMES = { resend_api_key: /^re_[A-Za-z0-9_]{10,}$/, resend_webhook_secret: /^whsec_[A-Za-z0-9+/=_-]{16,}$/ }

/** Settings as the panel may see them: no token hash, no secret values. */
function safeSettings(s) {
  const { mcp, ...rest } = s
  return { ...rest, mcp: { enabled: mcp.enabled, token_hint: mcp.token_hint, rotated_at: mcp.rotated_at } }
}

router.get('/settings', h(async (req, res) => {
  const s = await content.getSettings()
  const { source } = await resolveResendKey()
  const { source: whSource } = await resolveWebhookSecret()
  const out = { ...safeSettings(s), email: { ...s.email, configured: Boolean(source), source, dry_run: dryRun(), inbound_configured: Boolean(whSource), inbound_source: whSource, webhook_url: `${publicUrl()}/api/webhooks/resend` }, public_url: publicUrl() }
  if (hasUser(req.user, 'settings', 'edit')) {
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
// Public-page content: editable in place on the site by staff with the 'frontpages' permission (admin, editor).
const frontpages = can('content', 'edit')
router.get('/settings/gallery', can('content', 'view'), h(async (_req, res) => res.json({ items: await content.getGallery() })))
router.put('/settings/gallery', frontpages, h(async (req, res) => { const items = await exposing(content.setGallery)(req.body?.items); await audit({ actor: req.user, action: 'update', entity: 'gallery', entityId: null, after: { count: items.length } }); res.json({ items }) }))
router.get('/settings/faq', can('content', 'view'), h(async (_req, res) => res.json({ items: await content.getFaq() })))
router.put('/settings/faq', frontpages, h(async (req, res) => { const items = await exposing(content.setFaq)(req.body?.items); await audit({ actor: req.user, action: 'update', entity: 'faq', entityId: null, after: { count: items.length } }); res.json({ items }) }))
router.get('/settings/hero', can('content', 'view'), h(async (_req, res) => res.json({ hero: await content.getHero() })))
router.put('/settings/hero', frontpages, h(async (req, res) => { const hero = await exposing(content.setHero)(req.body); await audit({ actor: req.user, action: 'update', entity: 'hero', entityId: null, after: hero }); res.json({ hero }) }))
router.get('/settings/why', can('content', 'view'), h(async (_req, res) => res.json({ items: await content.getWhy() })))
router.put('/settings/why', frontpages, h(async (req, res) => { const items = await exposing(content.setWhy)(req.body?.items); await audit({ actor: req.user, action: 'update', entity: 'why', entityId: null, after: { count: items.length } }); res.json({ items }) }))
router.get('/settings/sustainability', can('content', 'view'), h(async (_req, res) => res.json({ items: await content.getSustainability(), colors: content.POLICY_COLORS })))
router.put('/settings/sustainability', frontpages, h(async (req, res) => { const items = await exposing(content.setSustainability)(req.body?.items); await audit({ actor: req.user, action: 'update', entity: 'sustainability', entityId: null, after: { count: items.length } }); res.json({ items, colors: content.POLICY_COLORS }) }))
router.get('/settings/services', can('content', 'view'), h(async (_req, res) => res.json({ items: await content.getServices(), icons: content.STAT_ICON_NAMES })))
router.put('/settings/services', frontpages, h(async (req, res) => { const items = await exposing(content.setServices)(req.body?.items); await audit({ actor: req.user, action: 'update', entity: 'services', entityId: null, after: { count: items.length } }); res.json({ items, icons: content.STAT_ICON_NAMES }) }))
// Homepage stat tiles (Settings → Site).
router.get('/settings/stats', can('content', 'view'), h(async (_req, res) => res.json({ stats: await content.getHomepageStats(), icons: content.STAT_ICON_NAMES })))
router.put('/settings/stats', frontpages, h(async (req, res) => {
  const stats = await exposing(content.setHomepageStats)(req.body?.stats)
  await audit({ actor: req.user, action: 'update', entity: 'homepage_stats', entityId: null, after: { stats } })
  res.json({ stats, icons: content.STAT_ICON_NAMES })
}))
router.get('/settings/about', can('content', 'view'), h(async (_req, res) => res.json({ profile: await content.getCompanyProfile(), icons: content.STAT_ICON_NAMES })))
router.put('/settings/about', frontpages, h(async (req, res) => {
  const profile = await exposing(content.setCompanyProfile)(req.body || {})
  await audit({ actor: req.user, action: 'update', entity: 'company_profile', entityId: null, after: { registrations: profile.registrations.length, values: profile.values.length, industries: profile.industries.length } })
  res.json({ profile, icons: content.STAT_ICON_NAMES })
}))
router.get('/settings/markets', can('content', 'view'), h(async (_req, res) => res.json(await content.getHomepageMarkets())))
router.put('/settings/markets', frontpages, h(async (req, res) => {
  const value = await exposing(content.setHomepageMarkets)(req.body || {})
  await audit({ actor: req.user, action: 'update', entity: 'homepage_markets', entityId: null, after: value })
  res.json(value)
}))
// Departments: extra sender identities (name + address, optional reply-to and signature).
router.get('/settings/departments', settingsAdmin, h(async (_req, res) => res.json(await content.listDepartments())))
router.put('/settings/departments', settingsAdmin, h(async (req, res) => {
  const list = await exposing(content.setDepartments)(req.body?.departments)
  await audit({ actor: req.user, action: 'update', entity: 'departments', entityId: null, after: { departments: list.map(d => d.email) } })
  res.json(list)
}))
router.put('/settings/secrets/:name', settingsAdmin, h(async (req, res) => {
  const { name } = req.params
  if (!SECRET_NAMES[name]) throw bad('Unknown secret.', 404)
  const value = String(req.body?.value || '').trim()
  if (!value) throw bad('Enter a value.')
  if (!SECRET_NAMES[name].test(value)) throw bad(name === 'resend_api_key' ? 'That does not look like a Resend API key (they start with re_).' : 'That does not look like a Resend webhook signing secret (they start with whsec_).')
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

/* documents: metadata here, bytes straight to storage via signed URLs.
   A file that hangs off a supplier, a bid or a purchase order belongs to
   procurement; every other file belongs to sales. Each side sees its own. */
// Which module a file belongs to; a staff member needs that module's permission for it.
const docModule = d => (d?.investor_id != null || d?.opportunity_id != null || d?.investment_id != null ? 'investments'
  : d?.po_shipment_id != null ? 'shipments'
  : d?.po_id != null && d?.supplier_id == null && d?.bid_id == null ? 'purchase_orders'
  : d?.supplier_id != null || d?.bid_id != null || d?.po_id != null ? 'suppliers'
  : d?.payment_id != null ? 'payments' : 'clients')
const scopeModule = o => docModule(Object.fromEntries(['investor_id', 'opportunity_id', 'investment_id', 'po_shipment_id', 'po_id', 'supplier_id', 'bid_id', 'payment_id'].map(k => [k, o?.[k] != null && o[k] !== '' ? o[k] : null])))
const isProcDoc = d => ['suppliers', 'purchase_orders', 'shipments'].includes(docModule(d))
const procScope = o => ['suppliers', 'purchase_orders', 'shipments'].includes(scopeModule(o))
const anyDocs = (_req, _res, next) => next()   // the handlers check the file's own module
// Files of a bid or an order are also open to whoever works on bidding or orders.
const DOC_ALSO = { suppliers: ['bidding', 'purchase_orders'], purchase_orders: ['suppliers'], shipments: ['purchase_orders', 'suppliers'], payments: ['clients'], clients: ['invoices', 'payments'] }
const docGate = (req, module, action = 'view') => {
  if ([module, ...(DOC_ALSO[module] || [])].some(m => hasUser(req.user, m, action) || (action !== 'view' && m !== module && hasUser(req.user, m, 'edit')))) return
  throw bad(`You don't have permission for this (${MODULES[module].label}: ${action}).`, 403)
}
router.get('/documents', anyDocs, h(async (req, res) => {
  const module = scopeModule(req.query); docGate(req, module)
  const q = req.query
  const docs = await content.listDocuments({ client_id: idOrNull(q.client_id), quote_id: idOrNull(q.quote_id), supplier_id: idOrNull(q.supplier_id), bid_id: idOrNull(q.bid_id), po_id: idOrNull(q.po_id), po_shipment_id: idOrNull(q.po_shipment_id), investor_id: idOrNull(q.investor_id), opportunity_id: idOrNull(q.opportunity_id) })
  const side = m => (['suppliers', 'purchase_orders', 'shipments'].includes(m) ? 'p' : m === 'investments' ? 'i' : 's')
  res.json(docs.filter(d => side(docModule(d)) === side(module)))
}))
router.post('/documents', anyDocs, h(async (req, res) => {
  docGate(req, scopeModule(req.body), 'create')
  res.status(201).json(await exposing(content.createDocument)(req.body || {}, req.user.id))
}))
const docFor = async (req, { any = false, action = 'view' } = {}) => {
  const d = await content.getDocument(req.params.id, { any })
  if (!d) throw bad('document not found', 404)
  docGate(req, docModule(d), action); return d
}
router.post('/documents/:id/complete', anyDocs, h(async (req, res) => {
  await docFor(req, { any: true, action: 'create' })
  const doc = await exposing(content.completeDocument)(req.params.id)
  await audit({ actor: req.user, action: 'upload', entity: 'document', entityId: doc.id, after: { name: doc.name, bytes: doc.bytes, client_id: doc.client_id, quote_id: doc.quote_id, ...(docModule(doc) !== 'clients' ? { supplier_id: doc.supplier_id, bid_id: doc.bid_id, po_id: doc.po_id, module: docModule(doc) } : {}) } })
  res.json(doc)
}))
router.get('/documents/:id/url', anyDocs, h(async (req, res) => {
  await docFor(req)
  res.json(await exposing(content.documentUrl)(req.params.id, { download: req.query.download === '1' }))
}))
// The label says what a file is (Terms and conditions, Fact sheet …); only the label can change.
router.patch('/documents/:id', anyDocs, h(async (req, res) => {
  const before = await docFor(req, { any: true, action: 'edit' })
  const after = await content.setDocumentLabel(before.id, req.body?.label)
  await audit({ actor: req.user, action: 'update', entity: 'document', entityId: before.id, before: { label: before.label }, after: { label: after.label } })
  res.json(after)
}))
router.delete('/documents/:id', anyDocs, h(async (req, res) => {
  const before = await docFor(req, { any: true, action: 'delete' })
  const r = await content.deleteDocument(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'document', entityId: before.id, before })
  res.json(r)
}))

router.get('/quotes', inbox, h(async (req, res) => {
  const list = await content.listQuotes({ status: req.query.status || 'all', client_id: idOrNull(req.query.client_id) })
  res.json(maySeeAmounts(req) ? list : list.map(q => withAmounts(req, q)))
}))
router.get('/quotes/:id', inbox, h(async (req, res) => {
  const q = await content.getQuote(req.params.id)
  if (!q) throw bad('quote not found', 404)
  const [messages, documents, shipments] = await Promise.all([content.listMessages({ quote_id: q.id }), content.listDocuments({ quote_id: q.id }),
    content.listShipments(q.id).catch(e => ({ items: [], lines: [], shipped: 0, remaining: 100, can_create: false, hint: e.expose ? e.message : 'Shipments are unavailable right now.' }))])
  const approval = await content.getApproval('quote', q.id).catch(() => null)
  const amendments = await content.listAmendments({ entity: 'quote', entity_id: q.id }).catch(() => [])
  res.json({ ...withAmounts(req, q), approval: approval?.approval || 'approved', approval_note: approval?.approval_note || '', submitted_by: approval?.submitted_by || null, amendments, messages, documents, shipments, link: quoteLink(q) })
}))
router.post('/quotes', inbox, h(async (req, res) => {
  const after = await submitted(req, 'quote', await exposing(content.createQuote)(req.body || {}, req.user.id))
  await audit({ actor: req.user, action: 'create', entity: 'quote', entityId: after.id, after })
  res.status(201).json({ ...after, link: quoteLink(after) })
}))
router.patch('/quotes/:id', inbox, h(async (req, res) => {
  const before = await content.getQuote(req.params.id)
  if (!before) throw bad('quote not found', 404)
  const { reason, ...patch } = req.body || {}
  const r = await exposing(amend)(req, { type: 'quote', before, patch, reason, update: content.updateQuote, guard: (b, p) => { if (b.status === 'accepted' && ['items', 'discount', 'tax_rate', 'currency'].some(k => p[k] !== undefined)) throw new Error('this quote was accepted by the client; prices are locked. Create a new quote instead.') } })
  await audit({ actor: req.user, action: r.amendment ? 'amend_request' : r.direct ? 'amend' : 'update', entity: 'quote', entityId: before.id, before, after: r.amendment ? { proposed: r.amendment.proposed } : r.record })
  res.status(r.amendment ? 202 : 200).json({ ...r.record, link: quoteLink(r.record), ...(r.amendment ? { amendment: r.amendment } : {}) })
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
  if (!maySeeAmounts(req)) throw bad('Your role does not show invoice amounts.', 403)
  const [settings, fields] = await Promise.all([content.getSettings(), content.listQuoteFields()])
  const pdf = await renderQuotePdf(q, settings, fields, quoteLink(q))
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${q.number}.pdf"`)
  res.send(pdf)
}))
// Anyone who may create invoices can send an approved one; an unapproved invoice cannot go out.
router.post('/quotes/:id/send', h(async (req, res) => {
  if (!hasUser(req.user, 'invoices', 'create') && !hasUser(req.user, 'invoices', 'approve')) throw bad("You don't have permission for this (Invoices: create).", 403)
  await requireApproved('quote', req.params.id)
  const b = req.body || {}
  const r = await sendQuote(req.params.id, { actor: req.user, to: b.to, subject: b.subject, body: b.body, attachmentIds: b.attachment_ids || [], fromId: b.from_id || null })
  res.json({ ...r, link: quoteLink(r.quote) })
}))
router.post('/quotes/:id/convert', crm, h(async (req, res) => {
  const after = await exposing(content.convertQuoteToPurchase)(req.params.id, req.user.id)
  await audit({ actor: req.user, action: 'create', entity: 'purchase', entityId: after.id, after })
  res.status(201).json(after)
}))

/* shipments: an invoice can leave on several trucks, each a share of it */
router.get('/quotes/:id/shipments', ship, h(async (req, res) => {
  const q = await content.getQuote(req.params.id)
  if (!q) throw bad('quote not found', 404)
  res.json(await content.listShipments(q.id))
}))
router.post('/quotes/:id/shipments', ship, h(async (req, res) => {
  const q = await content.getQuote(req.params.id)
  if (!q) throw bad('quote not found', 404)
  const after = await exposing(content.createShipment)(q.id, req.body || {}, req.user.id)
  await audit({ actor: req.user, action: 'create', entity: 'shipment', entityId: after.id, after: { quote: q.number, number: after.number, percent: after.percent, items: after.items, mode: after.mode, origin: after.origin?.name, destination: after.destination?.name } })
  res.status(201).json(after)
}))
router.get('/shipments/:sid', ship, h(async (req, res) => {
  const s = await content.getShipment(req.params.sid)
  if (!s) throw bad('shipment not found', 404)
  res.json(s)
}))
router.patch('/shipments/:sid', ship, h(async (req, res) => {
  const before = await content.getShipment(req.params.sid)
  if (!before) throw bad('shipment not found', 404)
  const after = await exposing(content.updateShipment)(before.id, req.body || {}, req.user.id)
  await audit({ actor: req.user, action: 'update', entity: 'shipment', entityId: after.id, before: { status: before.status, percent: before.percent }, after: { status: after.status, percent: after.percent } })
  res.json(after)
}))
router.delete('/shipments/:sid', ship, h(async (req, res) => {
  const before = await content.getShipment(req.params.sid)
  if (!before) throw bad('shipment not found', 404)
  const r = await content.deleteShipment(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'shipment', entityId: before.id, before: { number: before.number, percent: before.percent } })
  res.json(r)
}))
router.post('/shipments/:sid/checkpoints', ship, h(async (req, res) => {
  const after = await exposing(content.addCheckpoint)(req.params.sid, req.body || {}, req.user.id)
  const c = after.checkpoints[after.checkpoints.length - 1]
  // The client sees the new position under Notifications in their portal.
  if (after.quote?.id) { const q = await content.getQuote(after.quote.id); if (q?.client_id) await content.notify('client', q.client_id, { title: `Shipment ${after.number} of ${q.number} is now at ${c?.name || 'a new location'}`, body: c?.note || '', link: `/q/${q.token}` }) }
  await audit({ actor: req.user, action: 'update', entity: 'shipment', entityId: after.id, after: { location: c?.name, status: after.status } })
  res.status(201).json(after)
}))
router.patch('/shipments/:sid/checkpoints/:cid', ship, h(async (req, res) => {
  const after = await exposing(content.updateCheckpoint)(req.params.sid, req.params.cid, req.body || {})
  const c = after.checkpoints.find(x => x.id === Number(req.params.cid))
  await audit({ actor: req.user, action: 'update', entity: 'shipment', entityId: after.id, after: { checkpoint: c?.id, location: c?.name, at: c?.at } })
  res.json(after)
}))
router.delete('/shipments/:sid/checkpoints/:cid', ship, h(async (req, res) => {
  const after = await exposing(content.deleteCheckpoint)(req.params.sid, req.params.cid)
  await audit({ actor: req.user, action: 'update', entity: 'shipment', entityId: after.id, after: { removed_checkpoint: Number(req.params.cid) } })
  res.json(after)
}))

/* messages (one-to-one email). Sales and procurement each have their own
   inbox: the same handlers are mounted twice, and a message is only ever
   reachable through the side it belongs to. */
const procurementOnly = can('supplier_messages')
function mountMessages(prefix, guard, scope) {
  const procurement = scope === 'procurement'
  const own = async id => {
    const m = await content.getMessage(id)
    if (!m || (m.scope || 'sales') !== scope) throw bad('message not found', 404)
    return m
  }
  router.get(prefix, guard, h(async (req, res) => {
    res.json(await content.listMessages({
      client_id: idOrNull(req.query.client_id), quote_id: idOrNull(req.query.quote_id), enquiry_id: idOrNull(req.query.enquiry_id),
      ...(procurement ? { scope, supplier_id: idOrNull(req.query.supplier_id), bid_id: idOrNull(req.query.bid_id), po_id: idOrNull(req.query.po_id) } : ((await content.hasScopeColumn()) ? { scope } : {})),
      direction: req.query.direction || 'all', unread: req.query.unread === '1', q: req.query.q || '', limit: Math.min(Number(req.query.limit) || 200, 500),
    }))
  }))
  router.get(`${prefix}/threads`, guard, h(async (req, res) => {
    res.json(await content.listThreads({ q: req.query.q || '', unread: req.query.unread === '1', label: req.query.label || '', client_id: procurement ? null : idOrNull(req.query.client_id), supplier_id: procurement ? idOrNull(req.query.supplier_id) : null, scope }))
  }))
  // Sender identities for the composer: the default From plus the departments from Settings.
  router.get(`${prefix}/senders`, guard, h(async (_req, res) => {
    const list = await content.listDepartments()
    if (!procurement) return res.json(list)
    // Procurement writes from its own department first, when one is chosen under Settings → Procurement.
    const first = (await content.getSettings()).procurement?.from_id
    res.json(first ? [...list.filter(d => d.id === first), ...list.filter(d => d.id !== first)] : list)
  }))
  router.get(`${prefix}/labels`, guard, h(async (_req, res) => {
    res.json({ labels: await content.getLabelCatalogue(), colors: content.LABEL_COLORS })
  }))
  router.put(`${prefix}/labels`, guard, h(async (req, res) => {
    const labels = await exposing(content.setLabelCatalogue)(req.body?.labels)
    await audit({ actor: req.user, action: 'update', entity: 'labels', entityId: null, after: { labels } })
    res.json({ labels, colors: content.LABEL_COLORS })
  }))
  router.put(`${prefix}/thread/label`, guard, h(async (req, res) => {
    const label = await exposing(content.setThreadLabel)(req.body?.key, req.body?.label, req.user, req.body?.color)
    await audit({ actor: req.user, action: 'label', entity: 'thread', entityId: req.body?.key, after: { label: label?.name ?? null } })
    res.json({ key: req.body?.key, label })
  }))
  router.get(`${prefix}/thread`, guard, h(async (req, res) => {
    const rows = await content.getThread(req.query.key, { scope })
    if (!rows) throw bad('conversation not found', 404)
    res.json(rows)
  }))
  router.post(`${prefix}/thread/read`, guard, h(async (req, res) => {
    res.json({ read: await content.markThreadRead(req.body?.key, { scope }) })
  }))
  router.post(`${prefix}/:id/read`, guard, h(async (req, res) => {
    const m = await own(req.params.id)
    res.json(await content.markMessageRead(m.id, req.body?.read !== false))
  }))
  router.get(`${prefix}/:id`, guard, h(async (req, res) => res.json(await own(req.params.id))))
  router.post(prefix, guard, h(async (req, res) => {
    const b = req.body || {}
    let clientId = procurement ? null : idOrNull(b.client_id), enquiryId = procurement ? null : idOrNull(b.enquiry_id), toName = b.to_name
    let supplierId = procurement ? idOrNull(b.supplier_id) : null, bidId = procurement ? idOrNull(b.bid_id) : null, poId = procurement ? idOrNull(b.po_id) : null
    if (clientId != null) { const c = await content.getClient(clientId); if (!c) throw bad('client not found', 404); toName ??= c.name }
    if (enquiryId != null) { const e = await content.getEnquiry(enquiryId); if (!e) throw bad('enquiry not found', 404); toName ??= e.name; clientId ??= e.client_id }
    if (poId != null) { const o = await content.getPurchaseOrder(poId); if (!o) throw bad('order not found', 404); supplierId ??= o.supplier_id; bidId ??= o.bid_id; toName ??= o.supplier_name }
    if (bidId != null) { const x = await content.getBid(bidId); if (!x) throw bad('bid not found', 404); supplierId ??= x.supplier_id; toName ??= x.contact_person || x.company_name }
    if (supplierId != null) { const x = await content.getSupplier(supplierId); if (!x) throw bad('supplier not found', 404); toName ??= x.contact_person || x.company_name }
    // A reply: address, subject and links default to the message being answered, and it threads under it.
    let inReplyTo = null, to = b.to, subject = b.subject, quoteId = null
    if (b.reply_to_id != null) {
      inReplyTo = await own(b.reply_to_id).catch(() => { throw bad('message to reply to not found', 404) })
      const theirs = inReplyTo.direction === 'in'
      to ||= theirs ? inReplyTo.from_email : inReplyTo.to_email
      toName ??= theirs ? inReplyTo.from_name : inReplyTo.to_name
      if (!subject) subject = /^re:/i.test(inReplyTo.subject || '') ? inReplyTo.subject : `Re: ${inReplyTo.subject || ''}`.trim()
      if (procurement) { supplierId ??= inReplyTo.supplier_id ?? null; bidId ??= inReplyTo.bid_id ?? null; poId ??= inReplyTo.po_id ?? null }
      else { clientId ??= inReplyTo.client_id; enquiryId ??= inReplyTo.enquiry_id; quoteId = inReplyTo.quote_id ?? null }
    }
    // No supplier named: a known supplier address files the email under their record.
    if (procurement && supplierId == null && to) { const x = await content.findSupplierByEmail(to); if (x) { supplierId = x.id; toName ??= x.contact_person || x.company_name } }
    const msg = await deliver({ actor: req.user, to, toName, subject, body: b.body, attachmentIds: b.attachment_ids || [], clientId, enquiryId, quoteId, inReplyTo, fromId: b.from_id || null, signOff: true, scope, supplierId, bidId, poId })
    res.status(201).json({ ...msg, thread_key: content.threadKeyOf(msg) })
  }))
}
mountMessages('/messages', mail, 'sales')
mountMessages('/procurement/messages', procurementOnly, 'procurement')

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

/* email templates: everyone who can email may render them; admins edit them */
const templatePublic = t => ({ key: t.key, name: t.name, description: t.description, subject: t.subject, body: t.body, cta_label: t.cta_label, variables: t.variables, enabled: t.enabled, updated_at: t.updated_at ?? null, is_default: !t.updated_at })

router.get('/templates', mail, h(async (_req, res) => {
  res.json(await Promise.all(TEMPLATE_KEYS.map(async k => templatePublic(await templateFor(k)))))
}))
router.get('/templates/:key', mail, h(async (req, res) => res.json(templatePublic(await templateFor(req.params.key)))))

// Rendered subject/body for the composer, from the records it concerns.
router.get('/templates/:key/render', mail, h(async (req, res) => {
  const ctx = { actor: req.user }
  if (req.query.quote_id) { ctx.quote = await content.getQuote(req.query.quote_id); if (!ctx.quote) throw bad('quote not found', 404); ctx.link = quoteLink(ctx.quote) }
  if (req.query.enquiry_id) { ctx.enquiry = await content.getEnquiry(req.query.enquiry_id); if (!ctx.enquiry) throw bad('enquiry not found', 404) }
  if (req.query.client_id) { ctx.client = await content.getClient(req.query.client_id); if (!ctx.client) throw bad('client not found', 404) }
  const { subject, body, cta } = await renderKey(req.params.key, ctx)
  res.json({ subject, body, cta })
}))

// Preview of an edit in progress, with sample data, as the email would look.
router.post('/templates/:key/preview', settingsAdmin, h(async (req, res) => {
  const t = await templateFor(req.params.key)
  const settings = await content.getSettings()
  const vars = { ...SAMPLE_VARS[t.key], company_name: settings.company.name, site_name: settings.site.name, sender_name: req.user.name || settings.company.name }
  const subject = renderTemplate(req.body?.subject ?? t.subject, vars)
  const body = renderTemplate(req.body?.body ?? t.body, vars)
  const label = renderTemplate(req.body?.cta_label ?? t.cta_label, vars)
  const html = renderEmailHtml({ body, signature: settings.email.signature, company: settings.company, cta: label && vars.link ? { label, url: vars.link } : null })
  res.json({ subject, body, html })
}))

router.put('/templates/:key', settingsAdmin, h(async (req, res) => {
  const key = req.params.key
  if (!TEMPLATE_KEYS.includes(key)) throw bad('unknown template', 404)
  const before = await templateFor(key)
  const b = req.body || {}
  if (b.subject !== undefined && !String(b.subject).trim() && !['blank', 'supplier_blank'].includes(key)) throw bad('Subject cannot be empty.')
  if (b.body !== undefined && !String(b.body).trim()) throw bad('Body cannot be empty.')
  // Row may not exist yet (fresh install): upsert the merged result.
  const merged = { key, name: before.name, description: b.description ?? before.description, subject: b.subject ?? before.subject, body: b.body ?? before.body, cta_label: b.cta_label ?? before.cta_label, enabled: b.enabled ?? before.enabled, variables: before.variables }
  if (String(merged.body).length > 20000) throw bad('Body is too long.')
  const after = await content.upsertTemplate(merged)
  await audit({ actor: req.user, action: 'update', entity: 'email_template', entityId: key, before: templatePublic(before), after: templatePublic(after) })
  res.json(templatePublic(after))
}))

router.post('/templates/:key/reset', settingsAdmin, h(async (req, res) => {
  const key = req.params.key
  if (!DEFAULT_TEMPLATES[key]) throw bad('unknown template', 404)
  const before = await templateFor(key)
  const d = DEFAULT_TEMPLATES[key]
  const after = await content.upsertTemplate({ key, name: d.name, description: d.description, subject: d.subject, body: d.body, cta_label: d.cta_label, variables: d.variables, enabled: true })
  await audit({ actor: req.user, action: 'reset', entity: 'email_template', entityId: key, before: templatePublic(before), after: templatePublic(after) })
  res.json(templatePublic(after))
}))

/* procurement: suppliers, bidding opportunities, bids, purchase orders */
router.use(procurementRoutes)
/* payments, investments, supplier deliveries, reports */
router.use(portalAdminRoutes)
router.use(inventoryRoutes)
router.use(approvalRoutes)

export default router
