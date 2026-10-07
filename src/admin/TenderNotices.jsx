/*
 * Invite selected suppliers to bid on an opportunity by email: choose, preview the
 * exact message, send; resend to those who have not bid; and the record of every send.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mail, RefreshCw, Search } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Input, Modal, Table, Td, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtDateTime } from './format'

const STATUS_TONE = { sent: 'green', failed: 'red', queued: 'amber' }

export default function TenderNotices({ tender, state }) {
  const { can } = useAuth()
  const [data, setData] = useState(null); const [err, setErr] = useState(null); const [q, setQ] = useState('')
  const [picked, setPicked] = useState([]); const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(false); const [toast, toastEl] = useToast()
  const load = useCallback(() => adminFetch(`/tenders/${tender.id}/notices${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`).then(d => { setData(d); setErr(null) }).catch(e => setErr(e.message)), [tender.id, q])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])
  const open = data?.open
  const eligible = useMemo(() => (data?.suppliers || []).filter(s => s.email && !s.has_bid), [data])
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const waiting = useMemo(() => [...new Set((data?.history || []).map(h => h.supplier_id).filter(id => id != null))].filter(id => eligible.some(s => s.id === id)), [data, eligible])

  const showPreview = async (ids, resend) => {
    setBusy(true); setErr(null)
    try { setPreview({ ...(await adminFetch(`/tenders/${tender.id}/notices/preview`, { method: 'POST', body: { supplier_ids: ids, resend } })), ids, resend }) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const send = async () => {
    setBusy(true)
    try {
      const r = await adminFetch(`/tenders/${tender.id}/notices${preview.resend ? '/resend' : ''}`, { method: 'POST', body: { supplier_ids: preview.ids } })
      toast(`${r.sent.length} sent${r.failed.length ? `, ${r.failed.length} failed` : ''}${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}`, r.failed.length ? 'error' : 'ok')
      setPreview(null); setPicked([]); load()
    } catch (x) { setErr(x.message); setPreview(null) } finally { setBusy(false) }
  }
  const sendable = preview?.recipients.filter(r => r.will_send).length || 0

  return (
    <div className="space-y-6">
      {err && <Alert>{err}</Alert>}
      {data && !open && <Alert tone="info">Invitations can only be sent while the opportunity is published and still open for bids ({state === 'draft' ? 'publish it first' : 'it is not open now'}). The history below is kept.</Alert>}
      <Card>
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[14rem]"><h2 className="font-semibold">Invite suppliers to bid</h2><p className="text-xs text-muted-foreground mt-0.5">Each supplier gets the reference, commodity, quantity, specifications, delivery location, deadline and a link to submit a bid.</p></div>
          <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" /><Input className="pl-9" placeholder="Search suppliers…" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <Table head={['', 'Supplier', 'Email', 'Supplies', 'Status']}>
          {!data && !err && [0, 1, 2].map(i => <tr key={i}>{[...Array(5)].map((_, j) => <Td key={j}><Bone className="h-4 w-20" /></Td>)}</tr>)}
          {data?.suppliers.map(s => {
            const can_pick = Boolean(s.email) && !s.has_bid
            return (
              <tr key={s.id} className="hover:bg-muted/40">
                <Td><input type="checkbox" disabled={!can_pick || !open} checked={picked.includes(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${s.company_name}`} /></Td>
                <Td className="font-medium">{s.company_name}<span className="block text-xs text-muted-foreground font-normal">{s.contact_person}</span></Td>
                <Td className="text-muted-foreground text-xs break-all">{s.email || <span className="text-destructive">no email</span>}</Td>
                <Td className="text-muted-foreground max-w-[200px] truncate">{s.commodities || '—'}</Td>
                <Td>{s.has_bid ? <Badge tone="green">Bid submitted</Badge> : s.notices ? <><Badge tone={STATUS_TONE[s.last_status] || 'muted'}>{s.last_status === 'sent' ? 'Notified' : s.last_status}</Badge><span className="block text-[11px] text-muted-foreground mt-0.5">{fmtDateTime(s.last_notice_at)}{s.notices > 1 ? ` · ${s.notices}×` : ''}</span></> : <span className="text-xs text-muted-foreground">Not notified</span>}</Td>
              </tr>
            )
          })}
          {data?.suppliers.length === 0 && <tr><Td colSpan={5} className="text-center py-10 text-muted-foreground">No active supplier matches.</Td></tr>}
        </Table>
        <div className="px-5 py-4 border-t border-border flex flex-wrap items-center gap-3">
          <Button type="button" variant="accent" disabled={!open || !picked.length || busy} onClick={() => showPreview(picked, false)}><Mail className="w-4 h-4" />Preview and send{picked.length ? ` (${picked.length})` : ''}</Button>
          {can('bidding', 'edit') && <Button type="button" variant="outline" disabled={!open || !waiting.length || busy} onClick={() => showPreview(waiting, true)} title="Notified suppliers who have not submitted a bid"><RefreshCw className="w-4 h-4" />Resend to those who have not bid</Button>}
          <span className="text-xs text-muted-foreground">A supplier already notified is skipped; only a resend sends again.</span>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Notification history</h2></div>
        <Table head={['Supplier', 'Sent', 'Status', 'Type', 'Sent by']}>
          {data?.history.map(h => <tr key={h.id}><Td className="font-medium">{h.supplier_name}<span className="block text-xs text-muted-foreground font-normal break-all">{h.email}</span></Td><Td className="text-xs whitespace-nowrap text-muted-foreground">{fmtDateTime(h.created_at)}</Td><Td><Badge tone={STATUS_TONE[h.status]}>{h.status}</Badge>{h.error && <span className="block text-xs text-destructive mt-0.5 max-w-[240px]">{h.error}</span>}</Td><Td className="text-xs">{h.kind === 'resend' ? 'Resend' : 'First notice'}</Td><Td className="text-xs text-muted-foreground">{h.initiated_name || '—'}</Td></tr>)}
          {data && !data.history.length && <tr><Td colSpan={5} className="text-center py-8 text-muted-foreground">Nobody has been notified yet.</Td></tr>}
        </Table>
      </Card>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} wide title={preview?.resend ? 'Resend the invitation' : 'Preview the invitation'}
        footer={<><Button type="button" variant="outline" onClick={() => setPreview(null)}>Back</Button><Button type="button" variant="accent" disabled={busy || !sendable} onClick={send}>{busy ? 'Sending…' : `Send to ${sendable} supplier${sendable === 1 ? '' : 's'}`}</Button></>}>
        {preview && (
          <div className="space-y-5 text-sm">
            {preview.subject && <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/50 border-b border-border text-xs text-muted-foreground">Example as sent to {preview.example_for}</div>
              <div className="p-4 space-y-3"><p className="font-semibold">{preview.subject}</p><pre className="whitespace-pre-wrap font-sans text-sm">{preview.body}</pre>{preview.cta && <span className="inline-block rounded-xl bg-accent text-accent-foreground px-4 py-2 font-semibold">{preview.cta.label}</span>}<p className="text-xs text-muted-foreground break-all">Link: {preview.link}</p></div>
            </div>}
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recipients</p>
              <ul className="space-y-1">{preview.recipients.map(r => <li key={r.supplier_id} className="flex flex-wrap items-center gap-2"><Badge tone={r.will_send ? 'green' : 'muted'}>{r.will_send ? 'will receive it' : 'skipped'}</Badge><span className="font-medium">{r.name}</span><span className="text-xs text-muted-foreground">{r.email}</span>{r.reason && <span className="text-xs text-muted-foreground">— {r.reason}</span>}</li>)}</ul></div>
          </div>
        )}
      </Modal>
      {toastEl}
    </div>
  )
}
