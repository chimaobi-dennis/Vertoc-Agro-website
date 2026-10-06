/*
 * /api/admin/* — what migration 015 adds to the panel: payments, the
 * investment section, supplier deliveries, and reports. Mounted inside the
 * admin router (already behind authenticate()); each family of routes
 * answers to its own module, and every change is written to the audit log.
 */
import { Router } from 'express'
import { can, demand } from './auth.js'
import { audit } from './audit.js'
import * as content from './content.js'
import { bad, handler, idOrNull } from './http.js'
import { tellPortal } from './messaging.js'
import { inviteClient } from './client-routes.js'
import { inviteInvestor } from './investor-routes.js'

const router = Router()
const h = handler('admin')
const fmt = (cur, n) => `${cur} ${Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`
let svc = null
const supabase = () => svc ??= import('./store/supabase.js').then(m => m.supabase)

/* ------------------------------------------------------------ payments --- */
const pay = can('payments')
router.get('/payments', pay, h(async (req, res) => {
  res.json(await content.listPayments({ client_id: idOrNull(req.query.client_id), quote_id: idOrNull(req.query.quote_id), status: req.query.status || 'all' }))
}))
router.post('/payments', pay, h(async (req, res) => {
  if (req.body?.status === 'confirmed') demand(req, 'payments', 'approve')
  const after = await content.createPayment(req.body || {}, { source: 'staff', actorId: req.user.id })
  await audit({ actor: req.user, action: 'create', entity: 'payment', entityId: after.id, after })
  res.status(201).json(after)
}))
router.patch('/payments/:id', pay, h(async (req, res) => {
  const before = await content.getPayment(req.params.id)
  if (!before) throw bad('payment not found', 404)
  // Confirming or rejecting a payment is an approval, not an edit.
  if (req.body?.status !== undefined && req.body.status !== before.status) demand(req, 'payments', 'approve')
  const { payment, reviewed } = await content.updatePayment(before.id, req.body || {}, req.user)
  await audit({ actor: req.user, action: reviewed ? payment.status : 'update', entity: 'payment', entityId: payment.id, before, after: payment })
  if (reviewed && payment.client_id && req.body?.notify !== false) {
    const c = await content.getClient(payment.client_id)
    const [full] = (await content.listPayments({ client_id: payment.client_id })).filter(p => p.id === payment.id)
    const ref = full?.quote ? ` for ${full.quote.number}` : ''
    if (c && payment.status !== 'submitted') await tellPortal({ audience: 'client', id: c.id, email: c.email || c.data?.email, name: c.data?.contact_person || c.name, actor: req.user,
      headline: payment.status === 'confirmed' ? `Your payment of ${fmt(payment.currency, payment.amount)}${ref} has been confirmed` : `We could not confirm your payment of ${fmt(payment.currency, payment.amount)}${ref}`, details: payment.status_note, path: '?tab=payments' })
  }
  res.json(payment)
}))
router.delete('/payments/:id', pay, h(async (req, res) => {
  const before = await content.getPayment(req.params.id)
  if (!before) throw bad('payment not found', 404)
  const r = await content.deletePayment(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'payment', entityId: before.id, before })
  res.json(r)
}))
router.get('/payments/:id/receipt', pay, h(async (req, res) => {
  const p = await content.getPayment(req.params.id)
  if (!p?.receipt_document_id) throw bad('No receipt was uploaded for this payment.', 404)
  res.json(await content.documentUrl(p.receipt_document_id, { download: req.query.download === '1' }))
}))

/* --------------------------------------------------------- investments --- */
const inv = can('investments')
router.get('/investment-opportunities', inv, h(async (req, res) => res.json(await content.listOpportunities({ status: req.query.status || 'all' }))))
router.get('/investment-opportunities/:id', inv, h(async (req, res) => {
  const o = await content.getOpportunity(req.params.id)
  if (!o) throw bad('opportunity not found', 404)
  const [investments, docs] = await Promise.all([content.listInvestments({ opportunity_id: o.id }), content.listDocuments({ opportunity_id: o.id })])
  // The cover picture is kept as a document under its own label; the form shows it apart from the terms and fact sheets.
  const cover = docs.find(d => d.label === content.COVER_LABEL) || null
  res.json({ ...o, investments, documents: docs.filter(d => d.label !== content.COVER_LABEL), cover: cover && { id: cover.id, name: cover.name } })
}))
router.post('/investment-opportunities', inv, h(async (req, res) => {
  const after = await content.createOpportunity(req.body || {}, req.user.id)
  await audit({ actor: req.user, action: 'create', entity: 'investment_opportunity', entityId: after.id, after })
  res.status(201).json(after)
}))
router.patch('/investment-opportunities/:id', inv, h(async (req, res) => {
  const before = await content.getOpportunity(req.params.id)
  if (!before) throw bad('opportunity not found', 404)
  const after = await content.updateOpportunity(before.id, req.body || {})
  await audit({ actor: req.user, action: after.status !== before.status ? after.status : 'update', entity: 'investment_opportunity', entityId: after.id, before, after })
  res.json(await content.getOpportunity(after.id))
}))
router.delete('/investment-opportunities/:id', inv, h(async (req, res) => {
  const before = await content.getOpportunity(req.params.id)
  if (!before) throw bad('opportunity not found', 404)
  const r = await content.deleteOpportunity(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'investment_opportunity', entityId: before.id, before })
  res.json(r)
}))

