import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Mail, MessageSquare, Plus, Search, Settings2, Tag, Trash2, X } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Badge, Button, Empty, Input, Modal, Select, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtShort } from './format'
import Thread from './Thread'
import Composer from './Composer'

const initials = s => String(s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

const TONES = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  blue: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  purple: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-300',
  slate: 'bg-muted text-muted-foreground',
}
const DOTS = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-sky-500', purple: 'bg-violet-500', teal: 'bg-teal-500', pink: 'bg-pink-500', slate: 'bg-slate-400' }
/** Colour palette: one circle per colour, the chosen one ringed. */
const Swatches = ({ value, onChange, colors = Object.keys(DOTS), size = 'w-5 h-5' }) => (
  <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Colour">
    {colors.map(c => (
      <button key={c} type="button" role="radio" aria-checked={value === c} title={c} aria-label={c} onClick={() => onChange(c)}
        className={`${size} rounded-full ${DOTS[c] || DOTS.slate} transition-transform ${value === c ? 'ring-2 ring-offset-2 ring-foreground/60 scale-110' : 'opacity-70 hover:opacity-100'}`} />
    ))}
  </div>
)
const Chip = ({ color = 'slate', children, className = '' }) => <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONES[color] || TONES.slate} ${className}`}>{children}</span>

/**
 * Email threads on the left (one subject with one client or address, newest
 * first), the selected thread as a chat on the right. Full-page under
 * Messages (`useUrl` keeps the selection in ?t=), and filtered to one client
 * on the client record. "New email" starts a new thread; replies stay in
 * theirs. Threads carry an automatic "Awaiting reply" marker when we wrote
 * last, and a manual label from an editable list.
 */
export default function Conversations({ clientId = null, email = '', useUrl = false, title = false, flush = false, onCompose = null, refreshKey = 0, className = '' }) {
  const [sp, setSp] = useSearchParams()
  const [local, setLocal] = useState({ t: '', unread: false, label: '' })
  const active = useUrl ? (sp.get('t') || '') : local.t
  const showUnread = useUrl ? sp.get('unread') === '1' : local.unread
  const labelFilter = useUrl ? (sp.get('label') || '') : local.label
  const [q, setQ] = useState(useUrl ? (sp.get('q') || '') : '')
  const [threads, setThreads] = useState(null)
  const [labels, setLabels] = useState(null)   // { labels: [{name,color}], colors: [] }
  const [err, setErr] = useState(null)
  const [tick, setTick] = useState(0)
  const [compose, setCompose] = useState(false)
  const [manage, setManage] = useState(false)
  const [toast, toastEl] = useToast()

  const setParam = (k, v) => {
    if (useUrl) { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }) }
    else setLocal(l => ({ ...l, [k === 't' ? 't' : k]: k === 'unread' ? Boolean(v) : v }))
  }
  const select = key => setParam('t', key)

  const loadLabels = useCallback(() => adminFetch('/messages/labels').then(setLabels).catch(() => {}), [])
  const load = useCallback(() => adminFetch(`/messages/threads?${clientId != null ? `client_id=${clientId}&` : ''}${showUnread ? 'unread=1&' : ''}${labelFilter ? `label=${encodeURIComponent(labelFilter)}&` : ''}q=${encodeURIComponent(q.trim())}`).then(setThreads).catch(e => setErr(e.message)), [clientId, showUnread, labelFilter, q])
  useEffect(() => { loadLabels() }, [loadLabels])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, tick, refreshKey])
  useEffect(() => { const id = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(id) }, [])   // new mail appears without a reload
  // On a client record, open the latest thread straight away.
  useEffect(() => { if (clientId != null && !active && threads?.length) setLocal(l => ({ ...l, t: threads[0].key })) }, [threads, clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = threads?.find(t => t.key === active) || null
  const bump = () => setTick(x => x + 1)
  const startNew = () => (onCompose ? onCompose() : setCompose(true))
  const setLabel = async (key, label, color = null) => {
    try { await adminFetch('/messages/thread/label', { method: 'PUT', body: { key, label, color } }); toast(label ? `Labelled "${label}"` : 'Label removed'); loadLabels(); bump() }
    catch (x) { toast(x.message, 'error') }
  }
  // `flush`: flat panes separated by a border (full-page workspace); otherwise two cards.
  const pane = flush ? 'bg-card' : 'bg-card border border-border rounded-2xl shadow-sm'

  return (
    <div className={`flex flex-col ${className}`}>
      {err && <div className="mb-4 shrink-0 text-sm text-destructive">{err}</div>}
      <div className={`grid lg:grid-cols-[340px_1fr] flex-1 min-h-0 ${flush ? 'gap-0 lg:divide-x divide-border' : 'gap-5'}`}>
        {/* threads: fixed top (title, search, filters), the list scrolls on its own */}
        <div className={`${pane} animate-fade-up flex-col min-h-0 overflow-hidden ${active ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border space-y-3 shrink-0">
            <div className="flex items-end justify-between gap-3">
              {title
                ? <div><p className="text-[11px] font-semibold uppercase tracking-widest text-accent">Sales</p><h1 className="font-serif text-2xl font-bold tracking-tight leading-tight">Messages</h1></div>
                : <div><h2 className="font-semibold">Conversations</h2><p className="text-xs text-muted-foreground">One thread per subject.</p></div>}
              <Button variant="accent" className="h-9" onClick={startNew}><Mail className="w-4 h-4" />New email</Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input className="pl-10 h-10" placeholder={clientId != null ? 'Search subject or label…' : 'Search name, address, subject or label…'} value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Select className="h-9 text-xs flex-1" value={labelFilter} onChange={e => setParam('label', e.target.value)}>
                <option value="">All threads</option>
                <option value="__awaiting">Awaiting reply</option>
                {labels?.labels.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
              </Select>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground whitespace-nowrap"><input type="checkbox" checked={showUnread} onChange={e => setParam('unread', e.target.checked ? '1' : '')} />Unread</label>
              <button type="button" onClick={() => setManage(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" title="Manage labels" aria-label="Manage labels"><Settings2 className="w-4 h-4" /></button>
            </div>
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
                    {(t.label || t.awaiting_reply || t.unread > 0) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {t.label && <Chip color={t.label.color}><Tag className="w-3 h-3" />{t.label.name}</Chip>}
                        {!t.label && t.awaiting_reply && <Chip>Awaiting reply</Chip>}
                        {t.unread > 0 && <Badge tone="green">{t.unread} new</Badge>}
                      </div>
                    )}
                  </div>
                  {t.count > 1 && <span className="text-[11px] text-muted-foreground shrink-0">{t.count}</span>}
                </button>
              </li>
            ))}
            {threads?.length === 0 && <li><Empty>{showUnread ? 'No unread threads.' : labelFilter ? 'No thread with that label.' : q ? 'No thread matches.' : clientId != null ? 'No emails with this client yet.' : 'No conversations yet.'}</Empty></li>}
          </ul>
        </div>

        {/* thread: fixed header, scrolling bubbles, fixed reply box */}
        <div className={`${pane} animate-fade-up flex-col min-h-0 overflow-hidden ${active ? 'flex' : 'hidden lg:flex'}`} style={{ animationDelay: '60ms' }}>
          {active ? (
            <>
              <div className="flex items-center gap-3 px-4 md:px-6 py-3.5 border-b border-border shrink-0">
                <button onClick={() => select('')} className="lg:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground" aria-label="Back to threads"><ArrowLeft className="w-5 h-5" /></button>
                <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{initials(current?.name || current?.email || active)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{current?.subject || active.split('|')[1] || 'Thread'}</p>
                  <p className="text-xs text-muted-foreground truncate">{current?.name ? `${current.name} · ` : ''}{current?.email || email}{current?.count ? ` · ${current.count} email${current.count === 1 ? '' : 's'}` : ''}{current?.awaiting_reply ? ' · awaiting their reply' : ''}</p>
                </div>
                <LabelMenu current={current?.label || null} labels={labels?.labels || []} colors={labels?.colors} onPick={(l, c) => setLabel(active, l, c)} onManage={() => setManage(true)} />
                {clientId == null && (current?.client_id
                  ? <Link to={`/staff360/clients/${current.client_id}?tab=messages`} className="text-xs font-semibold text-accent whitespace-nowrap hidden sm:inline">Client record →</Link>
                  : current?.email ? <Link to="/staff360/clients/new" state={{ prefill: { name: current.name || current.email, data: { email: current.email } } }} className="text-xs font-semibold text-accent whitespace-nowrap hidden sm:inline">Create client</Link> : null)}
              </div>
              <Thread threadKey={active} email={current?.email || email} clientId={current?.client_id ?? clientId} onRead={bump} onSent={bump} refreshKey={refreshKey} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-sm text-muted-foreground gap-2">
              <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><MessageSquare className="w-5 h-5" /></span>
              <p>{threads?.length ? 'Pick a thread on the left. Unread ones are bold.' : 'Start with New email.'}</p>
            </div>
          )}
        </div>
      </div>

      {!onCompose && (
        <Composer open={compose} onClose={() => setCompose(false)} title="New email" to={current?.email || email || ''} clientId={current?.client_id ?? clientId}
          template={(current?.client_id ?? clientId) != null ? { key: 'blank', client_id: current?.client_id ?? clientId } : null}
          onSent={r => { if (r?.thread_key) select(r.thread_key); bump() }} />
      )}
      <LabelManager open={manage} onClose={() => setManage(false)} labels={labels} onSaved={l => { setLabels(l); bump() }} />
      {toastEl}
    </div>
  )
}

