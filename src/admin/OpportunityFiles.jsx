/*
 * Pictures and papers of an investment opportunity: one cover image, and any
 * number of documents (fact sheet, terms and conditions, disclaimer …), each
 * with an optional label that investors see instead of the file name.
 * On a new opportunity nothing exists yet to attach to, so files are staged
 * in `stage` and the form uploads them once the opportunity is saved.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, FileText, ImagePlus, Paperclip, Trash2, Upload } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { ACCEPT, ACCEPT_IMAGE, documentUrl, openDocument, uploadDocument } from './documents'
import { fmtBytes } from './format'
import { Alert, Button, Card, Input } from './ui'

export const COVER_LABEL = 'Cover image'
export const LABEL_SUGGESTIONS = ['Terms and conditions', 'Disclaimer', 'Fact sheet', 'Legal terms of investment', 'Risk disclosure', 'Prospectus']

/** Upload what was staged on a new opportunity. Returns the names that failed. */
export async function uploadStaged(oppId, stage) {
  const failed = []
  if (stage.cover) { try { await uploadDocument(stage.cover, { opportunity_id: oppId, label: COVER_LABEL }) } catch (e) { failed.push(`${stage.cover.name}: ${e.message}`) } }
  for (const d of stage.docs) { try { await uploadDocument(d.file, { opportunity_id: oppId, label: d.label }) } catch (e) { failed.push(`${d.file.name}: ${e.message}`) } }
  return failed
}
export const EMPTY_STAGE = { cover: null, docs: [] }

