import { useCallback, useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Button, Card, Field, Input, Select, PageHeader, Table, Td, Badge, Alert, useToast } from './ui'
import { Bone } from '../components/Skeleton'

const ROLES = ['admin', 'editor', 'sales']

export default function UsersAdmin() {
  const { me } = useAuth()
  const [rows, setRows] = useState(null); const [err, setErr] = useState(null)
  const [inv, setInv] = useState({ email: '', name: '', role: 'editor' }); const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()

  const load = useCallback(() => adminFetch('/users').then(setRows).catch(e => setErr(e.message)), [])
  useEffect(() => { load() }, [load])

  const invite = async e => {
    e.preventDefault(); setBusy(true)
    try { await adminFetch('/users/invite', { method: 'POST', body: inv }); toast(`Invite sent to ${inv.email}`); setInv({ email: '', name: '', role: 'editor' }); load() }
    catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  const patch = async (u, body) => {
    try { await adminFetch(`/users/${u.id}`, { method: 'PATCH', body }); load() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <PageHeader title="Users" description="Accounts are invite-only. Roles are enforced by the server." />
      {err && <Alert>{err}</Alert>}
      <Card className="p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4 text-accent" />Invite a user</h2>
        <form onSubmit={invite} className="grid md:grid-cols-4 gap-4 items-end">
          <Field label="Email"><Input type="email" required value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} /></Field>
          <Field label="Name"><Input value={inv.name} onChange={e => setInv({ ...inv, name: e.target.value })} /></Field>
          <Field label="Role"><Select value={inv.role} onChange={e => setInv({ ...inv, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</Select></Field>
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</Button>
        </form>
      </Card>
      <Card>
        <Table head={['User', 'Role', 'Status', 'Joined', '']}>
          {!rows && [0, 1].map(i => <tr key={i}>{[0, 1, 2, 3, 4].map(j => <Td key={j}><Bone className="h-4 w-24" /></Td>)}</tr>)}
          {rows?.map(u => {
            const self = u.id === me.id
            return (
              <tr key={u.id} className="hover:bg-muted/40">
                <Td><span className="font-medium">{u.name || '—'}</span>{self && <Badge tone="blue"> you</Badge>}<div className="text-xs text-muted-foreground">{u.email}</div></Td>
                <Td><Select value={u.role} disabled={self} onChange={e => patch(u, { role: e.target.value })} className="w-32">{ROLES.map(r => <option key={r}>{r}</option>)}</Select></Td>
                <Td><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'active' : 'inactive'}</Badge></Td>
                <Td className="text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</Td>
                <Td className="text-right"><Button variant={u.active ? 'outline' : 'accent'} disabled={self} onClick={() => patch(u, { active: !u.active })} className="h-8 px-3 text-xs">{u.active ? 'Deactivate' : 'Activate'}</Button></Td>
              </tr>
            )
          })}
        </Table>
      </Card>
      {toastEl}
    </>
  )
}
