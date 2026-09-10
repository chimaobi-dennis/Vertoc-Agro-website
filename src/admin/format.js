/* Display helpers shared by the sales screens. */
export const fmtMoney = (v, cur = 'USD') => {
  const n = Number(v) || 0
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n) } catch { return `${cur} ${n.toFixed(2)}` }
}
export const fmtBytes = b => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`)
export const fmtDate = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtDateTime = iso => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

export const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired']
export const PURCHASE_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
export const quoteTone = s => ({ draft: 'muted', sent: 'blue', viewed: 'amber', accepted: 'green', declined: 'red', expired: 'muted' })[s] || 'muted'
export const purchaseTone = s => ({ pending: 'amber', paid: 'green', shipped: 'blue', delivered: 'green', cancelled: 'red' })[s] || 'muted'
export const messageTone = s => ({ sent: 'green', failed: 'red', queued: 'amber' })[s] || 'muted'

/** Open a URL in a new tab from an async flow without tripping popup blockers. */
export function openInNewTab(promiseOfUrl) {
  const w = window.open('', '_blank', 'noopener')
  return promiseOfUrl.then(url => { if (w) w.location = url; else window.location.assign(url) })
    .catch(e => { w?.close(); throw e })
}
