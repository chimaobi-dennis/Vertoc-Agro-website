import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'

export default function TemplateEditor() {
  const { key } = useParams()
  const [t, setT] = useState(null)
  const [form, setForm] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const bodyRef = useRef(null)
  const [toast, toastEl] = useToast()

  useEffect(() => { adminFetch(`/templates/${key}`).then(x => { setT(x); setForm({ subject: x.subject, body: x.body, cta_label: x.cta_label, enabled: x.enabled }) }).catch(e => setErr(e.message)) }, [key])

  // Live preview with sample data, debounced.
  useEffect(() => {
    if (!form) return
    const h = setTimeout(() => adminFetch(`/templates/${key}/preview`, { method: 'POST', body: form }).then(setPreview).catch(() => {}), 350)
    return () => clearTimeout(h)
  }, [form, key])

  const dirty = t && form && (form.subject !== t.subject || form.body !== t.body || form.cta_label !== t.cta_label || form.enabled !== t.enabled)
  const save = async e => {
    e.preventDefault(); setBusy(true)
    try { const x = await adminFetch(`/templates/${key}`, { method: 'PUT', body: form }); setT(x); toast('Template saved') } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const reset = async () => {
    if (!window.confirm('Reset this template to the built-in default? Your edits will be lost.')) return
    try { const x = await adminFetch(`/templates/${key}/reset`, { method: 'POST' }); setT(x); setForm({ subject: x.subject, body: x.body, cta_label: x.cta_label, enabled: x.enabled }); toast('Reset to default') } catch (x) { toast(x.message, 'error') }
  }
  const insert = v => {
    const el = bodyRef.current; const token = `{{${v}}}`
    if (!el) return setForm(f => ({ ...f, body: f.body + token }))
    const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s
    const body = el.value.slice(0, s) + token + el.value.slice(e)
    setForm(f => ({ ...f, body })); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length) })
  }
  const hasLink = t?.variables?.includes('link')

  return (
    <>
      <Link to="/staff360/templates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Email templates</Link>
      <PageHeader eyebrow="System" title={t?.name || ' '} description={t?.description}
        action={t && <div className="flex items-center gap-2"><Badge tone={t.is_default ? 'muted' : 'green'}>{t.is_default ? 'default' : 'customised'}</Badge>{!t.is_default && <Button variant="ghost" className="h-9" onClick={reset}><RotateCcw className="w-4 h-4" />Reset to default</Button>}</div>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      {!form ? <Card className="p-6 space-y-4 max-w-3xl"><Bone className="h-11 w-full" /><Bone className="h-48 w-full" /></Card> : (
        <form onSubmit={save} className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-5">
            <Card className="p-6 space-y-5 animate-fade-up">
              <Field label="Subject"><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder={key === 'blank' ? 'Left empty — set when sending' : ''} /></Field>
              <Field label="Body" hint="Plain text. Line breaks become paragraphs; your signature from Settings is added below.">
                <Textarea ref={bodyRef} rows={14} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="font-mono text-[13px]" />
              </Field>
              {hasLink && <Field label="Button text" hint="The button opens the link this email is about (quote page, set-password page…)."><Input value={form.cta_label} onChange={e => setForm({ ...form, cta_label: e.target.value })} /></Field>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />Enabled{!form.enabled && <span className="text-xs text-muted-foreground">— notifications using it will not be sent; compose screens start empty</span>}</label>
              <div className="flex justify-end"><Button type="submit" variant="accent" disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save template'}</Button></div>
            </Card>
            <Card className="p-5 animate-fade-up" style={{ animationDelay: '70ms' }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Placeholders — click to insert</h2>
              <div className="flex flex-wrap gap-1.5">{t.variables.map(v => <button key={v} type="button" onClick={() => insert(v)} className="px-2.5 py-1 rounded-full bg-muted text-xs font-mono hover:bg-accent/15 hover:text-accent">{`{{${v}}}`}</button>)}</div>
              <p className="text-xs text-muted-foreground mt-3">Optional text: <code>{'{{#if quote_title}} for {{quote_title}}{{/if}}'}</code> shows only when that value exists.</p>
            </Card>
          </div>
          <Card className="animate-fade-up lg:sticky lg:top-24" style={{ animationDelay: '120ms' }}>
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between"><h2 className="text-sm font-semibold">Preview with sample data</h2>{preview && <span className="text-xs text-muted-foreground truncate max-w-[60%]">Subject: {preview.subject || '(none)'}</span>}</div>
            {preview ? <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="w-full h-[560px] rounded-b-2xl bg-[#f4f1ec]" /> : <div className="p-6"><Bone className="h-[520px] w-full" /></div>}
          </Card>
        </form>
      )}
      {toastEl}
    </>
  )
}
