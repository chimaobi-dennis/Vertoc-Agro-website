/*
 * /api/admin/inventory — what Inventory works from: approved purchase orders
 * as expected deliveries, goods receipts against them, and stock. Mounted in
 * the admin router (already behind authenticate()).
 */
import { Router } from 'express'
import { can, demand } from './auth.js'
import { audit } from './audit.js'
import * as content from './content.js'
import { bad, handler } from './http.js'
import { withAmounts } from './approval-routes.js'

const router = Router()
const h = handler('admin')
const inv = can('inventory')

// What Inventory needs to know about an order, with the prices left out for anyone who only views.
const orderView = async (req, o) => {
  const { internal_notes, token, response_note, created_by, ...rest } = withAmounts(req, o)
  const tender = o.tender_id ? await content.getTender(o.tender_id).catch(() => null) : null
  return { ...rest, specification: tender?.specification || '', tender: tender && { id: tender.id, number: tender.number, title: tender.title } }
}

router.get('/inventory/orders', inv, h(async (req, res) => {
  res.json(await content.listExpected({ status: req.query.status || 'open', q: req.query.q || '' }))
}))
router.get('/inventory/orders/:id', inv, h(async (req, res) => {
  const x = await content.getExpected(req.params.id)
  if (!x) throw bad('order not found, or not approved yet', 404)
  res.json({ order: await orderView(req, x.order), inventory_status: x.order.inventory_status, inventory_note: x.order.inventory_note, closed_at: x.order.inventory_closed_at, lines: x.lines, totals: x.totals, receipts: x.receipts })
}))
router.post('/inventory/orders/:id/receipts', inv, h(async (req, res) => {
  const r = await content.receive(req.params.id, req.body || {}, req.user)
  await audit({ actor: req.user, action: 'receive', entity: 'goods_receipt', entityId: r.receipt.id, after: { receipt: r.receipt.number, order: r.order.number, lines: r.receipt.lines?.length ?? undefined, status: r.order.inventory_status, totals: r.totals } })
  res.status(201).json({ receipt: r.receipt, lines: r.lines, totals: r.totals, inventory_status: r.order.inventory_status })
}))
router.delete('/inventory/orders/:id/receipts/:rid', can('inventory', 'approve'), h(async (req, res) => {
  const r = await content.deleteReceipt(req.params.id, req.params.rid)
  await audit({ actor: req.user, action: 'delete', entity: 'goods_receipt', entityId: r.id, before: r })
  res.json({ deleted: true, id: r.id })
}))
// Closing settles a short supply or a rejection; reopening allows another delivery.
router.post('/inventory/orders/:id/close', inv, h(async (req, res) => {
  const x = await content.setClosed(req.params.id, true, { by: req.user.id, note: req.body?.note })
  await audit({ actor: req.user, action: 'close', entity: 'inventory', entityId: x.order.id, after: { order: x.order.number, totals: x.totals, note: req.body?.note || '' } })
  res.json({ inventory_status: x.order.inventory_status, totals: x.totals })
}))
router.post('/inventory/orders/:id/reopen', inv, h(async (req, res) => {
  demand(req, 'inventory', 'edit')
  const x = await content.setClosed(req.params.id, false, { by: req.user.id })
  await audit({ actor: req.user, action: 'reopen', entity: 'inventory', entityId: x.order.id, after: { order: x.order.number } })
  res.json({ inventory_status: x.order.inventory_status, totals: x.totals })
}))
router.get('/inventory/stock', inv, h(async (_req, res) => res.json(await content.stock())))

export default router
