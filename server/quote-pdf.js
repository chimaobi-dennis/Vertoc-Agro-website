/*
 * Invoice PDF (the API and database still call it a quote) and purchase
 * order PDF (PO / LPO), rendered
 * server-side with jsPDF; it runs under Node without a browser. Used for
 * the email attachment, the admin preview and the public download, so all
 * three are byte-for-byte the same document. This is the original design:
 * navy header band with the company block and the title, green rule,
 * prepared-for / details, items, totals, fields, notes, terms, payment, and
 * a footer line with the number, company, online link and page count.
 * (server/fonts/ holds an embeddable Century Gothic look-alike, not used
 * here; the design keeps the built-in Helvetica.)
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
 * @returns {Promise<Buffer>}
 */
export async function renderQuotePdf(quote, settings, fields = [], link = '') {
  const { company = {}, quotes: qs = {} } = settings
  return renderDocument({
    company, link, title: 'INVOICE', number: quote.number, heading: quote.title, currency: quote.currency || 'USD',
    party: { label: 'PREPARED FOR', lines: [quote.client_name || '—', quote.client_email] },
    meta: [['Date', fmtDate(quote.sent_at || quote.created_at)], ['Valid until', fmtDate(quote.valid_until)], ['Currency', quote.currency || 'USD']],
    money: quote, details: fields.map(f => [f.label, display(f, quote.data?.[f.key])]),
    prose: [['Notes', quote.notes], ['Terms', quote.terms], ['Payment', qs.payment_text]],
  })
}

/**
 * Purchase order (PO) or local purchase order (LPO): the same sheet as the
 * invoice, addressed to a supplier, with where and when to deliver and the
 * payment terms.
 * @param {object} po         row from purchase_orders
 * @param {object} settings   { company }
 * @param {string} [link]     the supplier's link, printed in the footer
 * @returns {Promise<Buffer>}
 */
export async function renderPurchaseOrderPdf(po, settings, link = '') {
  const { company = {} } = settings
  const cur = po.currency || 'NGN'
  return renderDocument({
    company, link, title: po.kind === 'po' ? 'PURCHASE ORDER' : 'LOCAL PURCHASE ORDER', number: po.number, heading: po.title, currency: cur,
    party: { label: 'SUPPLIER', lines: [po.supplier_name || '—', ...String(po.supplier_address || '').split('\n'), po.supplier_email] },
    meta: [['Date', fmtDate(po.issued_at || po.created_at)], ['Deliver by', fmtDate(po.delivery_date)], ['Currency', cur]],
    money: po, details: [['Deliver to', po.delivery_location]],
    prose: [['Payment terms', po.payment_terms], ['Notes', po.notes], ['Terms', po.terms]],
    viewLabel: 'Acknowledge online',
  })
}

