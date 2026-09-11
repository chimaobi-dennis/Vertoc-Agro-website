import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Paperclip, Search } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Card, Empty, Input, PageHeader } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtDateTime, messageTone } from './format'

const VIEWS = [['in', 'Inbox'], ['out', 'Sent'], ['all', 'All']]

/** Every email in and out, across all clients. */
export default function MessagesAdmin() {
  const { me } = useAuth()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const direction = ['in', 'out', 'all'].includes(sp.get('direction')) ? sp.get('direction') : 'in'
  const unread = sp.get('unread') === '1'
  const [q, setQ] = useState(sp.get('q') || '')
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [settings, setSettings] = useState(null)

  useEffect(() => { adminFetch('/settings').then(setSettings).catch(() => {}) }, [])
  useEffect(() => {
    setRows(null)
    const t = setTimeout(() => {
      adminFetch(`/messages?direction=${direction}${unread ? '&unread=1' : ''}&q=${encodeURIComponent(q.trim())}`).then(setRows).catch(e => setErr(e.message))
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [direction, unread, q])

  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }) }
  const who = m => (m.direction === 'in' ? (m.from_name ? `${m.from_name} · ${m.from_email}` : m.from_email) : (m.to_name ? `${m.to_name} · ${m.to_email}` : m.to_email))

  return (
    <>
      <PageHeader eyebrow="Sales" title="Messages" description="Emails received from and sent to clients, all in one place." />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {settings && !settings.email.inbound_configured && (
        <div className="mb-4"><Alert tone="info">Received emails aren't flowing in yet.{me?.permissions?.settings ? <> Connect Resend inbound under <Link to="/staff360/settings?tab=email" className="font-semibold text-accent">Settings → Email → Inbound</Link>.</> : ' Ask an admin to connect Resend inbound in Settings.'}</Alert></div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-xl border border-border overflow-hidden text-xs font-semibold">
          {VIEWS.map(([k, l]) => <button key={k} onClick={() => set('direction', k === 'in' ? '' : k)} className={`px-3.5 py-2 ${direction === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{l}</button>)}
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><input type="checkbox" checked={unread} onChange={e => set('unread', e.target.checked ? '1' : '')} />Unread only</label>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-10" placeholder="Search subject or address…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      <Card className="animate-fade-up">
        <ul className="divide-y divide-border">
          {!rows && [0, 1, 2, 3, 4].map(i => <li key={i} className="flex items-center gap-4 px-5 py-4"><Bone className="w-8 h-8 rounded-full" /><div className="flex-1 space-y-2"><Bone className="h-4 w-2/3" /><Bone className="h-3 w-1/3" /></div><Bone className="h-3 w-20" /></li>)}
          {rows?.map(m => {
            const isNew = m.direction === 'in' && !m.read_at
            return (
              <li key={m.id}>
                <button onClick={() => nav(`/staff360/messages/${m.id}`)} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/40">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.direction === 'in' ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary'}`}>
                    {m.direction === 'in' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${isNew ? 'font-bold' : 'font-medium'}`}>{isNew && <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2 align-middle" />}{m.subject || '(no subject)'}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.direction === 'in' ? 'From' : 'To'} {who(m)}</p>
                  </div>
                  {m.attachments?.length > 0 && <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  <Badge tone={messageTone(m.status)}>{m.status}</Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">{fmtDateTime(m.created_at)}</span>
                </button>
              </li>
            )
          })}
          {rows?.length === 0 && <li><Empty>{direction === 'in' ? (unread ? 'No unread emails.' : 'Nothing received yet.') : 'Nothing here yet.'}</Empty></li>}
        </ul>
      </Card>
    </>
  )
}
