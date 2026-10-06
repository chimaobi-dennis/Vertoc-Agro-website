/*
 * The review queue: everything staff created or amended that is waiting for
 * an admin, with the original beside the proposal. People without approval
 * rights see their own submissions here, with where they stand.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, PageHeader } from './ui'
import { Bone } from '../components/Skeleton'
import { AmendmentDiff, TYPE_NAME, useDecision } from './ApprovalUi'
import { fmtDateTime, fmtMoney } from './format'

export default function ApprovalsAdmin() {
  const [data, setData] = useState(null); const [err, setErr] = useState(null)
  const load = useCallback(() => adminFetch('/approvals').then(d => { setData(d); setErr(null) }).catch(e => setErr(e.message)), [])
  useEffect(() => { load() }, [load])
  const [start, dialog] = useDecision(load)
  const none = data && !data.records.length && !data.amendments.length
  return (
    <>
      <PageHeader eyebrow="Manage" title="Approvals" description="New invoices, orders, clients and suppliers, and changes to official invoices and orders, wait here for an admin. Nobody approves their own work." />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!data && <Card className="p-6 space-y-3">{[0, 1, 2].map(i => <Bone key={i} className="h-12 w-full" />)}</Card>}
      {none && <Card className="p-10 text-center text-muted-foreground"><ShieldCheck className="w-8 h-8 mx-auto mb-3 text-accent" />Nothing is waiting for approval.</Card>}
      {data?.records.length > 0 && (
        <Card className="mb-6">
          <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">New records</h2></div>
          <ul className="divide-y divide-border">
            {data.records.map(r => (
              <li key={`${r.type}-${r.id}`} className="px-5 py-3.5 flex flex-wrap items-center gap-3 text-sm">
                <Badge tone="blue">{TYPE_NAME[r.type]}</Badge>
                <Link to={`/staff360${r.link}`} className="flex-1 min-w-[14rem] hover:text-accent"><span className="font-semibold">{r.number || r.title}</span>{r.number && r.title ? <span className="text-muted-foreground"> · {r.title}</span> : null}<span className="block text-xs text-muted-foreground">by {r.submitted_name} · {fmtDateTime(r.created_at)}{r.total != null ? ` · ${fmtMoney(r.total, r.currency)}` : ''}</span></Link>
                {r.can_decide ? <div className="flex gap-2"><Button variant="accent" className="h-9" onClick={() => start(`/approvals/${r.type}/${r.id}/decision`, 'approved')}><CheckCircle2 className="w-4 h-4" />Approve</Button><Button variant="outline" className="h-9 text-destructive" onClick={() => start(`/approvals/${r.type}/${r.id}/decision`, 'rejected')}>Reject</Button></div> : <Badge tone="amber">Pending approval</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {data?.amendments.map(a => (
        <Card key={a.id} className="mb-4 p-5">
          <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
            <Badge tone="amber">Pending amendment approval</Badge>
            <Link to={`/staff360/${a.entity === 'quote' ? 'quotes' : 'purchase-orders'}/${a.entity_id}`} className="font-semibold hover:text-accent">{a.entity_number}</Link>
            <span className="flex-1 text-muted-foreground">proposed by {a.initiated_name} · {fmtDateTime(a.created_at)}</span>
            {a.can_decide && <div className="flex gap-2"><Button variant="accent" className="h-9" onClick={() => start(`/amendments/${a.id}/decision`, 'approved')}><CheckCircle2 className="w-4 h-4" />Approve</Button><Button variant="outline" className="h-9 text-destructive" onClick={() => start(`/amendments/${a.id}/decision`, 'rejected')}>Reject</Button></div>}
          </div>
          {a.reason && <p className="text-sm mb-3"><span className="font-semibold">Reason: </span>{a.reason}</p>}
          <AmendmentDiff a={a} cur={a.original?.currency || a.proposed?.currency || 'USD'} />
        </Card>
      ))}
      {dialog}
    </>
  )
}
