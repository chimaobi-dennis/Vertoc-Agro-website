import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Input, PageHeader, Table, Td } from './ui'
import { useSort } from '../lib/sort'
import { Bone } from '../components/Skeleton'
import { PO_SHORT, fmtDay, money, poTone } from '../lib/procurement'

const FILTERS = ['all', 'draft', 'issued', 'acknowledged', 'declined', 'fulfilled', 'cancelled']
const KINDS = [['all', 'PO and LPO'], ['lpo', 'LPO'], ['po', 'PO']]

/** Purchase orders and local purchase orders: what procurement issues where sales issues an invoice. */
export default function PurchaseOrdersAdmin() {
  const [sp, setSp] = useSearchParams()
  const status = FILTERS.includes(sp.get('status')) ? sp.get('status') : 'all'
  const kind = ['po', 'lpo'].includes(sp.get('kind')) ? sp.get('kind') : 'all'
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => { setRows(null); adminFetch(`/purchase-orders?status=${status}&kind=${kind}`).then(setRows).catch(e => setErr(e.message)) }, [status, kind])
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase(); const all = rows || []
    return s ? all.filter(r => [r.number, r.supplier_name, r.title, r.supplier_email].some(v => String(v || '').toLowerCase().includes(s))) : all
  }, [rows, q])
  const param = (k, v) => { const n = new URLSearchParams(sp); v === 'all' ? n.delete(k) : n.set(k, v); setSp(n) }

  const [sorted, sortControl] = useSort(visible, { name: 'supplier_name', more: [{ key: 'number', label: 'Order number', get: 'number', desc: true }, { key: 'amount', label: 'Amount, highest first', get: r => Number(r.total), desc: true }, { key: 'status', label: 'Status', get: 'status' }, { key: 'delivery', label: 'Delivery date, soonest first', get: 'delivery_date' }] })
  return (
    <>
      <PageHeader eyebrow="Procurement" title="Purchase orders" description={rows ? `${visible.length} ${status === 'all' ? '' : status + ' '}order${visible.length === 1 ? '' : 's'}` : ' '}
        action={<Link to="/staff360/purchase-orders/new"><Button variant="accent"><Plus className="w-4 h-4" />New order</Button></Link>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-10" placeholder="Search number, supplier or title…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex rounded-xl border border-border overflow-hidden text-xs font-semibold">
          {KINDS.map(([k, l]) => <button key={k} onClick={() => param('kind', k)} className={`px-3.5 py-2 ${kind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{l}</button>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(s => <button key={s} onClick={() => param('status', s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition-colors ${status === s ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>{s}</button>)}
        </div>
      </div>
      <div className="flex justify-end mb-3">{sortControl}</div>
      <Card>
        <Table head={['Number', 'Supplier', 'Title', 'Total', 'Status', 'Deliver by', '']}>
          {!rows && !err && [0, 1, 2, 3].map(i => <tr key={i}>{[...Array(7)].map((_, j) => <Td key={j}><Bone className="h-4 w-20" /></Td>)}</tr>)}
          {rows && sorted.map(r => (
            <tr key={r.id} className="hover:bg-muted/40">
              <Td><Link to={`/staff360/purchase-orders/${r.id}`} className="font-medium hover:text-accent whitespace-nowrap">{r.number}</Link><span className="block text-xs text-muted-foreground">{PO_SHORT[r.kind]}</span></Td>
              <Td>{r.supplier_id ? <Link to={`/staff360/suppliers/${r.supplier_id}?tab=orders`} className="hover:text-accent">{r.supplier_name || '—'}</Link> : (r.supplier_name || '—')}</Td>
              <Td className="text-muted-foreground max-w-[260px] truncate">{r.title || '—'}</Td>
              <Td className="font-medium whitespace-nowrap tabular-nums">{money(r.total, r.currency)}</Td>
              <Td><Badge tone={poTone(r.status)}>{r.status}</Badge></Td>
              <Td className="text-muted-foreground whitespace-nowrap">{fmtDay(r.delivery_date)}</Td>
              <Td className="text-right"><Link to={`/staff360/purchase-orders/${r.id}`} className="text-xs font-semibold text-accent">Open →</Link></Td>
            </tr>
          ))}
          {rows && !visible.length && <tr><Td colSpan={7} className="text-center py-12 text-muted-foreground">{q ? 'No order matches your search.' : 'No purchase orders yet. Raise one from an awarded bid, or start a new one.'}</Td></tr>}
        </Table>
      </Card>
    </>
  )
}
