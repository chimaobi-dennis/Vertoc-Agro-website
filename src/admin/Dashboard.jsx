import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, Briefcase, Inbox, Newspaper, Package, Plus, UserPlus, Users } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card } from './ui'
import { Bone } from '../components/Skeleton'

const TILES = [
  { key: 'products', label: 'Products', icon: Package, to: '/admin/products', perm: 'products', tone: 'bg-primary/10 text-primary' },
  { key: 'posts', label: 'Blog posts', icon: Newspaper, to: '/admin/posts', perm: 'posts', tone: 'bg-accent/15 text-accent' },
  { key: 'enquiriesNew', label: 'New enquiries', icon: Inbox, to: '/admin/enquiries', perm: 'quotes', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  { key: 'clients', label: 'Clients', icon: Briefcase, to: '/admin/clients', perm: 'clients', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  { key: 'users', label: 'Active users', icon: Users, to: '/admin/users', perm: 'users', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
]
const TONE = { create: 'green', update: 'blue', delete: 'red', invite: 'amber', upload: 'muted' }

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }
const ago = iso => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function Dashboard() {
  const { me } = useAuth()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState(null)
  const [err, setErr] = useState(null)
  const canAudit = Boolean(me?.permissions?.audit)

  useEffect(() => {
    adminFetch('/stats').then(setStats).catch(e => setErr(e.message))
    if (canAudit) adminFetch('/audit?limit=8').then(setActivity).catch(() => setActivity([]))
  }, [canAudit])

  const tiles = TILES.filter(t => !t.perm || me?.permissions?.[t.perm])
  const first = (me?.name || me?.email || '').split(/[\s@]/)[0]

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1.5">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">{greet()}, {first}.</h1>
        <p className="text-muted-foreground mt-1.5">Here's what's happening across the site.</p>
      </div>

      {err && <Alert>{err}</Alert>}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-5">
        {tiles.map(({ key, label, icon: Icon, to, tone }, i) => (
          <Link key={key} to={to} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
            <Card hover className="p-5 lg:p-6 h-full">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${tone}`}><Icon className="w-5 h-5" /></div>
              {stats ? <p className="text-3xl lg:text-4xl font-bold tracking-tight">{stats[key]}</p> : <Bone className="h-9 w-16 mb-1" />}
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
              <p className="text-xs font-semibold text-accent mt-4 flex items-center gap-1">View <ArrowRight className="w-3 h-3" /></p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-5">
        <Card className="p-6 animate-fade-up" style={{ animationDelay: '280ms' }}>
          <h2 className="font-semibold mb-1">Quick actions</h2>
          <p className="text-sm text-muted-foreground mb-5">Jump straight into the common tasks.</p>
          <div className="flex flex-col gap-2.5">
            {me?.permissions?.products && <Link to="/admin/products/new"><Button variant="accent" className="w-full justify-start"><Plus className="w-4 h-4" />New product</Button></Link>}
            {me?.permissions?.posts && <Link to="/admin/posts/new"><Button variant="outline" className="w-full justify-start"><Plus className="w-4 h-4" />New blog post</Button></Link>}
            {me?.permissions?.users && <Link to="/admin/users"><Button variant="outline" className="w-full justify-start"><UserPlus className="w-4 h-4" />Invite a user</Button></Link>}
          </div>
        </Card>

        {canAudit && (
          <Card className="p-6 animate-fade-up" style={{ animationDelay: '350ms' }}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-accent" />Recent activity</h2>
                <p className="text-sm text-muted-foreground">Latest changes from the panel and from Claude.</p>
              </div>
              <Link to="/admin/audit" className="text-xs font-semibold text-accent flex items-center gap-1 shrink-0">View all <ArrowRight className="w-3 h-3" /></Link>
            </div>
            <ul className="divide-y divide-border">
              {!activity && [0, 1, 2, 3, 4].map(i => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <Bone className="w-8 h-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5"><Bone className="h-3.5 w-2/3" /><Bone className="h-3 w-1/3" /></div>
                  <Bone className="h-3 w-12" />
                </li>
              ))}
              {activity?.map(r => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center shrink-0">
                    {r.actor_label === 'mcp' ? 'AI' : r.actor_label.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="flex-1 min-w-0 text-sm truncate">
                    <span className="font-medium">{r.actor_label === 'mcp' ? 'Claude' : r.actor_label}</span>
                    <Badge tone={TONE[r.action] || 'muted'} className="mx-1.5">{r.action}</Badge>
                    <span className="text-muted-foreground">{r.entity} {r.entity_id}</span>
                  </p>
                  <span className="text-xs text-muted-foreground shrink-0">{ago(r.at)}</span>
                </li>
              ))}
              {activity?.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">No activity yet — your first change will appear here.</li>
              )}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
