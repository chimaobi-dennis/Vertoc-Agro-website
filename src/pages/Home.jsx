import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Award, Eye, Factory, FlaskConical, Globe, Handshake, Leaf, PackageSearch, Quote, ShieldCheck, Ship, Star, Target, TrendingUp, Truck, Warehouse } from 'lucide-react'
import StatCounter from '../components/StatCounter'
import { useApi } from '../lib/api'
import { CardGridSkeleton, ProductCardSkeleton } from '../components/Skeleton'
import { statIcon } from '../lib/statIcons'
import { flagSrc, onFlagError } from '../lib/flags'
import ReviewForm from '../components/ReviewForm'
import { Editable } from '../lib/editing'
import { useSite } from '../lib/site'

// The stat tiles come from Settings → Site (see src/lib/site.jsx for the defaults).

const FILTERS = ['All Products', 'Agro Commodities', 'Solid Minerals']
const inFilter = (p, f) => f === 'All Products' || f.toLowerCase().startsWith(String(p.category || '').toLowerCase())

/* The first six products of the live catalogue, filterable by category. HOT = featured. */
function FeaturedCommodities() {
  const { data: products, loading } = useApi('/products')
  const [filter, setFilter] = useState(FILTERS[0])
  const visible = useMemo(() => (products || []).filter(p => inFilter(p, filter)).slice(0, 6), [products, filter])
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        {FILTERS.map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground/70 hover:text-foreground'}`}>
            {f}
          </button>
        ))}
      </div>
      {loading && <CardGridSkeleton card={ProductCardSkeleton} count={6} gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10" label="Loading featured commodities" />}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {visible.map(p => (
            <Link key={p.slug} className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover group" to={`/products/${p.slug}`}>
              <div className="relative aspect-[4/3] overflow-hidden">
                <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {p.featured && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full"><TrendingUp className="w-3 h-3" />HOT</div>
                )}
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">{String(p.category || '').toUpperCase()}</span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-foreground mb-1">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.grade || p.summary}</p>
              </div>
            </Link>
          ))}
          {!visible.length && <p className="sm:col-span-2 lg:col-span-3 py-12 text-center text-muted-foreground">No {filter.toLowerCase()} listed yet — new commodities are added regularly.</p>}
        </div>
      )}
    </>
  )
}

