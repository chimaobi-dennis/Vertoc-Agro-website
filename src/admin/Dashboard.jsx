import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Newspaper, Inbox, Users } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Card, PageHeader, Alert } from './ui'
import { Bone } from '../components/Skeleton'

const TILES = [
  { key: 'products', label: 'Products', icon: Package, to: '/admin/products', perm: 'products' },
  { key: 'posts', label: 'Blog posts', icon: Newspaper, to: '/admin/posts', perm: 'posts' },
  { key: 'enquiriesNew', label: 'New enquiries', icon: Inbox, to: '/admin', perm: null },
  { key: 'users', label: 'Active users', icon: Users, to: '/admin/users', perm: 'users' },
]

export default function Dashboard() {
  const { me } = useAuth()
  const [stats, setStats] = useState(null); const [err, setErr] = useState(null)
  useEffect(() => { adminFetch('/stats').then(setStats).catch(e => setErr(e.message)) }, [])

  return (
    <>
      <PageHeader title={`Welcome, ${me?.name || me?.email}`} description="Here's where things stand." />
      {err && <Alert>{err}</Alert>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {TILES.filter(t => !t.perm || me?.permissions?.[t.perm]).map(({ key, label, icon: Icon, to }) => (
          <Link key={key} to={to}>
            <Card className="p-6 hover:-translate-y-0.5 transition-transform">
              <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-primary" /></div>
              {stats ? <p className="text-3xl font-bold text-foreground">{stats[key]}</p> : <Bone className="h-9 w-16 mb-1" />}
              <p className="text-sm text-muted-foreground">{label}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
