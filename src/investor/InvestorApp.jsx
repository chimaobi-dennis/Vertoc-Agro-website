/*
 * The investment portal (/investor/*), separate from the rest of the site:
 * open pages for signing in and registering; behind an investor session
 * the dashboard, the opportunities, the investor's own investments (status,
 * maturity, returns, history), notifications, documents and the profile.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell, Download, FileText, LayoutDashboard, Loader2, Megaphone, Paperclip, ShieldCheck, TrendingUp, UserRound } from 'lucide-react'
import { investorPortal } from '../lib/portal'
import { Bone } from '../components/Skeleton'
import { PortalForgot, PortalLogin, PortalRegister, PortalReset, PortalVerify } from '../portal/AuthPages'
import { Card, Empty, Notifications, PasswordChange, PortalGate, PortalShell, Tag } from '../portal/Shared'
import { Label, Notice, Page, Problem, accent, input, outline } from '../supplier/ui'
import { useSort } from '../lib/sort'
import { FILE_ACCEPT, fileSize, fmtDay, fmtMoment, money } from '../lib/procurement'
import { ID_TYPES, INVESTMENT_LABELS, KYC_LABELS, OPPORTUNITY_LABELS, investmentTone, kycTone, opportunityTone, tenor } from '../lib/investing'

const { api, upload } = investorPortal
const CFG = {
  portal: investorPortal, base: '/investor', eyebrow: 'Investment portal', title: 'Investor',
  loginText: 'See the opportunities open to you and follow your investments.',
  registerTitle: 'Register as an investor',
  registerText: 'An account lets you see our investment opportunities, apply to them and follow each investment to maturity. We verify your identity before an investment is approved.',
  registerNote: 'After signing in you can upload your means of identification. Your bank details are used only to pay your returns and principal.',
  blank: { name: '', phone: '', address: '', id_type: '', id_number: '', bank_name: '', bank_account_name: '', bank_account_number: '' },
  fields: [
    { key: 'name', label: 'Full name or company name', required: true, wide: true, autoComplete: 'name' },
    { key: 'phone', label: 'Phone number', required: true, type: 'tel', autoComplete: 'tel' },
    { key: 'address', label: 'Address', required: true, type: 'textarea', autoComplete: 'street-address' },
    { key: 'id_type', label: 'Means of identification', required: true, options: ID_TYPES },
    { key: 'id_number', label: 'Identification number', required: true },
    { key: 'bank_name', label: 'Bank', required: true },
    { key: 'bank_account_name', label: 'Account name', required: true },
    { key: 'bank_account_number', label: 'Account number', required: true, wide: true },
  ],
}
const useLoad = path => { const [d, setD] = useState(null); const [err, setErr] = useState(null); const load = () => api(path).then(r => { setD(r); setErr(null) }).catch(e => setErr(e.message)); useEffect(() => { load() }, [path]); return [d, err, load] } // eslint-disable-line react-hooks/exhaustive-deps
const Back = ({ to, children }) => <Link to={to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" />{children}</Link>
const RISK = 'Investing puts your money at risk. Expected returns are estimates, not guarantees, and you may get back less than you put in. Read the terms of each opportunity and take independent advice if you are unsure.'

function Shell() {
  const { me } = investorPortal.use()
  return <PortalShell cfg={CFG} name={me.name} tabs={[
    { to: '/investor', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/investor/opportunities', label: 'Opportunities', icon: Megaphone },
    { to: '/investor/investments', label: 'My investments', icon: TrendingUp, badge: me.counts?.pending }, { to: '/investor/notifications', label: 'Notifications', icon: Bell, badge: me.counts?.unread },
    { to: '/investor/profile', label: 'Profile', icon: UserRound },
  ]} />
}

function OppCard({ o }) {
  return (
    <Card className="p-6 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold tracking-widest text-muted-foreground">{o.number}</p><h2 className="font-semibold text-lg text-foreground mt-0.5">{o.title}</h2></div><Tag tone={opportunityTone(o.state)}>{o.accepting || o.state !== 'open' ? OPPORTUNITY_LABELS[o.state] : 'Fully subscribed'}</Tag></div>
      {o.summary && <p className="text-sm text-muted-foreground mt-2">{o.summary}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm flex-1">
        <div><dt className="text-xs text-muted-foreground">Minimum investment</dt><dd className="font-medium tabular-nums">{money(o.min_amount, o.currency)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Tenor</dt><dd className="font-medium">{tenor(o.tenor_months)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Expected return</dt><dd className="font-medium">{o.expected_return_pct != null ? `${o.expected_return_pct}% over the tenor` : 'See the terms'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{o.state === 'upcoming' ? 'Opens' : 'Closes'}</dt><dd className="font-medium">{o.state === 'upcoming' ? fmtDay(o.opens_at) : o.closes_at ? fmtDay(o.closes_at) : 'Open until filled'}</dd></div>
      </dl>
      {o.filled_pct != null && <div className="mt-4"><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-accent" style={{ width: `${o.filled_pct}%` }} /></div><p className="text-xs text-muted-foreground mt-1.5">{o.filled_pct}% subscribed{o.available != null ? ` · ${money(o.available, o.currency)} still available` : ''}</p></div>}
      <Link to={`/investor/opportunities/${o.number}`} className={`${o.accepting ? accent : outline} mt-5`}>{o.accepting ? 'View and invest' : 'View details'}<ArrowRight className="w-4 h-4" /></Link>
    </Card>
  )
}

function Dashboard() {
  const { me, refresh } = investorPortal.use()
  const [sp] = useSearchParams()
  const [opps] = useLoad('/investor/opportunities')
  const [mine] = useLoad('/investor/investments')
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (['opportunities', 'investments', 'notifications', 'profile'].includes(sp.get('tab'))) return <Navigate to={`/investor/${sp.get('tab')}`} replace />
  const c = me.counts || {}
  const open = (opps || []).filter(o => o.state === 'open')
  const next = (mine || []).filter(i => i.status === 'active' && i.maturity_date).sort((a, b) => a.maturity_date.localeCompare(b.maturity_date))[0]
  return (
    <>
      {me.kyc_status !== 'verified' && <div className="mb-6 rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-5 py-4 text-sm flex flex-wrap items-center gap-3"><ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" /><span className="flex-1 min-w-[14rem]">{me.kyc_status === 'rejected' ? 'We could not verify your identification. Please check your details and documents.' : 'Your identity is not verified yet. Upload your means of identification so that we can approve your investments.'}</span><Link to="/investor/profile" className={`${outline} h-9 px-4 text-xs`}>Go to my profile</Link></div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[['Invested (active)', money(c.invested || 0, 'NGN'), '/investor/investments'], ['Returns received', money(c.returns || 0, 'NGN'), '/investor/investments'], ['Active investments', c.active ?? 0, '/investor/investments'], ['Awaiting approval', c.pending ?? 0, '/investor/investments']].map(([label, n, to]) => (
          <Link key={label} to={to} className="text-left bg-card border border-border rounded-2xl px-5 py-4 hover:shadow-card transition-shadow"><p className="text-2xl font-bold tabular-nums text-foreground">{n}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p></Link>
        ))}
      </div>
      {next && <Card className="p-5 mb-8 text-sm flex flex-wrap items-center gap-3"><TrendingUp className="w-5 h-5 text-accent" /><span className="flex-1 min-w-[14rem]">Next maturity: <b>{next.number}</b> ({money(next.amount, next.currency)}) matures on <b>{fmtDay(next.maturity_date)}</b>.</span><Link to={`/investor/investments/${next.id}`} className="font-semibold text-accent">Open</Link></Card>}
      <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Open investment opportunities</h2><Link to="/investor/opportunities" className="text-sm font-semibold text-accent inline-flex items-center gap-1">All opportunities<ArrowRight className="w-3.5 h-3.5" /></Link></div>
      {!opps ? <Bone className="h-40 w-full rounded-2xl" /> : !open.length ? <Empty icon={Megaphone} title="No open opportunities right now">New opportunities are published here as they become available. We will notify you.</Empty> : <ul className="grid md:grid-cols-2 gap-5">{open.slice(0, 4).map(o => <li key={o.number}><OppCard o={o} /></li>)}</ul>}
    </>
  )
}

function Opportunities() {
  const [rows, err] = useLoad('/investor/opportunities')
  const [sorted, sortControl] = useSort(rows, { date: 'opens_at', name: 'title', more: [{ key: 'min', label: 'Minimum amount, lowest first', get: 'min_amount' }, { key: 'return', label: 'Expected return, highest first', get: 'expected_return_pct', desc: true }, { key: 'tenor', label: 'Tenor, shortest first', get: 'tenor_months' }, { key: 'closes', label: 'Closing date, soonest first', get: 'closes_at' }] })
  if (err) return <Problem>{err}</Problem>
  if (!rows) return <Bone className="h-40 w-full rounded-2xl" />
  if (!rows.length) return <Empty icon={Megaphone} title="No opportunities yet">New opportunities are published here as they become available.</Empty>
  return <><div className="flex items-center justify-between gap-3 mb-3"><h1 className="font-semibold text-lg">Investment opportunities</h1>{sortControl}</div><ul className="grid md:grid-cols-2 gap-5">{sorted.map(o => <li key={o.number}><OppCard o={o} /></li>)}</ul><p className="text-xs text-muted-foreground mt-6 max-w-3xl">{RISK}</p></>
}

function Opportunity() {
  const { number } = useParams(); const nav = useNavigate()
  const { me } = investorPortal.use()
  const [o, err] = useLoad(`/investor/opportunities/${number}`)
  const [f, setF] = useState({ amount: '', note: '', confirmed: false }); const [busy, setBusy] = useState(false); const [problem, setProblem] = useState(null)
  if (err) return <><Back to="/investor/opportunities">Opportunities</Back><Problem>{err}</Problem></>
  if (!o) return <Bone className="h-64 w-full rounded-2xl" />
  const amount = Number(f.amount) || 0
  const expected = o.expected_return_pct != null && amount > 0 ? amount * o.expected_return_pct / 100 : null
  const invest = async e => {
    e.preventDefault(); setProblem(null); setBusy(true)
    try { const r = await api(`/investor/opportunities/${number}/invest`, { method: 'POST', body: f }); nav(`/investor/investments/${r.id}?new=1`) } catch (x) { setProblem(x.message) } finally { setBusy(false) }
  }
  const download = async d => { try { const { url } = await api(`/investor/opportunities/${number}/documents/${d.id}/url`); window.open(url, '_blank', 'noopener') } catch (x) { setProblem(x.message) } }
  return (
    <>
      <Back to="/investor/opportunities">Opportunities</Back>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6"><div className="min-w-0"><p className="text-xs font-semibold tracking-widest text-muted-foreground">{o.number}</p><h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground mt-1">{o.title}</h1></div><Tag tone={opportunityTone(o.state)}>{OPPORTUNITY_LABELS[o.state]}</Tag></div>
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card className="p-6">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Minimum investment</dt><dd className="font-semibold tabular-nums mt-0.5">{money(o.min_amount, o.currency)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Tenor</dt><dd className="font-semibold mt-0.5">{tenor(o.tenor_months)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Expected return</dt><dd className="font-semibold mt-0.5">{o.expected_return_pct != null ? `${o.expected_return_pct}%` : 'See the terms'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{o.state === 'upcoming' ? 'Opens' : 'Closes'}</dt><dd className="font-semibold mt-0.5">{o.state === 'upcoming' ? fmtDay(o.opens_at) : o.closes_at ? fmtDay(o.closes_at) : 'Open until filled'}</dd></div>
            </dl>
            {o.filled_pct != null && <div className="mt-5"><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-accent" style={{ width: `${o.filled_pct}%` }} /></div><p className="text-xs text-muted-foreground mt-1.5">{o.filled_pct}% of {money(o.capacity, o.currency)} subscribed · {money(o.available, o.currency)} still available</p></div>}
            {o.return_note && <p className="mt-5 rounded-xl bg-secondary/60 border border-border px-4 py-3 text-sm whitespace-pre-line">{o.return_note}</p>}
          </Card>
          {(o.summary || o.description) && <Card className="p-6"><h2 className="font-semibold mb-3">About this opportunity</h2>{o.summary && <p className="text-sm font-medium mb-3">{o.summary}</p>}<p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{o.description}</p></Card>}
          {o.documents?.length > 0 && <Card><div className="px-6 py-4 border-b border-border"><h2 className="font-semibold">Documents</h2></div><ul className="divide-y divide-border">{o.documents.map(d => <li key={d.id} className="px-6 py-3 flex items-center gap-3 text-sm"><FileText className="w-4 h-4 text-muted-foreground shrink-0" /><span className="flex-1 min-w-0 truncate font-medium">{d.name}<span className="block text-xs font-normal text-muted-foreground">{fileSize(d.bytes)}</span></span><button type="button" onClick={() => download(d)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" aria-label={`Download ${d.name}`}><Download className="w-4 h-4" /></button></li>)}</ul></Card>}
        </div>
        <Card className="p-6 lg:sticky lg:top-28">
          <h2 className="font-semibold mb-1">Invest in this opportunity</h2>
          {!o.accepting ? <p className="text-sm text-muted-foreground mt-2">{o.state === 'upcoming' ? `This opportunity opens on ${fmtDay(o.opens_at)}.` : o.state === 'open' ? 'This opportunity is fully subscribed.' : 'This opportunity is closed to new investments.'}</p> : (
            <form onSubmit={invest} className="space-y-4 mt-3">
              <Problem>{problem}</Problem>
              {me.kyc_status !== 'verified' && <p className="text-xs rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">Your identity is not verified yet. You can apply now; we approve the investment once your <Link to="/investor/profile" className="font-semibold text-accent">identification</Link> has been checked.</p>}
              <label className="block"><Label>Amount to invest ({o.currency}) *</Label><input required type="number" min={o.min_amount || 0.01} max={o.available ?? undefined} step="0.01" inputMode="decimal" className={input} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /><span className="block text-xs text-muted-foreground mt-1.5">Minimum {money(o.min_amount, o.currency)}{o.available != null ? ` · up to ${money(o.available, o.currency)}` : ''}.{expected != null ? ` Expected return: ${money(expected, o.currency)} after ${tenor(o.tenor_months)}.` : ''}</span></label>
              <label className="block"><Label hint="(optional)">Note to our team</Label><textarea rows={2} maxLength={2000} className={input} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.confirmed} onChange={e => setF({ ...f, confirmed: e.target.checked })} /><span>I have read the terms of this opportunity and understand that returns are expected, not guaranteed.</span></label>
              <button type="submit" disabled={busy || !f.confirmed} className={`${accent} w-full`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Sending…' : 'Apply to invest'}</button>
              <p className="text-xs text-muted-foreground">Your application goes to our team for approval. We then send you the payment details; the investment starts once your payment is confirmed.</p>
            </form>
          )}
        </Card>
      </div>
      <p className="text-xs text-muted-foreground mt-8 max-w-3xl">{RISK}</p>
    </>
  )
}

function Investments() {
  const [rows, err] = useLoad('/investor/investments')
  const [sorted, sortControl] = useSort(rows, { name: r => r.opportunity?.title, more: [{ key: 'amount', label: 'Amount, highest first', get: 'amount', desc: true }, { key: 'maturity', label: 'Maturity, soonest first', get: 'maturity_date' }, { key: 'status', label: 'Status', get: 'status' }] })
  if (err) return <Problem>{err}</Problem>
  if (!rows) return <Bone className="h-40 w-full rounded-2xl" />
  if (!rows.length) return <Empty icon={TrendingUp} title="You have not invested yet">Choose an open opportunity and apply; your investment appears here with its status, maturity date and returns.</Empty>
  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3"><h1 className="font-semibold text-lg">My investments</h1>{sortControl}</div>
      <Card><ul className="divide-y divide-border">
        {sorted.map(i => (
          <li key={i.id}><Link to={`/investor/investments/${i.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-sm hover:bg-muted/40">
            <span className="flex-1 min-w-[12rem]"><span className="font-semibold text-foreground">{i.opportunity?.title || i.number}</span><span className="block text-xs text-muted-foreground">{i.number} · applied {fmtDay(i.created_at)}</span></span>
            <span className="tabular-nums font-semibold">{money(i.amount, i.currency)}</span>
            <span className="text-xs text-muted-foreground min-w-[9rem]">{i.maturity_date ? `matures ${fmtDay(i.maturity_date)}` : 'dates set on approval'}{i.expected_return != null && <span className="block">expected return {money(i.expected_return, i.currency)}</span>}</span>
            <Tag tone={investmentTone(i.status)}>{i.label || INVESTMENT_LABELS[i.status]}</Tag>
          </Link></li>
        ))}
      </ul></Card>
    </>
  )
}

function Investment() {
  const { id } = useParams(); const [sp] = useSearchParams()
  const [i, err, reload] = useLoad(`/investor/investments/${id}`)
  const [busy, setBusy] = useState(false); const [problem, setProblem] = useState(null); const [ok, setOk] = useState(sp.get('new') ? 'Thank you. Your application has been sent to our team; we will be in touch with the payment details.' : null)
  const picker = useRef(null)
  if (err) return <><Back to="/investor/investments">My investments</Back><Problem>{err}</Problem></>
  if (!i) return <Bone className="h-64 w-full rounded-2xl" />
  const proof = async file => { if (!file) return; setBusy(true); setProblem(null); try { await upload(file, `/investor/investments/${id}/proof`); setOk('Your proof of payment has been sent to our team.'); reload() } catch (x) { setProblem(x.message) } finally { setBusy(false) } }
  const cancel = async () => { if (!window.confirm('Cancel this application?')) return; setBusy(true); try { await api(`/investor/investments/${id}/cancel`, { method: 'POST' }); setOk('Your application has been cancelled.'); reload() } catch (x) { setProblem(x.message) } finally { setBusy(false) } }
  const due = i.expected_return != null ? i.amount + i.expected_return : null
  const row = (l, v) => <div><dt className="text-xs text-muted-foreground">{l}</dt><dd className="font-semibold mt-0.5 tabular-nums">{v || '—'}</dd></div>
  return (
    <>
      <Back to="/investor/investments">My investments</Back>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6"><div className="min-w-0"><p className="text-xs font-semibold tracking-widest text-muted-foreground">{i.number} · applied {fmtMoment(i.created_at)}</p><h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground mt-1">{i.opportunity?.title}</h1></div><Tag tone={investmentTone(i.status)}>{i.label}</Tag></div>
      <div className="space-y-3 mb-6"><Problem>{problem}</Problem><Notice>{ok}</Notice></div>
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card className="p-6">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
              {row('Invested amount', money(i.amount, i.currency))}{row('Expected return', i.expected_return != null ? money(i.expected_return, i.currency) : i.opportunity?.expected_return_pct != null ? `${i.opportunity.expected_return_pct}%` : '')}{row('Due at maturity', due != null ? money(due, i.currency) : '')}
              {row('Start date', i.start_date ? fmtDay(i.start_date) : '')}{row('Maturity date', i.maturity_date ? fmtDay(i.maturity_date) : '')}{row('Paid to you so far', money(i.paid || 0, i.currency))}
            </dl>
            {i.status_note && <p className="mt-5 rounded-xl bg-secondary/60 border border-border px-4 py-3 text-sm"><span className="block text-xs text-muted-foreground mb-0.5">A note from our team</span>{i.status_note}</p>}
          </Card>
          <Card>
            <div className="px-6 py-4 border-b border-border"><h2 className="font-semibold">Returns and payments to you</h2></div>
            <ul className="divide-y divide-border">
              {i.payouts.map(p => <li key={p.id} className="px-6 py-3 flex flex-wrap items-center gap-3 text-sm"><Tag tone={p.kind === 'principal' ? 'blue' : 'green'}>{p.kind}</Tag><span className="font-semibold tabular-nums">{money(p.amount, i.currency)}</span><span className="flex-1 text-muted-foreground">{fmtDay(p.paid_on)}{p.reference ? ` · ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}</span></li>)}
              {!i.payouts.length && <li className="px-6 py-8 text-center text-sm text-muted-foreground">Nothing paid yet. Returns are paid as set out in the terms of the opportunity.</li>}
            </ul>
          </Card>
        </div>
        <Card className="p-6 text-sm space-y-4">
          <h2 className="font-semibold">Proof of payment</h2>
          {i.has_proof ? <p className="text-muted-foreground">We have your proof of payment.{['pending', 'active'].includes(i.status) ? ' You can replace it if needed.' : ''}</p> : <p className="text-muted-foreground">{i.status === 'pending' ? 'Once you have paid, upload the bank receipt or transfer confirmation here so that we can approve your investment.' : 'No proof of payment was uploaded.'}</p>}
          {['pending', 'active'].includes(i.status) && <><input ref={picker} type="file" accept={FILE_ACCEPT} className="sr-only" onChange={e => { proof(e.target.files[0]); e.target.value = '' }} /><button type="button" disabled={busy} onClick={() => picker.current?.click()} className={`${outline} h-10 w-full`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}{i.has_proof ? 'Replace the proof' : 'Upload proof of payment'}</button></>}
          {i.status === 'pending' && <button type="button" disabled={busy} onClick={cancel} className="w-full text-sm font-semibold text-destructive hover:underline py-1">Cancel this application</button>}
          <Link to={`/investor/opportunities/${i.opportunity?.number}`} className="block font-semibold text-accent">View the opportunity</Link>
        </Card>
      </div>
    </>
  )
}

function Profile() {
  const { me, refresh } = investorPortal.use()
  const [f, setF] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [ok, setOk] = useState(false)
  const [docs, , reloadDocs] = useLoad('/investor/documents')
  const labels = me.kyc_labels || []
  const [label, setLabel] = useState(''); const [queue, setQueue] = useState([]); const picker = useRef(null)
  useEffect(() => { setF(Object.fromEntries(['name', 'phone', 'address', 'id_type', 'id_number', 'bank_name', 'bank_account_name', 'bank_account_number'].map(k => [k, me[k] || '']))) }, [me])
  if (!f) return null
  const set = k => e => { setF(x => ({ ...x, [k]: e.target.value })); setOk(false) }
  const save = async e => { e.preventDefault(); setBusy(true); setErr(null); setOk(false); try { await api('/investor/me', { method: 'PATCH', body: f }); await refresh(); setOk(true) } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  const add = async list => { for (const file of list) { setQueue(q => [...q, { name: file.name }]); try { await upload(file, '/investor/documents', { label: label || labels[0] }); setQueue(q => q.filter(x => x.name !== file.name)); reloadDocs() } catch (x) { setQueue(q => q.map(v => (v.name === file.name ? { ...v, error: x.message } : v))) } } }
  const open = async d => { try { const { url } = await api(`/investor/documents/${d.id}/url`); window.open(url, '_blank', 'noopener') } catch (x) { setErr(x.message) } }
  return (
    <div className="space-y-6">
      <form onSubmit={save} className="bg-card border border-border rounded-2xl p-6 md:p-8 max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-semibold text-lg text-foreground">Your details</h1><p className="text-sm text-muted-foreground mt-0.5">Used to verify your identity and to pay your returns.</p></div><Tag tone={kycTone(me.kyc_status)}>{KYC_LABELS[me.kyc_status]}</Tag></div>
        <Problem>{err}</Problem>{ok && <Notice>Saved.</Notice>}
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2"><Label>Full name or company name *</Label><input required maxLength={200} className={input} value={f.name} onChange={set('name')} /></label>
          <label className="block"><Label hint="(contact us to change it)">Email address</Label><input disabled className={input} value={me.email} /></label>
          <label className="block"><Label>Phone number</Label><input type="tel" maxLength={60} className={input} value={f.phone} onChange={set('phone')} /></label>
          <label className="block sm:col-span-2"><Label>Address</Label><textarea rows={2} maxLength={500} className={input} value={f.address} onChange={set('address')} /></label>
          <label className="block"><Label>Means of identification</Label><select className={input} value={f.id_type} onChange={set('id_type')}><option value="">Choose…</option>{[...new Set([...ID_TYPES, f.id_type].filter(Boolean))].map(o => <option key={o}>{o}</option>)}</select></label>
          <label className="block"><Label>Identification number</Label><input maxLength={80} className={input} value={f.id_number} onChange={set('id_number')} /></label>
          <label className="block"><Label>Bank</Label><input maxLength={120} className={input} value={f.bank_name} onChange={set('bank_name')} /></label>
          <label className="block"><Label>Account name</Label><input maxLength={160} className={input} value={f.bank_account_name} onChange={set('bank_account_name')} /></label>
          <label className="block"><Label>Account number</Label><input maxLength={40} inputMode="numeric" className={input} value={f.bank_account_number} onChange={set('bank_account_number')} /></label>
        </div>
        <div className="flex justify-end pt-2"><button type="submit" disabled={busy} className={accent}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>

      <Card className="max-w-3xl">
        <div className="px-6 py-4 border-b border-border"><h2 className="font-semibold">Identification documents (KYC)</h2><p className="text-xs text-muted-foreground mt-0.5">A clear copy of your means of identification, and a proof of address. Only you and our team can see them.</p></div>
        <ul className="divide-y divide-border">
          {docs?.map(d => <li key={d.id} className="px-6 py-3 flex items-center gap-3 text-sm"><FileText className="w-4 h-4 text-muted-foreground shrink-0" /><button type="button" onClick={() => open(d)} className="flex-1 min-w-0 text-left hover:text-accent"><span className="font-medium truncate block">{d.name}</span><span className="block text-xs text-muted-foreground">{[d.label, fileSize(d.bytes), fmtDay(d.created_at)].filter(Boolean).join(' · ')}</span></button></li>)}
          {queue.map(q => <li key={q.name} className="px-6 py-3 text-sm flex items-center gap-3">{!q.error && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}<span className="flex-1 truncate">{q.name}<span className={`block text-xs ${q.error ? 'text-destructive' : 'text-muted-foreground'}`}>{q.error || 'Uploading…'}</span></span></li>)}
          {docs && !docs.length && !queue.length && <li className="px-6 py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</li>}
        </ul>
        <div className="px-6 py-4 border-t border-border flex flex-wrap items-center gap-3">
          <select className={`${input} h-11 py-0 max-w-xs`} value={label || labels[0] || ''} onChange={e => setLabel(e.target.value)} aria-label="Kind of document">{labels.map(l => <option key={l}>{l}</option>)}</select>
          <input ref={picker} type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={e => { add([...e.target.files]); e.target.value = '' }} />
          <button type="button" onClick={() => picker.current?.click()} className={`${outline} h-11`}><Paperclip className="w-4 h-4" />Add a document</button>
          <span className="text-xs text-muted-foreground">PDF or images · up to 20 MB each</span>
        </div>
      </Card>

      <PasswordChange change={investorPortal.changePassword} email={me.email} />
    </div>
  )
}

const NotHere = () => <Page><div className="text-center py-24"><h1 className="font-serif text-3xl font-bold mb-3">Page not found</h1><p className="text-muted-foreground">Back to your <Link to="/investor" className="text-accent font-semibold">dashboard</Link>.</p></div></Page>
function Notes() { const { refresh } = investorPortal.use(); return <><h1 className="font-semibold text-lg mb-3">Notifications</h1><Notifications api={api} path="/investor/notifications" onRead={refresh} /></> }

export default function InvestorApp() {
  return (
    <investorPortal.Provider>
      <Routes>
        <Route path="login" element={<PortalLogin cfg={CFG} />} />
        <Route path="register" element={<PortalRegister cfg={CFG} />} />
        <Route path="verify" element={<PortalVerify cfg={CFG} />} />
        <Route path="forgot" element={<PortalForgot cfg={CFG} />} />
        <Route path="reset" element={<PortalReset cfg={CFG} />} />
        <Route element={<PortalGate cfg={CFG}><Shell /></PortalGate>}>
          <Route index element={<Dashboard />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="opportunities/:number" element={<Opportunity />} />
          <Route path="investments" element={<Investments />} />
          <Route path="investments/:id" element={<Investment />} />
          <Route path="notifications" element={<Notes />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<NotHere />} />
      </Routes>
    </investorPortal.Provider>
  )
}
