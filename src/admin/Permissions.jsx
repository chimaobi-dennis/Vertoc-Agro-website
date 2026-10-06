/*
 * Roles and permissions: the module × action table, and the page section
 * where roles are read, copied, created and edited. The server holds the
 * table (GET /roles) and enforces it; this only draws it.
 */
import { useCallback, useEffect, useState } from 'react'
import { Copy, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert, Badge, Button, Card, Field, Input, useToast } from './ui'
import { Bone } from '../components/Skeleton'

const same = (a, b) => JSON.stringify(normal(a)) === JSON.stringify(normal(b))
const normal = p => Object.fromEntries(Object.keys(p || {}).sort().filter(k => p[k]?.length).map(k => [k, [...p[k]].sort()]))

/** Tick boxes, one row per module, one column per action. `value` is { module: [actions] }. */
export function PermissionMatrix({ modules, actions, value, onChange, disabled = false }) {
  const has = (m, a) => Boolean(value?.[m]?.includes(a))
  const toggle = (m, a) => {
    const cur = new Set(value?.[m] || [])
    if (cur.has(a)) { cur.delete(a); if (a === 'view') cur.clear() }      // nothing works without seeing the module
    else { cur.add(a); cur.add('view') }
    onChange({ ...value, [m.key ?? m]: [...cur] })
  }
  const row = (m, on) => onChange({ ...value, [m.key]: on ? [...m.actions] : [] })
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-semibold">Module</th>
            {actions.map(a => <th key={a.key} className="px-2 py-2.5 font-semibold text-center">{a.label}</th>)}
            <th className="px-3 py-2.5 font-semibold text-center">All</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {modules.map(m => { const all = m.actions.every(a => has(m.key, a)); return (
            <tr key={m.key} className="hover:bg-muted/30">
              <th scope="row" className="px-4 py-2.5 text-left font-medium min-w-[190px]">{m.label}{m.hint && <span className="block text-xs font-normal text-muted-foreground">{m.hint}</span>}</th>
              {actions.map(a => (
                <td key={a.key} className="px-2 py-2.5 text-center">
                  {m.actions.includes(a.key)
                    ? <input type="checkbox" className="w-4 h-4 accent-[hsl(var(--accent))]" checked={has(m.key, a.key)} disabled={disabled} onChange={() => toggle(m.key, a.key)} aria-label={`${m.label}: ${a.label}`} />
                    : <span className="text-muted-foreground/40" aria-hidden="true">·</span>}
                </td>
              ))}
              <td className="px-3 py-2.5 text-center"><input type="checkbox" className="w-4 h-4" checked={all} disabled={disabled} onChange={e => row(m, e.target.checked)} aria-label={`${m.label}: everything`} /></td>
            </tr>
          ) })}
        </tbody>
      </table>
    </div>
  )
}

/** Short reading of a permission set: "Bidding, LPO / PO, Suppliers +2". */
export const summarise = (perms, modules) => { const on = modules.filter(m => perms?.[m.key]?.length).map(m => m.label); return on.length === modules.length ? 'Every module' : on.length ? `${on.slice(0, 4).join(', ')}${on.length > 4 ? ` +${on.length - 4}` : ''}` : 'Nothing yet' }

/** Loads the roles table once for a page. */
export function useRoles() {
  const [data, setData] = useState(null); const [err, setErr] = useState(null)
  const load = useCallback(() => adminFetch('/roles').then(d => { setData(d); setErr(null); return d }).catch(e => { setErr(e.message); return null }), [])
  useEffect(() => { load() }, [load])
  return { data, err, reload: load }
}

