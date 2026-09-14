/*
 * Invoice PDF (the API and database still call it a quote), rendered
 * server-side with jsPDF — it runs under Node without a browser. Used for
 * the email attachment, the admin preview and the public download, so all
 * three are byte-for-byte the same document.
 *
 * The page reproduces the company letterhead: logo top-left, contact block
 * top-right, three short coloured rules, a green bar with the RC number, the
 * navy footer band with the address and tagline, and the RC/TIN line under
 * it. Every value comes from Settings → Company and Settings → Invoices.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const NAVY = [24, 40, 100], GREEN = [127, 190, 55], INK = [15, 23, 42], MUTED = [100, 116, 139], PAPER = [250, 248, 245]
const W = 210, H = 297, M = 18
const TOP = 40      // the body starts here, under the letterhead
const BOTTOM = 252  // and must stop here, above the footer
const DEFAULT_LOGO = '/assets/img/logo-print.png'
const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')   // not process.cwd(): the server may be started from elsewhere

export function formatMoney(value, currency = 'USD') {
  const n = Number(value) || 0
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' }).format(n).replace(/^([A-Z]{3})\s?/, '$1 ') }
  catch { return `${currency} ${n.toFixed(2)}` }
}
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const qty = n => { const v = Number(n) || 0; return Number.isInteger(v) ? String(v) : v.toFixed(2) }

/**
 * @param {object} quote      row from the quotes table
 * @param {object} settings   { company, quotes, site }
 * @param {object[]} fields   quote_fields definitions (for labels)
 * @param {string} [link]     public URL printed (and clickable) in the body
 * @returns {Promise<Buffer>}
 */
