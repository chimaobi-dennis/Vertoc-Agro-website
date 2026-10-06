/*
 * The client portal (/client/*), inside the public site's layout. Open
 * pages for signing in and registering; behind a client session: the
 * overview, invoices, shipment tracking, payments (with receipt upload),
 * notifications and the account.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { ArrowRight, Banknote, Bell, FileText, LayoutDashboard, Loader2, MapPin, Paperclip, Truck, Upload, UserRound } from 'lucide-react'
import { openFile } from '../lib/openFile'
import { clientPortal } from '../lib/portal'
import { Bone } from '../components/Skeleton'
import { PortalForgot, PortalLogin, PortalRegister, PortalReset, PortalVerify } from '../portal/AuthPages'
import { Card, Empty, Notifications, PasswordChange, PortalGate, PortalShell, Tag } from '../portal/Shared'
import { Label, Notice, Page, Problem, accent, input, outline } from '../supplier/ui'
import { useSort } from '../lib/sort'
import { FILE_ACCEPT, fileSize, fmtDay, fmtMoment, money } from '../lib/procurement'
import { MODE_LABELS, SHIPMENT_LABELS, ago, shipmentTone } from '../lib/shipments'

const { api, upload } = clientPortal
const CFG = {
  portal: clientPortal, base: '/client', eyebrow: 'Client portal', title: 'Client',
  loginText: 'See your invoices, follow your shipments and send us your payment receipts.',
  registerTitle: 'Open a client account',
  registerText: 'An account lets you see every invoice we send you, follow your shipments, upload payment receipts and keep your company details up to date. If we already work together, use the email address we have for you and your invoices will be waiting.',
  registerNote: 'You can add your company documents (registration certificate, tax identification) from your account after signing in.',
  blank: { company_name: '', contact_person: '', phone: '', address: '', country: '', registration_number: '', tax_id: '' },
  fields: [
    { key: 'company_name', label: 'Company name', required: true, wide: true, autoComplete: 'organization' },
    { key: 'contact_person', label: 'Contact person', required: true, autoComplete: 'name' },
    { key: 'phone', label: 'Phone number', required: true, type: 'tel', autoComplete: 'tel' },
    { key: 'address', label: 'Company address', required: true, wide: true, type: 'textarea', autoComplete: 'street-address' },
    { key: 'country', label: 'Country', autoComplete: 'country-name' },
    { key: 'registration_number', label: 'Business registration number', hint: 'e.g. your RC or company number.' },
    { key: 'tax_id', label: 'Tax identification number' },
  ],
}
const INVOICE = { sent: ['To answer', 'amber'], viewed: ['To answer', 'amber'], accepted: ['Accepted', 'green'], declined: ['Declined', 'muted'], expired: ['Expired', 'muted'] }
const PAYMENT = { submitted: ['Awaiting confirmation', 'amber'], confirmed: ['Confirmed', 'green'], rejected: ['Not confirmed', 'red'] }
const useLoad = path => { const [d, setD] = useState(null); const [err, setErr] = useState(null); const load = () => api(path).then(r => { setD(r); setErr(null) }).catch(e => setErr(e.message)); useEffect(() => { load() }, [path]); return [d, err, load] } // eslint-disable-line react-hooks/exhaustive-deps

function Shell() {
  const { me } = clientPortal.use()
  return <PortalShell cfg={CFG} name={me.name} tabs={[
    { to: '/client', label: 'Overview', icon: LayoutDashboard, end: true }, { to: '/client/invoices', label: 'Invoices', icon: FileText, badge: me.counts?.to_answer },
    { to: '/client/shipments', label: 'Shipments', icon: Truck }, { to: '/client/payments', label: 'Payments', icon: Banknote },
    { to: '/client/notifications', label: 'Notifications', icon: Bell, badge: me.counts?.unread }, { to: '/client/account', label: 'Account', icon: UserRound },
  ]} />
}

function Overview() {
  const { me, refresh } = clientPortal.use()
  const [sp] = useSearchParams()
  const [invoices] = useLoad('/client/invoices')
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Emails link to /client?tab=payments and the like.
  if (['invoices', 'shipments', 'payments', 'notifications', 'account'].includes(sp.get('tab'))) return <Navigate to={`/client/${sp.get('tab')}`} replace />
  const c = me.counts || {}
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[['Invoices', c.invoices ?? 0, '/client/invoices'], ['Waiting for your answer', c.to_answer ?? 0, '/client/invoices'], ['With a balance to pay', c.owing ?? 0, '/client/payments'], ['New notifications', c.unread ?? 0, '/client/notifications']].map(([label, n, to], i) => (
          <Link key={label} to={to} className={`text-left bg-card border rounded-2xl px-5 py-4 hover:shadow-card transition-shadow ${n > 0 && i > 0 ? 'border-accent/50' : 'border-border'}`}><p className="text-3xl font-bold tabular-nums text-foreground">{n}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p></Link>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div>
          <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Latest invoices</h2><Link to="/client/invoices" className="text-sm font-semibold text-accent inline-flex items-center gap-1">All invoices<ArrowRight className="w-3.5 h-3.5" /></Link></div>
          {!invoices ? <Bone className="h-40 w-full rounded-2xl" /> : !invoices.length ? <Empty icon={FileText} title="No invoices yet">When we send you an invoice it appears here. You can read it, download the PDF and accept it online.</Empty> : <InvoiceList rows={invoices.slice(0, 5)} />}
        </div>
        <Card className="p-6 text-sm">
          <h2 className="font-semibold mb-3">Your company</h2>
          <dl className="space-y-2">
            <div><dt className="text-xs text-muted-foreground">Contact</dt><dd className="font-medium">{me.contact_person || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="font-medium break-all">{me.email}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Phone</dt><dd className="font-medium">{me.phone || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Address</dt><dd className="font-medium whitespace-pre-line">{me.address || '—'}</dd></div>
          </dl>
          <Link to="/client/account" className={`${outline} h-10 mt-5 w-full`}>Manage account</Link>
        </Card>
      </div>
    </>
  )
}

function InvoiceList({ rows }) {
  return (
    <Card><ul className="divide-y divide-border">
      {rows.map(q => { const [label, tone] = INVOICE[q.status] || [q.status, 'muted']; return (
        <li key={q.number} className="px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="flex-1 min-w-[12rem]"><Link to={`/q/${q.token}`} className="font-semibold text-foreground hover:text-accent">{q.number}</Link><span className="block text-xs text-muted-foreground">{q.title || 'Invoice'} · sent {fmtDay(q.sent_at || q.created_at)}{q.valid_until && ['sent', 'viewed'].includes(q.status) ? ` · valid until ${fmtDay(q.valid_until)}` : ''}</span></span>
          <span className="tabular-nums text-right"><span className="font-semibold">{money(q.total, q.currency)}</span>{q.status === 'accepted' && <span className="block text-xs text-muted-foreground">{q.balance > 0 ? `${money(q.balance, q.currency)} to pay` : 'paid in full'}{q.pending > 0 ? ` · ${money(q.pending, q.currency)} awaiting confirmation` : ''}</span>}</span>
          <Tag tone={tone}>{label}</Tag>
          <span className="flex gap-2">
            <Link to={`/q/${q.token}`} className={`${['sent', 'viewed'].includes(q.status) ? accent : outline} h-9 px-4 text-xs`}>{['sent', 'viewed'].includes(q.status) ? 'View and answer' : 'View'}</Link>
            {q.status === 'accepted' && q.balance > 0 && <Link to={`/client/payments?invoice=${q.id}`} className={`${outline} h-9 px-4 text-xs`}><Upload className="w-3.5 h-3.5" />Send receipt</Link>}
          </span>
        </li>
      ) })}
    </ul></Card>
  )
}

function Invoices() {
  const [rows, err] = useLoad('/client/invoices')
  const [sorted, sortControl] = useSort(rows, { date: r => r.sent_at || r.created_at, name: 'number', more: [{ key: 'amount', label: 'Amount, highest first', get: 'total', desc: true }, { key: 'amount_asc', label: 'Amount, lowest first', get: 'total' }, { key: 'status', label: 'Status', get: 'status' }, { key: 'balance', label: 'Balance to pay, highest first', get: 'balance', desc: true }] })
  if (err) return <Problem>{err}</Problem>
  if (!rows) return <Bone className="h-40 w-full rounded-2xl" />
  if (!rows.length) return <Empty icon={FileText} title="No invoices yet">When we send you an invoice it appears here. You can read it, download the PDF and accept it online.</Empty>
  return <><div className="flex items-center justify-between gap-3 mb-3"><h1 className="font-semibold text-lg">Invoices</h1>{sortControl}</div><InvoiceList rows={sorted} /></>
}

function Shipments() {
  const [rows, err] = useLoad('/client/shipments')
  const [sorted, sortControl] = useSort(rows, { date: r => r.updated_at || r.created_at, name: r => r.invoice?.number, more: [{ key: 'eta', label: 'Arrival, soonest first', get: 'eta' }, { key: 'status', label: 'Status', get: 'status' }] })
  if (err) return <Problem>{err}</Problem>
  if (!rows) return <Bone className="h-40 w-full rounded-2xl" />
  if (!rows.length) return <Empty icon={Truck} title="No shipments yet">Once your order is on its way, each shipment appears here with where it is and when it is expected.</Empty>
  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3"><h1 className="font-semibold text-lg">Shipments</h1>{sortControl}</div>
      <ul className="grid md:grid-cols-2 gap-5">
        {sorted.map(s => { const passed = [...(s.checkpoints || [])].sort((a, b) => String(a.at).localeCompare(String(b.at))); const last = passed[passed.length - 1] || null; return (
          <li key={s.id}><Card className="p-6 h-full flex flex-col">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold tracking-widest text-muted-foreground">{s.invoice.number} · SHIPMENT {s.number}</p><h2 className="font-semibold text-foreground mt-0.5 truncate">{s.invoice.title || 'Your order'}</h2></div><Tag tone={shipmentTone(s.status)}>{SHIPMENT_LABELS[s.status] || s.status}</Tag></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm flex-1">
              <div><dt className="text-xs text-muted-foreground">From</dt><dd className="font-medium">{s.origin?.name || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">To</dt><dd className="font-medium">{s.destination?.name || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">How</dt><dd className="font-medium">{MODE_LABELS[s.mode] || '—'}{s.vehicle ? ` · ${s.vehicle}` : ''}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{s.status === 'delivered' ? 'Delivered' : 'Expected'}</dt><dd className="font-medium">{s.status === 'delivered' ? fmtDay(s.delivered_at) : s.eta ? fmtDay(s.eta) : '—'}</dd></div>
              {last && <div className="col-span-2 rounded-xl bg-secondary/60 px-3 py-2 flex items-start gap-2"><MapPin className="w-4 h-4 text-accent mt-0.5 shrink-0" /><span><span className="font-medium">{last.name}{last.state ? `, ${last.state}` : ''}</span><span className="block text-xs text-muted-foreground">{last.note ? `${last.note} · ` : ''}{ago(last.at)}</span></span></div>}
            </dl>
            <Link to={`/q/${s.invoice.token}#shipments`} className={`${outline} h-10 mt-5`}>Track on the map<ArrowRight className="w-4 h-4" /></Link>
          </Card></li>
        ) })}
      </ul>
    </>
  )
}

function Payments() {
  const [sp, setSp] = useSearchParams()
  const [rows, err, reload] = useLoad('/client/payments')
  const [invoices] = useLoad('/client/invoices')
  const [purchases] = useLoad('/client/purchases')
  const payable = useMemo(() => (invoices || []).filter(q => q.status === 'accepted'), [invoices])
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ quote_id: sp.get('invoice') || '', amount: '', paid_on: today, method: 'Bank transfer', reference: '', note: '' })
  const [file, setFile] = useState(null); const picker = useRef(null)
  const [busy, setBusy] = useState(false); const [problem, setProblem] = useState(null); const [ok, setOk] = useState(null)
  const chosen = payable.find(q => String(q.id) === String(f.quote_id))
  useEffect(() => { if (chosen && !f.amount && chosen.balance > 0) setF(x => ({ ...x, amount: String(chosen.balance) })) }, [chosen]) // eslint-disable-line react-hooks/exhaustive-deps
  const [sorted, sortControl] = useSort(rows, { more: [{ key: 'paid', label: 'Payment date, latest first', get: 'paid_on', desc: true }, { key: 'amount', label: 'Amount, highest first', get: 'amount', desc: true }, { key: 'status', label: 'Status', get: 'status' }, { key: 'invoice', label: 'Invoice number', get: r => r.invoice?.number }] })
  const submit = async e => {
    e.preventDefault(); setProblem(null); setOk(null)
    if (!file) return setProblem('Please attach your payment receipt.')
    setBusy(true)
    try {
      const p = await api('/client/payments', { method: 'POST', body: { ...f, quote_id: f.quote_id || null } })
      try { await upload(file, `/client/payments/${p.id}/receipt`); setOk('Thank you. Your payment and receipt have been sent to our team; you will be told when it is confirmed.') }
      catch (x) { setProblem(`Your payment was recorded, but the receipt did not upload: ${x.message} Use “Add receipt” next to it below.`) }
      setF({ quote_id: '', amount: '', paid_on: today, method: 'Bank transfer', reference: '', note: '' }); setFile(null); if (sp.get('invoice')) setSp({}, { replace: true }); reload()
    } catch (x) { setProblem(x.message) } finally { setBusy(false) }
  }
  const openReceipt = async p => { try { await openFile(() => api(`/client/payments/${p.id}/receipt/url`).then(r => ({ url: r.url, name: p.receipt_name }))) } catch (x) { setProblem(x.message) } }
  const addReceipt = async (p, picked) => { if (!picked) return; setBusy(true); setProblem(null); try { await upload(picked, `/client/payments/${p.id}/receipt`); setOk('Receipt added.'); reload() } catch (x) { setProblem(x.message) } finally { setBusy(false) } }
  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-4">
        <div><h1 className="font-semibold text-lg text-foreground">Send us a payment receipt</h1><p className="text-sm text-muted-foreground mt-0.5">Tell us what you paid and attach the bank receipt or transfer confirmation. Our accounts team confirms it against the invoice.</p></div>
        <Problem>{problem}</Problem><Notice>{ok}</Notice>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="block lg:col-span-3"><Label>Invoice *</Label><select required className={input} value={f.quote_id} onChange={e => setF({ ...f, quote_id: e.target.value, amount: '' })}><option value="">Choose the invoice you paid…</option>{payable.map(q => <option key={q.id} value={q.id}>{q.number} · {money(q.total, q.currency)}{q.balance > 0 ? ` · ${money(q.balance, q.currency)} to pay` : ' · paid'}</option>)}</select>{invoices && !payable.length && <span className="block text-xs text-muted-foreground mt-1.5">Payments are made against invoices you have accepted. You have none yet.</span>}</label>
          <label className="block"><Label>Amount paid{chosen ? ` (${chosen.currency})` : ''} *</Label><input required type="number" min="0.01" step="0.01" inputMode="decimal" className={input} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label className="block"><Label>Payment date *</Label><input required type="date" max={today} className={input} value={f.paid_on} onChange={e => setF({ ...f, paid_on: e.target.value })} /></label>
          <label className="block"><Label>How you paid</Label><select className={input} value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>{['Bank transfer', 'Letter of credit', 'Cash deposit', 'Cheque', 'Other'].map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="block"><Label hint="(optional)">Transaction reference</Label><input maxLength={120} className={input} value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} /></label>
          <label className="block lg:col-span-2"><Label hint="(optional)">Note</Label><input maxLength={500} className={input} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={picker} type="file" accept={FILE_ACCEPT} className="sr-only" onChange={e => { setFile(e.target.files[0] || null); e.target.value = '' }} aria-label="Payment receipt" />
          <button type="button" onClick={() => picker.current?.click()} className={`${outline} h-10`}><Paperclip className="w-4 h-4" />{file ? 'Change receipt' : 'Attach receipt *'}</button>
          {file && <span className="text-sm text-muted-foreground truncate max-w-xs">{file.name} · {fileSize(file.size)}</span>}
          <button type="submit" disabled={busy} className={`${accent} ml-auto`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Sending…' : 'Send payment'}</button>
        </div>
      </form>

      <section>
        <div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-semibold text-lg">Transaction history</h2>{sortControl}</div>
        {err ? <Problem>{err}</Problem> : !rows ? <Bone className="h-32 w-full rounded-2xl" /> : !rows.length ? <Empty icon={Banknote} title="No payments yet">Payments you send us, and those our team records, are listed here with their status.</Empty> : (
          <Card><ul className="divide-y divide-border">
            {sorted.map(p => { const [label, tone] = PAYMENT[p.status] || [p.status, 'muted']; return (
              <li key={p.id} className="px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="flex-1 min-w-[12rem]"><span className="font-semibold tabular-nums">{money(p.amount, p.currency)}</span><span className="text-muted-foreground"> · {p.invoice?.number || 'on account'}</span><span className="block text-xs text-muted-foreground">Paid {fmtDay(p.paid_on)}{p.method ? ` · ${p.method}` : ''}{p.reference ? ` · ${p.reference}` : ''} · recorded {fmtMoment(p.created_at)}</span>{p.status_note && <span className="block text-xs mt-1">“{p.status_note}”</span>}</span>
                <Tag tone={tone}>{label}</Tag>
                {p.has_receipt ? <button type="button" onClick={() => openReceipt(p)} className="text-xs font-semibold text-accent">View receipt</button>
                  : p.status === 'submitted' ? <label className="text-xs font-semibold text-accent cursor-pointer">Add receipt<input type="file" accept={FILE_ACCEPT} className="sr-only" onChange={e => { addReceipt(p, e.target.files[0]); e.target.value = '' }} /></label> : null}
              </li>
            ) })}
          </ul></Card>
        )}
      </section>

      {purchases?.length > 0 && (
        <section>
          <h2 className="font-semibold text-lg mb-3">Orders on record</h2>
          <Card><ul className="divide-y divide-border">{purchases.map(p => <li key={p.id} className="px-5 py-3 flex flex-wrap items-center gap-4 text-sm"><span className="flex-1 min-w-[12rem]"><span className="font-medium">{p.description || 'Order'}</span><span className="block text-xs text-muted-foreground">{p.reference ? `${p.reference} · ` : ''}{fmtDay(p.purchased_at || p.created_at)}</span></span><span className="font-semibold tabular-nums">{money(p.amount, p.currency)}</span><Tag tone={p.status === 'paid' ? 'green' : p.status === 'cancelled' ? 'muted' : 'amber'}>{p.status}</Tag></li>)}</ul></Card>
        </section>
      )}
    </div>
  )
}

function Account() {
  const { me, refresh } = clientPortal.use()
  const [f, setF] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [ok, setOk] = useState(false)
  const [docs, , reloadDocs] = useLoad('/client/documents')
  const [label, setLabel] = useState(''); const [queue, setQueue] = useState([]); const picker = useRef(null)
  useEffect(() => { setF({ company_name: me.name || '', contact_person: me.contact_person || '', phone: me.phone || '', country: me.country || '', address: me.address || '', registration_number: me.registration_number || '', tax_id: me.tax_id || '' }) }, [me])
  if (!f) return null
  const set = k => e => { setF(x => ({ ...x, [k]: e.target.value })); setOk(false) }
  const save = async e => { e.preventDefault(); setBusy(true); setErr(null); setOk(false); try { await api('/client/me', { method: 'PATCH', body: f }); await refresh(); setOk(true) } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  const add = async list => { for (const file of list) { setQueue(q => [...q, { name: file.name }]); try { await upload(file, '/client/documents', { label: label || docs?.labels?.[0] }); setQueue(q => q.filter(x => x.name !== file.name)); reloadDocs() } catch (x) { setQueue(q => q.map(v => (v.name === file.name ? { ...v, error: x.message } : v))) } } }
  const open = async d => { try { await openFile(() => api(`/client/documents/${d.id}/url`).then(r => ({ url: r.url, name: d.name, type: d.content_type }))) } catch (x) { setErr(x.message) } }
  return (
    <div className="space-y-6">
      <form onSubmit={save} className="bg-card border border-border rounded-2xl p-6 md:p-8 max-w-3xl space-y-4">
        <div><h1 className="font-semibold text-lg text-foreground">Company profile</h1><p className="text-sm text-muted-foreground mt-0.5">Our invoices and shipping documents are made out to these details.</p></div>
        <Problem>{err}</Problem>{ok && <Notice>Saved.</Notice>}
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2"><Label>Company name *</Label><input required maxLength={200} className={input} value={f.company_name} onChange={set('company_name')} /></label>
          <label className="block"><Label>Contact person</Label><input maxLength={120} className={input} value={f.contact_person} onChange={set('contact_person')} /></label>
          <label className="block"><Label>Phone number</Label><input type="tel" maxLength={60} className={input} value={f.phone} onChange={set('phone')} /></label>
          <label className="block sm:col-span-2"><Label hint="(you sign in with it; contact us to change it)">Email address</Label><input disabled className={input} value={me.email} /></label>
          <label className="block sm:col-span-2"><Label>Company address</Label><textarea rows={2} maxLength={500} className={input} value={f.address} onChange={set('address')} /></label>
          <label className="block"><Label>Country</Label><input maxLength={100} className={input} value={f.country} onChange={set('country')} /></label>
          <label className="block"><Label>Business registration number</Label><input maxLength={100} className={input} value={f.registration_number} onChange={set('registration_number')} /></label>
          <label className="block"><Label>Tax identification number</Label><input maxLength={100} className={input} value={f.tax_id} onChange={set('tax_id')} /></label>
        </div>
        <div className="flex justify-end pt-2"><button type="submit" disabled={busy} className={accent}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>

      <Card className="max-w-3xl">
        <div className="px-6 py-4 border-b border-border"><h2 className="font-semibold">Company documents (KYC)</h2><p className="text-xs text-muted-foreground mt-0.5">Your registration certificate, tax identification and similar. Only you and our team can see them.</p></div>
        <ul className="divide-y divide-border">
          {docs?.items?.map(d => <li key={d.id} className="px-6 py-3 flex items-center gap-3 text-sm"><FileText className="w-4 h-4 text-muted-foreground shrink-0" /><button type="button" onClick={() => open(d)} className="flex-1 min-w-0 text-left hover:text-accent"><span className="font-medium truncate block">{d.name}</span><span className="block text-xs text-muted-foreground">{[d.label, fileSize(d.bytes), fmtDay(d.created_at)].filter(Boolean).join(' · ')}</span></button></li>)}
          {queue.map(q => <li key={q.name} className="px-6 py-3 text-sm flex items-center gap-3">{!q.error && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}<span className="flex-1 truncate">{q.name}<span className={`block text-xs ${q.error ? 'text-destructive' : 'text-muted-foreground'}`}>{q.error || 'Uploading…'}</span></span></li>)}
          {docs && !docs.items.length && !queue.length && <li className="px-6 py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</li>}
        </ul>
        <div className="px-6 py-4 border-t border-border flex flex-wrap items-center gap-3">
          <select className={`${input} h-11 py-0 max-w-xs`} value={label || docs?.labels?.[0] || ''} onChange={e => setLabel(e.target.value)} aria-label="Kind of document">{(docs?.labels || []).map(l => <option key={l}>{l}</option>)}</select>
          <input ref={picker} type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={e => { add([...e.target.files]); e.target.value = '' }} />
          <button type="button" onClick={() => picker.current?.click()} className={`${outline} h-11`}><Paperclip className="w-4 h-4" />Add a document</button>
          <span className="text-xs text-muted-foreground">PDF, Word, Excel or images · up to 20 MB each</span>
        </div>
      </Card>

      <PasswordChange change={clientPortal.changePassword} email={me.email} />
    </div>
  )
}

const NotHere = () => <Page><div className="text-center py-24"><h1 className="font-serif text-3xl font-bold mb-3">Page not found</h1><p className="text-muted-foreground">Back to your <Link to="/client" className="text-accent font-semibold">overview</Link>.</p></div></Page>
function Notes() { const { refresh } = clientPortal.use(); return <><h1 className="font-semibold text-lg mb-3">Notifications</h1><Notifications api={api} path="/client/notifications" onRead={refresh} /></> }

export default function ClientApp() {
  return (
    <clientPortal.Provider>
      <Routes>
        <Route path="login" element={<PortalLogin cfg={CFG} />} />
        <Route path="register" element={<PortalRegister cfg={CFG} />} />
        <Route path="verify" element={<PortalVerify cfg={CFG} />} />
        <Route path="forgot" element={<PortalForgot cfg={CFG} />} />
        <Route path="reset" element={<PortalReset cfg={CFG} />} />
        <Route element={<PortalGate cfg={CFG}><Shell /></PortalGate>}>
          <Route index element={<Overview />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="shipments" element={<Shipments />} />
          <Route path="payments" element={<Payments />} />
          <Route path="notifications" element={<Notes />} />
          <Route path="account" element={<Account />} />
        </Route>
        <Route path="*" element={<NotHere />} />
      </Routes>
    </clientPortal.Provider>
  )
}