/** Pick, type (with a colour) or clear the label of the open thread. */
function LabelMenu({ current, labels, colors, onPick, onManage }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [customColor, setCustomColor] = useState('teal')
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const away = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away); window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc) }
  }, [open])
  const pick = (l, c = null) => { onPick(l, c); setOpen(false); setCustom('') }
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${current ? `${TONES[current.color] || TONES.slate} border-transparent` : 'border-border text-muted-foreground hover:bg-muted'}`} aria-haspopup="menu" aria-expanded={open}>
        <Tag className="w-3.5 h-3.5" />{current ? current.name : 'Label'}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-30 w-64 rounded-xl border border-border bg-card shadow-lg p-1.5 animate-fade-up">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Label this thread</p>
          <ul className="max-h-56 overflow-y-auto">
            {labels.map(l => (
              <li key={l.name}>
                <button type="button" role="menuitem" onClick={() => pick(l.name)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left hover:bg-muted">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOTS[l.color] || DOTS.slate}`} /><span className="flex-1 truncate">{l.name}</span>{current?.name === l.name && <Check className="w-4 h-4 text-accent" />}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={e => { e.preventDefault(); if (custom.trim()) pick(custom.trim(), customColor) }} className="mt-1.5 px-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Input className="h-8 text-xs" placeholder="New label…" value={custom} onChange={e => setCustom(e.target.value)} maxLength={40} />
              <Button type="submit" variant="outline" className="h-8 px-2.5" disabled={!custom.trim()} aria-label="Add label"><Plus className="w-3.5 h-3.5" /></Button>
            </div>
            <Swatches value={customColor} onChange={setCustomColor} colors={colors} size="w-4 h-4" />
          </form>
          <div className="mt-1.5 pt-1.5 border-t border-border flex items-center justify-between px-1">
            <button type="button" onClick={() => { onManage(); setOpen(false) }} className="text-xs font-semibold text-accent px-1 py-1">Manage labels…</button>
            {current && <button type="button" onClick={() => pick(null)} className="text-xs font-semibold text-muted-foreground hover:text-destructive px-1 py-1 inline-flex items-center gap-1"><X className="w-3 h-3" />Remove</button>}
          </div>
        </div>
      )}
    </div>
  )
}

