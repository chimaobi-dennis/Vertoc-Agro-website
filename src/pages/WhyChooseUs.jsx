import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useSite } from '../lib/site'
import { statIcon } from '../lib/statIcons'
import { Editable } from '../lib/editing'

/* Why choose us. The reasons come from the site data (settings row `why`) and are edited in place. */
export default function WhyChooseUs() {
  const site = useSite()
  const reasons = site.why || []
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">Why Vertoc</span>
            <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Why Choose Us</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              We combine local expertise with global standards to deliver exceptional value to our partners.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {reasons.map((x, i) => { const Icon = statIcon(x.icon); return (
              <Editable key={i} section="why" index={i} label="reason" className="h-full"><div className="bg-card border border-border p-6 rounded-2xl hover:-translate-y-1 transition-transform duration-200 h-full flex flex-col">
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-base font-semibold mb-2 text-foreground pr-10">{x.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{x.description}</p>
              </div></Editable>
            ) })}
            <Editable section="why" add label="reason" />
          </div>
          <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
            <h3 className="text-xl font-bold text-primary-foreground mb-3">Experience the Vertoc Advantage</h3>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">
              Join leading manufacturers, exporters, and food companies who trust us as their agro commodity partner.
            </p>
            <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow rounded-md bg-accent text-foreground hover:bg-accent/90 font-semibold px-8 h-12 text-base" to="/contact">
              Get a Quote
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
