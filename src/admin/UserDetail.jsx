import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, KeyRound, Send, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtDateTime } from './format'
import { PermissionMatrix, useRoles } from './Permissions'

/** One staff account: profile (editable), sign-in facts from Supabase Auth, recent activity. */
export default function UserDetail() {
  const { id } = useParams()
  const { me, can } = useAuth()
  const { data: roleData } = useRoles()
  const [custom, setCustom] = useState(null)      // this person's own permissions while being edited; null = the role's
  const [user, setUser] = useState(null)
  const [form, setForm] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, toastEl] = useToast()

  const load = useCallback(() => adminFetch(`/users/${id}`).then(u => { setUser(u); setCustom(u.permissions || null); setForm({ name: u.name || '', email: u.email || '', role: u.role_key || u.role, position: u.position || '' }) }).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])

  const self = user && me && user.id === me.id
  const manage = can('staff', 'manage')
  const roles = roleData?.roles || []
  const roleOf = key => roles.find(r => r.key === key)
  const dirty = user && form && (form.name !== (user.name || '') || form.email !== user.email || form.role !== (user.role_key || user.role) || form.position !== (user.position || ''))

  const save = async e => {
    e.preventDefault(); setBusy(true)
    const body = {}
    if (form.name !== (user.name || '')) body.name = form.name
    if (form.email !== user.email) body.email = form.email
    if (form.role !== (user.role_key || user.role)) body.role = form.role
    if (form.position !== (user.position || '')) body.position = form.position
    try { await adminFetch(`/users/${id}`, { method: 'PATCH', body }); toast(body.email ? 'Saved. The new address is what they sign in with from now on.' : 'Saved'); load() }
    catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const savePerms = async permissions => {
    setBusy(true)
    try { await adminFetch(`/users/${id}`, { method: 'PATCH', body: { permissions } }); toast(permissions ? 'Permissions saved' : "Back on the role's permissions"); load() }
    catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const toggleActive = async () => {
    try { await adminFetch(`/users/${id}`, { method: 'PATCH', body: { active: !user.active } }); toast(user.active ? 'Account deactivated' : 'Account activated'); load() }
    catch (x) { toast(x.message, 'error') }
  }
  const sendLink = async () => {
    setSending(true)
    try {
      const r = await adminFetch(`/users/${id}/send-link`, { method: 'POST' })
      const what = r.kind === 'reinvite' ? 'Invitation sent again' : 'Set-password link sent'
      toast(r.warning ? `${what}. ${r.warning}` : `${what}${r.via === 'resend' ? ' with your template' : ' with the plain Supabase email'}`, r.warning ? 'error' : 'ok')
      load()
    } catch (x) { toast(x.message, 'error') } finally { setSending(false) }
  }

  const a = user?.auth
  const pending = a && a.invite === 'pending'

  return (
    <>
      <Link to="/staff360/staff" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Staff</Link>
      <PageHeader eyebrow="System" title={user ? (user.name || user.email) : ' '} description={user ? `${user.email} · ${roleOf(user.role_key)?.name || user.role}` : ' '}
        action={user && (
          <div className="flex flex-wrap items-center gap-2">
            {self && <Badge tone="blue">you</Badge>}
            {a && <Badge tone={pending ? 'amber' : 'green'}>{pending ? 'invite pending' : 'invite accepted'}</Badge>}
            <Badge tone={user.active ? 'green' : 'red'}>{user.active ? 'active' : 'inactive'}</Badge>
          </div>
        )} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      {!user || !form ? (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6"><Card className="p-6 space-y-4">{[...Array(4)].map((_, i) => <Bone key={i} className="h-11 w-full" />)}</Card><Card className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Bone key={i} className="h-5 w-full" />)}</Card></div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <form onSubmit={save}>
              <Card className="p-6 animate-fade-up">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><UserRound className="w-4 h-4 text-accent" />Profile</h2>
                <div className="grid md:grid-cols-2 gap-5">
                  <Field label="Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Display name" /></Field>
                  <Field label="Email" hint={self ? 'This is the address you sign in with.' : 'The address they sign in with; changing it takes effect immediately.'}><Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Role" hint={self ? "You can't change your own role." : !manage ? 'Only staff who manage permissions can change a role.' : roleOf(form.role)?.description}>
                    <Select value={form.role} disabled={self || !manage} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.length ? roles.map(r => <option key={r.key} value={r.key}>{r.name}</option>) : <option value={form.role}>{form.role}</option>}</Select>
                  </Field>
                  <Field label="Position" hint='Shown in their emails, e.g. "Precious Ubadire, Managing Director"'><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Managing Director" /></Field>
                  <Field label="Joined"><Input value={fmtDateTime(user.created_at)} readOnly className="bg-muted/50" /></Field>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant={user.active ? 'outline' : 'accent'} disabled={self} onClick={toggleActive}>{user.active ? 'Deactivate account' : 'Activate account'}</Button>
                  <Button type="submit" variant="accent" disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
                </div>
              </Card>
            </form>

            {roleData && (
              <Card className="p-6 animate-fade-up" style={{ animationDelay: '40ms' }}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div><h2 className="font-semibold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-accent" />Permissions</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{custom ? 'Chosen for this person alone; their role no longer decides.' : `From the role “${roleOf(user.role_key)?.name || user.role_key}”.`}</p></div>
                  {manage && !self && (custom
                    ? <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => savePerms(null)}>Use the role's permissions</Button>
                    : <Button type="button" variant="outline" className="h-9" onClick={() => setCustom({ ...(roleOf(user.role_key)?.permissions || {}) })}>Choose permissions for this person</Button>)}
                </div>
                <PermissionMatrix modules={roleData.modules} actions={roleData.actions} value={custom || roleOf(user.role_key)?.permissions || {}} disabled={!custom || !manage || self} onChange={setCustom} />
                {custom && manage && !self && <div className="mt-4 flex justify-end"><Button type="button" variant="accent" disabled={busy || JSON.stringify(custom) === JSON.stringify(user.permissions)} onClick={() => savePerms(custom)}>{busy ? 'Saving…' : 'Save permissions'}</Button></div>}
                <p className="mt-3 text-xs text-muted-foreground">Every change here is written to the audit log with who made it and what changed.</p>
              </Card>
            )}

            <Card className="animate-fade-up" style={{ animationDelay: '70ms' }}>
              <div className="px-6 py-4 border-b border-border"><h2 className="font-semibold">Recent activity</h2><p className="text-xs text-muted-foreground mt-0.5">The last changes this account made, from the audit log.</p></div>
              <ul className="divide-y divide-border">
                {user.activity?.map(x => (
                  <li key={x.id} className="px-6 py-3 text-sm flex items-center justify-between gap-4">
                    <span><span className="font-medium capitalize">{x.action}</span> <span className="text-muted-foreground">{x.entity}{x.entity_id ? ` #${x.entity_id}` : ''}</span></span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(x.at)}</span>
                  </li>
                ))}
                {!user.activity?.length && <li className="px-6 py-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</li>}
              </ul>
            </Card>
          </div>

          <Card className="p-6 animate-fade-up lg:sticky lg:top-24" style={{ animationDelay: '100ms' }}>
            <h2 className="font-semibold mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" />Sign-in</h2>
            {!a ? <p className="text-sm text-muted-foreground">No matching account in Supabase Auth.</p> : (
              <dl className="text-sm space-y-3">
                <Row label="Invited">{fmtDateTime(a.invited_at || a.auth_created_at)}</Row>
                <Row label="Invite">{pending ? <Badge tone="amber">pending — link not used yet</Badge> : <>Accepted <span className="text-muted-foreground">{fmtDateTime(a.confirmed_at)}</span></>}</Row>
                <Row label="Password">
                  {a.password === 'set' ? <>Set <span className="text-muted-foreground">{fmtDateTime(a.password_set_at)}</span></>
                    : a.password === 'signed_in' ? <span title="This account signed in before the panel started recording when passwords are set.">Set (has signed in)</span>
                    : <Badge tone="amber">not set yet</Badge>}
                </Row>
                <Row label="Last sign-in">{fmtDateTime(a.last_sign_in_at)}</Row>
              </dl>
            )}
            {a && (
              <div className="mt-5 pt-5 border-t border-border">
                <Button type="button" variant={pending ? 'accent' : 'outline'} className="w-full" disabled={sending || !user.active} onClick={sendLink}>
                  {pending ? <Send className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}{sending ? 'Sending…' : pending ? 'Resend invitation' : 'Send set-password link'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">{pending ? 'A fresh invitation with a new link; the old one stops working.' : 'A one-time link to choose a new password, sent to their email.'}{!user.active && ' Activate the account first.'}</p>
              </div>
            )}
          </Card>
        </div>
      )}
      {toastEl}
    </>
  )
}

const Row = ({ label, children }) => <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground shrink-0">{label}</dt><dd className="text-right">{children}</dd></div>
