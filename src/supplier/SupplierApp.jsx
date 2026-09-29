/*
 * The supplier portal (/supplier/*), inside the public site's layout:
 * sign-in pages for everyone, and behind a supplier session the dashboard,
 * the bids and the profile.
 */
import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut, UserRound } from 'lucide-react'
import { supplierFetch, useSupplier } from '../lib/supplier'
import { Bone } from '../components/Skeleton'
import { SupplierForgot, SupplierLogin, SupplierRegister, SupplierReset, SupplierVerify } from './SupplierAuthPages'
import SupplierDashboard from './SupplierDashboard'
import SupplierBid from './SupplierBid'
import SupplierProfile from './SupplierProfile'
import { AuthCard, Notice, Page, Problem, outline, primary } from './ui'

function Gate() {
  const { session, me, error, ready, signOut } = useSupplier()
  const { pathname, search, hash } = useLocation()
  const [sent, setSent] = useState(false)
  if (!ready) return <Page><div className="space-y-4" role="status" aria-label="Loading"><Bone className="h-8 w-64" /><Bone className="h-24 w-full rounded-2xl" /><Bone className="h-64 w-full rounded-2xl" /></div></Page>
  if (!session) return <Navigate to={`/supplier/login?next=${encodeURIComponent(pathname + search + hash)}`} replace />
  if (!me) {
    const unverified = error?.code === 'unverified'
    const resend = () => supplierFetch('/supplier/resend', { method: 'POST', auth: false, body: { email: session.user.email } }).then(() => setSent(true)).catch(() => setSent(true))
    return (
      <AuthCard title={unverified ? 'Confirm your email address' : 'This account cannot be used here'}>
        <div className="space-y-4 text-center">
          <Problem>{error?.message || 'Something went wrong. Please sign in again.'}</Problem>
          {sent && <Notice>A new confirmation link is on its way to {session.user.email}.</Notice>}
          <div className="flex flex-wrap justify-center gap-3">
            {unverified && !sent && <button type="button" onClick={resend} className={primary}>Send the link again</button>}
            <button type="button" onClick={signOut} className={outline}>Sign out</button>
          </div>
        </div>
      </AuthCard>
    )
  }
  return <Shell />
}

function Shell() {
  const { me, signOut } = useSupplier()
  const nav = useNavigate()
  const tab = ({ isActive }) => `inline-flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-muted'}`
  return (
    <main className="flex-grow">
      <div className="pt-28 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="min-w-0">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-accent mb-1">Supplier portal</span>
              <p className="font-serif text-2xl font-bold text-foreground truncate">{me.company_name}</p>
            </div>
            <nav className="flex flex-wrap items-center gap-1.5" aria-label="Supplier portal">
              <NavLink to="/supplier" end className={tab}><LayoutDashboard className="w-4 h-4" />Dashboard</NavLink>
              <NavLink to="/supplier/profile" className={tab}><UserRound className="w-4 h-4" />Profile</NavLink>
              <button type="button" onClick={() => signOut().then(() => nav('/supplier/login'))} className="inline-flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold text-foreground/70 hover:bg-muted"><LogOut className="w-4 h-4" />Sign out</button>
            </nav>
          </div>
          <Outlet />
        </div>
      </div>
    </main>
  )
}

const NotHere = () => <Page><div className="text-center py-24"><h1 className="font-serif text-3xl font-bold mb-3">Page not found</h1><p className="text-muted-foreground">Back to your <Link to="/supplier" className="text-accent font-semibold">dashboard</Link>.</p></div></Page>

export default function SupplierApp() {
  return (
    <Routes>
      <Route path="login" element={<SupplierLogin />} />
      <Route path="register" element={<SupplierRegister />} />
      <Route path="verify" element={<SupplierVerify />} />
      <Route path="forgot" element={<SupplierForgot />} />
      <Route path="reset" element={<SupplierReset />} />
      <Route element={<Gate />}>
        <Route index element={<SupplierDashboard />} />
        <Route path="bids/:id" element={<SupplierBid />} />
        <Route path="profile" element={<SupplierProfile />} />
      </Route>
      <Route path="*" element={<NotHere />} />
    </Routes>
  )
}
