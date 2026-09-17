import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Card, Empty, Input } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtShort } from './format'
import Thread from './Thread'

const initials = s => String(s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

/** Conversations: one per client (or per outside address), newest first; the selected one opens as a chat. */
export default function MessagesAdmin() {
  const { me } = useAuth()
  const [sp, setSp] = useSearchParams()
  const active = sp.get('t') || ''
  const unread = sp.get('unread') === '1'
  const [q, setQ] = useState(sp.get('q') || '')
  const [threads, setThreads] = useState(null)
  const [err, setErr] = useState(null)
  const [settings, setSettings] = useState(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => adminFetch(`/messages/threads?${unread ? 'unread=1&' : ''}q=${encodeURIComponent(q.trim())}`).then(setThreads).catch(e => setErr(e.message)), [unread, q])
  useEffect(() => { adminFetch('/settings').then(setSettings).catch(() => {}) }, [])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, tick])
  useEffect(() => { const id = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(id) }, [])   // new mail appears without a reload

  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }) }
  const current = threads?.find(t => t.key === active) || null
  const bump = () => setTick(x => x + 1)

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-9rem)] min-h-[520px]">
      {err && <div className="mb-4 shrink-0"><Alert>{err}</Alert></div>}
      {settings && !settings.email.inbound_configured && (
        <div className="mb-4 shrink-0"><Alert tone="info">Received emails aren't flowing in yet.{me?.permissions?.settings ? <> Connect Resend inbound under <Link to="/staff360/settings?tab=email" className="font-semibold text-accent">Settings → Email → Inbound</Link>.</> : ' Ask an admin to connect Resend inbound in Settings.'}</Alert></div>
      )}

      <div className="grid lg:grid-cols-[340px_1fr] gap-5 flex-1 min-h-0">
        {/* conversations: fixed top (title, search), the list scrolls on its own */}
        <Card className={`animate-fade-up flex flex-col min-h-0 overflow-hidden ${active ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border space-y-3 shrink-0">
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-[11px] font-semibold uppercase tracking-widest text-accent">Sales</p><h1 className="font-serif text-2xl font-bold tracking-tight leading-tight">Messages</h1></div>
              {threads && <span className="text-xs text-muted-foreground mb-1">{threads.length} conversation{threads.length === 1 ? '' : 's'}</span>}
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input className="pl-10 h-10" placeholder="Search name, address or subject…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-1"><input type="checkbox" checked={unread} onChange={e => set('unread', e.target.checked ? '1' : '')} />Unread only</label>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
            {!threads && [0, 1, 2, 3].map(i => <li key={i} className="flex items-center gap-3 px-4 py-3"><Bone className="w-9 h-9 rounded-full" /><div className="flex-1 space-y-2"><Bone className="h-4 w-2/3" /><Bone className="h-3 w-1/2" /></div></li>)}
            {threads?.map(t => (
              <li key={t.key}>
                <button onClick={() => set('t', t.key)} className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 border-l-2 ${active === t.key ? 'bg-accent/10 border-accent' : 'border-transparent'}`}>
                  <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{initials(t.name || t.email)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${t.unread ? 'font-bold' : 'font-medium'}`}>{t.name || t.email}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtShort(t.updated_at)}</span>
                    </div>
                    {t.name && <p className="text-[11px] text-muted-foreground truncate">{t.email}</p>}
                    <p className={`text-xs truncate mt-0.5 ${t.unread ? 'text-foreground' : 'text-muted-foreground'}`}>{t.last?.direction === 'out' ? 'You: ' : ''}{t.last?.snippet || t.last?.subject || '(no text)'}</p>
                  </div>
                  {t.unread > 0 && <Badge tone="green">{t.unread}</Badge>}
                </button>
              </li>
            ))}
            {threads?.length === 0 && <li><Empty>{unread ? 'No unread conversations.' : q ? 'No conversation matches.' : 'No conversations yet.'}</Empty></li>}
          </ul>
        </Card>

        {/* conversation: fixed header, scrolling bubbles, fixed reply box */}
        <Card className={`animate-fade-up flex-col min-h-0 overflow-hidden ${active ? 'flex' : 'hidden lg:flex'}`} style={{ animationDelay: '60ms' }}>
          {active ? (
            <>
              <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border shrink-0">
                <button onClick={() => set('t', '')} className="lg:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground" aria-label="Back to conversations"><ArrowLeft className="w-5 h-5" /></button>
                <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{initials(current?.name || current?.email || active)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{current?.name || current?.email || 'Conversation'}</p>
                  <p className="text-xs text-muted-foreground truncate">{current?.name ? current.email : ''}{current?.count ? `${current?.name ? ' · ' : ''}${current.count} email${current.count === 1 ? '' : 's'}` : ''}</p>
                </div>
                {current?.client_id ? <Link to={`/staff360/clients/${current.client_id}`} className="text-xs font-semibold text-accent whitespace-nowrap">Client record →</Link>
                  : current?.email ? <Link to="/staff360/clients/new" state={{ prefill: { name: current.name || current.email, data: { email: current.email } } }} className="text-xs font-semibold text-accent whitespace-nowrap">Create client</Link> : null}
              </div>
              <Thread threadKey={active} email={current?.email || ''} clientId={current?.client_id ?? null} onRead={bump} onSent={bump} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-sm text-muted-foreground gap-2">
              <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><Search className="w-5 h-5" /></span>
              <p>Pick a conversation on the left. Unread ones are bold.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
