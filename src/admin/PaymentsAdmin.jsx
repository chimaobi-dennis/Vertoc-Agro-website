/*
 * Payments: what clients say they paid (with their receipt, from the client
 * portal) and what the team records itself. Confirming or rejecting one is
 * an approval; the client is told either way.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, FileText, Plus, Search, Trash2, XCircle } from 'lucide-react'
import { openFile } from '../lib/openFile'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Td, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { useSort } from '../lib/sort'
import { fmtDay, fmtMoment, money } from '../lib/procurement'

export const PAYMENT_LABELS = { submitted: 'Awaiting confirmation', confirmed: 'Confirmed', rejected: 'Rejected' }
export const paymentTone = s => ({ submitted: 'amber', confirmed: 'green', rejected: 'red' })[s] || 'muted'
const FILTERS = ['all', 'submitted', 'confirmed', 'rejected']
const today = () => new Date().toISOString().slice(0, 10)

/** The list; with clientId or quoteId it is the payments of one client or one invoice. */
export function PaymentsPanel({ clientId = null, quoteId = null, status = 'all', q = '' }) {
  const { can } = useAuth()
  const [rows, setRows] = useState(null); const [err, setErr] = useState(null)
  const [review, setReview] = useState(null)       // { payment, to }
  const [adding, setAdding] = useState(false)
  const [toast, toastEl] = useToast()
  const load = useCallback(() => adminFetch(`/payments?status=${status}${clientId ? `&client_id=${clientId}` : ''}${quoteId ? `&quote_id=${quoteId}` : ''}`).then(r => { setRows(r); setErr(null) }).catch(e => setErr(e.message)), [status, clientId, quoteId])
  useEffect(() => { setRows(null); load() }, [load])
  const visible = useMemo(() => { const s = q.trim().toLowerCase(); return s && rows ? rows.filter(r => [r.client_name, r.quote?.number, r.reference, r.method].some(v => String(v || '').toLowerCase().includes(s))) : rows }, [rows, q])
  const [sorted, sortControl] = useSort(visible, { name: 'client_name', more: [
    { key: 'paid', label: 'Payment date, latest first', get: 'paid_on', desc: true }, { key: 'paid_asc', label: 'Payment date, earliest first', get: 'paid_on' },
    { key: 'amount', label: 'Amount, highest first', get: 'amount', desc: true }, { key: 'status', label: 'Status', get: r => FILTERS.indexOf(r.status) }, { key: 'invoice', label: 'Invoice number', get: r => r.quote?.number },
  ] })
  const receipt = async p => { try { await openFile(() => adminFetch(`/payments/${p.id}/receipt`).then(r => ({ url: r.url, name: r.document?.name, type: r.document?.content_type }))) } catch (e) { toast(e.message, 'error') } }
  const remove = async p => { if (!window.confirm('Delete this payment record? This cannot be undone.')) return; try { await adminFetch(`/payments/${p.id}`, { method: 'DELETE' }); toast('Payment deleted'); load() } catch (e) { toast(e.message, 'error') } }
  const wide = !clientId && !quoteId

  return (
    <div className="space-y-3">
      {err && <Alert>{err}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {can('payments', 'create') ? <Button type="button" variant="outline" className="h-10" onClick={() => setAdding(true)}><Plus className="w-4 h-4" />Record a payment</Button> : <span />}
        {sortControl}
      </div>
      <Card>
        <Table head={[...(wide ? ['Client'] : []), 'Invoice', 'Amount', 'Paid on', 'Method / reference', 'Status', 'Recorded', '']}>
          {!rows && [0, 1].map(i => <tr key={i}>{[...Array(wide ? 8 : 7)].map((_, j) => <Td key={j}><Bone className="h-4 w-16" /></Td>)}</tr>)}
          {sorted?.map(p => (
            <tr key={p.id} className="hover:bg-muted/40">
              {wide && <Td className="max-w-[200px] truncate font-medium">{p.client_id ? <Link to={`/staff360/clients/${p.client_id}`} className="hover:text-accent">{p.client_name || `Client #${p.client_id}`}</Link> : (p.client_name || '—')}</Td>}
              <Td className="whitespace-nowrap">{p.quote ? <Link to={`/staff360/quotes/${p.quote.id}`} className="font-medium hover:text-accent">{p.quote.number}</Link> : <span className="text-muted-foreground">on account</span>}</Td>
              <Td className="tabular-nums font-semibold whitespace-nowrap">{money(p.amount, p.currency)}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{fmtDay(p.paid_on)}</Td>
              <Td className="max-w-[200px]"><span className="block truncate">{p.method || '—'}</span><span className="block text-xs text-muted-foreground truncate">{p.reference}</span>{p.note && <span className="block text-xs text-muted-foreground truncate" title={p.note}>“{p.note}”</span>}</Td>
              <Td><Badge tone={paymentTone(p.status)} className="whitespace-nowrap">{PAYMENT_LABELS[p.status]}</Badge>{p.status_note && <span className="block text-xs text-muted-foreground mt-1 max-w-[180px] truncate" title={p.status_note}>{p.status_note}</span>}</Td>
              <Td className="text-xs text-muted-foreground whitespace-nowrap">{fmtMoment(p.created_at)}<span className="block">{p.source === 'client' ? 'by the client' : 'by staff'}</span></Td>
              <Td className="text-right whitespace-nowrap">
                {p.receipt_document_id && <button type="button" onClick={() => receipt(p)} className="text-xs font-semibold text-accent mr-3 inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Receipt</button>}
                {can('payments', 'approve') && p.status !== 'confirmed' && <button type="button" onClick={() => setReview({ payment: p, to: 'confirmed' })} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mr-3">Confirm</button>}
                {can('payments', 'approve') && p.status !== 'rejected' && <button type="button" onClick={() => setReview({ payment: p, to: 'rejected' })} className="text-xs font-semibold text-destructive mr-3">Reject</button>}
                {can('payments', 'delete') && <button type="button" onClick={() => remove(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive" aria-label="Delete payment"><Trash2 className="w-3.5 h-3.5" /></button>}
              </Td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><Td colSpan={wide ? 8 : 7} className="text-center py-12 text-muted-foreground">No payments here yet. Clients upload their receipts from the client portal; you can also record one yourself.</Td></tr>}
        </Table>
      </Card>
      {review && <Review {...review} onClose={() => setReview(null)} onSaved={() => { toast(review.to === 'confirmed' ? 'Payment confirmed' : 'Payment rejected'); setReview(null); load() }} />}
      {adding && <AddPayment clientId={clientId} quoteId={quoteId} onClose={() => setAdding(false)} onSaved={() => { toast('Payment recorded'); setAdding(false); load() }} />}
      {toastEl}
    </div>
  )
}

function Review({ payment, to, onClose, onSaved }) {
  const [note, setNote] = useState(''); const [notify, setNotify] = useState(true); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  const save = async e => { e.preventDefault(); setBusy(true); setErr(null); try { await adminFetch(`/payments/${payment.id}`, { method: 'PATCH', body: { status: to, status_note: note, notify } }); onSaved() } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  const ok = to === 'confirmed'
  return (
    <Modal open onClose={onClose} title={ok ? 'Confirm this payment' : 'Reject this payment'} footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="pay-review" variant={ok ? 'accent' : 'danger'} disabled={busy || (!ok && note.trim().length < 3)}>{ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{busy ? 'Saving…' : ok ? 'Confirm payment' : 'Reject payment'}</Button></>}>
      <form id="pay-review" onSubmit={save} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <p className="text-sm"><b>{money(payment.amount, payment.currency)}</b> from {payment.client_name || 'the client'}{payment.quote ? <> for <b>{payment.quote.number}</b></> : ''}, paid {fmtDay(payment.paid_on)}.</p>
        <Field label={ok ? 'Note to the client' : 'Why is it rejected? *'} hint={ok ? 'Optional.' : 'The client reads this.'}><Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={ok ? '' : 'e.g. We could not find this transfer on our statement.'} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />Tell the client by email and in their portal</label>
      </form>
    </Modal>
  )
}

function AddPayment({ clientId, quoteId, onClose, onSaved }) {
  const { can } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [f, setF] = useState({ quote_id: quoteId || '', amount: '', currency: 'USD', paid_on: today(), method: 'Bank transfer', reference: '', note: '', confirmed: can('payments', 'approve') })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  useEffect(() => { adminFetch('/quotes').then(r => setQuotes((Array.isArray(r) ? r : r.items || []).filter(x => x.status !== 'draft' && (!clientId || x.client_id === Number(clientId))))).catch(() => {}) }, [clientId])
  const pick = id => { const x = quotes.find(v => String(v.id) === String(id)); setF(v => ({ ...v, quote_id: id, ...(x ? { currency: x.currency, amount: v.amount || String(x.total) } : {}) })) }
  const save = async e => { e.preventDefault(); setBusy(true); setErr(null); try { const { confirmed, ...body } = f; await adminFetch('/payments', { method: 'POST', body: { ...body, quote_id: f.quote_id || null, client_id: clientId, ...(confirmed ? { status: 'confirmed' } : {}) } }); onSaved() } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  return (
    <Modal open onClose={onClose} title="Record a payment" footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="pay-add" variant="accent" disabled={busy}>{busy ? 'Saving…' : 'Record payment'}</Button></>}>
      <form id="pay-add" onSubmit={save} className="grid sm:grid-cols-2 gap-4">
        {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
        <Field label="Invoice" className="sm:col-span-2" hint={clientId ? 'Optional: leave empty for a payment on account.' : undefined}><Select value={f.quote_id} required={!clientId} disabled={Boolean(quoteId)} onChange={e => pick(e.target.value)}><option value="">{clientId ? 'On account (no invoice)' : 'Choose an invoice…'}</option>{quotes.map(x => <option key={x.id} value={x.id}>{x.number} · {x.client_name} · {money(x.total, x.currency)}</option>)}</Select></Field>
        <Field label="Amount *"><div className="flex"><Input className="rounded-r-none w-20" maxLength={3} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value.toUpperCase() })} aria-label="Currency" /><Input className="rounded-l-none border-l-0" type="number" required min="0.01" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></div></Field>
        <Field label="Paid on"><Input type="date" max={today()} value={f.paid_on} onChange={e => setF({ ...f, paid_on: e.target.value })} /></Field>
        <Field label="Method"><Input value={f.method} onChange={e => setF({ ...f, method: e.target.value })} /></Field>
        <Field label="Reference"><Input value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} /></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea rows={2} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
        {can('payments', 'approve') && <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.confirmed} onChange={e => setF({ ...f, confirmed: e.target.checked })} />We have received this money (record it as confirmed)</label>}
      </form>
    </Modal>
  )
}

export default function PaymentsAdmin() {
  const [sp, setSp] = useSearchParams()
  const status = FILTERS.includes(sp.get('status')) ? sp.get('status') : 'all'
  const [q, setQ] = useState('')
  return (
    <>
      <PageHeader eyebrow="Sales" title="Payments" description="Receipts uploaded by clients and payments recorded by the team, against invoices." />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" /><Input className="pl-10" placeholder="Search client, invoice or reference…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="flex rounded-xl border border-border overflow-hidden text-xs font-semibold">{FILTERS.map(k => <button key={k} onClick={() => setSp(k === 'all' ? {} : { status: k })} className={`px-3.5 py-2 ${status === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{k === 'all' ? 'All' : PAYMENT_LABELS[k]}</button>)}</div>
      </div>
      <PaymentsPanel status={status} q={q} />
    </>
  )
}