function Cover({ oppId, cover, stage, setStage, onChanged, disabled }) {
  const pick = useRef(null)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [url, setUrl] = useState(null)
  const staged = stage.cover
  const preview = useMemo(() => (staged ? URL.createObjectURL(staged) : null), [staged])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => { let alive = true; setUrl(null); if (cover) documentUrl(cover.id).then(u => alive && setUrl(u)).catch(() => {}); return () => { alive = false } }, [cover?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async file => {
    if (!file) return; setErr(null)
    if (!oppId) return setStage(s => ({ ...s, cover: file }))
    setBusy(true)
    try {
      await uploadDocument(file, { opportunity_id: oppId, label: COVER_LABEL })
      if (cover) await adminFetch(`/documents/${cover.id}`, { method: 'DELETE' }).catch(() => {})
      onChanged()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!oppId) return setStage(s => ({ ...s, cover: null }))
    if (!window.confirm('Remove the cover image?')) return
    setBusy(true); try { await adminFetch(`/documents/${cover.id}`, { method: 'DELETE' }); onChanged() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const shown = preview || url
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold mb-1">Cover image</h2>
      <p className="text-xs text-muted-foreground mb-3">Shown at the top of the opportunity in the investor portal. Optional.</p>
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-44 h-28 rounded-xl border border-dashed border-border bg-muted/40 overflow-hidden flex items-center justify-center text-muted-foreground">
          {shown ? <img src={shown} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-6 h-6" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={pick} type="file" accept={ACCEPT_IMAGE} className="sr-only" onChange={e => { choose(e.target.files[0]); e.target.value = '' }} />
          {!disabled && <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => pick.current?.click()}><Upload className="w-4 h-4" />{busy ? 'Uploading…' : shown ? 'Replace image' : 'Add an image'}</Button>}
          {!disabled && shown && <Button type="button" variant="ghost" className="h-9 text-destructive" disabled={busy} onClick={remove}><Trash2 className="w-4 h-4" />Remove</Button>}
        </div>
      </div>
    </Card>
  )
}

export default function OpportunityFiles({ oppId = null, cover = null, documents = [], onChanged = () => {}, stage, setStage, disabled = false }) {
  const pick = useRef(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState([]); const [err, setErr] = useState(null)
  const [labels, setLabels] = useState({})            // edits in progress: id -> text

  const add = async files => {
    setErr(null)
    if (!oppId) return setStage(s => ({ ...s, docs: [...s.docs, ...files.map(file => ({ file, label: label.trim() }))] }))
    for (const file of files) {
      setBusy(b => [...b, file.name])
      try { await uploadDocument(file, { opportunity_id: oppId, label: label.trim() }); onChanged() }
      catch (e) { setErr(`${file.name}: ${e.message}`) }
      setBusy(b => b.filter(n => n !== file.name))
    }
  }
  const saveLabel = async d => {
    const v = (labels[d.id] ?? d.label ?? '').trim()
    setLabels(l => { const { [d.id]: _, ...rest } = l; return rest })
    if (v === (d.label || '')) return
    try { await adminFetch(`/documents/${d.id}`, { method: 'PATCH', body: { label: v } }); onChanged() } catch (e) { setErr(e.message) }
  }
  const remove = async d => { if (!window.confirm(`Delete "${d.label || d.name}"? This cannot be undone.`)) return; try { await adminFetch(`/documents/${d.id}`, { method: 'DELETE' }); onChanged() } catch (e) { setErr(e.message) } }

  return (
    <div className="space-y-6">
      <Cover oppId={oppId} cover={cover} stage={stage} setStage={setStage} onChanged={onChanged} disabled={disabled} />
      <Card>
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold">Fact sheet and legal documents</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Investors read these before they apply, and agree to them when they do. Name each one (for example Terms and conditions, Disclaimer); the label is optional and the file name is shown without it.</p>
        </div>
        {err && <div className="px-5 pt-4"><Alert>{err}</Alert></div>}
        <ul className="divide-y divide-border">
          {documents.map(d => (
            <li key={d.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-[200px]">
                <Input list="opp-labels" disabled={disabled} className="h-9" placeholder="Label (optional)" value={labels[d.id] ?? d.label ?? ''} onChange={e => setLabels(l => ({ ...l, [d.id]: e.target.value }))} onBlur={() => saveLabel(d)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())} />
                <span className="block text-xs text-muted-foreground mt-1 truncate">{d.name} · {fmtBytes(d.bytes)}</span>
              </div>
              <button type="button" onClick={() => openDocument(d.id).catch(e => setErr(e.message))} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" title="Open" aria-label="Open"><ExternalLink className="w-4 h-4" /></button>
              {!disabled && <button type="button" onClick={() => remove(d)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted" title="Delete" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>}
            </li>
          ))}
          {stage.docs.map((d, i) => (
            <li key={`${d.file.name}-${i}`} className="px-5 py-3 flex items-center gap-3 text-sm bg-accent/5">
              <Paperclip className="w-4 h-4 text-accent shrink-0" />
              <span className="flex-1 min-w-0 truncate"><span className="font-medium">{d.label || d.file.name}</span><span className="block text-xs text-muted-foreground">{d.file.name} · uploads when you save</span></span>
              <button type="button" onClick={() => setStage(s => ({ ...s, docs: s.docs.filter((_, j) => j !== i) }))} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
          {busy.map(n => <li key={n} className="px-5 py-3 text-sm text-muted-foreground">{n} · uploading…</li>)}
          {!documents.length && !stage.docs.length && !busy.length && <li className="px-5 py-6 text-center text-sm text-muted-foreground">No documents yet.</li>}
        </ul>
        {!disabled && (
          <div className="px-5 py-4 border-t border-border flex flex-wrap items-center gap-3">
            <Input list="opp-labels" className="h-10 max-w-xs" placeholder="Label for the next file (optional)" value={label} onChange={e => setLabel(e.target.value)} />
            <input ref={pick} type="file" multiple accept={ACCEPT} className="sr-only" onChange={e => { add([...e.target.files]); e.target.value = '' }} />
            <Button type="button" variant="outline" onClick={() => pick.current?.click()}><Upload className="w-4 h-4" />Add a document</Button>
            <span className="text-xs text-muted-foreground">PDF, Word, Excel, images or text · up to 20 MB each</span>
          </div>
        )}
        <datalist id="opp-labels">{LABEL_SUGGESTIONS.map(l => <option key={l} value={l} />)}</datalist>
      </Card>
    </div>
  )
}
