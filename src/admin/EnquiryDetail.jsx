import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Link2, Mail, Phone, UserPlus } from 'lucide-react'
import Composer from './Composer'
import { fmtDateTime, messageTone } from './format'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Select, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { STAGES, stageTone } from './EnquiriesAdmin'

export default function EnquiryDetail() {
  const { id } = useParams(); const nav = useNavigate()
  const [e, setE] = useState(null)
  const [clients, setClients] = useState([])
  const [err, setErr] = useState(null)
  const [notes, setNotes] = useState('')
  const [replies, setReplies] = useState(null)
  const [compose, setCompose] = useState(false)
  const [toast, toastEl] = useToast()

  useEffect(() => {
    adminFetch(`/enquiries/${id}`).then(x => { setE(x); setNotes(x.notes || '') }).catch(er => setErr(er.message))
    adminFetch('/clients?status=active').then(setClients).catch(() => {})
    adminFetch(`/messages?enquiry_id=${id}`).then(setReplies).catch(() => setReplies([]))
  }, [id])

  const patch = async (body, msg) => {
    try { const x = await adminFetch(`/enquiries/${id}`, { method: 'PATCH', body }); setE(x); if (msg) toast(msg) }
    catch (er) { toast(er.message, 'error') }
  }
  const createClient = () => {
    const data = {}; if (e.email) data.email = e.email; if (e.phone) data.phone = e.phone
    nav('/admin/clients/new', { state: { prefill: { name: e.name, data }, linkEnquiry: e.id } })
  }

  if (err) return <Alert>{err}</Alert>
  if (!e) return (
    <div className="space-y-4 max-w-3xl"><Bone className="h-4 w-24" /><Bone className="h-9 w-72" />
      <Card className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Bone key={i} className="h-4 w-full" />)}</Card></div>
  )

  const isQuote = e.kind === 'quote'
  const stages = STAGES[e.kind] || STAGES.contact
  const rows = isQuote
    ? [['Commodity', e.commodity], ['Quantity', e.quantity], ['Destination / port', e.destination], ['Notes from client', e.message]]
    : [['Subject', e.subject], ['Message', e.message]]
  const linked = clients.find(c => c.id === e.client_id)

  return (
    <>
      <Link to={`/admin/enquiries?kind=${e.kind}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />{isQuote ? 'Quote requests' : 'Messages'}</Link>
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 max-w-5xl">
        <div className="space-y-6">
          <Card className="p-6 animate-fade-up">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">{isQuote ? 'Quote request' : 'Message'} · {new Date(e.created_at).toLocaleString()}</p>
                <h1 className="font-serif text-2xl md:text-3xl font-bold">{e.name}</h1>
              </div>
              <Badge tone={stageTone(e.status)}>{e.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm mb-6">
              <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1.5 text-accent font-medium"><Mail className="w-4 h-4" />{e.email}</a>
              {e.phone && <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1.5 text-accent font-medium"><Phone className="w-4 h-4" />{e.phone}</a>}
            </div>
            <dl className="divide-y divide-border">
              {rows.map(([k, v]) => (
                <div key={k} className="grid sm:grid-cols-[180px_1fr] gap-1 py-3 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap">{v || '—'}</dd></div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button variant="accent" onClick={() => setCompose(true)}><Mail className="w-4 h-4" />Reply by email</Button>
              <a href={`mailto:${e.email}?subject=${encodeURIComponent('Re: your enquiry to Vertoc Agro')}`} className="text-xs text-muted-foreground hover:text-foreground">or use your own mail app</a>
            </div>
          </Card>

          <Card className="animate-fade-up" style={{ animationDelay: '60ms' }}>
            <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Replies sent</h2></div>
            <ul className="divide-y divide-border">
              {!replies && <li className="px-5 py-4"><Bone className="h-4 w-56" /></li>}
              {replies?.map(m => (
                <li key={m.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center gap-2"><span className="font-medium truncate flex-1">{m.subject}</span><Badge tone={messageTone(m.status)}>{m.status}</Badge></div>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(m.created_at)}{m.status === 'failed' ? ` · ${m.error}` : ''}</p>
                </li>
              ))}
              {replies?.length === 0 && <li className="px-5 py-6 text-center text-xs text-muted-foreground">No replies sent from the panel yet.</li>}
            </ul>
          </Card>

          <Card className="p-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
            <Field label="Internal notes" hint="Only your team sees these."><Textarea rows={5} value={notes} onChange={ev => setNotes(ev.target.value)} /></Field>
            <div className="mt-3"><Button variant="outline" disabled={notes === (e.notes || '')} onClick={() => patch({ notes }, 'Notes saved')}>Save notes</Button></div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 animate-fade-up" style={{ animationDelay: '120ms' }}>
            <Field label="Status">
              <Select value={e.status} onChange={ev => patch({ status: ev.target.value }, 'Status updated')}>{stages.map(s => <option key={s} value={s}>{s}</option>)}</Select>
            </Field>
            {e.status_changed_at && <p className="text-xs text-muted-foreground mt-2">Changed {new Date(e.status_changed_at).toLocaleString()}</p>}
          </Card>

          <Card className="p-6 animate-fade-up" style={{ animationDelay: '160ms' }}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Link2 className="w-4 h-4 text-accent" />Client</h2>
            {e.client_id ? (
              <div className="flex items-center justify-between gap-3">
                <Link to={`/admin/clients/${e.client_id}`} className="font-medium text-accent hover:underline">{linked?.name || `Client #${e.client_id}`}</Link>
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => patch({ client_id: null }, 'Unlinked')}>Unlink</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Select value="" onChange={ev => ev.target.value && patch({ client_id: Number(ev.target.value) }, 'Linked to client')}>
                  <option value="">Link to an existing client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Button variant="outline" className="w-full" onClick={createClient}><UserPlus className="w-4 h-4" />Create client from this</Button>
              </div>
            )}
          </Card>
        </div>
      </div>
      <Composer open={compose} onClose={() => setCompose(false)} title={`Reply to ${e.name}`} to={e.email}
        subject={`Re: your ${isQuote ? 'quote request' : 'enquiry'} to Vertoc Agro`} body={`Dear ${e.name},\n\nThank you for your ${isQuote ? `enquiry about ${e.commodity || 'our commodities'}` : 'message'}.\n\n`}
        clientId={e.client_id} enquiryId={e.id}
        onSent={() => { toast('Reply sent'); adminFetch(`/enquiries/${id}`).then(setE).catch(() => {}); adminFetch(`/messages?enquiry_id=${id}`).then(setReplies).catch(() => {}) }} />
      {toastEl}
    </>
  )
}
