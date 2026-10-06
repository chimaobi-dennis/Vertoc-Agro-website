/*
 * Investor profile change requests, for staff. Investment staff review and
 * recommend; an Admin accepts, which is what changes the official profile.
 */
import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Field, Modal, Table, Td, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { openDocument } from './documents'
import { fmtDateTime } from './format'

const LABELS = { name: 'Full name', title: 'Title', first_name: 'First name', middle_name: 'Middle name', last_name: 'Last name', phone: 'Phone number', email: 'Email address', address: 'Residential address', state_of_origin: 'State of origin', lga: 'LGA', date_of_birth: 'Date of birth', nationality: 'Nationality', id_type: 'Means of identification', id_number: 'Identification number', bank_name: 'Bank', bank_account_name: 'Account name', bank_account_number: 'Account number', avatar: 'Profile picture' }
export const CHANGE_LABEL = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under review', resubmission_required: 'Resubmission required', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' }
const TONE = { draft: 'muted', submitted: 'blue', under_review: 'amber', resubmission_required: 'amber', approved: 'green', rejected: 'red', cancelled: 'muted' }
const val = (k, v) => (v == null || v === '' ? '—' : k === 'avatar' ? 'a new picture' : String(v))
const FILTERS = ['open', 'all', 'approved', 'rejected', 'resubmission_required']

