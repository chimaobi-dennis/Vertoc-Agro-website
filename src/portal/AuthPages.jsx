/*
 * Sign in, register, confirm the email address and the forgotten-password
 * pair, for the client portal and the investment portal. `cfg` says which:
 *   { portal, base: '/client', eyebrow: 'Client portal', what: 'client', loginText, registerTitle, registerText, fields, blank }
 * `fields` is the registration form: [{ key, label, type?, required?, wide?, hint?, options?, autoComplete?, placeholder? }].
 */
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, MailCheck } from 'lucide-react'
import Turnstile from '../components/Turnstile'
import PasswordInput from '../components/PasswordInput'
import { TitleInput } from '../investor/fields'
import { AuthCard, Label, Notice, Problem, accent, input, outline, primary } from '../supplier/ui'

const safeNext = (n, base) => (n && n.startsWith(`${base}`) && !n.startsWith('//') ? n : base)

export function PortalLogin({ cfg }) {
  const { me, ready, signIn } = cfg.portal.use()
  const [sp] = useSearchParams(); const nav = useNavigate()
  const next = safeNext(sp.get('next'), cfg.base)
  const [f, setF] = useState({ email: sp.get('email') || '', password: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  const [unverified, setUnverified] = useState(false); const [sent, setSent] = useState(false)
  if (ready && me) return <Navigate to={next} replace />
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr(null); setUnverified(false); setSent(false)
    try { await signIn(f.email, f.password); nav(next, { replace: true }) }
    catch (x) { setErr(x.message); setUnverified(x.code === 'unverified') } finally { setBusy(false) }
  }
  const resend = async () => { try { await cfg.portal.api(`${cfg.base}/resend`, { method: 'POST', auth: false, body: { email: f.email } }); setSent(true); setErr(null) } catch (x) { setErr(x.message) } }
  return (
    <AuthCard eyebrow={cfg.eyebrow} title={`${cfg.title} sign-in`} text={cfg.loginText}>
      <form onSubmit={submit} className="space-y-4">
        {sp.get('confirmed') && <Notice>Your email address is confirmed. Sign in to continue.</Notice>}
        {sp.get('reset') && <Notice>{sp.get('invited') ? 'Your login is ready. Sign in with the password you just chose.' : 'Your new password is set. Sign in with it.'}</Notice>}
        <Problem>{err}</Problem>
        {unverified && !sent && <button type="button" onClick={resend} className="text-sm font-semibold text-accent">Send the confirmation email again</button>}
        {sent && <Notice>If that address has an account waiting for confirmation, a new link is on its way.</Notice>}
        <label className="block"><Label>Email address</Label><input required type="email" autoComplete="email" className={input} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
        <label className="block"><Label>Password</Label><PasswordInput required autoComplete="current-password" className={input} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></label>
        <button type="submit" disabled={busy} className={`${primary} w-full`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link to={`${cfg.base}/forgot${f.email ? `?email=${encodeURIComponent(f.email)}` : ''}`} className="font-semibold text-accent">Forgot your password?</Link>
          <Link to={`${cfg.base}/register`} className="font-semibold text-accent">Create an account</Link>
        </div>
      </form>
    </AuthCard>
  )
}

export function PortalRegister({ cfg }) {
  const { me, ready } = cfg.portal.use()
  const [f, setF] = useState({ ...cfg.blank, email: '', password: '', again: '', website: '' })
  const [token, setToken] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [done, setDone] = useState(null)
  if (ready && me) return <Navigate to={cfg.base} replace />
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))
  const submit = async e => {
    e.preventDefault(); setErr(null)
    if (f.password.length < 8) return setErr('Choose a password of at least 8 characters.')
    if (f.password !== f.again) return setErr('The two passwords are not the same.')
    setBusy(true)
    try { const { again, ...body } = f; const r = await cfg.portal.api(`${cfg.base}/register`, { method: 'POST', auth: false, body: { ...body, captchaToken: token } }); setDone(r.email || f.email) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  if (done) return (
    <AuthCard eyebrow={cfg.eyebrow} title="Check your email" text="One more step and your account is ready.">
      <div className="text-center">
        <MailCheck className="w-10 h-10 text-accent mx-auto mb-4" />
        <p className="text-sm">We sent a confirmation link to <b className="break-all">{done}</b>. Open it to activate your account; it works once and expires in 24 hours.</p>
        <p className="text-xs text-muted-foreground mt-3">Nothing there after a few minutes? Look in the spam folder, or ask for the link again from the sign-in page.</p>
        <Link to={`${cfg.base}/login?email=${encodeURIComponent(done)}`} className={`${outline} mt-6`}>Go to sign-in</Link>
      </div>
    </AuthCard>
  )
  const field = x => (
    <label key={x.key} className={`block ${x.wide ? 'sm:col-span-2' : ''}`}>
      <Label hint={x.required ? '' : '(optional)'}>{x.label}{x.required ? ' *' : ''}</Label>
      {x.kind === 'title' ? <TitleInput required={x.required} value={f[x.key]} onChange={v => setF(o => ({ ...o, [x.key]: v }))} />
        : x.type === 'textarea' ? <textarea rows={2} required={x.required} maxLength={500} className={input} value={f[x.key]} onChange={set(x.key)} autoComplete={x.autoComplete} />
        : x.options ? <select required={x.required} className={input} value={f[x.key]} onChange={set(x.key)}><option value="">Choose…</option>{x.options.map(o => <option key={o}>{o}</option>)}</select>
        : <input required={x.required} type={x.type || 'text'} maxLength={200} className={input} value={f[x.key]} onChange={set(x.key)} autoComplete={x.autoComplete} placeholder={x.placeholder} />}
      {x.hint && <span className="block text-xs text-muted-foreground mt-1.5">{x.hint}</span>}
    </label>
  )
  return (
    <main className="flex-grow">
      <div className="pt-28 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6 max-w-2xl">
          <div className="text-center mb-8">
            <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">{cfg.eyebrow}</span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{cfg.registerTitle}</h1>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{cfg.registerText}</p>
          </div>
          <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-card space-y-4">
            <Problem>{err}</Problem>
            <div className="grid sm:grid-cols-2 gap-4">
              {cfg.fields.map(field)}
              <label className="block sm:col-span-2"><Label>Email address *</Label><input required type="email" maxLength={200} className={input} value={f.email} onChange={set('email')} autoComplete="email" /><span className="block text-xs text-muted-foreground mt-1.5">You sign in with it, and we send your confirmation link there.</span></label>
              <label className="block"><Label>Password *</Label><PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" className={input} value={f.password} onChange={set('password')} /><span className="block text-xs text-muted-foreground mt-1.5">At least 8 characters.</span></label>
              <label className="block"><Label>Password again *</Label><PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" className={input} value={f.again} onChange={set('again')} /></label>
            </div>
            {cfg.registerNote && <p className="text-xs text-muted-foreground">{cfg.registerNote}</p>}
            <div className="hidden" aria-hidden="true"><label htmlFor={`website-${cfg.portal.kind}`}>Leave this field blank</label><input id={`website-${cfg.portal.kind}`} type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></div>
            <Turnstile onVerify={setToken} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-sm text-muted-foreground">Already registered? <Link to={`${cfg.base}/login`} className="font-semibold text-accent">Sign in</Link></p>
              <button type="submit" disabled={busy} className={accent}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Creating your account…' : 'Create account'}</button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

/** The link in the confirmation email lands here. */
export function PortalVerify({ cfg }) {
  const [sp] = useSearchParams()
  const [state, setState] = useState('working'); const [email, setEmail] = useState(''); const [err, setErr] = useState('')
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return; once.current = true     // the token works once: never post it twice
    cfg.portal.api(`${cfg.base}/verify`, { method: 'POST', auth: false, body: { token: sp.get('token') || '' } }).then(r => { setEmail(r.email || ''); setState('ok') }).catch(e => { setErr(e.message); setState('failed') })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthCard eyebrow={cfg.eyebrow} title={state === 'ok' ? 'Your account is ready' : state === 'failed' ? 'This link did not work' : 'Confirming your email…'}>
      <div className="text-center">
        {state === 'working' && <Loader2 className="w-8 h-8 text-accent mx-auto animate-spin" />}
        {state === 'ok' && <><CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-4" /><p className="text-sm">Your email address is confirmed{email && <> (<b className="break-all">{email}</b>)</>}. Sign in with the password you chose.</p><Link to={`${cfg.base}/login?confirmed=1${email ? `&email=${encodeURIComponent(email)}` : ''}`} className={`${primary} mt-6`}>Sign in</Link></>}
        {state === 'failed' && <><Problem>{err}</Problem><p className="text-sm text-muted-foreground mt-4">If you confirmed already, simply sign in. Otherwise ask for a new link from the sign-in page: enter your email and password, then choose “Send the confirmation email again”.</p><Link to={`${cfg.base}/login`} className={`${outline} mt-6`}>Go to sign-in</Link></>}
      </div>
    </AuthCard>
  )
}

export function PortalForgot({ cfg }) {
  const [sp] = useSearchParams()
  const [email, setEmail] = useState(sp.get('email') || ''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [done, setDone] = useState(false)
  const submit = async e => { e.preventDefault(); setBusy(true); setErr(null); try { await cfg.portal.api(`${cfg.base}/forgot`, { method: 'POST', auth: false, body: { email } }); setDone(true) } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  return (
    <AuthCard eyebrow={cfg.eyebrow} title="Forgot your password?" text="Enter the email address of your account and we will send you a link to choose a new one.">
      {done ? <div className="text-center"><MailCheck className="w-10 h-10 text-accent mx-auto mb-4" /><p className="text-sm">If <b className="break-all">{email}</b> has an account, a link is on its way. It works once and expires in 2 hours.</p><Link to={`${cfg.base}/login`} className={`${outline} mt-6`}>Back to sign-in</Link></div> : (
        <form onSubmit={submit} className="space-y-4">
          <Problem>{err}</Problem>
          <label className="block"><Label>Email address</Label><input required type="email" autoComplete="email" className={input} value={email} onChange={e => setEmail(e.target.value)} /></label>
          <button type="submit" disabled={busy} className={`${primary} w-full`}>{busy ? 'Sending…' : 'Send me the link'}</button>
          <p className="text-sm text-center"><Link to={`${cfg.base}/login`} className="font-semibold text-accent">Back to sign-in</Link></p>
        </form>
      )}
    </AuthCard>
  )
}

export function PortalReset({ cfg }) {
  const [sp] = useSearchParams(); const nav = useNavigate()
  const [f, setF] = useState({ password: '', again: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  const submit = async e => {
    e.preventDefault(); setErr(null)
    if (f.password.length < 8) return setErr('Choose a password of at least 8 characters.')
    if (f.password !== f.again) return setErr('The two passwords are not the same.')
    setBusy(true)
    try { const r = await cfg.portal.api(`${cfg.base}/reset`, { method: 'POST', auth: false, body: { token: sp.get('token') || '', password: f.password } }); nav(`${cfg.base}/login?reset=1${sp.get('invite') ? '&invited=1' : ''}${r.email ? `&email=${encodeURIComponent(r.email)}` : ''}`, { replace: true }) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <AuthCard eyebrow={cfg.eyebrow} title={sp.get('invite') ? 'Create your password' : 'Choose a new password'} text={sp.get('invite') ? 'You have been invited. Choose a password to open your account.' : undefined}>
      <form onSubmit={submit} className="space-y-4">
        <Problem>{err}</Problem>
        <label className="block"><Label>New password</Label><PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" className={input} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /><span className="block text-xs text-muted-foreground mt-1.5">At least 8 characters.</span></label>
        <label className="block"><Label>New password again</Label><PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" className={input} value={f.again} onChange={e => setF({ ...f, again: e.target.value })} /></label>
        <button type="submit" disabled={busy} className={`${primary} w-full`}>{busy ? 'Saving…' : sp.get('invite') ? 'Create my login' : 'Save my new password'}</button>
        <p className="text-sm text-center"><Link to={`${cfg.base}/forgot`} className="font-semibold text-accent">Ask for a new link</Link></p>
      </form>
    </AuthCard>
  )
}
