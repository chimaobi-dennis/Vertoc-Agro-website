import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Card, PageHeader, Table, Td } from './ui'
import { Bone } from '../components/Skeleton'

export const STAGES = { quote: ['new', 'contacted', 'quoted', 'won', 'lost', 'archived'], contact: ['new', 'replied', 'archived'] }
export const stageTone = s => ({ new: 'amber', contacted: 'blue', quoted: 'blue', replied: 'blue', won: 'green', lost: 'red', archived: 'muted' })[s] || 'muted'

export default function EnquiriesAdmin() {
  const [sp, setSp] = useSearchParams()
  const kind = sp.get('kind') === 'contact' ? 'contact' : 'quote'
  const status = sp.get('status') || 'all'
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => { setRows(null); adminFetch(`/enquiries?kind=${kind}&status=${status}`).then(setRows).catch(e => setErr(e.message)) }, [kind, status])
  const set = (k, v) => { const n = new URLSearchParams(sp); n.set(k, v); if (k === 'kind') n.delete('status'); setSp(n) }
  const isQuote = kind === 'quote'

  return (
    <>
      <PageHeader eyebrow="Inbox" title={isQuote ? 'Quote requests' : 'Messages'} description="Everything that arrives through the website forms." />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-xl border border-border overflow-hidden text-xs font-semibold">
          {[['quote', 'Quote requests'], ['contact', 'Messages']].map(([k, l]) => (
            <button key={k} onClick={() => set('kind', k)} className={`px-3.5 py-2 ${kind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['all', ...STAGES[kind]].map(s => (
            <button key={s} onClick={() => set('status', s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition-colors ${status === s ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>{s}</button>
          ))}
        </div>
      </div>

      <Card>
        <Table head={['Received', 'From', isQuote ? 'Commodity' : 'Subject', isQuote ? 'Quantity' : '', 'Status', '']}>
          {!rows && [0, 1, 2, 3].map(i => <tr key={i}>{[...Array(6)].map((_, j) => <Td key={j}><Bone className="h-4 w-20" /></Td>)}</tr>)}
          {rows?.map(r => (
            <tr key={r.id} className="hover:bg-muted/40">
              <Td className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</Td>
              <Td><span className="font-medium">{r.name}</span><div className="text-xs text-muted-foreground">{r.email}</div></Td>
              <Td>{isQuote ? (r.commodity || '—') : (r.subject || '—')}</Td>
              <Td className="text-muted-foreground">{isQuote ? (r.quantity || '—') : ''}</Td>
              <Td><Badge tone={stageTone(r.status)}>{r.status}</Badge></Td>
              <Td className="text-right"><Link to={`/staff360/enquiries/${r.id}`} className="text-xs font-semibold text-accent">Open →</Link></Td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><Td colSpan={6} className="text-center py-12 text-muted-foreground">Nothing here yet.</Td></tr>}
        </Table>
      </Card>
    </>
  )
}
