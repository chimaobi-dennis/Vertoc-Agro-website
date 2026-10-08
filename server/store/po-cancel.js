/*
 * Cancelling an LPO / PO (migration 021). The order is never deleted: it becomes
 * "cancelled", keeps everything it had, and gains who / when / why and whether the
 * supplier was told. Each cancellation is also written to a permanent log.
 */
import { supabase } from './supabase.js'

export const CANCEL_HINT = 'This needs the database migration 021: run server/migrations/021_po_cancellation.sql in the Supabase SQL editor first.'
const missing = e => ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e?.code)
const invalid = (message, status = 400) => Object.assign(new Error(message), { expose: true, status })
const fail = (e, ctx) => (missing(e) ? invalid(CANCEL_HINT, 409) : new Error(`${ctx}: ${e.message}`))
const unwrap = ({ data, error }, ctx) => { if (error) throw fail(error, ctx); return data }

export const CANCELLABLE = ['draft', 'issued', 'acknowledged', 'declined']

/** Cancel an order. Throws a user-facing error when it cannot be cancelled. Returns { order, record }. */
export async function cancelOrder(id, { reason, user }) {
  const why = String(reason ?? '').replace(/\r\n/g, '\n').trim()
  if (why.length < 5) throw invalid('Please explain why this order is being cancelled.')
  if (why.length > 2000) throw invalid('Please keep the reason under 2,000 characters.')
  const o = unwrap(await supabase.from('purchase_orders').select('*').eq('id', Number(id)).limit(1), 'cancelOrder')?.[0]
  if (!o) throw invalid('order not found', 404)
  if (o.status === 'cancelled') throw invalid('This order is already cancelled.', 409)
  if (!CANCELLABLE.includes(o.status)) throw invalid(`A ${o.status} order cannot be cancelled.`, 409)
  const { data: rec, error: re } = await supabase.from('goods_receipts').select('id').eq('po_id', o.id).limit(1)
  if (!re && rec?.length) throw invalid('Goods have already been received against this order, so it cannot be cancelled. Close it in Inventory instead.', 409)
  const at = new Date().toISOString(), name = user.name || user.email || 'staff'
  const record = unwrap(await supabase.from('po_cancellations').insert({ po_id: o.id, po_number: o.number, po_kind: o.kind, supplier_name: o.supplier_name, previous_status: o.status, reason: why, cancelled_by: user.id, cancelled_name: name, cancelled_at: at }).select().single(), 'cancelOrder:log')
  const order = unwrap(await supabase.from('purchase_orders').update({ status: 'cancelled', cancelled_at: at, cancelled_by: user.id, cancelled_name: name, cancel_reason: why, cancel_notify_status: '', cancel_notified_at: null }).eq('id', o.id).select().single(), 'cancelOrder')
  return { order, record, was: o }
}
/** Fill in how telling the supplier went, on the order and on its permanent record. */
export async function recordCancelNotice(orderId, recordId, { status, error = '', messageId = null }) {
  const at = status === 'sent' ? new Date().toISOString() : null
  await supabase.from('po_cancellations').update({ notify_status: status, notified_at: at, notify_error: String(error).slice(0, 500), message_id: messageId }).eq('id', recordId)
  const { data } = await supabase.from('purchase_orders').update({ cancel_notify_status: status, cancel_notified_at: at }).eq('id', orderId).select().single()
  return data
}
export async function listCancellations({ po_id = null, limit = 500 } = {}) {
  let q = supabase.from('po_cancellations').select('*').order('cancelled_at', { ascending: false }).limit(limit)
  if (po_id != null) q = q.eq('po_id', Number(po_id))
  const { data, error } = await q
  if (error) { if (missing(error)) return []; throw fail(error, 'listCancellations') }
  return data || []
}
