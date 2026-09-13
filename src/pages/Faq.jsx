import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, HelpCircle } from 'lucide-react'

/* Questions and answers recovered verbatim from the original site. */
const FAQS = [
  ['What agricultural commodities does Vertoc Agro trade in?', 'We trade in a wide range of premium Nigerian agricultural commodities including palm oil, maize, soybeans, cocoa, plantain, cassava, sesame seeds, ginger, rice, sorghum, millet, and groundnuts. If you need a specific commodity not listed, please contact us and we will source it for you.'],
  ['Do you export commodities outside Nigeria?', 'Yes, export services are a core part of our business. We handle end-to-end export management including documentation, compliance, customs clearance, and international shipping coordination. We currently export to over 25 countries across Africa, Europe, Asia, and the Americas.'],
  ['What is your minimum order quantity?', 'Our minimum order quantities vary by commodity. For most products, we can accommodate orders starting from 5 metric tonnes. For export shipments, typical minimums range from 1 to 5 full container loads depending on the commodity. Contact us for specific details.'],
  ['How do you ensure product quality?', 'Quality assurance is embedded in every stage of our process. We conduct rigorous field inspections, laboratory testing, and grading before acceptance. Our processing and warehousing facilities maintain strict hygiene and climate control standards. All shipments come with certificates of analysis and quality assurance documentation.'],
  ['What payment terms do you offer?', 'We offer flexible payment terms depending on the relationship and order size. Standard terms include advance payment, letter of credit (LC), and payment against documents. For established partners, we may offer open account terms with approved credit limits.'],
  ['How long does delivery take after placing an order?', 'Delivery timelines depend on the commodity, order size, and destination. Domestic deliveries within Nigeria typically take 3-10 business days. Export shipments require additional time for documentation and logistics, generally 2-6 weeks depending on the destination port.'],
  ['Do you work with smallholder farmers?', 'Absolutely. Partnership with smallholder farmers is central to our mission. We work directly with farming cooperatives and individual farmers, providing training, fair pricing, and reliable offtake agreements that help improve their livelihoods and productivity.'],
  ['Can I visit your processing or warehousing facilities?', 'Yes, we welcome facility visits by qualified buyers and partners. Please contact us to schedule a visit. Our team will arrange a guided tour of our processing plants, warehouses, or farm sourcing locations depending on your interests.'],
  ['Do you provide commodity price forecasts?', 'We regularly publish market analysis and price outlooks on our blog. For contracted partners, we provide personalized market intelligence and pricing updates relevant to their specific commodities and trading windows.'],
  ['How can I become a registered buyer or partner?', 'Simply fill out the contact form on our website or send us an email at sales@vertocagro.com with your company details and commodity requirements. Our business development team will reach out to discuss your needs and onboarding process.'],
]

export default function Faq() {
  const [open, setOpen] = useState(null)   // one answer open at a time, like the original
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <div className="text-center mb-10">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-2xl mx-auto mb-4">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">Support</span>
            <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Frequently Asked Questions</h1>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Find answers to common questions about our commodities, services, ordering process, and partnerships.
            </p>
          </div>
          <div className="space-y-3">
            {FAQS.map(([q, a], i) => {
              const isOpen = open === i
              return (
                <div key={q} data-state={isOpen ? 'open' : 'closed'} className="bg-card border border-border rounded-2xl px-5">
                  <h3 className="flex">
                    <button type="button" aria-expanded={isOpen} aria-controls={`faq-${i}`} id={`faq-trigger-${i}`} data-state={isOpen ? 'open' : 'closed'}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex flex-1 items-center justify-between transition-all [&[data-state=open]>svg]:rotate-180 text-left text-sm font-semibold text-foreground hover:no-underline py-4">
                      {q}
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                    </button>
                  </h3>
                  {isOpen && (
                    <div id={`faq-${i}`} role="region" aria-labelledby={`faq-trigger-${i}`} className="overflow-hidden text-sm animate-fade-in">
                      <div className="pt-0 text-sm text-muted-foreground leading-relaxed pb-4">{a}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-10 bg-primary rounded-2xl p-6 md:p-8 text-center">
            <h3 className="text-lg font-bold text-primary-foreground mb-2">Still Have Questions?</h3>
            <p className="text-sm text-primary-foreground/80 mb-4">
              Our team is happy to help. Reach out and we will get back to you within 24 hours.
            </p>
            <Link className="inline-flex items-center justify-center bg-accent text-foreground hover:bg-accent/90 font-semibold px-6 py-2.5 rounded-2xl text-sm transition-colors" to="/contact">Contact Us</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
