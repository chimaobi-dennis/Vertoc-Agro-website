import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { useSite } from '../lib/site'
import { Editable } from '../lib/editing'

/* Questions and answers come from the site data (edited in place by signed-in staff). */
export default function Faq() {
  const site = useSite()
  const faqs = site.faq || []
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
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Find answers to common questions about our commodities, services, ordering process, and partnerships.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => {
              const isOpen = open === i
              return (
                <Editable key={`${f.q}-${i}`} section="faq" index={i} label="question">
                <div data-state={isOpen ? 'open' : 'closed'} className="bg-card border border-border rounded-2xl px-5">
                  <h3 className="flex">
                    <button type="button" aria-expanded={isOpen} aria-controls={`faq-${i}`} id={`faq-trigger-${i}`} data-state={isOpen ? 'open' : 'closed'}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex flex-1 items-center justify-between transition-all [&[data-state=open]>svg]:rotate-180 text-left text-sm font-semibold text-foreground hover:no-underline py-4 pr-14">
                      {f.q}
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                    </button>
                  </h3>
                  {isOpen && (
                    <div id={`faq-${i}`} role="region" aria-labelledby={`faq-trigger-${i}`} className="overflow-hidden text-sm animate-fade-in">
                      <div className="pt-0 text-sm text-muted-foreground leading-relaxed pb-4 whitespace-pre-line">{f.a}</div>
                    </div>
                  )}
                </div>
                </Editable>
              )
            })}
            <Editable section="faq" add label="question" className="w-full" />
          </div>
          <div className="mt-10 bg-primary rounded-2xl p-6 md:p-8 text-center">
            <h3 className="text-lg font-bold text-primary-foreground mb-2">Still Have Questions?</h3>
            <p className="text-sm text-primary-foreground/80 mb-4">Our team is happy to help. Reach out and we will get back to you within 24 hours.</p>
            <Link className="inline-flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-6 py-2.5 rounded-2xl text-sm transition-colors" to="/contact">Contact Us</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
