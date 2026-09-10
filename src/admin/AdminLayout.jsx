import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Package, Newspaper, Users, ScrollText, LogOut } from 'lucide-react'
import { useAuth } from './AuthContext'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package, perm: 'products' },
  { to: '/admin/posts', label: 'Blog', icon: Newspaper, perm: 'posts' },
  { to: '/admin/users', label: 'Users', icon: Users, perm: 'users' },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText, perm: 'audit' },
]

export default function AdminLayout() {
  const { me, signOut } = useAuth()
  const items = NAV.filter(n => !n.perm || me?.permissions?.[n.perm])

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <img src="/assets/img/logo.png" alt="Vertoc Agro" className="h-8" />
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-2">Admin</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-muted'}`}>
              <Icon className="w-4 h-4" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-sm font-medium truncate">{me?.name || me?.email}</p>
          <p className="text-xs text-muted-foreground capitalize mb-3">{me?.role}</p>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 md:p-10"><Outlet /></main>
    </div>
  )
}
