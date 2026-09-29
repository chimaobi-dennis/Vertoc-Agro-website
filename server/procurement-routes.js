/*
 * /api/admin/* — the procurement half of the panel: suppliers, bidding
 * opportunities (tenders), bids, requests for information, and purchase
 * orders (PO / LPO). Mounted inside the admin router, so every route is
 * already behind authenticate(); all of them need the `procurement`
 * permission. Every mutation writes an audit row.
 *
 * Procurement conversations (/procurement/messages/*) share their handlers
 * with sales and are mounted in admin-routes.js.
 */
import { Router } from 'express'
import { requireRole, PERMISSIONS } from './auth.js'
import { audit } from './audit.js'
import * as content from './content.js'
import { bad, handler, idOrNull } from './http.js'
import { notifyBidStatus, sendBidRequest, sendPurchaseOrder, sendSupplierLink, messageBidders, orderLink, tenderLink, publicUrl } from './messaging.js'
import { renderKey, PROCUREMENT_TEMPLATES } from './templates.js'
import { renderPurchaseOrderPdf } from './quote-pdf.js'

const router = Router()
const h = handler('procurement')
const proc = requireRole(...PERMISSIONS.procurement)
let svc = null
const supabase = () => svc ??= import('./store/supabase.js').then(m => m.supabase)

/* ---------------------------------------------------------- suppliers --- */
router.get('/suppliers', proc, h(async (req, res) => {
  res.json(await content.listSuppliers({ status: req.query.status || 'active', q: req.query.q || '' }))
}))
router.get('/suppliers/:id', proc, h(async (req, res) => {
  const s = await content.getSupplier(req.params.id)
  if (!s) throw bad('supplier not found', 404)
  const [bids, orders] = await Promise.all([content.listBids({ supplier_id: s.id }), content.listPurchaseOrders({ supplier_id: s.id })])
  // Sign-in facts for a supplier with an account.
  let account = null
  if (s.user_id) {
    const { data } = await (await supabase()).auth.admin.getUserById(s.user_id)
    const u = data?.user
    account = u ? { email: u.email, created_at: u.created_at, confirmed_at: u.email_confirmed_at || u.confirmed_at || null, last_sign_in_at: u.last_sign_in_at || null } : null
  }
  res.json({ ...s, bids, orders, account })
}))
router.post('/suppliers', proc, h(async (req, res) => {
  const after = await content.createSupplier(req.body || {}, { source: 'admin', actorId: req.user.id })
  await audit({ actor: req.user, action: 'create', entity: 'supplier', entityId: after.id, after })
  res.status(201).json(after)
}))
router.patch('/suppliers/:id', proc, h(async (req, res) => {
  const before = await content.getSupplier(req.params.id)
  if (!before) throw bad('supplier not found', 404)
  const after = await content.updateSupplier(before.id, req.body || {})
  await audit({ actor: req.user, action: 'update', entity: 'supplier', entityId: after.id, before, after })
  res.json(after)
}))
router.delete('/suppliers/:id', proc, h(async (req, res) => {
  const before = await content.getSupplier(req.params.id)
  if (!before) throw bad('supplier not found', 404)
  const r = await content.deleteSupplier(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'supplier', entityId: before.id, before })
  res.json(r)
}))
// A fresh link for the supplier's account: confirm the address if they never did, else choose a new password.
router.post('/suppliers/:id/send-link', proc, h(async (req, res) => {
  const s = await content.getSupplier(req.params.id)
  if (!s) throw bad('supplier not found', 404)
  if (!s.user_id) throw bad('This supplier has not opened an account yet.')
  const kind = s.verified_at ? 'reset' : 'verify'
  const token = await content.issueSupplierToken(s.id, kind, kind === 'reset' ? 2 : 24)
  const message = await sendSupplierLink({ supplier: s, kind, token })
  await audit({ actor: req.user, action: kind === 'reset' ? 'password_link' : 'reinvite', entity: 'supplier', entityId: s.id, after: { email: s.email, message_id: message.id } })
  res.json({ kind, message_id: message.id })
}))

