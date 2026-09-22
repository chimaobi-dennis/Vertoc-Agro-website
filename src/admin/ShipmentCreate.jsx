/* "Create shipment" on an invoice: which share of each line goes on it,
   how it travels (road / sea / air), the vehicle number, the expected
   arrival, where it leaves from and goes to. */
import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Button, Field, Input, Modal, Select, Textarea } from './ui'
import PlacePicker, { EMPTY_PLACE } from './PlacePicker'
import { MODE_LABELS, SHIPMENT_MODES, VEHICLE_HINTS, VEHICLE_LABELS, fmtPct, qtyText } from '../lib/shipments'

export default function ShipmentCreate({ open, onClose, quoteId, lines = [], onCreated }) {
  const fresh = () => ({ items: Object.fromEntries(lines.map(l => [l.index, fmtPct(l.remaining)])), mode: 'road', vehicle: '', eta: '', origin: { ...EMPTY_PLACE }, destination: { ...EMPTY_PLACE }, notes: '' })
  const [f, setF] = useState(fresh)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  useEffect(() => { if (open) { setF(fresh()); setErr(null) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = patch => setF(x => ({ ...x, ...patch }))
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const body = { ...f, items: lines.map(l => ({ index: l.index, percent: Number(f.items[l.index]) || 0 })) }
      const s = await adminFetch(`/quotes/${quoteId}/shipments`, { method: 'POST', body }); onCreated?.(s)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Create shipment" wide
      footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="shipment-create" variant="accent" disabled={busy}>{busy ? 'Creating…' : 'Create shipment'}</Button></>}>
      <form id="shipment-create" onSubmit={submit} className="grid md:grid-cols-2 gap-5">
        {err && <div className="md:col-span-2"><Alert>{err}</Alert></div>}
        <div className="md:col-span-2">
          <p className="text-sm font-medium mb-2">What goes on this shipment</p>
          <ShareTable lines={lines} values={f.items} onChange={(i, v) => set({ items: { ...f.items, [i]: v } })} />
        </div>
        <Field label="Shipment type"><Select value={f.mode} onChange={e => set({ mode: e.target.value })}>{SHIPMENT_MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}</Select></Field>
        <Field label={VEHICLE_LABELS[f.mode]} hint={`${VEHICLE_HINTS[f.mode]} — shown to the client`}><Input value={f.vehicle} onChange={e => set({ vehicle: e.target.value })} /></Field>
        <PlacePicker label="From" value={f.origin} onChange={origin => set({ origin })} />
        <PlacePicker label="To" value={f.destination} onChange={destination => set({ destination })} />
        <Field label="Expected date of arrival" hint="Shown to the client"><Input type="date" value={f.eta} onChange={e => set({ eta: e.target.value })} /></Field>
        <Field label="Notes" hint="Shown to the client"><Textarea rows={2} value={f.notes} onChange={e => set({ notes: e.target.value })} /></Field>
      </form>
    </Modal>
  )
}

/** One row per invoice line: quantity, what is left, the share for this shipment, the resulting quantity. */
export function ShareTable({ lines, values, onChange, disabled = false }) {
  if (!lines.length) return <p className="text-sm text-muted-foreground">This invoice has no line items yet.</p>
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/50"><span>Line</span><span className="text-right">Left to ship</span><span className="text-right">Share</span><span className="text-right w-28">On this shipment</span></div>
      <ul className="divide-y divide-border">
        {lines.map(l => { const v = Number(values?.[l.index]) || 0; const full = l.remaining <= 0; return (
          <li key={l.index} className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 items-center px-3 py-2 text-sm">
            <span className="min-w-0"><span className="font-medium">{l.description}</span>{l.quantity > 0 && <span className="text-muted-foreground"> · {qtyText(l.quantity)} {l.unit}</span>}</span>
            <span className={`text-right text-xs ${full ? 'text-muted-foreground' : ''}`}>{full ? 'Fully shipped' : `${fmtPct(l.remaining)}%`}</span>
            <span className="flex items-center justify-end gap-1"><Input type="number" min="0" max={l.remaining} step="0.01" disabled={disabled || full} className="h-9 w-24 text-right" value={values?.[l.index] ?? ''} onChange={e => onChange(l.index, e.target.value)} aria-label={`Share of ${l.description}`} /><span className="text-xs text-muted-foreground">%</span></span>
            <span className="text-right text-xs text-muted-foreground w-28 tabular-nums">{v > 0 && l.quantity > 0 ? `≈ ${qtyText(l.quantity * v / 100)} ${l.unit}` : v > 0 ? `${fmtPct(v)}%` : '—'}</span>
          </li>
        ) })}
      </ul>
    </div>
  )
}
