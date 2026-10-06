/*
 * Inventory: approved purchase orders as expected deliveries, goods receipts
 * (count, weigh, check, then record what was actually accepted), and stock.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, PackageCheck, Search, Trash2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Table, Tabs, Td, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { useSort } from '../lib/sort'
import { fmtDateTime } from './format'
import { fmtDay } from '../lib/procurement'

const LABEL = { expected: 'Expected', partially_received: 'Partially received', fully_received: 'Fully received', disputed: 'Rejected / disputed', closed: 'Closed' }
const TONE = { expected: 'blue', partially_received: 'amber', fully_received: 'green', disputed: 'red', closed: 'muted' }
const n = v => (Number(v) || 0).toLocaleString('en-NG', { maximumFractionDigits: 3 })
const TABS = [{ key: 'orders', label: 'Expected deliveries', icon: PackageCheck }, { key: 'stock', label: 'Stock' }]

export function InventoryAdmin({ stockTab = false }) {
  const [sp, setSp] = useSearchParams(); const nav = useNavigate()
  const status = ['all', 'open', ...Object.keys(LABEL)].includes(sp.get('status')) ? sp.get('status') : 'open'
  const [rows, setRows] = useState(null); const [stock, setStock] = useState(null); const [err, setErr] = useState(null); const [q, setQ] = useState('')
  useEffect(() => { if (stockTab) return; setRows(null); adminFetch(`/inventory/orders?status=${status}`).then(setRows).catch(e => setErr(e.message)) }, [status, stockTab])
  useEffect(() => { if (stockTab) adminFetch('/inventory/stock').then(setStock).catch(e => setErr(e.message)) }, [stockTab])
  const visible = useMemo(() => { const s = q.trim().toLowerCase(); return s && rows ? rows.filter(r => [r.number, r.supplier_name, r.title].some(v => String(v || '').toLowerCase().includes(s))) : rows }, [rows, q])
  const [sorted, sortControl] = useSort(visible, { name: 'supplier_name', date: 'delivery_date', more: [{ key: 'due', label: 'Delivery date, soonest first', get: r => r.delivery_date || '9999' }, { key: 'out', label: 'Outstanding, most first', get: r => r.totals.outstanding, desc: true }] })
  return (
    <>
      <PageHeader eyebrow="Inventory" title={stockTab ? 'Stock' : 'Expected deliveries'} description={stockTab ? 'Everything received and accepted, by item. Rejected and short quantities never count.' : 'Approved purchase orders appear here before the goods arrive. Receive against the order reference once they are counted, weighed and checked.'} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <Tabs value={stockTab ? 'stock' : 'orders'} onChange={k => nav(k === 'stock' ? '/staff360/inventory/stock' : '/staff360/inventory')} tabs={TABS} />
      {stockTab ? (
        <Card>
          <Table head={['Item', 'Unit', 'In stock', 'From orders']}>
            {!stock && [0, 1, 2].map(i => <tr key={i}>{[...Array(4)].map((_, j) => <Td key={j}><Bone className="h-4 w-20" /></Td>)}</tr>)}
            {stock?.map(s => <tr key={`${s.description}-${s.unit}`}><Td className="font-medium">{s.description}</Td><Td className="text-muted-foreground">{s.unit || '—'}</Td><Td className="tabular-nums font-semibold">{n(s.quantity)}</Td><Td className="text-muted-foreground">{s.orders}</Td></tr>)}
            {stock?.length === 0 && <tr><Td colSpan={4} className="text-center py-12 text-muted-foreground">Nothing received yet.</Td></tr>}
          </Table>
        </Card>
      ) : (<>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" /><Input className="pl-10" placeholder="Search PO reference, supplier or title…" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="flex flex-wrap gap-1.5">{['open', 'all', ...Object.keys(LABEL)].map(s => <button key={s} onClick={() => { const x = new URLSearchParams(sp); s === 'open' ? x.delete('status') : x.set('status', s); setSp(x) }} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${status === s ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>{s === 'open' ? 'To receive' : s === 'all' ? 'All' : LABEL[s]}</button>)}</div>
          <div className="ml-auto">{sortControl}</div>
        </div>
        <Card>
          <Table head={['PO reference', 'Supplier', 'Expected', 'Ordered', 'Accepted', 'Rejected', 'Outstanding', 'Status']}>
            {!rows && !err && [0, 1, 2].map(i => <tr key={i}>{[...Array(8)].map((_, j) => <Td key={j}><Bone className="h-4 w-16" /></Td>)}</tr>)}
            {sorted?.map(r => (
              <tr key={r.id} className="hover:bg-muted/40">
                <Td><Link to={`/staff360/inventory/orders/${r.id}`} className="font-medium hover:text-accent whitespace-nowrap">{r.number}</Link><span className="block text-xs text-muted-foreground truncate max-w-[200px]">{r.title}</span></Td>
                <Td>{r.supplier_name || '—'}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">{r.delivery_date ? fmtDay(r.delivery_date) : '—'}</Td>
                <Td className="tabular-nums">{n(r.totals.ordered)}</Td><Td className="tabular-nums">{n(r.totals.accepted)}</Td><Td className="tabular-nums">{r.totals.rejected ? n(r.totals.rejected) : '—'}</Td><Td className="tabular-nums font-medium">{n(r.totals.outstanding)}</Td>
                <Td><Badge tone={TONE[r.inventory_status]} className="whitespace-nowrap">{LABEL[r.inventory_status]}</Badge></Td>
              </tr>
            ))}
            {visible?.length === 0 && <tr><Td colSpan={8} className="text-center py-12 text-muted-foreground">{q ? 'No order matches.' : status === 'open' ? 'Nothing is waiting to be received. Orders appear here once they are approved.' : 'No orders here.'}</Td></tr>}
          </Table>
        </Card>
      </>)}
    </>
  )
}

export function InventoryOrder() {
  const { id } = useParams(); const { can } = useAuth()
  const [d, setD] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false); const [toast, toastEl] = useToast()
  const [f, setF] = useState({ delivery_note: '', notes: '', lines: {} })
  const load = useCallback(() => adminFetch(`/inventory/orders/${id}`).then(x => { setD(x); setErr(null) }).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])
  const receive = can('inventory', 'create'), closed = d?.inventory_status === 'closed'
  const set = (i, patch) => setF(x => ({ ...x, lines: { ...x.lines, [i]: { ...x.lines[i], ...patch } } }))
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr(null)
    const lines = Object.entries(f.lines).filter(([, v]) => Number(v.delivered) > 0).map(([i, v]) => ({ index: Number(i), delivered: v.delivered, accepted: v.accepted ?? v.delivered, note: v.note || '' }))
    try { await adminFetch(`/inventory/orders/${id}/receipts`, { method: 'POST', body: { delivery_note: f.delivery_note, notes: f.notes, lines } }); setF({ delivery_note: '', notes: '', lines: {} }); toast('Goods receipt recorded'); load() }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const act = async (path, ok, method = 'POST', body) => { setBusy(true); try { await adminFetch(`/inventory/orders/${id}${path}`, { method, body }); toast(ok); load() } catch (x) { toast(x.message, 'error') } finally { setBusy(false) } }
  if (err && !d) return <Alert>{err}</Alert>
  if (!d) return <Card className="p-6 space-y-4">{[...Array(4)].map((_, i) => <Bone key={i} className="h-10 w-full" />)}</Card>
  const o = d.order, t = d.totals
  return (
    <>
      <Link to="/staff360/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Expected deliveries</Link>
      <PageHeader eyebrow="Inventory" title={o.number} description={`${o.supplier_name || ''}${o.title ? ` · ${o.title}` : ''}`} action={<Badge tone={TONE[d.inventory_status]} className="text-sm px-3 py-1">{LABEL[d.inventory_status]}</Badge>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card>
            <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Ordered against delivered</h2></div>
            <Table head={['Item', 'Ordered', 'Delivered', 'Accepted', 'Rejected', 'Outstanding']}>
              {d.lines.map(l => <tr key={l.index}><Td className="font-medium">{l.description}<span className="block text-xs text-muted-foreground">{l.unit}</span></Td><Td className="tabular-nums">{n(l.ordered)}</Td><Td className="tabular-nums">{n(l.delivered)}{l.excess > 0 && <span className="block text-xs text-amber-600">+{n(l.excess)} over the order</span>}</Td><Td className="tabular-nums font-semibold">{n(l.accepted)}</Td><Td className="tabular-nums">{l.rejected ? <span className="text-destructive">{n(l.rejected)}</span> : '—'}</Td><Td className="tabular-nums">{l.outstanding ? n(l.outstanding) : '—'}</Td></tr>)}
              <tr className="bg-muted/40 font-semibold"><Td>Total</Td><Td className="tabular-nums">{n(t.ordered)}</Td><Td className="tabular-nums">{n(t.delivered)}</Td><Td className="tabular-nums">{n(t.accepted)}</Td><Td className="tabular-nums">{t.rejected ? n(t.rejected) : '—'}</Td><Td className="tabular-nums">{n(t.outstanding)}</Td></tr>
            </Table>
          </Card>

          {receive && !closed && (
            <form onSubmit={submit}>
              <Card className="p-5 space-y-4">
                <div><h2 className="text-sm font-semibold">Receive goods</h2><p className="text-xs text-muted-foreground mt-0.5">Enter what actually arrived, then what you accept after counting, weighing and checking. Whatever is not accepted is recorded as rejected.</p></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Delivery note / truck"><Input value={f.delivery_note} onChange={e => setF({ ...f, delivery_note: e.target.value })} placeholder="Waybill or vehicle number" /></Field>
                  <Field label="Notes"><Input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Condition, moisture, packaging…" /></Field>
                </div>
                <div className="space-y-3">
                  {d.lines.map(l => { const v = f.lines[l.index] || {}; const delivered = v.delivered ?? ''; return (
                    <div key={l.index} className="grid sm:grid-cols-[1fr_110px_110px_1fr] gap-2 items-end">
                      <div className="text-sm"><span className="font-medium">{l.description}</span><span className="block text-xs text-muted-foreground">{n(l.outstanding)} {l.unit} still to accept</span></div>
                      <Field label="Delivered"><Input type="number" min="0" step="0.001" value={delivered} onChange={e => set(l.index, { delivered: e.target.value, accepted: undefined })} /></Field>
                      <Field label="Accepted"><Input type="number" min="0" step="0.001" max={delivered || undefined} value={v.accepted ?? delivered} onChange={e => set(l.index, { accepted: e.target.value })} /></Field>
                      <Field label="Note"><Input value={v.note || ''} onChange={e => set(l.index, { note: e.target.value })} placeholder="Why anything is rejected" /></Field>
                    </div>
                  ) })}
                </div>
                <Button type="submit" variant="accent" disabled={busy || !Object.values(f.lines).some(v => Number(v.delivered) > 0)}>{busy ? 'Saving…' : 'Record goods receipt'}</Button>
              </Card>
            </form>
          )}

          <Card>
            <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Goods receipts</h2></div>
            <ul className="divide-y divide-border">
              {d.receipts.map(r => (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.number}</span><span className="flex-1 text-muted-foreground">{fmtDateTime(r.received_at)} · {r.received_name || 'staff'}{r.delivery_note ? ` · ${r.delivery_note}` : ''}</span>{can('inventory', 'approve') && <button type="button" onClick={() => window.confirm(`Remove ${r.number}? The quantities leave the totals and stock.`) && act(`/receipts/${r.id}`, 'Receipt removed', 'DELETE')} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive" aria-label="Remove receipt"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
                  <ul className="mt-1.5 text-xs text-muted-foreground space-y-0.5">{r.lines.map(l => <li key={l.id}>{l.description}: delivered {n(l.delivered)}, accepted {n(l.accepted)}{Number(l.delivered) > Number(l.accepted) ? `, rejected ${n(l.delivered - l.accepted)}` : ''} {l.unit}{l.note ? ` — ${l.note}` : ''}</li>)}</ul>
                  {r.notes && <p className="text-xs mt-1">{r.notes}</p>}
                </li>
              ))}
              {!d.receipts.length && <li className="px-5 py-8 text-center text-muted-foreground">Nothing received yet.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-24">
          <Card className="p-5 text-sm space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order details</h2>
            <dl className="space-y-2">
              <div><dt className="text-xs text-muted-foreground">Supplier</dt><dd className="font-medium">{o.supplier_name || '—'}{o.supplier_email && <span className="block text-xs text-muted-foreground font-normal break-all">{o.supplier_email}</span>}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Expected delivery</dt><dd className="font-medium">{o.delivery_date ? fmtDay(o.delivery_date) : '—'}{o.delivery_location ? ` · ${o.delivery_location}` : ''}</dd></div>
              {(o.specification || o.notes) && <div><dt className="text-xs text-muted-foreground">Specifications</dt><dd className="whitespace-pre-wrap">{[o.specification, o.notes].filter(Boolean).join('\n\n')}</dd></div>}
              {o.tender && <div><dt className="text-xs text-muted-foreground">Opportunity</dt><dd>{o.tender.number} · {o.tender.title}</dd></div>}
            </dl>
          </Card>
          {can('inventory', 'create') && (
            <Card className="p-5 space-y-2">
              {closed ? <><p className="text-xs text-muted-foreground">Closed {d.closed_at ? fmtDateTime(d.closed_at) : ''}.{d.inventory_note ? ` ${d.inventory_note}` : ''}</p>{can('inventory', 'edit') && <Button variant="outline" className="w-full" disabled={busy} onClick={() => act('/reopen', 'Reopened')}>Reopen</Button>}</>
                : <><p className="text-xs text-muted-foreground">Close the order when what arrived is final: a short supply or a rejection is then settled and the delivery is no longer expected.</p><Button variant="outline" className="w-full" disabled={busy || !t.delivered} onClick={() => { const note = window.prompt('Note for closing (optional)', ''); if (note !== null) act('/close', 'Order closed', 'POST', { note }) }}>Close order</Button></>}
            </Card>
          )}
        </div>
      </div>
      {toastEl}
    </>
  )
}
