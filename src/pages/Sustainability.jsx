import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Earth, HeartHandshake, Leaf, ShieldCheck, Users } from 'lucide-react'

/* The five policy frameworks. Text recovered verbatim from the original site. */
const POLICIES = [
  {
    key: 'esg', label: 'ESG Policy', icon: Leaf, badge: 'bg-accent/10 text-accent border-accent/20',
    title: 'Environmental, Social & Governance Policy', tagline: 'Responsible growth that protects people and planet.',
    intro: 'Vertoc Agro Products Limited is committed to integrating Environmental, Social, and Governance (ESG) principles at the heart of our business strategy. We believe that sustainable commerce is not just ethical — it is essential for long-term value creation.',
    sections: [
      ['Environmental Commitment', 'We minimise our environmental footprint by promoting responsible land-use practices, reducing post-harvest losses through improved processing and storage, and optimising logistics to lower carbon emissions. We work exclusively with farmers and suppliers who adopt sustainable agronomic practices, including appropriate use of inputs, soil conservation, and water management. We actively monitor and seek to reduce greenhouse gas emissions across our supply chain, with a target of full Scope 1 and 2 mapping by 2026.'],
      ['Social Responsibility', 'Our business creates direct and indirect livelihoods for thousands of smallholder farmers, processors, and logistics providers across Nigeria. We pay fair prices, provide technical knowledge transfer, and ensure timely payments to all our suppliers. We invest in community development programmes in our source communities, including access to clean water, road infrastructure support, and educational sponsorships. We maintain a zero-tolerance policy for child labour, forced labour, and any form of exploitation throughout our value chain.'],
      ['Governance & Ethics', "Vertoc Agro operates with the highest standards of corporate governance. We maintain transparent financial reporting, uphold Anti-Bribery and Anti-Corruption (ABAC) standards aligned with the UK Bribery Act and Nigeria's EFCC/ICPC frameworks, and enforce a strict conflict-of-interest policy for all directors and employees. Our Board of Directors reviews ESG performance annually. We publish our ESG disclosures to relevant stakeholders and continuously improve our practices based on internationally recognised frameworks including GRI and UN SDGs."],
      ['Targets & Accountability', 'We set measurable ESG targets reviewed annually. Our key commitments include: achieving a fully documented and auditable supply chain by 2027; reducing food and commodity waste by 30% through improved storage and grading; ensuring 100% of our direct-sourcing contracts include a sustainability rider; and maintaining ISO 14001-aligned environmental management practices at our facilities.'],
    ],
  },
  {
    key: 'dei', label: 'DEI Policy', icon: Users, badge: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
    title: 'Diversity, Equity & Inclusion Policy', tagline: 'Every voice matters. Every person belongs.',
    intro: 'Vertoc Agro Products Limited is dedicated to building a workplace and supply chain where diversity is celebrated, equity is practised, and inclusion is guaranteed. We recognise that diverse perspectives drive better decisions and stronger outcomes.',
    sections: [
      ['Our Commitment to Diversity', "We actively recruit from diverse talent pools across Nigeria and the global diaspora, without discrimination based on gender, age, ethnicity, religion, disability, sexual orientation, national origin, or socioeconomic background. We are committed to gender balance in our workforce and actively work to increase women's representation at all levels of the organisation, including leadership. By 2027, we target a minimum 40% female representation across all job grades."],
      ['Equity in Practice', 'Equity means ensuring fair access to opportunities, resources, and recognition. Vertoc Agro conducts annual equal-pay audits to identify and address any unjustified pay disparities. Promotion and performance review processes are standardised and transparent, with clear criteria accessible to all employees. We provide targeted support — including mentoring, training bursaries, and flexible working arrangements — to ensure that historically underrepresented groups can thrive and advance.'],
      ['Inclusive Culture', 'We foster a culture where all employees feel safe, respected, and empowered to contribute. Our Inclusion Charter commits every team leader to: conducting anonymous quarterly feedback surveys; acting on reported concerns within 10 working days; and completing mandatory unconscious-bias and inclusive-leadership training annually. We have zero tolerance for harassment, bullying, or discrimination in any form. Reports can be made confidentially via our independent Ethics Hotline.'],
      ['DEI in Our Supply Chain', 'Our DEI commitment extends beyond our own walls. We prioritise partnerships with women-owned, youth-led, and smallholder-farmer cooperatives. We embed DEI clauses in our supplier contracts and conduct periodic supplier assessments to verify compliance. We target 30% of our sourcing spend directed to women-led agricultural businesses by 2026.'],
    ],
  },
  {
    key: 'human-rights', label: 'Human Rights Policy', icon: HeartHandshake, badge: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
    title: 'Human Rights Policy', tagline: 'Upholding dignity, rights and fair treatment for all.',
    intro: 'Vertoc Agro Products Limited respects and supports the protection of internationally recognised human rights as set out in the UN Guiding Principles on Business and Human Rights (UNGPs), the ILO Core Conventions, and the Universal Declaration of Human Rights.',
    sections: [
      ['Our Human Rights Commitments', 'We are committed to: (1) Prohibiting all forms of forced, bonded, trafficked, or compulsory labour in our operations and supply chain. (2) Prohibiting child labour — we do not employ persons under 18 years in any capacity and require the same of all suppliers. (3) Ensuring all workers receive at least the applicable minimum wage and have their labour rights respected, including the right to freedom of association and collective bargaining. (4) Providing safe, healthy, and dignified working conditions at all our facilities.'],
      ['Supply Chain Due Diligence', 'We conduct Human Rights Due Diligence (HRDD) across our supply chain. This includes risk-based assessments of all new and existing suppliers against ILO conventions and Nigerian labour law. Where risks are identified, we work with suppliers through capacity building and corrective action plans rather than immediate termination, unless the violation is severe. Suppliers who refuse to engage with our HRDD process or who commit grievous violations will be delisted.'],
      ['Land Rights & Communities', 'We respect the land rights of communities in our sourcing regions and do not engage with suppliers who have obtained land through forcible displacement, coercion, or without Free, Prior and Informed Consent (FPIC) from affected communities. We actively engage with host communities through structured community liaison programmes and provide accessible grievance mechanisms for community members who believe their rights have been affected by our activities.'],
      ['Grievance Mechanism & Remedy', "Any worker, supplier, community member, or stakeholder who believes their human rights have been violated in connection with Vertoc Agro's operations may submit a complaint through our confidential Ethics Hotline or in writing to our Compliance Officer. All complaints are investigated promptly and impartially, with a target of acknowledging receipt within 5 working days and providing a resolution or update within 30 working days. Where violations are confirmed, we provide appropriate remedy."],
    ],
  },
  {
    key: 'ims', label: 'IMS Policy', icon: ShieldCheck, badge: 'bg-info/10 text-info border-info/20',
    title: 'Integrated Management System (IMS) Policy', tagline: 'Quality, safety and environment — managed as one.',
    intro: 'Vertoc Agro Products Limited operates an Integrated Management System (IMS) that combines Quality Management (ISO 9001), Food Safety Management (ISO 22000 / HACCP), and Environmental Management (ISO 14001) into a unified, auditable framework.',
    sections: [
      ['Quality Management', 'We are committed to consistently delivering agricultural commodities that meet or exceed customer specifications and applicable regulatory requirements. Our quality management processes cover procurement, processing, grading, storage, and export — with documented Standard Operating Procedures (SOPs) at every stage. We conduct regular internal audits and management reviews, and we set annual quality objectives. Customer feedback is systematically collected, analysed, and used to drive continuous improvement. Our target is to achieve and maintain a customer complaint rate of less than 1% of all transactions.'],
      ['Food Safety', 'All agricultural commodities handled by Vertoc Agro are subject to rigorous food safety controls based on Hazard Analysis and Critical Control Points (HACCP) principles. We identify, evaluate, and control food safety hazards including biological, chemical, and physical contaminants. Our facilities are maintained under strict hygiene and sanitation protocols. All relevant products carry required certifications including NAFDAC registration, SGS verification, and phytosanitary certification. We conduct pre-shipment inspections on all export consignments.'],
      ['Environmental Management', 'Our IMS includes environmental management commitments aligned with ISO 14001. We identify environmental aspects and impacts associated with our operations and set controls to minimise negative effects. This includes responsible waste management (packaging, food waste, and processing by-products), energy efficiency at our facilities, and ensuring our water use does not adversely impact local water bodies. Environmental performance is reviewed quarterly by our Operations Management Team.'],
      ['Continual Improvement & Compliance', 'We are committed to the continual improvement of our IMS through regular internal and external audits, corrective and preventive actions, and management reviews. We comply with all applicable Nigerian laws, export destination regulations, and international standards. All employees receive IMS training relevant to their role upon onboarding and annually thereafter. The IMS Policy is reviewed at least annually or following significant organisational changes by the Managing Director.'],
    ],
  },
  {
    key: 'eudr', label: 'EUDR Compliance', icon: Earth, badge: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
    title: 'EU Deforestation Regulation (EUDR) Compliance', tagline: 'Deforestation-free supply chains — by regulation and by conviction.',
    intro: 'Vertoc Agro Products Limited fully supports the objectives of the EU Deforestation Regulation (EU) 2023/1115 (EUDR), which requires that commodities and products placed on the EU market must not have contributed to deforestation or forest degradation after December 31, 2020.',
    sections: [
      ['Scope of Our EUDR Obligations', 'The EUDR applies to several commodities in our portfolio that are exported to EU markets, including palm oil, cocoa, soybeans, and their derived products. As an operator placing these commodities on the EU market (directly or via intermediaries), Vertoc Agro accepts full responsibility for conducting due diligence to ensure these products are: (1) produced on land not subject to deforestation after 31 December 2020; (2) produced in compliance with the relevant legislation of the country of production; and (3) covered by a due diligence statement submitted to the EU Information System.'],
      ['Geolocation & Traceability', "We have invested in geolocation systems and supply chain traceability tools to map the exact plots of land from which our commodities originate. All supplying farmers and cooperatives are required to provide GPS coordinates of their farms, which are verified against satellite deforestation data using third-party databases including Global Forest Watch and the EU's own reference system. We are progressively onboarding all our supplier base into our traceability platform, with a target of 100% coverage for EU-destined commodities by end of 2025."],
      ['Due Diligence System', "Our EUDR Due Diligence System (DDS) includes three mandatory steps for every EU-destined consignment: (1) Information Collection — gathering evidence of origin, land-use status, legal compliance, and geolocation data from all relevant suppliers. (2) Risk Assessment — evaluating the risk of non-compliance using country and product-level risk benchmarks, including the EU's country benchmarking classification and independent audits. (3) Risk Mitigation — where standard or high risk is identified, additional supplier audits, third-party verification, and corrective actions are implemented before shipment is approved."],
      ['Legal Compliance & Certification', 'We require all suppliers of EUDR-relevant commodities to confirm compliance with Nigerian land and forest law, including the Forestry Law, Land Use Act, and NESREA regulations. We work with certification schemes — including RSPO for palm oil and Rainforest Alliance for cocoa — to strengthen our compliance evidence base. EUDR-specific declarations and supporting documentation are archived for a minimum of five years and are available for inspection by EU customs authorities or appointed competent authorities upon request.'],
    ],
  },
]

