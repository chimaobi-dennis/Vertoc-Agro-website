import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { NAV_LINKS } from '../lib/nav'

export default function MobileMenu({ open, onClose }) {
  const { pathname } = useLocation()

  // Close on route change, and lock body scroll while open.
  useEffect(() => { onClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/80 transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed inset-y-0 right-0 z-50 h-full w-3/4 max-w-sm bg-background p-6 shadow-lg transition-transform duration-300 ease-in-out md:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-8">
          <img src="/assets/img/logo.png" alt="Vertoc Agro Products" className="h-8 w-auto object-contain" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-full p-2 text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_LINKS.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/quote"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
          >
            Get a Quote
          </Link>
        </nav>
      </div>
    </>
  )
}
