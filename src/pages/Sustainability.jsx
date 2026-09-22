import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSite } from '../lib/site'
import { statIcon } from '../lib/statIcons'
import { Editable } from '../lib/editing'

/* The five policy frameworks. Text recovered verbatim from the original site. */
/* Policies come from the site data (edited in place by signed-in staff). */
const BADGE = { accent: 'bg-accent/10 text-accent border-accent/20', primary: 'bg-primary/10 text-primary border-primary/20', info: 'bg-info/10 text-info border-info/20', 'chart-1': 'bg-chart-1/10 text-chart-1 border-chart-1/20', 'chart-2': 'bg-chart-2/10 text-chart-2 border-chart-2/20', 'chart-3': 'bg-chart-3/10 text-chart-3 border-chart-3/20', 'chart-4': 'bg-chart-4/10 text-chart-4 border-chart-4/20', 'chart-5': 'bg-chart-5/10 text-chart-5 border-chart-5/20' }

const ICON_BTN = 'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-full h-10 w-10'

export default function Sustainability() {
  const site = useSite()
  const POLICIES = site.sustainability || []
  const [index, setIndex] = useState(0)
  const touchX = useRef(null)
  const policy = POLICIES[Math.min(index, POLICIES.length - 1)]
  const go = useCallback(i => setIndex(Math.min(Math.max(i, 0), POLICIES.length - 1)), [POLICIES.length])
  useEffect(() => { if (index > POLICIES.length - 1) setIndex(Math.max(0, POLICIES.length - 1)) }, [POLICIES.length, index])

  // Arrow keys and swipe, as the original page promised.
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, go])
  const onTouchStart = e => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = e => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null
    if (dx < -50) go(index + 1); else if (dx > 50) go(index - 1)
  }

  const prev = POLICIES[index - 1], next = POLICIES[index + 1]
  if (!policy) return <main className="flex-grow"><div className="pt-32 pb-16 text-center text-muted-foreground">No policies published yet.</div></main>
  const PolicyIcon = statIcon(policy.icon)

  return (
    <main className="flex-grow">
      <section className="relative pt-32 pb-16 overflow-hidden bg-primary">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-accent blur-2xl" />
        </div>
        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow hover:bg-primary/80 mb-4 bg-accent/20 text-accent border-accent/30 uppercase tracking-widest text-xs font-semibold">Our Commitments</div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-primary-foreground mb-4 text-balance">Sustainability Policies</h1>
          <p className="text-primary-foreground/70 max-w-2xl mx-auto text-base md:text-lg leading-relaxed text-pretty">At Vertoc Agro, sustainability is not a checkbox — it is embedded in every decision we make. Explore our five core policy frameworks below.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-2 md:gap-3" role="tablist" aria-label="Policy frameworks">
            {POLICIES.map((p, i) => { const Icon = statIcon(p.icon); return (
              <button key={p.key} type="button" role="tab" aria-selected={i === index} onClick={() => go(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                  i === index ? 'bg-accent text-accent-foreground border-accent shadow-lg scale-105' : 'bg-white/10 text-primary-foreground/80 border-white/20 hover:bg-white/20'}`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{p.label}</span>
              </button>
            ) })}
            <Editable section="sustainability" add label="policy" className="px-4 py-2 rounded-full text-sm border-white/40 text-white" />
          </div>
        </div>
      </section>

      <section className="bg-background py-12 md:py-20 min-h-[60vh]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={policy.key} className="container mx-auto px-4 md:px-6 animate-fade-in" role="tabpanel">
          <Editable section="sustainability" index={index} label="policy" className="mb-10"><div className="flex items-start justify-between gap-4 pr-16">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${BADGE[policy.color] || BADGE.accent}`}>
                  <PolicyIcon className="w-3.5 h-3.5" />{policy.label}
                </span>
                <span className="text-muted-foreground text-xs">{index + 1} / {POLICIES.length}</span>
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground text-balance mb-2">{policy.title}</h2>
              <p className="text-muted-foreground italic text-base">{policy.tagline}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2 mt-1">
              <button type="button" className={ICON_BTN} disabled={!prev} aria-label="Previous policy" onClick={() => go(index - 1)}><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" className={ICON_BTN} disabled={!next} aria-label="Next policy" onClick={() => go(index + 1)}><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div></Editable>
          <Editable section="sustainability" index={index} label="introduction" className="mb-8"><div className="bg-secondary/60 border border-border rounded-2xl p-5 md:p-7">
            <p className="text-foreground leading-relaxed text-base">{policy.intro}</p>
          </div></Editable>
          <div className="grid md:grid-cols-2 gap-5 md:gap-6">
            {(policy.sections || []).map((sec, si) => (
              <Editable key={`${sec.heading}-${si}`} section="sustainability" index={index} label="section"><div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow h-full">
                <div className="flex items-center gap-2 mb-3 pr-14">
                  <div className="w-1.5 h-6 rounded-full bg-accent shrink-0" />
                  <h3 className="font-semibold text-foreground text-base">{sec.heading}</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{sec.body}</p>
              </div></Editable>
            ))}
          </div>
          <div className="flex flex-col items-center gap-4 mt-10">
            <div className="flex items-center gap-2">
              {POLICIES.map((p, i) => (
                <button key={p.key} type="button" aria-label={`Go to ${p.label}`} onClick={() => go(i)}
                  className={`rounded-full transition-all duration-200 h-2.5 ${i === index ? 'w-6 bg-accent' : 'w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'}`} />
              ))}
            </div>
            <p className="text-muted-foreground/60 text-xs">Swipe left/right or use arrow keys to navigate</p>
          </div>
          <div className="flex items-center justify-between mt-8 gap-4">
            <div className="flex-1">
              {prev && (
                <button type="button" onClick={() => go(index - 1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /><span>{prev.label}</span>
                </button>
              )}
            </div>
            <div className="flex-1 flex justify-end">
              {next && (
                <button type="button" onClick={() => go(index + 1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                  <span>{next.label}</span><ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary/50 border-t border-border">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-2xl">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-4">Partner with a Responsible Exporter</h2>
          <p className="text-muted-foreground mb-7 leading-relaxed">Our sustainability commitments are backed by documentation and third-party verification. Request our full policy documentation or speak to our compliance team.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-10 bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 font-semibold" to="/contact">Contact Us <ArrowRight className="ml-2 w-4 h-4" /></Link>
            <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 rounded-full px-8 font-semibold" to="/quote">Request a Quote</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
