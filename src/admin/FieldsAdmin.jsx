import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Button, Card, Field, Input, PageHeader, Select, useToast } from './ui'
import { Bone } from '../components/Skeleton'

export const FIELD_TYPES = [
  ['text', 'Text'], ['textarea', 'Long text'], ['email', 'Email'], ['phone', 'Phone'], ['number', 'Number'],
  ['date', 'Date'], ['select', 'Dropdown'], ['checkbox', 'Checkbox'], ['url', 'Link'], ['image', 'Image'], ['file', 'File'],
]
const EMPTY = { label: '', type: 'text', options: '', required: false, show_in_list: true }
const split = s => String(s).split(',').map(x => x.trim()).filter(Boolean)

/**
 * Manage the user-defined fields of one record type. The same screen serves
 * clients (/client-fields) and quotes (/quote-fields).
 */
export default function FieldsAdmin({ base, eyebrow, title, description, backTo, backLabel, noun }) {
  const [fields, setFields] = useState(null)
  const [err, setErr] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()

  const load = useCallback(() => adminFetch(base).then(setFields).catch(e => setErr(e.message)), [base])
  useEffect(() => { load() }, [load])

  const add = async e => {
    e.preventDefault(); setBusy(true)
    try {
      await adminFetch(base, { method: 'POST', body: { ...form, options: split(form.options) } })
      setForm(EMPTY); toast('Field added'); load()
    } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const patch = async (f, body) => { try { await adminFetch(`${base}/${f.id}`, { method: 'PATCH', body }); load() } catch (x) { toast(x.message, 'error') } }
  const remove = async f => {
    if (!window.confirm(`Remove the "${f.label}" field?\n\nValues already saved on ${noun} stay stored, but will no longer be shown or editable.`)) return
    try { await adminFetch(`${base}/${f.id}`, { method: 'DELETE' }); toast('Field removed'); load() } catch (x) { toast(x.message, 'error') }
  }
  const move = async (i, dir) => {
    const ids = fields.map(f => f.id); const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    try { setFields(await adminFetch(`${base}/order`, { method: 'PUT', body: { ids } })) } catch (x) { toast(x.message, 'error') }
  }

  return (
    <>
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />{backLabel}</Link>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      <Card className="p-6 mb-6 animate-fade-up">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-accent" />Add a field</h2>
        <form onSubmit={add} className="grid md:grid-cols-6 gap-4 items-end">
          <Field label="Label" className="md:col-span-2"><Input required value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Payment terms" /></Field>
          <Field label="Type"><Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          {form.type === 'select' && (
            <Field label="Options" hint="Comma-separated" className="md:col-span-2"><Input value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} placeholder="Net 30, Net 60, Prepaid" /></Field>
          )}
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.required} onChange={e => setForm({ ...form, required: e.target.checked })} />Required</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.show_in_list} onChange={e => setForm({ ...form, show_in_list: e.target.checked })} />Show in table</label>
          </div>
          <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Adding…' : 'Add field'}</Button>
        </form>
      </Card>

      <Card className="animate-fade-up" style={{ animationDelay: '80ms' }}>
        <ul className="divide-y divide-border">
          {!fields && [0, 1, 2].map(i => <li key={i} className="p-5"><Bone className="h-4 w-48" /></li>)}
          {fields?.map((f, i) => (
            <li key={f.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex flex-col gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Input defaultValue={f.label} onBlur={e => e.target.value.trim() && e.target.value.trim() !== f.label && patch(f, { label: e.target.value })} className="h-9 font-medium" />
                <p className="text-[11px] text-muted-foreground mt-1">key: <code>{f.key}</code></p>
              </div>
              <Select value={f.type} onChange={e => patch(f, { type: e.target.value })} className="h-9 w-36">{FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              {f.type === 'select' && (
                <Input defaultValue={(f.options || []).join(', ')} onBlur={e => patch(f, { options: split(e.target.value) })} className="h-9 w-56" placeholder="Options, comma-separated" />
              )}
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={f.required} onChange={e => patch(f, { required: e.target.checked })} />Required</label>
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={f.show_in_list} onChange={e => patch(f, { show_in_list: e.target.checked })} />In table</label>
              <button onClick={() => remove(f)} className="p-2 rounded-lg text-destructive hover:bg-muted ml-auto" title="Remove field" aria-label="Remove field"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
          {fields?.length === 0 && <li className="p-10 text-center text-sm text-muted-foreground">No fields yet. Add your first one above.</li>}
        </ul>
      </Card>
      {toastEl}
    </>
  )
}
