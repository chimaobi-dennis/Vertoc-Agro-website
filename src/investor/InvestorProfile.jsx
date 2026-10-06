/*
 * The investor's profile. What is not on record yet can be filled in directly;
 * what is on record is official and changes only through a change request:
 * reason, supporting documents, review by Investment staff, acceptance by an Admin.
 */
import { useEffect, useRef, useState } from 'react'
import { Camera, FileText, Loader2, Lock, Paperclip } from 'lucide-react'
import { investorPortal } from '../lib/portal'
import { Card, PasswordChange, Tag } from '../portal/Shared'
import { Label, Notice, Problem, accent, input, outline } from '../supplier/ui'
import { FILE_ACCEPT, fileSize, fmtDay, fmtMoment } from '../lib/procurement'
import { openFile } from '../lib/openFile'
import { ID_TYPES, KYC_LABELS, kycTone } from '../lib/investing'
import { TitleInput } from './fields'

const { api, upload } = investorPortal
const LABELS = { name: 'Full name', title: 'Title', first_name: 'First name', middle_name: 'Middle name', last_name: 'Last name', phone: 'Phone number', email: 'Email address', address: 'Residential address', state_of_origin: 'State of origin', lga: 'LGA', date_of_birth: 'Date of birth', nationality: 'Nationality', id_type: 'Means of identification', id_number: 'Identification number', bank_name: 'Bank', bank_account_name: 'Account name', bank_account_number: 'Account number', avatar: 'Profile picture' }
const STATUS = { draft: ['muted', 'Draft'], submitted: ['blue', 'Submitted'], under_review: ['amber', 'Under review'], resubmission_required: ['amber', 'Resubmission required'], approved: ['green', 'Approved'], rejected: ['red', 'Rejected'], cancelled: ['muted', 'Cancelled'] }
const useLoad = path => { const [d, setD] = useState(null); const load = () => api(path).then(setD).catch(() => setD([])); useEffect(() => { load() }, [path]); return [d, load] } // eslint-disable-line react-hooks/exhaustive-deps
const show = (k, v) => (v == null || v === '' ? '—' : k === 'date_of_birth' ? fmtDay(v) : k === 'avatar' ? 'picture' : String(v))

function Field({ k, me, f, set, locked }) {
  const common = { disabled: locked, className: input, value: f[k] ?? '', onChange: e => set(k, e.target.value) }
  const wide = ['address'].includes(k)
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <Label hint={locked ? '' : ''}><span className="inline-flex items-center gap-1.5">{LABELS[k]}{locked && <Lock className="w-3 h-3 text-muted-foreground" aria-label="On record" />}</span></Label>
      {k === 'title' ? <TitleInput disabled={locked} value={f.title} onChange={v => set('title', v)} titles={me.titles} />
        : k === 'address' ? <textarea rows={2} maxLength={500} {...common} />
        : k === 'id_type' ? <select {...common}><option value="">Choose…</option>{[...new Set([...ID_TYPES, f.id_type].filter(Boolean))].map(o => <option key={o}>{o}</option>)}</select>
        : <input type={k === 'date_of_birth' ? 'date' : k === 'phone' || k === 'alt_phone' ? 'tel' : 'text'} maxLength={k === 'date_of_birth' ? undefined : 200} {...common} />}
    </label>
  )
}

