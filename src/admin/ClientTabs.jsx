/* The four activity panels on a client record. Each fetches its own data
   the first time it is shown, and renders Bone skeletons while it does. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, Download, ExternalLink, FileText, Mail, Plus, Reply, Trash2, Upload } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Badge, Button, Card, Empty, Field, Input, Select, Table, Td, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { ACCEPT, isImage, openDocument, uploadDocument } from './documents'
import { Thumb } from './FileField'
import { PURCHASE_STATUSES, fmtBytes, fmtDate, fmtDateTime, fmtMoney, messageTone, purchaseTone, quoteTone } from './format'

const ext = d => (d.name.includes('.') ? d.name.split('.').pop().toUpperCase().slice(0, 5) : 'FILE')

/* ---------------------------------------------------------- documents --- */

export function DocumentsPanel({ clientId }) {
  const [docs, setDocs] = useState(null)
  const [queue, setQueue] = useState([])         // [{ name, error? }]
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)
  const [toast, toastEl] = useToast()

  useEffect(() => { adminFetch(`/documents?client_id=${clientId}`).then(setDocs).catch(e => toast(e.message, 'error')) }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async files => {
    for (const file of files) {
      setQueue(q => [...q, { name: file.name }])
      try { const d = await uploadDocument(file, { client_id: clientId }); setDocs(ds => [d, ...(ds || [])]); setQueue(q => q.filter(x => x.name !== file.name)) }
      catch (e) { setQueue(q => q.map(x => x.name === file.name ? { ...x, error: e.message } : x)) }
    }
  }
  const remove = async d => {
    if (!window.confirm(`Delete "${d.name}"? This cannot be undone.`)) return
    try { await adminFetch(`/documents/${d.id}`, { method: 'DELETE' }); setDocs(ds => ds.filter(x => x.id !== d.id)); toast('Document deleted') } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="space-y-5">
      <div onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); upload([...e.dataTransfer.files]) }}
        onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        className={`animate-fade-up cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${drag ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/60'}`}>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="sr-only" onChange={e => { upload([...e.target.files]); e.target.value = '' }} />
        <div className="w-11 h-11 rounded-xl bg-accent/15 text-accent flex items-center justify-center mx-auto mb-3"><Upload className="w-5 h-5" /></div>
        <p className="font-semibold">Drop files here, or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Images, PDF, Word, Excel, PowerPoint, CSV or text · up to 20 MB each · private to your team</p>
      </div>

      {queue.length > 0 && (
        <ul className="space-y-2">
          {queue.map(q => (
            <li key={q.name} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${q.error ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
              {q.error ? <span className="text-destructive">{q.name}: {q.error}</span> : <><Bone className="h-3 w-3 rounded-full" /><span className="truncate">{q.name}</span><span className="text-xs text-muted-foreground ml-auto">Uploading…</span></>}
              {q.error && <button className="ml-auto text-xs font-semibold" onClick={() => setQueue(x => x.filter(y => y.name !== q.name))}>Dismiss</button>}
            </li>
          ))}
        </ul>
      )}

      <Card className="animate-fade-up" style={{ animationDelay: '70ms' }}>
        <Table head={['', 'Name', 'Type', 'Size', 'Added', '']}>
          {!docs && [0, 1, 2].map(i => <tr key={i}><Td><Bone className="h-10 w-14" /></Td><Td><Bone className="h-4 w-48" /></Td><Td><Bone className="h-4 w-10" /></Td><Td><Bone className="h-4 w-12" /></Td><Td><Bone className="h-4 w-20" /></Td><Td /></tr>)}
          {docs?.map(d => (
            <tr key={d.id} className="hover:bg-muted/40">
              <Td className="w-16">{isImage(d) ? <Thumb id={d.id} className="h-10 w-14" /> : <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><FileText className="w-4 h-4" /></div>}</Td>
              <Td><button onClick={() => openDocument(d.id)} className="font-medium hover:text-accent text-left">{d.name}</button></Td>
              <Td><Badge>{ext(d)}</Badge></Td>
              <Td className="text-muted-foreground whitespace-nowrap">{fmtBytes(d.bytes)}</Td>
              <Td className="text-muted-foreground whitespace-nowrap">{fmtDate(d.created_at)}</Td>
              <Td className="text-right whitespace-nowrap">
                <button onClick={() => openDocument(d.id)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" title="Open" aria-label="Open"><ExternalLink className="w-4 h-4" /></button>
                <button onClick={() => openDocument(d.id, { download: true })} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" title="Download" aria-label="Download"><Download className="w-4 h-4" /></button>
                <button onClick={() => remove(d)} className="p-2 rounded-lg text-destructive hover:bg-muted" title="Delete" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
              </Td>
            </tr>
          ))}
          {docs?.length === 0 && <tr><Td colSpan={6}><Empty>No documents yet — drop the first one above.</Empty></Td></tr>}
        </Table>
      </Card>
      {toastEl}
    </div>
  )
}

