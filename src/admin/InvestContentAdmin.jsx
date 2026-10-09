/*
 * Staff → Invest content: the pages of the /invest section as editable content.
 * The editor is drawn from the schema the server sends, so a field added there
 * appears here. Edits are saved as a draft, previewed, then published by an Admin.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, ExternalLink, History, ImagePlus, Plus, Trash2, Upload } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import { fmtDateTime } from './format'

/* ------------------------------------------------------------ the list --- */
export function InvestContentList() {
  const { me, can } = useAuth(); const nav = useNavigate()
  const isAdmin = can('staff', 'manage')
  const [d, setD] = useState(null); const [err, setErr] = useState(null); const [add, setAdd] = useState(null); const [busy, setBusy] = useState(false); const [toast, toastEl] = useToast()
  const load = useCallback(() => adminFetch('/invest-content').then(setD).catch(e => setErr(e.message)), [])
  useEffect(() => { load() }, [load])
  const create = async e => {
    e.preventDefault(); setBusy(true)
    try { const p = await adminFetch('/invest-content/pages', { method: 'POST', body: add }); nav(`/staff360/invest-content/${p.key}`) } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  return (
    <>
      <PageHeader eyebrow="Investment" title="Invest content" description="The words, pictures and links of the /invest section. Edit a page, preview it, then publish: visitors see only what is published."
        action={isAdmin && <Button variant="accent" onClick={() => setAdd({ title: '', slug: '' })}><Plus className="w-4 h-4" />Add a page</Button>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {d && !d.ready && <div className="mb-4"><Alert tone="info">Run server/migrations/022_invest_content.sql in the Supabase SQL editor to save and publish changes. Until then the site shows the built-in text.</Alert></div>}
      <div className="grid md:grid-cols-2 gap-4">
        {!d && [0, 1, 2, 3].map(i => <Card key={i} className="p-5"><Bone className="h-5 w-40 mb-3" /><Bone className="h-4 w-full" /></Card>)}
        {d?.pages.map(p => (
          <Card key={p.key} className="p-5 flex flex-col">
            <div className="flex flex-wrap items-center gap-2 mb-1"><h2 className="font-semibold">{p.label}</h2>
              <Badge tone={p.visible && (p.published || !p.custom) ? 'green' : 'muted'}>{p.visible && (p.published || !p.custom) ? 'Visible' : 'Hidden'}</Badge>
              {p.has_draft && <Badge tone="amber">Unpublished changes</Badge>}{!p.published && !p.custom && <Badge tone="muted">Built-in text</Badge>}</div>
            <p className="text-xs text-muted-foreground">{p.hint}</p>
            <p className="text-xs text-muted-foreground mt-2 font-mono">{p.path}</p>
            <p className="text-xs text-muted-foreground mt-2">{p.published_at ? `Published ${fmtDateTime(p.published_at)} by ${p.published_name || 'staff'}` : 'Never published'}{p.updated_at && p.updated_name ? ` · last edited ${fmtDateTime(p.updated_at)} by ${p.updated_name}` : ''}</p>
            <div className="mt-4 pt-3 border-t border-border flex gap-2"><Link to={`/staff360/invest-content/${p.key}`}><Button variant="accent" className="h-9">Edit</Button></Link>{p.visible && p.published && !p.path.includes('…') && <a href={p.path} target="_blank" rel="noreferrer"><Button variant="outline" className="h-9"><ExternalLink className="w-4 h-4" />View live</Button></a>}</div>
          </Card>
        ))}
      </div>
      <Modal open={Boolean(add)} onClose={() => setAdd(null)} title="Add a page" footer={<><Button type="button" variant="outline" onClick={() => setAdd(null)}>Cancel</Button><Button type="submit" form="add-page" variant="accent" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button></>}>
        {add && <form id="add-page" onSubmit={create} className="space-y-4">
          <Field label="Page title *"><Input required value={add.title} onChange={e => setAdd({ ...add, title: e.target.value, slug: add.slug || '' })} placeholder="How returns are paid" /></Field>
          <Field label="Address *" hint={`The page will be at /invest/p/${add.slug || add.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || '…'}`}><Input value={add.slug} onChange={e => setAdd({ ...add, slug: e.target.value })} placeholder="leave empty to use the title" /></Field>
          <p className="text-xs text-muted-foreground">A new page starts hidden. Write it, publish it, then show it.</p>
        </form>}
      </Modal>
      {toastEl}
    </>
  )
}

/* ---------------------------------------------------------- the editor --- */
const blankOf = fields => Object.fromEntries(fields.map(f => [f.key, f.type === 'group' ? blankOf(f.fields) : f.type === 'list' ? [] : f.type === 'select' ? f.options[0] : '']))

function ImageField({ field, value, onChange }) {
  const pick = useRef(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  const choose = async e => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setBusy(true); setErr(null)
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file) })
      const { url } = await adminFetch('/invest-content/media', { method: 'POST', body: { contentType: file.type, data } }); onChange(url)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Field label={field.label}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-24 h-16 rounded-lg border border-dashed border-border bg-muted/40 overflow-hidden flex items-center justify-center text-muted-foreground shrink-0">{value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-5 h-5" />}</div>
        <input ref={pick} type="file" accept="image/*" className="sr-only" onChange={choose} />
        <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => pick.current?.click()}><Upload className="w-4 h-4" />{busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}</Button>
        {value && <Button type="button" variant="ghost" className="h-9 text-destructive" onClick={() => onChange('')}><Trash2 className="w-4 h-4" />Remove</Button>}
      </div>
      {err && <p className="text-xs text-destructive mt-1">{err}</p>}
    </Field>
  )
}

