import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import AuthShell from './AuthShell'
import { Button, Field, IconInput, Alert } from './ui'
import { Bone } from '../components/Skeleton'

/** Landing page for invite links; also the change-password page for anyone signed in. */
export default function SetPassword() {
  const { session, loading } = useAuth()
  const nav = useNavigate()
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault(); setErr(null)
    if (pw.length < 10) return setErr('Use at least 10 characters.')
    if (pw !== pw2) return setErr("Passwords don't match.")
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(error.message)
    nav('/admin', { replace: true })
  }

  return (
    <AuthShell>
      <img src="/assets/img/logo.png" alt="Vertoc Agro" className="h-9 mb-10 lg:hidden" />
      <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Account</p>
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-2">Set your password</h1>

      {loading ? (
        <div className="space-y-4 mt-6"><Bone className="h-4 w-2/3" /><Bone className="h-11 w-full" /><Bone className="h-11 w-full" /><Bone className="h-12 w-full" /></div>
      ) : !session ? (
        <div className="mt-6"><Alert>This link has expired or was already used. Ask an admin to send a new one.</Alert></div>
      ) : (
        <>
          <p className="text-muted-foreground mb-8">Signed in as <b className="text-foreground">{session.user.email}</b>.</p>
          <form onSubmit={submit} className="space-y-5">
            <Field label="New password" hint="At least 10 characters.">
              <IconInput icon={Lock} type="password" autoComplete="new-password" required value={pw} onChange={e => setPw(e.target.value)} />
            </Field>
            <Field label="Confirm password">
              <IconInput icon={Lock} type="password" autoComplete="new-password" required value={pw2} onChange={e => setPw2(e.target.value)} />
            </Field>
            {err && <Alert>{err}</Alert>}
            <Button type="submit" variant="accent" className="w-full h-12 text-base" disabled={busy}>
              {busy ? 'Saving…' : <>Save and continue <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  )
}