/** The form for asking a change. `from` pre-fills it from an earlier request that needs correcting. */
function ChangeForm({ me, groups, from, picture: picture0, onDone, onCancel }) {
  const [picked, setPicked] = useState(() => (picture0 ? ['picture'] : from ? [...new Set(Object.keys(from.changes).map(f => Object.entries(groups).find(([, g]) => f in g.fields)?.[0]))].filter(Boolean) : []))
  const [vals, setVals] = useState(() => picture0 ? { avatar: picture0.id } : Object.fromEntries(Object.entries(from?.changes || {}).map(([k, c]) => [k, c.to])))
  const [reason, setReason] = useState(from?.reason || '')
  const [docs, setDocs] = useState([]); const [picture, setPicture] = useState(picture0 || null)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  const files = useRef(null); const pic = useRef(null)
  const toggle = g => setPicked(p => (p.includes(g) ? p.filter(x => x !== g) : [...p, g]))
  const need = picked.filter(g => groups[g].required)
  const addDocs = async list => { for (const file of list) { setBusy(true); try { const d = await upload(file, '/investor/change-docs'); setDocs(x => [...x, d]) } catch (x) { setErr(x.message) } setBusy(false) } }
  const addPicture = async file => { if (!file) return; setBusy(true); setErr(null); try { const d = await upload(file, '/investor/avatar'); setPicture(d); setVals(v => ({ ...v, avatar: d.id })) } catch (x) { setErr(x.message) } setBusy(false) }
  const submit = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    const changes = {}
    for (const g of picked) for (const k of Object.keys(groups[g].fields)) if (vals[k] !== undefined && String(vals[k]) !== String(me[k] ?? '')) changes[k] = vals[k]
    try { await api('/investor/change-requests', { method: 'POST', body: { changes, reason, document_ids: docs.map(d => d.id), previous_id: from?.id } }); onDone() } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <Problem>{err}</Problem>
      <div>
        <Label>What needs to change?</Label>
        <div className="flex flex-wrap gap-2">{Object.entries(groups).filter(([g]) => g !== 'picture' || me.avatar_url).map(([g, d]) => <button type="button" key={g} onClick={() => toggle(g)} className={`px-3.5 h-9 rounded-full text-sm font-semibold border ${picked.includes(g) ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:bg-muted'}`}>{d.label}</button>)}</div>
      </div>
      {picked.map(g => (
        <div key={g} className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">{groups[g].label}</p>
          {g === 'picture' ? (
            <div className="flex items-center gap-3"><input ref={pic} type="file" accept="image/*" className="sr-only" onChange={e => { addPicture(e.target.files[0]); e.target.value = '' }} /><button type="button" onClick={() => pic.current?.click()} className={`${outline} h-10`}><Camera className="w-4 h-4" />{picture ? 'Choose another' : 'Choose the new picture'}</button>{picture && <span className="text-sm text-muted-foreground">{picture.name}</span>}</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">{Object.keys(groups[g].fields).map(k => <Field key={k} k={k} me={me} f={{ ...me, ...vals }} set={(key, v) => setVals(x => ({ ...x, [key]: v }))} locked={false} />)}</div>
          )}
          <p className="text-xs text-muted-foreground">{groups[g].required ? 'Supporting document required: ' : ''}{groups[g].docs}</p>
        </div>
      ))}
      <label className="block"><Label>Why does it need to change? *</Label><textarea required rows={3} maxLength={1500} className={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: I changed my name after marriage." /></label>
      <div>
        <Label hint={need.length ? '(required)' : '(optional)'}>Supporting documents</Label>
        <ul className="space-y-1.5 mb-2">{docs.map(d => <li key={d.id} className="flex items-center gap-2 text-sm"><FileText className="w-4 h-4 text-muted-foreground" /><span className="flex-1 truncate">{d.name}</span><button type="button" onClick={() => setDocs(x => x.filter(y => y.id !== d.id))} className="text-xs font-semibold text-destructive">Remove</button></li>)}</ul>
        <input ref={files} type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={e => { addDocs([...e.target.files]); e.target.value = '' }} />
        <button type="button" disabled={busy} onClick={() => files.current?.click()} className={`${outline} h-10`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}Add a document</button>
        <span className="text-xs text-muted-foreground ml-3">PDF or images · up to 20 MB each</span>
      </div>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy || !picked.length} className={accent}>{busy ? 'Working…' : from ? 'Resubmit for review' : 'Submit for review'}</button><button type="button" onClick={onCancel} className={outline}>Cancel</button></div>
      <p className="text-xs text-muted-foreground">Your profile stays as it is until our team has reviewed and approved the change.</p>
    </form>
  )
}