export function RolesPanel() {
  const { can } = useAuth()
  const manage = can('staff', 'manage')
  const { data, err, reload } = useRoles()
  const [openKey, setOpenKey] = useState(null)
  const [draft, setDraft] = useState(null)        // { key|null, name, description, permissions }
  const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()

  const roles = data?.roles || []
  const open = roles.find(r => r.key === openKey) || null
  const start = (r, copy = false) => { setOpenKey(copy ? null : r?.key ?? null); setDraft(r ? { key: copy ? null : r.key, name: copy ? `${r.name} (copy)` : r.name, description: r.description || '', permissions: { ...r.permissions }, system: copy ? false : r.system } : { key: null, name: '', description: '', permissions: {}, system: false }) }
  const save = async e => {
    e.preventDefault(); setBusy(true)
    try {
      const body = { name: draft.name, description: draft.description, permissions: draft.permissions }
      const r = draft.key ? await adminFetch(`/roles/${draft.key}`, { method: 'PATCH', body }) : await adminFetch('/roles', { method: 'POST', body })
      toast(draft.key ? 'Role saved. It applies to everyone with this role from their next click.' : 'Role created'); await reload(); setOpenKey(r.key); setDraft({ key: r.key, name: r.name, description: r.description || '', permissions: r.permissions || {}, system: false })
    } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!window.confirm(`Delete the role "${draft.name}"? This cannot be undone.`)) return
    try { await adminFetch(`/roles/${draft.key}`, { method: 'DELETE' }); toast('Role deleted'); setDraft(null); setOpenKey(null); reload() } catch (x) { toast(x.message, 'error') }
  }

  if (err) return <Alert>{err}</Alert>
  if (!data) return <Card className="p-6 space-y-3">{[0, 1, 2, 3].map(i => <Bone key={i} className="h-12 w-full" />)}</Card>
  const dirty = draft && !draft.system && (!draft.key || !open || draft.name !== open.name || draft.description !== (open.description || '') || !same(draft.permissions, open.permissions))

  return (
    <div className="grid xl:grid-cols-[340px_1fr] gap-6 items-start">
      <Card className="animate-fade-up">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3"><h2 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" />Roles</h2>{manage && <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => start(null)}><Plus className="w-3.5 h-3.5" />New role</Button>}</div>
        <ul className="divide-y divide-border">
          {roles.map(r => (
            <li key={r.key}><button type="button" onClick={() => start(r)} className={`w-full text-left px-5 py-3 hover:bg-muted/40 ${draft?.key === r.key ? 'bg-accent/5' : ''}`}>
              <span className="flex items-center gap-2 text-sm font-semibold">{r.name}{r.system ? <Badge>built-in</Badge> : <Badge tone="accent">custom</Badge>}<span className="ml-auto text-xs font-normal text-muted-foreground">{r.staff} staff</span></span>
              <span className="block text-xs text-muted-foreground mt-0.5">{r.description || summarise(r.permissions, data.modules)}</span>
            </button></li>
          ))}
        </ul>
      </Card>

      {!draft ? <Card className="p-8 text-sm text-muted-foreground animate-fade-up">Choose a role to see exactly what it may do, module by module. Built-in roles cannot be changed; copy one to adjust it, or create a role from nothing.</Card> : (
        <form onSubmit={save}>
          <Card className="p-6 space-y-5 animate-fade-up">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold">{draft.key ? draft.name : 'New role'}</h2><p className="text-xs text-muted-foreground mt-0.5">{draft.system ? 'Built-in role: read only.' : 'Tick what people with this role may do. View is needed for anything else in a module.'}</p></div>
              {draft.system && manage && <Button type="button" variant="outline" className="h-9" onClick={() => start(open, true)}><Copy className="w-4 h-4" />Copy into a new role</Button>}
            </div>
            {!draft.system && (
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Role name"><Input required maxLength={60} value={draft.name} disabled={!manage} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Warehouse supervisor" /></Field>
                <Field label="Description"><Input maxLength={300} value={draft.description} disabled={!manage} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="What this role is for" /></Field>
              </div>
            )}
            <PermissionMatrix modules={data.modules} actions={data.actions} value={draft.permissions} disabled={draft.system || !manage} onChange={permissions => setDraft({ ...draft, permissions })} />
            {!manage && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />Only staff with the “Staff: Manage” permission can change roles.</p>}
            {!draft.system && manage && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {draft.key ? <Button type="button" variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="w-4 h-4" />Delete role</Button> : <span />}
                <Button type="submit" variant="accent" disabled={busy || !dirty}>{busy ? 'Saving…' : draft.key ? 'Save role' : 'Create role'}</Button>
              </div>
            )}
          </Card>
        </form>
      )}
      {toastEl}
    </div>
  )
}
