import { Link } from 'react-router-dom'
import { ArrowRight, Beef, Building2, Factory, Plane, ShoppingBag, Store, UtensilsCrossed } from 'lucide-react'

/* Recovered from the original site — "Industries - Vertoc Agro". */
export default function Industries() {
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
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex items-start gap-4 hover:-translate-y-1 transition-transform duration-200">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
                <UtensilsCrossed className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">Food Manufacturers</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Supplying raw materials for food processing and packaged goods production.</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex items-start gap-4 hover:-translate-y-1 transition-transform duration-200">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
                <Plane className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">Exporters</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Partnering with export houses to fulfill international commodity contracts.</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex items-start gap-4 hover:-translate-y-1 transition-transform duration-200">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">FMCG Companies</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Reliable bulk supply for fast-moving consumer goods manufacturers.</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex items-start gap-4 hover:-translate-y-1 transition-transform duration-200">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
                <Beef className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">Animal Feed Producers</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Maize, soybeans, and cassava for livestock and poultry feed mills.</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex items-start gap-4 hover:-translate-y-1 transition-transform duration-200">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">Wholesalers</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Large-volume commodity supply for regional and national distributors.</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex items-start gap-4 hover:-translate-y-1 transition-transform duration-200">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">Retail Chains</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Consistent quality and supply for supermarket and retail procurement.</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex items-start gap-4 hover:-translate-y-1 transition-transform duration-200">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
                <Factory className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">Industrial Buyers</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Raw materials for biofuel, starch, oil extraction, and pharmaceutical industries.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
            <h3 className="text-xl font-bold text-primary-foreground mb-3">Is Your Industry Listed?</h3>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">
              We adapt our services to meet the unique needs of every sector. Let us discuss how we can help.
            </p>
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

