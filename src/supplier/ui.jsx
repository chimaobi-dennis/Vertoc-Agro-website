/* Small pieces shared by the supplier portal pages (public-site styling). */
import { BID_LABELS, BID_PATH } from '../lib/procurement'

export const input = 'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60'
export const btn = 'inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none'
export const primary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90`
export const accent = `${btn} bg-accent text-accent-foreground hover:bg-accent/90`
export const outline = `${btn} border border-border bg-card text-foreground hover:bg-muted`

export const Label = ({ children, hint }) => <span className="block text-sm font-semibold text-foreground mb-1.5">{children}{hint && <span className="font-normal text-muted-foreground"> {hint}</span>}</span>

const PILL = {
  open: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20',
  under_review: 'bg-primary/10 text-primary border-primary/20',
  shortlisted: 'bg-accent/15 text-accent border-accent/30',
  awarded: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
  not_selected: 'bg-muted text-muted-foreground border-border',
  withdrawn: 'bg-muted text-muted-foreground border-border',
  // purchase orders
  issued: 'bg-primary/10 text-primary border-primary/20', acknowledged: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
  declined: 'bg-destructive/10 text-destructive border-destructive/20', fulfilled: 'bg-accent/15 text-accent border-accent/30', cancelled: 'bg-muted text-muted-foreground border-border', draft: 'bg-muted text-muted-foreground border-border',
}
export const Pill = ({ status, children, className = '' }) => <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border whitespace-nowrap ${PILL[status] || PILL.withdrawn} ${className}`}>{children}</span>

/** Open → Under review → Shortlisted → Awarded / Not selected, with where this bid stands. */
export function BidProgress({ status }) {
  const lost = status === 'not_selected', gone = status === 'withdrawn'
  const at = BID_PATH.indexOf(status)
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={`Bid status: ${BID_LABELS[status]}`}>
      {BID_PATH.map((s, i) => { const last = i === BID_PATH.length - 1; const done = lost ? true : !gone && at >= i; return (
        <li key={s} className="min-w-0">
          <div className={`h-1.5 rounded-full ${last && lost ? 'bg-muted-foreground/40' : done ? 'bg-accent' : 'bg-muted'}`} />
          <p className={`mt-2 text-xs font-semibold truncate ${done && !(last && lost) ? 'text-foreground' : 'text-muted-foreground'}`}>{last && lost ? 'Not selected' : BID_LABELS[s]}</p>
        </li>
      ) })}
    </ol>
  )
}

export const Page = ({ children, narrow = false }) => (
  <main className="flex-grow">
    <div className="pt-28 pb-16 bg-background min-h-screen">
      <div className={`container mx-auto px-4 md:px-6 ${narrow ? 'max-w-md' : 'max-w-5xl'}`}>{children}</div>
    </div>
  </main>
)
export const AuthCard = ({ eyebrow = 'Supplier portal', title, text, children }) => (
  <Page narrow>
    <div className="text-center mb-8">
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">{eyebrow}</span>
      <h1 className="font-serif text-3xl font-bold text-foreground">{title}</h1>
      {text && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{text}</p>}
    </div>
    <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-card">{children}</div>
  </Page>
)
export const Problem = ({ children }) => (children ? <p className="text-sm text-destructive rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3" role="alert">{children}</p> : null)
export const Notice = ({ children }) => (children ? <p className="text-sm text-foreground rounded-xl border border-accent/30 bg-accent/10 px-4 py-3" role="status">{children}</p> : null)
