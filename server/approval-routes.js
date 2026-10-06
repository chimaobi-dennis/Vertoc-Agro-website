/*
 * /api/admin/approvals and /api/admin/amendments — the review side of the
 * approval workflow (migration 016) and the helpers the invoice, order,
 * client and supplier routes use to take part in it.
 *
 * The rule: anyone with the right to create may initiate; only someone with
 * `approve` on that module decides; nobody decides their own submission.
 */
import { Router } from 'express'
import { demand } from './auth.js'
import { audit } from './audit.js'
import * as content from './content.js'
import { bad, handler } from './http.js'
import { hasUser, seesAmounts } from './permissions.js'

const router = Router()
const h = handler('admin')

/* ------------------------------------------------------------- helpers --- */
const MODULE = { quote: 'invoices', purchase_order: 'purchase_orders', client: 'clients', supplier: 'suppliers' }
const TYPE_LABEL = { quote: 'invoice', purchase_order: 'order', client: 'client', supplier: 'supplier' }
export const mayApprove = (req, type) => hasUser(req.user, MODULE[type], 'approve')

// The fields whose change needs approval on an official document; notes for the team and status moves go straight through.
const AMEND_KEYS = {
  quote: ['items', 'discount', 'tax_rate', 'currency', 'client_id', 'client_name', 'client_email', 'title', 'number', 'valid_until', 'notes', 'terms', 'data'],
  purchase_order: ['items', 'discount', 'tax_rate', 'currency', 'supplier_id', 'supplier_name', 'supplier_email', 'supplier_address', 'title', 'delivery_location', 'delivery_date', 'payment_terms', 'notes', 'terms', 'kind', 'number'],
}

/** Stamp a new record: official at once for an approver, pending for everyone else. */
export async function submitted(req, type, record) {
  const approval = await content.stampSubmission(type, record.id, { userId: req.user.id, approved: mayApprove(req, type) })
  return { ...record, approval, submitted_by: req.user.id }
}
/** Throws 409 while a record is not official yet. Records from before migration 016 are. */
export async function requireApproved(type, id) {
  const a = await content.getApproval(type, id)
  if (a?.approval === 'pending') throw bad(`This ${TYPE_LABEL[type]} is waiting for approval. An admin has to approve it before it can be used.`, 409)
  if (a?.approval === 'rejected') throw bad(`This ${TYPE_LABEL[type]} was rejected${a.approval_note ? `: ${a.approval_note}` : ''}. Edit it and submit it again.`, 409)
}

/**
 * Edit an invoice or order. Approvers change it directly (the change is still written to the amendment trail);
 * others submit the substantive part as an amendment when the document is official, and edit freely while it is not.
 * Returns { record } when applied, or { amendment, record } when the change now waits for approval.
 */
export async function amend(req, { type, before, patch, reason = '', update, guard = null }) {
  const state = await content.getApproval(type, before.id)
  const keys = Object.keys(patch)
  const substantive = keys.filter(k => AMEND_KEYS[type].includes(k))
  if (state?.legacy || !substantive.length) return { record: await update(before.id, patch) }
  if (state.approval !== 'approved') {
    // Not official yet: the author keeps working on it; a rejected one goes back for review.
    const record = await update(before.id, patch)
    if (state.approval === 'rejected' && !mayApprove(req, type)) await content.resubmit(type, before.id, req.user.id)
    return { record }
  }
  const only = o => Object.fromEntries(Object.entries(o).filter(([k]) => substantive.includes(k)))
  if (mayApprove(req, type)) {
    const record = await update(before.id, patch)
    try {
      const a = await content.createAmendment({ entity: type, before, patch: only(patch), reason: reason || 'Amended directly', user: req.user })
      await content.closeAmendment(a.id, { status: 'approved', by: req.user.id, byName: req.user.name || req.user.email, note: 'Amended directly by an approver' })
    } catch (e) { console.error('[amend] trail', e.message) }
    return { record, direct: true }
  }
  guard?.(before, patch)   // what the document no longer allows is refused now, not when someone approves it
  const rest = Object.fromEntries(Object.entries(patch).filter(([k]) => !substantive.includes(k)))
  const amendment = await content.createAmendment({ entity: type, before, patch: only(patch), reason, user: req.user })
  const record = Object.keys(rest).length ? await update(before.id, rest) : before
  return { record, amendment }
}

/** Prices and totals out of an invoice or order, for staff who only view them. */
export function redact(doc) {
  if (!doc) return doc
  const { subtotal, discount, tax_rate, total, ...rest } = doc
  return { ...rest, items: (doc.items || []).map(({ unit_price, total: _t, ...it }) => it), amounts_hidden: true }
}
export const maySeeAmounts = req => seesAmounts(req.user.perms)
export const withAmounts = (req, doc) => (maySeeAmounts(req) ? doc : redact(doc))

/* --------------------------------------------------------------- routes --- */
const TYPES = ['quote', 'purchase_order', 'client', 'supplier']

