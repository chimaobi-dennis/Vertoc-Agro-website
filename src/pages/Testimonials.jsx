import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MessageSquarePlus, Quote, Star } from 'lucide-react'
import { useApi } from '../lib/api'
import { useSite } from '../lib/site'
import ReviewForm from '../components/ReviewForm'
import { Bone } from '../components/Skeleton'

/* Every approved client review (the homepage shows the first six). Clients can submit their own; it appears once the team approves it. */
export default function Testimonials() {
  const site = useSite()
  const { data, loading } = useApi('/reviews')
  const reviews = data || site.reviews || []
  const [open, setOpen] = useState(false)
  const share = (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 h-11 px-7 rounded-full border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors">
      <MessageSquarePlus className="w-4 h-4" />Share your experience
    </button>
  )
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">Client Feedback</span>
            <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">What Our Clients Say</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">Trusted by manufacturers, exporters, and food companies across Nigeria and beyond.</p>
            <div className="mt-6">{share}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12" aria-busy={loading && !data}>
            {loading && !data && [0, 1, 2].map(i => (
              <div key={i} className="bg-card border border-border p-6 rounded-2xl space-y-3"><Bone className="h-8 w-8" /><Bone className="h-4 w-full" /><Bone className="h-4 w-5/6" /><Bone className="h-4 w-2/3" /><Bone className="h-3 w-1/3 mt-4" /></div>
            ))}
            {reviews.map((r, i) => (
              <div key={r.id ?? `${r.name}-${i}`} className="bg-card border border-border p-6 rounded-2xl flex flex-col hover:-translate-y-1 transition-transform duration-200">
                <Quote className="w-8 h-8 text-accent/50 mb-4" />
                <p className="text-sm leading-relaxed text-muted-foreground flex-1">“{r.quote}”</p>
                <div className="flex items-center gap-1 mt-4 mb-3" aria-label={`${r.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map(k => <Star key={k} className={`w-4 h-4 ${k <= (Number(r.rating) || 5) ? 'text-accent fill-accent' : 'text-border'}`} />)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.name}</p>
                  {r.role && <p className="text-xs text-muted-foreground">{r.role}</p>}
                </div>
              </div>
            ))}
            {!loading && reviews.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-10">No reviews yet. Be the first to share your experience.</p>}
          </div>
          <div className="bg-primary rounded-2xl p-8 md:p-10 text-center">
            <h3 className="text-xl font-bold text-primary-foreground mb-3">Join Our Satisfied Clients</h3>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">Experience the Vertoc difference. Let us handle your commodity needs with professionalism and care.</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-8 h-12 text-base transition-colors" to="/quote">Get a Quote<ArrowRight className="w-4 h-4" /></Link>
              <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full border border-primary-foreground/40 text-primary-foreground text-base font-semibold hover:bg-primary-foreground/10 transition-colors">Leave a review</button>
            </div>
          </div>
        </div>
      </div>
      <ReviewForm open={open} onClose={() => setOpen(false)} />
    </main>
  )
}
