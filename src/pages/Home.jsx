import { Link } from 'react-router-dom'
import { ArrowRight, Award, CalendarCheck, Eye, Factory, FlaskConical, Globe, Handshake, Leaf, Package, PackageSearch, Quote, ShieldCheck, Ship, Star, Target, TrendingUp, Truck, Users, Warehouse } from 'lucide-react'
import StatCounter from '../components/StatCounter'

const STATS = [
  { icon: CalendarCheck, value: 8, label: 'Years of Experience' },
  { icon: Globe, value: 12, label: 'Export Countries' },
  { icon: Package, value: 30, label: 'Commodities' },
  { icon: Users, value: 500, label: 'Partner Farmers' },
]

export default function Home() {
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
            {STATS.map(s => (
              <StatCounter key={s.label} {...s} />
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
      <div className="absolute -bottom-6 -right-6 bg-accent text-white rounded-2xl p-5 hidden md:block shadow-hover">
      <p className="text-3xl font-bold">8+</p>
      <p className="text-sm">Years of Excellence</p>
      </div>
      </div>
      <div>
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">About Vertoc</span>
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-5">Connecting Farmers with Global Markets</h2>
      <p className="text-muted-foreground leading-relaxed mb-6">Vertoc Agro Products Limited is a leading Nigerian agribusiness committed to the cultivation of crops, sourcing, processing, storage, logistics, and export of premium agricultural commodities across Nigeria and beyond.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div className="bg-card border border-border p-5 rounded-2xl">
      <Target className="w-5 h-5 text-primary mb-2" />
      <h4 className="text-sm font-bold text-foreground">Our Mission</h4>
      <p className="text-xs text-muted-foreground mt-1">Provide quality products while creating sustainable value for farmers and global markets.</p>
      </div>
      <div className="bg-card border border-border p-5 rounded-2xl">
      <Eye className="w-5 h-5 text-accent mb-2" />
      <h4 className="text-sm font-bold text-foreground">Our Vision</h4>
      <p className="text-xs text-muted-foreground mt-1">Become Africa's most trusted agro commodity company recognized for reliability.</p>
      </div>
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
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
      <button className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all bg-primary text-primary-foreground">All Products</button>
      <button className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all bg-card border border-border text-foreground/70 hover:text-foreground">Agro Commodities</button>
      <button className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all bg-card border border-border text-foreground/70 hover:text-foreground">Solid Minerals</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
      <Link className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover group" to="/products/corn-powder">
      <div className="relative aspect-[4/3] overflow-hidden">
      <img src="/assets/img/img-20260802-wa0021.jpg" alt="Corn Powder" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
      <TrendingUp className="w-3 h-3" />HOT</div>
      <div className="absolute top-3 right-3">
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">AGRO</span>
      </div>
      </div>
      <div className="p-5">
      <h3 className="text-lg font-bold text-foreground mb-1">Corn Powder</h3>
      <p className="text-sm text-muted-foreground">Fine Milled, 14% Moisture Max, 98% Purity</p>
      </div>
      </Link>
      <Link className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover group" to="/products/soya-lecithin">
      <div className="relative aspect-[4/3] overflow-hidden">
      <img src="/assets/img/img-20260802-wa0011.jpg" alt="Soya Lecithin" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
      <TrendingUp className="w-3 h-3" />HOT</div>
      <div className="absolute top-3 right-3">
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">AGRO</span>
      </div>
      </div>
      <div className="p-5">
      <h3 className="text-lg font-bold text-foreground mb-1">Soya Lecithin</h3>
      <p className="text-sm text-muted-foreground">Granular &amp; Liquid, Non-GMO, Min 65% Phosphatides</p>
      </div>
      </Link>
      <Link className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover group" to="/products/palm-oil">
      <div className="relative aspect-[4/3] overflow-hidden">
      <img src="/assets/img/img-20260802-wa0014.jpg" alt="Palm Oil" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
      <TrendingUp className="w-3 h-3" />HOT</div>
      <div className="absolute top-3 right-3">
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">AGRO</span>
      </div>
      </div>
      <div className="p-5">
      <h3 className="text-lg font-bold text-foreground mb-1">Palm Oil</h3>
      <p className="text-sm text-muted-foreground">CP10 / CP8, RBD &amp; Crude, 0.1% FFA Max</p>
      </div>
      </Link>
      <Link className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover group" to="/products/maize">
      <div className="relative aspect-[4/3] overflow-hidden">
      <img src="/assets/img/kling_c61222b5-079f-40bd-be44-7df0bd614a22.jpg" alt="Maize" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
      <TrendingUp className="w-3 h-3" />HOT</div>
      <div className="absolute top-3 right-3">
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">AGRO</span>
      </div>
      </div>
      <div className="p-5">
      <h3 className="text-lg font-bold text-foreground mb-1">Maize</h3>
      <p className="text-sm text-muted-foreground">White &amp; Yellow, 14% Moisture Max, 98% Purity</p>
      </div>
      </Link>
      <Link className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover group" to="/products/soybeans">
      <div className="relative aspect-[4/3] overflow-hidden">
      <img src="/assets/img/kling_e4bbbb6d-91a9-429c-a25c-ca20f298f224.jpg" alt="Soybeans" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute top-3 right-3">
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">AGRO</span>
      </div>
      </div>
      <div className="p-5">
      <h3 className="text-lg font-bold text-foreground mb-1">Soybeans</h3>
      <p className="text-sm text-muted-foreground">Non-GMO, 38% Protein Min, 13% Moisture Max</p>
      </div>
      </Link>
      <Link className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover group" to="/products/cocoa">
      <div className="relative aspect-[4/3] overflow-hidden">
      <img src="/assets/img/single-origin-chocolate-bar-cocoa-heart-1024x1024.jpg" alt="Cocoa Beans" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
      <TrendingUp className="w-3 h-3" />HOT</div>
      <div className="absolute top-3 right-3">
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">AGRO</span>
      </div>
      </div>
      <div className="p-5">
      <h3 className="text-lg font-bold text-foreground mb-1">Cocoa Beans</h3>
      <p className="text-sm text-muted-foreground">Grade 1, Fermented &amp; Sun-Dried, 7-8% Moisture</p>
      </div>
      </Link>
      </div>
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
      <div className="bg-card border border-border rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-9 mx-auto mb-3 rounded-md overflow-hidden border border-border/50">
      <img src="/assets/img/flag-gb.png" alt="United Kingdom flag" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-sm font-semibold text-foreground">United Kingdom</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-9 mx-auto mb-3 rounded-md overflow-hidden border border-border/50">
      <img src="/assets/img/flag-nl.png" alt="Netherlands flag" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-sm font-semibold text-foreground">Netherlands</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-9 mx-auto mb-3 rounded-md overflow-hidden border border-border/50">
      <img src="/assets/img/flag-de.png" alt="Germany flag" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-sm font-semibold text-foreground">Germany</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-9 mx-auto mb-3 rounded-md overflow-hidden border border-border/50">
      <img src="/assets/img/flag-tr.png" alt="Turkey flag" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-sm font-semibold text-foreground">Turkey</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-9 mx-auto mb-3 rounded-md overflow-hidden border border-border/50">
      <img src="/assets/img/flag-ae.png" alt="UAE flag" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-sm font-semibold text-foreground">UAE</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-9 mx-auto mb-3 rounded-md overflow-hidden border border-border/50">
      <img src="/assets/img/flag-in.png" alt="India flag" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-sm font-semibold text-foreground">India</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-9 mx-auto mb-3 rounded-md overflow-hidden border border-border/50">
      <img src="/assets/img/flag-cn.png" alt="China flag" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-sm font-semibold text-foreground">China</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <div className="w-12 h-9 mx-auto mb-3 rounded-md overflow-hidden border border-border/50">
      <img src="/assets/img/flag-us.png" alt="USA flag" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-sm font-semibold text-foreground">USA</p>
      </div>
      </div>
      <div className="mt-10 flex items-center justify-center gap-6 text-muted-foreground">
      <div className="flex items-center gap-2">
      <Ship className="w-5 h-5 text-primary" />
      <span className="text-sm font-medium">FOB Lagos</span>
      </div>
      <div className="w-px h-5 bg-border">
      </div>
      <div className="flex items-center gap-2">
      <Globe className="w-5 h-5 text-primary" />
      <span className="text-sm font-medium">12+ Countries Served</span>
      </div>
      </div>
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
      <div className="bg-card border border-border p-6 rounded-2xl flex flex-col hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <Quote className="w-8 h-8 text-accent/40 mb-4" />
      <p className="text-sm leading-relaxed text-muted-foreground flex-1">“Vertoc Agro has been our most reliable maize supplier for over two years. Their quality consistency is unmatched.”</p>
      <div className="flex items-center gap-1 mt-4 mb-3">
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      </div>
      <p className="text-sm font-bold text-foreground">Sanjay</p>
      <p className="text-xs text-muted-foreground">Procurement Manager of an Indian Based Food Processing company</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl flex flex-col hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <Quote className="w-8 h-8 text-accent/40 mb-4" />
      <p className="text-sm leading-relaxed text-muted-foreground flex-1">“Working with Vertoc has been seamless. Their export documentation is always in order and shipments arrive on time.”</p>
      <div className="flex items-center gap-1 mt-4 mb-3">
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      </div>
      <p className="text-sm font-bold text-foreground">Mitchell</p>
      <p className="text-xs text-muted-foreground">Director of an International Grain company in the UK</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl flex flex-col hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover">
      <Quote className="w-8 h-8 text-accent/40 mb-4" />
      <p className="text-sm leading-relaxed text-muted-foreground flex-1">“We switched to Vertoc for our palm oil supply and have never looked back. Competitive pricing and premium quality.”</p>
      <div className="flex items-center gap-1 mt-4 mb-3">
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      <Star className="w-4 h-4 text-accent fill-accent" />
      </div>
      <p className="text-sm font-bold text-foreground">Johnson</p>
      <p className="text-xs text-muted-foreground">CEO of a Food Processing Company in Nigeria</p>
      </div>
      </div>
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
