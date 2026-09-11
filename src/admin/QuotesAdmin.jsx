import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, Settings2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Input, PageHeader, Table, Td } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtDate, fmtMoney, quoteTone } from './format'

const FILTERS = ['all', 'draft', 'open', 'accepted', 'declined', 'expired']

export default function QuotesAdmin() {
  const [sp, setSp] = useSearchParams()
  const status = FILTERS.includes(sp.get('status')) ? sp.get('status') : 'all'
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => { setRows(null); adminFetch(`/quotes?status=${status}`).then(setRows).catch(e => setErr(e.message)) }, [status])
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase(); const all = rows || []
    return s ? all.filter(r => [r.number, r.client_name, r.title, r.client_email].some(v => String(v || '').toLowerCase().includes(s))) : all
  }, [rows, q])

  return (
    <>
      <PageHeader eyebrow="Sales" title="Quotes" description={rows ? `${visible.length} ${status === 'all' ? '' : status} quote${visible.length === 1 ? '' : 's'}` : ' '}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/staff360/quotes/fields"><Button variant="outline"><Settings2 className="w-4 h-4" />Fields</Button></Link>
            <Link to="/staff360/quotes/new"><Button variant="accent"><Plus className="w-4 h-4" />New quote</Button></Link>
          </div>
        } />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-10" placeholder="Search number, client or title…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(s => (
            <button key={s} onClick={() => { const n = new URLSearchParams(sp); s === 'all' ? n.delete('status') : n.set('status', s); setSp(n) }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition-colors ${status === s ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>{s}</button>
          ))}
        </div>
      </div>

      <Card>
        <Table head={['Number', 'Client', 'Title', 'Total', 'Status', 'Valid until', '']}>
          {!rows && [0, 1, 2, 3].map(i => <tr key={i}>{[...Array(7)].map((_, j) => <Td key={j}><Bone className="h-4 w-20" /></Td>)}</tr>)}
          {rows && visible.map(r => (
            <tr key={r.id} className="hover:bg-muted/40">
              <Td><Link to={`/staff360/quotes/${r.id}`} className="font-medium hover:text-accent">{r.number}</Link></Td>
              <Td>{r.client_id ? <Link to={`/staff360/clients/${r.client_id}?tab=quotes`} className="hover:text-accent">{r.client_name || '—'}</Link> : (r.client_name || '—')}</Td>
              <Td className="text-muted-foreground max-w-[260px] truncate">{r.title || '—'}</Td>
              <Td className="font-medium whitespace-nowrap">{fmtMoney(r.total, r.currency)}</Td>
              <Td><Badge tone={quoteTone(r.status)}>{r.status}</Badge></Td>
              <Td className="text-muted-foreground whitespace-nowrap">{fmtDate(r.valid_until)}</Td>
              <Td className="text-right"><Link to={`/staff360/quotes/${r.id}`} className="text-xs font-semibold text-accent">Open →</Link></Td>
            </tr>
          ))}
          {rows && !visible.length && <tr><Td colSpan={7} className="text-center py-12 text-muted-foreground">{q ? 'No quotes match your search.' : 'No quotes yet — create your first one.'}</Td></tr>}
        </Table>
      </Card>
    </>
  )
}
