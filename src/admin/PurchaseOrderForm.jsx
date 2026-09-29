/*
 * A purchase order (PO) or local purchase order (LPO): what procurement
 * issues to a supplier, as sales issues an invoice to a client. Built from
 * an awarded bid or from scratch; sent as a PDF with a link on which the
 * supplier acknowledges it.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Copy, Eye, Plus, Send, Trash2 } from 'lucide-react'
import { adminFetch, adminFetchBlob } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea, confirmDelete, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import Composer from './Composer'
import { fmtDateTime, messageTone, openInNewTab } from './format'
import { DraftNotice, useDraft } from './useDraft'
import { PO_KINDS, PO_SHORT, PO_STATUSES, fmtMoment, money, poTone } from '../lib/procurement'

const round = v => Math.round((Number(v) || 0) * 100) / 100
const blank = () => ({ description: '', quantity: 1, unit: 'MT', unit_price: '' })
const totalsOf = (items, discount, tax_rate) => {
  const subtotal = round(items.reduce((s, it) => s + round((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)), 0))
  const taxable = Math.max(subtotal - round(discount), 0)
  const tax = round(taxable * (Number(tax_rate) || 0) / 100)
  return { subtotal, tax, total: round(taxable + tax) }
}

export default function PurchaseOrderForm() {
  const { id } = useParams(); const editing = Boolean(id)
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [order, setOrder] = useState(null)
  const [suppliers, setSuppliers] = useState(null)
  const [settings, setSettings] = useState(null)
  const initial = { kind: 'lpo', number: '', supplier_id: sp.get('supplier') || '', supplier_name: '', supplier_email: '', supplier_address: '', title: '', currency: '', delivery_location: '', delivery_date: '', payment_terms: '', discount: 0, tax_rate: 0, notes: '', terms: '', internal_notes: '' }
  const [draft, setDraft, draftInfo] = useDraft('order:new', null, { enabled: !editing })
  const [form, setForm] = useState(() => (!editing && draft?.form) ? { ...initial, ...draft.form, ...(sp.get('supplier') ? { supplier_id: sp.get('supplier') } : {}) } : initial)
  const [items, setItems] = useState(() => (!editing && draft?.items?.length) ? draft.items : [blank()])
  useEffect(() => { if (!editing) setDraft({ form, items }) }, [form, items, editing]) // eslint-disable-line react-hooks/exhaustive-deps
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [compose, setCompose] = useState(false)
  const [toast, toastEl] = useToast()

  const fill = o => {
    setForm({ kind: o.kind, number: (String(o.number || '').match(/-(\d+)$/) || [])[1] || '', supplier_id: o.supplier_id ?? '', supplier_name: o.supplier_name, supplier_email: o.supplier_email, supplier_address: o.supplier_address, title: o.title, currency: o.currency,
      delivery_location: o.delivery_location, delivery_date: o.delivery_date || '', payment_terms: o.payment_terms, discount: o.discount, tax_rate: o.tax_rate, notes: o.notes, terms: o.terms, internal_notes: o.internal_notes })
    setItems(o.items?.length ? o.items : [blank()]); setDirty(false)
  }
  const load = () => adminFetch(`/purchase-orders/${id}`).then(o => { setOrder(o); fill(o) }).catch(e => setErr(e.message))
  useEffect(() => {
    adminFetch('/suppliers?status=active').then(setSuppliers).catch(() => setSuppliers([]))
    adminFetch('/settings').then(setSettings).catch(() => setSettings({ procurement: {} }))
    if (editing) load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Defaults for a new order come from Settings → Procurement.
  useEffect(() => {
    if (editing || !settings?.procurement) return
    const p = settings.procurement
    setForm(f => ({ ...f, currency: f.currency || p.default_currency || 'NGN', terms: f.terms || p.po_terms || '', notes: f.notes || p.po_notes || '', payment_terms: f.payment_terms || p.payment_terms || '' }))
  }, [settings, editing])
  // A supplier chosen before the form opened (from their page): copy their details.
  useEffect(() => {
    if (editing || !suppliers || !form.supplier_id || form.supplier_name) return
    const s = suppliers.find(x => String(x.id) === String(form.supplier_id))
    if (s) setForm(f => ({ ...f, supplier_name: s.company_name, supplier_email: s.email || '', supplier_address: s.address || '' }))
  }, [suppliers, editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = patch => { setForm(f => ({ ...f, ...patch })); setDirty(true) }
  const setItem = (i, patch) => { setItems(list => list.map((it, j) => (j === i ? { ...it, ...patch } : it))); setDirty(true) }
  const pickSupplier = sid => {
    const s = suppliers?.find(x => String(x.id) === String(sid))
    set({ supplier_id: sid, ...(s ? { supplier_name: s.company_name, supplier_email: s.email || form.supplier_email, supplier_address: s.address || form.supplier_address } : {}) })
  }
  const totals = useMemo(() => totalsOf(items, form.discount, form.tax_rate), [items, form.discount, form.tax_rate])
  const locked = ['acknowledged', 'fulfilled'].includes(order?.status)

  const save = async () => {
    setErr(null); setBusy(true)
    const all = { ...form, supplier_id: form.supplier_id || null, delivery_date: form.delivery_date || null, items: items.filter(it => String(it.description).trim()) }
    // A locked order accepts everything except its items and prices.
    const { items: _i, discount: _d, tax_rate: _t, currency: _c, kind: _k, number: _n, ...rest } = all
    try {
      if (editing) { const o = await adminFetch(`/purchase-orders/${id}`, { method: 'PATCH', body: locked ? rest : all }); setOrder(x => ({ ...x, ...o })); fill(o); toast('Saved'); return o }
      const o = await adminFetch('/purchase-orders', { method: 'POST', body: all }); draftInfo.clear(); nav(`/staff360/purchase-orders/${o.id}`, { replace: true }); return o
    } catch (x) { setErr(x.message); throw x } finally { setBusy(false) }
  }
  const submit = e => { e.preventDefault(); save().catch(() => {}) }
  const preview = () => openInNewTab(adminFetchBlob(`/purchase-orders/${id}/pdf`).then(b => URL.createObjectURL(b))).catch(x => toast(x.message, 'error'))
  const openSend = async () => { try { if (dirty) await save(); setCompose(true) } catch { /* shown */ } }
  const copyLink = () => navigator.clipboard.writeText(order.link).then(() => toast('Link copied')).catch(() => toast(order.link))
  const setStatus = async status => { try { const o = await adminFetch(`/purchase-orders/${id}`, { method: 'PATCH', body: { status } }); setOrder(x => ({ ...x, ...o })); toast('Status updated') } catch (x) { toast(x.message, 'error') } }
  const remove = async () => { if (!confirmDelete(order.number)) return; try { await adminFetch(`/purchase-orders/${id}`, { method: 'DELETE' }); nav('/staff360/purchase-orders') } catch (x) { toast(x.message, 'error') } }

  const loading = !suppliers || !settings || (editing && !order)
  const cur = form.currency || 'NGN'
  const year = (editing && order?.number?.match(/-(\d{4})-/)?.[1]) || new Date().getFullYear()

  return (
    <>
      <Link to="/staff360/purchase-orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Purchase orders</Link>
      <PageHeader eyebrow="Procurement" title={editing ? (order?.number || ' ') : 'New purchase order'}
        description={editing && order ? `${PO_KINDS[order.kind]}${order.title ? ` · ${order.title}` : ''}` : 'Build the order, then email it as a PDF with a link the supplier acknowledges it on.'}
        action={editing && order && <Badge tone={poTone(order.status)}>{order.status}</Badge>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!editing && <DraftNotice draft={draftInfo} onDiscard={() => { draftInfo.clear(); setForm(initial); setItems([blank()]); setDirty(false) }} />}
      {locked && <div className="mb-4"><Alert tone="info">The supplier has acknowledged this order, so its items and prices are locked. Raise a new order for changes.</Alert></div>}
      {editing && order?.tender && <div className="mb-4"><Alert tone="info">Raised from the awarded bid on <Link to={`/staff360/tenders/${order.tender.id}`} className="font-semibold text-accent">{order.tender.number}</Link>{order.bid_id && <> · <Link to={`/staff360/bids/${order.bid_id}`} className="font-semibold text-accent">open the bid</Link></>}.</Alert></div>}

      {loading ? (
        <div className="grid lg:grid-cols-[1fr_340px] gap-6"><Card className="p-6 space-y-4">{[...Array(6)].map((_, i) => <Bone key={i} className="h-11 w-full" />)}</Card><Card className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Bone key={i} className="h-10 w-full" />)}</Card></div>
      ) : (
        <form onSubmit={submit} className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <Card className="p-6 grid md:grid-cols-2 gap-5 animate-fade-up">
              <Field label="Type" hint="An LPO is for a supplier in Nigeria; a PO for anyone else.">
                <Select value={form.kind} disabled={editing && order.status !== 'draft'} onChange={e => set({ kind: e.target.value, number: '' })}>{Object.entries(PO_KINDS).map(([k, l]) => <option key={k} value={k}>{PO_SHORT[k]} — {l}</option>)}</Select>
              </Field>
              <Field label="Order number" hint={editing ? 'Change only the digits if you need to.' : 'Leave empty for the next free number.'}>
                <div className="flex"><span className="inline-flex items-center h-11 px-3 rounded-l-xl border border-r-0 border-border bg-muted text-sm font-medium text-muted-foreground whitespace-nowrap">{PO_SHORT[form.kind]}-{year}-</span><Input className="rounded-l-none" inputMode="numeric" maxLength={6} placeholder={editing && form.kind === order.kind ? '' : 'auto'} disabled={locked} value={form.number} onChange={e => set({ number: e.target.value.replace(/\D/g, '') })} /></div>
              </Field>
              <Field label="Supplier" hint="Choose a supplier record, or type who the order is for below." className="md:col-span-2">
                <Select value={form.supplier_id} onChange={e => pickSupplier(e.target.value)}>
                  <option value="">Not linked to a supplier record</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  {order?.supplier_id && !suppliers.some(s => s.id === order.supplier_id) && <option value={order.supplier_id}>{order.supplier_name}</option>}
                </Select>
              </Field>
              <Field label="Supplier name *"><Input required value={form.supplier_name} onChange={e => set({ supplier_name: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={form.supplier_email} onChange={e => set({ supplier_email: e.target.value })} placeholder="Where the order is sent" /></Field>
              <Field label="Supplier address" className="md:col-span-2"><Textarea rows={2} className="min-h-[72px]" value={form.supplier_address} onChange={e => set({ supplier_address: e.target.value })} /></Field>
              <Field label="Title" className="md:col-span-2"><Input value={form.title} onChange={e => set({ title: e.target.value })} placeholder='e.g. "Soybeans, 400 MT, delivered Ibadan"' /></Field>
            </Card>

            <Card className="p-6 animate-fade-up" style={{ animationDelay: '70ms' }}>
              <h2 className="font-semibold mb-4">Line items</h2>
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-[1fr_96px_64px_130px_minmax(150px,auto)_36px] gap-2 text-[11px] uppercase tracking-wider text-muted-foreground px-1"><span>Description</span><span>Qty</span><span>Unit</span><span>Unit price</span><span className="text-right">Amount</span><span /></div>
                {items.map((it, i) => (
                  <div key={i} className="grid md:grid-cols-[1fr_96px_64px_130px_minmax(150px,auto)_36px] gap-2 items-center">
                    <Input disabled={locked} value={it.description} onChange={e => setItem(i, { description: e.target.value })} placeholder="Commodity, grade, packaging…" />
                    <Input disabled={locked} type="number" min="0" step="0.001" value={it.quantity} onChange={e => setItem(i, { quantity: e.target.value })} />
                    <Input disabled={locked} value={it.unit} onChange={e => setItem(i, { unit: e.target.value })} placeholder="MT" />
                    <Input disabled={locked} type="number" min="0" step="0.01" value={it.unit_price} onChange={e => setItem(i, { unit_price: e.target.value })} placeholder="0.00" />
                    <div className="h-11 flex items-center justify-end text-sm font-medium tabular-nums whitespace-nowrap">{money((Number(it.quantity) || 0) * (Number(it.unit_price) || 0), cur)}</div>
                    <button type="button" disabled={locked || items.length === 1} onClick={() => { setItems(l => l.filter((_, j) => j !== i)); setDirty(true) }} className="h-9 w-9 rounded-lg text-destructive hover:bg-muted disabled:opacity-30 flex items-center justify-center" aria-label="Remove line"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              {!locked && <Button type="button" variant="outline" className="mt-4 h-9" onClick={() => { setItems(l => [...l, blank()]); setDirty(true) }}><Plus className="w-4 h-4" />Add line</Button>}
              <div className="mt-6 grid md:grid-cols-[1fr_280px] gap-5">
                <div className="grid grid-cols-3 gap-4 content-start">
                  <Field label="Currency"><Input maxLength={3} disabled={locked} value={form.currency} onChange={e => set({ currency: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Discount" hint="Amount, not %"><Input disabled={locked} type="number" min="0" step="0.01" value={form.discount} onChange={e => set({ discount: e.target.value })} /></Field>
                  <Field label="Tax rate %"><Input disabled={locked} type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={e => set({ tax_rate: e.target.value })} /></Field>
                </div>
                <dl className="rounded-xl bg-muted/50 p-4 text-sm space-y-2 tabular-nums">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(totals.subtotal, cur)}</dd></div>
                  {Number(form.discount) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>− {money(form.discount, cur)}</dd></div>}
                  {Number(form.tax_rate) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({form.tax_rate}%)</dt><dd>{money(totals.tax, cur)}</dd></div>}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>Total</dt><dd className="text-primary">{money(totals.total, cur)}</dd></div>
                </dl>
              </div>
            </Card>

            <Card className="p-6 grid md:grid-cols-2 gap-5 animate-fade-up" style={{ animationDelay: '140ms' }}>
              <Field label="Deliver to"><Input value={form.delivery_location} onChange={e => set({ delivery_location: e.target.value })} placeholder="Ibadan, Oyo State" /></Field>
              <Field label="Deliver by"><Input type="date" value={form.delivery_date} onChange={e => set({ delivery_date: e.target.value })} /></Field>
              <Field label="Payment terms" className="md:col-span-2"><Textarea rows={2} className="min-h-[72px]" value={form.payment_terms} onChange={e => set({ payment_terms: e.target.value })} /></Field>
              <Field label="Notes to the supplier" hint="Printed on the order."><Textarea rows={3} value={form.notes} onChange={e => set({ notes: e.target.value })} /></Field>
              <Field label="Terms" hint="Printed on the order. Defaults come from Settings → Procurement."><Textarea rows={3} value={form.terms} onChange={e => set({ terms: e.target.value })} /></Field>
              <Field label="Internal notes" hint="Only your team sees these." className="md:col-span-2"><Textarea rows={2} className="min-h-[72px]" value={form.internal_notes} onChange={e => set({ internal_notes: e.target.value })} /></Field>
            </Card>
          </div>

          <div className="space-y-5 lg:sticky lg:top-24">
            <Card className="p-5 space-y-3 animate-fade-up" style={{ animationDelay: '100ms' }}>
              <Button type="submit" variant="accent" className="w-full" disabled={busy}>{busy ? 'Saving…' : editing ? (dirty ? 'Save changes' : 'Saved') : 'Create order'}</Button>
              {editing && (
                <>
                  <Button type="button" variant="primary" className="w-full" onClick={openSend} disabled={busy || ['acknowledged', 'fulfilled', 'cancelled'].includes(order.status)}><Send className="w-4 h-4" />{order.status === 'draft' ? 'Send to supplier' : 'Send again'}</Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={preview}><Eye className="w-4 h-4" />PDF</Button>
                    <Button type="button" variant="outline" onClick={copyLink} disabled={order.status === 'draft'} title={order.status === 'draft' ? 'The supplier can acknowledge it once it is issued' : order.link}><Copy className="w-4 h-4" />Link</Button>
                  </div>
                </>
              )}
            </Card>
            {editing && (
              <Card className="p-5 animate-fade-up" style={{ animationDelay: '170ms' }}>
                <Field label="Status" hint="Set by hand if the supplier answers by phone or on paper.">
                  <Select value={order.status} onChange={e => setStatus(e.target.value)}>{PO_STATUSES.map(s => <option key={s}>{s}</option>)}</Select>
                </Field>
                <dl className="mt-4 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex justify-between"><dt>Created</dt><dd>{fmtMoment(order.created_at)}</dd></div>
                  {order.issued_at && <div className="flex justify-between"><dt>Issued</dt><dd>{fmtMoment(order.issued_at)}</dd></div>}
                  {order.viewed_at && <div className="flex justify-between"><dt>Opened by the supplier</dt><dd>{fmtMoment(order.viewed_at)}</dd></div>}
                  {order.responded_at && <div className="flex justify-between"><dt className="capitalize">{['acknowledged', 'declined'].includes(order.status) ? order.status : 'Answered'}</dt><dd>{fmtMoment(order.responded_at)}</dd></div>}
                </dl>
                {order.response_note && <p className="mt-3 rounded-xl bg-muted/60 p-3 text-xs"><span className="font-semibold">Supplier's note: </span>{order.response_note}</p>}
              </Card>
            )}
            {editing && (
              <Card className="animate-fade-up" style={{ animationDelay: '240ms' }}>
                <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Emails for this order</h2></div>
                <ul className="divide-y divide-border">
                  {order.messages?.map(m => (
                    <li key={m.id}><Link to={`/staff360/procurement/messages/${m.id}`} className="px-5 py-3 text-xs flex items-center gap-2 hover:bg-muted/40">
                      <span className="truncate flex-1"><span className="font-medium">{m.direction === 'in' ? m.from_email : m.to_email}</span> · {fmtDateTime(m.created_at)}{m.status === 'failed' && <span className="block text-destructive">{m.error}</span>}</span>
                      <Badge tone={messageTone(m.status)}>{m.status}</Badge>
                    </Link></li>
                  ))}
                  {!order.messages?.length && <li className="px-5 py-6 text-center text-xs text-muted-foreground">Not sent yet.</li>}
                </ul>
                <div className="px-5 py-3 border-t border-border"><Button type="button" variant="ghost" className="h-8 px-2 text-xs text-destructive" onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete order</Button></div>
              </Card>
            )}
          </div>
        </form>
      )}

      {editing && order && (
        <Composer open={compose} onClose={() => setCompose(false)} title={`Send ${order.number}`} sendOrderId={order.id} scope="procurement" supplierId={order.supplier_id} poId={order.id}
          to={form.supplier_email} template={{ key: 'purchase_order', po_id: order.id }} onSent={() => { toast('Order sent'); load() }} />
      )}
      {toastEl}
    </>
  )
}
