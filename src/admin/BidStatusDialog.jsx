/* Change the status of a bid: the new status, a note the supplier reads
   with it, and whether to email them. Awarding also takes how much of the
   requirement this supplier gets and at what price, so one opportunity can
   be shared between several suppliers. Used from the bid page and from the
   comparison table. */
import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Field, Input, Modal, Select, Textarea } from './ui'
import { BID_EXPLAINED, BID_LABELS, BID_STATUSES, bidTone, money, qty } from '../lib/procurement'

export default function BidStatusDialog({ bid, to = null, award = null, onClose, onSaved }) {
  const { can } = useAuth()
  const mayAward = can('bidding', 'award')
  const statuses = BID_STATUSES.filter(s => s !== 'withdrawn' && (mayAward || s !== 'awarded' || bid?.status === 'awarded'))
  const [status, setStatus] = useState(to || bid?.status || 'under_review')
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [aq, setAq] = useState(''); const [ap, setAp] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  // What is still unallocated, leaving this bid's own award out of the sum.
  const mine = bid?.status === 'awarded' ? Number(bid.awarded_quantity ?? bid.quantity) : 0
  const free = award ? Math.max(0, Math.round((award.balance + mine) * 1000) / 1000) : null
  useEffect(() => {
    if (!bid) return
    setStatus(to || (bid.status === 'open' ? 'under_review' : bid.status)); setNote(''); setNotify(true); setErr(null)
    setAq(String(bid.awarded_quantity ?? (free != null ? Math.min(bid.quantity, free) : bid.quantity))); setAp(String(bid.awarded_price ?? bid.price))
  }, [bid, to]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!bid) return null
  const awarding = status === 'awarded'
  const same = status === bid.status && (!awarding || (Number(aq) === Number(bid.awarded_quantity ?? bid.quantity) && Number(ap) === Number(bid.awarded_price ?? bid.price)))
  const save = async e => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const body = { status_note: note, notify, ...(status !== bid.status ? { status } : {}), ...(awarding ? { awarded_quantity: aq, awarded_price: ap } : {}) }
      const r = await adminFetch(`/bids/${bid.id}`, { method: 'PATCH', body }); onSaved?.(r); onClose()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const required = award?.required
  const share = awarding && required > 0 && Number(aq) > 0 ? Math.round(Number(aq) / required * 1000) / 10 : null
  return (
    <Modal open onClose={onClose} title={awarding ? 'Award this bid' : 'Change bid status'}
      footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="bid-status" variant="accent" disabled={busy || same}>{busy ? 'Saving…' : awarding && bid.status === 'awarded' ? 'Save the award' : `Mark as ${BID_LABELS[status].toLowerCase()}`}</Button></>}>
      <form id="bid-status" onSubmit={save} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <p className="text-sm"><span className="font-semibold">{bid.company_name}</span> <span className="text-muted-foreground">is now</span> <Badge tone={bidTone(bid.status)}>{BID_LABELS[bid.status]}</Badge></p>
        <Field label="New status" hint={BID_EXPLAINED[status]}>
          <Select value={status} onChange={e => setStatus(e.target.value)}>{statuses.map(s => <option key={s} value={s}>{BID_LABELS[s]}</option>)}</Select>
        </Field>
        {awarding && (
          <div className="rounded-xl border border-border p-4 space-y-3">
            {award && <p className="text-xs text-muted-foreground">Requirement {qty(required, bid.unit)} · already awarded to others {qty(award.awarded - mine, bid.unit)} · <b className="text-foreground">{qty(free, bid.unit)} still to award</b></p>}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={`Awarded quantity (${bid.unit})`} hint={`They offered ${qty(bid.quantity, bid.unit)}.${share != null ? ` This is ${share}% of the requirement.` : ''}`}><Input type="number" required min="0.001" step="0.001" max={bid.quantity} value={aq} onChange={e => setAq(e.target.value)} /></Field>
              <Field label={`Awarded price per ${bid.unit}`} hint={`Their price is ${money(bid.price, bid.currency)}.${Number(aq) > 0 && Number(ap) > 0 ? ` Worth ${money(Number(aq) * Number(ap), bid.currency)}.` : ''}`}><Input type="number" required min="0.01" step="0.01" value={ap} onChange={e => setAp(e.target.value)} /></Field>
            </div>
          </div>
        )}
        <Field label="Note to the supplier" hint="Optional. Shown with the status in their dashboard and in the email.">
          <Textarea rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder={status === 'not_selected' ? 'e.g. Thank you for bidding; the price was above our budget this time.' : status === 'awarded' ? 'e.g. Our LPO follows today.' : ''} />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />Email the supplier about this change</label>
        {awarding && bid.status !== 'awarded' && <Alert tone="info">You can share one opportunity between several suppliers: award each their quantity and price, and raise a separate PO or LPO for each from their bid. The first award marks the opportunity as awarded and closes it for new bids.</Alert>}
      </form>
    </Modal>
  )
}
