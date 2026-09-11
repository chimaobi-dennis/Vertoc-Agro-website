import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, FileText, Mail, MailOpen, Reply, UserPlus } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import Composer from './Composer'
import { openDocument } from './documents'
import { fmtDateTime, messageTone } from './format'

export default function MessageDetail() {
  const { id } = useParams(); const nav = useNavigate()
  const [m, setM] = useState(null)
  const [err, setErr] = useState(null)
  const [client, setClient] = useState(null)
  const [quote, setQuote] = useState(null)
  const [view, setView] = useState('text')
  const [compose, setCompose] = useState(false)
  const [toast, toastEl] = useToast()

  useEffect(() => {
    adminFetch(`/messages/${id}`).then(async x => {
      setM(x)
      if (x.direction === 'in' && !x.read_at) adminFetch(`/messages/${id}/read`, { method: 'POST', body: {} }).then(setM).catch(() => {})
      if (x.client_id) adminFetch(`/clients/${x.client_id}`).then(setClient).catch(() => {})
      if (x.quote_id) adminFetch(`/quotes/${x.quote_id}`).then(setQuote).catch(() => {})
    }).catch(e => setErr(e.message))
  }, [id])

  const toggleRead = async () => { try { setM(await adminFetch(`/messages/${id}/read`, { method: 'POST', body: { read: !m.read_at } })); toast(m.read_at ? 'Marked unread' : 'Marked read') } catch (e) { toast(e.message, 'error') } }
  const createClient = () => nav('/staff360/clients/new', { state: { prefill: { name: m.from_name || m.from_email, data: { email: m.from_email } } } })

  if (err) return <Alert>{err}</Alert>
  if (!m) return <div className="max-w-4xl space-y-4"><Bone className="h-4 w-24" /><Bone className="h-9 w-2/3" /><Card className="p-6 space-y-3">{[...Array(6)].map((_, i) => <Bone key={i} className="h-4 w-full" />)}</Card></div>

  const inbound = m.direction === 'in'
  const quoted = `\n\n\nOn ${fmtDateTime(m.created_at)}, ${m.from_name || m.from_email} wrote:\n${String(m.body || '').split('\n').map(l => '> ' + l).join('\n')}`

  return (
    <>
      <Link to={`/staff360/messages${inbound ? '' : '?direction=out'}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Messages</Link>
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 max-w-6xl items-start">
        <Card className="animate-fade-up">
          <div className="p-6 border-b border-border">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">{inbound ? 'Received' : 'Sent'} · {fmtDateTime(m.created_at)}</p>
                <h1 className="font-serif text-2xl font-bold break-words">{m.subject || '(no subject)'}</h1>
              </div>
              <Badge tone={messageTone(m.status)}>{m.status}</Badge>
            </div>
            <dl className="mt-4 grid sm:grid-cols-[80px_1fr] gap-y-1 text-sm">
              <dt className="text-muted-foreground">From</dt><dd className="break-all">{inbound ? (m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email) : m.from_email}</dd>
              <dt className="text-muted-foreground">To</dt><dd className="break-all">{m.to_name ? `${m.to_name} <${m.to_email}>` : m.to_email}</dd>
            </dl>
            {m.status === 'failed' && <p className="mt-3 rounded-xl bg-destructive/10 text-destructive px-3 py-2 text-xs">{m.error}</p>}
          </div>
          {inbound && m.html && (
            <div className="px-6 pt-4 flex gap-1 text-xs font-semibold">
              {[['text', 'Text'], ['html', 'Original']].map(([k, l]) => <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 rounded-full border ${view === k ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>{l}</button>)}
            </div>
          )}
          <div className="p-6">
            {view === 'html' && m.html
              ? <iframe title="Original email" sandbox="" srcDoc={m.html} className="w-full h-[520px] rounded-xl border border-border bg-white" />
              : <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>}
          </div>
          {m.attachments?.length > 0 && (
            <div className="px-6 pb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Attachments</h2>
              <ul className="flex flex-wrap gap-2">
                {m.attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <FileText className="w-4 h-4 text-primary" /><span className="max-w-[220px] truncate">{a.name}</span>
                    {a.document_id && <>
                      <button onClick={() => openDocument(a.document_id)} className="p-1 rounded text-muted-foreground hover:text-foreground" title="Open" aria-label="Open"><ExternalLink className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openDocument(a.document_id, { download: true })} className="p-1 rounded text-muted-foreground hover:text-foreground" title="Download" aria-label="Download"><Download className="w-3.5 h-3.5" /></button>
                    </>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5 space-y-2 animate-fade-up" style={{ animationDelay: '80ms' }}>
            {inbound && <Button variant="accent" className="w-full" onClick={() => setCompose(true)}><Reply className="w-4 h-4" />Reply</Button>}
            {inbound && <Button variant="outline" className="w-full" onClick={toggleRead}>{m.read_at ? <><Mail className="w-4 h-4" />Mark as unread</> : <><MailOpen className="w-4 h-4" />Mark as read</>}</Button>}
            {!inbound && <Button variant="outline" className="w-full" onClick={() => setCompose(true)}><Mail className="w-4 h-4" />Email again</Button>}
          </Card>
          <Card className="p-5 animate-fade-up text-sm space-y-3" style={{ animationDelay: '140ms' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked to</h2>
            <p><span className="text-muted-foreground">Client · </span>{m.client_id ? <Link to={`/staff360/clients/${m.client_id}?tab=messages`} className="font-medium text-accent">{client?.name || `#${m.client_id}`}</Link> : <span className="text-muted-foreground">none</span>}</p>
            {!m.client_id && inbound && <Button variant="outline" className="w-full h-9" onClick={createClient}><UserPlus className="w-4 h-4" />Create client from sender</Button>}
            <p><span className="text-muted-foreground">Quote · </span>{m.quote_id ? <Link to={`/staff360/quotes/${m.quote_id}`} className="font-medium text-accent">{quote?.number || `#${m.quote_id}`}</Link> : <span className="text-muted-foreground">none</span>}</p>
            <p><span className="text-muted-foreground">Enquiry · </span>{m.enquiry_id ? <Link to={`/staff360/enquiries/${m.enquiry_id}`} className="font-medium text-accent">#{m.enquiry_id}</Link> : <span className="text-muted-foreground">none</span>}</p>
          </Card>
        </div>
      </div>
      <Composer open={compose} onClose={() => setCompose(false)} title={inbound ? `Reply to ${m.from_name || m.from_email}` : `Email ${m.to_name || m.to_email}`}
        to={inbound ? m.from_email : m.to_email} subject={inbound ? (/^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`) : m.subject} body={inbound ? quoted : ''}
        clientId={m.client_id} quoteId={inbound ? null : m.quote_id} enquiryId={m.enquiry_id}
        onSent={() => { toast('Sent'); nav('/staff360/messages?direction=out') }} />
      {toastEl}
    </>
  )
}
