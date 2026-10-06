/*
 * The approval workflow in the panel: status badges, the banner on a record
 * that is waiting, the amendment history, and the review queue.
 */
import { useState } from 'react'
import { CheckCircle2, Clock, History, XCircle } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Field, Modal, Textarea } from './ui'
import { fmtDateTime, fmtMoney } from './format'

const MODULE = { quote: 'invoices', purchase_order: 'purchase_orders', client: 'clients', supplier: 'suppliers' }
export const TYPE_NAME = { quote: 'Invoice', purchase_order: 'Order', client: 'Client', supplier: 'Supplier' }
const TONE = { pending: 'amber', approved: 'green', rejected: 'red', cancelled: 'muted' }
const LABEL = { pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', cancelled: 'Withdrawn' }

/** Only shows when there is something to say: an official record needs no badge. */
export const ApprovalBadge = ({ approval, className = '' }) => (approval && approval !== 'approved' ? <Badge tone={TONE[approval]} className={`whitespace-nowrap ${className}`}>{LABEL[approval]}</Badge> : null)

/** Approve or reject with a reason; shared by the banner and the queue. */
export function useDecision(onDone) {
  const [ask, setAsk] = useState(null)       // { url, decision }
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  const start = (url, decision) => { setNote(''); setErr(null); setAsk({ url, decision }) }
  const send = async e => {
    e?.preventDefault(); setBusy(true); setErr(null)
    try { await adminFetch(ask.url, { method: 'POST', body: { decision: ask.decision, note } }); setAsk(null); onDone?.(ask.decision) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const reject = ask?.decision === 'rejected'
  const dialog = (
    <Modal open={Boolean(ask)} onClose={() => setAsk(null)} title={reject ? 'Reject' : 'Approve'}
      footer={<><Button type="button" variant="outline" onClick={() => setAsk(null)}>Cancel</Button><Button type="submit" form="decision-form" variant={reject ? 'danger' : 'accent'} disabled={busy || (reject && !note.trim())}>{busy ? 'Saving…' : reject ? 'Reject' : 'Approve'}</Button></>}>
      <form id="decision-form" onSubmit={send} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <Field label={reject ? 'Reason *' : 'Note (optional)'} hint={reject ? 'The person who submitted it will see this.' : undefined}><Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} autoFocus /></Field>
      </form>
    </Modal>
  )
  return [start, dialog]
}

/** Shown on a record that is not official yet. */
export function ApprovalBanner({ type, doc, onChanged }) {
  const { me, can } = useAuth()
  const [start, dialog] = useDecision(onChanged)
  if (!doc || !doc.approval || doc.approval === 'approved') return null
  const mayDecide = can(MODULE[type], 'approve') && doc.submitted_by !== me?.id
  const rejected = doc.approval === 'rejected'
  return (
    <div className={`mb-5 rounded-2xl border px-5 py-4 text-sm flex flex-wrap items-center gap-3 ${rejected ? 'border-destructive/30 bg-destructive/5' : 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10'}`}>
      {rejected ? <XCircle className="w-5 h-5 text-destructive shrink-0" /> : <Clock className="w-5 h-5 text-amber-600 shrink-0" />}
      <div className="flex-1 min-w-[14rem]">
        <p className="font-semibold">{rejected ? `This ${TYPE_NAME[type].toLowerCase()} was rejected` : 'Pending approval'}</p>
        <p className="text-muted-foreground">{rejected ? (doc.approval_note || 'No reason was given.') + ' Edit it and it goes back for review.' : `An admin has to approve this ${TYPE_NAME[type].toLowerCase()} before it is official${type === 'quote' || type === 'purchase_order' ? ' and can be sent' : type === 'client' || type === 'supplier' ? ' and can be invited to the portal' : ''}.`}</p>
      </div>
      {!rejected && mayDecide && <div className="flex gap-2"><Button type="button" variant="accent" className="h-9" onClick={() => start(`/approvals/${type}/${doc.id}/decision`, 'approved')}><CheckCircle2 className="w-4 h-4" />Approve</Button><Button type="button" variant="outline" className="h-9 text-destructive" onClick={() => start(`/approvals/${type}/${doc.id}/decision`, 'rejected')}>Reject</Button></div>}
      {!rejected && !mayDecide && can(MODULE[type], 'approve') && <span className="text-xs text-muted-foreground">You submitted this; another admin must approve it.</span>}
      {dialog}
    </div>
  )
}

/* ---------------------------------------------------------- amendments --- */
const FIELD = { items: 'Line items', discount: 'Discount', tax_rate: 'Tax rate', currency: 'Currency', client_id: 'Client', client_name: 'Prepared for', client_email: 'Email', title: 'Title', number: 'Number', valid_until: 'Valid until', notes: 'Notes', terms: 'Terms', data: 'Details',
  supplier_id: 'Supplier', supplier_name: 'Supplier', supplier_email: 'Supplier email', supplier_address: 'Supplier address', delivery_location: 'Delivery location', delivery_date: 'Delivery date', payment_terms: 'Payment terms', kind: 'Type' }
const show = (k, v, cur) => {
  if (v == null || v === '') return '—'
  if (k === 'items' && Array.isArray(v)) return v.map(i => `${i.description} · ${i.quantity}${i.unit ? ` ${i.unit}` : ''} × ${fmtMoney(i.unit_price, cur)}`).join('\n') || '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
/** What an amendment changes: each field, as it was and as it would become. */
export function AmendmentDiff({ a, cur = 'USD' }) {
  const keys = Object.keys(a.proposed || {})
  return (
    <div className="space-y-3">
      {keys.map(k => (
        <div key={k} className="grid sm:grid-cols-2 gap-2 text-sm">
          <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{FIELD[k] || k}</p>
          <pre className="whitespace-pre-wrap font-sans rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2"><span className="block text-[10px] uppercase text-muted-foreground mb-0.5">Original</span>{show(k, a.original?.[k], cur)}</pre>
          <pre className="whitespace-pre-wrap font-sans rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2"><span className="block text-[10px] uppercase text-muted-foreground mb-0.5">Proposed</span>{show(k, a.proposed[k], cur)}</pre>
        </div>
      ))}
    </div>
  )
}

/** The audit trail of changes to an invoice or order, newest first. */
export function AmendmentHistory({ amendments, cur, type, onChanged }) {
  const { me, can } = useAuth()
  const [start, dialog] = useDecision(onChanged)
  const [open, setOpen] = useState(null)
  if (!amendments?.length) return null
  const cancel = async a => { if (window.confirm('Withdraw this amendment?')) { await adminFetch(`/amendments/${a.id}/cancel`, { method: 'POST' }).catch(() => {}); onChanged?.() } }
  return (
    <Card>
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2"><History className="w-4 h-4 text-accent" /><h2 className="text-sm font-semibold">Amendments</h2></div>
      <ul className="divide-y divide-border">
        {amendments.map(a => (
          <li key={a.id} className="px-5 py-3 text-sm">
            <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="w-full flex flex-wrap items-center gap-2 text-left">
              <Badge tone={a.status === 'pending' ? 'amber' : TONE[a.status]}>{a.status === 'pending' ? 'Pending amendment approval' : a.status === 'approved' ? 'Amended' : LABEL[a.status]}</Badge>
              <span className="flex-1 min-w-[10rem] text-muted-foreground">{a.initiated_name || 'Someone'} · {fmtDateTime(a.created_at)}</span>
              <span className="text-xs text-muted-foreground">{Object.keys(a.proposed || {}).map(k => FIELD[k] || k).join(', ')}</span>
            </button>
            {open === a.id && (
              <div className="mt-3 space-y-3">
                {a.reason && <p className="text-xs"><span className="font-semibold">Reason: </span>{a.reason}</p>}
                <AmendmentDiff a={a} cur={cur} />
                {a.reviewed_at && <p className="text-xs text-muted-foreground">{a.status === 'approved' ? 'Approved' : a.status === 'rejected' ? 'Rejected' : 'Closed'} by {a.reviewed_name || 'an admin'} on {fmtDateTime(a.reviewed_at)}{a.review_note ? ` — ${a.review_note}` : ''}</p>}
                {a.status === 'pending' && <div className="flex gap-2">
                  {can(type === 'quote' ? 'invoices' : 'purchase_orders', 'approve') && a.initiated_by !== me?.id && <><Button type="button" variant="accent" className="h-8 px-3 text-xs" onClick={() => start(`/amendments/${a.id}/decision`, 'approved')}>Approve</Button><Button type="button" variant="outline" className="h-8 px-3 text-xs text-destructive" onClick={() => start(`/amendments/${a.id}/decision`, 'rejected')}>Reject</Button></>}
                  {a.initiated_by === me?.id && <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => cancel(a)}>Withdraw</Button>}
                </div>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {dialog}
    </Card>
  )
}

/** Invoices and orders for people who only view them: what is being supplied, never what it costs. */
export function ReadOnlyItems({ items }) {
  return (
    <Card>
      <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Items</h2><p className="text-xs text-muted-foreground mt-0.5">Prices and totals are not shown for your role.</p></div>
      <ul className="divide-y divide-border">{(items || []).map((it, i) => <li key={i} className="px-5 py-3 text-sm flex flex-wrap gap-2"><span className="flex-1 min-w-[12rem] font-medium">{it.description}</span><span className="tabular-nums text-muted-foreground">{it.quantity}{it.unit ? ` ${it.unit}` : ''}</span></li>)}</ul>
    </Card>
  )
}
