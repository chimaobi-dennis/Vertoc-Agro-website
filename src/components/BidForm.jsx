/*
 * Submit a bid on an open opportunity. Works with or without a supplier
 * account: signed in, the company details come from the account and the
 * bid lands in the dashboard; otherwise the form asks for them (and the
 * captcha), and the supplier can open an account with the same email
 * afterwards to follow the bid. Documents are uploaded after the bid is
 * accepted, straight to storage.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, FileText, Loader2, Paperclip, RotateCw, Trash2, XCircle } from 'lucide-react'
import Turnstile from './Turnstile'
import { supplierFetch, uploadBidFile, useSupplier } from '../lib/supplier'
import { BID_DECLARATION, FILE_ACCEPT, FILE_LABELS, FILE_MAX_BYTES, fileSize, fmtDay, money, perUnit, qty } from '../lib/procurement'

const input = 'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60'
const Label = ({ children, hint }) => <span className="block text-sm font-semibold text-foreground mb-1.5">{children}{hint && <span className="font-normal text-muted-foreground"> {hint}</span>}</span>
const today = () => new Date().toISOString().slice(0, 10)

export default function BidForm({ tender }) {
  const { me, ready } = useSupplier()
  const [f, setF] = useState({ company_name: '', contact_person: '', phone: '', email: '', address: '', commodity: tender.commodity, quantity: '', price: '', commodity_location: '', delivery_date: '', accepts_terms: '', terms_note: '', note: '', confirmed: false, website: '' })
  const [files, setFiles] = useState([])          // [{ key, file, label, state: 'waiting'|'uploading'|'done'|'failed', error }]
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(null)          // { id, upload_token }
  const pickers = useRef({})
  const top = useRef(null)
  const [existing, setExisting] = useState(null)   // the signed-in supplier's bid on this opportunity, if they made one

  useEffect(() => {
    if (!me) { setExisting(null); return }
    supplierFetch('/supplier/bids').then(l => setExisting(l.find(b => b.tender?.number === tender.number && b.status !== 'withdrawn') || null)).catch(() => {})
  }, [me, tender.number])
  // A signed-in supplier bids under their account: the details come from it.
  useEffect(() => { if (me) setF(x => ({ ...x, company_name: me.company_name || x.company_name, contact_person: me.contact_person || x.contact_person, phone: me.phone || x.phone, email: me.email, address: me.address || x.address })) }, [me])

  const set = k => e => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const total = useMemo(() => { const n = (Number(f.quantity) || 0) * (Number(f.price) || 0); return n > 0 ? n : null }, [f.quantity, f.price])
  const versus = tender.asking_price != null && Number(f.price) > 0 ? Number(f.price) - tender.asking_price : null
  const unit = tender.unit

  const addFiles = (label, list) => {
    const next = []
    for (const file of list) {
      if (files.length + next.length >= 10) { setErr('A bid can carry up to 10 documents.'); break }
      if (file.size > FILE_MAX_BYTES) { setErr(`${file.name} is over 20 MB.`); continue }
      next.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, label, state: 'waiting' })
    }
    if (next.length) setFiles(x => [...x, ...next])
  }
  const mark = (key, patch) => setFiles(x => x.map(i => (i.key === key ? { ...i, ...patch } : i)))
  const send = async (item, bid) => {
    mark(item.key, { state: 'uploading', error: null })
    try { await uploadBidFile(item.file, { bidId: bid.id, label: item.label, uploadToken: bid.upload_token || null }); mark(item.key, { state: 'done' }) }
    catch (e) { mark(item.key, { state: 'failed', error: e.message }) }
  }

  const submit = async e => {
    e.preventDefault(); setErr(null)
    if (f.accepts_terms === '') return setErr('Please say whether you accept the stated payment terms.')
    if (!f.confirmed) return setErr('Please tick the confirmation to submit your bid.')
    setBusy(true)
    try {
      const { website, ...body } = f
      const r = await supplierFetch(`/tenders/${tender.number}/bids`, { method: 'POST', body: { ...body, accepts_terms: f.accepts_terms === 'yes', captchaToken: token, ...(me ? {} : { website }) } })
      if (!r.id) throw new Error('Your bid could not be submitted. Please try again.')
      setDone(r)
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      for (const item of files) await send(item, r)   // one after the other: each is recorded as it lands
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  if (done) {
    const pending = files.filter(i => i.state === 'waiting' || i.state === 'uploading').length
    const failed = files.filter(i => i.state === 'failed')
    return (
      <div ref={top} className="rounded-2xl border border-accent/30 bg-accent/10 p-6 md:p-8 scroll-mt-32">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-accent shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="font-semibold text-lg text-foreground">Your bid has been submitted</h3>
            <p className="text-sm text-muted-foreground mt-1">Bid #{done.id} on {tender.number}: {qty(f.quantity, unit)} at {perUnit(f.price, tender.currency, unit)}. We have emailed a confirmation to <b className="text-foreground break-all">{f.email}</b>, and we will email you whenever the status of your bid changes.</p>
          </div>
        </div>
        {files.length > 0 && (
          <ul className="mt-5 space-y-2">
            {files.map(i => (
              <li key={i.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
                {i.state === 'done' ? <CheckCircle2 className="w-4 h-4 text-accent shrink-0" /> : i.state === 'failed' ? <XCircle className="w-4 h-4 text-destructive shrink-0" /> : <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />}
                <span className="truncate flex-1 min-w-0">{i.file.name}<span className="block text-xs text-muted-foreground">{i.state === 'failed' ? i.error : i.state === 'done' ? `${i.label} · attached` : i.state === 'uploading' ? 'Uploading…' : 'Waiting…'}</span></span>
                {i.state === 'failed' && <button type="button" onClick={() => send(i, done)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent"><RotateCw className="w-3.5 h-3.5" />Try again</button>}
              </li>
            ))}
          </ul>
        )}
        {pending > 0 && <p className="mt-3 text-xs text-muted-foreground">Please keep this page open until your documents have finished uploading.</p>}
        {failed.length > 0 && !pending && <p className="mt-3 text-xs text-muted-foreground">Your bid is in. Documents that did not upload can be added again here, or later from your supplier dashboard.</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          {me
            ? <Link to={`/supplier/bids/${done.id}`} className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Open my bid</Link>
            : <>
              <Link to={`/supplier/register?email=${encodeURIComponent(f.email)}&company=${encodeURIComponent(f.company_name)}&contact=${encodeURIComponent(f.contact_person)}&phone=${encodeURIComponent(f.phone)}`} className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Create an account to follow this bid</Link>
              <Link to="/supplier/login" className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-border bg-card text-sm font-semibold hover:bg-muted">I already have an account</Link>
            </>}
          <Link to="/bidding" className="inline-flex items-center justify-center h-11 px-6 rounded-full text-sm font-semibold text-muted-foreground hover:text-foreground">Other opportunities</Link>
        </div>
        {!me && <p className="mt-3 text-xs text-muted-foreground">Register with the same email address and this bid will be waiting in your dashboard.</p>}
      </div>
    )
  }

  if (existing) return (
    <div className="rounded-2xl border border-border bg-secondary/50 p-6 md:p-8">
      <h3 className="font-semibold text-lg text-foreground">You have already bid on this opportunity</h3>
      <p className="text-sm text-muted-foreground mt-1">{qty(existing.quantity, existing.unit)} at {perUnit(existing.price, existing.currency, existing.unit)}, submitted {fmtDay(existing.created_at)}. To change it, withdraw that bid and submit a new one while bids are open.</p>
      <Link to={`/supplier/bids/${existing.id}`} className="mt-5 inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Open my bid</Link>
    </div>
  )

  return (
    <form ref={top} onSubmit={submit} className="space-y-8 scroll-mt-32">
      {me ? (
        <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm">Bidding as <b>{me.company_name}</b> <span className="text-muted-foreground break-all">({me.email})</span>. <Link to="/supplier/profile" className="font-semibold text-accent">Update your details</Link></div>
      ) : ready && (
        <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm">Already registered? <Link to={`/supplier/login?next=${encodeURIComponent(`/bidding/${tender.number}#bid`)}`} className="font-semibold text-accent">Sign in</Link> and your company details are filled in for you. No account is needed to bid.</div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Your company</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block"><Label>Supplier / company name *</Label><input required maxLength={200} className={input} value={f.company_name} onChange={set('company_name')} autoComplete="organization" /></label>
          <label className="block"><Label>Contact person *</Label><input required maxLength={120} className={input} value={f.contact_person} onChange={set('contact_person')} autoComplete="name" /></label>
          <label className="block"><Label>Phone number *</Label><input required type="tel" maxLength={60} className={input} value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
          <label className="block"><Label>Email address *</Label><input required type="email" maxLength={200} className={input} value={f.email} onChange={set('email')} disabled={Boolean(me)} autoComplete="email" /></label>
        </div>
        <label className="block"><Label>Company address *</Label><textarea required rows={2} maxLength={500} className={input} value={f.address} onChange={set('address')} autoComplete="street-address" /></label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Your offer</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block"><Label>Commodity you are bidding for *</Label><input required maxLength={120} className={input} value={f.commodity} onChange={set('commodity')} /></label>
          <label className="block"><Label hint={`(we need ${qty(tender.quantity, unit)})`}>Quantity you can supply, in {unit} *</Label><input required type="number" min="0.001" step="0.001" inputMode="decimal" className={input} value={f.quantity} onChange={set('quantity')} /></label>
          <label className="block">
            <Label hint={tender.asking_price != null ? `(our asking price: ${perUnit(tender.asking_price, tender.currency, unit)})` : ''}>Your proposed price per {unit}, in {tender.currency} *</Label>
            <input required type="number" min="0.01" step="0.01" inputMode="decimal" className={input} value={f.price} onChange={set('price')} />
            {versus != null && <span className={`block text-xs mt-1.5 ${versus > 0 ? 'text-muted-foreground' : 'text-accent'}`}>{versus === 0 ? 'The same as our asking price.' : `${money(Math.abs(versus), tender.currency)} ${versus < 0 ? 'below' : 'above'} our asking price.`}</span>}
          </label>
          <div><Label>Total bid value</Label><output className={`${input} block bg-secondary/60 font-semibold tabular-nums`} aria-live="polite">{total ? money(total, tender.currency) : '—'}</output><span className="block text-xs text-muted-foreground mt-1.5">Quantity × price, worked out for you.</span></div>
          <label className="block"><Label>Location of the commodity *</Label><input required maxLength={200} className={input} value={f.commodity_location} onChange={set('commodity_location')} placeholder="Town and state" /></label>
          <label className="block"><Label hint={tender.delivery_by ? `(we need it by ${fmtDay(tender.delivery_by)})` : ''}>Expected delivery date *</Label><input required type="date" min={today()} className={input} value={f.delivery_date} onChange={set('delivery_date')} /></label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Payment terms</legend>
        <p className="text-sm rounded-xl border border-border bg-secondary/50 px-4 py-3 whitespace-pre-line">{tender.payment_terms || 'As agreed with our procurement team.'}</p>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Do you accept the stated payment terms?">
          {[['yes', 'I accept these payment terms'], ['no', 'I do not accept these payment terms']].map(([v, l]) => (
            <label key={v} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium cursor-pointer ${f.accepts_terms === v ? 'border-accent bg-accent/10' : 'border-border bg-card hover:bg-muted/50'}`}>
              <input type="radio" name="accepts_terms" value={v} checked={f.accepts_terms === v} onChange={set('accepts_terms')} required />{l}
            </label>
          ))}
        </div>
        {f.accepts_terms === 'no' && <label className="block"><Label hint="(optional)">Which terms do you propose?</Label><textarea rows={2} maxLength={1000} className={input} value={f.terms_note} onChange={set('terms_note')} placeholder="e.g. 50% advance, balance on delivery" /></label>}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Supporting documents</legend>
        <p className="text-sm text-muted-foreground">Attach what supports your bid. PDF, Word, Excel or images, up to 20 MB each and 10 files in all. You can add more later from your supplier dashboard.</p>
        <ul className="rounded-2xl border border-border divide-y divide-border bg-card">
          {FILE_LABELS.map(label => { const mine = files.filter(i => i.label === label); return (
            <li key={label} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />{label}</span>
                <input ref={el => { pickers.current[label] = el }} type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={e => { addFiles(label, [...e.target.files]); e.target.value = '' }} aria-label={`Add ${label}`} />
                <button type="button" onClick={() => pickers.current[label]?.click()} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border text-xs font-semibold hover:bg-muted"><Paperclip className="w-3.5 h-3.5" />{mine.length ? 'Add another' : 'Choose file'}</button>
              </div>
              {mine.length > 0 && <ul className="mt-2 space-y-1.5">{mine.map(i => (
                <li key={i.key} className="flex items-center gap-2 text-xs rounded-lg bg-secondary/60 px-3 py-1.5"><span className="truncate flex-1">{i.file.name}</span><span className="text-muted-foreground">{fileSize(i.file.size)}</span><button type="button" onClick={() => setFiles(x => x.filter(y => y.key !== i.key))} className="p-1 text-destructive" aria-label={`Remove ${i.file.name}`}><Trash2 className="w-3.5 h-3.5" /></button></li>
              ))}</ul>}
            </li>
          ) })}
        </ul>
      </fieldset>

      <label className="block"><Label hint="(optional)">Anything else we should know?</Label><textarea rows={3} maxLength={3000} className={input} value={f.note} onChange={set('note')} /></label>

      <div className="rounded-2xl border border-border bg-secondary/40 p-5 space-y-4">
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1 shrink-0" checked={f.confirmed} onChange={set('confirmed')} required />
          <span className="leading-relaxed">{BID_DECLARATION}</span>
        </label>
        {!me && <>
          {/* Honeypot: hidden from people, irresistible to bots. */}
          <div className="hidden" aria-hidden="true"><label htmlFor="website-bid">Leave this field blank</label><input id="website-bid" type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></div>
          <Turnstile onVerify={setToken} />
        </>}
        {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Bids close {fmtDay(tender.closes_at)}.</p>
          <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Submitting…' : 'Submit bid'}</button>
        </div>
      </div>
    </form>
  )
}