// Everything waiting: for an approver, all of it in their modules; for anyone else, their own submissions.
router.get('/approvals', h(async (req, res) => {
  const mine = TYPES.filter(t => hasUser(req.user, MODULE[t], 'view'))
  const approver = TYPES.filter(t => mayApprove(req, t))
  const [records, amendments] = await Promise.all([content.listPending(mine), content.listAmendments({ status: 'pending' })])
  res.json({
    records: records.filter(r => approver.includes(r.type) || r.submitted_by === req.user.id).map(r => ({ ...r, can_decide: approver.includes(r.type) && r.submitted_by !== req.user.id })),
    amendments: amendments.filter(a => hasUser(req.user, MODULE[a.entity], 'view') && (approver.includes(a.entity) || a.initiated_by === req.user.id)).map(a => ({ ...a, can_decide: approver.includes(a.entity) && a.initiated_by !== req.user.id, can_cancel: a.initiated_by === req.user.id })),
  })
}))

router.post('/approvals/:type/:id/decision', h(async (req, res) => {
  const type = req.params.type
  if (!TYPES.includes(type)) throw bad('unknown record type', 404)
  demand(req, MODULE[type], 'approve')
  const decision = req.body?.decision === 'rejected' ? 'rejected' : req.body?.decision === 'approved' ? 'approved' : null
  if (!decision) throw bad('decision must be approved or rejected')
  if (decision === 'rejected' && !String(req.body?.note || '').trim()) throw bad('Please say why it is rejected: the person who submitted it will see this.')
  const cur = await content.getApproval(type, req.params.id)
  if (!cur) throw bad('record not found', 404)
  if (cur.approval !== 'pending') throw bad(`This ${TYPE_LABEL[type]} is not waiting for approval.`, 409)
  if (cur.submitted_by && cur.submitted_by === req.user.id) throw bad('You cannot approve your own submission. Another admin has to review it.', 403)
  const after = await content.decide(type, cur.id, { decision, by: req.user.id, note: req.body?.note })
  await audit({ actor: req.user, action: decision === 'approved' ? 'approve' : 'reject', entity: type, entityId: cur.id, before: { approval: cur.approval }, after: { approval: decision, note: after.approval_note, submitted_by: cur.submitted_by } })
  res.json({ ok: true, approval: decision })
}))

router.get('/amendments', h(async (req, res) => {
  const entity = TYPES.slice(0, 2).includes(req.query.entity) ? req.query.entity : null
  if (entity) demand(req, MODULE[entity], 'view')
  const list = await content.listAmendments({ status: req.query.status || 'all', entity, entity_id: req.query.entity_id ? Number(req.query.entity_id) : null })
  res.json(list.filter(a => hasUser(req.user, MODULE[a.entity], 'view')))
}))

router.post('/amendments/:id/decision', h(async (req, res) => {
  const a = await content.getAmendment(req.params.id)
  if (!a) throw bad('amendment not found', 404)
  demand(req, MODULE[a.entity], 'approve')
  if (a.status !== 'pending') throw bad('This amendment was already decided.', 409)
  const decision = req.body?.decision === 'rejected' ? 'rejected' : req.body?.decision === 'approved' ? 'approved' : null
  if (!decision) throw bad('decision must be approved or rejected')
  if (decision === 'rejected' && !String(req.body?.note || '').trim()) throw bad('Please say why it is rejected.')
  if (a.initiated_by && a.initiated_by === req.user.id) throw bad('You cannot approve your own amendment. Another admin has to review it.', 403)
  if (decision === 'approved') {
    // The change is applied first: if the document no longer allows it (an accepted invoice's prices are locked) the amendment stays pending.
    const update = a.entity === 'quote' ? content.updateQuote : content.updatePurchaseOrder
    try { await update(a.entity_id, a.proposed) } catch (e) { throw bad(e.message, e.status && e.status < 500 ? e.status : 400) }
  }
  const after = await content.closeAmendment(a.id, { status: decision, by: req.user.id, byName: req.user.name || req.user.email, note: req.body?.note })
  await audit({ actor: req.user, action: decision === 'approved' ? 'approve' : 'reject', entity: `${a.entity}_amendment`, entityId: a.id, before: a.original, after: { proposed: a.proposed, status: decision, document: a.entity_number, initiated_by: a.initiated_name } })
  res.json(after)
}))
router.post('/amendments/:id/cancel', h(async (req, res) => {
  const a = await content.getAmendment(req.params.id)
  if (!a) throw bad('amendment not found', 404)
  if (a.initiated_by !== req.user.id && !hasUser(req.user, MODULE[a.entity], 'approve')) throw bad('Only the person who proposed it can withdraw it.', 403)
  if (a.status !== 'pending') throw bad('This amendment was already decided.', 409)
  res.json(await content.closeAmendment(a.id, { status: 'cancelled', by: req.user.id, byName: req.user.name || req.user.email, note: 'Withdrawn' }))
}))

export default router
