import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExternalLink, Plus, Search } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Input, PageHeader, Table, Td } from './ui'
import { Bone } from '../components/Skeleton'
import { TENDER_LABELS, fmtDay, fromNow, perUnit, qty, tenderTone } from '../lib/procurement'

const FILTERS = [['all', 'All'], ['open', 'Open'], ['upcoming', 'Opens soon'], ['draft', 'Drafts'], ['closed', 'Closed'], ['awarded', 'Awarded'], ['cancelled', 'Cancelled']]

/** Bidding opportunities: what we want to buy, published for suppliers to bid on. */
export default function TendersAdmin() {
  const [sp, setSp] = useSearchParams()
  const state = FILTERS.some(([k]) => k === sp.get('state')) ? sp.get('state') : 'all'
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => { adminFetch('/tenders').then(setRows).catch(e => setErr(e.message)) }, [])
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows || []).filter(t => (state === 'all' || t.state === state) && (!s || [t.number, t.title, t.commodity, t.delivery_location].some(v => String(v || '').toLowerCase().includes(s))))
  }, [rows, q, state])
  const count = k => (rows || []).filter(t => k === 'all' || t.state === k).length

  return (
    <>
      <PageHeader eyebrow="Procurement" title="Bidding" description={rows ? `${visible.length} ${state === 'all' ? '' : TENDER_LABELS[state].toLowerCase() + ' '}opportunit${visible.length === 1 ? 'y' : 'ies'}` : ' '}
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/bidding" target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="w-4 h-4" />View on the site</Button></a>
            <Link to="/staff360/tenders/new"><Button variant="accent"><Plus className="w-4 h-4" />New opportunity</Button></Link>
          </div>
        } />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-10" placeholder="Search number, commodity or location…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => { const n = new URLSearchParams(sp); k === 'all' ? n.delete('state') : n.set('state', k); setSp(n) }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${state === k ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>{l}{rows && count(k) > 0 && k !== 'all' ? ` ${count(k)}` : ''}</button>
          ))}
        </div>
      </div>

      <Card>
        <Table head={['Number', 'Opportunity', 'Quantity', 'Asking price', 'Bids close', 'Bids', 'Lowest bid', 'Status', '']}>
          {!rows && !err && [0, 1, 2, 3].map(i => <tr key={i}>{[...Array(9)].map((_, j) => <Td key={j}><Bone className="h-4 w-20" /></Td>)}</tr>)}
          {rows && visible.map(t => (
            <tr key={t.id} className="hover:bg-muted/40">
              <Td><Link to={`/staff360/tenders/${t.id}`} className="font-medium hover:text-accent whitespace-nowrap">{t.number}</Link></Td>
              <Td><Link to={`/staff360/tenders/${t.id}`} className="hover:text-accent"><span className="font-medium">{t.title}</span><span className="block text-xs text-muted-foreground">{[t.commodity, t.delivery_location].filter(Boolean).join(' · ')}</span></Link></Td>
              <Td className="whitespace-nowrap tabular-nums">{qty(t.quantity, t.unit)}</Td>
              <Td className="whitespace-nowrap tabular-nums">{perUnit(t.asking_price, t.currency, t.unit)}</Td>
              <Td className="whitespace-nowrap">{fmtDay(t.closes_at)}{['open', 'upcoming'].includes(t.state) && <span className="block text-xs text-muted-foreground">{t.state === 'upcoming' ? `opens ${fromNow(t.opens_at)}` : fromNow(t.closes_at)}</span>}</Td>
              <Td className="whitespace-nowrap">{t.bids.total - t.bids.withdrawn}{t.bids.open > 0 && <Badge tone="amber" className="ml-2">{t.bids.open} new</Badge>}</Td>
              <Td className="whitespace-nowrap tabular-nums">{t.lowest_price == null ? '—' : <span className={t.asking_price != null && t.lowest_price <= t.asking_price ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>{perUnit(t.lowest_price, t.currency, t.unit)}</span>}</Td>
              <Td><Badge tone={tenderTone(t.state)} className="whitespace-nowrap">{TENDER_LABELS[t.state]}</Badge></Td>
              <Td className="text-right"><Link to={`/staff360/tenders/${t.id}`} className="text-xs font-semibold text-accent">Open →</Link></Td>
            </tr>
          ))}
          {rows && !visible.length && <tr><Td colSpan={9} className="text-center py-12 text-muted-foreground">{q || state !== 'all' ? 'No opportunity matches.' : 'No bidding opportunities yet — publish the first one and suppliers can bid on the website.'}</Td></tr>}
        </Table>
      </Card>
    </>
  )
}
