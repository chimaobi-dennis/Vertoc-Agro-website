import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ExternalLink, FileText, Paperclip, Send, X } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Badge, Button, Input, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { ACCEPT, openDocument, uploadDocument } from './documents'
import { fmtBytes, fmtDate, messageTone } from './format'

const norm = s => String(s || '').replace(/^\s*((re|fwd?|aw|sv)\s*:\s*)+/i, '').trim().toLowerCase()
const day = iso => new Date(iso).toDateString()
const time = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/**
 * One conversation with one address or client, shown as bubbles: theirs on
 * the left, ours on the right, quoted history folded away. The reply box
 * sends only the new text and threads it under their last email through
 * the In-Reply-To / References headers, so their mail client files it in
 * the same thread instead of showing the whole history again.
 */
export default function Thread({ threadKey, email = '', clientId = null, refreshKey = 0, onRead, onSent, bodyClass = '' }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [opened, setOpened] = useState(() => new Set())
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [editSubject, setEditSubject] = useState(false)
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const fileRef = useRef(null)
  const endRef = useRef(null)
  const [toast, toastEl] = useToast()

  const load = useCallback(async () => {
    try {
      const list = await adminFetch(`/messages/thread?key=${encodeURIComponent(threadKey)}`)
      setRows(list); setErr(null)
      if (list.some(m => m.direction === 'in' && !m.read_at)) {
        await adminFetch('/messages/thread/read', { method: 'POST', body: { key: threadKey } }).catch(() => {})
        onRead?.()
      }
    } catch (e) { setErr(e.message) }
  }, [threadKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRows(null); setBody(''); setFiles([]); setEditSubject(false); setOpened(new Set()); load() }, [load, refreshKey])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [rows])

  const last = rows?.length ? rows[rows.length - 1] : null
  const lastIn = rows ? [...rows].reverse().find(m => m.direction === 'in') : null
  const to = email || lastIn?.from_email || last?.to_email || ''
  const defaultSubject = last?.subject ? (/^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`) : ''
  useEffect(() => { setSubject(defaultSubject) }, [defaultSubject])
  const needsSubject = !last

  const toggle = id => setOpened(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const addFile = async e => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { const d = await uploadDocument(file, { client_id: clientId || undefined }); setFiles(f => [...f, d]) }
    catch (x) { toast(x.message, 'error') } finally { setUploading(false); e.target.value = '' }
  }
  const send = async e => {
    e.preventDefault()
    if (!body.trim() || !to) return
    if (needsSubject && !subject.trim()) { setEditSubject(true); toast('Add a subject for the first email.', 'error'); return }
    setSending(true)
    try {
      const r = await adminFetch('/messages', { method: 'POST', body: { to, subject: subject.trim() || defaultSubject, body, client_id: clientId, reply_to_id: lastIn?.id ?? last?.id ?? null, attachment_ids: files.map(f => f.id) } })
      setBody(''); setFiles([]); setEditSubject(false); toast('Sent'); onSent?.(r); load()
    } catch (x) { toast(x.message, 'error') } finally { setSending(false) }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* only this list scrolls; the header above and the reply box below stay put */}
      <div className={`flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 space-y-3 ${bodyClass}`}>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {!rows && [0, 1, 2].map(i => <div key={i} className={`flex ${i % 2 ? 'justify-end' : ''}`}><Bone className="h-14 w-2/3 rounded-2xl" /></div>)}
        {rows?.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">No emails with {to || 'this address'} yet. Write the first one below.</p>}
        {rows?.map((m, i) => {
          const mine = m.direction === 'out'
          const prev = rows[i - 1]
          const newDay = !prev || day(prev.created_at) !== day(m.created_at)
          const newSubject = !prev || norm(prev.subject) !== norm(m.subject)
          const open = opened.has(m.id)
          return (
            <div key={m.id}>
              {newDay && <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground my-3">{fmtDate(m.created_at)}</div>}
              {newSubject && <p className="text-center text-xs text-muted-foreground mb-2 truncate">{m.subject || '(no subject)'}</p>}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] md:max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'}`}>
                  {!mine && <p className="text-[11px] font-semibold mb-1 opacity-70">{m.from_name || m.from_email}</p>}
                  <p className="whitespace-pre-wrap leading-relaxed break-words">{m.text || m.body}</p>
                  {m.quoted && (
                    <>
                      <button type="button" onClick={() => toggle(m.id)} className={`mt-2 text-[11px] font-semibold underline-offset-2 hover:underline ${mine ? 'text-primary-foreground/80' : 'text-accent'}`}>{open ? 'Hide quoted text' : 'Show quoted text'}</button>
                      {open && <pre className={`mt-2 text-xs whitespace-pre-wrap font-sans border-l-2 pl-3 ${mine ? 'border-primary-foreground/40 text-primary-foreground/80' : 'border-border text-muted-foreground'}`}>{m.quoted}</pre>}
                    </>
                  )}
                  {m.attachments?.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {m.attachments.map((a, j) => (
                        <li key={j} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${mine ? 'bg-primary-foreground/15' : 'bg-card border border-border'}`}>
                          <FileText className="w-3.5 h-3.5" /><span className="max-w-[160px] truncate">{a.name}</span>
                          {a.document_id && <>
                            <button type="button" onClick={() => openDocument(a.document_id)} className="p-0.5 opacity-80 hover:opacity-100" title="Open" aria-label="Open"><ExternalLink className="w-3 h-3" /></button>
                            <button type="button" onClick={() => openDocument(a.document_id, { download: true })} className="p-0.5 opacity-80 hover:opacity-100" title="Download" aria-label="Download"><Download className="w-3 h-3" /></button>
                          </>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className={`mt-1.5 flex items-center justify-end gap-2 text-[11px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    <span>{time(m.created_at)}</span>
                    {mine && m.status !== 'sent' && <Badge tone={messageTone(m.status)}>{m.status}</Badge>}
                    <Link to={`/staff360/messages/${m.id}`} className="underline-offset-2 hover:underline">Open</Link>
                  </div>
                  {m.status === 'failed' && <p className="mt-1 text-[11px] text-destructive-foreground bg-destructive/80 rounded-lg px-2 py-1">{m.error}</p>}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="shrink-0 border-t border-border p-4 space-y-3 bg-card rounded-b-2xl">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">{needsSubject ? 'New email to' : 'Reply to'} <b className="text-foreground">{to || '—'}</b>{!editSubject && !needsSubject && subject ? <> · {subject}</> : null}</span>
          {!needsSubject && <button type="button" onClick={() => setEditSubject(v => !v)} className="font-semibold text-accent whitespace-nowrap">{editSubject ? 'Keep subject' : 'Change subject'}</button>}
        </div>
        {(editSubject || needsSubject) && <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />}
        <Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder={needsSubject ? 'Write your email…' : 'Write a reply… only this text is sent; their mail app files it under the same thread.'} />
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {files.map(f => <li key={f.id} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs"><FileText className="w-3.5 h-3.5 text-muted-foreground" /><span className="max-w-[180px] truncate">{f.name}</span><span className="text-muted-foreground">{fmtBytes(f.bytes)}</span><button type="button" onClick={() => setFiles(l => l.filter(x => x.id !== f.id))} className="p-0.5 text-muted-foreground hover:text-foreground" aria-label="Remove"><X className="w-3 h-3" /></button></li>)}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3">
          <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={addFile} disabled={uploading} />
          <Button type="button" variant="ghost" className="h-9 px-3 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}><Paperclip className="w-3.5 h-3.5" />{uploading ? 'Uploading…' : 'Attach'}</Button>
          <Button type="submit" variant="accent" disabled={sending || uploading || !body.trim() || !to}><Send className="w-4 h-4" />{sending ? 'Sending…' : needsSubject ? 'Send email' : 'Send reply'}</Button>
        </div>
      </form>
      {toastEl}
    </div>
  )
}
