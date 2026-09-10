import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Copy, Eye, Plus, Send, ShoppingBag, Trash2 } from 'lucide-react'
import { adminFetch, adminFetchBlob } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea, confirmDelete, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import DynamicField from './DynamicField'
import Composer from './Composer'
import { QUOTE_STATUSES, fmtDateTime, fmtMoney, messageTone, openInNewTab, quoteTone } from './format'

const money = v => Math.round((Number(v) || 0) * 100) / 100
const blank = () => ({ description: '', quantity: 1, unit: 'MT', unit_price: '' })
const totalsOf = (items, discount, tax_rate) => {
  const subtotal = money(items.reduce((s, it) => s + money((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)), 0))
  const taxable = Math.max(subtotal - money(discount), 0)
  const tax = money(taxable * (Number(tax_rate) || 0) / 100)
  return { subtotal, tax, total: money(taxable + tax) }
}

export default function QuoteForm() {
  const { id } = useParams(); const editing = Boolean(id)
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [quote, setQuote] = useState(null)
  const [clients, setClients] = useState(null)
  const [fields, setFields] = useState(null)
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({ client_id: sp.get('client') || '', client_name: '', client_email: '', title: '', currency: '', valid_until: '', discount: 0, tax_rate: 0, notes: '', terms: '', internal_notes: '', data: {} })
  const [items, setItems] = useState([blank()])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [compose, setCompose] = useState(false)
  const [toast, toastEl] = useToast()

  useEffect(() => {
    adminFetch('/clients?status=active').then(setClients).catch(() => setClients([]))
    adminFetch('/quote-fields').then(setFields).catch(e => setErr(e.message))
    adminFetch('/settings').then(setSettings).catch(() => setSettings({ quotes: {}, company: {} }))
    if (editing) load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Defaults for a new quote come from Settings → Quotes.
  useEffect(() => {
    if (editing || !settings?.quotes) return
    setForm(f => ({ ...f, currency: f.currency || settings.quotes.default_currency || 'USD', terms: f.terms || settings.quotes.terms || '' }))
  }, [settings, editing])
  // Pre-selected client (from the client hub): copy name and email.
  useEffect(() => {
    if (editing || !clients || !form.client_id || form.client_name) return
    const c = clients.find(x => String(x.id) === String(form.client_id))
    if (c) setForm(f => ({ ...f, client_name: c.name, client_email: c.data?.email || '' }))
  }, [clients, editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = () => adminFetch(`/quotes/${id}`).then(q => {
    setQuote(q)
    setForm({ client_id: q.client_id ?? '', client_name: q.client_name, client_email: q.client_email, title: q.title, currency: q.currency, valid_until: q.valid_until || '', discount: q.discount, tax_rate: q.tax_rate, notes: q.notes, terms: q.terms, internal_notes: q.internal_notes, data: q.data || {} })
    setItems(q.items?.length ? q.items : [blank()]); setDirty(false)
  }).catch(e => setErr(e.message))

  const set = patch => { setForm(f => ({ ...f, ...patch })); setDirty(true) }
  const setItem = (i, patch) => { setItems(list => list.map((it, j) => j === i ? { ...it, ...patch } : it)); setDirty(true) }
  const pickClient = cid => {
    const c = clients?.find(x => String(x.id) === String(cid))
    set({ client_id: cid, ...(c ? { client_name: c.name, client_email: c.data?.email || form.client_email } : {}) })
  }
  const totals = useMemo(() => totalsOf(items, form.discount, form.tax_rate), [items, form.discount, form.tax_rate])
  const locked = quote?.status === 'accepted'

  const save = async () => {
    setErr(null); setBusy(true)
    const body = { ...form, client_id: form.client_id || null, items: items.filter(it => it.description.trim()) }
    try {
      if (editing) { const q = await adminFetch(`/quotes/${id}`, { method: 'PATCH', body }); setQuote(x => ({ ...x, ...q })); setDirty(false); toast('Saved'); return q }
      const q = await adminFetch('/quotes', { method: 'POST', body }); nav(`/admin/quotes/${q.id}`, { replace: true }); return q
    } catch (x) { setErr(x.message); throw x } finally { setBusy(false) }
  }
  const submit = e => { e.preventDefault(); save().catch(() => {}) }
  const preview = () => openInNewTab(adminFetchBlob(`/quotes/${id}/pdf`).then(b => URL.createObjectURL(b))).catch(x => toast(x.message, 'error'))
  const openSend = async () => { try { if (dirty) await save(); setCompose(true) } catch { /* shown */ } }
  const copyLink = () => navigator.clipboard.writeText(quote.link).then(() => toast('Link copied')).catch(() => toast(quote.link))
  const setStatus = async status => { try { const q = await adminFetch(`/quotes/${id}`, { method: 'PATCH', body: { status } }); setQuote(x => ({ ...x, ...q })); toast('Status updated') } catch (x) { toast(x.message, 'error') } }
  const convert = async () => {
    try { const p = await adminFetch(`/quotes/${id}/convert`, { method: 'POST' }); toast(`Purchase #${p.id} recorded`); if (quote.client_id) nav(`/admin/clients/${quote.client_id}?tab=purchases`) }
    catch (x) { toast(x.message, 'error') }
  }
  const remove = async () => { if (!confirmDelete(quote.number)) return; try { await adminFetch(`/quotes/${id}`, { method: 'DELETE' }); nav('/admin/quotes') } catch (x) { toast(x.message, 'error') } }

  const loading = !fields || !clients || (editing && !quote)
  const cur = form.currency || 'USD'

  return (
    <>
      <Link to="/admin/quotes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Quotes</Link>
      <PageHeader eyebrow="Sales" title={editing ? (quote?.number || ' ') : 'New quote'}
        description={editing && quote ? (quote.title || 'Untitled quotation') : 'Build a priced quotation, then email it as a PDF with a unique link the client can accept online.'}
        action={editing && quote && <Badge tone={quoteTone(quote.status)}>{quote.status}</Badge>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {locked && <div className="mb-4"><Alert tone="info">This quote was accepted by the client, so prices and items are locked. Create a new quote for changes.</Alert></div>}

      {loading ? (
        <div className="grid lg:grid-cols-[1fr_340px] gap-6"><Card className="p-6 space-y-4">{[...Array(6)].map((_, i) => <Bone key={i} className="h-11 w-full" />)}</Card><Card className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Bone key={i} className="h-10 w-full" />)}</Card></div>
      ) : (
        <form onSubmit={submit} className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <Card className="p-6 grid md:grid-cols-2 gap-5 animate-fade-up">
              <Field label="Client" hint="Optional — link to a client record" className="md:col-span-2">
                <Select value={form.client_id} onChange={e => pickClient(e.target.value)}>
                  <option value="">No linked client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Prepared for *"><Input required value={form.client_name} onChange={e => set({ client_name: e.target.value })} placeholder="Company or person" /></Field>
              <Field label="Email"><Input type="email" value={form.client_email} onChange={e => set({ client_email: e.target.value })} placeholder="Where the quote is sent" /></Field>
              <Field label="Title" className="md:col-span-2"><Input value={form.title} onChange={e => set({ title: e.target.value })} placeholder='e.g. "Cocoa beans, 20 MT, CIF Rotterdam"' /></Field>
              <Field label="Currency"><Input maxLength={3} disabled={locked} value={form.currency} onChange={e => set({ currency: e.target.value.toUpperCase() })} /></Field>
              <Field label="Valid until"><Input type="date" value={form.valid_until} onChange={e => set({ valid_until: e.target.value })} /></Field>
            </Card>

            <Card className="p-6 animate-fade-up" style={{ animationDelay: '70ms' }}>
              <h2 className="font-semibold mb-4">Line items</h2>
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-[1fr_88px_72px_120px_120px_36px] gap-2 text-[11px] uppercase tracking-wider text-muted-foreground px-1"><span>Description</span><span>Qty</span><span>Unit</span><span>Unit price</span><span className="text-right">Amount</span><span /></div>
                {items.map((it, i) => (
                  <div key={i} className="grid md:grid-cols-[1fr_88px_72px_120px_120px_36px] gap-2 items-center">
                    <Input disabled={locked} value={it.description} onChange={e => setItem(i, { description: e.target.value })} placeholder="Product, grade, packaging…" />
                    <Input disabled={locked} type="number" min="0" step="0.001" value={it.quantity} onChange={e => setItem(i, { quantity: e.target.value })} />
                    <Input disabled={locked} value={it.unit} onChange={e => setItem(i, { unit: e.target.value })} placeholder="MT" />
                    <Input disabled={locked} type="number" min="0" step="0.01" value={it.unit_price} onChange={e => setItem(i, { unit_price: e.target.value })} placeholder="0.00" />
                    <div className="h-11 flex items-center justify-end text-sm font-medium tabular-nums">{fmtMoney((Number(it.quantity) || 0) * (Number(it.unit_price) || 0), cur)}</div>
                    <button type="button" disabled={locked || items.length === 1} onClick={() => { setItems(l => l.filter((_, j) => j !== i)); setDirty(true) }} className="h-9 w-9 rounded-lg text-destructive hover:bg-muted disabled:opacity-30 flex items-center justify-center" aria-label="Remove line"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              {!locked && <Button type="button" variant="outline" className="mt-4 h-9" onClick={() => { setItems(l => [...l, blank()]); setDirty(true) }}><Plus className="w-4 h-4" />Add line</Button>}

              <div className="mt-6 grid md:grid-cols-[1fr_280px] gap-5">
                <div className="grid grid-cols-2 gap-4 content-start">
                  <Field label="Discount" hint="Amount, not %"><Input disabled={locked} type="number" min="0" step="0.01" value={form.discount} onChange={e => set({ discount: e.target.value })} /></Field>
                  <Field label="Tax rate %"><Input disabled={locked} type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={e => set({ tax_rate: e.target.value })} /></Field>
                </div>
                <dl className="rounded-xl bg-muted/50 p-4 text-sm space-y-2 tabular-nums">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{fmtMoney(totals.subtotal, cur)}</dd></div>
                  {Number(form.discount) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>− {fmtMoney(form.discount, cur)}</dd></div>}
                  {Number(form.tax_rate) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({form.tax_rate}%)</dt><dd>{fmtMoney(totals.tax, cur)}</dd></div>}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>Total</dt><dd className="text-primary">{fmtMoney(totals.total, cur)}</dd></div>
                </dl>
              </div>
            </Card>

            <Card className="p-6 animate-fade-up" style={{ animationDelay: '140ms' }}>
              <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Details</h2><Link to="/admin/quotes/fields" className="text-xs font-semibold text-accent">Manage fields</Link></div>
              {fields.length ? (
                <div className="grid md:grid-cols-2 gap-5">
                  {fields.map(f => <DynamicField key={f.key} field={f} value={form.data[f.key]} scope={{ quote_id: quote?.id, client_id: form.client_id || undefined }} onChange={v => set({ data: { ...form.data, [f.key]: v } })} />)}
                </div>
              ) : <p className="text-sm text-muted-foreground">No quote fields yet — add Incoterm, port of loading, payment terms and anything else you need.</p>}
            </Card>

            <Card className="p-6 grid gap-5 animate-fade-up" style={{ animationDelay: '210ms' }}>
              <Field label="Notes to the client" hint="Printed on the quote."><Textarea rows={3} value={form.notes} onChange={e => set({ notes: e.target.value })} /></Field>
              <Field label="Terms" hint="Printed on the quote. Defaults come from Settings → Quotes."><Textarea rows={3} value={form.terms} onChange={e => set({ terms: e.target.value })} /></Field>
              <Field label="Internal notes" hint="Only your team sees these."><Textarea rows={3} value={form.internal_notes} onChange={e => set({ internal_notes: e.target.value })} /></Field>
            </Card>
          </div>

          <div className="space-y-5 lg:sticky lg:top-24">
            <Card className="p-5 space-y-3 animate-fade-up" style={{ animationDelay: '100ms' }}>
              <Button type="submit" variant="accent" className="w-full" disabled={busy}>{busy ? 'Saving…' : editing ? (dirty ? 'Save changes' : 'Saved') : 'Create quote'}</Button>
              {editing && (
                <>
                  <Button type="button" variant="primary" className="w-full" onClick={openSend} disabled={busy || ['accepted', 'declined'].includes(quote.status)}><Send className="w-4 h-4" />{quote.status === 'draft' ? 'Send to client' : 'Send again'}</Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={preview}><Eye className="w-4 h-4" />PDF</Button>
                    <Button type="button" variant="outline" onClick={copyLink} disabled={quote.status === 'draft'} title={quote.status === 'draft' ? 'The link goes live once the quote is sent' : quote.link}><Copy className="w-4 h-4" />Link</Button>
                  </div>
                  {quote.status !== 'draft' && <Button type="button" variant="outline" className="w-full" onClick={convert}><ShoppingBag className="w-4 h-4" />Convert to purchase</Button>}
                </>
              )}
            </Card>

            {editing && (
              <Card className="p-5 animate-fade-up" style={{ animationDelay: '170ms' }}>
                <Field label="Status" hint="Set manually if the client answers by phone or email.">
                  <Select value={quote.status} onChange={e => setStatus(e.target.value)}>{QUOTE_STATUSES.map(s => <option key={s}>{s}</option>)}</Select>
                </Field>
                <dl className="mt-4 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex justify-between"><dt>Created</dt><dd>{fmtDateTime(quote.created_at)}</dd></div>
                  {quote.sent_at && <div className="flex justify-between"><dt>Sent</dt><dd>{fmtDateTime(quote.sent_at)}</dd></div>}
                  {quote.viewed_at && <div className="flex justify-between"><dt>Viewed by client</dt><dd>{fmtDateTime(quote.viewed_at)}</dd></div>}
                  {quote.responded_at && <div className="flex justify-between"><dt className="capitalize">{quote.status}</dt><dd>{fmtDateTime(quote.responded_at)}</dd></div>}
                </dl>
                {quote.response_note && <p className="mt-3 rounded-xl bg-muted/60 p-3 text-xs"><span className="font-semibold">Client's note: </span>{quote.response_note}</p>}
              </Card>
            )}

            {editing && (
              <Card className="animate-fade-up" style={{ animationDelay: '240ms' }}>
                <div className="px-5 py-3.5 border-b border-border"><h2 className="text-sm font-semibold">Emails for this quote</h2></div>
                <ul className="divide-y divide-border">
                  {quote.messages?.map(m => (
                    <li key={m.id} className="px-5 py-3 text-xs flex items-center gap-2">
                      <span className="truncate flex-1"><span className="font-medium">{m.to_email}</span> · {fmtDateTime(m.created_at)}{m.status === 'failed' && <span className="block text-destructive">{m.error}</span>}</span>
                      <Badge tone={messageTone(m.status)}>{m.status}</Badge>
                    </li>
                  ))}
                  {!quote.messages?.length && <li className="px-5 py-6 text-center text-xs text-muted-foreground">Not sent yet.</li>}
                </ul>
                {editing && <div className="px-5 py-3 border-t border-border"><Button type="button" variant="ghost" className="h-8 px-2 text-xs text-destructive" onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete quote</Button></div>}
              </Card>
            )}
          </div>
        </form>
      )}

      {editing && quote && settings && (
        <Composer open={compose} onClose={() => setCompose(false)} title={`Send ${quote.number}`} quoteId={quote.id} clientId={quote.client_id}
          to={form.client_email} subject={`Quotation ${quote.number} from ${settings.company?.name || 'Vertoc Agro'}${form.title ? ` — ${form.title}` : ''}`} body=""
          onSent={() => { toast('Quote sent'); load() }} />
      )}
      {toastEl}
    </>
  )
}
