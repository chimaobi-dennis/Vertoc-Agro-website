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
import { SHIPMENT_LABELS, ago, fmtPct, shareOf, shipmentTone } from '../lib/shipments'
import PlacePicker from './PlacePicker'
const RouteMap = lazy(() => import('../components/RouteMap'))

const blankCp = () => ({ state: '', name: '', lat: null, lng: null, note: '' })

export default function ShipmentDetail() {
  const { id, sid } = useParams(); const nav = useNavigate()
  const [s, setS] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false)
  const [cp, setCp] = useState(blankCp)
  const [route, setRoute] = useState(null)
  const [toast, toastEl] = useToast()

  const load = useCallback(() => adminFetch(`/shipments/${sid}`).then(x => { setS(x); setRoute({ percent: fmtPct(x.percent), origin: x.origin, destination: x.destination, vehicle: x.vehicle, notes: x.notes }) }).catch(e => setErr(e.message)), [sid])
  useEffect(() => { load() }, [load])

  const onPick = useCallback(p => setCp(c => { const near = nearestState(p); return { ...c, lat: p.lat, lng: p.lng, state: c.state || near?.state || '', name: c.name || (near ? `Near ${near.capital}, ${near.state}` : '') } }), [])
  const pickState = name => { const st = NG_STATES.find(x => x.state === name); setCp(c => st ? { ...c, state: st.state, name: `${st.capital}, ${st.state}`, lat: st.lat, lng: st.lng } : { ...c, state: '' }) }
  const call = async (fn, ok) => { setBusy(true); setErr(null); try { await fn(); if (ok) toast(ok); await load() } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  const addCp = e => { e.preventDefault(); call(async () => { await adminFetch(`/shipments/${sid}/checkpoints`, { method: 'POST', body: cp }); setCp(blankCp()) }, 'Location added') }
  const removeCp = c => { if (!window.confirm(`Remove the pin at ${c.name}?`)) return; call(() => adminFetch(`/shipments/${sid}/checkpoints/${c.id}`, { method: 'DELETE' })) }
  const saveRoute = e => { e.preventDefault(); call(() => adminFetch(`/shipments/${sid}`, { method: 'PATCH', body: route }), 'Saved') }
  const setStatus = status => { const q = { delivered: 'Mark this shipment as delivered? It will be pinned at the destination.', cancelled: 'Cancel this shipment? Its share of the invoice becomes available again.', in_transit: 'Reopen this shipment as in transit?' }[status]; if (q && !window.confirm(q)) return; call(() => adminFetch(`/shipments/${sid}`, { method: 'PATCH', body: { status } }), 'Status updated') }
  const remove = () => { if (!window.confirm('Delete this shipment and its checkpoints? This cannot be undone.')) return; call(async () => { await adminFetch(`/shipments/${sid}`, { method: 'DELETE' }); nav(`/staff360/quotes/${id}`) }) }

  const closed = s && ['delivered', 'cancelled'].includes(s.status)
  const cps = s?.checkpoints || []
  const last = cps[cps.length - 1]
  return (
    <>
      <Link to={`/staff360/quotes/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />{s?.quote?.number || 'Invoice'}</Link>
      <PageHeader eyebrow="Sales" title={s ? `Shipment ${s.number}` : ' '} description={s ? `${fmtPct(s.percent)}% of ${s.quote?.number}${s.quote?.title ? ` — ${s.quote.title}` : ''}` : ''}
        action={s && <Badge tone={shipmentTone(s.status)}>{SHIPMENT_LABELS[s.status]}</Badge>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!s ? <Card className="p-6 space-y-4">{[...Array(4)].map((_, i) => <Bone key={i} className="h-11 w-full" />)}</Card> : (
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
              {!closed && <p className="text-xs text-muted-foreground mt-2">Click anywhere on the map to place the next pin, or pick a state on the right.</p>}
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
          </div>

          <div className="space-y-5 lg:sticky lg:top-24">
            {!closed && (
              <Card className="p-5 animate-fade-up" style={{ animationDelay: '100ms' }}>
                <h2 className="font-semibold mb-3">Update location</h2>
                <form onSubmit={addCp} className="space-y-3">
                  <Field label="State"><Select value={cp.state} onChange={e => pickState(e.target.value)}><option value="">Choose a state…</option>{NG_STATES.map(x => <option key={x.state} value={x.state}>{x.state} — {x.capital}</option>)}</Select></Field>
                  <Field label="Place" hint={cp.lat != null ? `Pin at ${cp.lat}, ${cp.lng}` : 'Pick a state or click the map'}><Input required value={cp.name} onChange={e => setCp(c => ({ ...c, name: e.target.value }))} placeholder="Town, checkpoint, depot…" /></Field>
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
            <Card className="p-5 animate-fade-up" style={{ animationDelay: '180ms' }}>
              <h2 className="font-semibold mb-3">Shipment</h2>
              <form onSubmit={saveRoute} className="space-y-3">
                <Field label="Share of the invoice (%)" hint={`${fmtPct(s.remaining_for_edit ?? 0)}% more could be added`}>
                  <Input type="number" min="0.01" max="100" step="0.01" value={route.percent} disabled={closed} onChange={e => setRoute(r => ({ ...r, percent: e.target.value }))} />
                  {shareOf(s.quote?.items, route.percent).length > 0 && <ul className="text-xs text-muted-foreground mt-1.5 space-y-0.5">{shareOf(s.quote?.items, route.percent).map(x => <li key={x}>≈ {x}</li>)}</ul>}
                </Field>
                <PlacePicker label="From" value={route.origin} onChange={origin => setRoute(r => ({ ...r, origin }))} />
                <PlacePicker label="To" value={route.destination} onChange={destination => setRoute(r => ({ ...r, destination }))} />
                <Field label="Truck / driver"><Input value={route.vehicle} onChange={e => setRoute(r => ({ ...r, vehicle: e.target.value }))} /></Field>
                <Field label="Notes" hint="Shown to the client"><Textarea rows={2} value={route.notes} onChange={e => setRoute(r => ({ ...r, notes: e.target.value }))} /></Field>
                <Button type="submit" variant="outline" className="w-full" disabled={busy}>Save</Button>
              </form>
            </Card>
          </div>
        </div>
      )}
      {toastEl}
    </>
  )
}
