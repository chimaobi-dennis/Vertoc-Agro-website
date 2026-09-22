import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useSite } from '../lib/site'
import { statIcon } from '../lib/statIcons'
import { Editable } from '../lib/editing'

/* Industries we serve. The list is the same one shown on the About page (about.industries),
   so editing a card here or there updates both. */
export default function Industries() {
  const site = useSite()
  const industries = site.about?.industries || []
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">Who We Serve</span>
            <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Industries We Serve</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              We proudly supply agricultural commodities to a diverse range of industries both locally and globally.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {industries.map((x, i) => { const Icon = statIcon(x.icon); return (
              <Editable key={i} section="industries" index={i} label="industry"><div className="bg-card border border-border p-6 rounded-2xl flex items-start gap-4 hover:-translate-y-1 transition-transform duration-200 h-full">
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="pr-10">
                  <h4 className="text-base font-semibold text-foreground">{x.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{x.description}</p>
                </div>
              </div></Editable>
            ) })}
            <Editable section="industries" add label="industry" />
          </div>
          <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
            <h3 className="text-xl font-bold text-primary-foreground mb-3">Is Your Industry Listed?</h3>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">
              We adapt our services to meet the unique needs of every sector. Let us discuss how we can help.
            </p>
            <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow rounded-md bg-accent text-foreground hover:bg-accent/90 font-semibold px-8 h-12 text-base" to="/contact">
              Contact Us
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
