import { Link } from 'react-router-dom'
import { ArrowRight, Eye, Target } from 'lucide-react'
import { useSite } from '../lib/site'
import { statIcon } from '../lib/statIcons'

/* About Us. Mission, vision, registrations, core values and industries come from Settings → Company (see src/lib/site.jsx for the defaults). */
export default function About() {
  const site = useSite()
  const a = site.about || {}
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center mb-12">
      <span className="text-sm font-semibold uppercase tracking-wider text-accent">About Vertoc</span>
      <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">About Us</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">Vertoc Agro Products Limited is a leading Nigerian agribusiness committed to the cultivation of crops, sourcing, processing, storage, logistics, and export of premium agricultural commodities across Nigeria and beyond.</p>
      <p className="mt-4 text-primary font-semibold tracking-wide">Growing the Future, One Harvest at a Time.</p>
      {a.registrations?.length > 0 && (
      <div className="mt-6 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
      {a.registrations.map((r, i) => { const Icon = statIcon(r.icon); return (
      <span key={i} className="inline-flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-full">
      <Icon className="w-4 h-4 text-accent" />{r.label}{r.value ? ` — ${r.value}` : ''}</span>
      ) })}
      </div>
      )}
      </div>
      <div className="grid md:grid-cols-2 gap-8 mb-16">
      <div className="bg-card border border-border p-8 md:p-10 rounded-2xl">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-5">
      <Target className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-xl font-bold mb-3 text-foreground">Our Mission</h3>
      <p className="text-muted-foreground leading-relaxed">{a.mission}</p>
      </div>
      <div className="bg-card border border-border p-8 md:p-10 rounded-2xl">
      <div className="w-12 h-12 bg-accent/10 flex items-center justify-center rounded-2xl mb-5">
      <Eye className="w-6 h-6 text-accent" />
      </div>
      <h3 className="text-xl font-bold mb-3 text-foreground">Our Vision</h3>
      <p className="text-muted-foreground leading-relaxed">{a.vision}</p>
      </div>
      </div>
      {a.values?.length > 0 && (
      <>
      <div className="text-center mb-10">
      <span className="text-sm font-semibold uppercase tracking-wider text-accent">What Drives Us</span>
      <h2 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Our Core Values</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      {a.values.map((v, i) => { const Icon = statIcon(v.icon); return (
      <div key={i} className="bg-card border border-border p-6 rounded-2xl hover:-translate-y-1 transition-transform duration-200">
      <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4">
      <Icon className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">{v.title}</h4>
      {v.description && <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>}
      </div>
      ) })}
      </div>
      </>
      )}
      {a.industries?.length > 0 && (
      <>
      <div className="text-center mb-10">
      <span className="text-sm font-semibold uppercase tracking-wider text-accent">Who We Serve</span>
      <h2 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Industries We Serve</h2>
      <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">We proudly supply agricultural commodities to a diverse range of industries both locally and globally.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
      {a.industries.map((x, i) => { const Icon = statIcon(x.icon); return (
      <div key={i} className="bg-card border border-border p-6 rounded-2xl flex items-start gap-4 hover:-translate-y-1 transition-transform duration-200">
      <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
      <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
      <h4 className="text-base font-semibold text-foreground">{x.name}</h4>
      {x.description && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{x.description}</p>}
      </div>
      </div>
      ) })}
      </div>
      </>
      )}
      <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
      <h3 className="text-xl font-bold text-primary-foreground mb-3">Is Your Industry Listed?</h3>
      <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">We adapt our services to meet the unique needs of every sector. Let us discuss how we can help.</p>
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-8 h-12 text-base transition-colors" to="/contact">Contact Us<ArrowRight className="w-4 h-4" /></Link>
      </div>
      </div>
      </div>
    </main>
  )
}
