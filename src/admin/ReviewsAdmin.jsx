import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, EyeOff, Pencil, Plus, RotateCcw, Star, Trash2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea, confirmDelete, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtDateTime } from './format'

const TABS = [['pending', 'Awaiting approval'], ['approved', 'On the homepage'], ['hidden', 'Hidden'], ['all', 'All']]
const EMPTY = { quote: '', name: '', role: '', rating: 5 }
const Stars = ({ n }) => <span className="inline-flex gap-0.5" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map(k => <Star key={k} className={`w-3.5 h-3.5 ${k <= n ? 'text-accent fill-accent' : 'text-border'}`} />)}</span>

/** Client reviews: approve what clients submit on the site, add the ones that arrive on WhatsApp, hide or delete. */
export default function ReviewsAdmin() {
  const [sp, setSp] = useSearchParams()
  const status = TABS.some(([k]) => k === sp.get('status')) ? sp.get('status') : 'pending'
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [hint, setHint] = useState(null)
  const [editing, setEditing] = useState(null)   // null | 'new' | review row
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()

  const load = useCallback(() => {
    setRows(null)
    adminFetch(`/reviews?status=${status}`).then(setRows).catch(e => { if (/migration 009/.test(e.message)) { setHint(e.message); setRows([]) } else setErr(e.message) })
  }, [status])
  useEffect(() => { load() }, [load])

  const setTab = k => { const n = new URLSearchParams(sp); k === 'pending' ? n.delete('status') : n.set('status', k); setSp(n, { replace: true }) }
  const setStatus = async (r, s) => {
    try { await adminFetch(`/reviews/${r.id}`, { method: 'PATCH', body: { status: s } }); toast(s === 'approved' ? 'Approved — it is on the homepage now' : s === 'hidden' ? 'Hidden from the homepage' : 'Back to awaiting approval'); load() }
    catch (x) { toast(x.message, 'error') }
  }
  const remove = async r => {
    if (!confirmDelete(`the review by ${r.name}`)) return
    try { await adminFetch(`/reviews/${r.id}`, { method: 'DELETE' }); toast('Deleted'); load() } catch (x) { toast(x.message, 'error') }
  }
  const open = r => { setEditing(r || 'new'); setForm(r ? { quote: r.quote, name: r.name, role: r.role || '', rating: r.rating } : EMPTY) }
  const save = async e => {
    e.preventDefault(); setBusy(true)
    try {
      if (editing === 'new') await adminFetch('/reviews', { method: 'POST', body: { ...form, status: 'approved' } })
      else await adminFetch(`/reviews/${editing.id}`, { method: 'PATCH', body: form })
      toast(editing === 'new' ? 'Review added to the homepage' : 'Saved'); setEditing(null); load()
    } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader eyebrow="Manage" title="Reviews" description="What clients say on the homepage. Reviews submitted on the site wait here for approval; ones that reach you on WhatsApp or by email can be added directly."
        action={<Button variant="accent" onClick={() => open(null)}><Plus className="w-4 h-4" />Add a review</Button>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {hint && <div className="mb-4"><Alert tone="info">{hint}</Alert></div>}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${status === k ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>{l}</button>
        ))}
      </div>

      <Card className="animate-fade-up">
        <ul className="divide-y divide-border">
          {!rows && [0, 1, 2].map(i => <li key={i} className="p-5 space-y-2"><Bone className="h-4 w-3/4" /><Bone className="h-3 w-1/3" /></li>)}
          {rows?.map(r => (
            <li key={r.id} className="p-5 flex flex-col md:flex-row md:items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-foreground">“{r.quote}”</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <Stars n={r.rating} />
                  <span className="font-semibold text-foreground">{r.name}</span>
                  {r.role && <span>· {r.role}</span>}
                  <Badge tone={r.source === 'website' ? 'blue' : 'muted'}>{r.source === 'website' ? 'from the website' : 'added by staff'}</Badge>
                  <Badge tone={r.status === 'approved' ? 'green' : r.status === 'pending' ? 'amber' : 'muted'}>{r.status === 'pending' ? 'awaiting approval' : r.status}</Badge>
                  <span>{fmtDateTime(r.created_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {r.status !== 'approved' && <Button variant="accent" className="h-8 px-3 text-xs" onClick={() => setStatus(r, 'approved')}><Check className="w-3.5 h-3.5" />Approve</Button>}
                {r.status === 'approved' && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => setStatus(r, 'hidden')}><EyeOff className="w-3.5 h-3.5" />Hide</Button>}
                {r.status === 'hidden' && <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => setStatus(r, 'pending')}><RotateCcw className="w-3.5 h-3.5" />To pending</Button>}
                <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => open(r)}><Pencil className="w-3.5 h-3.5" />Edit</Button>
                <button onClick={() => remove(r)} className="p-2 rounded-lg text-destructive hover:bg-muted" title="Delete" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </li>
          ))}
          {rows?.length === 0 && <li><Empty>{status === 'pending' ? 'Nothing waiting for approval.' : status === 'approved' ? 'No reviews on the homepage yet — approve one or add one.' : 'Nothing here.'}</Empty></li>}
        </ul>
      </Card>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a review' : 'Edit review'}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="review-form" variant="accent" disabled={busy}>{busy ? 'Saving…' : editing === 'new' ? 'Add to homepage' : 'Save'}</Button></>}>
        <form id="review-form" onSubmit={save} className="space-y-4">
          <Field label="Quote" hint="The client's words; quotation marks are added on the page."><Textarea required minLength={10} maxLength={400} rows={4} value={form.quote} onChange={e => setForm({ ...form, quote: e.target.value })} /></Field>
          <div className="grid sm:grid-cols-[1fr_1.5fr_110px] gap-4">
            <Field label="Name"><Input required maxLength={60} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Role / company"><Input maxLength={120} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Procurement Manager, Accra Foods" /></Field>
            <Field label="Stars"><Select value={String(form.rating)} onChange={e => setForm({ ...form, rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</Select></Field>
          </div>
        </form>
      </Modal>
      {toastEl}
    </>
  )
}