export async function renderQuotePdf(quote, settings, fields = [], link = '') {
  const { company = {}, quotes: qs = {}, site = {} } = settings
  const [logo, signature] = await Promise.all([loadImage(qs.logo || site.logo || DEFAULT_LOGO), loadImage(qs.signature)])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const cur = quote.currency || 'USD'
  const margin = { left: M, right: M, top: TOP, bottom: H - BOTTOM }

  /* title row: INVOICE + number on the left, dates on the right */
  let y = TOP + 8
  doc.setFont('times', 'bold'); doc.setFontSize(26); doc.setTextColor(...NAVY)
  doc.text('INVOICE', M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...MUTED)
  doc.text(String(quote.number || ''), M, y + 6.5)
  const meta = [['Date', fmtDate(quote.sent_at || quote.created_at)], ['Valid until', fmtDate(quote.valid_until)], ['Currency', cur]]
  doc.setFontSize(9.5)
  meta.forEach(([k, v], i) => {
    const yy = TOP + 2 + i * 5.5
    doc.setTextColor(...MUTED); doc.text(k, 130, yy)
    doc.setTextColor(...INK); doc.text(String(v), W - M, yy, { align: 'right' })
  })
  y += 17

  /* bill to */
  doc.setTextColor(...MUTED); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
  doc.text('BILL TO', M, y)
  doc.setTextColor(...INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5)
  const who = [quote.client_name || '—', quote.client_email].filter(Boolean)
  doc.text(who, M, y + 5.5)
  y += 5.5 + who.length * 5.2 + 6

  if (quote.title) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...NAVY)
    doc.text(String(quote.title), M, y); y += 8
  }

  /* items */
  const items = Array.isArray(quote.items) ? quote.items : []
  autoTable(doc, {
    startY: y, margin,
    head: [['#', 'Description', 'Qty', 'Unit', 'Unit price', 'Amount']],
    body: items.map((it, i) => [i + 1, it.description, qty(it.quantity), it.unit || '', formatMoney(it.unit_price, cur), formatMoney(it.total, cur)]),
    styles: { fontSize: 9, cellPadding: 3, textColor: INK, lineColor: [231, 226, 217], lineWidth: 0.2 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: PAPER },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 2: { cellWidth: 16, halign: 'right' }, 3: { cellWidth: 16 }, 4: { cellWidth: 36, halign: 'right' }, 5: { cellWidth: 40, halign: 'right' } },
  })
  y = doc.lastAutoTable.finalY + 4

  /* totals */
  const rows = [['Subtotal', formatMoney(quote.subtotal, cur)]]
  if (Number(quote.discount) > 0) rows.push(['Discount', `- ${formatMoney(quote.discount, cur)}`])
  if (Number(quote.tax_rate) > 0) rows.push([`Tax (${Number(quote.tax_rate)}%)`, formatMoney(taxOf(quote), cur)])
  rows.push(['Total', formatMoney(quote.total, cur)])
  autoTable(doc, {
    startY: y, margin: { ...margin, left: 120 }, tableWidth: W - M - 120,
    body: rows, theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: 2, textColor: INK },
    columnStyles: { 0: { textColor: MUTED }, 1: { halign: 'right' } },
    didParseCell: h => { if (h.row.index === rows.length - 1) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.fontSize = 11.5; h.cell.styles.textColor = NAVY } },
  })
  y = doc.lastAutoTable.finalY + 8

  /* user-defined fields */
  const extra = fields.map(f => [f.label, display(f, quote.data?.[f.key])]).filter(([, v]) => v)
  if (extra.length) {
    y = section(doc, 'Details', y)
    autoTable(doc, {
      startY: y, margin, body: extra, theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: 1.8, textColor: INK }, columnStyles: { 0: { cellWidth: 50, textColor: MUTED } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  /* prose blocks */
  y = prose(doc, 'Notes', quote.notes, y)
  y = prose(doc, 'Terms', quote.terms, y)
  y = prose(doc, 'Payment', qs.payment_text, y)

  /* the unique online link, clickable */
  if (link) {
    y = section(doc, 'View & respond online', y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...NAVY)
    doc.textWithLink(link, M, y, { url: link })
    y += 10
  }

  /* signature block, bottom right of the content */
  const signatory = String(qs.signatory || '').trim()
  if (signature || signatory) {
    const boxW = 60, x = W - M - boxW
    let h = signature ? Math.min(22, boxW * signature.height / signature.width) : 16
    if (y + h + 14 > BOTTOM) { doc.addPage(); y = TOP }
    if (signature) {
      const sw = h === 22 ? 22 * signature.width / signature.height : boxW
      doc.addImage(signature.data, signature.format, x + (boxW - sw), y, sw, h)
    }
    y += h + 2
    doc.setDrawColor(...INK); doc.setLineWidth(0.3); doc.line(x, y, x + boxW, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED)
    doc.text(signatory || 'Authorised signatory', x + boxW, y + 4.5, { align: 'right' })
  }

  /* letterhead on every page */
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) { doc.setPage(p); letterhead(doc, p, pages, { company, quote, logo }) }
  return Buffer.from(doc.output('arraybuffer'))
}

export const taxOf = q => {
  const taxable = Math.max((Number(q.subtotal) || 0) - (Number(q.discount) || 0), 0)
  return Math.round(taxable * (Number(q.tax_rate) || 0)) / 100
}

const display = (f, v) => f.type === 'checkbox' ? (v ? 'Yes' : '') : (v && typeof v === 'object' ? (v.name || '') : (v ?? ''))

function section(doc, title, y) {
  if (y > BOTTOM - 14) { doc.addPage(); y = TOP }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GREEN)
  doc.text(title.toUpperCase(), M, y)
  return y + 4.5
}
function prose(doc, title, text, y) {
  const t = String(text || '').trim(); if (!t) return y
  y = section(doc, title, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK)
  const lines = doc.splitTextToSize(t, W - 2 * M)
  for (const line of lines) {
    if (y > BOTTOM - 4) { doc.addPage(); y = TOP }
    doc.text(line, M, y); y += 4.6
  }
  return y + 6
}

