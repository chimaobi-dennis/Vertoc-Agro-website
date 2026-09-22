/* Shipment helpers shared by the panel and the public invoice page. */
export const SHIPMENT_LABELS = { planned: 'Planned', in_transit: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled' }
export const shipmentTone = s => ({ planned: 'muted', in_transit: 'blue', delivered: 'green', cancelled: 'red' })[s] || 'muted'
/** "25" or "12.5" — percents without trailing zeros. */
export const fmtPct = v => { const n = Number(v) || 0; return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '') }
const qty = n => { const v = Number(n) || 0; return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '') }
/** What a share of the invoice amounts to, per line item: ["5 MT Cocoa beans", …]. */
export const shareOf = (items, percent) => (items || []).filter(it => Number(it.quantity) > 0 && it.description).map(it => `${qty((Number(it.quantity) || 0) * (Number(percent) || 0) / 100)} ${it.unit || ''} ${it.description}`.replace(/\s+/g, ' ').trim())
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
export const hasPoint = p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
