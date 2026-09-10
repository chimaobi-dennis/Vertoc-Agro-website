import Turnstile from '../components/Turnstile'
import { useSite, phoneHref, waHref } from '../lib/site'
import { useEnquiryForm } from '../lib/useEnquiryForm'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Mail, MapPin, MessageCircle, Phone, RotateCw, Send, ShieldCheck } from 'lucide-react'

const CONTACT_FIELDS = { name: '', email: '', phone: '', subject: '', message: '' }

export default function Contact() {
  const site = useSite()
  const { field, setToken, submit, status, error } = useEnquiryForm('contact', CONTACT_FIELDS)

  return (
    <main className="flex-grow">
      <div className="pt-28 pb-16 bg-background min-h-screen">
      <script type="application/ld+json">{'{'}"@context":"https://schema.org","@type":"ContactPage","name":"Contact Vertoc Agro Products Limited","url":"https://vertocagro.com/contact","description":"Get in touch with Vertoc Agro Products Limited for commodity inquiries, export consultations, and partnership opportunities.","mainEntity":{'{'}"@type":"Organization","name":"Vertoc Agro Products Limited","email":"sales@vertocagro.com","url":"https://vertocagro.com","contactPoint":{'{'}"@type":"ContactPoint","email":"sales@vertocagro.com","contactType":"customer support","availableLanguage":"English","hoursAvailable":{'{'}"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"09:00","closes":"18:00"{'}'}{'}'}{'}'}{'}'}</script>
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center max-w-2xl mx-auto mb-12">
      <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">Get In Touch</span>
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Contact Us</h1>
      <p className="text-muted-foreground leading-relaxed">We are here to answer your questions, discuss your commodity needs, and build a lasting business partnership.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12 max-w-5xl mx-auto">
      <div className="bg-card border border-border p-5 rounded-2xl flex items-start gap-3">
      <div className="w-9 h-9 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
      <Phone className="w-4 h-4 text-primary" />
      </div>
      <div>
      <p className="text-xs text-muted-foreground uppercase font-medium">Phone</p>
      <p className="text-sm font-semibold text-foreground">{site.phone}</p>
      </div>
      </div>
      <div className="bg-card border border-border p-5 rounded-2xl flex items-start gap-3">
      <div className="w-9 h-9 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
      <Mail className="w-4 h-4 text-primary" />
      </div>
      <div>
      <p className="text-xs text-muted-foreground uppercase font-medium">Email</p>
      <p className="text-sm font-semibold text-foreground">{site.email}</p>
      </div>
      </div>
      <div className="bg-card border border-border p-5 rounded-2xl flex items-start gap-3">
      <div className="w-9 h-9 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
      <MapPin className="w-4 h-4 text-primary" />
      </div>
      <div>
      <p className="text-xs text-muted-foreground uppercase font-medium">Address</p>
      <p className="text-sm font-semibold text-foreground">{site.address}</p>
      </div>
      </div>
      <div className="bg-card border border-border p-5 rounded-2xl flex items-start gap-3">
      <div className="w-9 h-9 bg-primary/10 flex items-center justify-center rounded-2xl shrink-0">
      <Clock className="w-4 h-4 text-primary" />
      </div>
      <div>
      <p className="text-xs text-muted-foreground uppercase font-medium">Hours</p>
      <p className="text-sm font-semibold text-foreground">{site.hours}</p>
      </div>
      </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
      <div className="lg:col-span-2 bg-card border border-border p-6 md:p-8 rounded-2xl">
      <h2 className="text-lg font-bold text-foreground mb-1">Send a Message</h2>
      <p className="text-sm text-muted-foreground mb-6">Fill out the form below and we will respond within 24 hours.</p>
      {status === 'sent' ? (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-6 text-center">
          <ShieldCheck className="w-6 h-6 text-accent mx-auto mb-3" />
          <p className="font-semibold text-foreground mb-1">Thank you — we&rsquo;ve received your message.</p>
          <p className="text-sm text-muted-foreground">Our team typically responds within one business day.</p>
        </div>
      ) : (
      <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Name *</label>
          <input className="flex h-9 w-full rounded-md border border-input bg-transparent py-1 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm px-2" required placeholder="Your full name" {...field('name')} />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Email *</label>
          <input type="email" className="flex h-9 w-full rounded-md border border-input bg-transparent py-1 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm px-2" required placeholder="your@email.com" {...field('email')} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Phone</label>
          <input className="flex h-9 w-full rounded-md border border-input bg-transparent py-1 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm px-2" placeholder="+234 ..." {...field('phone')} />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Subject *</label>
          <input className="flex h-9 w-full rounded-md border border-input bg-transparent py-1 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm px-2" required placeholder="How can we help?" {...field('subject')} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">Message *</label>
        <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm px-2" required rows={5} placeholder="Tell us about your needs..." {...field('message')} />
      </div>
      <div className="p-4 bg-secondary/40 border border-border rounded-xl space-y-3">
        {/* Honeypot: hidden from people, irresistible to bots. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website-contact">Leave this field blank</label>
          <input id="website-contact" type="text" tabIndex={-1} autoComplete="off" {...field('website')} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Security Verification</span>
          </div>
          <span className="text-[11px] text-muted-foreground">Spam protection</span>
        </div>

        <Turnstile onVerify={setToken} />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}

      <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full sm:w-auto rounded-full px-8 h-12" type="submit" disabled={status === 'sending'}>
        <Send className="w-4 h-4 mr-2" />
        {status === 'sending' ? 'Sending…' : 'Send Message'}
      </button>
      </form>
      )}
      </div>
      <div className="space-y-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-2xl">
      <h3 className="text-lg font-bold mb-2">Need a Quote?</h3>
      <p className="text-sm text-primary-foreground/80 mb-4">Looking for bulk pricing on commodities? Submit a quote request and we will get back within 24 hours.</p>
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:text-accent-foreground h-9 px-4 py-2 w-full bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 font-semibold rounded-full" to="/quote">Request a Quote<ArrowRight className="w-4 h-4 ml-2" />
      </Link>
      </div>
      <a href={waHref(site.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-[#25D366] text-white p-4 rounded-2xl hover:opacity-90 transition-opacity">
      <MessageCircle className="w-6 h-6" />
      <div>
      <p className="text-sm font-semibold">Chat with us on WhatsApp</p>
      <p className="text-xs text-white/80">Fast response for urgent inquiries</p>
      </div>
      </a>
      <div className="rounded-2xl overflow-hidden border border-border">
      <iframe title="Vertoc Agro Office Location" width="100%" height="200" frameborder="0" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=AIzaSyB_LJOYJL-84SMuxNB7LtRGhxEQLjswvy0&q=Akala+Express+Way,Ibadan,Oyo+State,Nigeria&language=en&region=ng" allowfullscreen="" style={{ border: '0px' }}>
      </iframe>
      </div>
      </div>
      </div>
      </div>
      </div>
    </main>
  )
}