const ICON_BTN = 'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-full h-10 w-10'

export default function Sustainability() {
  const [index, setIndex] = useState(0)
  const touchX = useRef(null)
  const policy = POLICIES[index]
  const go = useCallback(i => setIndex(Math.min(Math.max(i, 0), POLICIES.length - 1)), [])

  // Arrow keys and swipe, as the original page promised.
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, go])
  const onTouchStart = e => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = e => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null
    if (dx < -50) go(index + 1); else if (dx > 50) go(index - 1)
  }

  const prev = POLICIES[index - 1], next = POLICIES[index + 1]

  return (
    <main className="flex-grow">
      <section className="relative pt-32 pb-16 overflow-hidden bg-primary">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-accent blur-2xl" />
        </div>
        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow hover:bg-primary/80 mb-4 bg-accent/20 text-accent border-accent/30 uppercase tracking-widest text-xs font-semibold">Our Commitments</div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-primary-foreground mb-4 text-balance">Sustainability Policies</h1>
          <p className="text-primary-foreground/70 max-w-2xl mx-auto text-base md:text-lg leading-relaxed text-pretty">At Vertoc Agro, sustainability is not a checkbox — it is embedded in every decision we make. Explore our five core policy frameworks below.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-2 md:gap-3" role="tablist" aria-label="Policy frameworks">
            {POLICIES.map((p, i) => (
              <button key={p.key} type="button" role="tab" aria-selected={i === index} onClick={() => go(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                  i === index ? 'bg-accent text-accent-foreground border-accent shadow-lg scale-105' : 'bg-white/10 text-primary-foreground/80 border-white/20 hover:bg-white/20'}`}>
                <p.icon className="w-4 h-4 shrink-0" />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-12 md:py-20 min-h-[60vh]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={policy.key} className="container mx-auto px-4 md:px-6 animate-fade-in" role="tabpanel">
          <div className="flex items-start justify-between gap-4 mb-10">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${policy.badge}`}>
                  <policy.icon className="w-3.5 h-3.5" />{policy.label}
                </span>
                <span className="text-muted-foreground text-xs">{index + 1} / {POLICIES.length}</span>
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground text-balance mb-2">{policy.title}</h2>
              <p className="text-muted-foreground italic text-base">{policy.tagline}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2 mt-1">
              <button type="button" className={ICON_BTN} disabled={!prev} aria-label="Previous policy" onClick={() => go(index - 1)}><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" className={ICON_BTN} disabled={!next} aria-label="Next policy" onClick={() => go(index + 1)}><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="bg-secondary/60 border border-border rounded-2xl p-5 md:p-7 mb-8">
            <p className="text-foreground leading-relaxed text-base">{policy.intro}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 md:gap-6">
            {policy.sections.map(([heading, body]) => (
              <div key={heading} className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-6 rounded-full bg-accent shrink-0" />
                  <h3 className="font-semibold text-foreground text-base">{heading}</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-4 mt-10">
            <div className="flex items-center gap-2">
              {POLICIES.map((p, i) => (
                <button key={p.key} type="button" aria-label={`Go to ${p.label}`} onClick={() => go(i)}
                  className={`rounded-full transition-all duration-200 h-2.5 ${i === index ? 'w-6 bg-accent' : 'w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'}`} />
              ))}
            </div>
            <p className="text-muted-foreground/60 text-xs">Swipe left/right or use arrow keys to navigate</p>
          </div>
          <div className="flex items-center justify-between mt-8 gap-4">
            <div className="flex-1">
              {prev && (
                <button type="button" onClick={() => go(index - 1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /><span>{prev.label}</span>
                </button>
              )}
            </div>
            <div className="flex-1 flex justify-end">
              {next && (
                <button type="button" onClick={() => go(index + 1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                  <span>{next.label}</span><ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary/50 border-t border-border">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-2xl">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-4">Partner with a Responsible Exporter</h2>
          <p className="text-muted-foreground mb-7 leading-relaxed">Our sustainability commitments are backed by documentation and third-party verification. Request our full policy documentation or speak to our compliance team.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-10 bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 font-semibold" to="/contact">Contact Us <ArrowRight className="ml-2 w-4 h-4" /></Link>
            <Link className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 rounded-full px-8 font-semibold" to="/quote">Request a Quote</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
