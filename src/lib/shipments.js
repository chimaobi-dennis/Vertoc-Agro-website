/* Shipment helpers shared by the panel and the public invoice page. */
export const SHIPMENT_LABELS = { planned: 'Planned', in_transit: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled' }
export const shipmentTone = s => ({ planned: 'muted', in_transit: 'blue', delivered: 'green', cancelled: 'red' })[s] || 'muted'
export const SHIPMENT_MODES = ['road', 'sea', 'air']
export const MODE_LABELS = { road: 'By road', sea: 'By sea', air: 'By air' }
export const VEHICLE_LABELS = { road: 'Truck number', sea: 'Vessel / container number', air: 'Flight / air waybill number' }
export const VEHICLE_HINTS = { road: 'Plate number, e.g. NT456UH', sea: 'e.g. MSC Ines / MSCU1234567', air: 'e.g. ET900 / 071-12345675' }
/** "25" or "12.5" — percents without trailing zeros. */
export const fmtPct = v => { const n = Number(v) || 0; return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '') }
export const qtyText = n => { const v = Number(n) || 0; return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '') }
/**
 * What a shipment carries, per invoice line: [{ index, description, percent, quantity, unit, text }].
 * Shipments made before per-line shares carry `percent` of every line.
 */
export function shareLines(shipment, invoiceItems) {
  const own = Array.isArray(shipment?.items) && shipment.items.length ? shipment.items : null
  const src = own || (invoiceItems || []).map((it, index) => ({ index, description: it.description, quantity: it.quantity, unit: it.unit, percent: shipment?.percent }))
  return src.filter(x => Number(x.percent) > 0).map(x => {
    const quantity = (Number(x.quantity) || 0) * Number(x.percent) / 100
    const approx = Number(x.quantity) > 0 ? ` (≈ ${qtyText(quantity)} ${x.unit || ''})`.replace(/\s+\)/, ')') : ''
    return { index: x.index, description: x.description, percent: Number(x.percent), quantity, unit: x.unit || '', text: `${fmtPct(x.percent)}% of ${x.description}${approx}` }
  })
}
/** "3 minutes ago", "2 days ago". */
export function ago(iso) {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60; if (m < 60) return `${Math.floor(m)} min ago`
  const h = m / 60; if (h < 24) return `${Math.floor(h)} hour${Math.floor(h) === 1 ? '' : 's'} ago`
  const d = h / 24; if (d < 30) return `${Math.floor(d)} day${Math.floor(d) === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
export const fmtEta = d => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '')
/** A usable pin: both coordinates present and finite (null is NOT a coordinate). */
export const hasPoint = p => p != null && p.lat != null && p.lng != null && p.lat !== '' && p.lng !== '' && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
