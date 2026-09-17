/* Display helpers shared by the sales screens. */
export const fmtMoney = (v, cur = 'USD') => {
  const n = Number(v) || 0
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n) } catch { return `${cur} ${n.toFixed(2)}` }
}
export const fmtBytes = b => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`)
export const fmtDate = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
// Same thread key as the server: one subject (Re:/Fwd: ignored) with one client record or address.
export const cleanSubject = s => String(s || '').replace(/^\s*((re|fwd?|fw|aw|sv|tr|wg)\s*:\s*)+/i, '').replace(/\s+/g, ' ').trim()
export const threadKeyOf = m => `${m.client_id != null ? `c${m.client_id}` : `e:${String((m.direction === 'in' ? m.from_email : m.to_email) || '').toLowerCase()}`}|${cleanSubject(m.subject).toLowerCase() || '(no subject)'}`
export const fmtShort = iso => { const d = new Date(iso); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
export const fmtDateTime = iso => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

export const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired']
export const PURCHASE_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
export const quoteTone = s => ({ draft: 'muted', sent: 'blue', viewed: 'amber', accepted: 'green', declined: 'red', expired: 'muted' })[s] || 'muted'
export const purchaseTone = s => ({ pending: 'amber', paid: 'green', shipped: 'blue', delivered: 'green', cancelled: 'red' })[s] || 'muted'
export const messageTone = s => ({ sent: 'green', failed: 'red', queued: 'amber' })[s] || 'muted'

/** Open a URL in a new tab from an async flow without tripping popup blockers. */
export function openInNewTab(promiseOfUrl) {
  // Opened synchronously (inside the click) so popup blockers allow it. No
  // 'noopener' here: that makes window.open return null, which used to send
  // the *current* tab to the blob URL. The blob is same-origin, so it is safe.
  const w = window.open('', '_blank')
  if (w) { try { w.opener = null; w.document.title = 'Preparing PDF…'; w.document.body.innerHTML = '<p style="font:14px system-ui;padding:24px;color:#555">Preparing the PDF…</p>' } catch {} }
  return promiseOfUrl.then(url => { if (w && !w.closed) w.location.replace(url); else window.open(url, '_blank') })
    .catch(e => { w?.close(); throw e })
}
