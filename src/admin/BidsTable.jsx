/*
 * Bids side by side: filter by status, price, quantity, location, supplier
 * and whether the payment terms were accepted; order by price, quantity,
 * delivery or date; tick a few to compare them in detail; move a bid along
 * its statuses. With `tender` it is the bids of one opportunity (and the
 * group actions apply to it); without, every bid there is.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownUp, CheckCircle2, FileText, GitCompare, Mail, MessageCircleQuestion, Search, SlidersHorizontal, XCircle } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, Table, Td, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import BidStatusDialog from './BidStatusDialog'
import { BID_LABELS, BID_STATUSES, bidTone, fmtDay, money, pct, perUnit, qty } from '../lib/procurement'

const SORTS = [['price', 'Price, lowest first'], ['quantity', 'Quantity, largest first'], ['total', 'Total value'], ['delivery', 'Delivery date, soonest first'], ['supplier', 'Supplier, A–Z'], ['date', 'Newest first']]
const EMPTY = { status: 'all', q: '', min_price: '', max_price: '', min_quantity: '', location: '', accepts_terms: '', sort: 'price' }
const versus = b => (b.vs_asking == null ? null : b.vs_asking === 0 ? { text: 'at asking', cls: 'text-muted-foreground' } : b.vs_asking < 0 ? { text: `${pct(b.vs_asking_pct)} below`, cls: 'text-emerald-600 dark:text-emerald-400' } : { text: `${pct(b.vs_asking_pct)} above`, cls: 'text-destructive' })

export default function BidsTable({ tender = null, supplierId = null, onChanged }) {
  const [f, setF] = useState({ ...EMPTY, sort: tender ? 'price' : 'date' })
  const [more, setMore] = useState(false)
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [dialog, setDialog] = useState(null)         // { bid, to }
  const [compare, setCompare] = useState(false)
  const [group, setGroup] = useState(null)           // 'message' | 'closeout'
  const [toast, toastEl] = useToast()

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (tender) p.set('tender_id', tender.id)
    if (supplierId) p.set('supplier_id', supplierId)
    for (const [k, v] of Object.entries(f)) if (v !== '' && v != null && !(k === 'status' && v === 'all')) p.set(k, v)
    return p.toString()
  }, [f, tender, supplierId])
  const load = useCallback(() => adminFetch(`/bids?${query}`).then(r => { setRows(r); setErr(null) }).catch(e => setErr(e.message)), [query])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  const set = patch => setF(x => ({ ...x, ...patch }))
  const toggle = id => setPicked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.size < 4 && n.add(id); return n })
  const changed = () => { load(); onChanged?.() }
  const chosen = (rows || []).filter(b => picked.has(b.id))
  const filtered = Object.entries(f).some(([k, v]) => !['sort', 'status'].includes(k) && v !== '')
  const counts = tender?.counts || {}
  const live = (counts.open || 0) + (counts.under_review || 0) + (counts.shortlisted || 0)

  return (
    <div className="space-y-4">
      {err && <Alert>{err}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-10 h-10" placeholder="Search supplier, contact, location…" value={f.q} onChange={e => set({ q: e.target.value })} />
        </div>
        {/* the control's own width is 100%, so each select sits in a box that sets it */}
        <div className="w-44"><Select className="h-10" value={f.status} onChange={e => set({ status: e.target.value })} aria-label="Status">
          <option value="all">All statuses</option><option value="live">Still in play</option>
          {BID_STATUSES.map(s => <option key={s} value={s}>{BID_LABELS[s]}{counts[s] ? ` (${counts[s]})` : ''}</option>)}
        </Select></div>
        <div className="w-60 flex items-center gap-1.5 text-muted-foreground"><ArrowDownUp className="w-3.5 h-3.5 shrink-0" /><Select className="h-10" value={f.sort} onChange={e => set({ sort: e.target.value })} aria-label="Order by">{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></div>
        <Button type="button" variant={more || filtered ? 'primary' : 'outline'} className="h-10" onClick={() => setMore(m => !m)}><SlidersHorizontal className="w-4 h-4" />Filters</Button>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button type="button" variant="outline" className="h-10" disabled={chosen.length < 2} title="Tick two to four bids to compare them" onClick={() => setCompare(true)}><GitCompare className="w-4 h-4" />Compare{chosen.length ? ` (${chosen.length})` : ''}</Button>
          {tender && <Button type="button" variant="outline" className="h-10" disabled={!counts.shortlisted} title={counts.shortlisted ? undefined : 'No shortlisted bids yet'} onClick={() => setGroup('message')}><Mail className="w-4 h-4" />Email shortlisted</Button>}
          {tender && <Button type="button" variant="outline" className="h-10" disabled={!live} title={live ? undefined : 'No bids still in play'} onClick={() => setGroup('closeout')}><XCircle className="w-4 h-4" />Close out</Button>}
        </div>
      </div>
      {more && (
        <Card className="p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-fade-up">
          <Field label="Price from"><Input type="number" min="0" step="0.01" value={f.min_price} onChange={e => set({ min_price: e.target.value })} /></Field>
          <Field label="Price up to"><Input type="number" min="0" step="0.01" value={f.max_price} onChange={e => set({ max_price: e.target.value })} placeholder={tender?.asking_price != null ? String(tender.asking_price) : ''} /></Field>
          <Field label="Quantity at least"><Input type="number" min="0" step="0.001" value={f.min_quantity} onChange={e => set({ min_quantity: e.target.value })} /></Field>
          <Field label="Commodity location"><Input value={f.location} onChange={e => set({ location: e.target.value })} placeholder="e.g. Kano" /></Field>
          <Field label="Payment terms"><Select value={f.accepts_terms} onChange={e => set({ accepts_terms: e.target.value })}><option value="">Any answer</option><option value="true">Accepted</option><option value="false">Not accepted</option></Select></Field>
          {filtered && <button type="button" className="text-xs font-semibold text-accent text-left" onClick={() => setF(x => ({ ...EMPTY, status: x.status, sort: x.sort }))}>Clear filters</button>}
        </Card>
      )}

      <Card className="animate-fade-up">
        <Table head={['', 'Supplier', ...(tender ? [] : ['Opportunity']), 'Quantity', 'Price', 'Total', 'Location', 'Delivery', 'Terms', 'Status', '']}>
          {!rows && [0, 1, 2].map(i => <tr key={i}>{[...Array(tender ? 10 : 11)].map((_, j) => <Td key={j}><Bone className="h-4 w-16" /></Td>)}</tr>)}
          {rows?.map(b => { const v = versus(b); return (
            <tr key={b.id} className={`hover:bg-muted/40 ${b.status === 'withdrawn' ? 'opacity-60' : ''}`}>
              <Td className="w-8"><input type="checkbox" checked={picked.has(b.id)} onChange={() => toggle(b.id)} aria-label={`Compare ${b.company_name}`} /></Td>
              <Td className="min-w-[190px]">
                <Link to={`/staff360/bids/${b.id}`} className="font-medium hover:text-accent">{b.company_name}</Link>
                <span className="block text-xs text-muted-foreground">{b.contact_person}{b.documents > 0 && <> · <FileText className="inline w-3 h-3 -mt-0.5" /> {b.documents}</>}{b.requests_open > 0 && <> · <MessageCircleQuestion className="inline w-3 h-3 -mt-0.5" /> awaiting answer</>}</span>
              </Td>
              {!tender && <Td>{b.tender ? <Link to={`/staff360/tenders/${b.tender.id}`} className="hover:text-accent"><span className="font-medium">{b.tender.number}</span><span className="block text-xs text-muted-foreground max-w-[200px] truncate">{b.tender.title}</span></Link> : '—'}</Td>}
              <Td className="whitespace-nowrap tabular-nums">{qty(b.quantity, b.unit)}{b.covers_pct != null && <span className="block text-xs text-muted-foreground">{b.covers_pct}% of what we need</span>}</Td>
              <Td className="whitespace-nowrap tabular-nums font-medium">{perUnit(b.price, b.currency, b.unit)}{v && <span className={`block text-xs font-normal ${v.cls}`}>{v.text}</span>}</Td>
              <Td className="whitespace-nowrap tabular-nums">{money(b.total, b.currency)}</Td>
              <Td className="text-muted-foreground max-w-[140px] truncate">{b.commodity_location}</Td>
              <Td className="text-muted-foreground whitespace-nowrap">{fmtDay(b.delivery_date)}</Td>
              <Td className="whitespace-nowrap">{b.accepts_terms ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Accepted</span> : <span className="inline-flex items-center gap-1 text-xs text-destructive" title={b.terms_note || undefined}><XCircle className="w-3.5 h-3.5" />Not accepted</span>}</Td>
              <Td><Badge tone={bidTone(b.status)} className="whitespace-nowrap">{BID_LABELS[b.status]}</Badge></Td>
              <Td className="text-right whitespace-nowrap">
                {b.status !== 'withdrawn' && <button type="button" onClick={() => setDialog({ bid: b })} className="text-xs font-semibold text-accent mr-3">Status</button>}
                <Link to={`/staff360/bids/${b.id}`} className="text-xs font-semibold text-accent">Open →</Link>
              </Td>
            </tr>
          ) })}
          {rows?.length === 0 && <tr><Td colSpan={tender ? 10 : 11} className="text-center py-12 text-muted-foreground">{filtered || f.status !== 'all' ? 'No bid matches these filters.' : tender ? 'No bids yet. They appear here as suppliers submit them.' : 'No bids yet.'}</Td></tr>}
        </Table>
      </Card>

      <BidStatusDialog bid={dialog?.bid || null} to={dialog?.to || null} onClose={() => setDialog(null)} onSaved={r => { toast(`${r.company_name}: ${BID_LABELS[r.status]}${r.notified ? ' — supplier emailed' : ''}`); changed() }} />
      <CompareDialog open={compare} onClose={() => setCompare(false)} bids={chosen} onStatus={(bid, to) => { setCompare(false); setDialog({ bid, to }) }} />
      {tender && <GroupMessage open={group === 'message'} onClose={() => setGroup(null)} tender={tender} count={counts.shortlisted || 0} onDone={r => { toast(`${r.sent.length} email${r.sent.length === 1 ? '' : 's'} sent${r.failed.length ? `, ${r.failed.length} failed` : ''}`, r.failed.length ? 'error' : 'ok'); changed() }} />}
      {tender && <CloseOut open={group === 'closeout'} onClose={() => setGroup(null)} tender={tender} count={live} onDone={r => { toast(`${r.changed} bid${r.changed === 1 ? '' : 's'} marked not selected${r.notified ? `, ${r.notified} supplier${r.notified === 1 ? '' : 's'} emailed` : ''}`); changed() }} />}
      {toastEl}
    </div>
  )
}

