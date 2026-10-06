import { Link } from 'react-router-dom'
import { AtSign, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Twitter } from 'lucide-react'
import { useSite } from '../lib/site'

const SOCIAL = [['facebook', Facebook, 'Facebook'], ['twitter', Twitter, 'X'], ['instagram', Instagram, 'Instagram'], ['linkedin', Linkedin, 'LinkedIn'], ['threads', AtSign, 'Threads']]

export default function Footer() {
  const site = useSite()
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
      <div>
      <div className="mb-5">
      <img src={site.logo} alt={site.name} className="h-10 object-contain brightness-0 invert" />
      </div>
      <p className="text-primary-foreground/70 text-sm leading-relaxed mb-5">{site.description}</p>
      <p className="text-primary-foreground/50 text-xs leading-relaxed mb-4">Registered with the Corporate Affairs Commission of Nigeria — RC No: 8464264. Licensed by the Nigerian Export Promotion Council (NEPC) — License No: 0044255.</p>
      <div className="flex items-center gap-3">
      {SOCIAL.filter(([k]) => site[k]).map(([k, Icon, label]) => (
      <a key={k} href={site[k]} target="_blank" rel="noopener noreferrer" aria-label={label} className="w-9 h-9 bg-primary-foreground/10 rounded-2xl flex items-center justify-center hover:bg-accent hover:text-foreground transition-all duration-200">
      <Icon className="w-4 h-4" />
      </a>
      ))}
      </div>
      </div>
      <div>
      <h4 className="text-sm font-semibold uppercase tracking-wider mb-5 text-accent">Quick Links</h4>
      <ul className="space-y-2.5">
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/">Home</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/about">About Us</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/services">Services</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/industries">Industries</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products">Products</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/process">Our Process</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/industries/why-choose-us">Why Choose Us</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/sustainability">Sustainability</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/testimonials">Testimonials</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/blog">Blog</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/faq">FAQ</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/gallery">Gallery</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/contact">Contact</Link>
      </li>
      </ul>
      </div>
      <div>
      <h4 className="text-sm font-semibold uppercase tracking-wider mb-5 text-accent">Our Products</h4>
      <ul className="space-y-2.5 mb-8">
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/palm-oil">Palm Oil</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/maize">Maize</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/soybeans">Soybeans</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/cocoa">Cocoa</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/plantains">Plantains</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/cashew-nuts">Cashew Nuts</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/cassava">Cassava</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/sesame-seeds">Sesame Seeds</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/soya-lecithin">Soya Lecithin</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/corn-powder">Corn Powder</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/vegetable-oil">Vegetable Oil</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/ginger">Ginger</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/products/hibiscus">Hibiscus</Link>
      </li>
      </ul>
      <h4 className="text-sm font-semibold uppercase tracking-wider mb-5 text-accent">Our Services</h4>
      <ul className="space-y-2.5">
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/services">Agro Commodity Trading</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/services">Sourcing &amp; Aggregation</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/services">Processing</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/services">Warehousing</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/services">Export Services</Link>
      </li>
      <li>
      <Link className="text-sm text-primary-foreground/70 hover:text-accent transition-colors" to="/services">Supply Chain &amp; Logistics</Link>
      </li>
      </ul>
      </div>
      <div>
      <h4 className="text-sm font-semibold uppercase tracking-wider mb-5 text-accent">Contact Us</h4>
      <ul className="space-y-3.5">
      <li className="flex items-start gap-3">
      <Phone className="w-4 h-4 mt-0.5 text-accent shrink-0" />
      <span className="text-sm text-primary-foreground/70">{site.phone}</span>
      </li>
      <li className="flex items-start gap-3">
      <Mail className="w-4 h-4 mt-0.5 text-accent shrink-0" />
      <span className="text-sm text-primary-foreground/70">{site.email}</span>
      </li>
      <li className="flex items-start gap-3">
      <MapPin className="w-4 h-4 mt-0.5 text-accent shrink-0" />
      <span className="text-sm text-primary-foreground/70">{site.name}, {site.address}</span>
      </li>
      </ul>
      </div>
      </div>
      </div>
      <div className="border-t border-primary-foreground/10">
      <div className="container mx-auto px-4 md:px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
      <p className="text-xs text-primary-foreground/50">© {new Date().getFullYear()} {site.legal_name}. All rights reserved.</p>
      <div className="flex items-center gap-5 flex-wrap justify-center">
      <Link className="text-xs text-primary-foreground/50 hover:text-accent transition-colors" to="/privacy-policy">Privacy Policy</Link>
      <Link className="text-xs text-primary-foreground/50 hover:text-accent transition-colors" to="/terms-of-service">Terms of Service</Link>
      <Link className="text-xs text-primary-foreground/50 hover:text-accent transition-colors" to="/disclaimer">Disclaimer</Link>
      </div>
      </div>
      </div>
    </footer>
  )
}
