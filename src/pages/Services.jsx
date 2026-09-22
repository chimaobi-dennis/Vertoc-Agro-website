import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useSite } from '../lib/site'
import { statIcon } from '../lib/statIcons'
import { Editable } from '../lib/editing'

/* Our Services. The cards come from the site data (edited in place by signed-in staff). */
export default function Services() {
  const site = useSite()
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center mb-12">
      <span className="text-sm font-semibold uppercase tracking-wider text-accent">What We Do</span>
      <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Our Services</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">Comprehensive agribusiness solutions from farm to market, designed to meet the needs of modern agricultural trade.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      {(site.services || []).map((s, i) => { const Icon = statIcon(s.icon); return (
      <Editable key={`${s.title}-${i}`} section="services" index={i} label="service" className="h-full">
      <div className="bg-card border border-border p-6 rounded-2xl hover:-translate-y-1 transition-transform duration-200 h-full flex flex-col">
      <div className="w-11 h-11 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <Icon className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">{s.title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">{s.description}</p>
      </div>
      </Editable>
      ) })}
      <Editable section="services" add label="service" />
      </div>
      <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
      <h3 className="text-xl font-bold text-primary-foreground mb-3">Need a Custom Solution?</h3>
      <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">Our team can tailor a service package to your specific commodity and logistics requirements.</p>
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-8 h-12 text-base transition-colors" to="/quote">Request a Quote<ArrowRight className="w-4 h-4" /></Link>
      </div>
      </div>
      </div>
    </main>
  )
}