router.get('/investors', inv, h(async (req, res) => res.json(await content.listInvestors({ q: req.query.q || '' }))))
router.post('/investors', inv, h(async (req, res) => {
  const after = await content.createInvestor(req.body || {}, null)
  await audit({ actor: req.user, action: 'create', entity: 'investor', entityId: after.id, after: content.safeInvestor(after) })
  res.status(201).json(content.safeInvestor(after))
}))
// Invite by email: a link to choose a password (seven days), or to confirm an account that was never confirmed.
const invited = async (req, res, { audience, entity, row, email, send }) => {
  const r = await send(row, email)
  await audit({ actor: req.user, action: 'invite', entity, entityId: row.id, after: { email: r.email, kind: r.kind } })
  res.json({ ok: true, email: r.email, kind: r.kind })
}
router.post('/investors/:id/invite', inv, h(async (req, res) => {
  const i = await content.getInvestor(req.params.id)
  if (!i) throw bad('investor not found', 404)
  await invited(req, res, { entity: 'investor', row: i, email: String(req.body?.email || '').trim() || i.email, send: inviteInvestor })
}))
router.post('/clients/:id/invite', can('clients'), h(async (req, res) => {
  const c = await content.getClient(req.params.id)
  if (!c) throw bad('client not found', 404)
  await invited(req, res, { entity: 'client', row: c, email: String(req.body?.email || '').trim() || c.email || c.data?.email || '', send: inviteClient })
}))
router.get('/investors/:id', inv, h(async (req, res) => {
  const i = await content.getInvestor(req.params.id)
  if (!i) throw bad('investor not found', 404)
  const [investments, documents] = await Promise.all([content.listInvestments({ investor_id: i.id }), content.listDocuments({ investor_id: i.id })])
  res.json({ ...content.safeInvestor(i), investments, documents })
}))
router.patch('/investors/:id', inv, h(async (req, res) => {
  const before = await content.getInvestor(req.params.id)
  if (!before) throw bad('investor not found', 404)
  if (req.body?.kyc_status !== undefined && req.body.kyc_status !== before.kyc_status) demand(req, 'investments', 'approve')
  const after = await content.updateInvestor(before.id, req.body || {}, { staff: true })
  await audit({ actor: req.user, action: 'update', entity: 'investor', entityId: after.id, before: content.safeInvestor(before), after: content.safeInvestor(after) })
  if (after.kyc_status !== before.kyc_status && after.kyc_status !== 'pending') await tellPortal({ audience: 'investor', id: after.id, email: after.email, name: after.name, actor: req.user,
    headline: after.kyc_status === 'verified' ? 'Your identification has been verified' : 'We could not verify your identification', details: after.kyc_status === 'rejected' ? 'Please check your details and documents in your profile, or contact us.' : '', path: '/profile' })
  res.json(content.safeInvestor(after))
}))
router.delete('/investors/:id', inv, h(async (req, res) => {
  const before = await content.getInvestor(req.params.id)
  if (!before) throw bad('investor not found', 404)
  const r = await content.deleteInvestor(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'investor', entityId: before.id, before: content.safeInvestor(before) })
  res.json(r)
}))

