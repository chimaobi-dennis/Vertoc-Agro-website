import { useEffect, useRef, useState } from 'react'
import { ExternalLink, FileText, Image as ImageIcon, RefreshCw, Trash2, Upload } from 'lucide-react'
import { ACCEPT, ACCEPT_IMAGE, documentUrl, openDocument, uploadDocument } from './documents'
import { Bone } from '../components/Skeleton'

/** Signed-URL thumbnail for an image document. */
export function Thumb({ id, className = 'h-16 w-24' }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { let alive = true; documentUrl(id).then(u => alive && setUrl(u)).catch(() => {}); return () => { alive = false } }, [id])
  return url
    ? <img src={url} alt="" className={`${className} object-cover rounded-lg border border-border bg-muted`} />
    : <Bone className={`${className} rounded-lg`} />
}

/**
 * Value of an `image` or `file` custom field: `{ id, name }` pointing at a
 * document. Uploads go to the client/quote the record belongs to (`scope`);
 * before the record exists they are adopted by it on save.
 */
export default function FileField({ field, value, onChange, scope = {} }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const image = field.type === 'image'

  const pick = async e => {
    const file = e.target.files?.[0]; if (!file) return
    setErr(null); setBusy(true)
    try { const d = await uploadDocument(file, scope); onChange({ id: d.id, name: d.name }) }
    catch (x) { setErr(x.message) } finally { setBusy(false); e.target.value = '' }
  }

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept={image ? ACCEPT_IMAGE : ACCEPT} className="sr-only" onChange={pick} disabled={busy} />
      {busy ? (
        <div className="flex items-center gap-3 h-11 px-3.5 rounded-xl border border-border bg-card"><Bone className="h-3 w-40" /><span className="text-xs text-muted-foreground ml-auto">Uploading…</span></div>
      ) : value?.id ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 pr-3">
          {image ? <Thumb id={value.id} className="h-12 w-16" /> : <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></div>}
          <span className="text-sm font-medium truncate flex-1 min-w-0">{value.name}</span>
          <button type="button" onClick={() => openDocument(value.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" title="Open" aria-label="Open"><ExternalLink className="w-4 h-4" /></button>
          <button type="button" onClick={() => ref.current?.click()} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" title="Replace" aria-label="Replace"><RefreshCw className="w-4 h-4" /></button>
          <button type="button" onClick={() => onChange(null)} className="p-1.5 rounded-lg text-destructive hover:bg-muted" title="Remove" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm font-medium text-muted-foreground hover:border-accent hover:text-accent transition-colors">
          {image ? <ImageIcon className="w-4 h-4" /> : <Upload className="w-4 h-4" />}{image ? 'Upload image' : 'Upload file'}
        </button>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}
