import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, MessageSquare, Search } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Badge, Button, Card, Empty, Input } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtShort } from './format'
import Thread from './Thread'
import Composer from './Composer'

const initials = s => String(s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

/**
 * Email threads on the left (one subject with one client or address, newest
 * first), the selected thread as a chat on the right. Full-page under
 * Messages (`useUrl` keeps the selection in ?t=), and filtered to one client
 * on the client record. "New email" starts a new thread; replies stay in
 * theirs.
 */
export default function Conversations({ clientId = null, email = '', useUrl = false, title = false, onCompose = null, refreshKey = 0, className = '' }) {
  const [sp, setSp] = useSearchParams()
  const [localActive, setLocalActive] = useState('')
  const active = useUrl ? (sp.get('t') || '') : localActive
  const unread = useUrl ? sp.get('unread') === '1' : false
  const [unreadLocal, setUnreadLocal] = useState(false)
  const showUnread = useUrl ? unread : unreadLocal
  const [q, setQ] = useState(useUrl ? (sp.get('q') || '') : '')
  const [threads, setThreads] = useState(null)
  const [err, setErr] = useState(null)
  const [tick, setTick] = useState(0)
  const [compose, setCompose] = useState(false)

  const select = key => {
    if (useUrl) { const n = new URLSearchParams(sp); key ? n.set('t', key) : n.delete('t'); setSp(n, { replace: true }) }
    else setLocalActive(key)
  }
  const setUnread = v => {
    if (useUrl) { const n = new URLSearchParams(sp); v ? n.set('unread', '1') : n.delete('unread'); setSp(n, { replace: true }) }
    else setUnreadLocal(v)
  }
  const load = useCallback(() => adminFetch(`/messages/threads?${clientId != null ? `client_id=${clientId}&` : ''}${showUnread ? 'unread=1&' : ''}q=${encodeURIComponent(q.trim())}`).then(setThreads).catch(e => setErr(e.message)), [clientId, showUnread, q])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, tick, refreshKey])
  useEffect(() => { const id = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(id) }, [])   // new mail appears without a reload
  // On a client record, open the latest thread straight away.
  useEffect(() => { if (clientId != null && !active && threads?.length) setLocalActive(threads[0].key) }, [threads, clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = threads?.find(t => t.key === active) || null
  const bump = () => setTick(x => x + 1)
  const startNew = () => (onCompose ? onCompose() : setCompose(true))

  return (
    <div className={`flex flex-col ${className}`}>
      {err && <div className="mb-4 shrink-0 text-sm text-destructive">{err}</div>}
      <div className="grid lg:grid-cols-[340px_1fr] gap-5 flex-1 min-h-0">
        {/* threads: fixed top (title, search), the list scrolls on its own */}
        <Card className={`animate-fade-up flex-col min-h-0 overflow-hidden ${active ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border space-y-3 shrink-0">
            <div className="flex items-end justify-between gap-3">
              {title
                ? <div><p className="text-[11px] font-semibold uppercase tracking-widest text-accent">Sales</p><h1 className="font-serif text-2xl font-bold tracking-tight leading-tight">Messages</h1></div>
                : <div><h2 className="font-semibold">Conversations</h2><p className="text-xs text-muted-foreground">One thread per subject.</p></div>}
              <Button variant="accent" className="h-9" onClick={startNew}><Mail className="w-4 h-4" />New email</Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input className="pl-10 h-10" placeholder={clientId != null ? 'Search subject…' : 'Search name, address or subject…'} value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-1"><input type="checkbox" checked={showUnread} onChange={e => setUnread(e.target.checked)} />Unread only</label>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
            {!threads && [0, 1, 2, 3].map(i => <li key={i} className="flex items-center gap-3 px-4 py-3"><Bone className="w-9 h-9 rounded-full" /><div className="flex-1 space-y-2"><Bone className="h-4 w-2/3" /><Bone className="h-3 w-1/2" /></div></li>)}
            {threads?.map(t => (
              <li key={t.key}>
                <button onClick={() => select(t.key)} className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 border-l-2 ${active === t.key ? 'bg-accent/10 border-accent' : 'border-transparent'}`}>
                  <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{initials(t.name || t.email)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${t.unread ? 'font-bold' : 'font-semibold'}`}>{t.subject}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtShort(t.updated_at)}</span>
                    </div>
                    {clientId == null && <p className="text-[11px] text-muted-foreground truncate">{t.name ? `${t.name} · ${t.email}` : t.email}</p>}
                    <p className={`text-xs truncate mt-0.5 ${t.unread ? 'text-foreground' : 'text-muted-foreground'}`}>{t.last?.direction === 'out' ? 'You: ' : ''}{t.last?.snippet || '(no text)'}</p>
                  </div>
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    {t.unread > 0 && <Badge tone="green">{t.unread}</Badge>}
                    {t.count > 1 && <span className="text-[11px] text-muted-foreground">{t.count}</span>}
                  </span>
                </button>
              </li>
            ))}
            {threads?.length === 0 && <li><Empty>{showUnread ? 'No unread threads.' : q ? 'No thread matches.' : clientId != null ? 'No emails with this client yet.' : 'No conversations yet.'}</Empty></li>}
          </ul>
        </Card>

        {/* thread: fixed header, scrolling bubbles, fixed reply box */}
        <Card className={`animate-fade-up flex-col min-h-0 overflow-hidden ${active ? 'flex' : 'hidden lg:flex'}`} style={{ animationDelay: '60ms' }}>
          {active ? (
            <>
              <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border shrink-0">
                <button onClick={() => select('')} className="lg:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground" aria-label="Back to threads"><ArrowLeft className="w-5 h-5" /></button>
                <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{initials(current?.name || current?.email || active)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{current?.subject || active.split('|')[1] || 'Thread'}</p>
                  <p className="text-xs text-muted-foreground truncate">{current?.name ? `${current.name} · ` : ''}{current?.email || email}{current?.count ? ` · ${current.count} email${current.count === 1 ? '' : 's'}` : ''}</p>
                </div>
                {clientId == null && (current?.client_id
                  ? <Link to={`/staff360/clients/${current.client_id}?tab=messages`} className="text-xs font-semibold text-accent whitespace-nowrap">Client record →</Link>
                  : current?.email ? <Link to="/staff360/clients/new" state={{ prefill: { name: current.name || current.email, data: { email: current.email } } }} className="text-xs font-semibold text-accent whitespace-nowrap">Create client</Link> : null)}
              </div>
              <Thread threadKey={active} email={current?.email || email} clientId={current?.client_id ?? clientId} onRead={bump} onSent={bump} refreshKey={refreshKey} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-sm text-muted-foreground gap-2">
              <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><MessageSquare className="w-5 h-5" /></span>
              <p>{threads?.length ? 'Pick a thread on the left. Unread ones are bold.' : 'Start with New email.'}</p>
            </div>
          )}
        </Card>
      </div>

      {!onCompose && (
        <Composer open={compose} onClose={() => setCompose(false)} title="New email" to={current?.email || email || ''} clientId={current?.client_id ?? clientId}
          template={(current?.client_id ?? clientId) != null ? { key: 'blank', client_id: current?.client_id ?? clientId } : null}
          onSent={r => { if (r?.thread_key) select(r.thread_key); bump() }} />
      )}
    </div>
  )
}
