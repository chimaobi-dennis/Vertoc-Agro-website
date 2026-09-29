/*
 * The supplier's dashboard: open opportunities, the bids they submitted
 * and where each stands, our requests for information, what they were
 * awarded, and the purchase orders we sent.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Award, CalendarClock, FileSignature, Gavel, Megaphone, MessageCircleQuestion } from 'lucide-react'
import { fetchJson } from '../lib/api'
import { supplierFetch, useSupplier } from '../lib/supplier'
import { Bone } from '../components/Skeleton'
import { BID_LABELS, PO_KINDS, fmtDay, fromNow, money, perUnit, qty } from '../lib/procurement'
import { Pill, accent, outline } from './ui'

const TABS = [['open', 'Open opportunities', Megaphone], ['bids', 'My bids', Gavel], ['requests', 'Requests for information', MessageCircleQuestion], ['awarded', 'Awarded', Award], ['orders', 'Purchase orders', FileSignature]]
const GROUPS = [['all', 'All'], ['progress', 'In progress'], ['won', 'Successful'], ['lost', 'Unsuccessful'], ['withdrawn', 'Withdrawn']]
const inGroup = (b, g) => g === 'all' || (g === 'progress' ? ['open', 'under_review', 'shortlisted'].includes(b.status) : g === 'won' ? b.status === 'awarded' : g === 'lost' ? b.status === 'not_selected' : b.status === 'withdrawn')
const Card = ({ className = '', ...p }) => <div {...p} className={`bg-card border border-border rounded-2xl ${className}`} />
const Empty = ({ icon: Icon, title, children }) => <Card className="p-10 text-center"><Icon className="w-8 h-8 text-accent mx-auto mb-3" /><p className="font-semibold text-foreground">{title}</p><p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">{children}</p></Card>

export default function SupplierDashboard() {
  const { me, refresh } = useSupplier()
  const [sp, setSp] = useSearchParams()
  const tab = TABS.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : null
  const [bids, setBids] = useState(null)
  const [orders, setOrders] = useState(null)
  const [tenders, setTenders] = useState(null)
  const [group, setGroup] = useState('all')
  const [err, setErr] = useState(null)

  useEffect(() => {
    supplierFetch('/supplier/bids').then(setBids).catch(e => setErr(e.message))
    supplierFetch('/supplier/orders').then(setOrders).catch(() => setOrders([]))
    fetchJson('/tenders').then(setTenders).catch(() => setTenders([]))
    refresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const open = useMemo(() => (tenders || []).filter(t => ['open', 'upcoming'].includes(t.state)), [tenders])
  const mine = number => (bids || []).find(b => b.tender?.number === number && b.status !== 'withdrawn')
  const asked = useMemo(() => (bids || []).filter(b => b.requests_open > 0), [bids])
  const won = useMemo(() => (bids || []).filter(b => b.status === 'awarded'), [bids])
  const c = me.counts || {}
  // Land on what needs attention first.
  const active = tab || (asked.length ? 'requests' : bids?.length ? 'bids' : 'open')
  const setTab = k => { const n = new URLSearchParams(sp); n.set('tab', k); setSp(n, { replace: true }) }
  const count = { open: open.length, bids: bids?.length, requests: asked.length, awarded: won.length, orders: orders?.length }

  return (
    <>
      {err && <p className="mb-4 text-sm text-destructive" role="alert">{err}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[['Bids in progress', c.live ?? 0, 'bids'], ['Awaiting your answer', c.requests_open ?? 0, 'requests'], ['Awarded', c.awarded ?? 0, 'awarded'], ['Orders to acknowledge', c.orders_open ?? 0, 'orders']].map(([label, n, k]) => (
          <button key={label} type="button" onClick={() => setTab(k)} className={`text-left bg-card border rounded-2xl px-5 py-4 hover:shadow-card transition-shadow ${n > 0 && ['requests', 'orders'].includes(k) ? 'border-accent/50' : 'border-border'}`}>
            <p className="text-3xl font-bold tabular-nums text-foreground">{n}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border mb-6" role="tablist">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={active === k} type="button" onClick={() => setTab(k)} className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${active === k ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="w-4 h-4" />{l}{count[k] > 0 && <span className={`ml-0.5 text-[11px] px-1.5 py-0.5 rounded-full ${k === 'requests' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{count[k]}</span>}
            {active === k && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {active === 'open' && (!tenders ? <Bone className="h-40 w-full rounded-2xl" /> : !open.length ? <Empty icon={Megaphone} title="No open opportunities right now">New supply opportunities are published as we need them. Check back soon.</Empty> : (
        <ul className="grid md:grid-cols-2 gap-5">
          {open.map(t => { const b = mine(t.number); return (
            <li key={t.number}><Card className="p-6 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.number}</p><h2 className="font-semibold text-lg text-foreground mt-0.5">{t.title}</h2></div>
                {b ? <Pill status={b.status}>You bid · {BID_LABELS[b.status]}</Pill> : <Pill status={t.state === 'open' ? 'shortlisted' : 'under_review'}>{t.state === 'open' ? 'Open' : 'Opens soon'}</Pill>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm flex-1">
                <div><dt className="text-xs text-muted-foreground">Quantity</dt><dd className="font-medium tabular-nums">{qty(t.quantity, t.unit)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Asking price</dt><dd className="font-medium tabular-nums">{perUnit(t.asking_price, t.currency, t.unit)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Delivery</dt><dd className="font-medium">{t.delivery_location || '—'}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t.state === 'open' ? 'Bids close' : 'Bids open'}</dt><dd className="font-medium">{fmtDay(t.state === 'open' ? t.closes_at : t.opens_at)} <span className="text-xs font-normal text-muted-foreground">({fromNow(t.state === 'open' ? t.closes_at : t.opens_at)})</span></dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                {b ? <Link to={`/supplier/bids/${b.id}`} className={outline}>Open my bid</Link> : t.state === 'open' ? <Link to={`/bidding/${t.number}#bid`} className={accent}>Submit bid<ArrowRight className="w-4 h-4" /></Link> : null}
                <Link to={`/bidding/${t.number}`} className={`${outline} border-transparent bg-transparent`}>View details</Link>
              </div>
            </Card></li>
          ) })}
        </ul>
      ))}

      {active === 'bids' && (!bids ? <Bone className="h-40 w-full rounded-2xl" /> : !bids.length ? <Empty icon={Gavel} title="You have not submitted a bid yet">Choose an open opportunity and submit your bid; it appears here with its status.</Empty> : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">{GROUPS.map(([k, l]) => { const n = bids.filter(b => inGroup(b, k)).length; return <button key={k} type="button" onClick={() => setGroup(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${group === k ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>{l}{n > 0 && k !== 'all' ? ` ${n}` : ''}</button> })}</div>
          <BidList bids={bids.filter(b => inGroup(b, group))} empty="No bid in this group." />
        </>
      ))}

      {active === 'requests' && (!bids ? <Bone className="h-40 w-full rounded-2xl" /> : !asked.length ? <Empty icon={MessageCircleQuestion} title="Nothing to answer">When our procurement team needs more information about one of your bids, the request appears here and we email you.</Empty> : <BidList bids={asked} showRequests />)}

      {active === 'awarded' && (!bids ? <Bone className="h-40 w-full rounded-2xl" /> : !won.length ? <Empty icon={Award} title="No awarded supply opportunities yet">Bids that we select appear here, together with the purchase order once we send it.</Empty> : <BidList bids={won} showOrders />)}

      {active === 'orders' && (!orders ? <Bone className="h-40 w-full rounded-2xl" /> : !orders.length ? <Empty icon={FileSignature} title="No purchase orders yet">When we issue you a PO or LPO it is listed here, with its PDF and the button to acknowledge it.</Empty> : (
        <Card><ul className="divide-y divide-border">
          {orders.map(o => (
            <li key={o.number}><Link to={`/po/${o.token}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-sm hover:bg-muted/40">
              <span className="min-w-[10rem]"><span className="font-semibold text-foreground">{o.number}</span><span className="block text-xs text-muted-foreground">{PO_KINDS[o.kind]}</span></span>
              <span className="flex-1 min-w-[10rem] text-muted-foreground truncate">{o.title || '—'}</span>
              <span className="font-medium tabular-nums">{money(o.total, o.currency)}</span>
              <span className="text-xs text-muted-foreground">{o.delivery_date ? `deliver by ${fmtDay(o.delivery_date)}` : `issued ${fmtDay(o.issued_at)}`}</span>
              <Pill status={o.status}>{o.status === 'issued' ? 'To acknowledge' : o.status}</Pill>
            </Link></li>
          ))}
        </ul></Card>
      ))}
    </>
  )
}

function BidList({ bids, empty = 'Nothing here.', showRequests = false, showOrders = false }) {
  if (!bids.length) return <p className="text-sm text-muted-foreground py-8 text-center">{empty}</p>
  return (
    <Card><ul className="divide-y divide-border">
      {bids.map(b => (
        <li key={b.id}><Link to={`/supplier/bids/${b.id}`} className="block px-5 py-4 hover:bg-muted/40">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex-1 min-w-[12rem]"><span className="font-semibold text-foreground">{b.tender?.title || `Bid #${b.id}`}</span><span className="block text-xs text-muted-foreground">{b.tender?.number} · submitted {fmtDay(b.created_at)}</span></span>
            <span className="tabular-nums">{qty(b.quantity, b.unit)}</span>
            <span className="font-medium tabular-nums">{perUnit(b.price, b.currency, b.unit)}</span>
            <Pill status={b.status}>{BID_LABELS[b.status]}</Pill>
          </div>
          {showRequests && <p className="mt-2 text-xs font-semibold text-accent flex items-center gap-1.5"><MessageCircleQuestion className="w-3.5 h-3.5" />{b.requests_open} request{b.requests_open === 1 ? '' : 's'} waiting for your answer</p>}
          {!showRequests && b.requests_open > 0 && <p className="mt-2 text-xs text-accent flex items-center gap-1.5"><MessageCircleQuestion className="w-3.5 h-3.5" />We asked for more information</p>}
          {b.status_note && <p className="mt-2 text-xs text-muted-foreground">“{b.status_note}”</p>}
          {showOrders && (b.orders?.length ? <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5"><FileSignature className="w-3.5 h-3.5" />{b.orders.map(o => `${o.number} (${o.status === 'issued' ? 'to acknowledge' : o.status})`).join(' · ')}</p> : <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" />Our purchase order follows.</p>)}
        </Link></li>
      ))}
    </ul></Card>
  )
}