router.get('/investments', inv, h(async (req, res) => {
  res.json({ items: await content.listInvestments({ investor_id: idOrNull(req.query.investor_id), opportunity_id: idOrNull(req.query.opportunity_id), status: req.query.status || 'all' }), totals: await content.investmentTotals() })
}))
router.get('/investments/:id', inv, h(async (req, res) => {
  const x = await content.getInvestment(req.params.id)
  if (!x) throw bad('investment not found', 404)
  const docs = (await content.listDocuments({ investor_id: x.investor_id })).filter(d => d.investment_id === x.id)
  res.json({ ...x, documents: docs })
}))
const STATUS_LINE = {
  active: x => `Your investment ${x.number} has been approved and is now active`,
  rejected: x => `Your application ${x.number} was not approved`,
  matured: x => `Your investment ${x.number} has matured`,
  paid_out: x => `Your investment ${x.number} has been paid out in full`,
  cancelled: x => `Your investment ${x.number} was cancelled`,
}
router.patch('/investments/:id', inv, h(async (req, res) => {
  const before = await content.getInvestment(req.params.id)
  if (!before) throw bad('investment not found', 404)
  if (req.body?.status !== undefined && req.body.status !== before.status) demand(req, 'investments', 'approve')
  const { investment, changed } = await content.updateInvestment(before.id, req.body || {}, req.user)
  await audit({ actor: req.user, action: changed ? investment.status : 'update', entity: 'investment', entityId: investment.id,
    before: { status: before.status, amount: before.amount, start_date: before.start_date, maturity_date: before.maturity_date, expected_return: before.expected_return },
    after: { number: investment.number, investor: investment.investor?.name, status: investment.status, amount: investment.amount, start_date: investment.start_date, maturity_date: investment.maturity_date, expected_return: investment.expected_return } })
  if (changed && STATUS_LINE[investment.status] && req.body?.notify !== false && investment.investor) {
    const d = investment.status === 'active' ? `Amount: ${fmt(investment.currency, investment.amount)}\nStart date: ${investment.start_date}\nMaturity date: ${investment.maturity_date}${investment.expected_return != null ? `\nExpected return: ${fmt(investment.currency, investment.expected_return)}` : ''}` : ''
    await tellPortal({ audience: 'investor', id: investment.investor_id, email: investment.investor.email, name: investment.investor.name, actor: req.user, headline: STATUS_LINE[investment.status](investment), details: [d, investment.status_note].filter(Boolean).join('\n\n'), path: `/investments/${investment.id}` })
  }
  res.json(investment)
}))
router.delete('/investments/:id', inv, h(async (req, res) => {
  const before = await content.getInvestment(req.params.id)
  if (!before) throw bad('investment not found', 404)
  const r = await content.deleteInvestment(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'investment', entityId: before.id, before: { number: before.number, investor: before.investor?.name, amount: before.amount, status: before.status } })
  res.json(r)
}))
// Returns and principal paid to the investor.
router.post('/investments/:id/payouts', can('investments', 'approve'), h(async (req, res) => {
  const { payout, investment } = await content.addPayout(req.params.id, req.body || {}, req.user.id)
  await audit({ actor: req.user, action: 'payout', entity: 'investment', entityId: investment.id, after: { number: investment.number, investor: investment.investor?.name, kind: payout.kind, amount: payout.amount, paid_on: payout.paid_on, reference: payout.reference } })
  if (req.body?.notify !== false && investment.investor) await tellPortal({ audience: 'investor', id: investment.investor_id, email: investment.investor.email, name: investment.investor.name, actor: req.user,
    headline: `We paid you ${fmt(investment.currency, payout.amount)} on ${investment.number}`, details: `${payout.kind === 'principal' ? 'Principal' : 'Return'} paid on ${payout.paid_on}${payout.reference ? `\nReference: ${payout.reference}` : ''}`, path: `/investments/${investment.id}` })
  res.status(201).json(investment)
}))
router.delete('/investments/:id/payouts/:pid', can('investments', 'approve'), h(async (req, res) => {
  const after = await content.deletePayout(req.params.id, req.params.pid)
  await audit({ actor: req.user, action: 'update', entity: 'investment', entityId: Number(req.params.id), after: { removed_payout: Number(req.params.pid) } })
  res.json(after)
}))

