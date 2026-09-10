import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, LogOut, Menu, Moon, Newspaper, Package, ScrollText, Sun, Users, X } from 'lucide-react'
import { useAuth } from './AuthContext'
import { useAdminTheme } from './AdminTheme'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package, perm: 'products' },
  { to: '/admin/posts', label: 'Blog', icon: Newspaper, perm: 'posts' },
  { to: '/admin/users', label: 'Users', icon: Users, perm: 'users' },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText, perm: 'audit' },
]

const initials = s => (s || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

export default function AdminLayout() {
  const { me, signOut } = useAuth()
  const { isDark, toggle } = useAdminTheme()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  const items = NAV.filter(n => !n.perm || me?.permissions?.[n.perm])
  const current = [...NAV].reverse().find(n => (n.end ? pathname === n.to : pathname.startsWith(n.to)))?.label || 'Admin'
  const who = me?.name || me?.email

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-card border-r border-border">
      <div className="flex items-center justify-between px-6 h-16 border-b border-border">
        <img src="/assets/img/logo.png" alt="Vertoc Agro" className="h-7" />
        <button className="lg:hidden p-2 rounded-lg hover:bg-muted" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Manage</p>
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-accent/10 text-accent' : 'text-foreground/70 hover:bg-muted hover:text-foreground'}`}
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent" />}
                <Icon className="w-4 h-4 shrink-0" />{label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 p-2">
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
            {initials(who)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{who}</p>
            <p className="text-xs text-muted-foreground capitalize">{me?.role}</p>
          </div>
          <button onClick={signOut} title="Sign out" aria-label="Sign out"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="hidden lg:block fixed inset-y-0 left-0 z-40">{sidebar}</div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="relative z-10 h-full w-64 shadow-2xl animate-slide-in-left">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-4 lg:px-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-muted" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-muted-foreground">{current}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} aria-label="Toggle theme"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
              {initials(who)}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10"><Outlet /></main>
      </div>
    </div>
  )
}
