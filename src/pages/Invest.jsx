/*
 * The investment portal's landing page and its extra pages (terms, anything staff add).
 * All the words, pictures and links come from Staff → Invest content. Reached by its link only.
 */
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Award, BadgeCheck, BarChart3, Clock, FileCheck2, Globe, Handshake, Landmark, Leaf, Lock, ShieldCheck, Sprout, TrendingUp, Truck, Users, Wallet } from 'lucide-react'
import { InvestContentProvider, useInvestPage } from '../lib/investContent'
import NotFound from './NotFound'

const ICONS = { ShieldCheck, Sprout, FileCheck2, BarChart3, Wallet, Clock, Handshake, Leaf, TrendingUp, Lock, Users, Globe, Truck, Award, BadgeCheck, Landmark }
const isExternal = h => /^(https?:|mailto:|tel:)/.test(h || '')
/** A link that stays inside the site when it points at it. */
export const A = ({ href, children, className }) => (!href ? null : isExternal(href) ? <a href={href} className={className} {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</a> : <Link to={href} className={className}>{children}</Link>)
const Skeleton = () => <main className="flex-grow"><div className="pt-40 pb-24 container mx-auto px-4 max-w-4xl space-y-4"><div className="h-10 w-2/3 rounded-xl bg-muted animate-pulse" /><div className="h-24 rounded-xl bg-muted animate-pulse" /></div></main>
const Preview = ({ on }) => (on ? <div className="fixed top-0 inset-x-0 z-[60] bg-amber-400 text-amber-950 text-center text-sm font-semibold py-1.5">Preview of the unpublished draft. Visitors do not see this yet.</div> : null)

function Landing() {
  const { page, ready, preview, error } = useInvestPage('landing')
  const terms = useTermsLinkOk()
  if (!ready) return <Skeleton />
  if (error && preview) return <main className="flex-grow pt-40 text-center text-muted-foreground">{error}</main>
  if (!page?.visible) return <NotFound />
  const c = page.content, b = c.banner
  return (
    <main className="flex-grow">
      <Preview on={preview} />
      <section className="pt-36 pb-16 bg-primary text-primary-foreground relative overflow-hidden" style={b.image ? { backgroundImage: `linear-gradient(rgba(0,26,77,.82), rgba(0,26,77,.82)), url(${b.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center">
          {b.badge && <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-4">{b.badge}</span>}
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight">{b.title}</h1>
          {b.text && <p className="mt-5 text-lg text-primary-foreground/80 leading-relaxed whitespace-pre-line">{b.text}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {b.primary_label && <A href={b.primary_link} className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-accent text-accent-foreground font-semibold hover:bg-accent/90">{b.primary_label}<ArrowRight className="w-4 h-4" /></A>}
            {b.secondary_label && <A href={b.secondary_link} className="inline-flex items-center gap-2 h-12 px-7 rounded-full border border-primary-foreground/30 font-semibold hover:bg-primary-foreground/10">{b.secondary_label}</A>}
          </div>
        </div>
      </section>
      {c.steps.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            {c.steps_title && <h2 className="font-serif text-3xl font-bold text-foreground text-center mb-10">{c.steps_title}</h2>}
            <ol className="grid sm:grid-cols-2 gap-5">
              {c.steps.map((s, i) => { const Icon = ICONS[s.icon] || ShieldCheck; return (
                <li key={i} className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">{s.image ? <img src={s.image} alt="" className="w-10 h-10 rounded-xl object-cover" /> : <span className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center"><Icon className="w-5 h-5" /></span>}<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step {i + 1}</span></div>
                  <h3 className="font-semibold text-lg text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-line">{s.text}</p>
                </li>
              ) })}
            </ol>
          </div>
        </section>
      )}
      {c.faqs.length > 0 && (
        <section className="pb-16 bg-background">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            {c.faq_title && <h2 className="font-serif text-3xl font-bold text-foreground text-center mb-8">{c.faq_title}</h2>}
            <div className="space-y-3">{c.faqs.map((f, i) => <details key={i} className="group bg-card border border-border rounded-2xl px-5 py-4"><summary className="cursor-pointer font-semibold text-foreground list-none flex justify-between gap-4">{f.q}<span className="text-accent group-open:rotate-45 transition-transform text-xl leading-none">+</span></summary><p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{f.a}</p></details>)}</div>
          </div>
        </section>
      )}
      {(c.cta.title || c.cta.button_label) && (
        <section className="pb-16 bg-background"><div className="container mx-auto px-4 md:px-6 max-w-3xl"><div className="rounded-3xl bg-secondary/60 border border-border p-8 text-center">
          {c.cta.title && <h2 className="font-serif text-2xl font-bold text-foreground">{c.cta.title}</h2>}
          {c.cta.text && <p className="text-muted-foreground mt-2">{c.cta.text}</p>}
          {c.cta.button_label && <A href={c.cta.button_link} className="mt-5 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-accent text-accent-foreground font-semibold hover:bg-accent/90">{c.cta.button_label}<ArrowRight className="w-4 h-4" /></A>}
        </div></div></section>
      )}
      <section className="pb-16 bg-background"><div className="container mx-auto px-4 md:px-6 max-w-3xl text-center">
        {c.footer_links.length > 0 && <p className="text-sm flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">{c.footer_links.filter(l => terms.ok(l.link)).map((l, i) => <A key={i} href={l.link} className="font-semibold text-accent">{l.label}</A>)}</p>}
        {c.notice && <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{c.notice}</p>}
      </div></section>
    </main>
  )
}
/** A link to the terms page is only shown while that page is published and visible. */
function useTermsLinkOk() {
  const t = useInvestPage('terms').page
  return { ok: link => (link === '/invest/terms' ? Boolean(t?.visible) : true) }
}

/** The terms page and any page staff add: a title, an introduction and sections. */
function ContentPage({ pageKey }) {
  const { page, ready, preview, error } = useInvestPage(pageKey)
  if (!ready) return <Skeleton />
  if (error && preview) return <main className="flex-grow pt-40 text-center text-muted-foreground">{error}</main>
  if (!page?.visible) return <NotFound />
  const c = page.content
  return (
    <main className="flex-grow">
      <Preview on={preview} />
      <section className="pt-36 pb-10 bg-primary text-primary-foreground"><div className="container mx-auto px-4 md:px-6 max-w-3xl">
        <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">Investment portal</span>
        <h1 className="font-serif text-3xl md:text-4xl font-bold">{c.title}</h1>
        {c.updated_label && <p className="mt-3 text-sm text-primary-foreground/70">{c.updated_label}</p>}
      </div></section>
      <section className="py-12 bg-background"><div className="container mx-auto px-4 md:px-6 max-w-3xl space-y-8">
        {c.image && <img src={c.image} alt="" className="w-full rounded-2xl border border-border" />}
        {c.intro && <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{c.intro}</p>}
        {c.eligibility?.length > 0 && <div><h2 className="font-serif text-2xl font-bold text-foreground mb-3">Eligibility</h2><ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">{c.eligibility.map((e, i) => <li key={i}>{e.text}</li>)}</ul></div>}
        {c.sections?.map((s, i) => <div key={i}><h2 className="font-serif text-2xl font-bold text-foreground mb-2">{s.heading}</h2><p className="text-muted-foreground leading-relaxed whitespace-pre-line">{s.body}</p></div>)}
        {c.risk_text && <div className="rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-5"><h2 className="font-semibold text-foreground mb-1.5">{c.risk_title || 'Risk disclosure'}</h2><p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{c.risk_text}</p></div>}
        {c.disclaimer_text && <div><h2 className="font-serif text-2xl font-bold text-foreground mb-2">{c.disclaimer_title || 'Disclaimer'}</h2><p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{c.disclaimer_text}</p></div>}
        {c.button_label && <A href={c.button_link} className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-accent text-accent-foreground font-semibold hover:bg-accent/90">{c.button_label}<ArrowRight className="w-4 h-4" /></A>}
        <p className="text-sm"><Link to="/invest" className="font-semibold text-accent">← Back to the investment portal</Link></p>
      </div></section>
    </main>
  )
}

export default function Invest() { return <InvestContentProvider><Landing /></InvestContentProvider> }
export function InvestTerms() { return <InvestContentProvider><ContentPage pageKey="terms" /></InvestContentProvider> }
export function InvestExtraPage() { const { slug } = useParams(); return <InvestContentProvider><ContentPage pageKey={`page-${slug}`} /></InvestContentProvider> }