/* ------------------------------------------------------------ tenders --- */
const bidFilters = q => ({
  status: q.status || 'all', q: q.q || '', min_price: q.min_price, max_price: q.max_price, min_quantity: q.min_quantity, max_quantity: q.max_quantity,
  location: q.location || '', accepts_terms: q.accepts_terms ?? null, sort: q.sort || 'date', dir: q.dir || null,
})
router.get('/tenders', proc, h(async (req, res) => {
  res.json(await content.listTenders({ status: req.query.status || 'all', q: req.query.q || '' }))
}))
router.get('/tenders/:id', proc, h(async (req, res) => {
  const t = await content.getTender(req.params.id)
  if (!t) throw bad('opportunity not found', 404)
  const [bids, all, orders] = await Promise.all([
    content.listBids({ tender_id: t.id, ...bidFilters(req.query) }),
    content.listBids({ tender_id: t.id }),
    content.listPurchaseOrders({ tender_id: t.id }),
  ])
  const counts = all.reduce((c, b) => { c.total++; c[b.status] = (c[b.status] || 0) + 1; return c }, { total: 0 })
  res.json({ ...t, bids, counts, orders, link: tenderLink(t) })
}))
router.post('/tenders', proc, h(async (req, res) => {
  const after = await content.createTender(req.body || {}, req.user.id)
  await audit({ actor: req.user, action: 'create', entity: 'tender', entityId: after.id, after })
  res.status(201).json({ ...after, link: tenderLink(after) })
}))
router.patch('/tenders/:id', proc, h(async (req, res) => {
  const before = await content.getTender(req.params.id)
  if (!before) throw bad('opportunity not found', 404)
  const after = await content.updateTender(before.id, req.body || {})
  await audit({ actor: req.user, action: after.status !== before.status ? after.status : 'update', entity: 'tender', entityId: after.id, before, after })
  res.json({ ...after, link: tenderLink(after) })
}))
router.delete('/tenders/:id', proc, h(async (req, res) => {
  const before = await content.getTender(req.params.id)
  if (!before) throw bad('opportunity not found', 404)
  const r = await content.deleteTender(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'tender', entityId: before.id, before })
  res.json(r)
}))
// Every bid still in play becomes "not selected"; each supplier is told unless notify is false.
router.post('/tenders/:id/close-out', proc, h(async (req, res) => {
  const t = await content.getTender(req.params.id)
  if (!t) throw bad('opportunity not found', 404)
  const bids = await content.closeOutTender(t.id, req.user, req.body?.note || '')
  let notified = 0
  if (req.body?.notify !== false) for (const bid of bids) if (await notifyBidStatus({ bid, tender: t, actor: req.user })) notified++
  await audit({ actor: req.user, action: 'close_out', entity: 'tender', entityId: t.id, after: { number: t.number, not_selected: bids.map(b => b.id), notified } })
  res.json({ changed: bids.length, notified, tender: await content.getTender(t.id) })
}))
// The same email to every supplier whose bid has one of the given statuses, each in their own conversation.
router.post('/tenders/:id/message', proc, h(async (req, res) => {
  const t = await content.getTender(req.params.id)
  if (!t) throw bad('opportunity not found', 404)
  const b = req.body || {}
  const statuses = (Array.isArray(b.statuses) ? b.statuses : [b.status || 'shortlisted']).filter(s => content.BID_STATUSES.includes(s))
  if (!statuses.length) throw bad('Choose which suppliers to write to.')
  const ids = Array.isArray(b.bid_ids) ? b.bid_ids.map(Number) : null
  const bids = (await content.listBids({ tender_id: t.id })).filter(x => (ids ? ids.includes(x.id) : statuses.includes(x.status)))
  const r = await messageBidders({ tender: t, bids, subject: b.subject, body: b.body, actor: req.user, fromId: b.from_id || null })
  await audit({ actor: req.user, action: 'message', entity: 'tender', entityId: t.id, after: { number: t.number, statuses, sent: r.sent.length, failed: r.failed.length } })
  res.status(r.sent.length ? 201 : 502).json(r)
}))

/* --------------------------------------------------------------- bids --- */
router.get('/bids', proc, h(async (req, res) => {
  res.json(await content.listBids({ tender_id: idOrNull(req.query.tender_id), supplier_id: idOrNull(req.query.supplier_id), ...bidFilters(req.query) }))
}))
router.get('/bids/:id', proc, h(async (req, res) => {
  const b = await content.getBid(req.params.id)
  if (!b) throw bad('bid not found', 404)
  const messages = await content.listMessages({ bid_id: b.id, scope: 'procurement' }).catch(() => [])
  res.json({ ...b, messages: messages.filter(m => m.headers?.internal !== true) })
}))
router.patch('/bids/:id', proc, h(async (req, res) => {
  const before = await content.getBid(req.params.id)
  if (!before) throw bad('bid not found', 404)
  const { bid, changed, previous } = await content.updateBid(before.id, req.body || {}, req.user)
  let message = null
  if (changed && req.body?.notify !== false) message = await notifyBidStatus({ bid, tender: before.tender, actor: req.user })
  await audit({ actor: req.user, action: changed ? 'status' : 'update', entity: 'bid', entityId: bid.id, before: { status: previous, status_note: before.status_note }, after: { status: bid.status, status_note: bid.status_note, supplier: bid.company_name, tender: before.tender?.number, notified: Boolean(message) } })
  res.json({ ...(await content.getBid(bid.id)), notified: Boolean(message) })
}))
router.delete('/bids/:id', proc, h(async (req, res) => {
  const before = await content.getBid(req.params.id)
  if (!before) throw bad('bid not found', 404)
  const r = await content.deleteBid(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'bid', entityId: before.id, before: { supplier: before.company_name, tender: before.tender?.number, price: before.price, quantity: before.quantity, status: before.status } })
  res.json(r)
}))
router.post('/bids/:id/requests', proc, h(async (req, res) => {
  const b = await content.getBid(req.params.id)
  if (!b) throw bad('bid not found', 404)
  const { request } = await content.askBid(b.id, req.body?.question, req.user)
  const message = req.body?.notify === false ? null : await sendBidRequest({ bid: b, tender: b.tender, request, actor: req.user })
  await audit({ actor: req.user, action: 'request_info', entity: 'bid', entityId: b.id, after: { request_id: request.id, supplier: b.company_name, notified: Boolean(message) } })
  res.status(201).json({ ...(await content.getBid(b.id)), notified: Boolean(message) })
}))
router.delete('/bids/:id/requests/:rid', proc, h(async (req, res) => {
  const b = await content.getBid(req.params.id)
  if (!b) throw bad('bid not found', 404)
  await content.deleteBidRequest(b.id, req.params.rid)
  await audit({ actor: req.user, action: 'update', entity: 'bid', entityId: b.id, after: { removed_request: Number(req.params.rid) } })
  res.json(await content.getBid(b.id))
}))

