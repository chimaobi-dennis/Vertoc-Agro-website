/* Procurement helpers shared by the panel, the bidding pages and the supplier dashboard. */

export const BID_STATUSES = ['open', 'under_review', 'shortlisted', 'awarded', 'not_selected', 'withdrawn']
export const BID_LABELS = { open: 'Open', under_review: 'Under review', shortlisted: 'Shortlisted', awarded: 'Awarded', not_selected: 'Not selected', withdrawn: 'Withdrawn' }
/** The path a bid travels, for the progress strip: the last step is decided by the outcome. */
export const BID_PATH = ['open', 'under_review', 'shortlisted', 'awarded']
export const bidTone = s => ({ open: 'amber', under_review: 'blue', shortlisted: 'accent', awarded: 'green', not_selected: 'muted', withdrawn: 'red' })[s] || 'muted'
export const BID_EXPLAINED = {
  open: 'Received and waiting for review.',
  under_review: 'Our procurement team is reviewing this bid.',
  shortlisted: 'On our shortlist. We may ask for more information before deciding.',
  awarded: 'Selected. Our purchase order follows.',
  not_selected: 'Not selected this time.',
  withdrawn: 'Withdrawn by the supplier.',
}

export const TENDER_LABELS = { draft: 'Draft', upcoming: 'Opens soon', open: 'Open for bids', closed: 'Closed', awarded: 'Awarded', cancelled: 'Cancelled', published: 'Published' }
export const tenderTone = s => ({ draft: 'muted', upcoming: 'blue', open: 'green', closed: 'muted', awarded: 'accent', cancelled: 'red' })[s] || 'muted'

export const PO_KINDS = { po: 'Purchase Order', lpo: 'Local Purchase Order' }
export const PO_SHORT = { po: 'PO', lpo: 'LPO' }
export const PO_STATUSES = ['draft', 'issued', 'acknowledged', 'declined', 'fulfilled', 'cancelled']
export const poTone = s => ({ draft: 'muted', issued: 'blue', acknowledged: 'green', declined: 'red', fulfilled: 'accent', cancelled: 'muted' })[s] || 'muted'

/** ₦650,000 — the currency's own symbol, and decimals only when there are any. */
export function money(v, cur = 'NGN') {
  const n = Number(v) || 0
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n) }
  catch { return `${cur} ${n.toLocaleString('en-NG')}` }
}
export const qty = (n, unit = '') => `${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 3 }).format(Number(n) || 0)}${unit ? ` ${unit}` : ''}`
export const perUnit = (v, cur, unit) => (v == null || v === '' ? '—' : `${money(v, cur)} / ${unit || 'MT'}`)
export const pct = v => (v == null ? '' : `${v > 0 ? '+' : ''}${Number(v).toLocaleString('en-NG', { maximumFractionDigits: 1 })}%`)

export const fmtDay = iso => (iso ? new Date(String(iso).length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtMoment = iso => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
/** "closes in 3 days", "closed 2 days ago", "opens in 5 hours". */
export function fromNow(iso) {
  if (!iso) return ''
  const s = (new Date(iso).getTime() - Date.now()) / 1000, a = Math.abs(s)
  const n = a < 3600 ? [Math.max(1, Math.round(a / 60)), 'minute'] : a < 86400 ? [Math.round(a / 3600), 'hour'] : [Math.round(a / 86400), 'day']
  const t = `${n[0]} ${n[1]}${n[0] === 1 ? '' : 's'}`
  return s >= 0 ? `in ${t}` : `${t} ago`
}
/** <input type="datetime-local"> speaks local time without a zone; the API speaks ISO. */
export const toLocalInput = iso => { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
export const fromLocalInput = v => (v ? new Date(v).toISOString() : null)

export const BID_DECLARATION = 'I confirm that the information provided is accurate and that I am able to supply the stated quantity in accordance with the specifications, delivery requirements and payment terms stated in this bidding opportunity.'
export const FILE_LABELS = ['Company registration documents', 'CAC documents', 'Commodity specification / quality certificate', 'Previous supply references', 'Other supporting document']
export const FILE_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt'
export const FILE_MAX_BYTES = 20 * 1024 * 1024
const BY_EXT = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
}
export const fileType = file => file.type || BY_EXT[file.name.split('.').pop().toLowerCase()] || 'application/octet-stream'
export const fileSize = b => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`)
