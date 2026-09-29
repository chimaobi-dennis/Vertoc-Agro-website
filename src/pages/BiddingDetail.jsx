import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarClock, ClipboardCheck, FileCheck2, MapPin, Scale, ShieldCheck, Truck, Wallet } from 'lucide-react'
import { useApi } from '../lib/api'
import { Bone } from '../components/Skeleton'
import BidForm from '../components/BidForm'
import { TENDER_LABELS, fmtDay, fmtMoment, fromNow, money, perUnit, qty } from '../lib/procurement'

const TONE = { open: 'bg-accent/15 text-accent border-accent/30', upcoming: 'bg-primary/10 text-primary border-primary/20', closed: 'bg-muted text-muted-foreground border-border', awarded: 'bg-muted text-muted-foreground border-border' }
const lines = s => String(s || '').split('\n').map(l => l.trim()).filter(Boolean)

/** One bidding opportunity in full, with the bid form while it is open. */
export default function BiddingDetail() {
  const { number } = useParams()
  const { hash } = useLocation()
  const { data: t, loading, error } = useApi(`/tenders/${number}`, [number])
  // "Submit bid" links land on the form (after the page's own scroll-to-top on navigation).
  useEffect(() => {
    if (!t || hash !== '#bid') return
    const id = setTimeout(() => document.getElementById('bid')?.scrollIntoView({ block: 'start' }), 150)
    return () => clearTimeout(id)
  }, [t, hash])

  return (
    <main className="flex-grow">
      <div className="pt-28 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <Link to="/bidding" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" />Bidding opportunities</Link>

          {loading && <div className="bg-card border border-border rounded-2xl p-8 space-y-4" role="status" aria-label="Loading"><Bone className="h-8 w-2/3" /><Bone className="h-4 w-40" />{[...Array(6)].map((_, i) => <Bone key={i} className="h-4 w-full" />)}</div>}
          {!loading && (error || !t) && (
            <div className="text-center py-24">
              <h1 className="font-serif text-3xl font-bold mb-3">This opportunity is not available</h1>
              <p className="text-muted-foreground">It may have been withdrawn. See the <Link to="/bidding" className="text-accent font-semibold">current bidding opportunities</Link>.</p>
            </div>
          )}

          {t && (
            <>
              <header className="mb-8">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-xs font-semibold tracking-widest text-muted-foreground">{t.number}</span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${TONE[t.state] || TONE.closed}`}>{TENDER_LABELS[t.state]}</span>
                </div>
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground uppercase tracking-wide break-words">{t.title}</h1>
                <p className="text-muted-foreground mt-3">{t.state === 'open' ? `Bids close ${fmtMoment(t.closes_at)} — ${fromNow(t.closes_at)}.` : t.state === 'upcoming' ? `Bids open ${fmtMoment(t.opens_at)} — ${fromNow(t.opens_at)}.` : t.state === 'awarded' ? 'This opportunity has been awarded.' : `Bids closed ${fmtDay(t.closes_at)}.`}</p>
              </header>

              <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
                <div className="space-y-6 min-w-0">
                  <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
                    <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                      <Fact icon={Scale} label="Commodity" value={t.commodity} />
                      <Fact icon={Scale} label="Required quantity" value={qty(t.quantity, t.unit)} />
                      <Fact icon={MapPin} label="Delivery location" value={t.delivery_location || 'To be agreed'} />
                      <Fact icon={Truck} label="Required delivery" value={[t.delivery_period, t.delivery_by ? `by ${fmtDay(t.delivery_by)}` : ''].filter(Boolean).join(' · ') || 'To be agreed'} />
                    </dl>
                  </section>
                  {lines(t.specification).length > 0 && (
                    <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
                      <h2 className="flex items-center gap-2 font-semibold text-foreground mb-4"><ClipboardCheck className="w-4 h-4 text-accent" />Quality / specification</h2>
                      <ul className="space-y-2 text-sm">{lines(t.specification).map((l, i) => <li key={i} className="flex gap-2.5"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" /><span>{l}</span></li>)}</ul>
                    </section>
                  )}
                  <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
                    <h2 className="flex items-center gap-2 font-semibold text-foreground mb-3"><FileCheck2 className="w-4 h-4 text-accent" />Payment terms</h2>
                    <p className="text-sm whitespace-pre-line">{t.payment_terms || 'As agreed with our procurement team.'}</p>
                  </section>
                  {lines(t.requirements).length > 0 && (
                    <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
                      <h2 className="flex items-center gap-2 font-semibold text-foreground mb-4"><ShieldCheck className="w-4 h-4 text-accent" />Additional requirements</h2>
                      <ul className="space-y-2 text-sm">{lines(t.requirements).map((l, i) => <li key={i} className="flex gap-2.5"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" /><span>{l}</span></li>)}</ul>
                    </section>
                  )}
                </div>

                <aside className="lg:sticky lg:top-32 space-y-4">
                  <div className="bg-primary text-primary-foreground rounded-2xl p-6">
                    <p className="text-xs uppercase tracking-widest text-primary-foreground/60 flex items-center gap-2"><Wallet className="w-4 h-4" />Asking price</p>
                    <p className="text-2xl font-bold mt-2 tabular-nums">{t.asking_price == null ? 'On request' : perUnit(t.asking_price, t.currency, t.unit)}</p>
                    {t.asking_price != null && <p className="text-xs text-primary-foreground/70 mt-1">{money(t.asking_price * t.quantity, t.currency)} for the full {qty(t.quantity, t.unit)}</p>}
                    <p className="text-xs text-primary-foreground/70 mt-3">This is what we expect to pay. You still enter your own price when you bid.</p>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-6 text-sm">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2"><CalendarClock className="w-4 h-4" />{t.state === 'upcoming' ? 'Bids open' : 'Bid closing date'}</p>
                    <p className="font-semibold mt-2">{fmtMoment(t.state === 'upcoming' ? t.opens_at : t.closes_at)}</p>
                    {['open', 'upcoming'].includes(t.state) && <p className="text-xs text-muted-foreground mt-0.5">{fromNow(t.state === 'upcoming' ? t.opens_at : t.closes_at)}</p>}
                    {t.accepting_bids
                      ? <a href="#bid" className="mt-4 inline-flex w-full items-center justify-center gap-2 h-11 rounded-full bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90">Submit bid<ArrowRight className="w-4 h-4" /></a>
                      : <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">{t.state === 'upcoming' ? 'Bidding has not opened yet. Come back on the opening date.' : 'This opportunity no longer takes bids.'}</p>}
                  </div>
                </aside>
              </div>

              {t.accepting_bids && (
                <section id="bid" className="mt-12 scroll-mt-32" aria-labelledby="bid-h">
                  <div className="mb-6">
                    <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-2">Your bid</span>
                    <h2 id="bid-h" className="font-serif text-2xl md:text-3xl font-bold text-foreground">Submit a bid for {t.commodity}</h2>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-6 md:p-8"><BidForm tender={t} /></div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0"><Icon className="w-4 h-4 text-primary" /></div>
      <div className="min-w-0"><dt className="text-xs text-muted-foreground uppercase font-medium">{label}</dt><dd className="font-semibold text-foreground break-words">{value}</dd></div>
    </div>
  )
}
