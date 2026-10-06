/* Totals for a period, one block per module the person may see. */
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Button, Card, Field, Input, PageHeader } from './ui'
import { Bone } from '../components/Skeleton'
import { money } from '../lib/procurement'

const iso = d => d.toISOString().slice(0, 10)
const words = k => String(k).replace(/_/g, ' ')
const byCur = o => (o && Object.keys(o).length ? Object.entries(o).map(([c, v]) => money(v, c)).join(' · ') : '—')
const counts = o => (o && Object.keys(o).length ? Object.entries(o).map(([k, v]) => `${v} ${words(k)}`).join(' · ') : '—')

/** [title, [[label, value]…]] for each block the server returned. */
function blocks(r) {
  const out = []
  if (r.invoices) out.push(['Invoices', [['Created', r.invoices.count], ['By status', counts(r.invoices.by_status)], ['Value accepted', byCur(r.invoices.accepted_value)]]])
  if (r.payments) out.push(['Payments', [['Recorded', r.payments.count], ['By status', counts(r.payments.by_status)], ['Confirmed', byCur(r.payments.confirmed)], ['Awaiting confirmation', byCur(r.payments.awaiting)]]])
  if (r.clients) out.push(['Clients', [['New clients', r.clients.count], ['Registered online', r.clients.registered_online]]])
  if (r.bidding) out.push(['Bidding', [['Opportunities created', r.bidding.opportunities], ['Bids received', r.bidding.bids], ['Bids by status', counts(r.bidding.by_status)], ['Bids awarded', r.bidding.awarded]]])
  if (r.purchase_orders) out.push(['LPO / PO', [['Created', r.purchase_orders.count], ['By status', counts(r.purchase_orders.by_status)], ['Value issued', byCur(r.purchase_orders.issued_value)]]])
  if (r.suppliers) out.push(['Suppliers', [['New suppliers', r.suppliers.count], ['Registered online', r.suppliers.registered_online]]])
  if (r.deliveries) out.push(['Supplier shipments', [['Created', r.deliveries.count], ['By status', counts(r.deliveries.by_status)], ['Quantity', r.deliveries.quantity]]])
  if (r.investments) out.push(['Investments', [['Applications', r.investments.applications], ['By status', counts(r.investments.by_status)], ['Committed in the period', byCur(r.investments.committed)], ['New investors', r.investments.new_investors], ['All funds committed (to date)', money(r.investments.totals.committed, 'NGN')], ['Active (to date)', money(r.investments.totals.active, 'NGN')], ['Maturing within 30 days', r.investments.totals.maturing_soon]]])
  return out
}

export default function ReportsAdmin() {
  const { can } = useAuth()
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86400e3))); const [to, setTo] = useState(iso(new Date()))
  const [r, setR] = useState(null); const [err, setErr] = useState(null)
  useEffect(() => { setR(null); adminFetch(`/reports?from=${from}&to=${to}`).then(d => { setR(d); setErr(null) }).catch(e => setErr(e.message)) }, [from, to])
  const list = r ? blocks(r) : []
  const csv = () => {
    const q = v => `"${String(v).replace(/"/g, '""')}"`
    const lines = [['Section', 'Measure', 'Value'].map(q).join(','), ...list.flatMap(([t, rows]) => rows.map(([l, v]) => [t, l, v].map(q).join(',')))]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = `vertoc-report-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  return (
    <>
      <PageHeader eyebrow="System" title="Reports" description="What happened in a period, across the parts of the business you can see."
        action={can('reports', 'export') && <Button variant="outline" disabled={!list.length} onClick={csv}><Download className="w-4 h-4" />Export CSV</Button>} />
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <Field label="From"><Input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} /></Field>
        {[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months']].map(([d, l]) => <Button key={d} type="button" variant="outline" className="h-11" onClick={() => { setFrom(iso(new Date(Date.now() - d * 86400e3))); setTo(iso(new Date())) }}>{l}</Button>)}
      </div>
      {err && <Alert>{err}</Alert>}
      <div className="grid md:grid-cols-2 gap-5">
        {!r && !err && [0, 1, 2, 3].map(i => <Card key={i} className="p-6 space-y-3"><Bone className="h-5 w-32" /><Bone className="h-4 w-full" /><Bone className="h-4 w-2/3" /></Card>)}
        {list.map(([title, rows]) => (
          <Card key={title} className="p-6 animate-fade-up">
            <h2 className="font-semibold mb-4">{title}</h2>
            <dl className="space-y-2.5 text-sm">{rows.map(([l, v]) => <div key={l} className="flex items-start justify-between gap-6"><dt className="text-muted-foreground shrink-0">{l}</dt><dd className="font-medium text-right tabular-nums">{v}</dd></div>)}</dl>
          </Card>
        ))}
        {r && !list.length && <Card className="p-8 text-sm text-muted-foreground md:col-span-2">Your role can open Reports but none of the modules it summarises.</Card>}
      </div>
    </>
  )
}
