import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { Button, Card, Field, Input, Alert } from './ui'

/** Landing page for invite links: the link signs the user in, this sets their password. */
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-1">Set your password</h1>
        {loading ? <p className="text-sm text-muted-foreground">Checking your invite…</p>
        : !session ? <Alert>This invite link has expired or was already used. Ask an admin to send a new one.</Alert>
        : (
          <form onSubmit={submit} className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Signed in as <b>{session.user.email}</b>.</p>
            <Field label="New password"><Input type="password" autoComplete="new-password" required value={pw} onChange={e => setPw(e.target.value)} /></Field>
            <Field label="Confirm password"><Input type="password" autoComplete="new-password" required value={pw2} onChange={e => setPw2(e.target.value)} /></Field>
            {err && <Alert>{err}</Alert>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
