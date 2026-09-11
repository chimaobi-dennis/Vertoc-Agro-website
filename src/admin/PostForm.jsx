import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Button, Card, Field, Input, Textarea, Select, PageHeader, Alert } from './ui'
import ImageUpload from './ImageUpload'
import { Bone } from '../components/Skeleton'

const slugify = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = { title: '', slug: '', excerpt: '', body: '', category: 'Insights', image: '', author: 'Vertoc Editorial Team',
  read_time: '5 min read', status: 'published', published_at: today() }

/* Mirrors the public BlogPost renderer: blank-line blocks, "## " = heading. */
function Preview({ text }) {
  const blocks = (text || '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  if (!blocks.length) return <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
  return blocks.map((b, i) => b.startsWith('## ')
    ? <h2 key={i} className="font-serif text-xl font-bold text-foreground mt-6 mb-2">{b.slice(3)}</h2>
    : <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3">{b}</p>)
}

export default function PostForm() {
  const { slug } = useParams(); const editing = Boolean(slug)
  const nav = useNavigate()
  const [f, setF] = useState(EMPTY); const [slugDirty, setSlugDirty] = useState(editing)
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(editing); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)

  useEffect(() => {
    if (!editing) return
    adminFetch(`/posts/${slug}`).then(p => setF({ ...EMPTY, ...p })).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [slug, editing])

  const set = k => e => setF(x => ({ ...x, [k]: e.target.value, ...(k === 'title' && !slugDirty ? { slug: slugify(e.target.value) } : {}) }))

  const submit = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    const body = { ...f }; delete body.id; delete body.created_at; delete body.updated_at
    try {
      if (editing) await adminFetch(`/posts/${slug}`, { method: 'PATCH', body })
      else await adminFetch('/posts', { method: 'POST', body })
      nav('/staff360/posts')
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  if (loading) return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <Bone className="h-4 w-24" /><Bone className="h-9 w-64" />
      <div className="bg-card border border-border rounded-2xl p-6 grid md:grid-cols-2 gap-5">
        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={i < 2 ? 'md:col-span-2' : ''}><Bone className="h-4 w-24 mb-2" /><Bone className="h-11 w-full" /></div>)}
      </div>
    </div>
  )

  return (
    <>
      <Link to="/staff360/posts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Blog</Link>
      <PageHeader title={editing ? 'Edit post' : 'New post'} />
      <form onSubmit={submit} className="space-y-6 max-w-4xl">
        {err && <Alert>{err}</Alert>}
        <Card className="p-6 grid md:grid-cols-2 gap-5">
          <Field label="Title *" className="md:col-span-2"><Input required value={f.title} onChange={set('title')} /></Field>
          <Field label="Slug"><Input value={f.slug} onChange={e => { setSlugDirty(true); set('slug')(e) }} /></Field>
          <Field label="Category"><Input value={f.category} onChange={set('category')} /></Field>
          <Field label="Excerpt" hint="Shown on the blog listing" className="md:col-span-2"><Textarea rows={2} value={f.excerpt} onChange={set('excerpt')} /></Field>
          <Field label="Cover image" className="md:col-span-2"><ImageUpload value={f.image} onChange={v => setF(x => ({ ...x, image: v }))} /></Field>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Body</span>
            <div className="flex rounded-full border border-border overflow-hidden text-xs font-semibold">
              <button type="button" onClick={() => setPreview(false)} className={`px-3 py-1.5 ${!preview ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Write</button>
              <button type="button" onClick={() => setPreview(true)} className={`px-3 py-1.5 ${preview ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Preview</button>
            </div>
          </div>
          {preview ? <div className="min-h-[300px]"><Preview text={f.body} /></div>
            : <Textarea rows={16} value={f.body} onChange={set('body')} placeholder={'Write in plain paragraphs separated by a blank line.\n\n## Use two hashes for a subheading'} className="font-mono text-xs" />}
        </Card>
        <Card className="p-6 grid md:grid-cols-4 gap-5">
          <Field label="Author"><Input value={f.author} onChange={set('author')} /></Field>
          <Field label="Read time"><Input value={f.read_time} onChange={set('read_time')} /></Field>
          <Field label="Published"><Input type="date" value={f.published_at} onChange={set('published_at')} /></Field>
          <Field label="Status"><Select value={f.status} onChange={set('status')}><option value="published">Published</option><option value="draft">Draft</option></Select></Field>
        </Card>
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Publish post'}</Button>
          <Link to="/staff360/posts"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </>
  )
}
