import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useSite } from '../lib/site'
import { Alert, Button, Field, Input, Modal, Select, Textarea } from './ui'
import ImageUpload from './ImageUpload'
import { STAT_ICON_NAMES, statIcon } from '../lib/statIcons'
import { flagSrc, onFlagError } from '../lib/flags'

/*
 * The per-card editor behind the "Edit" control on the public pages. Each
 * section says where its data lives (which endpoint, which key holds the
 * list) and which fields one item has. Lists are saved whole: fetch the
 * row, replace one item, put the row back — the same endpoints the panel
 * uses, so validation is identical.
 */
const F = {
  icon: (k, label = 'Icon') => ({ k, label, type: 'icon' }),
  text: (k, label, o = {}) => ({ k, label, type: 'text', ...o }),
  area: (k, label, o = {}) => ({ k, label, type: 'textarea', ...o }),
  num: (k, label, o = {}) => ({ k, label, type: 'number', ...o }),
  image: (k, label) => ({ k, label, type: 'image' }),
  rating: (k, label = 'Stars') => ({ k, label, type: 'rating' }),
  code: (k, label) => ({ k, label, type: 'code' }),
}
const SECTIONS = {
  stats: { label: 'Stat tile', get: '/settings/stats', list: r => r.stats, put: items => ({ stats: items }), fields: [F.icon('icon'), F.num('value', 'Number'), F.text('suffix', 'Suffix', { maxLength: 3, hint: 'e.g. + or %' }), F.text('label', 'Label', { maxLength: 40 })], blank: { icon: 'Award', value: 0, suffix: '+', label: '' } },
  markets: { label: 'Export market', get: '/settings/markets', list: r => r.items, put: (items, row) => ({ markets: items, caption_left: row.caption_left, caption_right: row.caption_right }), fields: [F.text('name', 'Country', { maxLength: 40 }), F.code('code', 'Two-letter code')], blank: { name: '', code: '' } },
  markets_captions: { label: 'Captions under the markets', get: '/settings/markets', scalar: true, put: row => ({ markets: row.items, caption_left: row.caption_left, caption_right: row.caption_right }), fields: [F.text('caption_left', 'Left caption', { maxLength: 60, hint: 'Empty hides it' }), F.text('caption_right', 'Right caption', { maxLength: 60, hint: 'Empty hides it' })] },
  mission: { label: 'Our mission', get: '/settings/about', row: r => r.profile, scalar: true, put: row => row, fields: [F.area('mission', 'Mission', { maxLength: 600 }), F.text('mission_short', 'Short version for the homepage card', { maxLength: 200, hint: 'Optional' })] },
  vision: { label: 'Our vision', get: '/settings/about', row: r => r.profile, scalar: true, put: row => row, fields: [F.area('vision', 'Vision', { maxLength: 600 }), F.text('vision_short', 'Short version for the homepage card', { maxLength: 200, hint: 'Optional' })] },
  registrations: { label: 'Registration', get: '/settings/about', row: r => r.profile, listKey: 'registrations', put: row => row, fields: [F.icon('icon'), F.text('label', 'Label', { maxLength: 60 }), F.text('value', 'Number / detail', { maxLength: 80 })], blank: { icon: 'BadgeCheck', label: '', value: '' } },
  values: { label: 'Core value', get: '/settings/about', row: r => r.profile, listKey: 'values', put: row => row, fields: [F.icon('icon'), F.text('title', 'Title', { maxLength: 40 }), F.area('description', 'Description', { maxLength: 200 })], blank: { icon: 'Star', title: '', description: '' } },
  industries: { label: 'Industry', get: '/settings/about', row: r => r.profile, listKey: 'industries', put: row => row, fields: [F.icon('icon'), F.text('name', 'Industry', { maxLength: 60 }), F.area('description', 'Description', { maxLength: 200 })], blank: { icon: 'Factory', name: '', description: '' } },
  services: { label: 'Service', get: '/settings/services', list: r => r.items, put: items => ({ items }), fields: [F.icon('icon'), F.text('title', 'Title', { maxLength: 60 }), F.area('description', 'Description', { maxLength: 400 })], blank: { icon: 'Star', title: '', description: '' } },
  faq: { label: 'Question', get: '/settings/faq', list: r => r.items, put: items => ({ items }), fields: [F.text('q', 'Question', { maxLength: 200 }), F.area('a', 'Answer', { maxLength: 2000, rows: 6 })], blank: { q: '', a: '' } },
  gallery: { label: 'Photo', get: '/settings/gallery', list: r => r.items, put: items => ({ items }), fields: [F.image('src', 'Image'), F.text('title', 'Title', { maxLength: 60 }), F.text('caption', 'Caption', { maxLength: 200 }), F.text('alt', 'Alt text (for screen readers)', { maxLength: 200, hint: 'Defaults to the caption' })], blank: { src: '', title: '', caption: '', alt: '' } },
  review: { label: 'Review', table: true, fields: [F.area('quote', 'Quote', { maxLength: 400 }), F.text('name', 'Name', { maxLength: 60 }), F.text('role', 'Role / company', { maxLength: 120 }), F.rating('rating')], blank: { quote: '', name: '', role: '', rating: 5 } },
}