/** Edit the list of labels: names, colours, add, remove. */
function LabelManager({ open, onClose, labels, onSaved }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  useEffect(() => { if (open) { setRows(labels?.labels?.map(l => ({ ...l })) || []); setErr(null) } }, [open, labels])
  const colors = labels?.colors || Object.keys(TONES)
  const update = (i, patch) => setRows(r => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const save = async () => {
    setBusy(true); setErr(null)
    try { const r = await adminFetch('/messages/labels', { method: 'PUT', body: { labels: rows } }); onSaved(r); onClose() }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Labels" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="accent" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save labels'}</Button></>}>
      <p className="text-sm text-muted-foreground mb-4">Labels mark where a thread stands. Removing one clears it from every thread that used it.</p>
      {err && <p className="text-sm text-destructive mb-3">{err}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.map((l, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <Chip color={l.color} className="shrink-0 min-w-[2.5rem] justify-center"><Tag className="w-3 h-3" /></Chip>
            <div className="flex-1 min-w-[12rem]"><Input className="h-10" value={l.name} maxLength={40} onChange={e => update(i, { name: e.target.value })} placeholder="Label name" /></div>
            <Swatches value={l.color} onChange={c => update(i, { color: c })} colors={colors} />
            <button type="button" onClick={() => setRows(r => r.filter((_, j) => j !== i))} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted" aria-label="Remove label"><Trash2 className="w-4 h-4" /></button>
          </li>
        ))}
        {!rows.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No labels yet.</li>}
      </ul>
      <Button type="button" variant="outline" className="mt-3 h-9" onClick={() => setRows(r => [...r, { name: '', color: 'teal' }])}><Plus className="w-4 h-4" />Add a label</Button>
      <p className="mt-4 text-xs text-muted-foreground">Ideas: Waiting for client response · Deal pending approval · Deal closed · Follow up needed · On hold</p>
    </Modal>
  )
}
