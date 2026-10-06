/* Pieces every signed-in portal shares: the gate in front of it, the frame
   with its tabs, the notifications list and the change-password form. */
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
import { Bone } from '../components/Skeleton'
import PasswordInput from '../components/PasswordInput'
import { AuthCard, Label, Notice, Page, Problem, accent, input, outline, primary } from '../supplier/ui'
import { fmtMoment } from '../lib/procurement'

export const Card = ({ className = '', ...p }) => <div {...p} className={`bg-card border border-border rounded-2xl ${className}`} />
export const Empty = ({ icon: Icon, title, children }) => <Card className="p-10 text-center">{Icon && <Icon className="w-8 h-8 text-accent mx-auto mb-3" />}<p className="font-semibold text-foreground">{title}</p><p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">{children}</p></Card>
const TONES = { green: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20', amber: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20', blue: 'bg-primary/10 text-primary border-primary/20', accent: 'bg-accent/15 text-accent border-accent/30', red: 'bg-destructive/10 text-destructive border-destructive/20', muted: 'bg-muted text-muted-foreground border-border' }
export const Tag = ({ tone = 'muted', children }) => <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border whitespace-nowrap ${TONES[tone] || TONES.muted}`}>{children}</span>

/** In front of the signed-in pages: loading, not signed in, or an account that cannot be used. */
export function PortalGate({ cfg, children }) {
  const { session, me, error, ready, signOut } = cfg.portal.use()
  const { pathname, search, hash } = useLocation()
  const [sent, setSent] = useState(false)
  if (!ready) return <Page><div className="space-y-4" role="status" aria-label="Loading"><Bone className="h-8 w-64" /><Bone className="h-24 w-full rounded-2xl" /><Bone className="h-64 w-full rounded-2xl" /></div></Page>
  if (!session) return <Navigate to={`${cfg.base}/login?next=${encodeURIComponent(pathname + search + hash)}`} replace />
  if (!me) {
    const unverified = error?.code === 'unverified'
    const resend = () => cfg.portal.api(`${cfg.base}/resend`, { method: 'POST', auth: false, body: { email: session.user.email } }).then(() => setSent(true)).catch(() => setSent(true))
    return (
      <AuthCard eyebrow={cfg.eyebrow} title={unverified ? 'Confirm your email address' : 'This account cannot be used here'}>
        <div className="space-y-4 text-center">
          <Problem>{error?.message || 'Something went wrong. Please sign in again.'}</Problem>
          {sent && <Notice>A new confirmation link is on its way to {session.user.email}.</Notice>}
          <div className="flex flex-wrap justify-center gap-3">
            {unverified && !sent && <button type="button" onClick={resend} className={primary}>Send the link again</button>}
            <button type="button" onClick={signOut} className={outline}>Sign out</button>
          </div>
        </div>
      </AuthCard>
    )
  }
  return children
}

/** The frame: who is signed in, the sections, sign out. `tabs`: [{ to, label, icon, end?, badge? }]. */
export function PortalShell({ cfg, name, tabs }) {
  const { signOut } = cfg.portal.use()
  const nav = useNavigate()
  const tab = ({ isActive }) => `relative inline-flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-muted'}`
  return (
    <main className="flex-grow">
      <div className="pt-28 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="min-w-0">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-accent mb-1">{cfg.eyebrow}</span>
              <p className="font-serif text-2xl font-bold text-foreground truncate">{name}</p>
            </div>
            <nav className="flex flex-wrap items-center gap-1.5" aria-label={cfg.eyebrow}>
              {tabs.map(({ to, label, icon: Icon, end, badge }) => <NavLink key={to} to={to} end={end} className={tab}><Icon className="w-4 h-4" />{label}{badge > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">{badge}</span>}</NavLink>)}
              <button type="button" onClick={() => signOut().then(() => nav(`${cfg.base}/login`))} className="inline-flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold text-foreground/70 hover:bg-muted"><LogOut className="w-4 h-4" />Sign out</button>
            </nav>
          </div>
          <Outlet />
        </div>
      </div>
    </main>
  )
}

/** What we told this account, newest first. Opening the page marks everything read. */
export function Notifications({ api, path, onRead }) {
  const [rows, setRows] = useState(null); const [err, setErr] = useState(null)
  useEffect(() => {
    api(path).then(r => { setRows(r); if (r.some(n => !n.read_at)) api(`${path}/read`, { method: 'POST', body: {} }).then(() => onRead?.()).catch(() => {}) }).catch(e => setErr(e.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const local = link => { try { const u = new URL(link, window.location.origin); return u.origin === window.location.origin ? u.pathname + u.search + u.hash : null } catch { return null } }
  if (err) return <Problem>{err}</Problem>
  if (!rows) return <Bone className="h-40 w-full rounded-2xl" />
  if (!rows.length) return <Empty icon={Bell} title="No notifications yet">Updates about your account appear here, and we email you the important ones.</Empty>
  return (
    <Card><ul className="divide-y divide-border">
      {rows.map(n => { const to = n.link && local(n.link); const body = (<><span className="flex items-start gap-3"><span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-accent'}`} aria-label={n.read_at ? undefined : 'New'} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{n.title}</span>{n.body && <span className="block text-sm text-muted-foreground whitespace-pre-line mt-0.5">{n.body}</span>}<span className="block text-xs text-muted-foreground mt-1">{fmtMoment(n.created_at)}</span></span></span></>)
        return <li key={n.id}>{to ? <Link to={to} className="block px-5 py-4 hover:bg-muted/40">{body}</Link> : <div className="px-5 py-4">{body}</div>}</li> })}
    </ul></Card>
  )
}

/** Change the password of the signed-in account: the current one, then the new one twice. */
export function PasswordChange({ change, email }) {
  const [f, setF] = useState({ current: '', next: '', again: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [ok, setOk] = useState(false)
  const submit = async e => {
    e.preventDefault(); setErr(null); setOk(false)
    if (f.next.length < 8) return setErr('Choose a password of at least 8 characters.')
    if (f.next !== f.again) return setErr('The two new passwords are not the same.')
    setBusy(true)
    try { await change(email, f.current, f.next); setF({ current: '', next: '', again: '' }); setOk(true) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 md:p-8 max-w-3xl space-y-4">
      <div><h2 className="font-semibold text-lg text-foreground">Change password</h2><p className="text-sm text-muted-foreground mt-0.5">Use the eye to check what you typed.</p></div>
      <Problem>{err}</Problem>
      {ok && <Notice>Your password has been changed.</Notice>}
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block"><Label>Current password</Label><PasswordInput required autoComplete="current-password" className={input} value={f.current} onChange={e => setF({ ...f, current: e.target.value })} /></label>
        <label className="block"><Label>New password</Label><PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" className={input} value={f.next} onChange={e => setF({ ...f, next: e.target.value })} /></label>
        <label className="block"><Label>New password again</Label><PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" className={input} value={f.again} onChange={e => setF({ ...f, again: e.target.value })} /></label>
      </div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={busy} className={accent}>{busy ? 'Saving…' : 'Change password'}</button></div>
    </form>
  )
}
