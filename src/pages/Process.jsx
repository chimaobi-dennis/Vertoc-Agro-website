import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardCheck, Cog, Package, Search, Ship, Truck } from 'lucide-react'

/* Recovered from the original site — "Our Process - Vertoc Agro". */
export default function Process() {
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">How We Work</span>
            <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Our Process</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              A seamless, transparent process from farm to delivery that ensures quality at every stage.
            </p>
          </div>
          <div className="hidden md:block mb-12">
            <div className="flex items-start justify-between gap-4 relative">
              <div className="absolute top-6 left-[8%] right-[8%] h-0.5 bg-border" />
              <div className="relative flex flex-col items-center text-center z-10 w-40">
                <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-2xl mb-4">
                  <Search className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xs font-bold text-accent mb-1">Step 1</span>
                <h4 className="text-sm font-semibold text-foreground mb-1">Sourcing</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Direct procurement from verified farmers and cooperatives across Nigeria.</p>
              </div>
              <div className="relative flex flex-col items-center text-center z-10 w-40">
                <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-2xl mb-4">
                  <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xs font-bold text-accent mb-1">Step 2</span>
                <h4 className="text-sm font-semibold text-foreground mb-1">Quality Inspection</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Rigorous lab and field testing to ensure commodity standards are met.</p>
              </div>
              <div className="relative flex flex-col items-center text-center z-10 w-40">
                <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-2xl mb-4">
                  <Cog className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xs font-bold text-accent mb-1">Step 3</span>
                <h4 className="text-sm font-semibold text-foreground mb-1">Processing</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Cleaning, grading, and preparation using modern equipment and techniques.</p>
              </div>
              <div className="relative flex flex-col items-center text-center z-10 w-40">
                <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-2xl mb-4">
                  <Package className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xs font-bold text-accent mb-1">Step 4</span>
                <h4 className="text-sm font-semibold text-foreground mb-1">Storage</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Climate-controlled warehousing to preserve freshness and prevent spoilage.</p>
              </div>
              <div className="relative flex flex-col items-center text-center z-10 w-40">
                <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-2xl mb-4">
                  <Truck className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xs font-bold text-accent mb-1">Step 5</span>
                <h4 className="text-sm font-semibold text-foreground mb-1">Logistics</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Coordinated inland transport from warehouse to port of export.</p>
              </div>
              <div className="relative flex flex-col items-center text-center z-10 w-40">
                <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-2xl mb-4">
                  <Ship className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xs font-bold text-accent mb-1">Step 6</span>
                <h4 className="text-sm font-semibold text-foreground mb-1">Delivery / Export</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Final shipment with full documentation, customs clearance, and tracking.</p>
              </div>
            </div>
          </div>
          <div className="md:hidden space-y-6 mb-12">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-2xl shrink-0">
                  <Search className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="w-0.5 h-10 bg-border mt-2" />
              </div>
              <div>
                <span className="text-xs font-bold text-accent">Step 1</span>
                <h4 className="text-sm font-semibold text-foreground">Sourcing</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">Direct procurement from verified farmers and cooperatives across Nigeria.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-2xl shrink-0">
                  <ClipboardCheck className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="w-0.5 h-10 bg-border mt-2" />
              </div>
              <div>
                <span className="text-xs font-bold text-accent">Step 2</span>
                <h4 className="text-sm font-semibold text-foreground">Quality Inspection</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">Rigorous lab and field testing to ensure commodity standards are met.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-2xl shrink-0">
                  <Cog className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="w-0.5 h-10 bg-border mt-2" />
              </div>
              <div>
                <span className="text-xs font-bold text-accent">Step 3</span>
                <h4 className="text-sm font-semibold text-foreground">Processing</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">Cleaning, grading, and preparation using modern equipment and techniques.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-2xl shrink-0">
                  <Package className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="w-0.5 h-10 bg-border mt-2" />
              </div>
              <div>
                <span className="text-xs font-bold text-accent">Step 4</span>
                <h4 className="text-sm font-semibold text-foreground">Storage</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">Climate-controlled warehousing to preserve freshness and prevent spoilage.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-2xl shrink-0">
                  <Truck className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="w-0.5 h-10 bg-border mt-2" />
              </div>
              <div>
                <span className="text-xs font-bold text-accent">Step 5</span>
                <h4 className="text-sm font-semibold text-foreground">Logistics</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">Coordinated inland transport from warehouse to port of export.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-2xl shrink-0">
                  <Ship className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
              <div>
                <span className="text-xs font-bold text-accent">Step 6</span>
                <h4 className="text-sm font-semibold text-foreground">Delivery / Export</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">Final shipment with full documentation, customs clearance, and tracking.</p>
              </div>
            </div>
          </div>
          <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
            <h3 className="text-xl font-bold text-primary-foreground mb-3">Ready to Start Your Order?</h3>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">Our team is ready to guide you through every step of the process.</p>
            <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow rounded-md bg-accent text-foreground hover:bg-accent/90 font-semibold px-8 h-12 text-base" data-discover="true" to="/contact">
              Contact Us
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

