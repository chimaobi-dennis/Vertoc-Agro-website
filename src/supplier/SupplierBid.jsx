/* One of the supplier's own bids: where it stands, what was offered, our
   requests for information (answered here), its documents, and the order. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Download, FileSignature, FileText, Loader2, LockOpen, MessageCircleQuestion, Paperclip, Trash2, Truck, XCircle } from 'lucide-react'
import { openFile } from '../lib/openFile'
import { supplierFetch, uploadBidFile } from '../lib/supplier'
import { Bone } from '../components/Skeleton'
import { BID_EXPLAINED, BID_LABELS, FILE_ACCEPT, FILE_LABELS, PO_KINDS, fileSize, fmtDay, fmtMoment, money, perUnit, qty } from '../lib/procurement'
import { BidProgress, Notice, Pill, Problem, accent, input, outline } from './ui'

const Card = ({ className = '', ...p }) => <div {...p} className={`bg-card border border-border rounded-2xl ${className}`} />

export default function SupplierBid() {
  const { id } = useParams()
  const [b, setB] = useState(null)
  const [err, setErr] = useState(null)
  const [note, setNote] = useState(null)
  const [answers, setAnswers] = useState({})
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState(FILE_LABELS[0])
  const [queue, setQueue] = useState([])      // [{ name, error? }]
  const picker = useRef(null)
  const [edit, setEdit] = useState(null)      // the figures being changed while the bid is unlocked

  const load = useCallback(() => supplierFetch(`/supplier/bids/${id}`).then(x => { setB(x); setErr(null) }).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])
  const run = async (fn, ok) => { setBusy(true); setErr(null); setNote(null); try { const r = await fn(); if (r?.id) setB(x => ({ ...x, ...r })); if (ok) setNote(ok) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const answer = r => run(async () => { const x = await supplierFetch(`/supplier/bids/${id}/requests/${r.id}/answer`, { method: 'POST', body: { answer: answers[r.id] || '' } }); setAnswers(a => ({ ...a, [r.id]: '' })); return x }, 'Thank you — your answer has been sent to our procurement team.')
  const withdraw = () => { if (window.confirm('Withdraw this bid?\n\nIt will no longer be considered. The withdrawal is recorded with its date and time, and you can submit a new bid while the opportunity is still open.')) run(() => supplierFetch(`/supplier/bids/${id}/withdraw`, { method: 'POST' }), 'Your bid has been withdrawn. You can submit a new bid while the opportunity is open.') }
  const startEdit = () => setEdit({ quantity: b.quantity, price: b.price, commodity_location: b.commodity_location, delivery_date: b.delivery_date || '', accepts_terms: b.accepts_terms ? 'yes' : 'no', terms_note: b.terms_note || '', note: b.note || '' })
  const resubmit = e => { e.preventDefault(); if (!window.confirm('Resubmit your bid with these figures? It will be locked again afterwards.')) return; run(async () => { const r = await supplierFetch(`/supplier/bids/${id}/revise`, { method: 'POST', body: { ...edit, accepts_terms: edit.accepts_terms === 'yes' } }); setEdit(null); await load(); return r }, 'Your updated bid has been submitted. Our procurement team has been told.') }
  const add = async list => {
    for (const file of list) {
      setQueue(q => [...q, { name: file.name }])
      try { await uploadBidFile(file, { bidId: id, label }); setQueue(q => q.filter(x => x.name !== file.name)); await load() }
      catch (e) { setQueue(q => q.map(x => (x.name === file.name ? { ...x, error: e.message } : x))) }
    }
  }
  const openFile = async (d, download = false) => { try { await openFile(() => supplierFetch(`/supplier/bids/${id}/files/${d.id}/url`).then(r => ({ url: r.url, name: d.name })), { download }) } catch (e) { setErr(e.message) } }
  const removeFile = d => { if (window.confirm(`Remove "${d.name}" from this bid?`)) run(async () => { await supplierFetch(`/supplier/bids/${id}/files/${d.id}`, { method: 'DELETE' }); await load() }) }

  if (err && !b) return <><Link to="/supplier?tab=bids" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" />My bids</Link><Problem>{err}</Problem></>
  if (!b) return <div className="space-y-4" role="status" aria-label="Loading"><Bone className="h-8 w-72" /><Bone className="h-24 w-full rounded-2xl" /><Bone className="h-64 w-full rounded-2xl" /></div>

  const t = b.tender
  const waiting = b.requests.filter(r => !r.answered_at)
  return (
    <>
      <Link to="/supplier?tab=bids" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" />My bids</Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t?.number} · bid #{b.id} · submitted {fmtMoment(b.created_at)}</p>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground mt-1">{t?.title || 'Your bid'}</h1>
        </div>
        <Pill status={b.status} className="text-xs px-3 py-1.5">{BID_LABELS[b.status]}</Pill>
      </div>
      <div className="space-y-3 mb-6"><Problem>{err}</Problem><Notice>{note}</Notice></div>

      <Card className="p-6 mb-6">
        <BidProgress status={b.status} />
        <p className="mt-4 text-sm text-foreground">{BID_EXPLAINED[b.status]}{b.status_changed_at && <span className="text-muted-foreground"> · updated {fmtMoment(b.status_changed_at)}</span>}</p>
        {b.status_note && <p className="mt-3 rounded-xl bg-secondary/60 border border-border px-4 py-3 text-sm"><span className="block text-xs text-muted-foreground mb-0.5">A note from our procurement team</span>{b.status_note}</p>}
        {b.status === 'withdrawn' && <p className="mt-3 text-sm text-muted-foreground">Withdrawn on {fmtMoment(b.withdrawn_at || b.status_changed_at)}.{t?.state === 'open' && <> Bidding is still open: <Link to={`/bidding/${t.number}#bid`} className="font-semibold text-accent">submit a new bid</Link>.</>}</p>}
        {b.status === 'awarded' && <p className="mt-3 rounded-xl bg-accent/10 border border-accent/30 px-4 py-3 text-sm">You have been awarded <b>{qty(b.awarded_quantity ?? b.quantity, b.unit)}</b> at <b>{perUnit(b.awarded_price ?? b.price, b.currency, b.unit)}</b>{b.awarded_quantity != null && b.awarded_quantity < b.quantity ? ' (part of the quantity you offered)' : ''}. Our purchase order follows.</p>}
        {b.revision > 0 && <p className="mt-3 text-xs text-muted-foreground">You resubmitted this bid on {fmtMoment(b.revised_at)}.</p>}
      </Card>

      {b.can_edit && (
        <Card className="p-6 mb-6 border-amber-300 dark:border-amber-500/40">
          <h2 className="font-semibold flex items-center gap-2"><LockOpen className="w-4 h-4 text-amber-600" />Your bid has been reopened for changes</h2>
          <p className="text-sm text-muted-foreground mt-1">Our team unlocked this bid on {fmtMoment(b.unlocked_at)} so that you can correct it and submit it again, once.</p>
          {b.unlock_reason && <p className="mt-3 rounded-xl bg-secondary/60 border border-border px-4 py-3 text-sm"><span className="block text-xs text-muted-foreground mb-0.5">Reason</span>{b.unlock_reason}</p>}
          {!edit ? <button type="button" onClick={startEdit} className={`${accent} mt-4`}>Edit and resubmit my bid</button> : (
            <form onSubmit={resubmit} className="mt-4 grid sm:grid-cols-2 gap-4">
              <label className="block"><span className="block text-sm font-semibold mb-1.5">Quantity you can supply ({b.unit}) *</span><input required type="number" min="0.001" step="0.001" className={input} value={edit.quantity} onChange={e => setEdit({ ...edit, quantity: e.target.value })} /></label>
              <label className="block"><span className="block text-sm font-semibold mb-1.5">Price per {b.unit} ({b.currency}) *</span><input required type="number" min="0.01" step="0.01" className={input} value={edit.price} onChange={e => setEdit({ ...edit, price: e.target.value })} /><span className="block text-xs text-muted-foreground mt-1.5">Total: {Number(edit.quantity) > 0 && Number(edit.price) > 0 ? money(Number(edit.quantity) * Number(edit.price), b.currency) : '—'}</span></label>
              <label className="block"><span className="block text-sm font-semibold mb-1.5">Location of the commodity *</span><input required className={input} value={edit.commodity_location} onChange={e => setEdit({ ...edit, commodity_location: e.target.value })} /></label>
              <label className="block"><span className="block text-sm font-semibold mb-1.5">Expected delivery date *</span><input required type="date" className={input} value={edit.delivery_date} onChange={e => setEdit({ ...edit, delivery_date: e.target.value })} /></label>
              <label className="block"><span className="block text-sm font-semibold mb-1.5">Do you accept the payment terms?</span><select className={input} value={edit.accepts_terms} onChange={e => setEdit({ ...edit, accepts_terms: e.target.value })}><option value="yes">Yes</option><option value="no">No</option></select></label>
              {edit.accepts_terms === 'no' && <label className="block"><span className="block text-sm font-semibold mb-1.5">Which terms do you propose?</span><input className={input} value={edit.terms_note} onChange={e => setEdit({ ...edit, terms_note: e.target.value })} /></label>}
              <label className="block sm:col-span-2"><span className="block text-sm font-semibold mb-1.5">Note</span><textarea rows={3} maxLength={3000} className={input} value={edit.note} onChange={e => setEdit({ ...edit, note: e.target.value })} /></label>
              <div className="sm:col-span-2 flex flex-wrap gap-3"><button type="submit" disabled={busy} className={accent}>{busy ? 'Submitting…' : 'Resubmit bid'}</button><button type="button" onClick={() => setEdit(null)} className={outline}>Cancel</button></div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">Your previous figures stay on record together with the new ones.</p>
            </form>
          )}
        </Card>
      )}

      {b.orders?.length > 0 && (
        <Card className="p-6 mb-6 border-accent/40">
          <h2 className="font-semibold flex items-center gap-2 mb-3"><FileSignature className="w-4 h-4 text-accent" />Purchase order</h2>
          <ul className="space-y-2">{b.orders.map(o => (
            <li key={o.number} className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">{o.number}</span><span className="text-muted-foreground">{PO_KINDS[o.kind]}</span><span className="tabular-nums">{money(o.total, o.currency)}</span><Pill status={o.status}>{o.status === 'issued' ? 'To acknowledge' : o.status}</Pill>{['issued', 'acknowledged', 'fulfilled'].includes(o.status) && <Link to={`/supplier/orders/${o.number}`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent"><Truck className="w-4 h-4" />Shipments</Link>}<Link to={`/po/${o.token}`} className={`${o.status === 'issued' ? accent : outline} h-9 px-4 ml-auto`}>{o.status === 'issued' ? 'View and acknowledge' : 'View'}</Link></li>
          ))}</ul>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3"><h2 className="font-semibold flex items-center gap-2"><MessageCircleQuestion className="w-4 h-4 text-accent" />Requests for information</h2>{waiting.length > 0 && <Pill status="open">{waiting.length} to answer</Pill>}</div>
            <ul className="divide-y divide-border">
              {b.requests.map(r => (
                <li key={r.id} className="px-6 py-5 text-sm">
                  <p className="whitespace-pre-wrap"><span className="block text-xs text-muted-foreground mb-0.5">We asked · {fmtMoment(r.asked_at)}</span>{r.question}</p>
                  {r.answered_at ? <p className="mt-3 rounded-xl bg-secondary/60 px-4 py-3 whitespace-pre-wrap"><span className="block text-xs text-muted-foreground mb-0.5">You answered · {fmtMoment(r.answered_at)}</span>{r.answer}</p> : (
                    <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); answer(r) }}>
                      <textarea required rows={3} maxLength={5000} className={input} value={answers[r.id] || ''} onChange={e => setAnswers(a => ({ ...a, [r.id]: e.target.value }))} placeholder="Write your answer. If we asked for a document, upload it below first, then answer here." />
                      <button type="submit" disabled={busy || !(answers[r.id] || '').trim()} className={`${accent} h-10`}>Send answer</button>
                    </form>
                  )}
                </li>
              ))}
              {!b.requests.length && <li className="px-6 py-8 text-center text-sm text-muted-foreground">We have not asked for anything. If we need more information it will appear here, and we will email you.</li>}
            </ul>
          </Card>

          <Card>
            <div className="px-6 py-4 border-b border-border"><h2 className="font-semibold flex items-center gap-2"><Paperclip className="w-4 h-4 text-accent" />Documents</h2></div>
            <ul className="divide-y divide-border">
              {b.documents.map(d => (
                <li key={d.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <button type="button" onClick={() => openFile(d)} className="flex-1 min-w-0 text-left hover:text-accent"><span className="font-medium truncate block">{d.name}</span><span className="block text-xs text-muted-foreground">{[d.label, d.mine ? '' : 'added by Vertoc Agro', fileSize(d.bytes), fmtDay(d.created_at)].filter(Boolean).join(' · ')}</span></button>
                  <button type="button" onClick={() => openFile(d, true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" aria-label={`Download ${d.name}`}><Download className="w-4 h-4" /></button>
                  {b.can_attach && d.mine && <button type="button" onClick={() => removeFile(d)} className="p-2 rounded-lg text-destructive hover:bg-muted" aria-label={`Remove ${d.name}`}><Trash2 className="w-4 h-4" /></button>}
                </li>
              ))}
              {queue.map(q => <li key={q.name} className="px-6 py-3 flex items-center gap-3 text-sm">{q.error ? <XCircle className="w-4 h-4 text-destructive shrink-0" /> : <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}<span className="flex-1 min-w-0 truncate">{q.name}<span className="block text-xs text-muted-foreground">{q.error || 'Uploading…'}</span></span>{q.error && <button type="button" className="text-xs font-semibold" onClick={() => setQueue(x => x.filter(y => y.name !== q.name))}>Dismiss</button>}</li>)}
              {!b.documents.length && !queue.length && <li className="px-6 py-8 text-center text-sm text-muted-foreground">No documents attached yet.</li>}
            </ul>
            {b.can_attach ? (
              <div className="px-6 py-4 border-t border-border flex flex-wrap items-center gap-3">
                <select className={`${input} h-11 py-0 max-w-xs`} value={label} onChange={e => setLabel(e.target.value)} aria-label="Kind of document">{FILE_LABELS.map(l => <option key={l}>{l}</option>)}</select>
                <input ref={picker} type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={e => { add([...e.target.files]); e.target.value = '' }} />
                <button type="button" onClick={() => picker.current?.click()} disabled={b.documents.length >= (b.max_files || 10)} className={`${outline} h-11`}><Paperclip className="w-4 h-4" />Add a document</button>
                <span className="text-xs text-muted-foreground">PDF, Word, Excel or images · up to 20 MB each</span>
              </div>
            ) : <p className="px-6 py-4 border-t border-border text-xs text-muted-foreground">This bid is {BID_LABELS[b.status].toLowerCase()}; its documents can no longer be changed.</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 text-sm">
            <h2 className="font-semibold mb-4">Your offer</h2>
            <dl className="space-y-3">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Commodity</dt><dd className="font-medium text-right">{b.commodity}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Quantity</dt><dd className="font-medium tabular-nums">{qty(b.quantity, b.unit)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Your price</dt><dd className="font-medium tabular-nums">{perUnit(b.price, b.currency, b.unit)}</dd></div>
              {t?.asking_price != null && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Our asking price</dt><dd className="tabular-nums text-muted-foreground">{perUnit(t.asking_price, t.currency, t.unit)}</dd></div>}
              <div className="flex justify-between gap-4 border-t border-border pt-3"><dt className="text-muted-foreground">Total bid value</dt><dd className="font-bold tabular-nums text-primary">{money(b.total, b.currency)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Location</dt><dd className="font-medium text-right">{b.commodity_location}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Expected delivery</dt><dd className="font-medium">{fmtDay(b.delivery_date)}</dd></div>
              <div><dt className="text-muted-foreground">Payment terms</dt><dd className="mt-1 flex items-start gap-1.5 font-medium">{b.accepts_terms ? <><CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />You accepted the stated terms</> : <><XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />You did not accept the stated terms</>}</dd>{b.terms_note && <dd className="text-xs text-muted-foreground mt-1">You proposed: {b.terms_note}</dd>}</div>
              {b.note && <div><dt className="text-muted-foreground">Your note</dt><dd className="mt-1 whitespace-pre-wrap">{b.note}</dd></div>}
            </dl>
          </Card>
          {t && <Card className="p-6 text-sm"><h2 className="font-semibold mb-2">The opportunity</h2><p className="text-muted-foreground">{qty(t.quantity, t.unit)} of {t.commodity}{t.delivery_location ? `, delivered to ${t.delivery_location}` : ''}. Bids {t.state === 'open' ? `close ${fmtDay(t.closes_at)}` : `closed ${fmtDay(t.closes_at)}`}.</p><Link to={`/bidding/${t.number}`} className="inline-block mt-3 font-semibold text-accent">View the opportunity →</Link></Card>}
          {b.can_withdraw && <button type="button" onClick={withdraw} disabled={busy} className="w-full text-sm font-semibold text-destructive hover:underline py-2">Withdraw this bid</button>}
        </div>
      </div>
    </>
  )
}
