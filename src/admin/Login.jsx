import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase, authConfigured, missingAuthVars } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { Button, Card, Field, Input, Alert } from './ui'

export default function Login() {
  const { session, me, error: authErr, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const from = useLocation().state?.from || '/admin'

  if (session && me) return <Navigate to={from} replace />

  const submit = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr('Incorrect email or password.')
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <img src="/assets/img/logo.png" alt="Vertoc Agro" className="h-9 mb-6" />
        <h1 className="font-serif text-2xl font-bold text-foreground mb-1">Admin sign in</h1>
        <p className="text-sm text-muted-foreground mb-6">Accounts are invite-only.</p>
        {!authConfigured ? (
          <Alert>
            Sign-in isn't configured. Missing at build time:{' '}
            {missingAuthVars.map((v, i) => <span key={v}>{i > 0 && ' and '}<code>{v}</code></span>)}.
            Set {missingAuthVars.length > 1 ? 'them' : 'it'} in the deployment's environment variables, then redeploy.
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></Field>
            {(err || (session && authErr)) && <Alert>{err || authErr}</Alert>}
            <Button type="submit" className="w-full" disabled={busy || loading}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
