/*
 * Supplier shipments: the trucks a supplier sends against an LPO / PO.
 * The supplier creates and updates them in their portal; here the team
 * follows where each one is, adds its own reports, and confirms delivery.
 * <DeliveriesPanel poId> is the same list inside one order.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, MapPin, Plus, Trash2, Truck } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Td, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { DocumentsPanel } from './ClientTabs'
import { useSort } from '../lib/sort'
import { DELIVERY_LABELS, DELIVERY_STATUSES, deliveryTone, fmtDay, fmtMoment, qty } from '../lib/procurement'

const BLANK = { quantity: '', truck_number: '', driver_name: '', driver_phone: '', loading_location: '', destination: '', loading_date: '', eta: '', waybill: '', notes: '' }

export function DeliveriesPanel({ poId = null, status = 'all', canAdd = false, onChanged }) {
  const { can } = useAuth()
  const [rows, setRows] = useState(null); const [err, setErr] = useState(null)
  const [open, setOpen] = useState(null)          // shipment being viewed
  const [adding, setAdding] = useState(false)
  const [toast, toastEl] = useToast()
  const load = useCallback(() => adminFetch(`/deliveries?status=${status}${poId ? `&po_id=${poId}` : ''}`).then(r => { setRows(r); setErr(null) }).catch(e => setErr(e.message)), [poId, status])
  useEffect(() => { setRows(null); load() }, [load])
  const [sorted, sortControl] = useSort(rows, { name: r => r.order?.supplier_name, more: [
    { key: 'order', label: 'Order number', get: r => r.order?.number }, { key: 'status', label: 'Status', get: r => DELIVERY_STATUSES.indexOf(r.status) },
    { key: 'eta', label: 'Arrival, soonest first', get: 'eta' }, { key: 'loading', label: 'Loading date, latest first', get: 'loading_date', desc: true }, { key: 'qty', label: 'Quantity, largest first', get: 'quantity', desc: true },
  ] })
  const changed = () => { load(); onChanged?.() }

  return (
    <div className="space-y-3">
      {err && <Alert>{err}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canAdd && can('shipments', 'create') ? <Button type="button" variant="outline" className="h-10" onClick={() => setAdding(true)}><Plus className="w-4 h-4" />Add a shipment</Button> : <span />}
        {sortControl}
      </div>
      <Card>
        <Table head={['Shipment', ...(poId ? [] : ['Order', 'Supplier']), 'Quantity', 'Truck / driver', 'Route', 'Dates', 'Status', '']}>
          {!rows && [0, 1].map(i => <tr key={i}>{[...Array(poId ? 7 : 9)].map((_, j) => <Td key={j}><Bone className="h-4 w-16" /></Td>)}</tr>)}
          {sorted?.map(r => (
            <tr key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setOpen(r)}>
              <Td className="font-medium whitespace-nowrap">#{r.number}<span className="block text-xs font-normal text-muted-foreground">{fmtMoment(r.created_at)}</span></Td>
              {!poId && <Td>{r.order ? <Link to={`/staff360/purchase-orders/${r.order.id}`} onClick={e => e.stopPropagation()} className="font-medium hover:text-accent">{r.order.number}</Link> : '—'}</Td>}
              {!poId && <Td className="max-w-[180px] truncate">{r.order?.supplier_name || '—'}</Td>}
              <Td className="tabular-nums whitespace-nowrap">{qty(r.quantity, r.unit)}{r.received_quantity != null && <span className="block text-xs text-muted-foreground">received {qty(r.received_quantity, r.unit)}</span>}<span className="block text-xs text-muted-foreground max-w-[160px] truncate">{r.product}</span></Td>
              <Td className="whitespace-nowrap">{r.truck_number}<span className="block text-xs text-muted-foreground">{r.driver_name}{r.driver_phone ? ` · ${r.driver_phone}` : ''}</span></Td>
              <Td className="text-muted-foreground max-w-[200px]"><span className="block truncate">{r.loading_location || '—'} → {r.destination || '—'}</span>{r.current_location && <span className="flex items-center gap-1 text-xs text-foreground"><MapPin className="w-3 h-3 text-accent" />{r.current_location}</span>}</Td>
              <Td className="text-xs text-muted-foreground whitespace-nowrap">Loads {fmtDay(r.loading_date)}<span className="block">ETA {fmtDay(r.eta)}</span></Td>
              <Td><Badge tone={deliveryTone(r.status)} className="whitespace-nowrap">{DELIVERY_LABELS[r.status]}</Badge></Td>
              <Td className="text-right text-xs font-semibold text-accent whitespace-nowrap">Open →</Td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><Td colSpan={poId ? 7 : 9} className="text-center py-12 text-muted-foreground">{poId ? 'No shipment against this order yet. The supplier adds them in their portal once the order is issued.' : 'No supplier shipments yet.'}</Td></tr>}
        </Table>
      </Card>
      {open && <DeliveryDialog id={open.id} onClose={() => setOpen(null)} onChanged={changed} toast={toast} />}
      {adding && <AddDelivery poId={poId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); toast('Shipment added'); changed() }} />}
      {toastEl}
    </div>
  )
}

function AddDelivery({ poId, onClose, onSaved }) {
  const [f, setF] = useState(BLANK); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))
  const save = async e => { e.preventDefault(); setBusy(true); setErr(null); try { await adminFetch('/deliveries', { method: 'POST', body: { ...f, po_id: poId } }); onSaved() } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  return (
    <Modal open onClose={onClose} title="Add a shipment for the supplier" wide footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="add-delivery" variant="accent" disabled={busy}>{busy ? 'Saving…' : 'Add shipment'}</Button></>}>
      <form id="add-delivery" onSubmit={save} className="grid sm:grid-cols-2 gap-4">
        {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
        <Field label="Quantity *"><Input type="number" required min="0.001" step="0.001" value={f.quantity} onChange={set('quantity')} /></Field>
        <Field label="Truck registration number *"><Input required value={f.truck_number} onChange={set('truck_number')} /></Field>
        <Field label="Driver's name *"><Input required value={f.driver_name} onChange={set('driver_name')} /></Field>
        <Field label="Driver's phone number"><Input type="tel" value={f.driver_phone} onChange={set('driver_phone')} /></Field>
        <Field label="Loading location"><Input value={f.loading_location} onChange={set('loading_location')} /></Field>
        <Field label="Destination" hint="Left empty: the order's delivery location."><Input value={f.destination} onChange={set('destination')} /></Field>
        <Field label="Loading date"><Input type="date" value={f.loading_date} onChange={set('loading_date')} /></Field>
        <Field label="Estimated arrival (ETA)"><Input type="date" value={f.eta} onChange={set('eta')} /></Field>
        <Field label="Waybill number" hint="Optional"><Input value={f.waybill} onChange={set('waybill')} /></Field>
        <Field label="Other information" className="sm:col-span-2"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      </form>
    </Modal>
  )
}

function DeliveryDialog({ id, onClose, onChanged, toast }) {
  const { can } = useAuth()
  const [x, setX] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false)
  const [r, setR] = useState({ location: '', note: '', status: '' })
  const [received, setReceived] = useState('')
  const load = useCallback(() => adminFetch(`/deliveries/${id}`).then(d => { setX(d); setReceived(String(d.received_quantity ?? d.quantity)) }).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])
  const run = async (fn, ok) => { setBusy(true); setErr(null); try { await fn(); toast(ok); await load(); onChanged() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const report = e => { e.preventDefault(); run(async () => { await adminFetch(`/deliveries/${id}/report`, { method: 'POST', body: { location: r.location, note: r.note, ...(r.status ? { status: r.status } : {}) } }); setR({ location: '', note: '', status: '' }) }, 'Update added') }
  const confirm = () => run(() => adminFetch(`/deliveries/${id}/report`, { method: 'POST', body: { status: 'confirmed', received_quantity: received, note: 'Delivery confirmed' } }), 'Delivery confirmed — the supplier has been told')
  const remove = () => { if (window.confirm('Delete this shipment and its documents? This cannot be undone.')) { setBusy(true); adminFetch(`/deliveries/${id}`, { method: 'DELETE' }).then(() => { toast('Shipment deleted'); onChanged(); onClose() }).catch(e => { setErr(e.message); setBusy(false) }) } }
  const closed = x && ['confirmed', 'cancelled'].includes(x.status)
  const row = (l, v) => <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">{l}</dt><dd className="font-medium mt-0.5 break-words">{v || '—'}</dd></div>
  return (
    <Modal open onClose={onClose} wide title={x ? `Shipment #${x.number}${x.order ? ` · ${x.order.number}` : ''}` : 'Shipment'}>
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!x ? <div className="space-y-3">{[0, 1, 2].map(i => <Bone key={i} className="h-10 w-full" />)}</div> : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3"><Badge tone={deliveryTone(x.status)} className="text-sm px-3 py-1">{DELIVERY_LABELS[x.status]}</Badge>{x.order && <Link to={`/staff360/purchase-orders/${x.order.id}`} className="text-sm font-semibold text-accent">{x.order.number} · {x.order.supplier_name}</Link>}{x.current_location && <span className="text-sm flex items-center gap-1"><MapPin className="w-4 h-4 text-accent" />{x.current_location}</span>}</div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {row('Product', x.product)}{row('Quantity', qty(x.quantity, x.unit))}{row('Received', x.received_quantity != null ? qty(x.received_quantity, x.unit) : '')}
            {row('Truck registration', x.truck_number)}{row('Driver', x.driver_name)}{row('Driver phone', x.driver_phone)}
            {row('Loading location', x.loading_location)}{row('Destination', x.destination)}{row('Waybill', x.waybill)}
            {row('Loading date', fmtDay(x.loading_date))}{row('ETA', fmtDay(x.eta))}{row('Delivered', x.delivered_at ? fmtMoment(x.delivered_at) : '')}
            {x.notes && <div className="col-span-2 sm:col-span-3">{row('Other information', x.notes)}</div>}
          </dl>

          {x.status === 'delivered' && can('shipments', 'approve') && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex flex-wrap items-end gap-3">
              <Field label={`Quantity received (${x.unit})`} className="w-48"><Input type="number" min="0" step="0.001" value={received} onChange={e => setReceived(e.target.value)} /></Field>
              <Button type="button" variant="accent" disabled={busy} onClick={confirm}><CheckCircle2 className="w-4 h-4" />Confirm delivery</Button>
              <p className="text-xs text-muted-foreground basis-full">The supplier reported this shipment delivered. Confirming records what arrived and tells the supplier.</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-accent" />Journey</h3>
            <ol className="space-y-2">{[...x.updates].reverse().map((u, i) => <li key={i} className="text-sm flex gap-3"><span className="text-xs text-muted-foreground w-36 shrink-0">{fmtMoment(u.at)}</span><span><Badge tone={deliveryTone(u.status)}>{DELIVERY_LABELS[u.status] || u.status}</Badge> {u.location && <b className="ml-1">{u.location}</b>} {u.note && <span className="text-muted-foreground">{u.note}</span>} <span className="text-xs text-muted-foreground">· {u.by === 'supplier' ? 'supplier' : u.by}</span></span></li>)}</ol>
          </div>

          {!closed && can('shipments', 'edit') && (
            <form onSubmit={report} className="grid sm:grid-cols-[1fr_1fr_170px_auto] gap-3 items-end">
              <Field label="Where is it now?"><Input value={r.location} onChange={e => setR({ ...r, location: e.target.value })} placeholder="e.g. Lokoja, Kogi" /></Field>
              <Field label="Note"><Input value={r.note} onChange={e => setR({ ...r, note: e.target.value })} /></Field>
              <Field label="Status"><Select value={r.status} onChange={e => setR({ ...r, status: e.target.value })}><option value="">No change</option>{DELIVERY_STATUSES.filter(s => s !== 'confirmed' && s !== x.status).map(s => <option key={s} value={s}>{DELIVERY_LABELS[s]}</option>)}</Select></Field>
              <Button type="submit" variant="outline" disabled={busy || (!r.location && !r.note && !r.status)}>Add update</Button>
            </form>
          )}

          <div><h3 className="text-sm font-semibold mb-2">Waybill and supporting documents</h3><DocumentsPanel scope={{ po_shipment_id: x.id }} note="shared with the supplier" /></div>
          {can('shipments', 'delete') && <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-destructive" disabled={busy} onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete shipment</Button>}
        </div>
      )}
    </Modal>
  )
}

const FILTERS = ['all', ...DELIVERY_STATUSES]
export default function DeliveriesAdmin() {
  const [sp, setSp] = useSearchParams()
  const status = FILTERS.includes(sp.get('status')) ? sp.get('status') : 'all'
  return (
    <>
      <PageHeader eyebrow="Procurement" title="Supplier shipments" description="Trucks on the way against the purchase orders you issued. Suppliers create and update them in their portal; you confirm each delivery when it arrives." />
      <div className="flex flex-wrap rounded-xl border border-border overflow-hidden text-xs font-semibold w-fit mb-4">
        {FILTERS.map(k => <button key={k} onClick={() => setSp(k === 'all' ? {} : { status: k })} className={`px-3.5 py-2 ${status === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{k === 'all' ? 'All' : DELIVERY_LABELS[k]}</button>)}
      </div>
      <DeliveriesPanel status={status} />
    </>
  )
}
