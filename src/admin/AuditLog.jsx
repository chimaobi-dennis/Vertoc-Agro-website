import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminApi'
import { Card, PageHeader, Table, Td, Badge, Alert } from './ui'
import { Bone } from '../components/Skeleton'

const TONE = { create: 'green', update: 'blue', delete: 'red', invite: 'amber', upload: 'muted' }

export default function AuditLog() {
  const [rows, setRows] = useState(null); const [err, setErr] = useState(null); const [open, setOpen] = useState(null)
  useEffect(() => { adminFetch('/audit?limit=200').then(setRows).catch(e => setErr(e.message)) }, [])

  return (
    <>
      <PageHeader title="Audit log" description="Every change made through the panel or by Claude via MCP." />
      {err && <Alert>{err}</Alert>}
      <Card>
        <Table head={['When', 'Who', 'Action', 'Entity', '']}>
          {!rows && [0, 1, 2, 3].map(i => <tr key={i}>{[0, 1, 2, 3, 4].map(j => <Td key={j}><Bone className="h-4 w-24" /></Td>)}</tr>)}
          {rows?.map(r => (
            <>
              <tr key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} className="cursor-pointer hover:bg-muted/40">
                <Td className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.at).toLocaleString()}</Td>
                <Td>{r.actor_label === 'mcp' ? <Badge tone="blue">Claude (MCP)</Badge> : r.actor_label}</Td>
                <Td><Badge tone={TONE[r.action] || 'muted'}>{r.action}</Badge></Td>
                <Td><span className="font-medium">{r.entity}</span> <span className="text-muted-foreground text-xs">{r.entity_id}</span></Td>
                <Td className="text-xs text-muted-foreground text-right">{open === r.id ? '▲' : '▼'}</Td>
              </tr>
              {open === r.id && (
                <tr key={`${r.id}-d`}><Td colSpan={5} className="bg-muted/30">
                  <div className="grid md:grid-cols-2 gap-4 text-xs">
                    <div><p className="font-semibold mb-1">Before</p><pre className="whitespace-pre-wrap break-all">{r.before ? JSON.stringify(r.before, null, 2) : '—'}</pre></div>
                    <div><p className="font-semibold mb-1">After</p><pre className="whitespace-pre-wrap break-all">{r.after ? JSON.stringify(r.after, null, 2) : '—'}</pre></div>
                  </div>
                </Td></tr>
              )}
            </>
          ))}
          {rows?.length === 0 && <tr><Td colSpan={5} className="text-center text-muted-foreground py-10">No activity yet.</Td></tr>}
        </Table>
      </Card>
    </>
  )
}