export default function Profile() {
  const { me, refresh } = investorPortal.use()
  const [f, setF] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [ok, setOk] = useState(null)
  const [docs, reloadDocs] = useLoad('/investor/documents'); const [reqs, reloadReqs] = useLoad('/investor/change-requests')
  const labels = me.kyc_labels || []
  const [label, setLabel] = useState(''); const [queue, setQueue] = useState([]); const picker = useRef(null); const avatar = useRef(null)
  const [asking, setAsking] = useState(null)       // { from? }
  const controlled = new Set(me.controlled || [])
  const FIELDS = ['title', 'first_name', 'middle_name', 'last_name', 'nickname', 'phone', 'alt_phone', 'address', 'state_of_origin', 'lga', 'date_of_birth', 'nationality', 'id_type', 'id_number', 'bank_name', 'bank_account_name', 'bank_account_number']
  useEffect(() => { setF(Object.fromEntries(FIELDS.map(k => [k, me[k] ? String(me[k]).slice(0, k === 'date_of_birth' ? 10 : 500) : '']))) }, [me]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) return null
  const locked = k => controlled.has(k) && Boolean(me[k])
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setOk(null) }
  const anyLocked = FIELDS.some(locked), anyOpen = FIELDS.some(k => !locked(k))
  const save = async e => {
    e.preventDefault(); setBusy(true); setErr(null); setOk(null)
    try { await api('/investor/me', { method: 'PATCH', body: Object.fromEntries(FIELDS.filter(k => !locked(k)).map(k => [k, f[k]])) }); await refresh(); setOk('Saved.') } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const addKyc = async list => { for (const file of list) { setQueue(q => [...q, { name: file.name }]); try { await upload(file, '/investor/documents', { label: label || labels[0] }); setQueue(q => q.filter(x => x.name !== file.name)); reloadDocs() } catch (x) { setQueue(q => q.map(v => (v.name === file.name ? { ...v, error: x.message } : v))) } } }
  const open = async d => { try { await openFile(() => api(`/investor/documents/${d.id}/url`).then(r => ({ url: r.url, name: d.name, type: d.content_type }))) } catch (x) { setErr(x.message) } }
  const newPicture = async file => { if (!file) return; setBusy(true); setErr(null); try { const d = await upload(file, '/investor/avatar'); if (d.direct) { await refresh(); setOk('Your picture is set.') } else setAsking({ picture: d }) } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  const cancel = async r => { if (!window.confirm('Withdraw this request?')) return; try { await api(`/investor/change-requests/${r.id}/cancel`, { method: 'POST' }); reloadReqs() } catch (x) { setErr(x.message) } }
  const openFileDoc = async d => { try { await openFile(() => api(`/investor/documents/${d.id}/url`).then(r => ({ url: r.url, name: d.name, type: d.content_type }))) } catch (x) { setErr(x.message) } }
  const pending = (reqs || []).some(r => ['submitted', 'under_review'].includes(r.status))
  const sections = [['Personal details', ['title', 'first_name', 'middle_name', 'last_name', 'nickname', 'date_of_birth', 'nationality', 'state_of_origin', 'lga']], ['Contact', ['phone', 'alt_phone', 'address']], ['Identification and bank', ['id_type', 'id_number', 'bank_name', 'bank_account_name', 'bank_account_number']]]
  return (
    <div className="space-y-6">
      <Problem>{err}</Problem>{ok && <Notice>{ok}</Notice>}
      <Card className="p-6 max-w-3xl flex flex-wrap items-center gap-4">
        {me.avatar_url ? <img src={me.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border border-border" /> : <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><Camera className="w-6 h-6" /></div>}
        <div className="flex-1 min-w-[14rem]"><p className="font-semibold text-foreground">{me.name}</p><p className="text-sm text-muted-foreground">{me.email}</p><div className="mt-1.5"><Tag tone={kycTone(me.kyc_status)}>{KYC_LABELS[me.kyc_status]}</Tag></div></div>
        <div><input ref={avatar} type="file" accept="image/*" className="sr-only" onChange={e => { newPicture(e.target.files[0]); e.target.value = '' }} /><button type="button" disabled={busy} onClick={() => avatar.current?.click()} className={`${outline} h-10`}><Camera className="w-4 h-4" />{me.avatar_url ? 'Change picture' : 'Add a picture'}</button>{me.avatar_url && <p className="text-xs text-muted-foreground mt-1.5 max-w-[14rem]">A new picture is reviewed before it replaces this one.</p>}</div>
      </Card>

      <form onSubmit={save} className="bg-card border border-border rounded-2xl p-6 md:p-8 max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-semibold text-lg text-foreground">Your details</h1><p className="text-sm text-muted-foreground mt-0.5">Used to verify your identity and to pay your returns. {anyLocked && <><Lock className="inline w-3 h-3" /> Details already on record are official: change them with a request below.</>}</p></div></div>
        {sections.map(([title, keys]) => (
          <div key={title}><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
            <div className="grid sm:grid-cols-2 gap-4">{keys.map(k => <Field key={k} k={k} me={me} f={f} set={set} locked={locked(k)} />)}</div></div>
        ))}
        <label className="block"><Label hint="(contact us to correct it, or request a change below)">Email address</Label><input disabled className={input} value={me.email} /></label>
        {anyOpen && <div className="flex justify-end"><button type="submit" disabled={busy} className={accent}>{busy ? 'Saving…' : 'Save changes'}</button></div>}
      </form>

      <Card className="max-w-3xl">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Change what is on record</h2><p className="text-xs text-muted-foreground mt-0.5">Name, phone, email, address, identification, bank details or picture. Each request needs a reason and, for most changes, a supporting document.</p></div>
          {!asking && <button type="button" disabled={pending} onClick={() => setAsking({})} className={`${accent} h-10`}>{pending ? 'A request is under review' : 'Request a change'}</button>}
        </div>
        {asking && <div className="p-6"><ChangeForm key={asking.from?.id || 'new'} me={me} groups={me.change_groups} from={asking.from} picture={asking.picture} onDone={() => { setAsking(null); reloadReqs(); setOk('Your request was sent. We will tell you the decision.') }} onCancel={() => setAsking(null)} /></div>}
        <ul className="divide-y divide-border">
          {(reqs || []).map(r => (
            <li key={r.id} className="px-6 py-4 text-sm space-y-2">
              <div className="flex flex-wrap items-center gap-2"><Tag tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Tag><span className="text-muted-foreground">{fmtMoment(r.submitted_at)}</span>{r.previous_id && <span className="text-xs text-muted-foreground">resubmission</span>}</div>
              <ul className="space-y-0.5">{Object.entries(r.changes).map(([k, c]) => <li key={k}><span className="text-muted-foreground">{LABELS[k] || k}: </span>{show(k, c.from)} <span className="text-muted-foreground">→</span> <b className="font-semibold">{show(k, c.to)}</b></li>)}</ul>
              <p className="text-muted-foreground"><span className="font-medium text-foreground">Reason: </span>{r.reason}</p>
              {r.documents?.length > 0 && <p className="flex flex-wrap gap-x-4 gap-y-1">{r.documents.map(d => <button type="button" key={d.id} onClick={() => openFileDoc(d)} className="inline-flex items-center gap-1 text-accent font-semibold"><FileText className="w-3.5 h-3.5" />{d.name}</button>)}</p>}
              {['rejected', 'resubmission_required'].includes(r.status) && r.review_note && <p className={`rounded-xl border px-3 py-2 ${r.status === 'rejected' ? 'border-destructive/20 bg-destructive/10' : 'border-amber-300 bg-amber-50 dark:bg-amber-500/10'}`}><span className="font-medium">{r.status === 'rejected' ? 'Why it was not approved: ' : 'What to correct: '}</span>{r.review_note}</p>}
              <div className="flex gap-4">
                {r.status === 'resubmission_required' && !r.superseded_by && <button type="button" onClick={() => setAsking({ from: r })} className="font-semibold text-accent">Correct and resubmit</button>}
                {['submitted', 'under_review', 'resubmission_required'].includes(r.status) && !r.superseded_by && <button type="button" onClick={() => cancel(r)} className="font-semibold text-destructive">Withdraw</button>}
              </div>
            </li>
          ))}
          {reqs && !reqs.length && <li className="px-6 py-8 text-center text-muted-foreground">No change requests yet.</li>}
        </ul>
      </Card>

      <Card className="max-w-3xl">
        <div className="px-6 py-4 border-b border-border"><h2 className="font-semibold">Identification documents (KYC)</h2><p className="text-xs text-muted-foreground mt-0.5">A clear copy of your means of identification, and a proof of address. Only you and our team can see them.</p></div>
        <ul className="divide-y divide-border">
          {docs?.map(d => <li key={d.id} className="px-6 py-3 flex items-center gap-3 text-sm"><FileText className="w-4 h-4 text-muted-foreground shrink-0" /><button type="button" onClick={() => open(d)} className="flex-1 min-w-0 text-left hover:text-accent"><span className="font-medium truncate block">{d.name}</span><span className="block text-xs text-muted-foreground">{[d.label, fileSize(d.bytes), fmtDay(d.created_at)].filter(Boolean).join(' · ')}</span></button></li>)}
          {queue.map(q => <li key={q.name} className="px-6 py-3 text-sm flex items-center gap-3">{!q.error && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}<span className="flex-1 truncate">{q.name}<span className={`block text-xs ${q.error ? 'text-destructive' : 'text-muted-foreground'}`}>{q.error || 'Uploading…'}</span></span></li>)}
          {docs && !docs.length && !queue.length && <li className="px-6 py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</li>}
        </ul>
        <div className="px-6 py-4 border-t border-border flex flex-wrap items-center gap-3">
          <select className={`${input} h-11 py-0 max-w-xs`} value={label || labels[0] || ''} onChange={e => setLabel(e.target.value)} aria-label="Kind of document">{labels.map(l => <option key={l}>{l}</option>)}</select>
          <input ref={picker} type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={e => { addKyc([...e.target.files]); e.target.value = '' }} />
          <button type="button" onClick={() => picker.current?.click()} className={`${outline} h-11`}><Paperclip className="w-4 h-4" />Add a document</button>
          <span className="text-xs text-muted-foreground">PDF or images · up to 20 MB each</span>
        </div>
      </Card>

      <PasswordChange change={investorPortal.changePassword} email={me.email} />
    </div>
  )
}
