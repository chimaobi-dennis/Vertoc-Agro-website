import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Button, Card, PageHeader, Table, Td, Badge, Alert, useToast, confirmDelete } from './ui'
import { Bone } from '../components/Skeleton'

export default function PostsAdmin() {
  const [rows, setRows] = useState(null); const [err, setErr] = useState(null)
  const [toast, toastEl] = useToast()
  const load = useCallback(() => adminFetch('/posts?status=all').then(setRows).catch(e => setErr(e.message)), [])
  useEffect(() => { load() }, [load])

  const remove = async p => {
    if (!confirmDelete(p.title)) return
    try { await adminFetch(`/posts/${p.slug}`, { method: 'DELETE' }); toast('Post deleted'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <PageHeader title="Blog" description={rows ? `${rows.length} posts` : ' '} />
      <div className="-mt-6 mb-6 flex justify-end">
        <Link to="/admin/posts/new"><Button><Plus className="w-4 h-4" />New post</Button></Link>
      </div>
      {err && <Alert>{err}</Alert>}
      <Card>
        <Table head={['', 'Title', 'Category', 'Status', 'Published', '']}>
          {!rows && [0, 1, 2].map(i => <tr key={i}>{[0, 1, 2, 3, 4, 5].map(j => <Td key={j}><Bone className="h-4 w-24" /></Td>)}</tr>)}
          {rows?.map(p => (
            <tr key={p.slug} className="hover:bg-muted/40">
              <Td><img src={p.image} alt="" className="h-9 w-14 object-cover rounded-md border border-border" /></Td>
              <Td><span className="font-medium">{p.title}</span><div className="text-xs text-muted-foreground">/{p.slug}</div></Td>
              <Td>{p.category}</Td>
              <Td><Badge tone={p.status === 'published' ? 'green' : 'muted'}>{p.status}</Badge></Td>
              <Td className="text-muted-foreground text-xs">{p.published_at}</Td>
              <Td className="text-right whitespace-nowrap">
                <Link to={`/admin/posts/${p.slug}`} className="inline-flex p-2 rounded-md hover:bg-muted" title="Edit"><Pencil className="w-4 h-4" /></Link>
                <button onClick={() => remove(p)} className="inline-flex p-2 rounded-md hover:bg-muted text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </Td>
            </tr>
          ))}
          {rows?.length === 0 && <tr><Td colSpan={6} className="text-center text-muted-foreground py-10">No posts yet.</Td></tr>}
        </Table>
      </Card>
      {toastEl}
    </>
  )
}
