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