export function ChangeRequestsPanel({ investorId = null }) {
  const [rows, setRows] = useState(null); const [err, setErr] = useState(null); const [status, setStatus] = useState('open'); const [openId, setOpenId] = useState(null)
  const load = useCallback(() => adminFetch(`/investor-changes?status=${status}${investorId ? `&investor_id=${investorId}` : ''}`).then(r => { setRows(r); setErr(null) }).catch(e => setErr(e.message)), [status, investorId])
  useEffect(() => { setRows(null); load() }, [load])
  return (
    <>
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <div className="flex flex-wrap gap-1.5 mb-3">{FILTERS.map(s => <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${status === s ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>{s === 'open' ? 'To review' : s === 'all' ? 'All' : CHANGE_LABEL[s]}</button>)}</div>
      <Card>
        <Table head={['Investor', 'Asked to change', 'Reason', 'Submitted', 'Status', '']}>
          {!rows && !err && [0, 1].map(i => <tr key={i}>{[...Array(6)].map((_, j) => <Td key={j}><Bone className="h-4 w-20" /></Td>)}</tr>)}
          {rows?.map(r => (
            <tr key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setOpenId(r.id)}>
              <Td className="font-medium">{r.investor?.name || '—'}</Td>
              <Td className="text-muted-foreground">{Object.keys(r.changes).map(k => LABELS[k] || k).join(', ')}</Td>
              <Td className="text-muted-foreground max-w-[260px] truncate">{r.reason}</Td>
              <Td className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(r.submitted_at)}</Td>
              <Td><Badge tone={TONE[r.status]} className="whitespace-nowrap">{CHANGE_LABEL[r.status]}</Badge>{r.recommended_name && r.status === 'under_review' && <span className="block text-[11px] text-muted-foreground mt-0.5">recommended by {r.recommended_name}</span>}</Td>
              <Td className="text-right"><span className="text-xs font-semibold text-accent">Open →</span></Td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><Td colSpan={6} className="text-center py-12 text-muted-foreground">{status === 'open' ? 'No profile change is waiting for review.' : 'Nothing here.'}</Td></tr>}
        </Table>
      </Card>
      {openId && <ReviewModal id={openId} onClose={() => { setOpenId(null); load() }} />}
    </>
  )
}

function ReviewModal({ id, onClose }) {
  const { can } = useAuth()
  const [r, setR] = useState(null); const [err, setErr] = useState(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [toast, toastEl] = useToast()
  const approver = can('investments', 'approve'), isAdmin = can('staff', 'manage')
  const load = useCallback(() => adminFetch(`/investor-changes/${id}`).then(setR).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])
  // Opening a submitted request starts its review.
  useEffect(() => { if (r?.status === 'submitted' && approver) adminFetch(`/investor-changes/${id}/review`, { method: 'POST', body: { action: 'start' } }).then(setR).catch(() => {}) }, [r?.status, approver, id])
  const act = async action => {
    setBusy(true); setErr(null)
    try { setR(await adminFetch(`/investor-changes/${id}/review`, { method: 'POST', body: { action, note } })); setNote(''); toast(action === 'approve' ? (isAdmin ? 'Approved: the investor profile is updated' : 'Recommended: an Admin has to accept it') : action === 'reject' ? 'Rejected' : 'The investor was asked to resubmit') }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const live = r && ['submitted', 'under_review'].includes(r.status)
  const recommendedByMe = false
  return (
    <Modal open onClose={onClose} wide title={r ? `Profile change · ${r.investor?.name || ''}` : 'Profile change'}
      footer={live && approver ? <><Button type="button" variant="outline" className="text-destructive" disabled={busy || !note.trim()} title={!note.trim() ? 'Write the reason first' : undefined} onClick={() => act('reject')}>Reject</Button><Button type="button" variant="outline" disabled={busy || !note.trim()} title={!note.trim() ? 'Write what to correct first' : undefined} onClick={() => act('resubmit')}>Ask to resubmit</Button><Button type="button" variant="accent" disabled={busy || (!isAdmin && r.recommended_by && recommendedByMe)} onClick={() => act('approve')}>{isAdmin ? 'Approve and apply' : r.recommended_name ? 'Recommended' : 'Recommend approval'}</Button></> : undefined}>
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!r ? <div className="space-y-3">{[0, 1, 2].map(i => <Bone key={i} className="h-10 w-full" />)}</div> : (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={TONE[r.status]}>{CHANGE_LABEL[r.status]}</Badge><span className="text-muted-foreground">Submitted {fmtDateTime(r.submitted_at)}</span>{r.previous_id && <Badge tone="muted">resubmission of #{r.previous_id}</Badge>}{r.investor && <span className="text-muted-foreground">· {r.investor.email}</span>}</div>
          <Table head={['Information', 'On record', 'Requested']}>
            {Object.entries(r.changes).map(([k, c]) => <tr key={k}><Td className="font-medium">{LABELS[k] || k}</Td><Td className="text-muted-foreground">{val(k, c.from)}</Td><Td className="font-semibold">{val(k, c.to)}</Td></tr>)}
          </Table>
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reason</p><p className="whitespace-pre-wrap">{r.reason}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Supporting documents</p>
            {r.documents.length ? <ul className="space-y-1">{r.documents.map(d => <li key={d.id}><button type="button" onClick={() => openDocument(d.id).catch(e => setErr(e.message))} className="inline-flex items-center gap-1.5 text-accent font-semibold"><FileText className="w-4 h-4" />{d.name}<ExternalLink className="w-3 h-3" /></button></li>)}</ul> : <p className="text-muted-foreground">None attached.</p>}</div>
          {r.recommended_name && <p className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2">Recommended by <b>{r.recommended_name}</b> on {fmtDateTime(r.recommended_at)}. {r.status === 'under_review' && 'An Admin has to accept it before the profile changes.'}</p>}
          {r.review_note && !live && <p className="rounded-xl bg-muted/60 px-3 py-2"><span className="font-semibold">{r.reviewer_name}: </span>{r.review_note}</p>}
          {live && approver && <Field label="Note" hint="Required to reject or ask for a resubmission: the investor sees it. Optional when approving."><Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} /></Field>}
          {live && approver && !isAdmin && <p className="text-xs text-muted-foreground">You can recommend; an Admin applies the change.</p>}
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">History</p>
            <ul className="space-y-1 text-xs text-muted-foreground">{r.history.map((h, i) => <li key={i}>{fmtDateTime(h.at)} · <b className="text-foreground font-medium">{h.by}</b> {h.action}{h.note ? ` — ${h.note}` : ''}</li>)}</ul></div>
        </div>
      )}
      {toastEl}
    </Modal>
  )
}
