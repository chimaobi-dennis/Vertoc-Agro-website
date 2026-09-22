/*
 * One shipment of an invoice: the route on a map, the checkpoints dropped
 * so far, and the form to drop the next one (pick a state, or click the
 * map). Marking it delivered pins it at the destination.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, MapPin, Trash2, XCircle } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtDateTime } from './format'
import { NG_STATES, nearestState } from '../lib/ngStates'
import { MODE_LABELS, SHIPMENT_LABELS, SHIPMENT_MODES, VEHICLE_HINTS, VEHICLE_LABELS, ago, fmtEta, fmtPct, shareLines, shipmentTone } from '../lib/shipments'
import PlacePicker from './PlacePicker'
import { ShareTable } from './ShipmentCreate'
const RouteMap = lazy(() => import('../components/RouteMap'))

const blankCp = () => ({ state: '', name: '', lat: null, lng: null, note: '' })

export default function ShipmentDetail() {
  const { id, sid } = useParams(); const nav = useNavigate()
  const [s, setS] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false)
  const [cp, setCp] = useState(blankCp)
  const [form, setForm] = useState(null)
  const [toast, toastEl] = useToast()

  const load = useCallback(() => adminFetch(`/shipments/${sid}`).then(x => {
    setS(x)
    const own = new Map((x.items || []).map(l => [l.index, l.percent]))
    setForm({ items: Object.fromEntries((x.lines_for_edit || []).map(l => [l.index, fmtPct(own.get(l.index) ?? (x.items?.length ? 0 : x.percent))])), mode: x.mode || 'road', vehicle: x.vehicle, eta: x.eta || '', origin: x.origin, destination: x.destination, notes: x.notes })
  }).catch(e => setErr(e.message)), [sid])
  useEffect(() => { load() }, [load])

  const onPick = useCallback(p => setCp(c => { const near = nearestState(p); return { ...c, lat: p.lat, lng: p.lng, state: c.state || near?.state || '', name: c.name || (near ? `Near ${near.capital}, ${near.state}` : '') } }), [])
  const pickState = name => { const st = NG_STATES.find(x => x.state === name); setCp(c => st ? { ...c, state: st.state, name: `${st.capital}, ${st.state}`, lat: st.lat, lng: st.lng } : { ...c, state: '' }) }
  const call = async (fn, ok) => { setBusy(true); setErr(null); try { await fn(); if (ok) toast(ok); await load() } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  const addCp = e => { e.preventDefault(); call(async () => { await adminFetch(`/shipments/${sid}/checkpoints`, { method: 'POST', body: cp }); setCp(blankCp()) }, 'Location added') }
  const removeCp = c => { if (!window.confirm(`Remove the pin at ${c.name}?`)) return; call(() => adminFetch(`/shipments/${sid}/checkpoints/${c.id}`, { method: 'DELETE' })) }
  const saveForm = e => { e.preventDefault(); call(() => adminFetch(`/shipments/${sid}`, { method: 'PATCH', body: { ...form, items: (s.lines_for_edit || []).map(l => ({ index: l.index, percent: Number(form.items[l.index]) || 0 })) } }), 'Saved') }
  const setStatus = status => { const q = { delivered: 'Mark this shipment as delivered? It will be pinned at the destination.', cancelled: 'Cancel this shipment? Its share of the invoice becomes available again.', in_transit: 'Reopen this shipment as in transit?' }[status]; if (q && !window.confirm(q)) return; call(() => adminFetch(`/shipments/${sid}`, { method: 'PATCH', body: { status } }), 'Status updated') }
  const remove = () => { if (!window.confirm('Delete this shipment and its checkpoints? This cannot be undone.')) return; call(async () => { await adminFetch(`/shipments/${sid}`, { method: 'DELETE' }); nav(`/staff360/quotes/${id}`) }) }

  const closed = s && ['delivered', 'cancelled'].includes(s.status)
  const cps = s?.checkpoints || []
  const last = cps[cps.length - 1]
  const carries = s ? shareLines(s, s.quote?.items) : []
  return (
    <>
      <Link to={`/staff360/quotes/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />{s?.quote?.number || 'Invoice'}</Link>
      <PageHeader eyebrow="Sales" title={s ? `Shipment ${s.number}` : ' '} description={s ? `${MODE_LABELS[s.mode] || 'By road'}${s.vehicle ? ` · ${s.vehicle}` : ''} · ${fmtPct(s.percent)}% of ${s.quote?.number}${s.eta ? ` · expected ${fmtEta(s.eta)}` : ''}` : ''}
        action={s && <Badge tone={shipmentTone(s.status)}>{SHIPMENT_LABELS[s.status]}</Badge>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!s || !form ? <Card className="p-6 space-y-4">{[...Array(4)].map((_, i) => <Bone key={i} className="h-11 w-full" />)}</Card> : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <Card className="p-4 md:p-5 animate-fade-up">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm">
                <p><span className="font-semibold">{s.origin?.name || 'Origin'}</span> <span className="text-muted-foreground">→</span> <span className="font-semibold">{s.destination?.name || 'Destination'}</span></p>
                <p className="text-xs text-muted-foreground">{s.status === 'delivered' ? `Delivered ${fmtDateTime(s.delivered_at)}` : last ? `Now at ${last.name} · ${ago(last.created_at)}` : 'Not on the road yet'}</p>
              </div>
              <Suspense fallback={<Bone className="h-[420px] w-full rounded-2xl" />}>
                <RouteMap className="h-[420px]" origin={s.origin} destination={s.destination} checkpoints={cps} picked={closed ? null : cp} delivered={s.status === 'delivered'} onPick={closed ? undefined : onPick} />
              </Suspense>
              <p className="text-xs text-muted-foreground mt-2">Scroll to zoom, drag to move the map{closed ? '.' : ', click anywhere to place the next pin — or pick a state on the right.'}</p>
              {carries.length > 0 && <ul className="mt-3 flex flex-wrap gap-2 text-xs">{carries.map(c => <li key={c.index} className="rounded-full bg-muted px-2.5 py-1">{c.text}</li>)}</ul>}
            </Card>

            <Card className="animate-fade-up" style={{ animationDelay: '70ms' }}>
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between"><h2 className="text-sm font-semibold">Journey</h2><span className="text-xs text-muted-foreground">{cps.length} {cps.length === 1 ? 'pin' : 'pins'}</span></div>
              <ol className="divide-y divide-border">
                {[...cps].reverse().map((c, i) => (
                  <li key={c.id} className="px-5 py-3 flex gap-3 text-sm">
                    <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${i === 0 && s.status !== 'delivered' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{c.name}{c.state && !c.name.includes(c.state) && <span className="text-muted-foreground font-normal"> · {c.state}</span>}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(c.created_at)}{c.note && ` — ${c.note}`}</p>
                    </div>
                    {!closed && <button type="button" onClick={() => removeCp(c)} className="h-8 w-8 rounded-lg text-destructive hover:bg-muted flex items-center justify-center shrink-0" aria-label="Remove pin"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </li>
                ))}
                <li className="px-5 py-3 flex gap-3 text-sm"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-accent" /><div><p className="font-medium">{s.origin?.name || 'Origin'}</p><p className="text-xs text-muted-foreground">Departure point · created {fmtDateTime(s.created_at)}</p></div></li>
              </ol>
            </Card>

            <Card className="p-5 animate-fade-up" style={{ animationDelay: '110ms' }}>
              <h2 className="font-semibold mb-3">Shipment details</h2>
              <form onSubmit={saveForm} className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">What goes on this shipment</p>
                  <ShareTable lines={s.lines_for_edit || []} values={form.items} disabled={closed} onChange={(i, v) => setForm(f => ({ ...f, items: { ...f.items, [i]: v } }))} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Shipment type"><Select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>{SHIPMENT_MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}</Select></Field>
                  <Field label={VEHICLE_LABELS[form.mode]} hint={VEHICLE_HINTS[form.mode]}><Input value={form.vehicle} onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))} /></Field>
                  <PlacePicker label="From" value={form.origin} onChange={origin => setForm(f => ({ ...f, origin }))} />
                  <PlacePicker label="To" value={form.destination} onChange={destination => setForm(f => ({ ...f, destination }))} />
                  <Field label="Expected date of arrival"><Input type="date" value={form.eta} onChange={e => setForm(f => ({ ...f, eta: e.target.value }))} /></Field>
                  <Field label="Notes" hint="Shown to the client"><Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
                </div>
                <Button type="submit" variant="outline" disabled={busy}>Save details</Button>
              </form>
            </Card>
          </div>

          <div className="space-y-5 lg:sticky lg:top-24">
            {!closed && (
              <Card className="p-5 animate-fade-up" style={{ animationDelay: '100ms' }}>
                <h2 className="font-semibold mb-3">Update location</h2>
                <form onSubmit={addCp} className="space-y-3">
                  <Field label="State"><Select value={cp.state} onChange={e => pickState(e.target.value)}><option value="">Choose a state…</option>{NG_STATES.map(x => <option key={x.state} value={x.state}>{x.state} — {x.capital}</option>)}</Select></Field>
                  <Field label="Place" hint={cp.lat != null ? `Pin at ${cp.lat}, ${cp.lng}` : 'Pick a state or click the map'}><Input required value={cp.name} onChange={e => setCp(c => ({ ...c, name: e.target.value }))} placeholder="Town, checkpoint, depot, port…" /></Field>
                  <Field label="Note" hint="Optional; the client sees it"><Textarea rows={2} value={cp.note} onChange={e => setCp(c => ({ ...c, note: e.target.value }))} placeholder="e.g. Cleared the Ogere weighbridge" /></Field>
                  <Button type="submit" variant="accent" className="w-full" disabled={busy || cp.lat == null}><MapPin className="w-4 h-4" />Add location</Button>
                </form>
              </Card>
            )}
            <Card className="p-5 space-y-2 animate-fade-up" style={{ animationDelay: '140ms' }}>
              {s.status === 'in_transit' || s.status === 'planned' ? (
                <>
                  <Button type="button" variant="primary" className="w-full" disabled={busy} onClick={() => setStatus('delivered')}><CheckCircle2 className="w-4 h-4" />Mark delivered</Button>
                  <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => setStatus('cancelled')}><XCircle className="w-4 h-4" />Cancel shipment</Button>
                </>
              ) : <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => setStatus('in_transit')}>Reopen as in transit</Button>}
              <Button type="button" variant="ghost" className="w-full h-8 text-xs text-destructive" disabled={busy} onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete shipment</Button>
            </Card>
          </div>
        </div>
      )}
      {toastEl}
    </>
  )
}
