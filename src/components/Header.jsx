import { useEffect, useState } from 'react'
import { useSite } from '../lib/site'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Moon, Sun } from 'lucide-react'
import { NAV_LINKS } from '../lib/nav'
import { useTheme } from '../lib/useTheme'
import MobileMenu from './MobileMenu'

export default function Header() {
  const site = useSite()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { isDark, toggle } = useTheme()
  const { pathname } = useLocation()

  // Only the homepage has a dark hero for the bar to float over. Every other
  // route starts on a light background, so the bar is solid from the top —
  // otherwise the white logo and nav links render invisible.
  const overHero = pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const solid = scrolled || !overHero

  return (
    <>
      <header
        className={`fixed top-10 left-0 right-0 z-50 transition-all duration-300 ${
          solid ? 'bg-background/95 backdrop-blur-xl shadow-sm py-3' : 'bg-transparent py-4'
        }`}
      >
        <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <img
              src={site.logo}
              alt={site.name}
              className={`object-contain transition-all duration-300 h-9 ${
                solid ? '' : 'brightness-0 invert'
              }`}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                className={`text-sm font-medium transition-colors hover:text-accent ${
                  solid ? 'text-foreground/70' : 'text-white/90'
                }`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle theme"
              className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors ${
                solid ? 'text-foreground hover:bg-muted' : 'text-white hover:bg-white/10'
              }`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              to="/quote"
              className="hidden md:inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-accent px-6 h-10 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
            >
              Get a Quote
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className={`inline-flex items-center justify-center h-9 w-9 md:hidden rounded-full transition-colors ${
                solid ? 'text-foreground hover:bg-muted' : 'text-white hover:bg-white/10'
              }`}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
