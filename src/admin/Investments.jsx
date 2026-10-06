/*
 * The investment section of the panel: opportunities the company offers,
 * the applications investors make to them (approve, reject, maturity,
 * payouts) and the investors themselves (details, KYC, documents).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { UserRound, ArrowLeft, Banknote, CheckCircle2, ExternalLink, Megaphone, Plus, Search, Trash2, TrendingUp, XCircle } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, Textarea, confirmDelete, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { DocumentsPanel } from './ClientTabs'
import { openDocument } from './documents'
import OpportunityFiles, { EMPTY_STAGE, uploadStaged } from './OpportunityFiles'
import InviteBox from './InviteBox'
import { ChangeRequestsPanel } from './InvestorChanges'
import { useSort } from '../lib/sort'
import { fmtDay, fmtMoment, fromLocalInput, money, toLocalInput } from '../lib/procurement'
import { INVESTMENT_LABELS, INVESTMENT_STATUSES, KYC_LABELS, OPPORTUNITY_LABELS, investmentTone, kycTone, opportunityTone, tenor } from '../lib/investing'

const Stat = ({ label, value }) => <Card className="px-4 py-3"><p className="text-xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></Card>
const Back = ({ to, children }) => <Link to={to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />{children}</Link>

/* ------------------------------------------------------------- the lists --- */
export function InvestmentsAdmin() {
  const { can } = useAuth()
  const [sp, setSp] = useSearchParams()
  const tab = ['opportunities', 'changes'].includes(sp.get('tab')) ? sp.get('tab') : 'applications'
  const [changesN, setChangesN] = useState(null)
  useEffect(() => { adminFetch('/stats').then(x => setChangesN(x.investorChanges)).catch(() => {}) }, [])
  const status = INVESTMENT_STATUSES.includes(sp.get('status')) ? sp.get('status') : 'all'
  const [data, setData] = useState(null); const [opps, setOpps] = useState(null); const [err, setErr] = useState(null)
  useEffect(() => { setData(null); adminFetch(`/investments?status=${status}`).then(setData).catch(e => setErr(e.message)) }, [status])
  useEffect(() => { adminFetch('/investment-opportunities').then(setOpps).catch(e => setErr(e.message)) }, [])
  const [rows, sortControl] = useSort(data?.items, { name: r => r.investor?.name, more: [
    { key: 'amount', label: 'Amount, highest first', get: 'amount', desc: true }, { key: 'maturity', label: 'Maturity, soonest first', get: 'maturity_date' }, { key: 'status', label: 'Status', get: r => INVESTMENT_STATUSES.indexOf(r.status) }, { key: 'opp', label: 'Opportunity', get: r => r.opportunity?.number },
  ] })
  const [oppRows, oppSort] = useSort(opps, { name: 'title', more: [{ key: 'closes', label: 'Closing date, soonest first', get: 'closes_at' }, { key: 'committed', label: 'Funds committed, highest first', get: 'committed', desc: true }, { key: 'status', label: 'Status', get: 'state' }] })
  const t = data?.totals
  const set = patch => { const n = new URLSearchParams(sp); for (const [k, v] of Object.entries(patch)) (v == null || v === 'all' || v === 'applications') ? n.delete(k) : n.set(k, v); setSp(n) }

  return (
    <>
      <PageHeader eyebrow="Investment" title="Investments" description="Opportunities you offer, and the money investors have committed to them."
        action={can('investments', 'create') && <Link to="/staff360/investments/opportunities/new"><Button variant="accent"><Plus className="w-4 h-4" />New opportunity</Button></Link>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {t && <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6 animate-fade-up"><Stat label="Funds committed" value={money(t.committed, 'NGN')} /><Stat label="Active investments" value={money(t.active, 'NGN')} /><Stat label="Awaiting approval" value={t.pending} /><Stat label="Maturing within 30 days" value={t.maturing_soon} /><Stat label="Investors" value={t.investors} /></div>}
      <Tabs value={tab} onChange={k => set({ tab: k })} tabs={[{ key: 'applications', label: 'Investments', icon: TrendingUp, count: data?.items.length }, { key: 'opportunities', label: 'Opportunities', icon: Megaphone, count: opps?.length }, { key: 'changes', label: 'Profile changes', icon: UserRound, count: changesN }]} />

      {tab === 'changes' ? <ChangeRequestsPanel /> : tab === 'applications' ? (<>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap rounded-xl border border-border overflow-hidden text-xs font-semibold">{['all', ...INVESTMENT_STATUSES].map(k => <button key={k} onClick={() => set({ status: k })} className={`px-3 py-2 ${status === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{k === 'all' ? 'All' : INVESTMENT_LABELS[k]}</button>)}</div>
          {sortControl}
        </div>
        <Card>
          <Table head={['Investment', 'Investor', 'Opportunity', 'Amount', 'Start → maturity', 'Expected return', 'Paid out', 'Status']}>
            {!data && [0, 1].map(i => <tr key={i}>{[...Array(8)].map((_, j) => <Td key={j}><Bone className="h-4 w-16" /></Td>)}</tr>)}
            {rows?.map(r => (
              <tr key={r.id} className="hover:bg-muted/40">
                <Td className="whitespace-nowrap"><Link to={`/staff360/investments/${r.id}`} className="font-medium hover:text-accent">{r.number}</Link><span className="block text-xs text-muted-foreground">{fmtMoment(r.created_at)}</span></Td>
                <Td className="max-w-[180px] truncate">{r.investor ? <Link to={`/staff360/investors/${r.investor.id}`} className="hover:text-accent">{r.investor.name}</Link> : '—'}</Td>
                <Td className="max-w-[200px] truncate text-muted-foreground">{r.opportunity ? `${r.opportunity.number} · ${r.opportunity.title}` : '—'}</Td>
                <Td className="tabular-nums font-semibold whitespace-nowrap">{money(r.amount, r.currency)}</Td>
                <Td className="text-xs text-muted-foreground whitespace-nowrap">{r.start_date ? `${fmtDay(r.start_date)} → ${fmtDay(r.maturity_date)}` : '—'}</Td>
                <Td className="tabular-nums whitespace-nowrap">{r.expected_return != null ? money(r.expected_return, r.currency) : '—'}</Td>
                <Td className="tabular-nums whitespace-nowrap">{r.paid ? money(r.paid, r.currency) : '—'}</Td>
                <Td><Badge tone={investmentTone(r.state)} className="whitespace-nowrap">{INVESTMENT_LABELS[r.state]}</Badge></Td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><Td colSpan={8} className="text-center py-12 text-muted-foreground">No investments here yet. They appear when investors apply to an open opportunity.</Td></tr>}
          </Table>
        </Card>
      </>) : (<>
        <div className="flex justify-end mb-3">{oppSort}</div>
        <Card>
          <Table head={['Opportunity', 'Minimum', 'Tenor', 'Expected return', 'Open → close', 'Capacity', 'Committed', 'Status']}>
            {!opps && [0, 1].map(i => <tr key={i}>{[...Array(8)].map((_, j) => <Td key={j}><Bone className="h-4 w-16" /></Td>)}</tr>)}
            {oppRows?.map(o => (
              <tr key={o.id} className="hover:bg-muted/40">
                <Td className="min-w-[200px]"><Link to={`/staff360/investments/opportunities/${o.id}`} className="font-medium hover:text-accent">{o.title}</Link><span className="block text-xs text-muted-foreground">{o.number} · created {fmtDay(o.created_at)}</span></Td>
                <Td className="tabular-nums whitespace-nowrap">{money(o.min_amount, o.currency)}</Td>
                <Td className="whitespace-nowrap">{tenor(o.tenor_months)}</Td>
                <Td className="whitespace-nowrap">{o.expected_return_pct != null ? `${o.expected_return_pct}%` : '—'}</Td>
                <Td className="text-xs text-muted-foreground whitespace-nowrap">{fmtDay(o.opens_at)} → {o.closes_at ? fmtDay(o.closes_at) : 'open-ended'}</Td>
                <Td className="tabular-nums whitespace-nowrap">{o.capacity != null ? money(o.capacity, o.currency) : 'No limit'}</Td>
                <Td className="tabular-nums whitespace-nowrap">{money(o.committed, o.currency)}<span className="block text-xs text-muted-foreground">{o.investors} investor{o.investors === 1 ? '' : 's'}{o.pending ? ` · ${o.pending} to review` : ''}</span></Td>
                <Td><Badge tone={opportunityTone(o.state)} className="whitespace-nowrap">{OPPORTUNITY_LABELS[o.state]}</Badge></Td>
              </tr>
            ))}
            {opps?.length === 0 && <tr><Td colSpan={8} className="text-center py-12 text-muted-foreground">No opportunities yet. Create one, publish it, and investors can apply from the investment portal.</Td></tr>}
          </Table>
        </Card>
      </>)}
    </>
  )
}

/* ---------------------------------------------------- one opportunity --- */
const BLANK = { title: '', summary: '', description: '', currency: 'NGN', min_amount: '', capacity: '', tenor_months: 12, expected_return_pct: '', return_note: '', opens_at: '', closes_at: '' }
export function OpportunityForm() {
  const { id } = useParams(); const editing = id !== 'new'
  const nav = useNavigate(); const { can } = useAuth()
  const [o, setO] = useState(null); const [f, setF] = useState(BLANK)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [toast, toastEl] = useToast()
  const [stage, setStage] = useState(EMPTY_STAGE)      // files chosen before the opportunity exists
  const flash = useLocation().state?.flash
  useEffect(() => { if (flash) toast(flash, flash.includes('could not') ? 'error' : undefined) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const fill = x => setF({ title: x.title, summary: x.summary, description: x.description, currency: x.currency, min_amount: x.min_amount, capacity: x.capacity ?? '', tenor_months: x.tenor_months, expected_return_pct: x.expected_return_pct ?? '', return_note: x.return_note, opens_at: toLocalInput(x.opens_at), closes_at: toLocalInput(x.closes_at) })
  const load = useCallback(() => adminFetch(`/investment-opportunities/${id}`).then(x => { setO(x); fill(x) }).catch(e => setErr(e.message)), [id])
  useEffect(() => { if (editing) load() }, [editing, load])
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))
  const save = async (extra = {}) => {
    setBusy(true); setErr(null)
    const body = { ...f, capacity: f.capacity === '' ? null : f.capacity, expected_return_pct: f.expected_return_pct === '' ? null : f.expected_return_pct, opens_at: fromLocalInput(f.opens_at), closes_at: fromLocalInput(f.closes_at), ...extra }
    try {
      if (editing) { const x = await adminFetch(`/investment-opportunities/${id}`, { method: 'PATCH', body }); setO(p => ({ ...p, ...x })); fill(x); toast(extra.status ? OPPORTUNITY_LABELS[x.state] : 'Saved') }
      else {
        const x = await adminFetch('/investment-opportunities', { method: 'POST', body })
        const failed = await uploadStaged(x.id, stage)
        nav(`/staff360/investments/opportunities/${x.id}`, { replace: true, state: failed.length ? { flash: `Saved, but these files could not be uploaded: ${failed.join('; ')}` } : undefined })
      }
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const reloadFiles = () => adminFetch(`/investment-opportunities/${id}`).then(x => setO(p => ({ ...p, documents: x.documents, cover: x.cover }))).catch(e => toast(e.message, 'error'))
  const remove = async () => { if (!confirmDelete(o.number)) return; try { await adminFetch(`/investment-opportunities/${id}`, { method: 'DELETE' }); nav('/staff360/investments?tab=opportunities') } catch (x) { toast(x.message, 'error') } }
  const edit = can('investments', editing ? 'edit' : 'create')
  if (editing && !o) return err ? <Alert>{err}</Alert> : <Card className="p-6 space-y-4">{[...Array(6)].map((_, i) => <Bone key={i} className="h-11 w-full" />)}</Card>
  const state = o?.state
  return (
    <>
      <Back to="/staff360/investments?tab=opportunities">Investments</Back>
      <PageHeader eyebrow="Investment" title={editing ? o.number : 'New investment opportunity'} description={editing ? o.title : 'Describe the opportunity. Investors see it in the investment portal once you publish it.'} action={editing && <Badge tone={opportunityTone(state)}>{OPPORTUNITY_LABELS[state]}</Badge>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {editing && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"><Stat label="Funds committed" value={money(o.committed, o.currency)} /><Stat label="Active" value={money(o.active, o.currency)} /><Stat label="Still available" value={o.available != null ? money(o.available, o.currency) : 'No limit'} /><Stat label="Investors" value={o.investors} /></div>}
      <form onSubmit={e => { e.preventDefault(); save() }} className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card className="p-6 grid md:grid-cols-2 gap-5">
            <Field label="Title *" className="md:col-span-2"><Input required disabled={!edit} value={f.title} onChange={set('title')} placeholder="Soybean export cycle, Q1" /></Field>
            <Field label="Summary" hint="One or two lines for the list." className="md:col-span-2"><Textarea rows={2} disabled={!edit} maxLength={500} value={f.summary} onChange={set('summary')} /></Field>
            <Field label="Full description and terms" className="md:col-span-2" hint="What the money is used for, how returns are paid, the risks."><Textarea rows={8} disabled={!edit} value={f.description} onChange={set('description')} /></Field>
          </Card>
          <Card className="p-6 grid md:grid-cols-2 gap-5">
            <Field label="Minimum investment *"><div className="flex"><Input className="rounded-r-none w-20" maxLength={3} disabled={!edit} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value.toUpperCase() })} aria-label="Currency" /><Input className="rounded-l-none border-l-0" type="number" required min="0" step="0.01" disabled={!edit} value={f.min_amount} onChange={set('min_amount')} /></div></Field>
            <Field label="Investment capacity" hint="The most you will take in all. Empty = no limit."><Input type="number" min="0" step="0.01" disabled={!edit} value={f.capacity} onChange={set('capacity')} /></Field>
            <Field label="Tenor (months) *"><Input type="number" required min="1" step="1" disabled={!edit} value={f.tenor_months} onChange={set('tenor_months')} /></Field>
            <Field label="Expected return (%)" hint="Over the whole tenor. Empty = not stated."><Input type="number" min="0" step="0.001" disabled={!edit} value={f.expected_return_pct} onChange={set('expected_return_pct')} /></Field>
            <Field label="About the return" className="md:col-span-2" hint="e.g. Paid with the principal at maturity. Returns are expected, not guaranteed."><Textarea rows={2} disabled={!edit} value={f.return_note} onChange={set('return_note')} /></Field>
            <Field label="Opening date" hint="Empty: open as soon as it is published."><Input type="datetime-local" disabled={!edit} value={f.opens_at} onChange={set('opens_at')} /></Field>
            <Field label="Closing date" hint="Empty: open until you close it."><Input type="datetime-local" disabled={!edit} value={f.closes_at} onChange={set('closes_at')} /></Field>
          </Card>
          {editing && (<>
            <Card>
              <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Investments in this opportunity</h2></div>
              <ul className="divide-y divide-border">
                {o.investments?.map(r => <li key={r.id}><Link to={`/staff360/investments/${r.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-muted/40"><span className="font-semibold">{r.number}</span><span className="flex-1 truncate text-muted-foreground">{r.investor?.name} · {fmtMoment(r.created_at)}</span><span className="tabular-nums">{money(r.amount, r.currency)}</span><Badge tone={investmentTone(r.state)}>{INVESTMENT_LABELS[r.state]}</Badge></Link></li>)}
                {!o.investments?.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Nobody has applied yet.</li>}
              </ul>
            </Card>
          </>)}
          <OpportunityFiles oppId={editing ? o.id : null} cover={o?.cover} documents={o?.documents || []} onChanged={reloadFiles} stage={stage} setStage={setStage} disabled={!edit} />
        </div>
        <Card className="p-5 space-y-3 lg:sticky lg:top-24">
          {edit && <Button type="submit" variant={editing && state !== 'draft' ? 'accent' : 'outline'} className="w-full" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save as draft'}</Button>}
          {edit && (!editing || state === 'draft') && <Button type="button" variant="accent" className="w-full" disabled={busy} onClick={() => save({ status: 'published' })}><Megaphone className="w-4 h-4" />{editing ? 'Publish' : 'Save and publish'}</Button>}
          {edit && editing && ['open', 'upcoming'].includes(state) && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => window.confirm('Stop taking new investments in this opportunity?') && save({ status: 'closed' })}>Close to new investments</Button>}
          {edit && editing && ['closed', 'cancelled'].includes(o.status) && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => save({ status: 'published' })}>Open again</Button>}
          {edit && editing && !['cancelled', 'draft'].includes(o.status) && <Button type="button" variant="ghost" className="w-full text-destructive" disabled={busy} onClick={() => window.confirm('Cancel this opportunity? It leaves the investment portal; existing investments are kept.') && save({ status: 'cancelled' })}>Cancel opportunity</Button>}
          {editing && ['open', 'upcoming', 'closed'].includes(state) && <a href={`/investor/opportunities/${o.number}`} target="_blank" rel="noreferrer"><Button type="button" variant="outline" className="w-full"><ExternalLink className="w-4 h-4" />View in the portal</Button></a>}
          {editing && can('investments', 'delete') && <div className="pt-3 border-t border-border"><Button type="button" variant="ghost" className="h-8 px-2 text-xs text-destructive" onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete opportunity</Button></div>}
        </Card>
      </form>
      {toastEl}
    </>
  )
}

/* ------------------------------------------------------ one investment --- */
export function InvestmentDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { can } = useAuth()
  const approve = can('investments', 'approve')
  const [x, setX] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false)
  const [move, setMove] = useState(null)             // status being applied
  const [m, setM] = useState({ note: '', start_date: '', maturity_date: '', expected_return: '', notify: true })
  const [pay, setPay] = useState(null)               // payout being recorded
  const [notes, setNotes] = useState('')
  const [toast, toastEl] = useToast()
  const take = d => { setX(p => ({ ...d, documents: d.documents ?? p?.documents ?? [] })); setNotes(d.internal_notes || '') }
  const load = useCallback(() => adminFetch(`/investments/${id}`).then(take).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])
  const run = async (fn, ok) => { setBusy(true); try { const r = await fn(); if (r) take(r); toast(ok); return true } catch (e) { toast(e.message, 'error'); return false } finally { setBusy(false) } }
  const start = to => { setM({ note: '', start_date: x.start_date || new Date().toISOString().slice(0, 10), maturity_date: x.maturity_date || '', expected_return: x.expected_return ?? '', notify: true }); setMove(to) }
  const apply = async e => { e.preventDefault(); const body = { status: move, status_note: m.note, notify: m.notify, ...(move === 'active' ? { start_date: m.start_date, ...(m.maturity_date ? { maturity_date: m.maturity_date } : {}), ...(m.expected_return !== '' ? { expected_return: m.expected_return } : {}) } : {}) }; if (await run(() => adminFetch(`/investments/${id}`, { method: 'PATCH', body }), INVESTMENT_LABELS[move])) setMove(null) }
  const payout = async e => { e.preventDefault(); if (await run(() => adminFetch(`/investments/${id}/payouts`, { method: 'POST', body: pay }), 'Payout recorded — the investor has been told')) setPay(null) }
  const unpay = p => { if (window.confirm('Remove this payout record?')) run(() => adminFetch(`/investments/${id}/payouts/${p.id}`, { method: 'DELETE' }), 'Payout removed') }
  const proof = async () => { const d = x.documents?.find(v => v.id === x.proof_document_id); if (!d) return; try { await openDocument(d.id) } catch (e) { toast(e.message, 'error') } }
  const remove = async () => { if (!confirmDelete(x.number)) return; try { await adminFetch(`/investments/${id}`, { method: 'DELETE' }); nav('/staff360/investments') } catch (e) { toast(e.message, 'error') } }

  if (err) return <Alert>{err}</Alert>
  if (!x) return <Card className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Bone key={i} className="h-10 w-full" />)}</Card>
  const s = x.status, cur = x.currency
  const due = x.expected_return != null ? x.amount + x.expected_return : null
  const row = (l, v) => <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">{l}</dt><dd className="font-medium mt-0.5">{v || '—'}</dd></div>
  return (
    <>
      <Back to="/staff360/investments">Investments</Back>
      <PageHeader eyebrow={`Investment · applied ${fmtMoment(x.created_at)}`} title={x.number} description={<>{x.investor && <Link to={`/staff360/investors/${x.investor.id}`} className="text-accent font-medium">{x.investor.name}</Link>} in {x.opportunity && <Link to={`/staff360/investments/opportunities/${x.opportunity.id}`} className="text-accent font-medium">{x.opportunity.number} · {x.opportunity.title}</Link>}</>} action={<Badge tone={investmentTone(x.state)} className="text-sm px-3 py-1">{INVESTMENT_LABELS[x.state]}</Badge>} />
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card className="p-6">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
              {row('Invested amount', <span className="text-xl font-bold tabular-nums">{money(x.amount, cur)}</span>)}
              {row('Expected return', x.expected_return != null ? money(x.expected_return, cur) : x.opportunity?.expected_return_pct != null ? `${x.opportunity.expected_return_pct}% (set on approval)` : '')}
              {row('Due at maturity', due != null ? money(due, cur) : '')}
              {row('Start date', fmtDay(x.start_date))}{row('Maturity date', fmtDay(x.maturity_date))}{row('Paid out so far', money(x.paid, cur))}
              {x.investor && row('KYC', <Badge tone={kycTone(x.investor.kyc_status)}>{KYC_LABELS[x.investor.kyc_status]}</Badge>)}
              {x.note && <div className="col-span-2 sm:col-span-3">{row("Investor's note", <span className="whitespace-pre-wrap font-normal">{x.note}</span>)}</div>}
              {x.status_note && <div className="col-span-2 sm:col-span-3">{row('Our note to the investor', <span className="whitespace-pre-wrap font-normal">{x.status_note}</span>)}</div>}
            </dl>
            {x.proof_document_id && <Button type="button" variant="outline" className="mt-5 h-9" onClick={proof}><ExternalLink className="w-4 h-4" />Open the proof of payment</Button>}
          </Card>
          <Card>
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3"><h2 className="text-sm font-semibold flex items-center gap-2"><Banknote className="w-4 h-4 text-accent" />Payouts to the investor</h2>{approve && ['active', 'matured', 'paid_out'].includes(s) && <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setPay({ kind: 'return', amount: '', paid_on: new Date().toISOString().slice(0, 10), reference: '', note: '', notify: true })}><Plus className="w-3.5 h-3.5" />Record a payout</Button>}</div>
            <ul className="divide-y divide-border">
              {x.payouts?.map(p => <li key={p.id} className="px-5 py-3 text-sm flex flex-wrap items-center gap-3"><Badge tone={p.kind === 'principal' ? 'blue' : 'green'}>{p.kind}</Badge><span className="font-semibold tabular-nums">{money(p.amount, cur)}</span><span className="flex-1 text-muted-foreground">{fmtDay(p.paid_on)}{p.reference ? ` · ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}</span>{approve && <button type="button" onClick={() => unpay(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive" aria-label="Remove payout"><Trash2 className="w-3.5 h-3.5" /></button>}</li>)}
              {!x.payouts?.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing paid out yet.</li>}
            </ul>
          </Card>
        </div>
        <div className="space-y-5 lg:sticky lg:top-24">
          {approve && (
            <Card className="p-5 space-y-2">
              {s === 'pending' && <Button variant="accent" className="w-full" onClick={() => start('active')}><CheckCircle2 className="w-4 h-4" />Approve</Button>}
              {s === 'pending' && <Button variant="outline" className="w-full text-destructive" onClick={() => start('rejected')}><XCircle className="w-4 h-4" />Reject</Button>}
              {s === 'active' && <Button variant="accent" className="w-full" onClick={() => start('matured')}>Mark as matured</Button>}
              {['active', 'matured'].includes(s) && <Button variant="outline" className="w-full" onClick={() => start('paid_out')}>Mark as paid out</Button>}
              {s === 'active' && <Button variant="outline" className="w-full" onClick={() => start('active')}>Change dates or return</Button>}
              {['pending', 'active'].includes(s) && <Button variant="ghost" className="w-full text-destructive" onClick={() => start('cancelled')}>Cancel investment</Button>}
              {['rejected', 'cancelled'].includes(s) && <Button variant="outline" className="w-full" onClick={() => start('pending')}>Back to awaiting approval</Button>}
              {['paid_out', 'matured'].includes(s) && <p className="text-xs text-muted-foreground">Record each payment to the investor under Payouts.</p>}
            </Card>
          )}
          <Card className="p-5">
            <Field label="Internal notes" hint="Only your team sees these."><Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
            <Button variant="outline" className="mt-3 h-9 w-full" disabled={busy || notes === (x.internal_notes || '')} onClick={() => run(() => adminFetch(`/investments/${id}`, { method: 'PATCH', body: { internal_notes: notes } }), 'Notes saved')}>Save notes</Button>
            {can('investments', 'delete') && ['pending', 'rejected', 'cancelled'].includes(s) && <Button type="button" variant="ghost" className="mt-3 h-8 px-2 text-xs text-destructive" onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete</Button>}
          </Card>
        </div>
      </div>

      <Modal open={Boolean(move)} onClose={() => setMove(null)} title={move === 'active' ? (s === 'active' ? 'Dates and return' : 'Approve this investment') : move ? INVESTMENT_LABELS[move] : ''}
        footer={<><Button type="button" variant="outline" onClick={() => setMove(null)}>Cancel</Button><Button type="submit" form="inv-move" variant={['rejected', 'cancelled'].includes(move) ? 'danger' : 'accent'} disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</Button></>}>
        <form id="inv-move" onSubmit={apply} className="space-y-4">
          {move === 'active' && (<>
            {s === 'pending' && <Alert tone="info">Approve once the money has arrived. The investment becomes active and the investor sees its dates and expected return.</Alert>}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Start date"><Input type="date" required value={m.start_date} onChange={e => setM({ ...m, start_date: e.target.value })} /></Field>
              <Field label="Maturity date" hint={`Empty: start date + ${tenor(x.opportunity?.tenor_months || 12)}.`}><Input type="date" value={m.maturity_date} onChange={e => setM({ ...m, maturity_date: e.target.value })} /></Field>
              <Field label={`Expected return (${cur})`} hint={x.opportunity?.expected_return_pct != null ? `Empty: ${x.opportunity.expected_return_pct}% of the amount.` : 'Optional.'} className="sm:col-span-2"><Input type="number" min="0" step="0.01" value={m.expected_return} onChange={e => setM({ ...m, expected_return: e.target.value })} /></Field>
            </div>
          </>)}
          <Field label="Note to the investor" hint="Optional."><Textarea rows={3} value={m.note} onChange={e => setM({ ...m, note: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={m.notify} onChange={e => setM({ ...m, notify: e.target.checked })} />Tell the investor by email and in their portal</label>
        </form>
      </Modal>
      <Modal open={Boolean(pay)} onClose={() => setPay(null)} title="Record a payout" footer={<><Button type="button" variant="outline" onClick={() => setPay(null)}>Cancel</Button><Button type="submit" form="inv-pay" variant="accent" disabled={busy}>{busy ? 'Saving…' : 'Record payout'}</Button></>}>
        {pay && <form id="inv-pay" onSubmit={payout} className="grid sm:grid-cols-2 gap-4">
          <Field label="What is being paid"><Select value={pay.kind} onChange={e => setPay({ ...pay, kind: e.target.value })}><option value="return">Return</option><option value="principal">Principal</option></Select></Field>
          <Field label={`Amount (${cur}) *`}><Input type="number" required min="0.01" step="0.01" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} /></Field>
          <Field label="Paid on"><Input type="date" value={pay.paid_on} onChange={e => setPay({ ...pay, paid_on: e.target.value })} /></Field>
          <Field label="Reference"><Input value={pay.reference} onChange={e => setPay({ ...pay, reference: e.target.value })} /></Field>
          <Field label="Note" className="sm:col-span-2"><Input value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} /></Field>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={pay.notify} onChange={e => setPay({ ...pay, notify: e.target.checked })} />Tell the investor</label>
        </form>}
      </Modal>
      {toastEl}
    </>
  )
}

/* ----------------------------------------------------------- investors --- */
export function InvestorsAdmin() {
  const { can } = useAuth(); const nav = useNavigate()
  const [rows, setRows] = useState(null); const [err, setErr] = useState(null); const [q, setQ] = useState('')
  const [make, setMake] = useState(null); const [busy, setBusy] = useState(false); const [formErr, setFormErr] = useState(null)   // the "New investor" dialog
  const create = async e => {
    e.preventDefault(); setBusy(true); setFormErr(null)
    try {
      const { invite, ...body } = make
      const i = await adminFetch('/investors', { method: 'POST', body })
      let flash = 'Investor created.'
      if (invite) { try { const r = await adminFetch(`/investors/${i.id}/invite`, { method: 'POST', body: { email: body.email } }); flash = `Investor created. Invitation sent to ${r.email}.` } catch (x) { flash = `Investor created, but the invitation was not sent: ${x.message}` } }
      nav(`/staff360/investors/${i.id}`, { state: { flash } })
    } catch (x) { setFormErr(x.message) } finally { setBusy(false) }
  }
  useEffect(() => { adminFetch('/investors').then(setRows).catch(e => setErr(e.message)) }, [])
  const visible = useMemo(() => { const s = q.trim().toLowerCase(); return s && rows ? rows.filter(r => [r.name, r.email, r.phone].some(v => String(v || '').toLowerCase().includes(s))) : rows }, [rows, q])
  const [sorted, sortControl] = useSort(visible, { name: 'name', more: [{ key: 'invested', label: 'Invested, highest first', get: 'invested', desc: true }, { key: 'kyc', label: 'KYC status', get: 'kyc_status' }] })
  return (
    <>
      <PageHeader eyebrow="Investment" title="Investors" description="People and companies who registered in the investment portal, or whom you added." action={can('investments', 'create') && <Button variant="accent" onClick={() => { setFormErr(null); setMake({ name: '', email: '', phone: '', invite: true }) }}><Plus className="w-4 h-4" />New investor</Button>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" /><Input className="pl-10" placeholder="Search name, email or phone…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {sortControl}
      </div>
      <Card>
        <Table head={['Investor', 'Phone', 'Investments', 'Invested', 'KYC', 'Account', 'Registered']}>
          {!rows && [0, 1].map(i => <tr key={i}>{[...Array(7)].map((_, j) => <Td key={j}><Bone className="h-4 w-16" /></Td>)}</tr>)}
          {sorted?.map(r => (
            <tr key={r.id} className="hover:bg-muted/40">
              <Td><Link to={`/staff360/investors/${r.id}`} className="font-medium hover:text-accent">{r.name}</Link><span className="block text-xs text-muted-foreground">{r.email}</span></Td>
              <Td className="text-muted-foreground whitespace-nowrap">{r.phone || '—'}</Td>
              <Td className="tabular-nums">{r.investments}</Td>
              <Td className="tabular-nums whitespace-nowrap">{money(r.invested, 'NGN')}</Td>
              <Td><Badge tone={kycTone(r.kyc_status)} className="whitespace-nowrap">{KYC_LABELS[r.kyc_status]}</Badge></Td>
              <Td><Badge tone={r.status === 'blocked' ? 'red' : r.verified_at ? 'green' : 'amber'}>{r.status === 'blocked' ? 'blocked' : r.verified_at ? 'active' : 'email not confirmed'}</Badge></Td>
              <Td className="text-xs text-muted-foreground whitespace-nowrap">{fmtMoment(r.created_at)}</Td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><Td colSpan={7} className="text-center py-12 text-muted-foreground">No investors yet. Add one here, or they register themselves at /investor/register.</Td></tr>}
        </Table>
      </Card>
      <Modal open={Boolean(make)} onClose={() => setMake(null)} title="New investor"
        footer={<><Button type="button" variant="outline" onClick={() => setMake(null)}>Cancel</Button><Button type="submit" form="new-investor" variant="accent" disabled={busy}>{busy ? 'Saving…' : make?.invite ? 'Create and invite' : 'Create investor'}</Button></>}>
        {make && <form id="new-investor" onSubmit={create} className="space-y-4">
          {formErr && <Alert>{formErr}</Alert>}
          <Field label="Full name or company name *"><Input required value={make.name} onChange={e => setMake({ ...make, name: e.target.value })} /></Field>
          <Field label="Email address *" hint="They sign in with it, and the invitation goes there."><Input required type="email" value={make.email} onChange={e => setMake({ ...make, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={make.phone} onChange={e => setMake({ ...make, phone: e.target.value })} /></Field>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={make.invite} onChange={e => setMake({ ...make, invite: e.target.checked })} /><span>Email an invitation now, so they can create a login and password. They add their identification and bank details themselves after signing in.</span></label>
        </form>}
      </Modal>
    </>
  )
}

export function InvestorDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { can } = useAuth()
  const [x, setX] = useState(null); const [err, setErr] = useState(null); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()
  const flash = useLocation().state?.flash
  useEffect(() => { if (flash) toast(flash, flash.includes('not sent') ? 'error' : undefined) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(() => adminFetch(`/investors/${id}`).then(d => { setX(d); setNotes(d.notes || '') }).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])
  const patch = async (body, ok) => { setBusy(true); try { await adminFetch(`/investors/${id}`, { method: 'PATCH', body }); toast(ok); load() } catch (e) { toast(e.message, 'error') } finally { setBusy(false) } }
  const remove = async () => { if (!confirmDelete(x.name)) return; try { await adminFetch(`/investors/${id}`, { method: 'DELETE' }); nav('/staff360/investors') } catch (e) { toast(e.message, 'error') } }
  if (err) return <Alert>{err}</Alert>
  if (!x) return <Card className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Bone key={i} className="h-10 w-full" />)}</Card>
  const row = (l, v) => <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">{l}</dt><dd className="font-medium mt-0.5 break-words">{v || '—'}</dd></div>
  const edit = can('investments', 'edit'), approve = can('investments', 'approve')
  return (
    <>
      <Back to="/staff360/investors">Investors</Back>
      <PageHeader eyebrow={`Investor · registered ${fmtMoment(x.created_at)}`} title={x.name} description={x.email} action={<div className="flex flex-wrap gap-2"><Badge tone={kycTone(x.kyc_status)}>{KYC_LABELS[x.kyc_status]}</Badge><Badge tone={x.status === 'blocked' ? 'red' : x.verified_at ? 'green' : 'amber'}>{x.status === 'blocked' ? 'blocked' : x.verified_at ? 'email confirmed' : 'email not confirmed'}</Badge></div>} />
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card className="p-6"><dl className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
            {x.avatar_url && <div><img src={x.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border border-border" /></div>}
            {row('Title', x.title)}{row('First name', x.first_name)}{row('Middle name', x.middle_name)}{row('Last name', x.last_name)}{row('Nickname', x.nickname)}{row('Date of birth', x.date_of_birth && fmtDay(x.date_of_birth))}{row('Nationality', x.nationality)}{row('State of origin', x.state_of_origin)}{row('LGA', x.lga)}
            {row('Phone', x.phone)}{row('Alternative phone', x.alt_phone)}{row('Address', x.address)}{row('Identification', [x.id_type, x.id_number].filter(Boolean).join(' · '))}
            {row('Bank', x.bank_name)}{row('Account name', x.bank_account_name)}{row('Account number', x.bank_account_number)}
          </dl></Card>
          <Card>
            <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Investments</h2></div>
            <ul className="divide-y divide-border">
              {x.investments?.map(r => <li key={r.id}><Link to={`/staff360/investments/${r.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-muted/40"><span className="font-semibold">{r.number}</span><span className="flex-1 truncate text-muted-foreground">{r.opportunity?.title} · {fmtMoment(r.created_at)}</span><span className="tabular-nums">{money(r.amount, r.currency)}</span><Badge tone={investmentTone(r.state)}>{INVESTMENT_LABELS[r.state]}</Badge></Link></li>)}
              {!x.investments?.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No investments yet.</li>}
            </ul>
          </Card>
          {x.change_requests?.length > 0 && <div><h2 className="font-semibold mb-3">Profile change requests</h2><ChangeRequestsPanel investorId={x.id} /></div>}
          <div><h2 className="font-semibold mb-3">Identification and other documents</h2><DocumentsPanel scope={{ investor_id: x.id }} note="KYC documents uploaded by the investor or by your team" /></div>
        </div>
        <div className="space-y-5 lg:sticky lg:top-24">
          {approve && <Card className="p-5 space-y-2">
            <h2 className="text-sm font-semibold mb-1">Identity check (KYC)</h2>
            {x.kyc_status !== 'verified' && <Button variant="accent" className="w-full" disabled={busy} onClick={() => patch({ kyc_status: 'verified' }, 'KYC verified — the investor has been told')}><CheckCircle2 className="w-4 h-4" />Mark as verified</Button>}
            {x.kyc_status !== 'rejected' && <Button variant="outline" className="w-full text-destructive" disabled={busy} onClick={() => window.confirm('Reject this identification? The investor is told to check their details.') && patch({ kyc_status: 'rejected' }, 'KYC rejected')}><XCircle className="w-4 h-4" />Reject</Button>}
            {x.kyc_status !== 'pending' && <Button variant="ghost" className="w-full" disabled={busy} onClick={() => patch({ kyc_status: 'pending' }, 'KYC back to pending')}>Back to pending</Button>}
          </Card>}
          {edit && <InviteBox who="This investor" state={x.user_id ? (x.verified_at ? 'active' : 'unconfirmed') : 'none'} email={x.email} endpoint={`/investors/${x.id}/invite`} onDone={load} />}
          {edit && <Card className="p-5">
            <Field label="Internal notes" hint="Only your team sees these."><Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
            <Button variant="outline" className="mt-3 h-9 w-full" disabled={busy || notes === (x.notes || '')} onClick={() => patch({ notes }, 'Notes saved')}>Save notes</Button>
            <Button variant={x.status === 'blocked' ? 'accent' : 'outline'} className="mt-3 h-9 w-full" disabled={busy} onClick={() => patch({ status: x.status === 'blocked' ? 'active' : 'blocked' }, x.status === 'blocked' ? 'Account unblocked' : 'Account blocked')}>{x.status === 'blocked' ? 'Unblock account' : 'Block account'}</Button>
            {can('investments', 'delete') && <Button type="button" variant="ghost" className="mt-3 h-8 px-2 text-xs text-destructive" onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete investor</Button>}
          </Card>}
        </div>
      </div>
      {toastEl}
    </>
  )
}