/* -------------------------------------------------- supplier deliveries --- */
const ship = can('shipments')
router.get('/deliveries', ship, h(async (req, res) => {
  res.json(await content.listPoShipments({ po_id: idOrNull(req.query.po_id), supplier_id: idOrNull(req.query.supplier_id), status: req.query.status || 'all' }))
}))
router.get('/deliveries/:id', ship, h(async (req, res) => {
  const x = await content.getPoShipment(req.params.id)
  if (!x) throw bad('shipment not found', 404)
  const [order, documents] = await Promise.all([content.getPurchaseOrder(x.po_id), content.listDocuments({ po_shipment_id: x.id })])
  res.json({ ...x, order: order && { id: order.id, number: order.number, kind: order.kind, supplier_name: order.supplier_name, status: order.status }, documents })
}))
router.post('/deliveries', ship, h(async (req, res) => {
  const { shipment, order } = await content.createPoShipment(req.body?.po_id, req.body || {})
  await audit({ actor: req.user, action: 'create', entity: 'delivery', entityId: shipment.id, after: { order: order.number, quantity: shipment.quantity, truck: shipment.truck_number } })
  res.status(201).json(shipment)
}))
router.patch('/deliveries/:id', ship, h(async (req, res) => {
  const before = await content.getPoShipment(req.params.id)
  if (!before) throw bad('shipment not found', 404)
  const after = await content.updatePoShipment(before.id, req.body || {})
  await audit({ actor: req.user, action: 'update', entity: 'delivery', entityId: after.id, before, after })
  res.json(after)
}))
// A location or status report from our side; confirming a delivery is an approval.
router.post('/deliveries/:id/report', can('shipments', 'edit'), h(async (req, res) => {
  const before = await content.getPoShipment(req.params.id)
  if (!before) throw bad('shipment not found', 404)
  if (req.body?.status === 'confirmed') demand(req, 'shipments', 'approve')
  const after = await content.reportPoShipment(before.id, { ...req.body, actorId: req.user.id }, { by: req.user.name || req.user.email || 'staff' })
  const order = await content.getPurchaseOrder(after.po_id)
  await audit({ actor: req.user, action: after.status !== before.status ? after.status : 'update', entity: 'delivery', entityId: after.id, before: { status: before.status, location: before.current_location }, after: { order: order?.number, status: after.status, location: after.current_location, received_quantity: after.received_quantity } })
  if (after.status === 'confirmed' && before.status !== 'confirmed' && after.supplier_id && req.body?.notify !== false) {
    const s = await content.getSupplier(after.supplier_id)
    if (s) await tellPortal({ audience: 'supplier', id: s.id, email: s.email, name: s.contact_person || s.company_name, actor: req.user, headline: `We confirmed delivery of shipment ${after.number} on ${order?.number}`, details: `Received: ${after.received_quantity} ${after.unit}`, path: `/orders/${order?.number}` })
  }
  res.json(after)
}))
router.delete('/deliveries/:id', ship, h(async (req, res) => {
  const before = await content.getPoShipment(req.params.id)
  if (!before) throw bad('shipment not found', 404)
  const r = await content.deletePoShipment(before.id)
  await audit({ actor: req.user, action: 'delete', entity: 'delivery', entityId: before.id, before })
  res.json(r)
}))

/* ------------------------------------------------------------- reports --- */
// One page of totals for a period. Each block appears only for whoever may see that module.
router.get('/reports', can('reports'), h(async (req, res) => {
  const sb = await supabase()
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : new Date().toISOString().slice(0, 10)
  const range = q => q.gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`)
  const rows = async (table, cols) => { const { data, error } = await range(sb.from(table).select(cols)).limit(10000); return error ? [] : data }
  const may = m => req.user.perms?.[m]?.includes('view')
  const sum = (list, k = 'total') => Math.round(list.reduce((s, r) => s + Number(r[k] || 0), 0) * 100) / 100
  const by = (list, k) => list.reduce((o, r) => { o[r[k]] = (o[r[k]] || 0) + 1; return o }, {})
  const byCur = (list, k = 'total') => { const o = {}; for (const r of list) o[r.currency] = Math.round(((o[r.currency] || 0) + Number(r[k] || 0)) * 100) / 100; return o }
  const out = { from, to }
  if (may('invoices')) { const q = await rows('quotes', 'status,total,currency'); out.invoices = { count: q.length, by_status: by(q, 'status'), accepted_value: byCur(q.filter(x => x.status === 'accepted')) } }
  if (may('payments')) { const p = await rows('payments', 'status,amount,currency'); out.payments = { count: p.length, by_status: by(p, 'status'), confirmed: byCur(p.filter(x => x.status === 'confirmed'), 'amount'), awaiting: byCur(p.filter(x => x.status === 'submitted'), 'amount') } }
  if (may('clients')) { const c = await rows('clients', 'status,source'); out.clients = { count: c.length, registered_online: c.filter(x => x.source === 'signup').length } }
  if (may('bidding')) { const [t, b] = await Promise.all([rows('tenders', 'status'), rows('bids', 'status,total,currency')]); out.bidding = { opportunities: t.length, bids: b.length, by_status: by(b, 'status'), awarded: b.filter(x => x.status === 'awarded').length } }
  if (may('purchase_orders')) { const o = await rows('purchase_orders', 'status,total,currency,kind'); out.purchase_orders = { count: o.length, by_status: by(o, 'status'), issued_value: byCur(o.filter(x => !['draft', 'cancelled', 'declined'].includes(x.status))) } }
  if (may('suppliers')) { const s = await rows('suppliers', 'status,source'); out.suppliers = { count: s.length, registered_online: s.filter(x => x.source !== 'admin').length } }
  if (may('shipments')) { const d = await rows('po_shipments', 'status,quantity'); out.deliveries = { count: d.length, by_status: by(d, 'status'), quantity: sum(d, 'quantity') } }
  if (may('investments')) { const [i, n] = await Promise.all([rows('investments', 'status,amount,currency'), rows('investors', 'kyc_status')]); out.investments = { applications: i.length, by_status: by(i, 'status'), committed: byCur(i.filter(x => ['pending', 'active', 'matured'].includes(x.status)), 'amount'), new_investors: n.length, totals: await content.investmentTotals() } }
  res.json(out)
}))

export default router
