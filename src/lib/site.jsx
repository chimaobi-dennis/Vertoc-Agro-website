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
  useEffect(() => {
    let alive = true
    fetchJson('/site').then(d => alive && d && typeof d === 'object' && setSite({ ...SITE_DEFAULTS, ...d })).catch(() => {})
    return () => { alive = false }
  }, [])
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
