/*
 * One purchase order in the supplier's portal: what was ordered, how much
 * of it is on the way, and the shipments. The supplier adds a shipment for
 * each truck, reports where it is, attaches the waybill and marks it
 * delivered; our team confirms what arrived.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Loader2, MapPin, Paperclip, Plus, Truck } from 'lucide-react'
import { openFile } from '../lib/openFile'
import { supplierFetch, uploadSupplierFile } from '../lib/supplier'
import { Bone } from '../components/Skeleton'
import { DELIVERY_LABELS, FILE_ACCEPT, PO_KINDS, fileSize, fmtDay, fmtMoment, qty } from '../lib/procurement'
import { Label, Notice, Pill, Problem, accent, input, outline } from './ui'

const Card = ({ className = '', ...p }) => <div {...p} className={`bg-card border border-border rounded-2xl ${className}`} />
const TONE = { planned: 'draft', in_transit: 'issued', delivered: 'open', confirmed: 'acknowledged', cancelled: 'cancelled' }
const BLANK = { quantity: '', truck_number: '', driver_name: '', driver_phone: '', loading_location: '', destination: '', loading_date: '', eta: '', waybill: '', notes: '' }

export default function SupplierOrder() {
  const { number } = useParams()
  const [o, setO] = useState(null); const [err, setErr] = useState(null); const [note, setNote] = useState(null); const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)        // the shipment being created
  const load = useCallback(() => supplierFetch(`/supplier/orders/${number}`).then(x => { setO(x); setErr(null) }).catch(e => setErr(e.message)), [number])
  useEffect(() => { load() }, [load])
  const run = async (fn, ok) => { setBusy(true); setErr(null); setNote(null); try { await fn(); await load(); if (ok) setNote(ok); return true } catch (e) { setErr(e.message); return false } finally { setBusy(false) } }
  const create = async e => { e.preventDefault(); if (await run(() => supplierFetch(`/supplier/orders/${number}/shipments`, { method: 'POST', body: form }), 'Shipment created. Report its position as it travels, and mark it delivered when it arrives.')) setForm(null) }

  if (err && !o) return <><Link to="/supplier?tab=orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" />Purchase orders</Link><Problem>{err}</Problem></>
  if (!o) return <div className="space-y-4" role="status" aria-label="Loading"><Bone className="h-8 w-72" /><Bone className="h-24 w-full rounded-2xl" /><Bone className="h-64 w-full rounded-2xl" /></div>
  const f = o.fulfilment, unit = f.unit
  const set = k => e => setForm(x => ({ ...x, [k]: e.target.value }))
  return (
    <>
      <Link to="/supplier?tab=orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" />Purchase orders</Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0"><p className="text-xs font-semibold tracking-widest text-muted-foreground">{PO_KINDS[o.kind]?.toUpperCase()}</p><h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground mt-1">{o.number}</h1><p className="text-sm text-muted-foreground mt-1">{o.title}{o.delivery_date ? ` · deliver by ${fmtDay(o.delivery_date)}` : ''}{o.delivery_location ? ` · to ${o.delivery_location}` : ''}</p></div>
        <div className="flex flex-wrap items-center gap-3"><Pill status={o.status}>{o.status === 'issued' ? 'To acknowledge' : o.status}</Pill><Link to={`/po/${o.token}`} className={`${o.status === 'issued' ? accent : outline} h-10`}>{o.status === 'issued' ? 'Open and acknowledge' : 'Open the order'}</Link></div>
      </div>
      <div className="space-y-3 mb-6"><Problem>{err}</Problem><Notice>{note}</Notice></div>

      <Card className="mb-6 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
          {[['Ordered', f.ordered], ['On shipments', f.shipped], ['Received by us', f.confirmed], ['Still to ship', f.remaining]].map(([l, v]) => <div key={l} className="px-5 py-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold tabular-nums text-foreground mt-0.5">{qty(v, unit)}</p></div>)}
        </div>
        <div className="h-1.5 bg-muted"><div className="h-full bg-accent" style={{ width: `${f.ordered > 0 ? Math.min(100, f.confirmed / f.ordered * 100) : 0}%` }} /></div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-lg flex items-center gap-2"><Truck className="w-5 h-5 text-accent" />Shipments</h2>
        {o.can_ship && !form && <button type="button" onClick={() => setForm({ ...BLANK, quantity: f.remaining > 0 ? String(f.remaining) : '', destination: o.delivery_location || '' })} className={`${accent} h-10`}><Plus className="w-4 h-4" />Create a shipment</button>}
      </div>
      {!o.can_ship && !o.shipments.length && <p className="text-sm text-muted-foreground mb-4">{o.status === 'issued' || o.status === 'acknowledged' ? '' : `This order is ${o.status}; shipments cannot be added to it.`}</p>}

      {form && (
        <form onSubmit={create} className="bg-card border border-accent/40 rounded-2xl p-6 mb-6 space-y-4">
          <h3 className="font-semibold">New shipment against {o.number}</h3>
          <dl className="grid sm:grid-cols-3 gap-3 text-sm rounded-xl bg-secondary/60 border border-border px-4 py-3">
            <div><dt className="text-xs text-muted-foreground">LPO / PO number</dt><dd className="font-medium">{o.number}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Product</dt><dd className="font-medium">{o.items?.[0]?.description || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Still to ship</dt><dd className="font-medium tabular-nums">{qty(f.remaining, unit)}</dd></div>
          </dl>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block"><Label>Quantity on this truck ({unit}) *</Label><input required type="number" min="0.001" step="0.001" inputMode="decimal" className={input} value={form.quantity} onChange={set('quantity')} /></label>
            <label className="block"><Label>Truck registration number *</Label><input required maxLength={40} className={input} value={form.truck_number} onChange={set('truck_number')} placeholder="ABC-123-XY" /></label>
            <label className="block"><Label>Driver's name *</Label><input required maxLength={120} className={input} value={form.driver_name} onChange={set('driver_name')} /></label>
            <label className="block"><Label>Driver's phone number *</Label><input required type="tel" maxLength={60} className={input} value={form.driver_phone} onChange={set('driver_phone')} /></label>
            <label className="block"><Label>Loading location *</Label><input required maxLength={200} className={input} value={form.loading_location} onChange={set('loading_location')} placeholder="Warehouse, town, state" /></label>
            <label className="block"><Label>Destination *</Label><input required maxLength={200} className={input} value={form.destination} onChange={set('destination')} /></label>
            <label className="block"><Label>Loading date *</Label><input required type="date" className={input} value={form.loading_date} onChange={set('loading_date')} /></label>
            <label className="block"><Label>Estimated time of arrival (ETA) *</Label><input required type="date" min={form.loading_date || undefined} className={input} value={form.eta} onChange={set('eta')} /></label>
            <label className="block"><Label hint="(optional)">Waybill number</Label><input maxLength={80} className={input} value={form.waybill} onChange={set('waybill')} /></label>
            <label className="block sm:col-span-2 lg:col-span-3"><Label hint="(optional)">Other relevant information</Label><textarea rows={2} maxLength={2000} className={input} value={form.notes} onChange={set('notes')} /></label>
          </div>
          <p className="text-xs text-muted-foreground">You can attach the waybill and other supporting documents once the shipment is created.</p>
          <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className={accent}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Creating…' : 'Create shipment'}</button><button type="button" onClick={() => setForm(null)} className={outline}>Cancel</button></div>
        </form>
      )}

      {!o.shipments.length && !form ? <Card className="p-10 text-center"><Truck className="w-8 h-8 text-accent mx-auto mb-3" /><p className="font-semibold text-foreground">No shipments yet</p><p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">{o.can_ship ? 'Create a shipment for each truck you send against this order, with its driver and expected arrival.' : o.status === 'draft' ? 'This order has not been issued yet.' : 'Shipments appear here.'}</p></Card>
        : <ul className="space-y-5">{o.shipments.map(s => <li key={s.id}><Shipment s={s} labels={o.file_labels || []} run={run} busy={busy} /></li>)}</ul>}
    </>
  )
}

function Shipment({ s, labels, run, busy }) {
  const [r, setR] = useState({ location: '', note: '' })
  const [label, setLabel] = useState(labels[0] || ''); const [queue, setQueue] = useState([]); const picker = useRef(null)
  const open = !['confirmed', 'cancelled'].includes(s.status)
  const moving = ['planned', 'in_transit'].includes(s.status)
  const report = (body, ok) => run(async () => { await supplierFetch(`/supplier/shipments/${s.id}/report`, { method: 'POST', body }); setR({ location: '', note: '' }) }, ok)
  const add = async list => { for (const file of list) { setQueue(q => [...q, { name: file.name }]); try { await uploadSupplierFile(file, `/supplier/shipments/${s.id}/files`, { label }); setQueue(q => q.filter(x => x.name !== file.name)); await run(async () => {}) } catch (e) { setQueue(q => q.map(x => (x.name === file.name ? { ...x, error: e.message } : x))) } } }
  const view = async d => { try { await openFile(() => supplierFetch(`/supplier/shipments/${s.id}/files/${d.id}/url`).then(r => ({ url: r.url, name: d.name }))) } catch { /* shown by the next action */ } }
  const cell = (l, v) => <div><dt className="text-xs text-muted-foreground">{l}</dt><dd className="font-medium break-words">{v || '—'}</dd></div>
  return (
    <Card>
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Shipment {s.number} · {qty(s.quantity, s.unit)}</h3>
        <div className="flex flex-wrap items-center gap-3">{s.current_location && <span className="text-sm flex items-center gap-1"><MapPin className="w-4 h-4 text-accent" />{s.current_location}</span>}<Pill status={TONE[s.status]}>{DELIVERY_LABELS[s.status]}</Pill></div>
      </div>
      <div className="p-6 space-y-5">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {cell('Product', s.product)}{cell('Truck', s.truck_number)}{cell('Driver', s.driver_name)}{cell('Driver phone', s.driver_phone)}
          {cell('Loading location', s.loading_location)}{cell('Destination', s.destination)}{cell('Loading date', fmtDay(s.loading_date))}{cell('ETA', fmtDay(s.eta))}
          {cell('Waybill', s.waybill)}{s.received_quantity != null && cell('Received by Vertoc Agro', qty(s.received_quantity, s.unit))}{s.notes && <div className="col-span-2">{cell('Other information', s.notes)}</div>}
        </dl>
        {s.status === 'confirmed' && <p className="rounded-xl bg-accent/10 border border-accent/30 px-4 py-3 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-accent" />Delivery confirmed by our team on {fmtMoment(s.confirmed_at)}: {qty(s.received_quantity ?? s.quantity, s.unit)} received.</p>}
        {s.status === 'delivered' && <p className="rounded-xl bg-secondary/60 border border-border px-4 py-3 text-sm">You reported this shipment delivered on {fmtMoment(s.delivered_at)}. Our team will confirm what was received.</p>}

        {moving && (
          <form onSubmit={e => { e.preventDefault(); report({ location: r.location, note: r.note }, 'Position updated.') }} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label className="block"><Label>Where is the truck now?</Label><input required maxLength={200} className={input} value={r.location} onChange={e => setR({ ...r, location: e.target.value })} placeholder="e.g. Lokoja, Kogi State" /></label>
            <label className="block"><Label hint="(optional)">Note</Label><input maxLength={500} className={input} value={r.note} onChange={e => setR({ ...r, note: e.target.value })} /></label>
            <button type="submit" disabled={busy} className={`${outline} h-[46px]`}>{s.status === 'planned' ? 'It has left — update' : 'Update position'}</button>
          </form>
        )}
        {moving && <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => window.confirm(`Mark shipment ${s.number} as delivered?`) && report({ status: 'delivered', location: s.destination, note: 'Delivered' }, 'Marked as delivered. Our team will confirm what was received.')} className={`${accent} h-10`}><CheckCircle2 className="w-4 h-4" />Mark as delivered</button>
          {s.status === 'planned' && <button type="button" disabled={busy} onClick={() => window.confirm(`Cancel shipment ${s.number}?`) && report({ status: 'cancelled', note: 'Cancelled by the supplier' }, 'Shipment cancelled.')} className="text-sm font-semibold text-destructive hover:underline">Cancel this shipment</button>}
        </div>}

        <div>
          <h4 className="text-sm font-semibold mb-2">Journey</h4>
          <ol className="space-y-1.5">{[...s.updates].reverse().map((u, i) => <li key={i} className="text-sm flex flex-wrap gap-x-3"><span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{fmtMoment(u.at)}</span><span><b>{DELIVERY_LABELS[u.status] || u.status}</b>{u.location ? ` · ${u.location}` : ''}{u.note ? <span className="text-muted-foreground"> · {u.note}</span> : ''} <span className="text-xs text-muted-foreground">({u.by})</span></span></li>)}</ol>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Waybill and supporting documents</h4>
          <ul className="rounded-xl border border-border divide-y divide-border">
            {s.documents.map(d => <li key={d.id} className="px-4 py-2.5 flex items-center gap-3 text-sm"><FileText className="w-4 h-4 text-muted-foreground shrink-0" /><button type="button" onClick={() => view(d)} className="flex-1 min-w-0 text-left hover:text-accent"><span className="font-medium truncate block">{d.name}</span><span className="block text-xs text-muted-foreground">{[d.label, fileSize(d.bytes), fmtDay(d.created_at)].filter(Boolean).join(' · ')}</span></button></li>)}
            {queue.map(q => <li key={q.name} className="px-4 py-2.5 text-sm flex items-center gap-3">{!q.error && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}<span className="flex-1 truncate">{q.name}<span className={`block text-xs ${q.error ? 'text-destructive' : 'text-muted-foreground'}`}>{q.error || 'Uploading…'}</span></span></li>)}
            {!s.documents.length && !queue.length && <li className="px-4 py-5 text-center text-sm text-muted-foreground">Nothing attached yet.</li>}
          </ul>
          {open && <div className="mt-3 flex flex-wrap items-center gap-3">
            <select className={`${input} h-11 py-0 max-w-[14rem]`} value={label} onChange={e => setLabel(e.target.value)} aria-label="Kind of document">{labels.map(l => <option key={l}>{l}</option>)}</select>
            <input ref={picker} type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={e => { add([...e.target.files]); e.target.value = '' }} />
            <button type="button" onClick={() => picker.current?.click()} className={`${outline} h-11`}><Paperclip className="w-4 h-4" />Attach a file</button>
          </div>}
        </div>
      </div>
    </Card>
  )
}
