import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, BadgeDollarSign, Clock, Globe, Handshake, Link2, Sprout, UserCheck } from 'lucide-react'

/* Recovered from the original site — "Why Choose Us - Vertoc Agro". */
export default function WhyChooseUs() {
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
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
                <BadgeCheck className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-base font-semibold mb-2 text-foreground">Premium Quality Products</h4>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">Rigorous quality control ensures every commodity meets international standards.</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-base font-semibold mb-2 text-foreground">Reliable Supply Chain</h4>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">End-to-end logistics from farm to port with full traceability and transparency.</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
                <BadgeDollarSign className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-base font-semibold mb-2 text-foreground">Competitive Pricing</h4>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Direct farmer relationships and efficient operations translate to better prices.
              </p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-base font-semibold mb-2 text-foreground">Timely Delivery</h4>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">Commitment to on-time shipments with proactive communication at every stage.</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
                <UserCheck className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-base font-semibold mb-2 text-foreground">Experienced Team</h4>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Seasoned professionals with deep knowledge of Nigerian agriculture and global trade.
              </p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-base font-semibold mb-2 text-foreground">Export Ready</h4>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Full export compliance, certifications, and documentation for international markets.
              </p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
                <Sprout className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-base font-semibold mb-2 text-foreground">Sustainable Practices</h4>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Eco-friendly sourcing and processing methods that support long-term farm productivity.
              </p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-2xl mb-4 shrink-0">
                <Handshake className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-base font-semibold mb-2 text-foreground">Strong Relationships</h4>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">Trusted partnerships with farmers, cooperatives, and buyers built over years.</p>
            </div>
          </div>
          <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
            <h3 className="text-xl font-bold text-primary-foreground mb-3">Experience the Vertoc Advantage</h3>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">
              Join leading manufacturers, exporters, and food companies who trust us as their agro commodity partner.
            </p>
            <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow rounded-md bg-accent text-foreground hover:bg-accent/90 font-semibold px-8 h-12 text-base" data-discover="true" to="/contact">
              Get a Quote
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

