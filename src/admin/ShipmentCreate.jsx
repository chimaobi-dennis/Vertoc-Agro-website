/* "Create shipment" on an invoice: a share of the goods (percent of what is
   still unallocated), where it leaves from and goes to, the truck. */
import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Button, Field, Input, Modal, Textarea } from './ui'
import PlacePicker, { EMPTY_PLACE } from './PlacePicker'
import { fmtPct, shareOf } from '../lib/shipments'

export default function ShipmentCreate({ open, onClose, quoteId, items, remaining, onCreated }) {
  const fresh = () => ({ percent: fmtPct(remaining), origin: { ...EMPTY_PLACE }, destination: { ...EMPTY_PLACE }, vehicle: '', notes: '' })
  const [f, setF] = useState(fresh)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  useEffect(() => { if (open) { setF(fresh()); setErr(null) } }, [open, remaining]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = patch => setF(x => ({ ...x, ...patch }))
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { const s = await adminFetch(`/quotes/${quoteId}/shipments`, { method: 'POST', body: f }); onCreated?.(s) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const share = shareOf(items, f.percent)
  return (
    <Modal open={open} onClose={onClose} title="Create shipment" wide
      footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="shipment-create" variant="accent" disabled={busy}>{busy ? 'Creating…' : 'Create shipment'}</Button></>}>
      <form id="shipment-create" onSubmit={submit} className="grid md:grid-cols-2 gap-5">
        {err && <div className="md:col-span-2"><Alert>{err}</Alert></div>}
        <Field label="Share of this invoice (%)" hint={`${fmtPct(remaining)}% is still unallocated`} className="md:col-span-2">
          <div className="flex flex-wrap items-start gap-4">
            <Input type="number" min="0.01" max={remaining} step="0.01" required className="max-w-[9rem]" value={f.percent} onChange={e => set({ percent: e.target.value })} />
            {share.length > 0 && <ul className="text-xs text-muted-foreground pt-3 space-y-0.5">{share.map(s => <li key={s}>≈ {s}</li>)}</ul>}
          </div>
        </Field>
        <PlacePicker label="From" value={f.origin} onChange={origin => set({ origin })} />
        <PlacePicker label="To" value={f.destination} onChange={destination => set({ destination })} />
        <Field label="Truck / driver" hint="Shown to the client"><Input value={f.vehicle} onChange={e => set({ vehicle: e.target.value })} placeholder="e.g. DAF XF, LSD 123 XY, driver Musa" /></Field>
        <Field label="Notes" hint="Shown to the client"><Textarea rows={2} value={f.notes} onChange={e => set({ notes: e.target.value })} /></Field>
      </form>
    </Modal>
  )
}
