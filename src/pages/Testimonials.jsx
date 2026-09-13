import { Link } from 'react-router-dom'
import { ArrowRight, Quote, Star } from 'lucide-react'

/* Recovered from the original site — "Testimonials - Vertoc Agro". */
export default function Testimonials() {
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">Client Feedback</span>
            <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">What Our Clients Say</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Trusted by manufacturers, exporters, and food companies across Nigeria and beyond.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex flex-col hover:-translate-y-1 transition-transform duration-200">
              <Quote className="w-8 h-8 text-accent/50 mb-4" />
              <p className="text-sm leading-relaxed text-muted-foreground flex-1">
                “Vertoc Agro has been our most reliable maize supplier for over two years. Their quality consistency and on-time delivery have significantly improved our production planning.”
              </p>
              <div className="flex items-center gap-1 mt-4 mb-3">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Chinedu Obasi</p>
                <p className="text-xs text-muted-foreground">Procurement Manager, NutriFeeds Ltd</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex flex-col hover:-translate-y-1 transition-transform duration-200">
              <Quote className="w-8 h-8 text-accent/50 mb-4" />
              <p className="text-sm leading-relaxed text-muted-foreground flex-1">
                “Working with Vertoc has been seamless. Their export documentation is always in order, and the commodity quality exceeds our buyers expectations every single time.”
              </p>
              <div className="flex items-center gap-1 mt-4 mb-3">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Sarah Mitchell</p>
                <p className="text-xs text-muted-foreground">Director, Global Grain Exports UK</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex flex-col hover:-translate-y-1 transition-transform duration-200">
              <Quote className="w-8 h-8 text-accent/50 mb-4" />
              <p className="text-sm leading-relaxed text-muted-foreground flex-1">
                “We switched to Vertoc for our palm oil supply and have never looked back. Competitive pricing, premium quality, and a team that truly understands the business.”
              </p>
              <div className="flex items-center gap-1 mt-4 mb-3">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Adebayo Johnson</p>
                <p className="text-xs text-muted-foreground">CEO, Johnson Foods Nigeria</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex flex-col hover:-translate-y-1 transition-transform duration-200">
              <Quote className="w-8 h-8 text-accent/50 mb-4" />
              <p className="text-sm leading-relaxed text-muted-foreground flex-1">
                “Their warehousing and logistics capabilities are top-notch. We have reduced our spoilage rate by 40% since partnering with Vertoc for soybeans and cassava.”
              </p>
              <div className="flex items-center gap-1 mt-4 mb-3">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Fatima Bello</p>
                <p className="text-xs text-muted-foreground">Supply Chain Lead, West African Mills</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex flex-col hover:-translate-y-1 transition-transform duration-200">
              <Quote className="w-8 h-8 text-accent/50 mb-4" />
              <p className="text-sm leading-relaxed text-muted-foreground flex-1">
                “Vertoc handles our sesame seed exports with professionalism. From sourcing to shipping container, the entire process is transparent and reliable.”
              </p>
              <div className="flex items-center gap-1 mt-4 mb-3">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Robert Chen</p>
                <p className="text-xs text-muted-foreground">Buyer, Pacific Foods Asia</p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl transition-all duration-300 flex flex-col hover:-translate-y-1 transition-transform duration-200">
              <Quote className="w-8 h-8 text-accent/50 mb-4" />
              <p className="text-sm leading-relaxed text-muted-foreground flex-1">
                “As a farming cooperative, we rely on Vertoc to get fair prices for our produce. They have helped us scale from 50 to over 500 member farmers.”
              </p>
              <div className="flex items-center gap-1 mt-4 mb-3">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
                <Star className="w-4 h-4 text-accent fill-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Emeka Nwosu</p>
                <p className="text-xs text-muted-foreground">Founder, GreenField Farms Cooperative</p>
              </div>
            </div>
          </div>
          <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
            <h3 className="text-xl font-bold text-primary-foreground mb-3">Join Our Satisfied Clients</h3>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">
              Experience the Vertoc difference. Let us handle your commodity needs with professionalism and care.
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

