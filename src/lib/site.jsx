/*
 * Site identity and contact details, edited under Admin → Settings → Site.
 *
 * The defaults below equal the values that used to be hard-coded, so the
 * first paint is correct before /api/site answers and nothing changes on
 * a deployment that has not run migration 004 yet.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { fetchJson } from './api'
import { CONTACT } from './nav'

export const SITE_DEFAULTS = {
  name: 'Vertoc Agro', legal_name: 'Vertoc Agro Products Limited', tagline: 'Premium Agricultural Commodities',
  description: 'Cultivation of crops, sourcing, processing, storage, logistics, and export of premium agricultural commodities across Nigeria and beyond.',
  logo: '/assets/img/logo.png', favicon: '/assets/img/favicon.png',
  email: CONTACT.email, phone: CONTACT.phone, whatsapp: '2349135009001',
  address: 'Akala Express Way, Ibadan, Oyo State, Nigeria', hours: CONTACT.hours, hours_short: CONTACT.hoursShort,
  facebook: 'https://facebook.com/VertocAgro', instagram: 'https://instagram.com/vertocagro', linkedin: 'https://linkedin.com/company/vertocagro',
  twitter: 'https://x.com/vertocagro', threads: 'https://www.threads.com/@vertocagro',
  // Homepage stat tiles; edited under Settings → Site. Same values the page used to hard-code.
  stats: [
    { icon: 'CalendarCheck', value: 8, suffix: '+', label: 'Years of Experience' },
    { icon: 'Globe', value: 12, suffix: '+', label: 'Export Countries' },
    { icon: 'Package', value: 30, suffix: '+', label: 'Commodities' },
    { icon: 'Users', value: 500, suffix: '+', label: 'Partner Farmers' },
  ],
  // Homepage hero text and trust chips.
  hero: {
    badge: 'NEPC Registered Exporter',
    title_1: 'Premium Nigerian', title_accent: 'Agro Commodities', title_2: 'for the World',
    subtitle: 'Cultivation of crops, sourcing, processing, storage, logistics, and export of premium agricultural commodities. Certified quality, reliable logistics, FOB Lagos.',
    chips: [
      { icon: 'Ship', title: 'FOB Lagos', caption: 'Global Shipping' },
      { icon: 'FlaskConical', title: 'Lab Tested', caption: 'Quality Assured' },
    ],
  },
  // Why choose us: the homepage shows the first six, /industries/why-choose-us all of them.
  why: [
    { icon: 'ShieldCheck', title: 'Certified Quality', description: 'All products meet international quality standards with full traceability and lab certification.' },
    { icon: 'Truck', title: 'Reliable Logistics', description: 'End-to-end shipping coordination from farm gate to FOB Lagos with real-time tracking.' },
    { icon: 'Factory', title: 'Modern Processing', description: 'State-of-the-art cleaning, sorting, drying, and packaging facilities ensuring premium grade.' },
    { icon: 'Handshake', title: 'Farmer Partnerships', description: 'Direct relationships with 500+ smallholder farmers across Nigeria for consistent supply.' },
    { icon: 'Award', title: 'NEPC Registered', description: 'Fully registered with the Nigerian Export Promotion Council for seamless export operations.' },
    { icon: 'Leaf', title: 'Sustainable Sourcing', description: 'Ethical and environmentally conscious practices that support local farming communities.' },
    { icon: 'BadgeCheck', title: 'Premium Quality Products', description: 'Rigorous quality control ensures every commodity meets international standards.' },
    { icon: 'Link2', title: 'Reliable Supply Chain', description: 'End-to-end logistics from farm to port with full traceability and transparency.' },
    { icon: 'BadgeDollarSign', title: 'Competitive Pricing', description: 'Direct farmer relationships and efficient operations translate to better prices.' },
    { icon: 'Clock', title: 'Timely Delivery', description: 'Commitment to on-time shipments with proactive communication at every stage.' },
    { icon: 'UserCheck', title: 'Experienced Team', description: 'Seasoned professionals with deep knowledge of Nigerian agriculture and global trade.' },
    { icon: 'Globe', title: 'Export Ready', description: 'Full export compliance, certifications, and documentation for international markets.' },
    { icon: 'Sprout', title: 'Sustainable Practices', description: 'Eco-friendly sourcing and processing methods that support long-term farm productivity.' },
    { icon: 'Handshake', title: 'Strong Relationships', description: 'Trusted partnerships with farmers, cooperatives, and buyers built over years.' },
  ],
  // Sustainability policies; edited in place on the site by signed-in staff.
  sustainability: [
      {
        key: 'esg', label: 'ESG Policy', icon: 'Leaf', color: 'accent',
        title: 'Environmental, Social & Governance Policy', tagline: 'Responsible growth that protects people and planet.',
        intro: 'Vertoc Agro Products Limited is committed to integrating Environmental, Social, and Governance (ESG) principles at the heart of our business strategy. We believe that sustainable commerce is not just ethical — it is essential for long-term value creation.',
        sections: [
          { heading: 'Environmental Commitment', body: 'We minimise our environmental footprint by promoting responsible land-use practices, reducing post-harvest losses through improved processing and storage, and optimising logistics to lower carbon emissions. We work exclusively with farmers and suppliers who adopt sustainable agronomic practices, including appropriate use of inputs, soil conservation, and water management. We actively monitor and seek to reduce greenhouse gas emissions across our supply chain, with a target of full Scope 1 and 2 mapping by 2026.' },
          { heading: 'Social Responsibility', body: 'Our business creates direct and indirect livelihoods for thousands of smallholder farmers, processors, and logistics providers across Nigeria. We pay fair prices, provide technical knowledge transfer, and ensure timely payments to all our suppliers. We invest in community development programmes in our source communities, including access to clean water, road infrastructure support, and educational sponsorships. We maintain a zero-tolerance policy for child labour, forced labour, and any form of exploitation throughout our value chain.' },
          { heading: 'Governance & Ethics', body: "Vertoc Agro operates with the highest standards of corporate governance. We maintain transparent financial reporting, uphold Anti-Bribery and Anti-Corruption (ABAC) standards aligned with the UK Bribery Act and Nigeria's EFCC/ICPC frameworks, and enforce a strict conflict-of-interest policy for all directors and employees. Our Board of Directors reviews ESG performance annually. We publish our ESG disclosures to relevant stakeholders and continuously improve our practices based on internationally recognised frameworks including GRI and UN SDGs." },
          { heading: 'Targets & Accountability', body: 'We set measurable ESG targets reviewed annually. Our key commitments include: achieving a fully documented and auditable supply chain by 2027; reducing food and commodity waste by 30% through improved storage and grading; ensuring 100% of our direct-sourcing contracts include a sustainability rider; and maintaining ISO 14001-aligned environmental management practices at our facilities.' },
        ],
      },
      {
        key: 'dei', label: 'DEI Policy', icon: 'Users', color: 'chart-2',
        title: 'Diversity, Equity & Inclusion Policy', tagline: 'Every voice matters. Every person belongs.',
        intro: 'Vertoc Agro Products Limited is dedicated to building a workplace and supply chain where diversity is celebrated, equity is practised, and inclusion is guaranteed. We recognise that diverse perspectives drive better decisions and stronger outcomes.',
        sections: [
          { heading: 'Our Commitment to Diversity', body: "We actively recruit from diverse talent pools across Nigeria and the global diaspora, without discrimination based on gender, age, ethnicity, religion, disability, sexual orientation, national origin, or socioeconomic background. We are committed to gender balance in our workforce and actively work to increase women's representation at all levels of the organisation, including leadership. By 2027, we target a minimum 40% female representation across all job grades." },
          { heading: 'Equity in Practice', body: 'Equity means ensuring fair access to opportunities, resources, and recognition. Vertoc Agro conducts annual equal-pay audits to identify and address any unjustified pay disparities. Promotion and performance review processes are standardised and transparent, with clear criteria accessible to all employees. We provide targeted support — including mentoring, training bursaries, and flexible working arrangements — to ensure that historically underrepresented groups can thrive and advance.' },
          { heading: 'Inclusive Culture', body: 'We foster a culture where all employees feel safe, respected, and empowered to contribute. Our Inclusion Charter commits every team leader to: conducting anonymous quarterly feedback surveys; acting on reported concerns within 10 working days; and completing mandatory unconscious-bias and inclusive-leadership training annually. We have zero tolerance for harassment, bullying, or discrimination in any form. Reports can be made confidentially via our independent Ethics Hotline.' },
          { heading: 'DEI in Our Supply Chain', body: 'Our DEI commitment extends beyond our own walls. We prioritise partnerships with women-owned, youth-led, and smallholder-farmer cooperatives. We embed DEI clauses in our supplier contracts and conduct periodic supplier assessments to verify compliance. We target 30% of our sourcing spend directed to women-led agricultural businesses by 2026.' },
        ],
      },
      {
        key: 'human-rights', label: 'Human Rights Policy', icon: 'HeartHandshake', color: 'chart-5',
        title: 'Human Rights Policy', tagline: 'Upholding dignity, rights and fair treatment for all.',
        intro: 'Vertoc Agro Products Limited respects and supports the protection of internationally recognised human rights as set out in the UN Guiding Principles on Business and Human Rights (UNGPs), the ILO Core Conventions, and the Universal Declaration of Human Rights.',
        sections: [
          { heading: 'Our Human Rights Commitments', body: 'We are committed to: (1) Prohibiting all forms of forced, bonded, trafficked, or compulsory labour in our operations and supply chain. (2) Prohibiting child labour — we do not employ persons under 18 years in any capacity and require the same of all suppliers. (3) Ensuring all workers receive at least the applicable minimum wage and have their labour rights respected, including the right to freedom of association and collective bargaining. (4) Providing safe, healthy, and dignified working conditions at all our facilities.' },
          { heading: 'Supply Chain Due Diligence', body: 'We conduct Human Rights Due Diligence (HRDD) across our supply chain. This includes risk-based assessments of all new and existing suppliers against ILO conventions and Nigerian labour law. Where risks are identified, we work with suppliers through capacity building and corrective action plans rather than immediate termination, unless the violation is severe. Suppliers who refuse to engage with our HRDD process or who commit grievous violations will be delisted.' },
          { heading: 'Land Rights & Communities', body: 'We respect the land rights of communities in our sourcing regions and do not engage with suppliers who have obtained land through forcible displacement, coercion, or without Free, Prior and Informed Consent (FPIC) from affected communities. We actively engage with host communities through structured community liaison programmes and provide accessible grievance mechanisms for community members who believe their rights have been affected by our activities.' },
          { heading: 'Grievance Mechanism & Remedy', body: "Any worker, supplier, community member, or stakeholder who believes their human rights have been violated in connection with Vertoc Agro's operations may submit a complaint through our confidential Ethics Hotline or in writing to our Compliance Officer. All complaints are investigated promptly and impartially, with a target of acknowledging receipt within 5 working days and providing a resolution or update within 30 working days. Where violations are confirmed, we provide appropriate remedy." },
        ],
      },
      {
        key: 'ims', label: 'IMS Policy', icon: 'ShieldCheck', color: 'info',
        title: 'Integrated Management System (IMS) Policy', tagline: 'Quality, safety and environment — managed as one.',
        intro: 'Vertoc Agro Products Limited operates an Integrated Management System (IMS) that combines Quality Management (ISO 9001), Food Safety Management (ISO 22000 / HACCP), and Environmental Management (ISO 14001) into a unified, auditable framework.',
        sections: [
          { heading: 'Quality Management', body: 'We are committed to consistently delivering agricultural commodities that meet or exceed customer specifications and applicable regulatory requirements. Our quality management processes cover procurement, processing, grading, storage, and export — with documented Standard Operating Procedures (SOPs) at every stage. We conduct regular internal audits and management reviews, and we set annual quality objectives. Customer feedback is systematically collected, analysed, and used to drive continuous improvement. Our target is to achieve and maintain a customer complaint rate of less than 1% of all transactions.' },
          { heading: 'Food Safety', body: 'All agricultural commodities handled by Vertoc Agro are subject to rigorous food safety controls based on Hazard Analysis and Critical Control Points (HACCP) principles. We identify, evaluate, and control food safety hazards including biological, chemical, and physical contaminants. Our facilities are maintained under strict hygiene and sanitation protocols. All relevant products carry required certifications including NAFDAC registration, SGS verification, and phytosanitary certification. We conduct pre-shipment inspections on all export consignments.' },
          { heading: 'Environmental Management', body: 'Our IMS includes environmental management commitments aligned with ISO 14001. We identify environmental aspects and impacts associated with our operations and set controls to minimise negative effects. This includes responsible waste management (packaging, food waste, and processing by-products), energy efficiency at our facilities, and ensuring our water use does not adversely impact local water bodies. Environmental performance is reviewed quarterly by our Operations Management Team.' },
          { heading: 'Continual Improvement & Compliance', body: 'We are committed to the continual improvement of our IMS through regular internal and external audits, corrective and preventive actions, and management reviews. We comply with all applicable Nigerian laws, export destination regulations, and international standards. All employees receive IMS training relevant to their role upon onboarding and annually thereafter. The IMS Policy is reviewed at least annually or following significant organisational changes by the Managing Director.' },
        ],
      },
      {
        key: 'eudr', label: 'EUDR Compliance', icon: 'Earth', color: 'chart-4',
        title: 'EU Deforestation Regulation (EUDR) Compliance', tagline: 'Deforestation-free supply chains — by regulation and by conviction.',
        intro: 'Vertoc Agro Products Limited fully supports the objectives of the EU Deforestation Regulation (EU) 2023/1115 (EUDR), which requires that commodities and products placed on the EU market must not have contributed to deforestation or forest degradation after December 31, 2020.',
        sections: [
          { heading: 'Scope of Our EUDR Obligations', body: 'The EUDR applies to several commodities in our portfolio that are exported to EU markets, including palm oil, cocoa, soybeans, and their derived products. As an operator placing these commodities on the EU market (directly or via intermediaries), Vertoc Agro accepts full responsibility for conducting due diligence to ensure these products are: (1) produced on land not subject to deforestation after 31 December 2020; (2) produced in compliance with the relevant legislation of the country of production; and (3) covered by a due diligence statement submitted to the EU Information System.' },
          { heading: 'Geolocation & Traceability', body: "We have invested in geolocation systems and supply chain traceability tools to map the exact plots of land from which our commodities originate. All supplying farmers and cooperatives are required to provide GPS coordinates of their farms, which are verified against satellite deforestation data using third-party databases including Global Forest Watch and the EU's own reference system. We are progressively onboarding all our supplier base into our traceability platform, with a target of 100% coverage for EU-destined commodities by end of 2025." },
          { heading: 'Due Diligence System', body: "Our EUDR Due Diligence System (DDS) includes three mandatory steps for every EU-destined consignment: (1) Information Collection — gathering evidence of origin, land-use status, legal compliance, and geolocation data from all relevant suppliers. (2) Risk Assessment — evaluating the risk of non-compliance using country and product-level risk benchmarks, including the EU's country benchmarking classification and independent audits. (3) Risk Mitigation — where standard or high risk is identified, additional supplier audits, third-party verification, and corrective actions are implemented before shipment is approved." },
          { heading: 'Legal Compliance & Certification', body: 'We require all suppliers of EUDR-relevant commodities to confirm compliance with Nigerian land and forest law, including the Forestry Law, Land Use Act, and NESREA regulations. We work with certification schemes — including RSPO for palm oil and Rainforest Alliance for cocoa — to strengthen our compliance evidence base. EUDR-specific declarations and supporting documentation are archived for a minimum of five years and are available for inspection by EU customs authorities or appointed competent authorities upon request.' },
        ],
      },
    ],
  // Gallery, FAQ and Services pages; edited in place on the site by signed-in staff.
  gallery: [
    { src: '/assets/img/file_00000000a91c71f4907a39cb638741b8.png', alt: 'Vertoc Agro factory and processing facility', title: 'Factory', caption: 'Vertoc Agro factory and processing facility' },
    { src: '/assets/img/h11102d4d7702475faebf710f672b997dr.jpg', alt: 'Industrial processing equipment and storage tanks', title: 'Processing', caption: 'Industrial processing equipment and storage tanks' },
    { src: '/assets/img/img-20260701-wa0028.jpg', alt: 'Warehouse with stacked commodity bags ready for shipment', title: 'Warehouse', caption: 'Warehouse with stacked commodity bags ready for shipment' },
    { src: '/assets/img/img-20260702-wa0046.jpg', alt: 'Burlap sacks of agricultural commodities on pallets', title: 'Storage', caption: 'Burlap sacks of agricultural commodities on pallets' },
    { src: '/assets/img/ce0b7f_8e81ef90b3ec4f219e3d24d81c544cd5-mv2.jpg', alt: 'Traditional palm oil fruit processing in large cooking pots', title: 'Palm Oil', caption: 'Traditional palm oil fruit processing in large cooking pots' },
    { src: '/assets/img/img-20260702-wa0049.jpg', alt: 'Cocoa beans being weighed on a digital scale', title: 'Cocoa', caption: 'Cocoa beans being weighed on a digital scale' },
    { src: '/assets/img/vertocimage11.jpg', alt: 'Soybeans packed in large bulk sacks', title: 'Soybeans', caption: 'Soybeans packed in large bulk sacks' },
    { src: '/assets/img/vertocimage13.jpeg', alt: 'Maize harvest bagged at the farm', title: 'Maize', caption: 'Maize harvest bagged at the farm' },
    { src: '/assets/img/vertocimage14.jpeg', alt: 'Bulk sacks of dried maize kernels', title: 'Maize', caption: 'Bulk sacks of dried maize kernels' },
    { src: '/assets/img/vertocimage15.jpeg', alt: 'Stacked commodity bags ready for distribution', title: 'Storage', caption: 'Stacked commodity bags ready for distribution' },
  ],
  faq: [
    { q: 'What agricultural commodities does Vertoc Agro trade in?', a: 'We trade in a wide range of premium Nigerian agricultural commodities including palm oil, maize, soybeans, cocoa, plantain, cassava, sesame seeds, ginger, rice, sorghum, millet, and groundnuts. If you need a specific commodity not listed, please contact us and we will source it for you.' },
    { q: 'Do you export commodities outside Nigeria?', a: 'Yes, export services are a core part of our business. We handle end-to-end export management including documentation, compliance, customs clearance, and international shipping coordination. We currently export to over 25 countries across Africa, Europe, Asia, and the Americas.' },
    { q: 'What is your minimum order quantity?', a: 'Our minimum order quantities vary by commodity. For most products, we can accommodate orders starting from 5 metric tonnes. For export shipments, typical minimums range from 1 to 5 full container loads depending on the commodity. Contact us for specific details.' },
    { q: 'How do you ensure product quality?', a: 'Quality assurance is embedded in every stage of our process. We conduct rigorous field inspections, laboratory testing, and grading before acceptance. Our processing and warehousing facilities maintain strict hygiene and climate control standards. All shipments come with certificates of analysis and quality assurance documentation.' },
    { q: 'What payment terms do you offer?', a: 'We offer flexible payment terms depending on the relationship and order size. Standard terms include advance payment, letter of credit (LC), and payment against documents. For established partners, we may offer open account terms with approved credit limits.' },
    { q: 'How long does delivery take after placing an order?', a: 'Delivery timelines depend on the commodity, order size, and destination. Domestic deliveries within Nigeria typically take 3-10 business days. Export shipments require additional time for documentation and logistics, generally 2-6 weeks depending on the destination port.' },
    { q: 'Do you work with smallholder farmers?', a: 'Absolutely. Partnership with smallholder farmers is central to our mission. We work directly with farming cooperatives and individual farmers, providing training, fair pricing, and reliable offtake agreements that help improve their livelihoods and productivity.' },
    { q: 'Can I visit your processing or warehousing facilities?', a: 'Yes, we welcome facility visits by qualified buyers and partners. Please contact us to schedule a visit. Our team will arrange a guided tour of our processing plants, warehouses, or farm sourcing locations depending on your interests.' },
    { q: 'Do you provide commodity price forecasts?', a: 'We regularly publish market analysis and price outlooks on our blog. For contracted partners, we provide personalized market intelligence and pricing updates relevant to their specific commodities and trading windows.' },
    { q: 'How can I become a registered buyer or partner?', a: 'Simply fill out the contact form on our website or send us an email at sales@vertocagro.com with your company details and commodity requirements. Our business development team will reach out to discuss your needs and onboarding process.' },
  ],
  services: [
    { icon: 'TrendingUp', title: 'Agro Commodity Trading', description: 'We buy and sell high-quality agricultural commodities across local and international markets, ensuring competitive prices and reliable supply.' },
    { icon: 'PackageSearch', title: 'Commodity Sourcing & Aggregation', description: 'Direct sourcing from smallholder and commercial farmers, aggregating produce to meet bulk demand with strict quality standards.' },
    { icon: 'Factory', title: 'Processing', description: 'State-of-the-art processing facilities to clean, grade, and prepare commodities for market-ready distribution and export.' },
    { icon: 'Warehouse', title: 'Warehousing', description: 'Secure, climate-controlled storage solutions that preserve commodity quality from harvest to delivery.' },
    { icon: 'Ship', title: 'Export Services', description: 'End-to-end export management including documentation, compliance, customs clearance, and international shipping coordination.' },
    { icon: 'Truck', title: 'Supply Chain & Logistics', description: 'Efficient transportation and logistics network ensuring timely delivery from farm gate to final destination.' },
    { icon: 'Boxes', title: 'Bulk Supply', description: 'Large-volume supply agreements for manufacturers, exporters, and industrial buyers with consistent quality assurance.' },
    { icon: 'ShoppingCart', title: 'Procurement Services', description: 'Strategic procurement consulting to help clients source the right commodities at the best value for their operations.' },
  ],
  // About page + homepage mission/vision; edited under Settings → Company.
  about: {
    headline: 'Connecting Farmers with Global Markets',
    summary: 'Vertoc Agro Products Limited is a leading Nigerian agribusiness committed to the cultivation of crops, sourcing, processing, storage, logistics, and export of premium agricultural commodities across Nigeria and beyond.',
    slogan: 'Growing the Future, One Harvest at a Time.',
    mission: "To provide quality agricultural products while creating sustainable value for farmers, businesses, and global markets. We bridge the gap between farm and table with efficiency and excellence.",
    vision: "To become one of Africa's most trusted agro commodity companies, recognized for reliability, quality, and innovation in agricultural trade and export across international markets.",
    mission_short: 'Provide quality products while creating sustainable value for farmers and global markets.',
    vision_short: "Become Africa's most trusted agro commodity company recognized for reliability.",
    registrations: [
      { icon: 'Award', label: 'CAC Registered', value: 'RC No: 8464264' },
      { icon: 'Shield', label: 'NEPC Licensed', value: 'No: 0044255' },
    ],
    values: [
      { icon: 'Award', title: 'Excellence', description: 'We strive for the highest standards in every aspect of our operations.' },
      { icon: 'Shield', title: 'Integrity', description: 'Honest and transparent dealings with all our stakeholders.' },
      { icon: 'Users', title: 'Partnership', description: 'Building lasting relationships with farmers, buyers, and communities.' },
      { icon: 'HeartHandshake', title: 'Sustainability', description: 'Environmentally responsible practices for future generations.' },
    ],
    industries: [
      { icon: 'UtensilsCrossed', name: 'Food Manufacturers', description: 'Supplying raw materials for food processing and packaged goods production.' },
      { icon: 'Plane', name: 'Exporters', description: 'Partnering with export houses to fulfill international commodity contracts.' },
      { icon: 'ShoppingBag', name: 'FMCG Companies', description: 'Reliable bulk supply for fast-moving consumer goods manufacturers.' },
      { icon: 'Beef', name: 'Animal Feed Producers', description: 'Maize, soybeans, and cassava for livestock and poultry feed mills.' },
      { icon: 'Store', name: 'Wholesalers', description: 'Large-volume commodity supply for regional and national distributors.' },
      { icon: 'Building2', name: 'Retail Chains', description: 'Consistent quality and supply for supermarket and retail procurement.' },
      { icon: 'Factory', name: 'Industrial Buyers', description: 'Raw materials for biofuel, starch, oil extraction, and pharmaceutical industries.' },
    ],
  },
  // Export-market flag tiles and client reviews; edited under Settings → Site.
  markets: {
    items: [{ name: 'United Kingdom', code: 'gb' }, { name: 'Netherlands', code: 'nl' }, { name: 'Germany', code: 'de' }, { name: 'Turkey', code: 'tr' }, { name: 'UAE', code: 'ae' }, { name: 'India', code: 'in' }, { name: 'China', code: 'cn' }, { name: 'USA', code: 'us' }],
    caption_left: 'FOB Lagos', caption_right: '12+ Countries Served',
  },
  reviews: [
    { quote: 'Vertoc Agro has been our most reliable maize supplier for over two years. Their quality consistency is unmatched.', name: 'Sanjay', role: 'Procurement Manager of an Indian Based Food Processing company', rating: 5 },
    { quote: 'Working with Vertoc has been seamless. Their export documentation is always in order and shipments arrive on time.', name: 'Mitchell', role: 'Director of an International Grain company in the UK', rating: 5 },
    { quote: 'We switched to Vertoc for our palm oil supply and have never looked back. Competitive pricing and premium quality.', name: 'Johnson', role: 'CEO of a Food Processing Company in Nigeria', rating: 5 },
  ],
}

const Ctx = createContext(SITE_DEFAULTS)

export function SiteProvider({ children }) {
  const [site, setSite] = useState(SITE_DEFAULTS)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    fetchJson('/site').then(d => alive && d && typeof d === 'object' && setSite(s => ({ ...SITE_DEFAULTS, ...d, reload: s.reload }))).catch(() => {})
    return () => { alive = false }
  }, [tick])
  // reload(): re-fetch after an in-place edit so the page shows the saved content.
  useEffect(() => { setSite(s => ({ ...s, reload: () => setTick(t => t + 1) })) }, [])
  useEffect(() => {
    for (const rel of ['icon', 'apple-touch-icon']) {
      const link = document.querySelector(`link[rel="${rel}"]`)
      if (link && site.favicon && link.getAttribute('href') !== site.favicon) link.setAttribute('href', site.favicon)
    }
    if (site.name && site.tagline) document.title = `${site.name} - ${site.tagline}`
  }, [site])
  return <Ctx.Provider value={site}>{children}</Ctx.Provider>
}

export const useSite = () => useContext(Ctx)
export const phoneHref = p => `tel:${String(p || '').replace(/[^\d+]/g, '')}`
export const waHref = n => `https://wa.me/${String(n || '').replace(/\D/g, '')}`
