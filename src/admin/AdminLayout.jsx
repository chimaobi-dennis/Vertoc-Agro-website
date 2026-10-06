import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Banknote, BarChart3, Briefcase, Factory, Landmark, TrendingUp, Truck, FileSignature, FileText, Gavel, Inbox, LayoutDashboard, LayoutTemplate, LogOut, Mail, Mails, Menu, Moon, Newspaper, Package, ScrollText, Settings, Sun, Users, X, Star } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { useAdminTheme } from './AdminTheme'

// `perm` is a module of the permission table (server/permissions.js): an item shows when the person may view it.
const NAV = [
  { to: '/staff360', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Manage' },
  { to: '/staff360/products', label: 'Products', icon: Package, perm: 'content', group: 'Manage' },
  { to: '/staff360/posts', label: 'Blog', icon: Newspaper, perm: 'content', group: 'Manage' },
  { to: '/staff360/reviews', label: 'Reviews', icon: Star, perm: 'content', group: 'Manage', badge: 'reviewsPending' },
  { to: '/staff360/enquiries', label: 'Enquiries', icon: Inbox, perm: 'enquiries', group: 'Sales' },
  { to: '/staff360/quotes', label: 'Invoices', icon: FileText, perm: 'invoices', group: 'Sales' },
  { to: '/staff360/payments', label: 'Payments', icon: Banknote, perm: 'payments', group: 'Sales', badge: 'paymentsNew' },
  { to: '/staff360/messages', label: 'Messages', icon: Mail, perm: 'messages', group: 'Sales', badge: 'inboundUnread' },
  { to: '/staff360/clients', label: 'Clients', icon: Briefcase, perm: 'clients', group: 'Sales' },
  // Procurement is the sourcing leg, as Sales is the selling leg: bids and LPOs where sales has enquiries and invoices.
  { to: '/staff360/tenders', label: 'Bidding', icon: Gavel, perm: 'bidding', group: 'Procurement', badge: 'bidsNew', also: ['/staff360/bids'] },
  { to: '/staff360/purchase-orders', label: 'Purchase orders', icon: FileSignature, perm: 'purchase_orders', group: 'Procurement' },
  { to: '/staff360/deliveries', label: 'Supplier shipments', icon: Truck, perm: 'shipments', group: 'Procurement', badge: 'deliveriesMoving' },
  { to: '/staff360/procurement/messages', label: 'Messages', icon: Mails, perm: 'supplier_messages', group: 'Procurement', badge: 'procUnread' },
  { to: '/staff360/suppliers', label: 'Suppliers', icon: Factory, perm: 'suppliers', group: 'Procurement' },
  { to: '/staff360/investments', label: 'Investments', icon: TrendingUp, perm: 'investments', group: 'Investment', badge: 'investmentsNew' },
  { to: '/staff360/investors', label: 'Investors', icon: Landmark, perm: 'investments', group: 'Investment' },
  { to: '/staff360/staff', label: 'Staff', icon: Users, perm: 'staff', group: 'System' },
  { to: '/staff360/reports', label: 'Reports', icon: BarChart3, perm: 'reports', group: 'System' },
  { to: '/staff360/audit', label: 'Audit log', icon: ScrollText, perm: 'audit', group: 'System' },
  { to: '/staff360/templates', label: 'Email templates', icon: LayoutTemplate, perm: 'settings', group: 'System' },
  { to: '/staff360/settings', label: 'Settings', icon: Settings, perm: 'settings', group: 'System' },
]
const GROUPS = ['Manage', 'Sales', 'Procurement', 'Investment', 'System']

const initials = s => (s || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

export default function AdminLayout() {
  const { me, signOut } = useAuth()
  const { isDark, toggle } = useAdminTheme()
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState({})
  const { pathname } = useLocation()

  // Unread-mail and new-bid badges: refreshed on every route change and once a minute.
  const badges = NAV.some(n => n.badge && me?.permissions?.[n.perm])
  useEffect(() => {
    if (!badges) return
    const load = () => adminFetch('/stats').then(setStats).catch(() => {})
    load(); const t = setInterval(load, 60000); return () => clearInterval(t)
  }, [pathname, badges])

  const items = NAV.filter(n => !n.perm || me?.permissions?.[n.perm])
  const at = n => (n.end ? pathname === n.to : pathname.startsWith(n.to) || (n.also || []).some(p => pathname.startsWith(p)))
  const hit = [...NAV].reverse().find(at)
  const current = hit ? (hit.group === 'Procurement' && hit.label === 'Messages' ? 'Procurement messages' : pathname.startsWith('/staff360/bids') ? 'Bids' : hit.label) : 'Admin'
  const who = me?.name || me?.email

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-card border-r border-border">
      <div className="flex items-center justify-between px-6 h-16 border-b border-border">
        <img src="/assets/img/logo.png" alt="Vertoc Agro" className="h-7" />
        <button className="lg:hidden p-2 rounded-lg hover:bg-muted" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {GROUPS.filter(g => items.some(n => n.group === g)).map(g => (<div key={g} className="space-y-1 [&+&]:mt-5">
        <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{g}</p>
        {items.filter(n => n.group === g).map(({ to, label, icon: Icon, end, badge, also }) => { const alsoHere = (also || []).some(p => pathname.startsWith(p)); return (
          <NavLink
            key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive || alsoHere ? 'bg-accent/10 text-accent' : 'text-foreground/70 hover:bg-muted hover:text-foreground'}`}
          >
            {({ isActive: on }) => { const isActive = on || alsoHere; return (
              <>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent" />}
                <Icon className="w-4 h-4 shrink-0" />{label}
                {badge && stats[badge] > 0 && <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-[11px] font-bold flex items-center justify-center">{stats[badge]}</span>}
              </>
            ) }}
          </NavLink>
        ) })}
        </div>))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 p-2">
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
            {initials(who)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{who}</p>
            <p className="text-xs text-muted-foreground truncate">{me?.role_name || me?.role}</p>
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