/* ------------------------------------------------------------- quotes --- */

export function QuotesPanel({ clientId }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { adminFetch(`/quotes?client_id=${clientId}`).then(setRows).catch(() => setRows([])) }, [clientId])
  return (
    <Card className="animate-fade-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="font-semibold">Quotes</h2>
        <Link to={`/staff360/quotes/new?client=${clientId}`}><Button variant="accent" className="h-9"><Plus className="w-4 h-4" />New quote</Button></Link>
      </div>
      <Table head={['Number', 'Title', 'Total', 'Status', 'Valid until', '']}>
        {!rows && [0, 1].map(i => <tr key={i}>{[...Array(6)].map((_, j) => <Td key={j}><Bone className="h-4 w-20" /></Td>)}</tr>)}
        {rows?.map(q => (
          <tr key={q.id} className="hover:bg-muted/40">
            <Td><Link to={`/staff360/quotes/${q.id}`} className="font-medium hover:text-accent">{q.number}</Link></Td>
            <Td className="text-muted-foreground">{q.title || '—'}</Td>
            <Td className="font-medium whitespace-nowrap">{fmtMoney(q.total, q.currency)}</Td>
            <Td><Badge tone={quoteTone(q.status)}>{q.status}</Badge></Td>
            <Td className="text-muted-foreground whitespace-nowrap">{fmtDate(q.valid_until)}</Td>
            <Td className="text-right"><Link to={`/staff360/quotes/${q.id}`} className="text-xs font-semibold text-accent">Open →</Link></Td>
          </tr>
        ))}
        {rows?.length === 0 && <tr><Td colSpan={6}><Empty>No quotes for this client yet.</Empty></Td></tr>}
      </Table>
    </Card>
  )
}

/* ----------------------------------------------------------- messages --- */

