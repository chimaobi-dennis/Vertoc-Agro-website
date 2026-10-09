/*
 * A bidding opportunity: what we want to buy, on what terms, and until
 * when suppliers may bid. While it is a draft only staff see it; published,
 * it is listed on the website and takes bids between its opening and
 * closing dates. Once it exists, the Bids tab compares what came in.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Ban, Copy, ExternalLink, FileText, Gavel, Lock, Mail, Megaphone, RotateCcw, Trash2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Tabs, Textarea, confirmDelete, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import BidsTable from './BidsTable'
import TenderNotices from './TenderNotices'
import { DraftNotice, useDraft } from './useDraft'
import { FILE_LABELS, TENDER_LABELS, fmtMoment, fromLocalInput, fromNow, money, perUnit, poTone, qty, tenderTone, toLocalInput } from '../lib/procurement'

const inDays = d => { const x = new Date(Date.now() + d * 86400e3); x.setHours(17, 0, 0, 0); return toLocalInput(x.toISOString()) }
const blank = s => ({ number: '', title: '', commodity: '', quantity: '', unit: s?.default_unit || 'MT', specification: '', delivery_location: '', delivery_period: '', delivery_by: '', asking_price: '', currency: s?.default_currency || 'NGN', payment_terms: s?.payment_terms || '', requirements: '', required_documents: [], opens_at: '', closes_at: inDays(14) })
const TABS = [{ key: 'bids', label: 'Bids', icon: Gavel }, { key: 'notify', label: 'Notify suppliers', icon: Mail }, { key: 'details', label: 'Details', icon: FileText }]

export default function TenderForm() {
  const { id } = useParams(); const editing = Boolean(id)
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [tender, setTender] = useState(null)
  const [settings, setSettings] = useState(null)
  const [draft, setDraft, draftInfo] = useDraft('tender:new', null, { enabled: !editing })
  const [form, setForm] = useState(() => (!editing && draft) ? { ...blank(), ...draft } : blank())
  useEffect(() => { if (!editing) setDraft(form) }, [form, editing]) // eslint-disable-line react-hooks/exhaustive-deps
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [toast, toastEl] = useToast()
  const tab = editing && ['details', 'notify'].includes(sp.get('tab')) ? sp.get('tab') : editing ? 'bids' : 'details'

  const fill = t => setForm({
    number: (String(t.number || '').match(/-(\d+)$/) || [])[1] || '', title: t.title, commodity: t.commodity, quantity: t.quantity, unit: t.unit, specification: t.specification,
    delivery_location: t.delivery_location, delivery_period: t.delivery_period, delivery_by: t.delivery_by || '', asking_price: t.asking_price ?? '', currency: t.currency,
    payment_terms: t.payment_terms, requirements: t.requirements, required_documents: t.required_documents || [], opens_at: toLocalInput(t.opens_at), closes_at: toLocalInput(t.closes_at),
  })
  const load = useCallback(() => adminFetch(`/tenders/${id}`).then(t => { setTender(t); fill(t); setDirty(false) }).catch(e => setErr(e.message)), [id])
  useEffect(() => {
    adminFetch('/settings').then(s => { setSettings(s); if (!editing && !draft) setForm(f => ({ ...blank(s.procurement), ...Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== '' && !['unit', 'currency', 'payment_terms'].includes(k))) })) }).catch(() => setSettings({ procurement: {} }))
    if (editing) load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = patch => { setForm(f => ({ ...f, ...patch })); setDirty(true) }
  const body = () => ({ ...form, asking_price: form.asking_price === '' ? null : form.asking_price, delivery_by: form.delivery_by || null, opens_at: fromLocalInput(form.opens_at), closes_at: fromLocalInput(form.closes_at) })
  const save = async (extra = {}) => {
    setErr(null); setBusy(true)
    try {
      if (editing) { const t = await adminFetch(`/tenders/${id}`, { method: 'PATCH', body: { ...body(), ...extra } }); setTender(x => ({ ...x, ...t })); fill(t); setDirty(false); return t }
      const t = await adminFetch('/tenders', { method: 'POST', body: { ...body(), ...extra } }); draftInfo.clear(); nav(`/staff360/tenders/${t.id}?tab=details`, { replace: true }); return t
    } catch (x) { setErr(x.message); throw x } finally { setBusy(false) }
  }
  const submit = e => { e.preventDefault(); save().then(() => toast('Saved')).catch(() => {}) }
  const move = (status, ask, done) => async () => {
    if (ask && !window.confirm(ask)) return
    try { await save({ status }); toast(done) } catch { /* shown above the form */ }
  }
  const copyLink = () => navigator.clipboard.writeText(tender.link).then(() => toast('Link copied')).catch(() => toast(tender.link))
  const remove = async () => { if (!confirmDelete(tender.number)) return; try { await adminFetch(`/tenders/${id}`, { method: 'DELETE' }); nav('/staff360/tenders') } catch (x) { toast(x.message, 'error') } }
  const setTab = t => { const n = new URLSearchParams(sp); t === 'bids' ? n.delete('tab') : n.set('tab', t); setSp(n, { replace: true }) }

  const loading = !settings || (editing && !tender)
  const state = tender?.state
  const year = (editing && tender?.number?.match(/-(\d{4})-/)?.[1]) || new Date().getFullYear()
  const unit = form.unit || 'MT'
  const value = Number(form.quantity) > 0 && Number(form.asking_price) > 0 ? Number(form.quantity) * Number(form.asking_price) : null
  const c = tender?.counts || {}

  return (
    <>
      <Link to="/staff360/tenders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Bidding</Link>
      <PageHeader eyebrow="Procurement" title={editing ? (tender?.number || ' ') : 'New bidding opportunity'}
        description={editing && tender ? `${tender.title} · ${qty(tender.quantity, tender.unit)}${tender.asking_price != null ? ` at ${perUnit(tender.asking_price, tender.currency, tender.unit)}` : ''}` : 'Say what you want to buy. Suppliers see it on the website once you publish it, and bid until the closing date.'}
        action={editing && tender && <Badge tone={tenderTone(state)}>{TENDER_LABELS[state]}</Badge>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!editing && <DraftNotice draft={draftInfo} onDiscard={() => { draftInfo.clear(); setForm(blank(settings?.procurement)); setDirty(false) }} />}
      {editing && tender && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 animate-fade-up">
          {[['Bids', (c.total || 0) - (c.withdrawn || 0)], ['New', c.open || 0], ['Shortlisted', c.shortlisted || 0], ['Awarded', c.awarded || 0]].map(([l, n]) => (
            <Card key={l} className="px-4 py-3"><p className="text-2xl font-bold tabular-nums">{n}</p><p className="text-xs text-muted-foreground">{l}</p></Card>
          ))}
        </div>
      )}
      {editing && <Tabs tabs={TABS.map(t => (t.key === 'bids' ? { ...t, count: tender ? (c.total || 0) - (c.withdrawn || 0) : undefined } : t))} value={tab} onChange={setTab} />}

      {editing && tender && tab === 'notify' && <TenderNotices tender={tender} state={state} />}

      {editing && tender && tab === 'bids' && (
        <>
          {state === 'open' && tender.award?.suppliers > 0 && <div className="mb-4"><Alert tone="info">{qty(tender.award.awarded, tender.unit)} of {qty(tender.award.required, tender.unit)} has been awarded, and bidding stays open for other suppliers until {fmtMoment(tender.closes_at)}. Awarding never closes an opportunity; only the closing time does.</Alert></div>}
          {state === 'draft' && <div className="mb-4"><Alert tone="info">This opportunity is a draft. Publish it from the Details tab and it appears on the website, open for bids.</Alert></div>}
          <BidsTable tender={tender} onChanged={load} />
          {tender.orders?.length > 0 && (
            <Card className="mt-6 animate-fade-up">
              <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Purchase orders raised from this opportunity</h2></div>
              <ul className="divide-y divide-border">
                {tender.orders.map(o => <li key={o.id}><Link to={`/staff360/purchase-orders/${o.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-muted/40"><span className="font-semibold">{o.number}</span><span className="text-muted-foreground flex-1 truncate">{o.supplier_name}</span><span className="tabular-nums">{money(o.total, o.currency)}</span><Badge tone={poTone(o.status)}>{o.status}</Badge></Link></li>)}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === 'details' && (loading ? (
        <div className="grid lg:grid-cols-[1fr_340px] gap-6"><Card className="p-6 space-y-4">{[...Array(7)].map((_, i) => <Bone key={i} className="h-11 w-full" />)}</Card><Card className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Bone key={i} className="h-10 w-full" />)}</Card></div>
      ) : (
        <form onSubmit={submit} className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <Card className="p-6 grid md:grid-cols-2 gap-5 animate-fade-up">
              <Field label="Commodity *"><Input required value={form.commodity} onChange={e => set({ commodity: e.target.value })} placeholder="Soybeans, maize, cocoa, palm oil…" /></Field>
              <Field label="Title" hint="Shown as the heading. Left empty it becomes “<commodity> supply opportunity”."><Input value={form.title} onChange={e => set({ title: e.target.value })} placeholder={form.commodity ? `${form.commodity} supply opportunity` : ''} /></Field>
              <Field label="Required quantity *">
                <div className="flex"><Input className="rounded-r-none" required type="number" min="0" step="0.001" value={form.quantity} onChange={e => set({ quantity: e.target.value })} placeholder="1000" /><Input className="rounded-l-none border-l-0 w-24" value={form.unit} onChange={e => set({ unit: e.target.value })} aria-label="Unit" /></div>
              </Field>
              <Field label={`Asking price per ${unit}`} hint={value ? `Worth ${money(value, form.currency)} in all. Suppliers see the asking price and still enter their own.` : 'Suppliers see it and still enter their own price, so you can compare.'}>
                <div className="flex"><Input className="rounded-r-none w-24" maxLength={3} value={form.currency} onChange={e => set({ currency: e.target.value.toUpperCase() })} aria-label="Currency" /><Input className="rounded-l-none border-l-0" type="number" min="0" step="0.01" value={form.asking_price} onChange={e => set({ asking_price: e.target.value })} placeholder="650000" /></div>
              </Field>
              <Field label="Quality / specification" hint="Moisture content, foreign matter, damaged grains… one per line." className="md:col-span-2"><Textarea rows={4} value={form.specification} onChange={e => set({ specification: e.target.value })} placeholder={'Export quality\nMoisture: 12% max\nForeign matter: 1% max'} /></Field>
            </Card>

            <Card className="p-6 grid md:grid-cols-2 gap-5 animate-fade-up" style={{ animationDelay: '70ms' }}>
              <Field label="Delivery location"><Input value={form.delivery_location} onChange={e => set({ delivery_location: e.target.value })} placeholder="Ibadan, Oyo State" /></Field>
              <Field label="Delivery period" hint="In words, as suppliers should read it."><Input value={form.delivery_period} onChange={e => set({ delivery_period: e.target.value })} placeholder="Within 30 days of award" /></Field>
              <Field label="Deliver by" hint="Optional: the latest date, used on the purchase order."><Input type="date" value={form.delivery_by} onChange={e => set({ delivery_by: e.target.value })} /></Field>
              <div />
              <Field label="Payment terms" hint="Suppliers say whether they accept these. The default comes from Settings → Procurement." className="md:col-span-2"><Textarea rows={3} value={form.payment_terms} onChange={e => set({ payment_terms: e.target.value })} /></Field>
              <Field label="Additional requirements" hint="Certifications, inspection, documentation, packaging…" className="md:col-span-2"><Textarea rows={4} value={form.requirements} onChange={e => set({ requirements: e.target.value })} /></Field>
              <fieldset className="md:col-span-2">
                <legend className="block text-sm font-semibold text-foreground mb-1.5">Documents suppliers must upload</legend>
                <p className="text-xs text-muted-foreground mb-3">Documents are optional on the bid form unless you tick them here. Ticked ones must be attached before a bid can be submitted.</p>
                <div className="grid sm:grid-cols-2 gap-2">{FILE_LABELS.filter(l => !/^Other/.test(l)).map(l => <label key={l} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(form.required_documents || []).includes(l)} onChange={e => set({ required_documents: e.target.checked ? [...(form.required_documents || []), l] : form.required_documents.filter(x => x !== l) })} />{l}</label>)}</div>
              </fieldset>
            </Card>

            <Card className="p-6 grid md:grid-cols-2 gap-5 animate-fade-up" style={{ animationDelay: '140ms' }}>
              <Field label="Bids open" hint="Left empty, bids open as soon as it is published."><Input type="datetime-local" value={form.opens_at} onChange={e => set({ opens_at: e.target.value })} /></Field>
              <Field label="Bids close *" hint={form.closes_at ? `That is ${fromNow(fromLocalInput(form.closes_at))}.` : undefined}><Input type="datetime-local" required value={form.closes_at} onChange={e => set({ closes_at: e.target.value })} /></Field>
              <Field label="Reference number" hint={editing ? 'Change only the digits if you need to.' : 'Leave empty for the next free number.'}>
                <div className="flex max-w-xs"><span className="inline-flex items-center h-11 px-3 rounded-l-xl border border-r-0 border-border bg-muted text-sm font-medium text-muted-foreground whitespace-nowrap">VB-{year}-</span><Input className="rounded-l-none" inputMode="numeric" maxLength={6} placeholder={editing ? '' : 'auto'} value={form.number} onChange={e => set({ number: e.target.value.replace(/\D/g, '') })} /></div>
              </Field>
            </Card>
          </div>

          <div className="space-y-5 lg:sticky lg:top-24">
            <Card className="p-5 space-y-3 animate-fade-up" style={{ animationDelay: '100ms' }}>
              <Button type="submit" variant={editing && state !== 'draft' ? 'accent' : 'outline'} className="w-full" disabled={busy}>{busy ? 'Saving…' : editing ? (dirty ? 'Save changes' : 'Saved') : 'Save as draft'}</Button>
              {(!editing || state === 'draft') && <Button type="button" variant="accent" className="w-full" disabled={busy} onClick={move('published', null, 'Published — it is on the website now')}><Megaphone className="w-4 h-4" />{editing ? 'Publish' : 'Save and publish'}</Button>}
              {editing && ['open', 'upcoming'].includes(state) && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={move('closed', 'Stop taking bids on this opportunity now?', 'Closed for bids')}><Lock className="w-4 h-4" />Close bidding now</Button>}
              {editing && state === 'closed' && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={move('published', null, 'Open for bids again')} title="Set a closing date in the future first"><RotateCcw className="w-4 h-4" />Reopen for bids</Button>}
              {editing && state === 'cancelled' && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={move('draft', null, 'Back to draft')}><RotateCcw className="w-4 h-4" />Restore as a draft</Button>}
              {editing && !['cancelled', 'draft'].includes(state) && <Button type="button" variant="ghost" className="w-full text-destructive" disabled={busy} onClick={move('cancelled', 'Cancel this opportunity? It leaves the website; the bids are kept.', 'Cancelled')}><Ban className="w-4 h-4" />Cancel opportunity</Button>}
            </Card>
            {editing && tender && (
              <Card className="p-5 animate-fade-up text-sm" style={{ animationDelay: '170ms' }}>
                {state !== 'draft' && state !== 'cancelled' && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <a href={tender.link} target="_blank" rel="noreferrer"><Button type="button" variant="outline" className="w-full"><ExternalLink className="w-4 h-4" />View</Button></a>
                    <Button type="button" variant="outline" onClick={copyLink}><Copy className="w-4 h-4" />Link</Button>
                  </div>
                )}
                <dl className="text-xs text-muted-foreground space-y-1.5">
                  <div className="flex justify-between gap-3"><dt>Created</dt><dd>{fmtMoment(tender.created_at)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Bids open</dt><dd>{fmtMoment(tender.opens_at)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Bids close</dt><dd>{fmtMoment(tender.closes_at)}</dd></div>
                </dl>
                <div className="mt-4 pt-3 border-t border-border"><Button type="button" variant="ghost" className="h-8 px-2 text-xs text-destructive" onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete opportunity</Button></div>
              </Card>
            )}
          </div>
        </form>
      ))}
      {toastEl}
    </>
  )
}