function FieldEditor({ field, value, onChange }) {
  switch (field.type) {
    case 'text': return <Field label={field.label}><Input maxLength={field.max} value={value ?? ''} onChange={e => onChange(e.target.value)} /></Field>
    case 'link': return <Field label={field.label} hint="Starts with / for a page on this site, or https:// for another site."><Input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="/investor/register" /></Field>
    case 'textarea': return <Field label={field.label}><Textarea rows={field.max > 1000 ? 6 : 3} maxLength={field.max} value={value ?? ''} onChange={e => onChange(e.target.value)} /></Field>
    case 'image': return <ImageField field={field} value={value} onChange={onChange} />
    case 'select': return <Field label={field.label}><Select value={value} onChange={e => onChange(e.target.value)}>{field.options.map(o => <option key={o}>{o}</option>)}</Select></Field>
    case 'group': return (
      <fieldset className="rounded-xl border border-border p-4 space-y-4"><legend className="px-2 text-sm font-semibold">{field.label}</legend>
        {field.fields.map(f => <FieldEditor key={f.key} field={f} value={value?.[f.key]} onChange={v => onChange({ ...value, [f.key]: v })} />)}</fieldset>
    )
    case 'list': {
      const items = value || []
      const set = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
      const move = (i, d) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n) }
      return (
        <div>
          <p className="text-sm font-semibold mb-1">{field.label}</p>{field.hint && <p className="text-xs text-muted-foreground mb-2">{field.hint}</p>}
          <ul className="space-y-3">
            {items.map((it, i) => (
              <li key={i} className={`rounded-xl border p-4 space-y-3 ${it.hidden ? 'border-dashed border-border bg-muted/30 opacity-70' : 'border-border bg-card'}`}>
                <div className="flex items-center gap-1 -mt-1 -mr-1 justify-end">
                  {it.hidden && <span className="mr-auto text-xs font-semibold text-muted-foreground">Hidden from the website</span>}
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => set(i, { hidden: !it.hidden })} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted" title={it.hidden ? 'Show on the website' : 'Hide from the website'} aria-label="Hide or show">{it.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                  <button type="button" onClick={() => window.confirm('Remove this entry? (Hide it instead to keep it.)') && onChange(items.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
                {field.item.map(f => <FieldEditor key={f.key} field={f} value={it[f.key]} onChange={v => set(i, { [f.key]: v })} />)}
              </li>
            ))}
          </ul>
          {items.length < field.max && <Button type="button" variant="outline" className="mt-3 h-9" onClick={() => onChange([...items, blankOf(field.item)])}><Plus className="w-4 h-4" />Add</Button>}
        </div>
      )
    }
    default: return null
  }
}

