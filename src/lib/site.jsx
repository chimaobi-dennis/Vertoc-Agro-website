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
