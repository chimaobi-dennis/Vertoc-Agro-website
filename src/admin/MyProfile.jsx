import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { AvatarEditor } from './Avatar'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, useToast } from './ui'
import { fmtDateTime } from './format'

/** The signed-in person's own profile: they keep their picture, name and phone; the rest is staff management's. */
export default function MyProfile() {
  const { me, refresh } = useAuth()
  const [full, setFull] = useState(null); const [users, setUsers] = useState([])
  const [f, setF] = useState({ name: '', phone: '' }); const [busy, setBusy] = useState(false); const [toast, toastEl] = useToast()
  useEffect(() => { adminFetch('/me').then(x => { setFull(x); setF({ name: x.name || '', phone: x.phone || '' }) }); adminFetch('/directory').then(setUsers).catch(() => {}) }, [])
  if (!full) return null
  const boss = users.find(u => u.id === full.reports_to)
  const save = async e => { e.preventDefault(); setBusy(true); try { await adminFetch('/me/profile', { method: 'PATCH', body: f }); toast('Saved'); refresh?.() } catch (x) { toast(x.message, 'error') } finally { setBusy(false) } }
  const row = (l, v) => <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">{l}</dt><dd className="font-medium mt-0.5">{v || '—'}</dd></div>
  return (
    <>
      <PageHeader eyebrow="Account" title="My profile" description="Your picture, name and phone number are yours to keep up to date. Your role and access are set by an admin." />
      <div className="max-w-3xl space-y-6">
        <Card className="p-6"><AvatarEditor src={full.avatar_url} name={full.name || full.email} endpoint="/me/avatar" onChanged={url => { setFull(x => ({ ...x, avatar_url: url })); refresh?.() }} /></Card>
        <form onSubmit={save}><Card className="p-6 grid sm:grid-cols-2 gap-5">
          <Field label="Full name"><Input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Phone number"><Input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="+234…" /></Field>
          <div className="sm:col-span-2"><Button type="submit" variant="accent" disabled={busy || (f.name === full.name && f.phone === (full.phone || ''))}>{busy ? 'Saving…' : 'Save'}</Button></div>
        </Card></form>
        <Card className="p-6"><dl className="grid sm:grid-cols-3 gap-5 text-sm">
          {row('Staff ID', full.staff_id && <span className="font-mono">{full.staff_id}</span>)}{row('Email', full.email)}{row('Role', full.role_name)}
          {row('Position', full.position)}{row('Department', full.department)}{row('Reports to', boss && (boss.name || boss.email))}
        </dl><p className="text-xs text-muted-foreground mt-5">Your Staff ID was given when you joined and never changes.</p></Card>
      </div>
      {toastEl}
    </>
  )
}
