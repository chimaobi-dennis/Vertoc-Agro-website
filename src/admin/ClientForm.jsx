import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArchiveRestore, ArrowLeft, Trash2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Table, Td, confirmDelete, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import DynamicField from './DynamicField'

const tone = s => ({ new: 'amber', won: 'green', lost: 'red', archived: 'muted' })[s] || 'blue'

export default function ClientForm() {
  const { id } = useParams(); const editing = Boolean(id)
  const nav = useNavigate()
  const { prefill, linkEnquiry } = useLocation().state || {}
  const [fields, setFields] = useState(null)
  const [client, setClient] = useState(null)
  const [enqs, setEnqs] = useState([])
  const [name, setName] = useState(prefill?.name || '')
  const [data, setData] = useState(prefill?.data || {})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [toast, toastEl] = useToast()

  useEffect(() => {
    adminFetch('/client-fields').then(setFields).catch(e => setErr(e.message))
    if (editing) adminFetch(`/clients/${id}`)
      .then(c => { setClient(c); setName(c.name); setData(c.data || {}); setEnqs(c.enquiries || []) })
      .catch(e => setErr(e.message))
  }, [id, editing])

  const submit = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      if (editing) { await adminFetch(`/clients/${id}`, { method: 'PATCH', body: { name, data } }); toast('Saved') }
      else {
        const c = await adminFetch('/clients', { method: 'POST', body: { name, data } })
        if (linkEnquiry) await adminFetch(`/enquiries/${linkEnquiry}`, { method: 'PATCH', body: { client_id: c.id } }).catch(() => {})
        nav(`/admin/clients/${c.id}`, { replace: true }); return
      }
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const setStatus = async status => {
    try { const c = await adminFetch(`/clients/${id}`, { method: 'PATCH', body: { status } }); setClient(c); toast(status === 'archived' ? 'Client archived' : 'Client restored') }
    catch (e) { toast(e.message, 'error') }
  }
  const remove = async () => {
    if (!confirmDelete(client.name)) return
    try { await adminFetch(`/clients/${id}`, { method: 'DELETE' }); nav('/admin/clients') } catch (e) { toast(e.message, 'error') }
  }

  const loading = !fields || (editing && !client)

  return (
    <>
      <Link to="/admin/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Clients</Link>
      <PageHeader eyebrow="CRM" title={editing ? (client?.name || ' ') : 'New client'}
        description={editing && client ? `Added ${client.created_at.slice(0, 10)}` : 'Only the name is required.'}
        action={editing && client && <Badge tone={client.status === 'active' ? 'green' : 'muted'}>{client.status}</Badge>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      {loading ? (
        <Card className="p-6 grid md:grid-cols-2 gap-5 max-w-4xl">
          {[...Array(6)].map((_, i) => <div key={i}><Bone className="h-4 w-24 mb-2" /><Bone className="h-11 w-full" /></div>)}
        </Card>
      ) : (
        <form onSubmit={submit} className="space-y-6 max-w-4xl">
          <Card className="p-6 grid md:grid-cols-2 gap-5 animate-fade-up">
            <Field label="Name *" className="md:col-span-2"><Input required value={name} onChange={e => setName(e.target.value)} placeholder="Company or person" /></Field>
            {fields.map(f => <DynamicField key={f.key} field={f} value={data[f.key]} onChange={v => setData(d => ({ ...d, [f.key]: v }))} />)}
            {!fields.length && (
              <p className="md:col-span-2 text-sm text-muted-foreground">No custom fields yet — <Link to="/admin/clients/fields" className="text-accent font-semibold">define what you want to track</Link>.</p>
            )}
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create client'}</Button>
            {editing && client && (client.status === 'active'
              ? <Button type="button" variant="outline" onClick={() => setStatus('archived')}><Archive className="w-4 h-4" />Archive</Button>
              : <Button type="button" variant="outline" onClick={() => setStatus('active')}><ArchiveRestore className="w-4 h-4" />Restore</Button>)}
            {editing && <Button type="button" variant="ghost" className="text-destructive ml-auto" onClick={remove}><Trash2 className="w-4 h-4" />Delete</Button>}
          </div>
        </form>
      )}

      {editing && client && (
        <Card className="mt-8 max-w-4xl animate-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold">Enquiries from this client</h2></div>
          <Table head={['Date', 'Type', 'Subject', 'Status', '']}>
            {enqs.map(e => (
              <tr key={e.id} className="hover:bg-muted/40">
                <Td className="text-xs text-muted-foreground whitespace-nowrap">{e.created_at.slice(0, 10)}</Td>
                <Td className="capitalize">{e.kind}</Td>
                <Td>{e.commodity || e.subject || '—'}</Td>
                <Td><Badge tone={tone(e.status)}>{e.status}</Badge></Td>
                <Td className="text-right"><Link to={`/admin/enquiries/${e.id}`} className="text-xs font-semibold text-accent">Open →</Link></Td>
              </tr>
            ))}
            {!enqs.length && <tr><Td colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No enquiries linked yet.</Td></tr>}
          </Table>
        </Card>
      )}
      {toastEl}
    </>
  )
}
