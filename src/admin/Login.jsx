import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import { supabase, authConfigured, missingAuthVars } from '../lib/supabase'
import { useAuth } from './AuthContext'
import AuthShell from './AuthShell'
import { Button, Field, IconInput, Alert } from './ui'

export default function Login() {
  const { session, me, error: authErr, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const from = useLocation().state?.from || '/staff360'

  if (session && me) return <Navigate to={from} replace />

  const submit = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr('Incorrect email or password.')
    setBusy(false)
  }

  return (
    <AuthShell>
      <img src="/assets/img/logo.png" alt="Vertoc Agro" className="h-9 mb-10 lg:hidden" />
      <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Admin</p>
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-2">Welcome back</h1>
      <p className="text-muted-foreground mb-8">Sign in to manage products, posts and enquiries.</p>

      {!authConfigured ? (
        <Alert>
          Sign-in isn't configured. Missing at build time:{' '}
          {missingAuthVars.map((v, i) => <span key={v}>{i > 0 && ' and '}<code>{v}</code></span>)}.
          Set {missingAuthVars.length > 1 ? 'them' : 'it'} in the deployment's environment variables, then redeploy.
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Field label="Email">
            <IconInput icon={Mail} type="email" autoComplete="email" required placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <IconInput icon={Lock} type="password" autoComplete="current-password" required placeholder="••••••••••"
              value={password} onChange={e => setPassword(e.target.value)} />
          </Field>
          {(err || (session && authErr)) && <Alert>{err || authErr}</Alert>}
          <Button type="submit" variant="accent" className="w-full h-12 text-base" disabled={busy || loading}>
            {busy ? 'Signing in…' : <>Sign in <ArrowRight className="w-4 h-4" /></>}
          </Button>
        </form>
      )}

      <p className="text-xs text-muted-foreground mt-8">Accounts are invite-only. Ask an administrator for access.</p>
    </AuthShell>
  )
}
