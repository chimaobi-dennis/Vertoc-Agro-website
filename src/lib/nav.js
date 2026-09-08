// Single source of truth for the primary nav, shared by the header and the
// mobile menu so the two can never drift apart.
export const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Services', to: '/services' },
  { label: 'Products', to: '/products' },
  { label: 'Sustainability', to: '/sustainability' },
  { label: 'Blog', to: '/blog' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Contact', to: '/contact' },
]

export const CONTACT = {
  email: 'sales@vertocagro.com',
  phone: '+234 913 500 9001',
  phoneHref: 'tel:+2349135009001',
  whatsapp: 'https://wa.me/2349135009001',
  hours: 'Mon - Fri: 8:00 AM - 5:00 PM (WAT)',
  hoursShort: 'Mon-Fri 8AM-5PM',
}
