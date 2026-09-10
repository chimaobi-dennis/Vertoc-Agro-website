import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, Plus, Search, Settings2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Button, Card, Input, PageHeader, Table, Td } from './ui'
import { Bone } from '../components/Skeleton'

// jsPDF is ~650 KB; pull the export module in only when someone actually
// exports, so it never ships with the admin chunk itself.
const exportAs = (kind, cols, rows) =>
  import('./exports').then(m => kind === 'csv'
    ? m.downloadCsv('vertoc-clients.csv', cols, rows)
    : m.downloadPdf('vertoc-clients.pdf', 'Vertoc Agro — Clients', cols, rows))

const display = (f, v) => (f.type === 'checkbox' ? (v ? 'Yes' : 'No') : (v ?? ''))

export default function ClientsAdmin() {
  const [fields, setFields] = useState(null)
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('active')

  useEffect(() => { adminFetch('/client-fields').then(setFields).catch(e => setErr(e.message)) }, [])
  useEffect(() => { setRows(null); adminFetch(`/clients?status=${status}`).then(setRows).catch(e => setErr(e.message)) }, [status])

  const cols = useMemo(() => (fields || []).filter(f => f.show_in_list), [fields])
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase(); const all = rows || []
    if (!s) return all
    return all.filter(r => r.name.toLowerCase().includes(s) || Object.values(r.data || {}).some(v => String(v).toLowerCase().includes(s)))
  }, [rows, q])
  const exportCols = [
    { label: 'Name', get: r => r.name },
    ...(fields || []).map(f => ({ label: f.label, get: r => display(f, r.data?.[f.key]) })),
    { label: 'Status', get: r => r.status },
    { label: 'Added', get: r => (r.created_at || '').slice(0, 10) },
  ]
  const ready = rows && fields

  return (
    <>
      <PageHeader eyebrow="CRM" title="Clients" description={ready ? `${visible.length} of ${rows.length} ${status}` : ' '}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/clients/fields"><Button variant="outline"><Settings2 className="w-4 h-4" />Fields</Button></Link>
            <Button variant="outline" disabled={!visible.length} onClick={() => exportAs('csv', exportCols, visible)}><Download className="w-4 h-4" />CSV</Button>
            <Button variant="outline" disabled={!visible.length} onClick={() => exportAs('pdf', exportCols, visible)}><FileText className="w-4 h-4" />PDF</Button>
            <Link to="/admin/clients/new"><Button variant="accent"><Plus className="w-4 h-4" />New client</Button></Link>
          </div>
        } />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-10" placeholder="Search clients…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex rounded-xl border border-border overflow-hidden text-xs font-semibold">
          {['active', 'archived'].map(s => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3.5 py-2 capitalize ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{s}</button>
          ))}
        </div>
      </div>

      <Card>
        <Table head={['Name', ...cols.map(c => c.label), '']}>
          {!ready && [0, 1, 2, 3].map(i => (
            <tr key={i}>{[...Array(cols.length + 2)].map((_, j) => <Td key={j}><Bone className="h-4 w-24" /></Td>)}</tr>
          ))}
          {ready && visible.map(r => (
            <tr key={r.id} className="hover:bg-muted/40">
              <Td><Link to={`/admin/clients/${r.id}`} className="font-medium hover:text-accent">{r.name}</Link></Td>
              {cols.map(c => <Td key={c.key} className="text-muted-foreground">{display(c, r.data?.[c.key])}</Td>)}
              <Td className="text-right"><Link to={`/admin/clients/${r.id}`} className="text-xs font-semibold text-accent">Open →</Link></Td>
            </tr>
          ))}
          {ready && !visible.length && (
            <tr><Td colSpan={cols.length + 2} className="text-center py-12 text-muted-foreground">
              {q ? 'No clients match your search.' : status === 'archived' ? 'No archived clients.' : 'No clients yet — add your first one.'}
            </Td></tr>
          )}
        </Table>
      </Card>
    </>
  )
}