/** The sheet both documents share: header band, party and details, items, totals, fields, prose, footer. */
async function renderDocument({ company, link, title, number, heading, currency: cur, party, meta, money: sums, details = [], prose: blocks = [], viewLabel = 'View online', table = null, signatures = null }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 16
  const titleSize = title.length > 10 ? 17 : 22

  /* header band. The company block wraps inside the space left of the
     title and number (never runs into them); the band grows to fit. */
  doc.setFont('helvetica', 'bold'); doc.setFontSize(titleSize); const titleW = doc.getTextWidth(title)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); const numberW = doc.getTextWidth(String(number || ''))
  const blockW = W - 2 * M - Math.max(titleW, numberW) - 12
  doc.setFontSize(9)
  const contact = [company.phone, company.email].filter(Boolean).join('  ·  ')
  const block = [...doc.splitTextToSize(String(company.address || ''), blockW), ...doc.splitTextToSize(contact, blockW)].filter(Boolean)
  const bandH = Math.max(34, 23 + block.length * 4.2 + 3)
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, bandH, 'F')
  doc.setFillColor(...GREEN); doc.rect(0, bandH, W, 1.5, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text(company.name || 'Vertoc Agro', M, 16)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text(block, M, 23)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(titleSize)
  doc.text(title, W - M, 16, { align: 'right' })
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text(String(number || ''), W - M, 24, { align: 'right' })

  /* meta + party */
  let y = bandH + 12
  doc.setTextColor(...MUTED); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
  doc.text(party.label, M, y); doc.text('DETAILS', 120, y)
  doc.setTextColor(...INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5)
  const who = party.lines.map(l => String(l || '').trim()).filter(Boolean).flatMap(l => doc.splitTextToSize(l, 96))
  doc.text(who, M, y + 6)
  meta.forEach(([k, v], i) => {
    doc.setTextColor(...MUTED); doc.text(k, 120, y + 6 + i * 5.5)
    doc.setTextColor(...INK); doc.text(String(v), W - M, y + 6 + i * 5.5, { align: 'right' })
  })
  y += 6 + Math.max(who.length, meta.length) * 5.5 + 6

  if (heading) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY)
    const lines = doc.splitTextToSize(String(heading), W - 2 * M)
    doc.text(lines, M, y); y += 8 + (lines.length - 1) * 5.5
  }

  /* items */
  const items = Array.isArray(sums?.items) ? sums.items : []
  if (table) autoTable(doc, { startY: y, margin: { left: M, right: M }, head: [table.head], body: table.body, foot: table.foot ? [table.foot] : undefined,
    styles: { fontSize: 9, cellPadding: 3, textColor: INK, lineColor: [231, 226, 217], lineWidth: 0.2 }, headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: PAPER, textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: PAPER }, columnStyles: table.columnStyles || {} })
  else autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['#', 'Description', 'Qty', 'Unit', 'Unit price', 'Amount']],
    body: items.map((it, i) => [i + 1, it.description, qty(it.quantity), it.unit || '', formatMoney(it.unit_price, cur), formatMoney(it.total, cur)]),
    styles: { fontSize: 9, cellPadding: 3, textColor: INK, lineColor: [231, 226, 217], lineWidth: 0.2 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: PAPER },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 2: { cellWidth: 16, halign: 'right' }, 3: { cellWidth: 16 }, 4: { cellWidth: 36, halign: 'right' }, 5: { cellWidth: 40, halign: 'right' } },
  })
  y = doc.lastAutoTable.finalY + 4

  /* totals */
  if (sums) {
  const rows = [['Subtotal', formatMoney(sums.subtotal, cur)]]
  if (Number(sums.discount) > 0) rows.push(['Discount', `- ${formatMoney(sums.discount, cur)}`])
  if (Number(sums.tax_rate) > 0) rows.push([`Tax (${Number(sums.tax_rate)}%)`, formatMoney(taxOf(sums), cur)])
  rows.push(['Total', formatMoney(sums.total, cur)])
  autoTable(doc, {
    startY: y, margin: { left: 120, right: M }, tableWidth: W - M - 120,
    body: rows, theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: 2, textColor: INK },
    columnStyles: { 0: { textColor: MUTED }, 1: { halign: 'right' } },
    didParseCell: h => { if (h.row.index === rows.length - 1) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.fontSize = 11.5; h.cell.styles.textColor = NAVY } },
  })
  y = doc.lastAutoTable.finalY + 8
  } else y += 4

  /* labelled details (user-defined invoice fields; where to deliver an order) */
  const extra = details.filter(([, v]) => v)
  if (extra.length) {
    y = section(doc, 'Details', y)
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, body: extra, theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: 1.8, textColor: INK }, columnStyles: { 0: { cellWidth: 50, textColor: MUTED } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  /* prose blocks */
  for (const [label, body] of blocks) y = prose(doc, label, body, y)

  /* signature lines (goods receipt note) */
  if (signatures) {
    if (y > 235) { doc.addPage(); y = 24 }
    y += 8
    const colW = (W - 2 * M - 12 * (signatures.length - 1)) / signatures.length
    signatures.forEach((label, i) => {
      const x = M + i * (colW + 12)
      doc.setDrawColor(...MUTED); doc.setLineWidth(0.3); doc.line(x, y + 14, x + colW, y + 14)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED)
      doc.text(label, x, y + 19); doc.text('Name / Signature / Date', x, y + 23.5)
    })
  }

  /* footer on every page */
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
    doc.text(`${number}  ·  ${company.name || 'Vertoc Agro'}${link ? `  ·  ${viewLabel}: ${link}` : ''}`, M, 290)
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


const q3 = v => { const n = Number(v) || 0; return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000) }
/**
 * Goods receipt note: what arrived against an order, what was accepted after checking, what was rejected and what is still
 * outstanding. No prices. Signature lines for the receiving officer, the delivery person and a witness.
 * @param {{ order: object, receipt: object, lines: object[], totals: object, outstanding: object }} grn  see store/inventory.js grnData
 */
export async function renderGrnPdf(grn, settings, link = '') {
  const { company = {} } = settings
  const { order, receipt, lines } = grn
  const rejectedOf = l => Math.max(0, Number(l.delivered) - Number(l.accepted))
  const body = lines.map((l, i) => [i + 1, l.description, l.unit || '', q3(l.ordered), q3(l.delivered), q3(l.accepted), rejectedOf(l) ? q3(rejectedOf(l)) : '—', q3(l.outstanding)])
  const sum = k => q3(lines.reduce((s, l) => s + (k === 'rejected' ? rejectedOf(l) : Number(l[k]) || 0), 0))
  const remarks = lines.filter(l => l.note).map(l => `${l.description}: ${l.note}`)
  return renderDocument({
    company, link, title: 'GOODS RECEIPT NOTE', number: receipt.number, heading: order.title || `Goods received against ${order.number}`, currency: order.currency || 'NGN',
    party: { label: 'RECEIVED FROM (SUPPLIER)', lines: [order.supplier_name || '—', ...String(order.supplier_address || '').split('\n'), order.supplier_email] },
    meta: [['Date received', fmtDate(receipt.received_at)], ['Order reference', order.number], ['Delivery note', receipt.delivery_note || '—'], ['Received by', receipt.received_name || '—']],
    money: null,
    table: {
      head: ['#', 'Description', 'Unit', 'Ordered', 'Delivered', 'Accepted', 'Rejected', 'Outstanding'], body,
      foot: ['', 'Total', '', sum('ordered'), sum('delivered'), sum('accepted'), sum('rejected'), sum('outstanding')],
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 2: { cellWidth: 14 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    },
    details: [['Delivery location', order.delivery_location], ['Expected delivery', order.delivery_date ? fmtDate(order.delivery_date) : '']],
    prose: [['Remarks on the goods', remarks.join('\n')], ['Notes', receipt.notes], ['About the figures', 'Accepted is what passed counting, weighing and quality checks and was taken into stock. Rejected is what arrived but was not accepted. Outstanding is what is still to be supplied against the order after this delivery.']],
    signatures: ['Received by (Inventory)', 'Delivered by (Supplier / driver)', 'Witness'],
    viewLabel: 'Reference',
  })
}