export default function Home() {
  const site = useSite()
  const [reviewOpen, setReviewOpen] = useState(false)
  // The badge on the About picture follows the "years" stat tile (Settings → Site → Homepage stats).
  const years = (site.stats || []).find(s => /year/i.test(s.label)) || site.stats?.[0]
  return (
    <main className="flex-grow">
      <script type="application/ld+json">{'{'}"@context":"https://schema.org","@graph":[{'{'}"@type":"Organization","@id":"https://vertocagro.com/#organization","name":"Vertoc Agro Products Limited","url":"https://vertocagro.com","logo":{'{'}"@type":"ImageObject","url":"/assets/img/logo.png"{'}'},"description":"Growing the Future, One Harvest at a Time. Cultivation, sourcing, processing, storage, logistics, and export of premium agricultural commodities across Nigeria and beyond.","address":{'{'}"@type":"PostalAddress","addressCountry":"NG","addressLocality":"Nigeria"{'}'},"contactPoint":{'{'}"@type":"ContactPoint","email":"sales@vertocagro.com","contactType":"sales","availableLanguage":"English"{'}'},"sameAs":[],"foundingDate":"2020","legalName":"Vertoc Agro Products Limited"{'}'},{'{'}"@type":"WebSite","@id":"https://vertocagro.com/#website","url":"https://vertocagro.com","name":"Vertoc Agro Products Limited","description":"Premium agricultural commodities export from Nigeria","publisher":{'{'}"@id":"https://vertocagro.com/#organization"{'}'},"potentialAction":{'{'}"@type":"SearchAction","target":{'{'}"@type":"EntryPoint","urlTemplate":"https://vertocagro.com/products?q={'{'}search_term_string{'}'}"{'}'},"query-input":"required name=search_term_string"{'}'}{'}'}]{'}'}</script>
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/assets/img/stock-1625246333195-78d9c38ad449-1920.jpg")' }}>
      <div className="absolute inset-0 bg-gradient-to-r from-scrim/90 via-scrim/75 to-scrim/40">
      </div>
      </div>
      <div className="relative z-10 container mx-auto px-4 md:px-6 pt-36 pb-20">
      <div className="max-w-3xl">
      <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
      <Award className="w-4 h-4 text-accent" />
      <span className="text-sm font-semibold text-white">NEPC Registered Exporter</span>
      </div>
      <h1 className="font-serif text-4xl md:text-5xl lg:text-7xl font-bold text-white leading-[1.05] mb-6">Premium Nigerian<br />
      <span className="text-accent">Agro Commodities</span>
      <br />for the World</h1>
      <p className="text-base md:text-lg text-white/80 max-w-xl mb-8 leading-relaxed">Cultivation of crops, sourcing, processing, storage, logistics, and export of premium agricultural commodities. Certified quality, reliable logistics, FOB Lagos.</p>
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow bg-accent text-white hover:bg-accent/90 font-semibold rounded-full px-8 h-12 text-base" to="/products">
      <ArrowRight className="w-4 h-4 mr-2" />Explore Products</Link>
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-accent-foreground border border-white/40 text-white hover:bg-white/10 font-semibold rounded-full px-8 h-12 text-base" to="/quote">Request a Quote</Link>
      </div>
      <div className="flex flex-wrap items-center gap-6 md:gap-8">
      <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center">
      <Ship className="w-4 h-4 text-white" />
      </div>
      <div>
      <p className="text-sm font-semibold text-white">FOB Lagos</p>
      <p className="text-xs text-white/60">Global Shipping</p>
      </div>
      </div>
      <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center">
      <FlaskConical className="w-4 h-4 text-white" />
      </div>
      <div>
      <p className="text-sm font-semibold text-white">Lab Tested</p>
      <p className="text-xs text-white/60">Quality Assured</p>
      </div>
      </div>
      <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center">
      <Globe className="w-4 h-4 text-white" />
      </div>
      <div>
      <p className="text-sm font-semibold text-white">12+ Countries</p>
      <p className="text-xs text-white/60">Export Markets</p>
      </div>
      </div>
      </div>
      </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent">
      </div>
      </section>
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {(site.stats || []).map((s, i) => (
              <Editable key={`${s.label}-${i}`} section="stats" index={i} label="stat"><StatCounter icon={statIcon(s.icon)} value={Number(s.value) || 0} suffix={s.suffix ?? '+'} label={s.label} /></Editable>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-6">
      <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
      <div className="relative">
      <div className="aspect-[4/3] rounded-2xl overflow-hidden">
      <img src="/assets/img/stock-1625246333195-78d9c38ad449-800.jpg" alt="African farmland" className="w-full h-full object-cover" loading="lazy" />
      </div>
      {years && (
      <div className="absolute -bottom-6 -right-6 bg-accent text-white rounded-2xl p-5 hidden md:block shadow-hover">
      <p className="text-3xl font-bold">{years.value}{years.suffix ?? '+'}</p>
      <p className="text-sm">Years of Excellence</p>
      </div>
      )}
      </div>
      <div>
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">About Vertoc</span>
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-5">Connecting Farmers with Global Markets</h2>
      <p className="text-muted-foreground leading-relaxed mb-6">Vertoc Agro Products Limited is a leading Nigerian agribusiness committed to the cultivation of crops, sourcing, processing, storage, logistics, and export of premium agricultural commodities across Nigeria and beyond.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <Editable section="mission" label="mission"><div className="bg-card border border-border p-5 rounded-2xl h-full">
      <Target className="w-5 h-5 text-primary mb-2" />
      <h4 className="text-sm font-bold text-foreground">Our Mission</h4>
      <p className="text-xs text-muted-foreground mt-1">{site.about?.mission_short || site.about?.mission}</p>
      </div></Editable>
      <Editable section="vision" label="vision"><div className="bg-card border border-border p-5 rounded-2xl h-full">
      <Eye className="w-5 h-5 text-accent mb-2" />
      <h4 className="text-sm font-bold text-foreground">Our Vision</h4>
      <p className="text-xs text-muted-foreground mt-1">{site.about?.vision_short || site.about?.vision}</p>
      </div></Editable>
      </div>
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background h-9 py-2 font-semibold rounded-full px-6 border-primary text-primary hover:bg-primary hover:text-primary-foreground" to="/about">Learn More About Us <ArrowRight className="w-4 h-4 ml-2" />
      </Link>
      </div>
      </div>
      <div className="text-center max-w-2xl mx-auto mb-12">
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">What We Do</span>
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Our Services</h2>
      <p className="text-muted-foreground leading-relaxed">Comprehensive agribusiness solutions covering the entire value chain from farm to port.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-card border border-border p-6 rounded-2xl hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover h-full flex flex-col">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <TrendingUp className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-base font-bold mb-2 text-foreground">Agro Commodity Trading</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">Buy and sell high-quality agricultural commodities across local and international markets.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover h-full flex flex-col">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <PackageSearch className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-base font-bold mb-2 text-foreground">Sourcing &amp; Aggregation</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">Direct sourcing from smallholder and commercial farmers with strict quality standards.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover h-full flex flex-col">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <Factory className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-base font-bold mb-2 text-foreground">Processing</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">Modern processing facilities to clean, grade, and prepare commodities for market.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover h-full flex flex-col">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <Warehouse className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-base font-bold mb-2 text-foreground">Warehousing</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">Secure, climate-controlled storage preserving quality from harvest to delivery.</p>
      </div>
      </div>
      <div className="mt-10 text-center">
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background h-9 py-2 font-semibold rounded-full px-6 border-primary text-primary hover:bg-primary hover:text-primary-foreground" to="/services">View All Services <ArrowRight className="w-4 h-4 ml-2" />
      </Link>
      </div>
      </div>
      </section>
      <section className="py-20 md:py-28 bg-secondary/50">
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center max-w-2xl mx-auto mb-12">
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">Our Products</span>
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Featured Commodities</h2>
      <p className="text-muted-foreground leading-relaxed">Premium Nigerian agricultural commodities and solid minerals, sourced directly from farms and mines, processed to international standards.</p>
      </div>
      <FeaturedCommodities />
      <div className="text-center">
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background py-2 font-semibold rounded-full px-8 h-11 border-primary text-primary hover:bg-primary hover:text-primary-foreground" to="/products">View All Products<ArrowRight className="w-4 h-4 ml-2" />
      </Link>
      </div>
      </div>
      </section>
      <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center max-w-2xl mx-auto mb-14">
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">Why Vertoc</span>
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Your Trusted Agro Partner</h2>
      <p className="text-muted-foreground leading-relaxed">From farm to port, we handle every step with precision, transparency, and a commitment to excellence that our global partners count on.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-card border border-border rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4">
      <ShieldCheck className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-lg font-bold mb-2 text-foreground">Certified Quality</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">All products meet international quality standards with full traceability and lab certification.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4">
      <Truck className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-lg font-bold mb-2 text-foreground">Reliable Logistics</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">End-to-end shipping coordination from farm gate to FOB Lagos with real-time tracking.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4">
      <Factory className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-lg font-bold mb-2 text-foreground">Modern Processing</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">State-of-the-art cleaning, sorting, drying, and packaging facilities ensuring premium grade.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4">
      <Handshake className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-lg font-bold mb-2 text-foreground">Farmer Partnerships</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">Direct relationships with 500+ smallholder farmers across Nigeria for consistent supply.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4">
      <Award className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-lg font-bold mb-2 text-foreground">NEPC Registered</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">Fully registered with the Nigerian Export Promotion Council for seamless export operations.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mb-4">
      <Leaf className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-lg font-bold mb-2 text-foreground">Sustainable Sourcing</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">Ethical and environmentally conscious practices that support local farming communities.</p>
      </div>
      </div>
      <div className="mt-12 text-center">
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background py-2 font-semibold rounded-full px-8 h-11 border-primary text-primary hover:bg-primary hover:text-primary-foreground" to="/why-choose-us">More Reasons to Choose Us<ArrowRight className="w-4 h-4 ml-2" />
      </Link>
      </div>
      </div>
      </section>
      <section className="py-20 md:py-28 bg-secondary/50">
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center max-w-2xl mx-auto mb-14">
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">Global Reach</span>
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Our Export Markets</h2>
      <p className="text-muted-foreground leading-relaxed">We ship premium commodities to buyers across Europe, Asia, the Middle East, and North America through trusted logistics partners.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
      {(site.markets?.items || []).map((m, i) => (
      <Editable key={`${m.code}-${i}`} section="markets" index={i} label="market">
      <div className="bg-card border border-border rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-9 mx-auto mb-3 rounded-md overflow-hidden border border-border/50">
      <img src={flagSrc(m.code)} onError={onFlagError(m.code)} alt={`${m.name} flag`} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-sm font-semibold text-foreground">{m.name}</p>
      </div>
      </Editable>
      ))}
      <Editable section="markets" add label="country" />
      </div>
      {(site.markets?.caption_left || site.markets?.caption_right) && (
      <Editable section="markets_captions" label="captions" className="mt-10"><div className="flex items-center justify-center gap-6 text-muted-foreground">
      {site.markets?.caption_left && <div className="flex items-center gap-2"><Ship className="w-5 h-5 text-primary" /><span className="text-sm font-medium">{site.markets.caption_left}</span></div>}
      {site.markets?.caption_left && site.markets?.caption_right && <div className="w-px h-5 bg-border" />}
      {site.markets?.caption_right && <div className="flex items-center gap-2"><Globe className="w-5 h-5 text-primary" /><span className="text-sm font-medium">{site.markets.caption_right}</span></div>}
      </div></Editable>
      )}
      </div>
      </section>
      <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center max-w-2xl mx-auto mb-14">
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">Client Feedback</span>
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">What Our Clients Say</h2>
      <p className="text-muted-foreground leading-relaxed">Trusted by procurement teams, food manufacturers, and international buyers across the globe.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {(site.reviews || []).map((r, i) => (
      <Editable key={r.id ?? `${r.name}-${i}`} section="review" id={r.id} label="review"><div className="bg-card border border-border p-6 rounded-2xl flex flex-col hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover h-full">
      <Quote className="w-8 h-8 text-accent/40 mb-4" />
      <p className="text-sm leading-relaxed text-muted-foreground flex-1">“{r.quote}”</p>
      <div className="flex items-center gap-1 mt-4 mb-3" aria-label={`${r.rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(k => <Star key={k} className={`w-4 h-4 ${k <= (Number(r.rating) || 5) ? 'text-accent fill-accent' : 'text-border'}`} />)}
      </div>
      <p className="text-sm font-bold text-foreground">{r.name}</p>
      {r.role && <p className="text-xs text-muted-foreground">{r.role}</p>}
      </div></Editable>
      ))}
      <Editable section="review" add label="review" />
      </div>
      <div className="mt-10 text-center">
      <button type="button" onClick={() => setReviewOpen(true)} className="inline-flex items-center justify-center gap-2 h-11 px-8 rounded-full border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors">Share your experience<ArrowRight className="w-4 h-4" /></button>
      <p className="text-xs text-muted-foreground mt-3">Reviews appear after our team approves them.</p>
      </div>
      <ReviewForm open={reviewOpen} onClose={() => setReviewOpen(false)} />
      </div>
      </section>
      <section className="py-20 md:py-28 bg-secondary/50">
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center max-w-2xl mx-auto mb-14">
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">Latest Insights</span>
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">From Our Blog</h2>
      <p className="text-muted-foreground leading-relaxed">Industry updates, market insights, and export tips from the Vertoc team.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Link className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover block" to="/blog/1">
      <div className="aspect-[16/9] w-full overflow-hidden">
      <img src="/assets/img/stock-1551754655-cd27e38d2076-400.jpg" alt="Understanding the 2025 Nigerian Maize Market Outlook" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
      </div>
      <div className="p-5">
      <p className="text-xs text-muted-foreground mb-2">June 15, 2025</p>
      <h4 className="text-sm font-bold text-foreground leading-snug mb-2">Understanding the 2025 Nigerian Maize Market Outlook</h4>
      <p className="text-xs text-muted-foreground line-clamp-2">A comprehensive look at supply trends, pricing forecasts, and export opportunities for Nigerian maize.</p>
      </div>
      </Link>
      <Link className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover block" to="/blog/2">
      <div className="aspect-[16/9] w-full overflow-hidden">
      <img src="/assets/img/stock-1625246333195-78d9c38ad449-400.jpg" alt="Sustainable Sourcing Practices in African Agriculture" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
      </div>
      <div className="p-5">
      <p className="text-xs text-muted-foreground mb-2">May 28, 2025</p>
      <h4 className="text-sm font-bold text-foreground leading-snug mb-2">Sustainable Sourcing Practices in African Agriculture</h4>
      <p className="text-xs text-muted-foreground line-clamp-2">How Vertoc Agro implements eco-friendly sourcing methods that benefit farmers and the environment.</p>
      </div>
      </Link>
      <Link className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover block" to="/blog/3">
      <div className="aspect-[16/9] w-full overflow-hidden">
      <img src="/assets/img/stock-1596040033229-a9821ebd058d-400.jpg" alt="Export Documentation Guide for Agro Commodities" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
      </div>
      <div className="p-5">
      <p className="text-xs text-muted-foreground mb-2">May 10, 2025</p>
      <h4 className="text-sm font-bold text-foreground leading-snug mb-2">Export Documentation Guide for Agro Commodities</h4>
      <p className="text-xs text-muted-foreground line-clamp-2">Essential certifications, compliance requirements, and best practices for exporting agricultural products from Nigeria.</p>
      </div>
      </Link>
      </div>
      </div>
      </section>
      <section className="relative py-20 md:py-28 overflow-hidden">
      <div className="absolute inset-0" aria-hidden="true">
      <img src="/assets/img/img-20260701-wa0028.jpg" alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-scrim/95 via-scrim/85 to-scrim/70">
      </div>
      </div>
      <div className="relative z-10 container mx-auto px-4 md:px-6">
      <div className="max-w-3xl mx-auto text-center bg-scrim-foreground/10 backdrop-blur-sm border border-scrim-foreground/10 rounded-3xl p-8 md:p-12">
      <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-scrim-foreground mb-5">Ready to Source Premium Commodities?</h2>
      <p className="text-scrim-foreground/80 max-w-2xl mx-auto mb-10 text-base md:text-lg">Whether you need bulk supply, export-ready commodities, or reliable logistics, Vertoc Agro is your trusted partner from farm to market.</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow bg-accent text-white hover:bg-accent/90 font-semibold px-8 h-12 text-base rounded-full" to="/quote">Request a Quote<ArrowRight className="w-4 h-4 ml-2" />
      </Link>
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-accent-foreground border border-scrim-foreground/40 text-scrim-foreground hover:bg-scrim-foreground/15 font-semibold px-8 h-12 text-base rounded-full" to="/contact">Contact Us</Link>
      </div>
      </div>
      </div>
      </section>
    </main>
  )
}
