/*
 * Inventory (migration 017): approved purchase orders as expected deliveries,
 * goods receipts against them, and what is in stock. Supabase only.
 *
 * Per order line: ordered (the PO), delivered (what arrived), accepted (what
 * passed counting, weighing and quality checks), rejected (delivered but not
 * accepted), outstanding (ordered but not yet accepted) and excess (delivered
 * beyond the order). Stock grows by the accepted quantity only.
 */
import { supabase } from './supabase.js'
import { insertNumbered } from './procurement.js'

export const INVENTORY_HINT = 'This needs the database migration 017: run server/migrations/017_inventory.sql in the Supabase SQL editor first.'
const missing = e => ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e?.code)
const invalid = (message, status = 400) => Object.assign(new Error(message), { expose: true, status })
const fail = (e, ctx) => (missing(e) ? invalid(INVENTORY_HINT, 409) : new Error(`${ctx}: ${e.message}`))
const unwrap = ({ data, error }, ctx) => { if (error) throw fail(error, ctx); return data }
const text = (s, max = 2000) => String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)
const q3 = v => Math.round((Number(v) || 0) * 1000) / 1000

export const INVENTORY_STATUSES = ['expected', 'partially_received', 'fully_received', 'disputed', 'closed']
export const INVENTORY_LABELS = { expected: 'Expected', partially_received: 'Partially received', fully_received: 'Fully received', disputed: 'Rejected / disputed', closed: 'Closed' }

/** An order is on Inventory's list once it is official and still live. */
const LIVE = q => q.eq('approval', 'approved').not('status', 'in', '(cancelled,declined)')

/** Per-line figures from the order and every receipt line so far. */
export function lineFigures(order, receiptLines) {
  return (order.items || []).map((it, index) => {
    const mine = receiptLines.filter(l => l.item_index === index)
    const ordered = q3(it.quantity), delivered = q3(mine.reduce((s, l) => s + Number(l.delivered), 0)), accepted = q3(mine.reduce((s, l) => s + Number(l.accepted), 0))
    return { index, description: it.description, unit: it.unit || '', ordered, delivered, accepted, rejected: q3(delivered - accepted), outstanding: q3(Math.max(0, ordered - accepted)), excess: q3(Math.max(0, delivered - ordered)) }
  })
}
const totals = lines => lines.reduce((t, l) => { for (const k of ['ordered', 'delivered', 'accepted', 'rejected', 'outstanding', 'excess']) t[k] = q3(t[k] + l[k]); return t }, { ordered: 0, delivered: 0, accepted: 0, rejected: 0, outstanding: 0, excess: 0 })
export function statusFor(order, lines) {
  if (order.inventory_closed_at) return 'closed'
  const t = totals(lines)
  if (t.rejected > 0 || t.excess > 0) return 'disputed'
  if (lines.length && lines.every(l => l.accepted >= l.ordered)) return 'fully_received'
  return t.delivered > 0 ? 'partially_received' : 'expected'
}

async function receiptLines(poIds) {
  if (!poIds.length) return []
  return unwrap(await supabase.from('goods_receipt_lines').select('*').in('po_id', poIds.map(Number)), 'receiptLines') ?? []
}
const summary = (o, lines) => { const f = lineFigures(o, lines); return { id: o.id, number: o.number, kind: o.kind, title: o.title, supplier_name: o.supplier_name, supplier_id: o.supplier_id, delivery_date: o.delivery_date, delivery_location: o.delivery_location, po_status: o.status, inventory_status: o.inventory_status || 'expected', totals: totals(f), items: f.length } }

export async function listExpected({ status = 'all', q = '' } = {}) {
  let qry = LIVE(supabase.from('purchase_orders').select('*')).order('created_at', { ascending: false }).limit(500)
  const { data, error } = await qry
  if (error) { if (missing(error)) throw fail(error, 'listExpected'); throw fail(error, 'listExpected') }
  const orders = data || []
  const lines = await receiptLines(orders.map(o => o.id)).catch(() => [])
  const term = String(q).trim().toLowerCase()
  return orders.map(o => summary(o, lines.filter(l => l.po_id === o.id)))
    .filter(r => (status === 'all' || (status === 'open' ? !['fully_received', 'closed'].includes(r.inventory_status) : r.inventory_status === status)) && (!term || [r.number, r.supplier_name, r.title].some(v => String(v || '').toLowerCase().includes(term))))
}
export async function getExpected(id) {
  const o = unwrap(await LIVE(supabase.from('purchase_orders').select('*').eq('id', Number(id))).limit(1), 'getExpected')?.[0]
  if (!o) return null
  const [receipts, lines] = await Promise.all([
    unwrap(await supabase.from('goods_receipts').select('*').eq('po_id', o.id).order('received_at', { ascending: false }), 'getExpected:receipts') ?? [],
    receiptLines([o.id]),
  ])
  return { order: o, lines: lineFigures(o, lines), totals: totals(lineFigures(o, lines)), receipts: receipts.map(r => ({ ...r, lines: lines.filter(l => l.receipt_id === r.id) })) }
}

