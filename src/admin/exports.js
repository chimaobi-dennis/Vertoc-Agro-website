/* Client-side table exports. Columns are [{ label, get(row) }], so they follow
   the user-defined client fields without any server involvement. */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const cell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export function downloadCsv(filename, columns, rows) {
  const lines = [columns.map(c => cell(c.label)).join(','), ...rows.map(r => columns.map(c => cell(c.get(r))).join(','))]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  trigger(filename, URL.createObjectURL(blob))
}

export function downloadPdf(filename, title, columns, rows) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'mm' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(title, 14, 18)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120)
  doc.text(`${rows.length} record${rows.length === 1 ? '' : 's'} · exported ${new Date().toLocaleString()}`, 14, 24)
  autoTable(doc, {
    startY: 29,
    head: [columns.map(c => c.label)],
    body: rows.map(r => columns.map(c => c.get(r) ?? '')),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [0, 26, 77], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 245, 241] },
  })
  doc.save(filename)
}

function trigger(filename, href) {
  const a = document.createElement('a'); a.href = href; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
