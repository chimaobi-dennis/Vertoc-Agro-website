/*
 * One bid: who offers what, against what we asked; its documents; the
 * requests for information and their answers; the status, which the
 * supplier is told about; and, once awarded, the purchase order.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileSignature, History, Lock, LockOpen, Mail, MessageCircleQuestion, Trash2, XCircle } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Modal, Select, Textarea, useToast } from './ui'
import { useAuth } from './AuthContext'
import { Bone } from '../components/Skeleton'
import Composer from './Composer'
import BidStatusDialog from './BidStatusDialog'
import { DocumentsPanel } from './ClientTabs'
import { fmtDateTime, messageTone } from './format'
import { BID_LABELS, BID_PATH, PO_KINDS, PO_SHORT, TENDER_LABELS, bidTone, fmtDay, fmtMoment, money, pct, perUnit, poTone, qty, tenderTone } from '../lib/procurement'

export default function BidDetail() {
  const { id } = useParams(); const nav = useNavigate()
  const { can } = useAuth()
  const [unlocking, setUnlocking] = useState(false)
  const [reason, setReason] = useState('')
  const [b, setB] = useState(null)
  const [err, setErr] = useState(null)
  const [notes, setNotes] = useState('')
  const [question, setQuestion] = useState('')
  const [askNotify, setAskNotify] = useState(true)
  const [dialog, setDialog] = useState(null)
  const [compose, setCompose] = useState(false)
  const [kind, setKind] = useState('lpo')
  const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()

  // Saves answer without the email list; keep the one already loaded.
  const take = x => { setB(prev => ({ ...x, messages: x.messages ?? prev?.messages ?? [], award: x.award ?? prev?.award ?? null })); setNotes(x.internal_notes || '') }
  const load = useCallback(() => adminFetch(`/bids/${id}`).then(take).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])
  const run = async (fn, ok) => { setBusy(true); try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); return r } catch (x) { toast(x.message, 'error') } finally { setBusy(false) } }
  const saveNotes = () => run(async () => take(await adminFetch(`/bids/${id}`, { method: 'PATCH', body: { internal_notes: notes } })), 'Notes saved')
  const ask = e => { e.preventDefault(); run(async () => { const r = await adminFetch(`/bids/${id}/requests`, { method: 'POST', body: { question, notify: askNotify } }); take(r); setQuestion(''); return r }, r => (r.notified ? 'Request sent to the supplier' : 'Request added')) }
  const unask = r => { if (window.confirm('Remove this request?')) run(async () => take(await adminFetch(`/bids/${id}/requests/${r.id}`, { method: 'DELETE' }))) }
  const raise = () => run(async () => { const o = await adminFetch('/purchase-orders', { method: 'POST', body: { bid_id: b.id, kind } }); nav(`/staff360/purchase-orders/${o.id}`) })
  const unlock = e => { e.preventDefault(); run(async () => { take(await adminFetch(`/bids/${id}/unlock`, { method: 'POST', body: { reason } })); setUnlocking(false); setReason(''); load() }, 'Bid unlocked — the supplier has been told') }
  const relock = () => { if (window.confirm('Lock this bid again? The supplier will no longer be able to change it.')) run(async () => { take(await adminFetch(`/bids/${id}/unlock`, { method: 'DELETE' })); load() }, 'Bid locked again') }
  const remove = () => { if (window.confirm(`Delete the bid from ${b.company_name} and its documents? This cannot be undone.`)) run(async () => { await adminFetch(`/bids/${id}`, { method: 'DELETE' }); nav(b.tender ? `/staff360/tenders/${b.tender.id}` : '/staff360/bids') }) }

  if (err) return <Alert>{err}</Alert>
  if (!b) return <div className="grid lg:grid-cols-[1fr_340px] gap-6"><Card className="p-6 space-y-4">{[...Array(6)].map((_, i) => <Bone key={i} className="h-10 w-full" />)}</Card><Card className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Bone key={i} className="h-10 w-full" />)}</Card></div>

  const t = b.tender
  const withdrawn = b.status === 'withdrawn'
  const at = BID_PATH.indexOf(b.status)
  const v = b.vs_asking == null ? null : b.vs_asking === 0 ? ['Exactly our asking price', 'text-muted-foreground'] : b.vs_asking < 0 ? [`${money(Math.abs(b.vs_asking), b.currency)} (${pct(b.vs_asking_pct)}) below our asking price`, 'text-emerald-600 dark:text-emerald-400'] : [`${money(b.vs_asking, b.currency)} (${pct(b.vs_asking_pct)}) above our asking price`, 'text-destructive']
  const covers = t && t.quantity > 0 ? Math.round(b.quantity / t.quantity * 1000) / 10 : null
  const openRequests = b.requests.filter(r => !r.answered_at).length

  return (
    <>
      <Link to={t ? `/staff360/tenders/${t.id}` : '/staff360/bids'} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />{t ? t.number : 'Bids'}</Link>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6 animate-fade-up">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1.5">Bid #{b.id} · received {fmtMoment(b.created_at)}</p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">{b.company_name}</h1>
          {t && <p className="text-sm text-muted-foreground mt-1.5">on <Link to={`/staff360/tenders/${t.id}`} className="font-medium text-accent">{t.number}</Link> · {t.title} <Badge tone={tenderTone(t.state)} className="ml-1">{TENDER_LABELS[t.state]}</Badge></p>}
        </div>
        <Badge tone={bidTone(b.status)} className="text-sm px-3 py-1">{BID_LABELS[b.status]}</Badge>
      </div>

      {/* where the bid stands */}
      <Card className="p-5 mb-6 animate-fade-up">
        <ol className="grid grid-cols-4 gap-2">
          {BID_PATH.map((s, i) => { const last = i === BID_PATH.length - 1; const label = last && b.status === 'not_selected' ? 'Not selected' : BID_LABELS[s]; const done = b.status === 'not_selected' ? true : !withdrawn && at >= i; const lost = last && b.status === 'not_selected'; return (
            <li key={s} className="min-w-0">
              <div className={`h-1.5 rounded-full ${lost ? 'bg-muted-foreground/40' : done ? 'bg-accent' : 'bg-muted'}`} />
              <p className={`mt-2 text-xs font-semibold truncate ${lost ? 'text-muted-foreground' : done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>
            </li>
          ) })}
        </ol>
        {withdrawn && <p className="mt-3 text-sm text-destructive">The supplier withdrew this bid on {fmtMoment(b.withdrawn_at || b.status_changed_at)}.</p>}
        {b.unlocked_at && <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><LockOpen className="w-4 h-4" />Unlocked {fmtMoment(b.unlocked_at)}: the supplier may change and resubmit it once.</p>}
        {b.status === 'awarded' && <p className="mt-3 text-sm"><span className="text-muted-foreground">Awarded: </span><b>{qty(b.awarded_quantity ?? b.quantity, b.unit)}</b> at <b>{perUnit(b.awarded_price ?? b.price, b.currency, b.unit)}</b>{t?.quantity > 0 && <span className="text-muted-foreground"> · {Math.round((b.awarded_quantity ?? b.quantity) / t.quantity * 1000) / 10}% of the requirement · {money((b.awarded_quantity ?? b.quantity) * (b.awarded_price ?? b.price), b.currency)}</span>}</p>}
        {b.status_note && <p className="mt-3 text-sm"><span className="text-muted-foreground">Note sent with this status: </span>{b.status_note}</p>}
      </Card>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card className="p-6 animate-fade-up">
            <h2 className="font-semibold mb-4">The offer</h2>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Proposed price</dt><dd className="text-xl font-bold tabular-nums mt-0.5">{perUnit(b.price, b.currency, b.unit)}</dd>{v && <dd className={`text-xs mt-0.5 ${v[1]}`}>{v[0]}</dd>}{t?.asking_price != null && <dd className="text-xs text-muted-foreground">We asked {perUnit(t.asking_price, t.currency, t.unit)}</dd>}</div>
              <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Quantity they can supply</dt><dd className="text-xl font-bold tabular-nums mt-0.5">{qty(b.quantity, b.unit)}</dd>{covers != null && <dd className="text-xs text-muted-foreground mt-0.5">{covers}% of the {qty(t.quantity, t.unit)} we need</dd>}</div>
              <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Total bid value</dt><dd className="font-semibold tabular-nums mt-0.5">{money(b.total, b.currency)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Commodity</dt><dd className="font-medium mt-0.5">{b.commodity}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Location of the commodity</dt><dd className="font-medium mt-0.5">{b.commodity_location}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Expected delivery</dt><dd className="font-medium mt-0.5">{fmtDay(b.delivery_date)}{t?.delivery_by && <span className="block text-xs font-normal text-muted-foreground">{b.delivery_date <= t.delivery_by ? 'within' : 'after'} our date of {fmtDay(t.delivery_by)}</span>}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wider text-muted-foreground">Payment terms</dt>
                <dd className="mt-1">{b.accepts_terms ? <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-4 h-4" />Accepts the stated terms</span> : <span className="inline-flex items-center gap-1.5 font-medium text-destructive"><XCircle className="w-4 h-4" />Does not accept the stated terms</span>}</dd>
                {b.terms_note && <dd className="text-sm mt-1"><span className="text-muted-foreground">They propose: </span>{b.terms_note}</dd>}
                {t?.payment_terms && <dd className="text-xs text-muted-foreground mt-1">Ours: {t.payment_terms}</dd>}
              </div>
              {b.note && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wider text-muted-foreground">Their note</dt><dd className="mt-1 whitespace-pre-wrap">{b.note}</dd></div>}
              <div className="sm:col-span-2 text-xs text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-accent" />Declaration confirmed {fmtMoment(b.confirmed_at)}</div>
            </dl>
          </Card>

          <Card className="animate-fade-up" style={{ animationDelay: '70ms' }}>
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between"><h2 className="text-sm font-semibold flex items-center gap-2"><MessageCircleQuestion className="w-4 h-4 text-accent" />Requests for information</h2>{openRequests > 0 && <Badge tone="amber">{openRequests} awaiting answer</Badge>}</div>
            <ul className="divide-y divide-border">
              {b.requests.map(r => (
                <li key={r.id} className="px-5 py-4 text-sm">
                  <div className="flex items-start gap-3"><p className="flex-1 whitespace-pre-wrap"><span className="text-xs text-muted-foreground block mb-0.5">We asked · {fmtMoment(r.asked_at)}</span>{r.question}</p>{!r.answered_at && <button type="button" onClick={() => unask(r)} className="p-1.5 rounded-lg text-destructive hover:bg-muted" aria-label="Remove request"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
                  {r.answered_at ? <p className="mt-3 rounded-xl bg-muted/60 p-3 whitespace-pre-wrap"><span className="text-xs text-muted-foreground block mb-0.5">{b.company_name} answered · {fmtMoment(r.answered_at)}</span>{r.answer}</p> : <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Waiting for the supplier's answer.</p>}
                </li>
              ))}
              {!b.requests.length && <li className="px-5 py-6 text-center text-sm text-muted-foreground">Nothing asked yet.</li>}
            </ul>
            {!withdrawn && (
              <form onSubmit={ask} className="p-5 border-t border-border space-y-3">
                <Textarea rows={3} required value={question} onChange={e => setQuestion(e.target.value)} placeholder="What do you need from the supplier? e.g. Please upload the latest moisture analysis for this lot." />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={askNotify} onChange={e => setAskNotify(e.target.checked)} />Email the supplier; they answer in their dashboard</label>
                  <Button type="submit" variant="outline" className="h-9" disabled={busy || question.trim().length < 5}>Ask the supplier</Button>
                </div>
              </form>
            )}
          </Card>

          {(b.revisions?.length > 0 || b.history?.length > 0) && (
            <Card className="animate-fade-up" style={{ animationDelay: '110ms' }}>
              <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold flex items-center gap-2"><History className="w-4 h-4 text-accent" />Audit trail of this bid</h2></div>
              <ul className="divide-y divide-border">
                {[...(b.revisions || [])].reverse().map(r => (
                  <li key={r.id} className="px-5 py-4 text-sm space-y-2">
                    <p><span className="font-semibold">Unlocked</span> by {r.unlocked_by_name || 'staff'} <span className="text-muted-foreground">· {fmtMoment(r.unlocked_at)}</span></p>
                    <p className="rounded-xl bg-muted/60 px-3 py-2"><span className="text-xs text-muted-foreground block">Reason</span>{r.reason}</p>
                    {r.resubmitted_at ? (<>
                      <p><span className="font-semibold">Resubmitted</span> by {b.company_name} <span className="text-muted-foreground">· {fmtMoment(r.resubmitted_at)}</span></p>
                      {r.changes?.length ? <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="py-1 font-medium">What changed</th><th className="py-1 font-medium">Previous bid</th><th className="py-1 font-medium">New bid</th></tr></thead><tbody>{r.changes.map(c => <tr key={c.field} className="border-t border-border"><td className="py-1.5 capitalize">{c.field.replace(/_/g, ' ')}</td><td className="py-1.5 tabular-nums line-through text-muted-foreground">{String(c.from ?? '—')}</td><td className="py-1.5 tabular-nums font-medium">{String(c.to ?? '—')}</td></tr>)}</tbody></table> : <p className="text-xs text-muted-foreground">Resubmitted without changes.</p>}
                    </>) : <p className="text-xs text-amber-600 dark:text-amber-400">Waiting for the supplier to resubmit. Previous bid: {qty(r.before?.quantity, b.unit)} at {perUnit(r.before?.price, b.currency, b.unit)}.</p>}
                  </li>
                ))}
                {b.history?.map(hh => (
                  <li key={`h${hh.id}`} className="px-5 py-3 text-sm flex flex-wrap items-center gap-3">
                    <Link to={`/staff360/bids/${hh.id}`} className="font-semibold text-accent">Bid #{hh.id}</Link>
                    <span className="text-muted-foreground flex-1">{hh.created_at > b.created_at ? 'later' : 'earlier'} submission · {qty(hh.quantity, hh.unit)} at {perUnit(hh.price, hh.currency, hh.unit)} · {fmtMoment(hh.created_at)}{hh.withdrawn_at ? ` · withdrawn ${fmtMoment(hh.withdrawn_at)}` : ''}</span>
                    <Badge tone={bidTone(hh.status)}>{BID_LABELS[hh.status]}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="animate-fade-up" style={{ animationDelay: '140ms' }}>
            <h2 className="font-semibold mb-3">Documents</h2>
            <DocumentsPanel scope={{ bid_id: b.id }} note="uploaded by the supplier or by your team; the supplier sees them in their dashboard" />
          </div>
        </div>

        <div className="space-y-5 lg:sticky lg:top-24">
          <Card className="p-5 space-y-2 animate-fade-up" style={{ animationDelay: '100ms' }}>
            {!withdrawn && <Button variant="accent" className="w-full" onClick={() => setDialog({ bid: b })}>Change status</Button>}
            {!withdrawn && b.status !== 'shortlisted' && b.status !== 'awarded' && <Button variant="outline" className="w-full" onClick={() => setDialog({ bid: b, to: 'shortlisted' })}>Shortlist</Button>}
            {!withdrawn && can('bidding', 'award') && <Button variant="outline" className="w-full" onClick={() => setDialog({ bid: b, to: 'awarded' })}>{b.status === 'awarded' ? 'Change the award' : 'Award'}</Button>}
            {!withdrawn && b.status !== 'awarded' && can('bidding', 'unlock') && (b.unlocked_at
              ? <Button variant="outline" className="w-full" disabled={busy} onClick={relock}><Lock className="w-4 h-4" />Lock again</Button>
              : <Button variant="outline" className="w-full" onClick={() => setUnlocking(true)}><LockOpen className="w-4 h-4" />Unlock bid</Button>)}
            {!withdrawn && b.status !== 'not_selected' && <Button variant="ghost" className="w-full text-destructive" onClick={() => setDialog({ bid: b, to: 'not_selected' })}>Not selected</Button>}
            <Button variant="outline" className="w-full" onClick={() => setCompose(true)}><Mail className="w-4 h-4" />Email the supplier</Button>
          </Card>

          {b.status === 'awarded' && (
            <Card className="p-5 animate-fade-up" style={{ animationDelay: '130ms' }}>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileSignature className="w-4 h-4 text-accent" />Supply contract</h2>
              {b.orders.map(o => <Link key={o.id} to={`/staff360/purchase-orders/${o.id}`} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted/40 mb-2"><span className="font-semibold">{o.number}</span><span className="flex-1 text-right tabular-nums text-muted-foreground">{money(o.total, o.currency)}</span><Badge tone={poTone(o.status)}>{o.status}</Badge></Link>)}
              <div className="flex gap-2">
                <Select className="h-10" value={kind} onChange={e => setKind(e.target.value)} aria-label="Order type">{Object.entries(PO_KINDS).map(([k, l]) => <option key={k} value={k}>{PO_SHORT[k]} — {l}</option>)}</Select>
                <Button variant="primary" className="shrink-0" disabled={busy} onClick={raise}>Raise</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Starts from this bid: the supplier, {qty(b.quantity, b.unit)} at {perUnit(b.price, b.currency, b.unit)}, and the opportunity's delivery and payment terms. You can edit it before it is issued.</p>
            </Card>
          )}

          <Card className="p-5 animate-fade-up text-sm" style={{ animationDelay: '160ms' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Supplier</h2>
            <p className="font-semibold">{b.supplier ? <Link to={`/staff360/suppliers/${b.supplier.id}`} className="text-accent">{b.company_name}</Link> : b.company_name}</p>
            <dl className="mt-2 space-y-1.5">
              <div><dt className="sr-only">Contact</dt><dd>{b.contact_person}</dd></div>
              <div><dt className="sr-only">Email</dt><dd className="break-all"><a href={`mailto:${b.email}`} className="hover:text-accent">{b.email}</a></dd></div>
              <div><dt className="sr-only">Phone</dt><dd><a href={`tel:${b.phone}`} className="hover:text-accent">{b.phone}</a></dd></div>
              <div><dt className="sr-only">Address</dt><dd className="text-muted-foreground whitespace-pre-line">{b.address}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{b.supplier?.has_account ? 'Has a supplier account and follows this bid in their dashboard.' : 'No supplier account yet. They are invited to open one in every email.'}</p>
          </Card>

          <Card className="p-5 animate-fade-up" style={{ animationDelay: '190ms' }}>
            <Field label="Internal notes" hint="Only your team sees these."><Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
            <Button variant="outline" className="mt-3 h-9 w-full" disabled={busy || notes === (b.internal_notes || '')} onClick={saveNotes}>Save notes</Button>
          </Card>

          <Card className="animate-fade-up" style={{ animationDelay: '220ms' }}>
            <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Emails about this bid</h2></div>
            <ul className="divide-y divide-border">
              {b.messages?.map(m => (
                <li key={m.id}><Link to={`/staff360/procurement/messages/${m.id}`} className="px-5 py-3 text-xs flex items-center gap-2 hover:bg-muted/40">
                  <span className="truncate flex-1"><span className="font-medium">{m.subject}</span><span className="block text-muted-foreground">{m.direction === 'in' ? 'from the supplier' : 'to the supplier'} · {fmtDateTime(m.created_at)}</span></span>
                  <Badge tone={messageTone(m.status)}>{m.status}</Badge>
                </Link></li>
              ))}
              {!b.messages?.length && <li className="px-5 py-6 text-center text-xs text-muted-foreground">None yet.</li>}
            </ul>
            <div className="px-5 py-3 border-t border-border"><Button type="button" variant="ghost" className="h-8 px-2 text-xs text-destructive" onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete bid</Button></div>
          </Card>
        </div>
      </div>

      <BidStatusDialog bid={dialog?.bid || null} to={dialog?.to || null} award={b.award || null} onClose={() => setDialog(null)} onSaved={r => { take(r); load(); toast(`${BID_LABELS[r.status]}${r.notified ? ' — the supplier has been emailed' : ''}`) }} />
      <Composer open={compose} onClose={() => setCompose(false)} title={`Email ${b.company_name}`} to={b.email} scope="procurement" supplierId={b.supplier?.id ?? null} bidId={b.id}
        subject={t ? `Your bid for ${t.title} (${t.number})` : ''} template={{ key: 'supplier_blank', bid_id: b.id }} onSent={() => { toast('Email sent'); load() }} />
      <Modal open={unlocking} onClose={() => setUnlocking(false)} title="Unlock this bid"
        footer={<><Button type="button" variant="outline" onClick={() => setUnlocking(false)}>Cancel</Button><Button type="submit" form="bid-unlock" variant="accent" disabled={busy || reason.trim().length < 5}><LockOpen className="w-4 h-4" />{busy ? 'Unlocking…' : 'Confirm and unlock'}</Button></>}>
        <form id="bid-unlock" onSubmit={unlock} className="space-y-4">
          <p className="text-sm text-muted-foreground"><b className="text-foreground">{b.company_name}</b> will be able to change this bid and resubmit it once, even though the deadline has passed. They are told by email and in their dashboard. The previous figures, the new ones, your name, the reason and both times are kept in the audit trail.</p>
          <Field label="Reason for unlocking *" hint="The supplier reads this."><Textarea rows={3} required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. The price was entered per bag instead of per tonne." /></Field>
        </form>
      </Modal>
      {toastEl}
    </>
  )
}
