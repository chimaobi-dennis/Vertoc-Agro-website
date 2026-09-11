import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LayoutTemplate } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Card, PageHeader } from './ui'
import { Bone } from '../components/Skeleton'

/** The emails the system sends, each editable. */
export default function TemplatesAdmin() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { adminFetch('/templates').then(setRows).catch(e => setErr(e.message)) }, [])
  return (
    <>
      <PageHeader eyebrow="System" title="Email templates" description="Every email the panel sends starts from one of these. Placeholders like {{client_name}} are filled in from the record; you can still edit each message before it goes out." />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <div className="grid md:grid-cols-2 gap-4 max-w-5xl">
        {!rows && [0, 1, 2, 3].map(i => <Card key={i} className="p-5 space-y-3"><Bone className="h-5 w-40" /><Bone className="h-4 w-full" /><Bone className="h-4 w-3/4" /></Card>)}
        {rows?.map((t, i) => (
          <Link key={t.key} to={`/staff360/templates/${t.key}`} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <Card hover className="p-5 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0"><LayoutTemplate className="w-4 h-4" /></div>
                <div className="flex gap-1.5">{!t.enabled && <Badge tone="red">off</Badge>}<Badge tone={t.is_default ? 'muted' : 'green'}>{t.is_default ? 'default' : 'customised'}</Badge></div>
              </div>
              <h2 className="font-semibold">{t.name}</h2>
              <p className="text-sm text-muted-foreground mt-1 flex-1">{t.description}</p>
              <p className="text-xs text-muted-foreground mt-3 truncate"><span className="font-semibold text-foreground/70">Subject: </span>{t.subject || <em>(set when sending)</em>}</p>
              <p className="text-xs font-semibold text-accent mt-3 flex items-center gap-1">Edit <ArrowRight className="w-3 h-3" /></p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