async function refreshStatus(poId) {
  const o = unwrap(await supabase.from('purchase_orders').select('*').eq('id', Number(poId)).single(), 'refreshStatus')
  const status = statusFor(o, lineFigures(o, await receiptLines([o.id])))
  if (status !== o.inventory_status) unwrap(await supabase.from('purchase_orders').update({ inventory_status: status }).eq('id', o.id).select('id').single(), 'refreshStatus:save')
  return status
}

/** Record a delivery. `lines`: [{ index, delivered, accepted, note }] — accepted defaults to delivered. */
export async function receive(poId, { delivery_note = '', notes = '', received_at = null, lines = [] }, user) {
  const cur = await getExpected(poId)
  if (!cur) throw invalid('This order is not on the inventory list: it must be approved and not cancelled.', 404)
  if (cur.order.inventory_closed_at) throw invalid('This order is closed. Reopen it to record another delivery.', 409)
  const rows = []
  for (const l of Array.isArray(lines) ? lines : []) {
    const index = Number(l.index), line = cur.lines[index]
    if (!line) throw invalid('One of the lines does not belong to this order.')
    const delivered = q3(l.delivered)
    if (!(delivered >= 0)) throw invalid(`${line.description}: delivered cannot be negative.`)
    if (delivered === 0) continue
    const accepted = l.accepted === undefined || l.accepted === '' || l.accepted === null ? delivered : q3(l.accepted)
    if (!(accepted >= 0) || accepted > delivered) throw invalid(`${line.description}: accepted must be between 0 and what was delivered (${delivered}).`)
    rows.push({ item_index: index, description: line.description, unit: line.unit, delivered, accepted, note: text(l.note, 500) })
  }
  if (!rows.length) throw invalid('Enter the quantity delivered for at least one line.')
  const receipt = await insertNumbered('goods_receipts', 'GR', { po_id: cur.order.id, delivery_note: text(delivery_note, 200), notes: text(notes), received_by: user.id, received_name: user.name || user.email || '', ...(received_at ? { received_at: new Date(received_at).toISOString() } : {}) }, null, 'Goods receipt')
  const { error } = await supabase.from('goods_receipt_lines').insert(rows.map(r => ({ ...r, receipt_id: receipt.id, po_id: cur.order.id })))
  if (error) { await supabase.from('goods_receipts').delete().eq('id', receipt.id); throw fail(error, 'receive') }
  await refreshStatus(cur.order.id)
  return { receipt, ...(await getExpected(cur.order.id)) }
}
export async function deleteReceipt(poId, receiptId) {
  const r = unwrap(await supabase.from('goods_receipts').select('*').eq('id', Number(receiptId)).eq('po_id', Number(poId)).limit(1), 'deleteReceipt')?.[0]
  if (!r) throw invalid('receipt not found', 404)
  unwrap(await supabase.from('goods_receipts').delete().eq('id', r.id), 'deleteReceipt')
  await refreshStatus(poId)
  return r
}
/** Closing accepts what has arrived as final (a short supply or a rejection is settled). */
export async function setClosed(poId, closed, { by, note = '' }) {
  const cur = await getExpected(poId)
  if (!cur) throw invalid('order not found', 404)
  unwrap(await supabase.from('purchase_orders').update(closed ? { inventory_closed_at: new Date().toISOString(), inventory_closed_by: by, inventory_note: text(note, 1000) } : { inventory_closed_at: null, inventory_closed_by: null }).eq('id', cur.order.id).select('id').single(), 'setClosed')
  await refreshStatus(cur.order.id)
  return getExpected(cur.order.id)
}

/** What is in stock: everything accepted, by item and unit, with where it came from. */
export async function stock() {
  const lines = unwrap(await supabase.from('goods_receipt_lines').select('description,unit,accepted,po_id,receipt_id'), 'stock') ?? []
  const by = new Map()
  for (const l of lines) {
    const key = `${String(l.description).trim().toLowerCase()}|${String(l.unit).trim().toLowerCase()}`
    const e = by.get(key) || { description: l.description, unit: l.unit, quantity: 0, orders: new Set() }
    e.quantity = q3(e.quantity + Number(l.accepted)); e.orders.add(l.po_id); by.set(key, e)
  }
  return [...by.values()].map(e => ({ description: e.description, unit: e.unit, quantity: e.quantity, orders: e.orders.size })).filter(e => e.quantity > 0).sort((a, b) => a.description.localeCompare(b.description))
}
export async function inventoryCounts() {
  const { data, error } = await LIVE(supabase.from('purchase_orders').select('inventory_status'))
  if (error) return { expected: 0, open: 0, disputed: 0 }
  const s = (data || []).map(r => r.inventory_status)
  return { expected: s.filter(x => x === 'expected').length, open: s.filter(x => ['expected', 'partially_received'].includes(x)).length, disputed: s.filter(x => x === 'disputed').length }
}
