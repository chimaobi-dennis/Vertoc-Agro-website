import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Download, Plus, Search } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Input, PageHeader, Table, Td } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtDay } from '../lib/procurement'

const exportCsv = rows => import('./exports').then(m => m.downloadCsv('vertoc-suppliers.csv', [
  { label: 'Company', get: r => r.company_name }, { label: 'Contact person', get: r => r.contact_person }, { label: 'Email', get: r => r.email }, { label: 'Phone', get: r => r.phone },
  { label: 'Address', get: r => r.address }, { label: 'Supplies', get: r => r.commodities }, { label: 'Bids', get: r => r.bids }, { label: 'Awarded', get: r => r.awarded },
  { label: 'Account', get: r => (r.has_account ? 'yes' : 'no') }, { label: 'Status', get: r => r.status }, { label: 'Added', get: r => (r.created_at || '').slice(0, 10) },
], rows))
const SOURCE = { admin: 'Added by staff', bid: 'From a bid', signup: 'Registered' }

/** The procurement side's clients: everyone who supplies us, or has offered to. */
export default function SuppliersAdmin() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('active')

  useEffect(() => {
    const t = setTimeout(() => adminFetch(`/suppliers?status=${status}&q=${encodeURIComponent(q.trim())}`).then(r => { setRows(r); setErr(null) }).catch(e => setErr(e.message)), q ? 300 : 0)
    return () => clearTimeout(t)
  }, [status, q])

  return (
    <>
      <PageHeader eyebrow="Procurement" title="Suppliers" description={rows ? `${rows.length} ${status === 'all' ? '' : status + ' '}supplier${rows.length === 1 ? '' : 's'}` : ' '}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!rows?.length} onClick={() => exportCsv(rows)}><Download className="w-4 h-4" />CSV</Button>
            <Link to="/staff360/suppliers/new"><Button variant="accent"><Plus className="w-4 h-4" />New supplier</Button></Link>
          </div>
        } />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-10" placeholder="Search company, contact, email, commodity…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex rounded-xl border border-border overflow-hidden text-xs font-semibold">
          {['active', 'blocked', 'archived', 'all'].map(s => <button key={s} onClick={() => { setRows(null); setStatus(s) }} className={`px-3.5 py-2 capitalize ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{s}</button>)}
        </div>
      </div>
      <Card>
        <Table head={['Company', 'Contact', 'Supplies', 'Bids', 'Last bid', 'Account', '']}>
          {!rows && !err && [0, 1, 2, 3].map(i => <tr key={i}>{[...Array(7)].map((_, j) => <Td key={j}><Bone className="h-4 w-24" /></Td>)}</tr>)}
          {rows?.map(r => (
            <tr key={r.id} className="hover:bg-muted/40">
              <Td><Link to={`/staff360/suppliers/${r.id}`} className="font-medium hover:text-accent">{r.company_name}</Link>{r.status !== 'active' && <Badge tone={r.status === 'blocked' ? 'red' : 'muted'} className="ml-2">{r.status}</Badge>}<span className="block text-xs text-muted-foreground">{SOURCE[r.source] || r.source}</span></Td>
              <Td className="text-muted-foreground">{r.contact_person || '—'}<span className="block text-xs break-all">{r.email}</span><span className="block text-xs">{r.phone}</span></Td>
              <Td className="text-muted-foreground max-w-[200px] truncate">{r.commodities || '—'}</Td>
              <Td className="whitespace-nowrap">{r.bids}{r.awarded > 0 && <Badge tone="green" className="ml-2">{r.awarded} awarded</Badge>}</Td>
              <Td className="text-muted-foreground whitespace-nowrap">{r.last_bid_at ? fmtDay(r.last_bid_at) : '—'}</Td>
              <Td>{r.has_account ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><BadgeCheck className="w-3.5 h-3.5" />{r.verified_at ? 'Yes' : 'Unconfirmed'}</span> : <span className="text-xs text-muted-foreground">No</span>}</Td>
              <Td className="text-right"><Link to={`/staff360/suppliers/${r.id}`} className="text-xs font-semibold text-accent">Open →</Link></Td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><Td colSpan={7} className="text-center py-12 text-muted-foreground">{q ? 'No supplier matches your search.' : status === 'active' ? 'No suppliers yet. They are added here when they bid or register, or you can add one yourself.' : `No ${status} suppliers.`}</Td></tr>}
        </Table>
      </Card>
    </>
  )
}
