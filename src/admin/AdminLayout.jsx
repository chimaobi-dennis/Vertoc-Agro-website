import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Banknote, BarChart3, Boxes, Briefcase, ChevronDown, PackageCheck, Factory, Landmark, TrendingUp, Truck, FileSignature, FileText, Gavel, Inbox, LayoutDashboard, LayoutTemplate, LogOut, Mail, Mails, Menu, Moon, Newspaper, Package, ScrollText, Settings, ShieldCheck, Sun, Users, X, Star } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { useAdminTheme } from './AdminTheme'

// `perm` is a module of the permission table (server/permissions.js): an item shows when the person may view it.
const NAV = [
  { to: '/staff360', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Manage' },
  { to: '/staff360/approvals', label: 'Approvals', icon: ShieldCheck, group: 'Manage', badge: 'approvalsPending' },
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
  { to: '/staff360/inventory', label: 'Expected deliveries', icon: PackageCheck, perm: 'inventory', group: 'Inventory', badge: 'inventoryOpen', end: true, also: ['/staff360/inventory/orders'] },
  { to: '/staff360/inventory/stock', label: 'Stock', icon: Boxes, perm: 'inventory', group: 'Inventory' },
  { to: '/staff360/investments', label: 'Investments', icon: TrendingUp, perm: 'investments', group: 'Investment', badge: 'investmentsNew' },
  { to: '/staff360/investors', label: 'Investors', icon: Landmark, perm: 'investments', group: 'Investment' },
]
const GROUPS = ['Manage', 'Sales', 'Procurement', 'Inventory', 'Investment']
// Administration lives under the person's avatar (top right), not in the sidebar.
const SYSTEM = [
  { to: '/staff360/staff', label: 'Staff', icon: Users, perm: 'staff' },
  { to: '/staff360/reports', label: 'Reports', icon: BarChart3, perm: 'reports' },
  { to: '/staff360/audit', label: 'Audit log', icon: ScrollText, perm: 'audit' },
  { to: '/staff360/templates', label: 'Email templates', icon: LayoutTemplate, perm: 'settings' },
  { to: '/staff360/settings', label: 'Settings', icon: Settings, perm: 'settings' },
]

const initials = s => (s || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

export default function AdminLayout() {
  const { me, signOut } = useAuth()
  const { isDark, toggle } = useAdminTheme()
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState({})
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)          // the avatar dropdown
  const menuRef = useRef(null)
  const [openGroups, setOpenGroups] = useState(() => { try { return JSON.parse(localStorage.getItem('staff360:nav') || '{}') } catch { return {} } })

  // Unread-mail and new-bid badges: refreshed on every route change and once a minute.
  const badges = NAV.some(n => n.badge && (!n.perm || me?.permissions?.[n.perm]))
  useEffect(() => {
    if (!badges) return
    const load = () => adminFetch('/stats').then(setStats).catch(() => {})
    load(); const t = setInterval(load, 60000); return () => clearInterval(t)
  }, [pathname, badges])

  const items = NAV.filter(n => !n.perm || me?.permissions?.[n.perm])
  const systemItems = SYSTEM.filter(n => !n.perm || me?.permissions?.[n.perm])
  const at = n => (n.end ? pathname === n.to : pathname.startsWith(n.to)) || (n.also || []).some(p => pathname.startsWith(p))
  const hit = [...NAV, ...SYSTEM].reverse().find(at)
  const activeGroup = [...NAV].reverse().find(at)?.group

  // The group you are working in opens by itself; the others stay as you left them (collapsed by default).
  useEffect(() => { if (activeGroup) setOpenGroups(g => (g[activeGroup] ? g : { ...g, [activeGroup]: true })) }, [activeGroup])
  useEffect(() => { try { localStorage.setItem('staff360:nav', JSON.stringify(openGroups)) } catch { /* private mode */ } }, [openGroups])
  const toggleGroup = g => setOpenGroups(o => ({ ...o, [g]: !o[g] }))
  useEffect(() => { setMenu(false) }, [pathname])
  useEffect(() => {
    if (!menu) return
    const away = e => { if (!menuRef.current?.contains(e.target)) setMenu(false) }
    const esc = e => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [menu])
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

      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-2">
        {GROUPS.filter(g => items.some(n => n.group === g)).map(g => {
          const list = items.filter(n => n.group === g)
          const isOpen = Boolean(openGroups[g])
          const pending = list.reduce((n, i) => n + (i.badge ? Number(stats[i.badge]) || 0 : 0), 0)
          return (
            <div key={g}>
              <button type="button" onClick={() => toggleGroup(g)} aria-expanded={isOpen}
                className="w-full flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-foreground/80 hover:bg-muted/70 transition-colors">
                <span className="flex-1 text-left">{g}</span>
                {!isOpen && pending > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center normal-case tracking-normal">{pending}</span>}
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`} />
              </button>
              {isOpen && <div className="mt-1 space-y-0.5">
                {list.map(({ to, label, icon: Icon, end, badge, also }) => { const alsoHere = (also || []).some(p => pathname.startsWith(p)); return (
                  <NavLink
                    key={to} to={to} end={end} onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
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
              </div>}
            </div>
          )
        })}
      </nav>

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
            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setMenu(m => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu"
                className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors">
                <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{initials(who)}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${menu ? 'rotate-180' : ''}`} />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-card shadow-xl py-2 z-50 animate-fade-in">
                  <div className="px-4 py-2.5 border-b border-border mb-1">
                    <p className="text-sm font-semibold truncate">{who}</p>
                    <p className="text-xs text-muted-foreground truncate">{me?.role_name || me?.role}</p>
                  </div>
                  {systemItems.length > 0 && <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">System</p>}
                  {systemItems.map(({ to, label, icon: Icon }) => (
                    <NavLink key={to} to={to} role="menuitem"
                      className={({ isActive }) => `flex items-center gap-3 mx-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-accent/10 text-accent' : 'text-foreground/80 hover:bg-muted hover:text-foreground'}`}>
                      <Icon className="w-4 h-4 shrink-0" />{label}
                    </NavLink>
                  ))}
                  <div className="border-t border-border mt-2 pt-2">
                    <button type="button" role="menuitem" onClick={signOut} className="flex w-full items-center gap-3 mx-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors" style={{ width: 'calc(100% - 1rem)' }}>
                      <LogOut className="w-4 h-4 shrink-0" />Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10"><Outlet /></main>
      </div>
    </div>
  )
}