/** Two to four bids in columns, the best value of each row marked. */
function CompareDialog({ open, onClose, bids, onStatus }) {
  if (!open || bids.length < 2) return null
  const best = (get, lowest = true) => { const vals = bids.map(get).filter(v => v != null); return vals.length ? (lowest ? Math.min(...vals) : Math.max(...vals)) : null }
  const lowPrice = best(b => b.price), bigQty = best(b => b.quantity, false), soon = bids.map(b => b.delivery_date).filter(Boolean).sort()[0]
  const mark = on => (on ? 'font-semibold text-emerald-600 dark:text-emerald-400' : '')
  const rows = [
    ['Status', b => <Badge tone={bidTone(b.status)}>{BID_LABELS[b.status]}</Badge>],
    ['Contact', b => <>{b.contact_person}<span className="block text-xs text-muted-foreground break-all">{b.email}</span><span className="block text-xs text-muted-foreground">{b.phone}</span></>],
    ['Quantity', b => <span className={mark(b.quantity === bigQty)}>{qty(b.quantity, b.unit)}{b.covers_pct != null && <span className="block text-xs font-normal text-muted-foreground">{b.covers_pct}% of what we need</span>}</span>],
    ['Price', b => { const v = versus(b); return <span className={mark(b.price === lowPrice)}>{perUnit(b.price, b.currency, b.unit)}{v && <span className={`block text-xs font-normal ${v.cls}`}>{v.text}{b.vs_asking ? ` (${money(Math.abs(b.vs_asking), b.currency)})` : ''}</span>}</span> }],
    ['Total bid value', b => money(b.total, b.currency)],
    ['Commodity location', b => b.commodity_location],
    ['Expected delivery', b => <span className={mark(b.delivery_date === soon)}>{fmtDay(b.delivery_date)}</span>],
    ['Payment terms', b => (b.accepts_terms ? 'Accepted' : <span className="text-destructive">Not accepted{b.terms_note && <span className="block text-xs text-muted-foreground">{b.terms_note}</span>}</span>)],
    ['Documents', b => (b.documents ? `${b.documents} attached` : 'none')],
    ['Their note', b => b.note || '—'],
  ]
  return (
    <Modal open onClose={onClose} title={`Compare ${bids.length} bids`} wide>
      {bids[0].tender?.asking_price != null && <p className="text-sm text-muted-foreground mb-4">{bids[0].tender.number} · we asked {perUnit(bids[0].tender.asking_price, bids[0].tender.currency, bids[0].tender.unit)} for {qty(bids[0].tender.quantity, bids[0].tender.unit)}. The best figure in each row is in green.</p>}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead><tr className="text-left align-bottom"><th className="px-2 py-2 w-36" />{bids.map(b => <th key={b.id} className="px-2 py-2 font-semibold min-w-[170px]"><Link to={`/staff360/bids/${b.id}`} className="hover:text-accent">{b.company_name}</Link></th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map(([label, cell]) => <tr key={label} className="align-top"><th scope="row" className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</th>{bids.map(b => <td key={b.id} className="px-2 py-2.5">{cell(b)}</td>)}</tr>)}
            <tr><th className="px-2 py-3" />{bids.map(b => <td key={b.id} className="px-2 py-3"><div className="flex flex-wrap gap-1.5">{b.status !== 'withdrawn' && <><Button type="button" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => onStatus(b, 'shortlisted')}>Shortlist</Button><Button type="button" variant="accent" className="h-8 px-2.5 text-xs" onClick={() => onStatus(b, 'awarded')}>Award</Button></>}</div></td>)}</tr>
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

/** One email, sent to every shortlisted supplier separately and addressed by name. */
function GroupMessage({ open, onClose, tender, count, onDone }) {
  const [subject, setSubject] = useState(''); const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  useEffect(() => { if (open) { setSubject(`Your bid for ${tender.title} ({{tender_number}})`); setBody('Dear {{name}},\n\n\n\nKind regards,'); setErr(null) } }, [open, tender])
  const send = async e => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { const r = await adminFetch(`/tenders/${tender.id}/message`, { method: 'POST', body: { statuses: ['shortlisted'], subject, body } }); onDone(r); onClose() }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Email the shortlisted suppliers" wide
      footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="group-message" variant="accent" disabled={busy}><Mail className="w-4 h-4" />{busy ? 'Sending…' : `Send to ${count} supplier${count === 1 ? '' : 's'}`}</Button></>}>
      <form id="group-message" onSubmit={send} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <Alert tone="info">Each shortlisted supplier gets their own email and their own conversation in the procurement inbox; nobody sees the other recipients. <code>{'{{name}}'}</code>, <code>{'{{supplier_name}}'}</code>, <code>{'{{tender_number}}'}</code> and <code>{'{{tender_title}}'}</code> are filled in for each of them.</Alert>
        <Field label="Subject"><Input required value={subject} onChange={e => setSubject(e.target.value)} /></Field>
        <Field label="Message"><Textarea rows={9} required value={body} onChange={e => setBody(e.target.value)} /></Field>
      </form>
    </Modal>
  )
}

/** Every bid still in play becomes "not selected". */
function CloseOut({ open, onClose, tender, count, onDone }) {
  const [note, setNote] = useState(''); const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  useEffect(() => { if (open) { setNote(''); setNotify(true); setErr(null) } }, [open])
  const run = async e => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { const r = await adminFetch(`/tenders/${tender.id}/close-out`, { method: 'POST', body: { note, notify } }); onDone(r); onClose() }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Close out the remaining bids"
      footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="close-out" variant="danger" disabled={busy}>{busy ? 'Working…' : `Mark ${count} bid${count === 1 ? '' : 's'} not selected`}</Button></>}>
      <form id="close-out" onSubmit={run} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <p className="text-sm text-muted-foreground">The {count} bid{count === 1 ? '' : 's'} on {tender.number} that {count === 1 ? 'is' : 'are'} still open, under review or shortlisted will be marked <b>not selected</b>. Awarded and withdrawn bids are left as they are, and the opportunity stops taking bids.</p>
        <Field label="Note to the suppliers" hint="Optional. Shown with the status and in the email."><Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Thank you for bidding. We hope to work with you on a future opportunity." /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />Email each supplier</label>
      </form>
    </Modal>
  )
}
