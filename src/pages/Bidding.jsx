import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, ClipboardCheck, FileCheck2, Gavel, LogIn, MapPin, Scale, Wallet } from 'lucide-react'
import { useApi } from '../lib/api'
import { useSupplier } from '../lib/supplier'
import { Bone } from '../components/Skeleton'
import { TENDER_LABELS, fmtDay, fromNow, perUnit, qty } from '../lib/procurement'

const TONE = { open: 'bg-accent/15 text-accent border-accent/30', upcoming: 'bg-primary/10 text-primary border-primary/20', closed: 'bg-muted text-muted-foreground border-border', awarded: 'bg-muted text-muted-foreground border-border' }
const firstLine = s => String(s || '').split('\n').map(l => l.trim()).filter(Boolean)[0] || ''
const btn = 'inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold transition-colors'

/** Bidding Opportunities: what we are buying, open for suppliers to bid on. */
export default function Bidding() {
  const { data, loading, error } = useApi('/tenders')
  const { me } = useSupplier()
  const live = (data || []).filter(t => ['open', 'upcoming'].includes(t.state))
  const past = (data || []).filter(t => !['open', 'upcoming'].includes(t.state))

  return (
    <main className="flex-grow">
      <div className="pt-28 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">Procurement</span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Bidding Opportunities</h1>
            <p className="text-muted-foreground leading-relaxed">We buy agro-commodities from farmers, cooperatives and traders across Nigeria. Below is what we need now: see the quantity, the specification and our asking price, then submit your bid.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {me
                ? <Link to="/supplier" className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}>My supplier dashboard<ArrowRight className="w-4 h-4" /></Link>
                : <>
                  <Link to="/supplier/register" className={`${btn} bg-accent text-accent-foreground hover:bg-accent/90`}>Register as a supplier</Link>
                  <Link to="/supplier/login" className={`${btn} border border-border bg-card text-foreground hover:bg-muted`}><LogIn className="w-4 h-4" />Supplier sign-in</Link>
                </>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 max-w-5xl mx-auto">
            {[[Gavel, 'Choose an opportunity', 'Check the quantity, specification, delivery and payment terms.'], [ClipboardCheck, 'Submit your bid', 'Your quantity, your price per unit, and your documents.'], [FileCheck2, 'Follow the outcome', 'We email you as your bid moves: under review, shortlisted, awarded.']].map(([Icon, title, text], i) => (
              <div key={title} className="bg-card border border-border p-5 rounded-2xl flex items-start gap-3">
                <div className="w-9 h-9 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0"><Icon className="w-4 h-4 text-primary" /></div>
                <div><p className="text-xs text-muted-foreground uppercase font-medium">Step {i + 1}</p><p className="text-sm font-semibold text-foreground">{title}</p><p className="text-xs text-muted-foreground mt-0.5">{text}</p></div>
              </div>
            ))}
          </div>

          {loading && <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">{[0, 1].map(i => <div key={i} className="bg-card border border-border rounded-2xl p-6 space-y-4"><Bone className="h-6 w-2/3" /><Bone className="h-4 w-1/3" />{[...Array(5)].map((_, j) => <Bone key={j} className="h-4 w-full" />)}<Bone className="h-11 w-40" /></div>)}</div>}
          {error && <p className="text-center text-muted-foreground py-12">Couldn&rsquo;t load the opportunities. Please try again shortly.</p>}

          {data && !live.length && (
            <div className="max-w-2xl mx-auto text-center bg-card border border-border rounded-2xl p-10">
              <Scale className="w-8 h-8 text-accent mx-auto mb-3" />
              <h2 className="font-semibold text-lg text-foreground">No open opportunities right now</h2>
              <p className="text-sm text-muted-foreground mt-2">New supply opportunities are published here as we need them. Register as a supplier and you will be ready to bid when the next one opens.</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {live.map(t => <TenderCard key={t.number} t={t} />)}
          </div>

          {past.length > 0 && (
            <section className="max-w-5xl mx-auto mt-14" aria-labelledby="recent-h">
              <h2 id="recent-h" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Recently closed</h2>
              <ul className="bg-card border border-border rounded-2xl divide-y divide-border">
                {past.map(t => (
                  <li key={t.number}><Link to={`/bidding/${t.number}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-sm hover:bg-muted/40">
                    <span className="font-semibold text-foreground flex-1 min-w-[12rem]">{t.title}</span>
                    <span className="text-muted-foreground tabular-nums">{qty(t.quantity, t.unit)}</span>
                    {new Date(t.closes_at) <= new Date() && <span className="text-muted-foreground">closed {fmtDay(t.closes_at)}</span>}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${TONE[t.state] || TONE.closed}`}>{TENDER_LABELS[t.state]}</span>
                  </Link></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

function TenderCard({ t }) {
  const open = t.state === 'open'
  const rows = [
    ['Quantity', qty(t.quantity, t.unit), Scale],
    ['Specification', firstLine(t.specification) || 'See details', ClipboardCheck],
    ['Delivery location', t.delivery_location || 'See details', MapPin],
    ['Asking price', t.asking_price == null ? 'On request' : perUnit(t.asking_price, t.currency, t.unit), Wallet],
    ['Payment terms', 'As stated in the tender', FileCheck2],
    [open ? 'Bid closing date' : 'Bids open', open ? `${fmtDay(t.closes_at)} (${fromNow(t.closes_at)})` : `${fmtDay(t.opens_at)} (${fromNow(t.opens_at)})`, CalendarClock],
  ]
  return (
    <article className="bg-card border border-border rounded-2xl shadow-card hover:shadow-hover transition-shadow flex flex-col">
      <div className="p-6 pb-4 flex items-start justify-between gap-3 border-b border-border">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.number}</p>
          <h2 className="font-serif text-xl font-bold text-foreground uppercase tracking-wide mt-1 break-words">{t.title}</h2>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border whitespace-nowrap ${TONE[t.state] || TONE.closed}`}>{TENDER_LABELS[t.state]}</span>
      </div>
      <dl className="p-6 space-y-3 text-sm flex-1">
        {rows.map(([k, v, Icon]) => (
          <div key={k} className="flex items-start gap-3">
            <Icon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <dt className="text-muted-foreground w-36 shrink-0">{k}</dt>
            <dd className={`font-medium text-foreground min-w-0 break-words ${k === 'Asking price' ? 'tabular-nums' : ''}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="p-6 pt-0 flex flex-wrap gap-3">
        <Link to={`/bidding/${t.number}`} className={`${btn} border border-primary text-primary hover:bg-primary hover:text-primary-foreground`}>View details</Link>
        {open && <Link to={`/bidding/${t.number}#bid`} className={`${btn} bg-accent text-accent-foreground hover:bg-accent/90`}>Submit bid<ArrowRight className="w-4 h-4" /></Link>}
      </div>
    </article>
  )
}
