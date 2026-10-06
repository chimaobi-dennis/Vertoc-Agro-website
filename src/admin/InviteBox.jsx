import { useState } from 'react'
import { BadgeCheck, Send } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Button, Card, Field, Input } from './ui'

/**
 * "Invite to the portal": staff made the record, the person gets an email with a
 * link to choose a password. `state`: 'none' (no login yet), 'unconfirmed' (registered, never confirmed), 'active'.
 * `endpoint` is POSTed with { email }; `askEmail` lets staff set or correct the address the link goes to.
 */
export default function InviteBox({ title = 'Portal login', who = 'They', state, email = '', endpoint, askEmail = true, canInvite = true, onDone }) {
  const [to, setTo] = useState(email)
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState(null); const [err, setErr] = useState(null)
  const send = async () => {
    setBusy(true); setErr(null); setOk(null)
    try { const r = await adminFetch(endpoint, { method: 'POST', body: askEmail ? { email: to } : {} }); setOk(r.kind === 'verify' || r.kind === 'reinvite' ? `Confirmation link sent to ${r.email || to}.` : `Invitation sent to ${r.email || to}.`); onDone?.(r) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Card className="p-5 text-sm animate-fade-up">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      {state === 'active' ? <p className="flex items-center gap-1.5 font-medium"><BadgeCheck className="w-4 h-4 text-accent" />{who} can sign in.</p> : (
        <div className="space-y-3">
          <p className="text-muted-foreground">{state === 'unconfirmed' ? `${who} registered but never confirmed the email address. Send the link again.` : `${who} have no login yet. Send an invitation: they get a link to create a password and sign in.`}</p>
          {askEmail && <Field label="Send it to"><Input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="name@company.com" /></Field>}
          {err && <Alert>{err}</Alert>}
          {ok && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{ok}</p>}
          {canInvite && <Button type="button" variant="outline" className="w-full h-9" disabled={busy || (askEmail && !to.trim())} onClick={send}><Send className="w-4 h-4" />{busy ? 'Sending…' : ok ? 'Send again' : 'Send invitation'}</Button>}
        </div>
      )}
    </Card>
  )
}
