/* Change the status of a bid: the new status, a note the supplier reads
   with it, and whether to email them. Used from the bid page and from the
   comparison table. */
import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Field, Modal, Select, Textarea } from './ui'
import { BID_EXPLAINED, BID_LABELS, BID_STATUSES, bidTone } from '../lib/procurement'

const STAFF_STATUSES = BID_STATUSES.filter(s => s !== 'withdrawn')

export default function BidStatusDialog({ bid, to = null, onClose, onSaved }) {
  const [status, setStatus] = useState(to || bid?.status || 'under_review')
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  useEffect(() => { if (bid) { setStatus(to || (bid.status === 'open' ? 'under_review' : bid.status)); setNote(''); setNotify(true); setErr(null) } }, [bid, to])
  if (!bid) return null
  const save = async e => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { const r = await adminFetch(`/bids/${bid.id}`, { method: 'PATCH', body: { status, status_note: note, notify } }); onSaved?.(r); onClose() }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const same = status === bid.status
  return (
    <Modal open onClose={onClose} title="Change bid status"
      footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="bid-status" variant="accent" disabled={busy || same}>{busy ? 'Saving…' : `Mark as ${BID_LABELS[status].toLowerCase()}`}</Button></>}>
      <form id="bid-status" onSubmit={save} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <p className="text-sm"><span className="font-semibold">{bid.company_name}</span> <span className="text-muted-foreground">is now</span> <Badge tone={bidTone(bid.status)}>{BID_LABELS[bid.status]}</Badge></p>
        <Field label="New status" hint={BID_EXPLAINED[status]}>
          <Select value={status} onChange={e => setStatus(e.target.value)}>{STAFF_STATUSES.map(s => <option key={s} value={s}>{BID_LABELS[s]}</option>)}</Select>
        </Field>
        <Field label="Note to the supplier" hint="Optional. Shown with the status in their dashboard and in the email.">
          <Textarea rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder={status === 'not_selected' ? 'e.g. Thank you for bidding; the price was above our budget this time.' : status === 'awarded' ? 'e.g. Our LPO follows today.' : ''} />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />Email the supplier about this change</label>
        {status === 'awarded' && <Alert tone="info">Awarding marks the opportunity as awarded and closes it for new bids. You can raise the PO or LPO from the bid afterwards.</Alert>}
      </form>
    </Modal>
  )
}
