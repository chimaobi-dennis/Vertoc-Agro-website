import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Button, Card, Field, Input, Textarea, Select, PageHeader, Alert } from './ui'
import ImageUpload from './ImageUpload'
import { Bone } from '../components/Skeleton'

const slugify = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const toList = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean)
const fromList = a => (a || []).join(', ')

const EMPTY = { name: '', slug: '', category: 'Agro', summary: '', description: '', image: '', origin: '', processing: '',
  packaging: '', moq: '', grade: '', hs_code: '', applications: '', certifications: '', featured: false, status: 'published', sort_order: 0 }

export default function ProductForm() {
  const { slug } = useParams(); const editing = Boolean(slug)
  const nav = useNavigate()
  const [f, setF] = useState(EMPTY); const [slugDirty, setSlugDirty] = useState(editing)
  const [loading, setLoading] = useState(editing); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null)

  useEffect(() => {
    if (!editing) return
    adminFetch(`/products/${slug}`)
      .then(p => setF({ ...EMPTY, ...p, applications: fromList(p.applications), certifications: fromList(p.certifications) }))
      .catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [slug, editing])

  const set = k => e => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setF(x => ({ ...x, [k]: v, ...(k === 'name' && !slugDirty ? { slug: slugify(v) } : {}) }))
  }

  const submit = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    const body = { ...f, applications: toList(f.applications), certifications: toList(f.certifications), sort_order: Number(f.sort_order) || 0 }
    delete body.id; delete body.created_at; delete body.updated_at; delete body.specs
    try {
      if (editing) await adminFetch(`/products/${slug}`, { method: 'PATCH', body })
      else await adminFetch('/products', { method: 'POST', body })
      nav('/admin/products')
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
      <Link to="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Products</Link>
      <PageHeader title={editing ? `Edit ${f.name}` : 'New product'} />
      <form onSubmit={submit} className="space-y-6 max-w-4xl">
        {err && <Alert>{err}</Alert>}
        <Card className="p-6 grid md:grid-cols-2 gap-5">
          <Field label="Name *" className="md:col-span-2"><Input required value={f.name} onChange={set('name')} /></Field>
          <Field label="Slug" hint="URL path, e.g. /products/cocoa"><Input value={f.slug} onChange={e => { setSlugDirty(true); set('slug')(e) }} /></Field>
          <Field label="Category"><Input value={f.category} onChange={set('category')} /></Field>
          <Field label="Summary" hint="Short blurb on the listing card" className="md:col-span-2"><Input value={f.summary} onChange={set('summary')} /></Field>
          <Field label="Description" className="md:col-span-2"><Textarea rows={5} value={f.description} onChange={set('description')} /></Field>
          <Field label="Image" className="md:col-span-2"><ImageUpload value={f.image} onChange={v => setF(x => ({ ...x, image: v }))} /></Field>
        </Card>
        <Card className="p-6 grid md:grid-cols-2 gap-5">
          <Field label="Origin"><Input value={f.origin} onChange={set('origin')} /></Field>
          <Field label="Processing"><Input value={f.processing} onChange={set('processing')} /></Field>
          <Field label="Packaging"><Input value={f.packaging} onChange={set('packaging')} /></Field>
          <Field label="MOQ"><Input value={f.moq} onChange={set('moq')} placeholder="e.g. 20 Metric Tonnes" /></Field>
          <Field label="Grade / Spec"><Input value={f.grade} onChange={set('grade')} /></Field>
          <Field label="HS Code"><Input value={f.hs_code} onChange={set('hs_code')} /></Field>
          <Field label="Applications" hint="Comma-separated" className="md:col-span-2"><Input value={f.applications} onChange={set('applications')} /></Field>
          <Field label="Certifications" hint="Comma-separated" className="md:col-span-2"><Input value={f.certifications} onChange={set('certifications')} /></Field>
        </Card>
        <Card className="p-6 grid md:grid-cols-3 gap-5 items-end">
          <Field label="Status"><Select value={f.status} onChange={set('status')}><option value="published">Published</option><option value="draft">Draft</option></Select></Field>
          <Field label="Sort order"><Input type="number" value={f.sort_order} onChange={set('sort_order')} /></Field>
          <label className="flex items-center gap-2 h-10 text-sm font-medium"><input type="checkbox" checked={f.featured} onChange={set('featured')} className="w-4 h-4" />Featured (HOT)</label>
        </Card>
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</Button>
          <Link to="/admin/products"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </>
  )
}
