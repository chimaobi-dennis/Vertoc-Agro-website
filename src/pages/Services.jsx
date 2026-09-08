import { Link } from 'react-router-dom'
import { ArrowRight, Boxes, Factory, PackageSearch, Ship, ShoppingCart, TrendingUp, Truck, Warehouse } from 'lucide-react'

export default function Services() {
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
      <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
      <div className="w-11 h-11 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <TrendingUp className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">Agro Commodity Trading</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">We buy and sell high-quality agricultural commodities across local and international markets, ensuring competitive prices and reliable supply.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
      <div className="w-11 h-11 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <PackageSearch className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">Commodity Sourcing &amp; Aggregation</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">Direct sourcing from smallholder and commercial farmers, aggregating produce to meet bulk demand with strict quality standards.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
      <div className="w-11 h-11 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <Factory className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">Processing</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">State-of-the-art processing facilities to clean, grade, and prepare commodities for market-ready distribution and export.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
      <div className="w-11 h-11 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <Warehouse className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">Warehousing</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">Secure, climate-controlled storage solutions that preserve commodity quality from harvest to delivery.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
      <div className="w-11 h-11 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <Ship className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">Export Services</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">End-to-end export management including documentation, compliance, customs clearance, and international shipping coordination.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
      <div className="w-11 h-11 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <Truck className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">Supply Chain &amp; Logistics</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">Efficient transportation and logistics network ensuring timely delivery from farm gate to final destination.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
      <div className="w-11 h-11 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <Boxes className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">Bulk Supply</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">Large-volume supply agreements for manufacturers, exporters, and industrial buyers with consistent quality assurance.</p>
      </div>
      <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
      <div className="w-11 h-11 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
      <ShoppingCart className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-base font-semibold mb-2 text-foreground">Procurement Services</h4>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">Strategic procurement consulting to help clients source the right commodities at the best value for their operations.</p>
      </div>
      </div>
      <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
      <h3 className="text-xl font-bold text-primary-foreground mb-3">Need a Custom Solution?</h3>
      <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">Our team can tailor a service package to your specific commodity and logistics requirements.</p>
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow rounded-md bg-accent text-foreground hover:bg-accent/90 font-semibold px-8 h-12 text-base" to="/quote">Request a Quote<ArrowRight className="w-4 h-4 ml-2" />
      </Link>
      </div>
      </div>
      </div>
    </main>
  )
}