export function MessagesPanel({ clientId, onCompose, onReply, refreshKey = 0 }) {
  const [rows, setRows] = useState(null)
  const [openId, setOpenId] = useState(null)
  useEffect(() => { setRows(null); adminFetch(`/messages?client_id=${clientId}`).then(setRows).catch(() => setRows([])) }, [clientId, refreshKey])
  return (
    <Card className="animate-fade-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="font-semibold">Emails</h2>
        <Button variant="accent" className="h-9" onClick={onCompose}><Mail className="w-4 h-4" />New email</Button>
      </div>
      <ul className="divide-y divide-border">
        {!rows && [0, 1, 2].map(i => <li key={i} className="px-5 py-4 space-y-2"><Bone className="h-4 w-64" /><Bone className="h-3 w-40" /></li>)}
        {rows?.map(m => (
          <li key={m.id}>
            <button onClick={() => setOpenId(openId === m.id ? null : m.id)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40">
              {openId === m.id ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.direction === 'in' ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary'}`}>{m.direction === 'in' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}</span>
              <div className="min-w-0 flex-1">
                <p className={`truncate ${m.direction === 'in' && !m.read_at ? 'font-bold' : 'font-medium'}`}>{m.subject}</p>
                <p className="text-xs text-muted-foreground truncate">{m.direction === 'in' ? `from ${m.from_name || m.from_email}` : `to ${m.to_email}`} · {fmtDateTime(m.created_at)}{m.attachments?.length ? ` · ${m.attachments.length} attachment${m.attachments.length > 1 ? 's' : ''}` : ''}{m.quote_id ? ' · quote' : ''}</p>
              </div>
              <Badge tone={messageTone(m.status)}>{m.status}</Badge>
            </button>
            {openId === m.id && (
              <div className="px-5 pb-5 pl-12 text-sm">
                {m.status === 'failed' && <p className="mb-3 rounded-xl bg-destructive/10 text-destructive px-3 py-2 text-xs">{m.error}</p>}
                <p className="whitespace-pre-wrap text-foreground/90">{m.body}</p>
                {m.attachments?.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Attached: {m.attachments.map(a => a.name).join(', ')}</p>}
                <div className="mt-3 flex gap-2">
                  {m.direction === 'in' && onReply && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => onReply(m)}><Reply className="w-3.5 h-3.5" />Reply</Button>}
                  <Link to={`/staff360/messages/${m.id}`} className="inline-flex items-center h-8 px-3 rounded-xl text-xs font-semibold text-accent hover:bg-muted">Open →</Link>
                </div>
              </div>
            )}
          </li>
        ))}
        {rows?.length === 0 && <li><Empty>Nothing sent yet.</Empty></li>}
      </ul>
    </Card>
  )
}

/* ---------------------------------------------------------- purchases --- */

const EMPTY_P = { description: '', amount: '', currency: 'USD', status: 'pending', purchased_at: new Date().toISOString().slice(0, 10), reference: '' }

export function PurchasesPanel({ clientId, defaultCurrency = 'USD' }) {
  const [rows, setRows] = useState(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_P, currency: defaultCurrency })
  const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()

  const load = useCallback(() => adminFetch(`/purchases?client_id=${clientId}`).then(setRows).catch(() => setRows([])), [clientId])
  useEffect(() => { load() }, [load])

  const add = async e => {
    e.preventDefault(); setBusy(true)
    try { await adminFetch('/purchases', { method: 'POST', body: { ...form, client_id: clientId } }); setForm({ ...EMPTY_P, currency: defaultCurrency }); setAdding(false); toast('Purchase recorded'); load() }
    catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const setStatus = async (p, status) => { try { await adminFetch(`/purchases/${p.id}`, { method: 'PATCH', body: { status } }); load() } catch (x) { toast(x.message, 'error') } }
  const remove = async p => {
    if (!window.confirm(`Delete this purchase (${p.description})?`)) return
    try { await adminFetch(`/purchases/${p.id}`, { method: 'DELETE' }); load() } catch (x) { toast(x.message, 'error') }
  }
  const totals = (rows || []).reduce((acc, p) => { if (p.status !== 'cancelled') { acc[p.currency] = (acc[p.currency] || 0) + Number(p.amount) } return acc }, {})

  return (
    <div className="space-y-5">
      <Card className="animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold">Purchases</h2>
            {rows?.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">Lifetime (excl. cancelled): {Object.entries(totals).map(([c, v]) => fmtMoney(v, c)).join(' · ')}</p>}
          </div>
          <Button variant="accent" className="h-9" onClick={() => setAdding(a => !a)}><Plus className="w-4 h-4" />Add purchase</Button>
        </div>
        {adding && (
          <form onSubmit={add} className="grid md:grid-cols-6 gap-4 items-end p-5 border-b border-border bg-muted/30 animate-fade-up">
            <Field label="Description" className="md:col-span-2"><Input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. 20 MT cocoa beans" /></Field>
            <Field label="Amount"><Input type="number" min="0" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Currency"><Input maxLength={3} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Field>
            <Field label="Date"><Input type="date" value={form.purchased_at} onChange={e => setForm({ ...form, purchased_at: e.target.value })} /></Field>
            <Field label="Status"><Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{PURCHASE_STATUSES.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Reference" hint="PO or invoice number" className="md:col-span-2"><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></Field>
            <div className="md:col-span-4 flex gap-2 justify-end"><Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button><Button type="submit" variant="accent" disabled={busy}>{busy ? 'Saving…' : 'Save purchase'}</Button></div>
          </form>
        )}
        <Table head={['Date', 'Reference', 'Description', 'Amount', 'Status', '']}>
          {!rows && [0, 1].map(i => <tr key={i}>{[...Array(6)].map((_, j) => <Td key={j}><Bone className="h-4 w-20" /></Td>)}</tr>)}
          {rows?.map(p => (
            <tr key={p.id} className="hover:bg-muted/40">
              <Td className="text-muted-foreground whitespace-nowrap">{fmtDate(p.purchased_at)}</Td>
              <Td className="text-muted-foreground">{p.reference || '—'}</Td>
              <Td className="font-medium">{p.description}</Td>
              <Td className="font-medium whitespace-nowrap">{fmtMoney(p.amount, p.currency)}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Badge tone={purchaseTone(p.status)}>{p.status}</Badge>
                  <Select value={p.status} onChange={e => setStatus(p, e.target.value)} className="h-8 w-32 text-xs">{PURCHASE_STATUSES.map(s => <option key={s}>{s}</option>)}</Select>
                </div>
              </Td>
              <Td className="text-right"><button onClick={() => remove(p)} className="p-2 rounded-lg text-destructive hover:bg-muted" title="Delete" aria-label="Delete"><Trash2 className="w-4 h-4" /></button></Td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><Td colSpan={6}><Empty>No purchases yet. Convert an accepted quote, or add one above.</Empty></Td></tr>}
        </Table>
      </Card>
      {toastEl}
    </div>
  )
}
