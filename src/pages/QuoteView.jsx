/* Public quote page: /q/<token>. The token is the only credential. */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Clock, Download, FileText, XCircle } from 'lucide-react'
import { fetchJson } from '../lib/api'
import { useSite } from '../lib/site'
import { Bone } from '../components/Skeleton'

const BASE = import.meta.env.VITE_API_BASE || ''
const fmtMoney = (v, cur) => { const n = Number(v) || 0; try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n) } catch { return `${cur} ${n.toFixed(2)}` } }
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')
const qty = n => { const v = Number(n) || 0; return Number.isInteger(v) ? v : v.toFixed(2) }
const btn = 'inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none'

export default function QuoteView() {
  const { token } = useParams()
  const site = useSite()
  const [q, setQ] = useState(null)
  const [state, setState] = useState('loading')   // loading | ready | missing | error
  const [answer, setAnswer] = useState(null)      // 'accept' | 'decline' while confirming
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    fetchJson(`/q/${token}`).then(d => { setQ(d); setState('ready') }).catch(e => setState(/404/.test(e.message) ? 'missing' : 'error'))
  }, [token])

  const respond = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`${BASE}/api/q/${token}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: answer, note }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
      setQ(d); setAnswer(null)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const open = q && ['sent', 'viewed'].includes(q.status)
  const tax = q ? Math.max((Number(q.subtotal) || 0) - (Number(q.discount) || 0), 0) * (Number(q.tax_rate) || 0) / 100 : 0

  return (
    <main className="flex-grow">
      <div className="pt-28 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          {state === 'loading' && (
            <div className="bg-card border border-border rounded-2xl p-6 md:p-10 space-y-6" role="status" aria-label="Loading quotation">
              <div className="flex justify-between"><Bone className="h-8 w-48" /><Bone className="h-8 w-32" /></div>
              <Bone className="h-4 w-64" />
              {[...Array(4)].map((_, i) => <Bone key={i} className="h-10 w-full" />)}
              <Bone className="h-12 w-40 ml-auto" />
            </div>
          )}
          {state === 'missing' && (
            <div className="text-center py-24">
              <h1 className="font-serif text-3xl font-bold mb-3">This quotation link is not valid</h1>
              <p className="text-muted-foreground">It may have been replaced by a newer quote. Please contact us at <a className="text-accent font-semibold" href={`mailto:${site.email}`}>{site.email}</a>.</p>
            </div>
          )}
          {state === 'error' && <div className="text-center py-24 text-muted-foreground">Couldn&rsquo;t load this quotation. Please try again shortly.</div>}

          {q && (
            <>
              <div className="text-center mb-8 animate-fade-up">
                <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">Quotation</span>
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{q.number}</h1>
                {q.title && <p className="text-muted-foreground mt-2">{q.title}</p>}
              </div>

              {q.status === 'accepted' && <Banner icon={CheckCircle2} tone="accent" title="Accepted" text={`Thank you — you accepted this quotation on ${fmtDate(q.responded_at)}. Our team will be in touch shortly.`} />}
              {q.status === 'declined' && <Banner icon={XCircle} tone="muted" title="Declined" text={`You declined this quotation on ${fmtDate(q.responded_at)}. We'd be glad to prepare a revised one.`} />}
              {q.status === 'expired' && <Banner icon={Clock} tone="muted" title="Expired" text={`This quotation was valid until ${fmtDate(q.valid_until)}. Please contact us for an updated one.`} />}

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card animate-fade-up" style={{ animationDelay: '70ms' }}>
                <div className="bg-primary text-primary-foreground p-6 md:p-8 flex flex-wrap justify-between gap-6">
                  <div>
                    <p className="text-xl font-bold">{q.company?.name}</p>
                    <p className="text-sm text-primary-foreground/70 mt-1 whitespace-pre-line">{[q.company?.address, q.company?.phone, q.company?.email].filter(Boolean).join('\n')}</p>
                  </div>
                  <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 self-start">
                    <dt className="text-primary-foreground/60">Prepared for</dt><dd className="font-semibold">{q.client_name || '—'}</dd>
                    <dt className="text-primary-foreground/60">Date</dt><dd>{fmtDate(q.sent_at)}</dd>
                    <dt className="text-primary-foreground/60">Valid until</dt><dd>{fmtDate(q.valid_until)}</dd>
                  </dl>
                </div>

                <div className="p-6 md:p-8">
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="px-2 py-2 font-semibold">Description</th><th className="px-2 py-2 font-semibold text-right">Qty</th><th className="px-2 py-2 font-semibold">Unit</th><th className="px-2 py-2 font-semibold text-right">Unit price</th><th className="px-2 py-2 font-semibold text-right">Amount</th>
                      </tr></thead>
                      <tbody className="divide-y divide-border">
                        {q.items.map((it, i) => (
                          <tr key={i}><td className="px-2 py-3 font-medium">{it.description}</td><td className="px-2 py-3 text-right tabular-nums">{qty(it.quantity)}</td><td className="px-2 py-3 text-muted-foreground">{it.unit}</td><td className="px-2 py-3 text-right tabular-nums">{fmtMoney(it.unit_price, q.currency)}</td><td className="px-2 py-3 text-right tabular-nums font-medium">{fmtMoney(it.total, q.currency)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <dl className="mt-6 ml-auto max-w-xs text-sm space-y-2 tabular-nums">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{fmtMoney(q.subtotal, q.currency)}</dd></div>
                    {Number(q.discount) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>− {fmtMoney(q.discount, q.currency)}</dd></div>}
                    {Number(q.tax_rate) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({Number(q.tax_rate)}%)</dt><dd>{fmtMoney(tax, q.currency)}</dd></div>}
                    <div className="flex justify-between border-t border-border pt-2 text-lg font-bold"><dt>Total</dt><dd className="text-primary">{fmtMoney(q.total, q.currency)}</dd></div>
                  </dl>

                  {q.fields?.length > 0 && (
                    <dl className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm border-t border-border pt-6">
                      {q.fields.map(f => <div key={f.label}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}</dt><dd className="font-medium mt-0.5">{f.value}</dd></div>)}
                    </dl>
                  )}
                  {[['Notes', q.notes], ['Terms', q.terms], ['Payment', q.payment_text]].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="mt-6 border-t border-border pt-5"><h2 className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">{k}</h2><p className="text-sm whitespace-pre-wrap text-foreground/90">{v}</p></div>
                  ))}
                </div>

                <div className="border-t border-border bg-secondary/40 p-6 md:p-8 flex flex-wrap items-center gap-3">
                  <a href={`${BASE}/api/q/${token}/pdf?download=1`} className={`${btn} border border-border bg-card text-foreground hover:bg-muted`}><Download className="w-4 h-4" />Download PDF</a>
                  {open && !answer && (
                    <div className="flex flex-wrap gap-3 ml-auto">
                      <button onClick={() => setAnswer('decline')} className={`${btn} border border-border bg-card text-foreground hover:bg-muted`}><XCircle className="w-4 h-4" />Decline</button>
                      <button onClick={() => setAnswer('accept')} className={`${btn} bg-accent text-accent-foreground hover:bg-accent/90 shadow-hover`}><CheckCircle2 className="w-4 h-4" />Accept quotation</button>
                    </div>
                  )}
                </div>
                {open && answer && (
                  <div className="border-t border-border p-6 md:p-8 animate-fade-up">
                    <h2 className="font-semibold mb-1">{answer === 'accept' ? 'Accept this quotation?' : 'Decline this quotation?'}</h2>
                    <p className="text-sm text-muted-foreground mb-4">{answer === 'accept' ? 'We will contact you to confirm the order details.' : 'Tell us what would make it work, if you like.'}</p>
                    <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional message to our team" className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
                    {err && <p className="text-sm text-destructive mt-2" role="alert">{err}</p>}
                    <div className="flex flex-wrap gap-3 mt-4">
                      <button onClick={respond} disabled={busy} className={`${btn} ${answer === 'accept' ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>{busy ? 'Sending…' : answer === 'accept' ? 'Yes, accept' : 'Yes, decline'}</button>
                      <button onClick={() => setAnswer(null)} disabled={busy} className={`${btn} text-muted-foreground hover:text-foreground`}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5"><FileText className="w-3.5 h-3.5" />Questions? Reply to the email this quotation arrived with, or write to <a className="text-accent font-semibold" href={`mailto:${site.email}`}>{site.email}</a>.</p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function Banner({ icon: Icon, tone, title, text }) {
  const cls = tone === 'accent' ? 'border-accent/30 bg-accent/10' : 'border-border bg-muted/60'
  return (
    <div className={`flex gap-3 rounded-2xl border p-5 mb-6 animate-fade-up ${cls}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${tone === 'accent' ? 'text-accent' : 'text-muted-foreground'}`} />
      <div><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>
    </div>
  )
}