/* ---------------------------------------------------- purchase orders --- */
router.get('/purchase-orders', proc, h(async (req, res) => {
  res.json(await content.listPurchaseOrders({ status: req.query.status || 'all', kind: req.query.kind || 'all', supplier_id: idOrNull(req.query.supplier_id), tender_id: idOrNull(req.query.tender_id) }))
}))
router.get('/purchase-orders/:id', proc, h(async (req, res) => {
  const o = await content.getPurchaseOrder(req.params.id)
  if (!o) throw bad('order not found', 404)
  const [messages, documents, tender] = await Promise.all([
    content.listMessages({ po_id: o.id, scope: 'procurement' }).catch(() => []),
    content.listDocuments({ po_id: o.id }),
    o.tender_id ? content.getTender(o.tender_id) : null,
  ])
  res.json({ ...o, messages: messages.filter(m => m.headers?.internal !== true), documents, tender: tender && { id: tender.id, number: tender.number, title: tender.title }, link: orderLink(o) })
}))
router.post('/purchase-orders', proc, h(async (req, res) => {
  const after = await content.createPurchaseOrder(req.body || {}, req.user.id)
  await audit({ actor: req.user, action: 'create', entity: 'purchase_order', entityId: after.id, after })
  res.status(201).json({ ...after, link: orderLink(after) })
}))
router.patch('/purchase-orders/:id', proc, h(async (req, res) => {
  const before = await content.getPurchaseOrder(req.params.id)
  if (!before) throw bad('order not found', 404)
  const after = await content.updatePurchaseOrder(before.id, req.body || {})
  await audit({ actor: req.user, action: 'update', entity: 'purchase_order', entityId: after.id, before, after })
  res.json({ ...after, link: orderLink(after) })
}))
router.delete('/purchase-orders/:id', proc, h(async (req, res) => {
  const before = await content.getPurchaseOrder(req.params.id)
  if (!before) throw bad('order not found', 404)
  const r = await content.deletePurchaseOrder(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'purchase_order', entityId: before.id, before })
  res.json(r)
}))
router.get('/purchase-orders/:id/pdf', proc, h(async (req, res) => {
  const o = await content.getPurchaseOrder(req.params.id)
  if (!o) throw bad('order not found', 404)
  const pdf = await renderPurchaseOrderPdf(o, await content.getSettings(), orderLink(o))
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${o.number}.pdf"`)
  res.send(pdf)
}))
router.post('/purchase-orders/:id/send', proc, h(async (req, res) => {
  const b = req.body || {}
  const r = await sendPurchaseOrder(req.params.id, { actor: req.user, to: b.to, subject: b.subject, body: b.body, attachmentIds: b.attachment_ids || [], fromId: b.from_id || null })
  res.json({ ...r, link: orderLink(r.order) })
}))

/* ------------------------------------------------ composer pre-fill --- */
// Rendered subject/body for the composer, from the procurement records it concerns.
router.get('/procurement/templates/:key/render', proc, h(async (req, res) => {
  if (!PROCUREMENT_TEMPLATES.includes(req.params.key)) throw bad('unknown template', 404)
  const ctx = { actor: req.user }
  if (req.query.po_id) { ctx.order = await content.getPurchaseOrder(req.query.po_id); if (!ctx.order) throw bad('order not found', 404); ctx.link = orderLink(ctx.order) }
  if (req.query.bid_id) { const b = await content.getBid(req.query.bid_id); if (!b) throw bad('bid not found', 404); ctx.bid = b; ctx.tender = b.tender; ctx.supplier = b.supplier }
  if (req.query.supplier_id) { ctx.supplier = await content.getSupplier(req.query.supplier_id); if (!ctx.supplier) throw bad('supplier not found', 404) }
  const { subject, body, cta } = await renderKey(req.params.key, ctx)
  res.json({ subject, body, cta })
}))

/* --------------------------------------------------------- one glance --- */
router.get('/procurement/overview', proc, h(async (_req, res) => {
  const [stats, tenders, bids] = await Promise.all([content.procurementStats(), content.listTenders({ status: 'published' }), content.listBids({ status: 'open', limit: 50 })])
  res.json({ stats, open: tenders.filter(t => t.state === 'open').slice(0, 10), recent_bids: bids.slice(0, 10), site: publicUrl() })
}))

export default router
