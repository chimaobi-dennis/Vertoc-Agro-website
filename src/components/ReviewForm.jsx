import { useState } from 'react'
import { CheckCircle2, Star, X } from 'lucide-react'
import Turnstile from './Turnstile'

const BASE = import.meta.env.VITE_API_BASE || ''
const input = 'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

/** "Share your experience": a client's review goes to the team for approval before it appears. */
export default function ReviewForm({ open, onClose }) {
  const [f, setF] = useState({ name: '', role: '', quote: '', email: '', website: '' })
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState(0)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)
  if (!open) return null
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))
  const submit = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      const r = await fetch(`${BASE}/api/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, rating, captchaToken: token }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
      setDone(true)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-hover max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
          <h2 id="review-title" className="font-serif text-xl font-bold text-foreground">Share your experience</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        {done ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-3" />
            <p className="font-semibold text-foreground">Thank you!</p>
            <p className="text-sm text-muted-foreground mt-1">Your review has been received. Our team checks every review before it appears on the site.</p>
            <button type="button" onClick={onClose} className="mt-6 inline-flex items-center justify-center h-11 px-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground mb-1.5">Your rating</p>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} className="p-0.5">
                    <Star className={`w-7 h-7 transition-colors ${n <= (hover || rating) ? 'text-accent fill-accent' : 'text-border'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm"><span className="font-semibold text-foreground">Your name *</span><input required maxLength={60} value={f.name} onChange={set('name')} className={`${input} mt-1.5`} placeholder="Amina Bello" /></label>
              <label className="block text-sm"><span className="font-semibold text-foreground">Role and company</span><input maxLength={120} value={f.role} onChange={set('role')} className={`${input} mt-1.5`} placeholder="Buyer, Accra Foods" /></label>
            </div>
            <label className="block text-sm"><span className="font-semibold text-foreground">Your review *</span><textarea required minLength={10} maxLength={400} rows={4} value={f.quote} onChange={set('quote')} className={`${input} mt-1.5`} placeholder="How was working with Vertoc Agro?" /></label>
            <label className="block text-sm"><span className="font-semibold text-foreground">Email</span><span className="text-muted-foreground"> (optional, never shown; only if we need to confirm)</span><input type="email" maxLength={200} value={f.email} onChange={set('email')} className={`${input} mt-1.5`} placeholder="you@company.com" /></label>
            <div className="absolute -left-[9999px]" aria-hidden="true"><label htmlFor="website-review">Leave this field blank</label><input id="website-review" type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></div>
            <Turnstile onVerify={setToken} />
            {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">Reviews appear after our team approves them.</p>
              <button type="submit" disabled={busy} className="inline-flex items-center justify-center h-11 px-7 rounded-full bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 disabled:opacity-50">{busy ? 'Sending…' : 'Submit review'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
