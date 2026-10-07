/* The record of bid invitations sent to suppliers (migration 020). Supabase only. */
import { supabase } from './supabase.js'

export const NOTICES_HINT = 'This needs the database migration 020: run server/migrations/020_tender_notices.sql in the Supabase SQL editor first.'
const missing = e => ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e?.code)
const fail = (e, ctx) => (missing(e) ? Object.assign(new Error(NOTICES_HINT), { expose: true, status: 409 }) : new Error(`${ctx}: ${e.message}`))

export async function listNotices(tenderId) {
  const { data, error } = await supabase.from('tender_notices').select('*').eq('tender_id', Number(tenderId)).order('created_at', { ascending: false }).limit(1000)
  if (error) throw fail(error, 'listNotices')
  return data || []
}
export async function recordNotice(row) {
  const { data, error } = await supabase.from('tender_notices').insert(row).select().single()
  if (error) throw fail(error, 'recordNotice')
  return data
}
/** Suppliers who have a bid in play on the opportunity (a withdrawn bid does not count). */
export async function biddersOf(tenderId) {
  const { data, error } = await supabase.from('bids').select('supplier_id,status').eq('tender_id', Number(tenderId))
  if (error) throw new Error(`biddersOf: ${error.message}`)
  return new Set((data || []).filter(b => b.status !== 'withdrawn' && b.supplier_id != null).map(b => b.supplier_id))
}