export default function InlineEditor({ target, onClose }) {
  const site = useSite()
  const S = SECTIONS[target.section]
  const [row, setRow] = useState(null)
  const [items, setItems] = useState(null)
  const [index, setIndex] = useState(target.index ?? null)
  const [form, setForm] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!S) throw new Error(`unknown section ${target.section}`)
        if (S.table) {
          if (target.add) { setForm({ ...S.blank }); return }
          const list = await adminFetch('/reviews?status=all'); const r = list.find(x => x.id === target.id)
          if (!r) throw new Error('This review no longer exists.')
          if (alive) setForm({ quote: r.quote, name: r.name, role: r.role || '', rating: r.rating })
          return
        }
        const res = await adminFetch(S.get)
        const r = S.row ? S.row(res) : res
        if (!alive) return
        setRow(r)
        if (S.scalar) { setForm(Object.fromEntries(S.fields.map(f => [f.k, r[f.k] ?? '']))); return }
        const list = S.listKey ? r[S.listKey] : S.list(res)
        setItems(list)
        if (target.add) { setIndex(list.length); setForm({ ...S.blank }) }
        else { const it = list[target.index]; if (!it) throw new Error('This item no longer exists.'); setForm({ ...it }) }
      } catch (e) { alive && setErr(e.message) }
    })()
    return () => { alive = false }
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async e => {
    e?.preventDefault(); setBusy(true); setErr(null)
    try {
      if (S.table) {
        if (target.add) await adminFetch('/reviews', { method: 'POST', body: { ...form, status: 'approved' } })
        else await adminFetch(`/reviews/${target.id}`, { method: 'PATCH', body: form })
      } else if (S.scalar) {
        await adminFetch(S.get, { method: 'PUT', body: S.put({ ...row, ...form }) })
      } else {
        const next = items.map((it, i) => (i === index ? { ...it, ...form } : it)); if (index >= items.length) next.push({ ...form })
        await adminFetch(S.get, { method: 'PUT', body: S.listKey ? S.put({ ...row, [S.listKey]: next }) : S.put(next, row) })
      }
      site.reload?.(); onClose()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!window.confirm(`Remove this ${S.label.toLowerCase()} from the site?`)) return
    setBusy(true); setErr(null)
    try {
      if (S.table) await adminFetch(`/reviews/${target.id}`, { method: 'DELETE' })
      else { const next = items.filter((_, i) => i !== index); await adminFetch(S.get, { method: 'PUT', body: S.listKey ? S.put({ ...row, [S.listKey]: next }) : S.put(next, row) }) }
      site.reload?.(); onClose()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const canRemove = !S?.scalar && !target.add
  const title = target.add ? `Add ${S?.label?.toLowerCase() || 'item'}` : `Edit ${S?.label?.toLowerCase() || target.section}`

  return (
    <Modal open onClose={onClose} title={title}
      footer={<>
        {canRemove && <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={remove} disabled={busy}><Trash2 className="w-4 h-4" />Remove</Button>}
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="inline-editor" variant="accent" disabled={busy || !form}>{busy ? 'Saving…' : 'Save & publish'}</Button>
      </>}>
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!form && !err && <p className="text-sm text-muted-foreground">Loading…</p>}
      {form && (
        <form id="inline-editor" onSubmit={save} className="space-y-4">
          {S.fields.map(f => <FieldFor key={f.k} f={f} value={form[f.k]} onChange={v => setForm(x => ({ ...x, [f.k]: v }))} />)}
          <p className="text-xs text-muted-foreground">Saving publishes to the live site immediately.</p>
        </form>
      )}
    </Modal>
  )
}

function FieldFor({ f, value, onChange }) {
  if (f.type === 'icon') { const Icon = statIcon(value); return (
    <Field label={f.label}><div className="flex items-center gap-2"><span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span><Select value={value || 'Award'} onChange={e => onChange(e.target.value)}>{STAT_ICON_NAMES.map(n => <option key={n} value={n}>{n.replace(/([a-z])([A-Z])/g, '$1 $2')}</option>)}</Select></div></Field>
  ) }
  if (f.type === 'textarea') return <Field label={f.label} hint={f.hint}><Textarea rows={f.rows || 4} maxLength={f.maxLength} value={value ?? ''} onChange={e => onChange(e.target.value)} /></Field>
  if (f.type === 'number') return <Field label={f.label} hint={f.hint}><Input type="number" min="0" step="1" value={value ?? ''} onChange={e => onChange(e.target.value)} /></Field>
  if (f.type === 'image') return <Field label={f.label} hint="JPEG, PNG or WebP; uploads go to the media library">{value && <img src={value} alt="" className="w-full max-h-48 object-cover rounded-xl border border-border mb-2" />}<ImageUpload value={value || ''} onChange={onChange} /></Field>
  if (f.type === 'rating') return <Field label={f.label}><Select value={String(value ?? 5)} onChange={e => onChange(Number(e.target.value))}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</Select></Field>
  if (f.type === 'code') return (
    <Field label={f.label} hint="ISO country code, e.g. GB, NL, GH"><div className="flex items-center gap-3"><span className="w-12 h-9 rounded-md overflow-hidden border border-border/50 bg-muted shrink-0">{value?.length === 2 && <img src={flagSrc(value)} onError={onFlagError(value)} alt="" className="w-full h-full object-cover" />}</span><Input value={value ?? ''} maxLength={2} className="uppercase w-28" onChange={e => onChange(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))} /></div></Field>
  )
  return <Field label={f.label} hint={f.hint}><Input maxLength={f.maxLength} value={value ?? ''} onChange={e => onChange(e.target.value)} /></Field>
}
