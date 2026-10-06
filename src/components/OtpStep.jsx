/*
 * The one-time code step in front of a binding answer (accepting an
 * invoice, acknowledging an order): ask the server to email a 6-digit code,
 * type it in, send it with the answer. The server checks it; a wrong or
 * expired code stops the answer there.
 */
import { useCallback, useEffect, useState } from 'react'
import { MailCheck } from 'lucide-react'

const BASE = import.meta.env.VITE_API_BASE || ''

/** `path` is the API route that sends the code, e.g. /q/<token>/otp. */
export function useOtp(path) {
  const [stage, setStage] = useState(null)        // null | 'sent' | 'skip' (the server does not ask for a code)
  const [sentTo, setSentTo] = useState(''); const [minutes, setMinutes] = useState(10)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState(null)
  const [wait, setWait] = useState(0)             // seconds until another code may be asked for
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(w => w - 1), 1000); return () => clearTimeout(t) }, [wait])
  const request = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const r = await fetch(`${BASE}/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { if (d.retry_after) setWait(Number(d.retry_after) || 60); throw new Error(d.error || 'We could not send the code. Please try again.') }
      if (d.skip) { setStage('skip'); return 'skip' }
      setSentTo(d.sent_to || ''); setMinutes(d.minutes || 10); setCode(''); setWait(60); setStage('sent'); return 'sent'
    } catch (e) { setError(e.message); return null } finally { setBusy(false) }
  }, [path])
  const reset = useCallback(() => { setStage(null); setCode(''); setError(null) }, [])
  return { stage, sentTo, minutes, code, setCode, busy, error, wait, request, reset, ready: stage === 'skip' || (stage === 'sent' && /^\d{6}$/.test(code)) }
}

export function OtpField({ otp }) {
  if (otp.stage !== 'sent') return otp.error ? <p className="text-sm text-destructive mt-3" role="alert">{otp.error}</p> : null
  return (
    <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
      <p className="text-sm flex items-start gap-2"><MailCheck className="w-4 h-4 text-accent mt-0.5 shrink-0" /><span>We emailed a 6-digit verification code to <b className="break-all">{otp.sentTo}</b>. Enter it below; it expires in {otp.minutes} minutes.</span></p>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <input value={otp.code} onChange={e => otp.setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-label="Verification code" autoFocus
          className="w-40 rounded-xl border border-border bg-card px-4 py-3 text-lg font-semibold tracking-[0.4em] text-center tabular-nums focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
        <button type="button" onClick={otp.request} disabled={otp.busy || otp.wait > 0} className="text-sm font-semibold text-accent disabled:text-muted-foreground">{otp.busy ? 'Sending…' : otp.wait > 0 ? `Resend code in ${otp.wait}s` : 'Resend code'}</button>
      </div>
      {otp.error && <p className="text-sm text-destructive mt-2" role="alert">{otp.error}</p>}
    </div>
  )
}