/** Header and footer drawn on one page, matching the printed letterhead. */
function letterhead(doc, p, pages, { company, quote, logo }) {
  /* header: logo left, contact block right, three short rules */
  if (logo) {
    let w = 54, h = w * logo.height / logo.width
    if (h > 20) { h = 20; w = h * logo.width / logo.height }
    doc.addImage(logo.data, logo.format, M, 9, w, h)
  } else {
    doc.setFont('times', 'bold'); doc.setFontSize(20); doc.setTextColor(...NAVY)
    doc.text(String(company.name || 'Vertoc Agro'), M, 20)
  }
  const website = String(company.website || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')
  doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK)
  ;[company.email, company.phone, website].filter(Boolean).forEach((t, i) => doc.text(String(t), W - M, 13 + i * 4.6, { align: 'right' }))
  doc.setFillColor(...GREEN); doc.rect(21, 29, 18, 0.8, 'F'); doc.rect(131, 29, 18, 0.8, 'F')
  doc.setFillColor(...NAVY); doc.rect(73, 29, 20, 0.8, 'F')

  /* footer: page label, green bar with the RC number, navy band, RC/TIN */
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED)
  doc.text(`${quote.number || ''}  ·  Page ${p} of ${pages}`, M, 257)
  const rc = String(company.rc_number || '').trim()
  doc.setFillColor(...GREEN)
  if (rc) {
    doc.rect(4, 260, 146, 1.8, 'F'); doc.rect(178, 260, 28, 1.8, 'F')
    doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK)
    doc.text(`RC: ${rc}`, 164, 262.2, { align: 'center' })
  } else doc.rect(4, 260, 202, 1.8, 'F')
  doc.setFillColor(...NAVY); doc.rect(0, 265, W, 12, 'F')
  doc.setTextColor(255)
  const address = String(company.address || '').trim()
  if (address) {
    doc.setFont('times', 'bold')
    let size = 9.5; doc.setFontSize(size)
    while (size > 7 && doc.getTextWidth(address) > W - 16) { size -= 0.5; doc.setFontSize(size) }
    doc.text(address, W / 2, 270, { align: 'center' })
  }
  const tagline = String(company.tagline || '').trim()
  if (tagline) { doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.text(tagline, W / 2, 274.5, { align: 'center' }) }
  const tin = String(company.tin || '').trim()
  if (tin) {
    doc.setFont('times', 'normal'); doc.setFontSize(9); doc.setTextColor(...NAVY)
    doc.text(`${rc ? `RC: ${rc}    ` : ''}TIN: ${tin}`, W - M, 283, { align: 'right' })
  }
}

/* ------------------------------------------------------------- images --- */
// The logo and signature are read from public/ on disk when that exists
// (local dev), otherwise fetched from the live site. Absolute URLs (uploads
// in the media bucket) are fetched directly. Cached per process; a failed
// load is skipped, never fatal — the PDF just goes out without the image.
const cache = new Map()

async function loadImage(src) {
  src = String(src || '').trim()
  if (!src) return null
  if (cache.has(src)) return cache.get(src)
  const p = (async () => {
    try {
      let bytes = null
      if (/^https?:\/\//i.test(src)) bytes = await fetchBytes(src)
      else {
        const rel = src.replace(/^\/+/, '')
        try { bytes = await readFile(path.join(PUBLIC_DIR, rel)) }
        catch {
          const base = (process.env.SITE_URL || process.env.ADMIN_URL || '').replace(/\/$/, '')
          if (base) bytes = await fetchBytes(`${base}/${rel}`)
        }
      }
      if (!bytes?.length) return null
      const format = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'JPEG' : bytes[0] === 0x89 && bytes[1] === 0x50 ? 'PNG' : null
      if (!format) return null
      const data = new Uint8Array(bytes)
      const { width, height } = new jsPDF().getImageProperties(data)
      if (!width || !height) return null
      return { data, format, width, height }
    } catch (e) {
      console.warn('[invoice-pdf] image skipped:', src, e.message)
      return null
    }
  })()
  cache.set(src, p)
  p.then(v => { if (!v) cache.delete(src) })
  return p
}

async function fetchBytes(url) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return Buffer.from(await r.arrayBuffer())
  } finally { clearTimeout(t) }
}
