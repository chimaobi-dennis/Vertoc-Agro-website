import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'

export const initialsOf = s => (s || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

/** A person's picture, or their initials. */
export default function Avatar({ src, name, size = 32, className = '' }) {
  const [broken, setBroken] = useState(false)
  const style = { width: size, height: size, fontSize: Math.max(10, size / 3) }
  return src && !broken
    ? <img src={src} alt="" onError={() => setBroken(true)} style={style} className={`rounded-full object-cover shrink-0 ${className}`} />
    : <span style={style} className={`rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 ${className}`}>{initialsOf(name)}</span>
}

/** Avatar with a button to choose a new picture. `endpoint` takes { contentType, data } and answers { url }. */
export function AvatarEditor({ src, name, endpoint, onChanged, size = 88, disabled = false }) {
  const pick = useRef(null)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)
  const choose = async e => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setBusy(true); setErr(null)
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file) })
      const { url } = await adminFetch(endpoint, { method: 'POST', body: { contentType: file.type, data } })
      onChanged?.(url)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center gap-4">
      <Avatar src={src} name={name} size={size} />
      <div>
        <input ref={pick} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choose} />
        {!disabled && <button type="button" disabled={busy} onClick={() => pick.current?.click()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent disabled:opacity-50"><Camera className="w-4 h-4" />{busy ? 'Uploading…' : src ? 'Change picture' : 'Add a picture'}</button>}
        <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG or WebP, up to 4 MB.</p>
        {err && <p className="text-xs text-destructive mt-1">{err}</p>}
      </div>
    </div>
  )
}
