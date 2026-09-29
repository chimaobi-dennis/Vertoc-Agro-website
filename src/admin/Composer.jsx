import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Paperclip, Send, Upload } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Button, Field, Input, Modal, Select, Textarea } from './ui'
import { ACCEPT, uploadDocument } from './documents'
import { fmtBytes } from './format'

/**
 * One-to-one email to a client or enquirer. Posts to /messages, or to
 * /quotes/:id/send when `quoteId` is given — then the quote PDF and its
 * unique link are added by the server and the body may be left empty.
 *
 * With scope="procurement" the same composer writes to a supplier: the email
 * is filed in the procurement inbox (under `supplierId`, and the bid or order
 * it concerns), and `sendOrderId` sends a PO / LPO with its PDF and link.
 */
/**
 * `template` = { key, quote_id?, enquiry_id?, client_id? } pre-fills subject
 * and body from the editable email templates when the caller gives none.
 */
export default function Composer({ open, onClose, title = 'Send email', to = '', subject = '', body = '', clientId = null, enquiryId = null, quoteId = null, replyToId = null, template = null, onSent, scope = 'sales', supplierId = null, bidId = null, poId = null, sendOrderId = null }) {
  const { me } = useAuth()
  const procurement = scope === 'procurement'
  const base = procurement ? '/procurement' : ''
  // Where uploads and the attachment list belong: the supplier on the procurement side, the client on the sales side.
  const fileScope = procurement ? (supplierId ? { supplier_id: supplierId, ...(bidId ? { bid_id: bidId } : {}), ...(poId || sendOrderId ? { po_id: poId || sendOrderId } : {}) } : null) : { client_id: clientId, quote_id: quoteId }
  const fileRef = useRef(null)
  const [form, setForm] = useState({ to, subject, body })
  const [settings, setSettings] = useState(null)
  const [senders, setSenders] = useState([])   // departments to send from; the first is the default From
  const [fromId, setFromId] = useState('')
  const [docs, setDocs] = useState([])
  const [picked, setPicked] = useState(new Set())
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm({ to, subject, body }); setPicked(new Set()); setErr(null)
    if (template?.key && (!subject || !body)) {
      const qs = Object.entries(template).filter(([k, v]) => k !== 'key' && v != null).map(([k, v]) => `${k}=${v}`).join('&')
      adminFetch(`${base}/templates/${template.key}/render${qs ? '?' + qs : ''}`)
        .then(r => setForm(f => ({ ...f, subject: subject || r.subject || f.subject, body: body || r.body || f.body })))
        .catch(() => {})
    }
    adminFetch('/settings').then(setSettings).catch(() => setSettings({ email: {} }))
    adminFetch(`${base}/messages/senders`).then(l => { setSenders(l); setFromId(l[0]?.id || '') }).catch(() => setSenders([]))
    if (procurement && supplierId) adminFetch(`/documents?supplier_id=${supplierId}`).then(setDocs).catch(() => setDocs([]))
    else if (!procurement && clientId) adminFetch(`/documents?client_id=${clientId}`).then(setDocs).catch(() => setDocs([]))
    else setDocs([])
  }, [open, to, subject, body, clientId, supplierId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = id => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const addFile = async e => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setErr(null)
    try { const d = await uploadDocument(file, fileScope); setDocs(ds => [d, ...ds]); toggle(d.id) }
    catch (x) { setErr(x.message) } finally { setUploading(false); e.target.value = '' }
  }
  const send = async e => {
    e.preventDefault(); setSending(true); setErr(null)
    try {
      const payload = { to: form.to, subject: form.subject, body: form.body, attachment_ids: [...picked], reply_to_id: replyToId, from_id: fromId || null, ...(procurement ? { supplier_id: supplierId, bid_id: bidId, po_id: poId } : { client_id: clientId, enquiry_id: enquiryId }) }
      const r = await adminFetch(sendOrderId ? `/purchase-orders/${sendOrderId}/send` : quoteId ? `/quotes/${quoteId}/send` : `${base}/messages`, { method: 'POST', body: payload })
      onSent?.(r); onClose()
    } catch (x) { setErr(x.message) } finally { setSending(false) }
  }

  const configured = settings?.email?.configured
  const chosen = senders.find(s => s.id === fromId)
  const from = chosen ? `${chosen.name} <${chosen.email}>` : settings?.email?.from

  return (
    <Modal open={open} onClose={onClose} title={title} wide
      footer={<>
        <span className="text-xs text-muted-foreground mr-auto truncate">{from ? `From ${from}` : ''}{settings?.email?.dry_run ? ' · dry run (nothing leaves the server)' : ''}</span>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="composer" variant="accent" disabled={sending || uploading}><Send className="w-4 h-4" />{sending ? 'Sending…' : 'Send'}</Button>
      </>}>
      <form id="composer" onSubmit={send} className="space-y-4">
        {settings && !configured && (
          <Alert tone="info">Email isn't connected yet.{me?.permissions?.settings ? <> Add your Resend API key under <Link to="/staff360/settings?tab=email" className="font-semibold text-accent">Settings → Email</Link>.</> : ' Ask an admin to add the Resend API key in Settings.'}</Alert>
        )}
        {sendOrderId && <Alert tone="info">The order PDF and the supplier's link to acknowledge it are attached automatically. The text comes from the "Purchase order to supplier" template — edit it here before sending.</Alert>}
        {quoteId && <Alert tone="info">The invoice PDF and its unique online link are attached automatically. The text comes from the "Invoice to client" template — edit it here before sending.</Alert>}
        {replyToId && <Alert tone="info">Sent as a reply: it threads under their email in their mail app, so write only the new text.</Alert>}
        {err && <Alert>{err}</Alert>}
        {senders.length > 1 && (
          <Field label="From" hint="Departments are set up under Settings → Email">
            <Select value={fromId} onChange={e => setFromId(e.target.value)}>{senders.map(s => <option key={s.id} value={s.id}>{s.name} &lt;{s.email}&gt;</option>)}</Select>
          </Field>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="To"><Input type="email" required value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} placeholder={procurement ? 'supplier@company.com' : 'client@company.com'} /></Field>
          <Field label="Subject"><Input required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></Field>
        </div>
        <Field label="Message" hint="Plain text. It is sent inside the Vertoc Agro template with your signature from Settings.">
          <Textarea rows={quoteId || sendOrderId ? 7 : 10} required={!quoteId && !sendOrderId} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder={quoteId || sendOrderId ? 'Optional — the template text is used when empty.' : 'Dear …'} />
        </Field>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold flex items-center gap-1.5"><Paperclip className="w-4 h-4 text-accent" />Attachments</span>
            <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={addFile} disabled={uploading} />
            <Button type="button" variant="ghost" className="h-8 px-2.5 text-xs" disabled={uploading || !fileScope} title={fileScope ? undefined : 'Files are kept on a supplier record: write to a supplier to attach one'} onClick={() => fileRef.current?.click()}><Upload className="w-3.5 h-3.5" />{uploading ? 'Uploading…' : 'Upload a file'}</Button>
          </div>
          {docs.length ? (
            <ul className="rounded-xl border border-border divide-y divide-border max-h-44 overflow-y-auto">
              {docs.map(d => (
                <li key={d.id}>
                  <label className="flex items-center gap-3 px-3.5 py-2.5 text-sm cursor-pointer hover:bg-muted/50">
                    <input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} />
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{fmtBytes(d.bytes)}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted-foreground">{procurement ? (supplierId ? 'No documents on this supplier yet — upload one to attach it.' : 'Attachments are kept on a supplier record: write to a supplier from their page to attach files.') : clientId ? 'No documents on this client yet — upload one to attach it.' : 'Upload a file to attach it.'}</p>}
        </div>
      </form>
    </Modal>
  )
}
