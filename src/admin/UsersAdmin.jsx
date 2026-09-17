import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Button, Card, Field, Input, Select, PageHeader, Table, Td, Badge, Alert, useToast } from './ui'
import { Bone } from '../components/Skeleton'

const ROLES = ['admin', 'editor', 'sales']

export default function UsersAdmin() {
  const { me } = useAuth()
  const [rows, setRows] = useState(null); const [err, setErr] = useState(null)
  const [inv, setInv] = useState({ email: '', name: '', position: '', role: 'editor' }); const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()

  const load = useCallback(() => adminFetch('/users').then(setRows).catch(e => setErr(e.message)), [])
  useEffect(() => { load() }, [load])

  const invite = async e => {
    e.preventDefault(); setBusy(true)
    try { const r = await adminFetch('/users/invite', { method: 'POST', body: inv }); toast(r.warning ? `Invite sent to ${inv.email}. ${r.warning}` : `Invite sent to ${inv.email}${r.via === 'resend' ? ' with your template' : ''}`, r.warning ? 'error' : 'ok'); setInv({ email: '', name: '', position: '', role: 'editor' }); load() }
    catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  const patch = async (u, body) => {
    try { await adminFetch(`/users/${u.id}`, { method: 'PATCH', body }); load() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <PageHeader title="Users" description="Accounts are invite-only. Roles are enforced by the server. Open a user to edit their details and see whether they have accepted the invite." />
      {err && <Alert>{err}</Alert>}
      <Card className="p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4 text-accent" />Invite a user</h2>
        <form onSubmit={invite} className="grid md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_0.7fr_auto] gap-4 items-end">
          <Field label="Email"><Input type="email" required value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} placeholder="name@vertocagro.com" /></Field>
          <Field label="Name"><Input value={inv.name} onChange={e => setInv({ ...inv, name: e.target.value })} placeholder="Precious Ubadire" /></Field>
          <Field label="Position"><Input value={inv.position} onChange={e => setInv({ ...inv, position: e.target.value })} placeholder="Managing Director" /></Field>
          <Field label="Role"><Select value={inv.role} onChange={e => setInv({ ...inv, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</Select></Field>
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">The name and position sign the emails they write from Messages ("Precious Ubadire, Managing Director"). Invoices, confirmations and notifications sign as the company.</p>
      </Card>
      <Card>
        <Table head={['User', 'Role', 'Status', 'Joined', '']}>
          {!rows && [0, 1].map(i => <tr key={i}>{[0, 1, 2, 3, 4].map(j => <Td key={j}><Bone className="h-4 w-24" /></Td>)}</tr>)}
          {rows?.map(u => {
            const self = u.id === me.id
            return (
              <tr key={u.id} className="hover:bg-muted/40">
                <Td><Link to={`/staff360/users/${u.id}`} className="font-medium hover:text-accent">{u.name || u.email}</Link>{self && <Badge tone="blue" className="ml-2">you</Badge>}<div className="text-xs text-muted-foreground">{u.email}{u.position ? ` · ${u.position}` : ''}</div></Td>
                <Td><Select value={u.role} disabled={self} onChange={e => patch(u, { role: e.target.value })} className="w-32">{ROLES.map(r => <option key={r}>{r}</option>)}</Select></Td>
                <Td><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'active' : 'inactive'}</Badge></Td>
                <Td className="text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</Td>
                <Td className="text-right whitespace-nowrap"><Button variant={u.active ? 'outline' : 'accent'} disabled={self} onClick={() => patch(u, { active: !u.active })} className="h-8 px-3 text-xs">{u.active ? 'Deactivate' : 'Activate'}</Button><Link to={`/staff360/users/${u.id}`} className="ml-3 text-xs font-semibold text-accent">Open →</Link></Td>
              </tr>
            )
          })}
        </Table>
      </Card>
      {toastEl}
    </>
  )
}
