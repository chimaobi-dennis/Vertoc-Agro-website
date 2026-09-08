import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Earth, HeartHandshake, Leaf, ShieldCheck, Users } from 'lucide-react'

export default function Sustainability() {
  return (
    <main className="flex-grow">
      <section className="relative pt-32 pb-16 overflow-hidden bg-primary">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent blur-3xl">
      </div>
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-accent blur-2xl">
      </div>
      </div>
      <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
      <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow hover:bg-primary/80 mb-4 bg-accent/20 text-accent border-accent/30 uppercase tracking-widest text-xs font-semibold">Our Commitments</div>
      <h1 className="font-serif text-3xl md:text-5xl font-bold text-primary-foreground mb-4 text-balance">Sustainability Policies</h1>
      <p className="text-primary-foreground/70 max-w-2xl mx-auto text-base md:text-lg leading-relaxed text-pretty">At Vertoc Agro, sustainability is not a checkbox — it is embedded in every decision we make. Explore our five core policy frameworks below.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-2 md:gap-3">
      <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border bg-accent text-accent-foreground border-accent shadow-lg scale-105">
      <Leaf className="w-4 h-4 shrink-0" />
      <span>ESG Policy</span>
      </button>
      <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border bg-white/10 text-primary-foreground/80 border-white/20 hover:bg-white/20">
      <Users className="w-4 h-4 shrink-0" />
      <span>DEI Policy</span>
      </button>
      <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border bg-white/10 text-primary-foreground/80 border-white/20 hover:bg-white/20">
      <HeartHandshake className="w-4 h-4 shrink-0" />
      <span>Human Rights Policy</span>
      </button>
      <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border bg-white/10 text-primary-foreground/80 border-white/20 hover:bg-white/20">
      <ShieldCheck className="w-4 h-4 shrink-0" />
      <span>IMS Policy</span>
      </button>
      <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border bg-white/10 text-primary-foreground/80 border-white/20 hover:bg-white/20">
      <Earth className="w-4 h-4 shrink-0" />
      <span>EUDR Compliance</span>
      </button>
      </div>
      </div>
      </section>
      <section className="bg-background py-12 md:py-20 min-h-[60vh]">
      <div className="container mx-auto px-4 md:px-6">
      <div className="flex items-start justify-between gap-4 mb-10">
      <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-accent/10 text-accent border-accent/20">
      <Leaf className="w-3.5 h-3.5" />ESG Policy</span>
      <span className="text-muted-foreground text-xs">1 / 5</span>
      </div>
      <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground text-balance mb-2">Environmental, Social &amp; Governance Policy</h2>
      <p className="text-muted-foreground italic text-base">Responsible growth that protects people and planet.</p>
      </div>
      <div className="shrink-0 flex items-center gap-2 mt-1">
      <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-full h-10 w-10" disabled aria-label="Previous policy">
      <ChevronLeft className="w-4 h-4" />
      </button>
      <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-full h-10 w-10" aria-label="Next policy">
      <ChevronRight className="w-4 h-4" />
      </button>
      </div>
      </div>
      <div className="bg-secondary/60 border border-border rounded-2xl p-5 md:p-7 mb-8">
      <p className="text-foreground leading-relaxed text-base">Vertoc Agro Products Limited is committed to integrating Environmental, Social, and Governance (ESG) principles at the heart of our business strategy. We believe that sustainable commerce is not just ethical — it is essential for long-term value creation.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-5 md:gap-6">
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
      <div className="w-1.5 h-6 rounded-full bg-accent shrink-0">
      </div>
      <h3 className="font-semibold text-foreground text-base">Environmental Commitment</h3>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">We minimise our environmental footprint by promoting responsible land-use practices, reducing post-harvest losses through improved processing and storage, and optimising logistics to lower carbon emissions. We work exclusively with farmers and suppliers who adopt sustainable agronomic practices, including appropriate use of inputs, soil conservation, and water management. We actively monitor and seek to reduce greenhouse gas emissions across our supply chain, with a target of full Scope 1 and 2 mapping by 2026.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
      <div className="w-1.5 h-6 rounded-full bg-accent shrink-0">
      </div>
      <h3 className="font-semibold text-foreground text-base">Social Responsibility</h3>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">Our business creates direct and indirect livelihoods for thousands of smallholder farmers, processors, and logistics providers across Nigeria. We pay fair prices, provide technical knowledge transfer, and ensure timely payments to all our suppliers. We invest in community development programmes in our source communities, including access to clean water, road infrastructure support, and educational sponsorships. We maintain a zero-tolerance policy for child labour, forced labour, and any form of exploitation throughout our value chain.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
      <div className="w-1.5 h-6 rounded-full bg-accent shrink-0">
      </div>
      <h3 className="font-semibold text-foreground text-base">Governance &amp; Ethics</h3>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">Vertoc Agro operates with the highest standards of corporate governance. We maintain transparent financial reporting, uphold Anti-Bribery and Anti-Corruption (ABAC) standards aligned with the UK Bribery Act and Nigeria's EFCC/ICPC frameworks, and enforce a strict conflict-of-interest policy for all directors and employees. Our Board of Directors reviews ESG performance annually. We publish our ESG disclosures to relevant stakeholders and continuously improve our practices based on internationally recognised frameworks including GRI and UN SDGs.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
      <div className="w-1.5 h-6 rounded-full bg-accent shrink-0">
      </div>
      <h3 className="font-semibold text-foreground text-base">Targets &amp; Accountability</h3>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">We set measurable ESG targets reviewed annually. Our key commitments include: achieving a fully documented and auditable supply chain by 2027; reducing food and commodity waste by 30% through improved storage and grading; ensuring 100% of our direct-sourcing contracts include a sustainability rider; and maintaining ISO 14001-aligned environmental management practices at our facilities.</p>
      </div>
      </div>
      <div className="flex flex-col items-center gap-4 mt-10">
      <div className="flex items-center gap-2">
      <button aria-label="Go to ESG Policy" className="rounded-full transition-all duration-200 w-6 h-2.5 bg-accent">
      </button>
      <button aria-label="Go to DEI Policy" className="rounded-full transition-all duration-200 w-2.5 h-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60">
      </button>
      <button aria-label="Go to Human Rights Policy" className="rounded-full transition-all duration-200 w-2.5 h-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60">
      </button>
      <button aria-label="Go to IMS Policy" className="rounded-full transition-all duration-200 w-2.5 h-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60">
      </button>
      <button aria-label="Go to EUDR Compliance" className="rounded-full transition-all duration-200 w-2.5 h-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60">
      </button>
      </div>
      <p className="text-muted-foreground/60 text-xs">Swipe left/right or use arrow keys to navigate</p>
      </div>
      <div className="flex items-center justify-between mt-8 gap-4">
      <div className="flex-1">
      </div>
      <div className="flex-1 flex justify-end">
      <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
      <span>DEI Policy</span>
      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
      </div>
      </div>
      </div>
      </section>
      <section className="py-16 bg-secondary/50 border-t border-border">
      <div className="container mx-auto px-4 md:px-6 text-center max-w-2xl">
      <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-4">Partner with a Responsible Exporter</h2>
      <p className="text-muted-foreground mb-7 leading-relaxed">Our sustainability commitments are backed by documentation and third-party verification. Request our full policy documentation or speak to our compliance team.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-10 bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 font-semibold" to="/contact">Contact Us <ArrowRight className="ml-2 w-4 h-4" />
      </Link>
      <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 rounded-full px-8 font-semibold" to="/quote">Request a Quote</Link>
      </div>
      </div>
      </section>
    </main>
  )
}