export function InvestContentEditor() {
  const { key } = useParams(); const { can } = useAuth()
  const isAdmin = can('staff', 'manage'), mayEdit = can('investments', 'edit')
  const [p, setP] = useState(null); const [content, setContent] = useState(null); const [dirty, setDirty] = useState(false)
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false); const [hist, setHist] = useState(null); const [toast, toastEl] = useToast()
  const load = useCallback(() => adminFetch(`/invest-content/${key}`).then(x => { setP(x); setContent(x.content); setDirty(false); setErr(null) }).catch(e => setErr(e.message)), [key])
  useEffect(() => { load() }, [load])
  const change = patch => { setContent(c => ({ ...c, ...patch })); setDirty(true) }
  const act = async (fn, ok) => { setBusy(true); setErr(null); try { await fn(); toast(ok); await load() } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  const save = () => adminFetch(`/invest-content/${key}`, { method: 'PUT', body: { content } })
  const preview = async () => {
    if (dirty) { try { setBusy(true); await save(); setDirty(false) } catch (x) { setErr(x.message); return } finally { setBusy(false) } }
    window.open(`${p.path.includes('…') ? '/invest' : p.path}?preview=1`, '_blank')
  }
  if (err && !p) return <Alert>{err}</Alert>
  if (!p || !content) return <Card className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Bone key={i} className="h-11 w-full" />)}</Card>
  return (
    <>
      <Link to="/staff360/invest-content" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Invest content</Link>
      <PageHeader eyebrow="Invest content" title={p.label} description={`${p.hint} Address: ${p.path}`}
        action={<div className="flex flex-wrap gap-2"><Badge tone={p.visible ? 'green' : 'muted'}>{p.visible ? 'Visible' : 'Hidden'}</Badge>{(p.has_draft || dirty) && <Badge tone="amber">Unpublished changes</Badge>}</div>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <Card className="p-6 space-y-5">
          {p.fields.map(f => <FieldEditor key={f.key} field={f} value={content[f.key]} onChange={v => change({ [f.key]: v })} />)}
        </Card>
        <div className="space-y-4 lg:sticky lg:top-24">
          <Card className="p-5 space-y-2.5">
            {mayEdit && <Button variant="outline" className="w-full" disabled={busy || !dirty} onClick={() => act(async () => { await save() }, 'Draft saved')}>{dirty ? 'Save draft' : 'Draft saved'}</Button>}
            <Button variant="outline" className="w-full" disabled={busy} onClick={preview}><Eye className="w-4 h-4" />Preview</Button>
            {isAdmin && <Button variant="accent" className="w-full" disabled={busy || (!dirty && !p.has_draft && p.published)} onClick={() => act(async () => { if (dirty) await save(); await adminFetch(`/invest-content/${key}/publish`, { method: 'POST', body: {} }) }, 'Published: visitors now see this version')}>Publish</Button>}
            {!isAdmin && <p className="text-xs text-muted-foreground">Only an Admin can publish. Save your draft and ask them to review it.</p>}
            {mayEdit && p.has_draft && <Button variant="ghost" className="w-full text-destructive" disabled={busy} onClick={() => window.confirm('Discard the unpublished changes and go back to the published version?') && act(() => adminFetch(`/invest-content/${key}/discard`, { method: 'POST' }), 'Draft discarded')}>Discard draft</Button>}
          </Card>
          {isAdmin && (
            <Card className="p-5 space-y-2">
              <p className="text-sm font-semibold">Visibility</p>
              <p className="text-xs text-muted-foreground">{p.visible ? 'Visitors can open this page.' : 'Visitors see a "page not found". Nothing is deleted.'}</p>
              <Button variant="outline" className="w-full" disabled={busy || (!p.visible && p.custom && !p.published)} onClick={() => act(() => adminFetch(`/invest-content/${key}/visibility`, { method: 'POST', body: { visible: !p.visible } }), p.visible ? 'Page hidden' : 'Page visible')}>{p.visible ? <><EyeOff className="w-4 h-4" />Hide this page</> : <><Eye className="w-4 h-4" />Show this page</>}</Button>
              {!p.visible && p.custom && !p.published && <p className="text-xs text-muted-foreground">Publish it first.</p>}
            </Card>
          )}
          <Card className="p-5 text-xs text-muted-foreground space-y-1">
            <p>{p.published_at ? `Published ${fmtDateTime(p.published_at)} by ${p.published_name || 'staff'}` : 'Never published: visitors see the built-in text.'}</p>
            {p.updated_at && p.updated_name && <p>Last edited {fmtDateTime(p.updated_at)} by {p.updated_name}</p>}
            <Button variant="ghost" className="h-8 px-2 text-xs mt-1" onClick={() => adminFetch(`/invest-content/${key}/history`).then(setHist).catch(x => setErr(x.message))}><History className="w-3.5 h-3.5" />Change history</Button>
          </Card>
        </div>
      </div>
      <Modal open={Boolean(hist)} onClose={() => setHist(null)} wide title="Change history">
        <ul className="divide-y divide-border text-sm">
          {hist?.map(h => <li key={h.id} className="py-2.5 flex flex-wrap items-center gap-3"><Badge tone={h.action === 'publish' ? 'green' : h.action === 'hide' ? 'red' : 'muted'}>{({ save_draft: 'saved a draft', publish: 'published', discard_draft: 'discarded the draft', show: 'showed the page', hide: 'hid the page', restore: 'loaded a version', create: 'created the page' })[h.action] || h.action}</Badge><span className="flex-1 min-w-[10rem]"><b className="font-medium">{h.by_name || 'staff'}</b> <span className="text-muted-foreground">· {fmtDateTime(h.at)}{h.note ? ` · ${h.note}` : ''}</span></span>
            {mayEdit && h.has_snapshot && ['publish', 'save_draft'].includes(h.action) && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => act(() => adminFetch(`/invest-content/${key}/restore`, { method: 'POST', body: { history_id: h.id } }), 'Loaded into the draft').then(() => setHist(null))}>Load into draft</Button>}</li>)}
          {hist && !hist.length && <li className="py-6 text-center text-muted-foreground">No changes yet.</li>}
        </ul>
      </Modal>
      {toastEl}
    </>
  )
}
