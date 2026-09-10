/*
 * Quote PDF, rendered server-side with jsPDF (already a dependency for the
 * panel's table exports; it runs under Node without a browser). Used for
 * the email attachment, the admin preview and the public download, so all
 * three are byte-for-byte the same document.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const NAVY = [0, 26, 77], GREEN = [127, 190, 55], INK = [15, 23, 42], MUTED = [100, 116, 139], PAPER = [250, 248, 245]

export function formatMoney(value, currency = 'USD') {
  const n = Number(value) || 0
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' }).format(n).replace(/^([A-Z]{3})\s?/, '$1 ') }
  catch { return `${currency} ${n.toFixed(2)}` }
}
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const qty = n => { const v = Number(n) || 0; return Number.isInteger(v) ? String(v) : v.toFixed(2) }

/**
 * @param {object} quote      row from the quotes table
 * @param {object} settings   { company, quotes }
 * @param {object[]} fields   quote_fields definitions (for labels)
 * @param {string} [link]     public URL printed in the footer
 * @returns {Buffer}
 */
export function renderQuotePdf(quote, settings, fields = [], link = '') {
  const { company = {}, quotes: qs = {} } = settings
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 16
  const cur = quote.currency || 'USD'

  /* header band */
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, 'F')
  doc.setFillColor(...GREEN); doc.rect(0, 34, W, 1.5, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text(company.name || 'Vertoc Agro', M, 16)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text([company.address, [company.phone, company.email].filter(Boolean).join('  ·  ')].filter(Boolean), M, 23)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22)
  doc.text('QUOTATION', W - M, 16, { align: 'right' })
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text(quote.number, W - M, 24, { align: 'right' })

  /* meta + client */
  let y = 46
  doc.setTextColor(...MUTED); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
  doc.text('PREPARED FOR', M, y); doc.text('DETAILS', 120, y)
  doc.setTextColor(...INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5)
  const who = [quote.client_name || '—', quote.client_email].filter(Boolean)
  doc.text(who, M, y + 6)
  const meta = [['Date', fmtDate(quote.sent_at || quote.created_at)], ['Valid until', fmtDate(quote.valid_until)], ['Currency', cur]]
  meta.forEach(([k, v], i) => {
    doc.setTextColor(...MUTED); doc.text(k, 120, y + 6 + i * 5.5)
    doc.setTextColor(...INK); doc.text(String(v), W - M, y + 6 + i * 5.5, { align: 'right' })
  })
  y += 6 + Math.max(who.length, meta.length) * 5.5 + 6

  if (quote.title) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY)
    doc.text(String(quote.title), M, y); y += 8
  }

  /* items */
  const items = Array.isArray(quote.items) ? quote.items : []
  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['#', 'Description', 'Qty', 'Unit', 'Unit price', 'Amount']],
    body: items.map((it, i) => [i + 1, it.description, qty(it.quantity), it.unit || '', formatMoney(it.unit_price, cur), formatMoney(it.total, cur)]),
    styles: { fontSize: 9, cellPadding: 3, textColor: INK, lineColor: [231, 226, 217], lineWidth: 0.2 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: PAPER },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 2: { cellWidth: 16, halign: 'right' }, 3: { cellWidth: 18 }, 4: { cellWidth: 30, halign: 'right' }, 5: { cellWidth: 32, halign: 'right' } },
  })
  y = doc.lastAutoTable.finalY + 4

  /* totals */
  const rows = [['Subtotal', formatMoney(quote.subtotal, cur)]]
  if (Number(quote.discount) > 0) rows.push(['Discount', `- ${formatMoney(quote.discount, cur)}`])
  if (Number(quote.tax_rate) > 0) rows.push([`Tax (${Number(quote.tax_rate)}%)`, formatMoney(taxOf(quote), cur)])
  rows.push(['Total', formatMoney(quote.total, cur)])
  autoTable(doc, {
    startY: y, margin: { left: 120, right: M }, tableWidth: W - M - 120,
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
      startY: y, margin: { left: M, right: M }, body: extra, theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: 1.8, textColor: INK }, columnStyles: { 0: { cellWidth: 50, textColor: MUTED } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  /* prose blocks */
  y = prose(doc, 'Notes', quote.notes, y)
  y = prose(doc, 'Terms', quote.terms, y)
  y = prose(doc, 'Payment', qs.payment_text, y)

  /* footer on every page */
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
    doc.text(`${quote.number}  ·  ${company.name || 'Vertoc Agro'}${link ? `  ·  View online: ${link}` : ''}`, M, 290)
    doc.text(`Page ${p} of ${pages}`, W - M, 290, { align: 'right' })
  }
  return Buffer.from(doc.output('arraybuffer'))
}

export const taxOf = q => {
  const taxable = Math.max((Number(q.subtotal) || 0) - (Number(q.discount) || 0), 0)
  return Math.round(taxable * (Number(q.tax_rate) || 0)) / 100
}

const display = (f, v) => f.type === 'checkbox' ? (v ? 'Yes' : '') : (v && typeof v === 'object' ? (v.name || '') : (v ?? ''))

function section(doc, title, y) {
  if (y > 262) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GREEN)
  doc.text(title.toUpperCase(), 16, y)
  return y + 4
}
function prose(doc, title, text, y) {
  const t = String(text || '').trim(); if (!t) return y
  y = section(doc, title, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK)
  const lines = doc.splitTextToSize(t, 210 - 32)
  for (const line of lines) {
    if (y > 280) { doc.addPage(); y = 20 }
    doc.text(line, 16, y); y += 4.6
  }
  return y + 6
}
