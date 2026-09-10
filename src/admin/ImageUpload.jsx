import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Button, Input } from './ui'

/** URL field with an upload button. Files go to the backend as base64 JSON. */
export default function ImageUpload({ value, onChange }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const pick = async e => {
    const file = e.target.files?.[0]; if (!file) return
    setErr(null); setBusy(true)
    try {
      const data = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file)
      })
      const { url } = await adminFetch('/upload', { method: 'POST', body: { filename: file.name, contentType: file.type, data } })
      onChange(url)
    } catch (e) { setErr(e.message) } finally { setBusy(false); e.target.value = '' }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="/assets/img/… or https://…" />
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={pick} disabled={busy} />
        <Button type="button" variant="outline" className="shrink-0" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" />{busy ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
      {value && <img src={value} alt="" className="h-24 w-36 object-cover rounded-lg border border-border" />}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}
