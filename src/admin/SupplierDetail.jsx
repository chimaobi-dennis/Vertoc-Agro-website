/* A supplier record: the profile, and once it exists its bids, purchase
   orders, documents and conversation. */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Archive, ArchiveRestore, ArrowLeft, BadgeCheck, Ban, FileSignature, FolderOpen, Gavel, KeyRound, Mail, Plus, Send, Trash2, UserRound } from 'lucide-react'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Empty, Field, Input, PageHeader, Table, Tabs, Td, Textarea, confirmDelete, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import Composer from './Composer'
import Conversations from './Conversations'
import BidsTable from './BidsTable'
import { DocumentsPanel } from './ClientTabs'
import { DraftNotice, useDraft } from './useDraft'
import { fmtDay, fmtMoment, money, poTone } from '../lib/procurement'

const TABS = [
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'bids', label: 'Bids', icon: Gavel },
  { key: 'orders', label: 'Purchase orders', icon: FileSignature },
  { key: 'documents', label: 'Documents', icon: FolderOpen },
  { key: 'messages', label: 'Messages', icon: Mail },
]
const EMPTY = { company_name: '', contact_person: '', email: '', phone: '', address: '', commodities: '', notes: '' }
const SOURCE = { admin: 'added by your team', bid: 'started by a bid on the website', signup: 'registered on the website' }

export default function SupplierDetail() {
  const { id } = useParams(); const editing = Boolean(id)
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = editing && TABS.some(t => t.key === sp.get('tab')) ? sp.get('tab') : 'profile'
  const { prefill, flash } = useLocation().state || {}
  const [s, setS] = useState(null)
  const [draft, setDraft, draftInfo] = useDraft('supplier:new', null, { enabled: !editing && !prefill })
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(prefill || (!editing && draft) || {}) }))
  useEffect(() => { if (!editing && !prefill) setDraft(form) }, [form, editing]) // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [compose, setCompose] = useState(false)
  const [msgKey, setMsgKey] = useState(0)
  const [toast, toastEl] = useToast()
  const [inviteNow, setInviteNow] = useState(true)
  useEffect(() => { if (flash) toast(flash) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const take = x => { setS(prev => ({ ...prev, ...x })); setForm(Object.fromEntries(Object.keys(EMPTY).map(k => [k, x[k] ?? '']))) }
  useEffect(() => { if (editing) adminFetch(`/suppliers/${id}`).then(take).catch(e => setErr(e.message)) }, [id, editing])
  const setTab = t => { const n = new URLSearchParams(sp); t === 'profile' ? n.delete('tab') : n.set('tab', t); setSp(n, { replace: true }) }
  const bind = k => ({ value: form[k], onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const submit = async e => {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      if (editing) { const { email, ...rest } = form; take(await adminFetch(`/suppliers/${id}`, { method: 'PATCH', body: s.has_account ? rest : form })); toast('Saved') }
      else {
        const c = await adminFetch('/suppliers', { method: 'POST', body: form })
        let flash = null
        if (inviteNow && form.email) { try { await adminFetch(`/suppliers/${c.id}/send-link`, { method: 'POST' }); flash = `Supplier created. Invitation sent to ${form.email}.` } catch (x) { flash = `Supplier created, but the invitation was not sent: ${x.message}` } }
        draftInfo.clear(); nav(`/staff360/suppliers/${c.id}`, { replace: true, state: { flash } })
      }
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const setStatus = async (status, ask) => {
    if (ask && !window.confirm(ask)) return
    try { take(await adminFetch(`/suppliers/${id}`, { method: 'PATCH', body: { status } })); toast(status === 'active' ? 'Supplier restored' : `Supplier ${status}`) } catch (x) { toast(x.message, 'error') }
  }
  const sendLink = async () => { try { const r = await adminFetch(`/suppliers/${id}/send-link`, { method: 'POST' }); toast(r.kind === 'reset' ? 'Password link sent' : r.kind === 'invite' ? 'Invitation sent' : 'Confirmation link sent') } catch (x) { toast(x.message, 'error') } }
  const remove = async () => {
    if (!confirmDelete(s.company_name)) return
    try { await adminFetch(`/suppliers/${id}`, { method: 'DELETE' }); nav('/staff360/suppliers') } catch (x) { toast(x.message, 'error') }
  }
  const loading = editing && !s

  return (
    <>
      <Link to="/staff360/suppliers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" />Suppliers</Link>
      <PageHeader eyebrow="Procurement" title={editing ? (s?.company_name || ' ') : 'New supplier'}
        description={editing && s ? `${SOURCE[s.source] ? SOURCE[s.source][0].toUpperCase() + SOURCE[s.source].slice(1) : 'Added'} ${fmtDay(s.created_at)}${s.email ? ` · ${s.email}` : ''}` : 'Only the company name is required. Suppliers who bid or register on the website are added on their own.'}
        action={editing && s && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.status === 'active' ? 'green' : s.status === 'blocked' ? 'red' : 'muted'}>{s.status}</Badge>
            <Button variant="outline" onClick={() => setCompose(true)} disabled={!s.email}><Mail className="w-4 h-4" />Send email</Button>
            <Link to={`/staff360/purchase-orders/new?supplier=${s.id}`}><Button variant="accent"><Plus className="w-4 h-4" />New order</Button></Link>
          </div>
        )} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!editing && <DraftNotice draft={draftInfo} onDiscard={() => { draftInfo.clear(); setForm(EMPTY) }} />}
      {editing && <Tabs tabs={TABS.map(t => ({ ...t, count: t.key === 'bids' ? s?.bids?.length : t.key === 'orders' ? s?.orders?.length : undefined }))} value={tab} onChange={setTab} />}

      {tab === 'profile' && (loading ? (
        <Card className="p-6 grid md:grid-cols-2 gap-5 max-w-4xl">{[...Array(6)].map((_, i) => <div key={i}><Bone className="h-4 w-24 mb-2" /><Bone className="h-11 w-full" /></div>)}</Card>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start max-w-6xl">
          <form onSubmit={submit} className="space-y-6 min-w-0">
            <Card className="p-6 grid md:grid-cols-2 gap-5 animate-fade-up">
              <Field label="Company name *" className="md:col-span-2"><Input required {...bind('company_name')} placeholder="Kano Grains Ltd" /></Field>
              <Field label="Contact person"><Input {...bind('contact_person')} /></Field>
              <Field label="Phone"><Input {...bind('phone')} /></Field>
              <Field label="Email" hint={s?.has_account ? 'They sign in with this address, so it is fixed.' : 'Bids and accounts are matched to the record by this address.'}><Input type="email" disabled={Boolean(s?.has_account)} {...bind('email')} /></Field>
              <Field label="What they supply"><Input {...bind('commodities')} placeholder="Soybeans, maize" /></Field>
              <Field label="Address" className="md:col-span-2"><Textarea rows={2} {...bind('address')} /></Field>
              <Field label="Internal notes" hint="Only your team sees these." className="md:col-span-2"><Textarea rows={3} {...bind('notes')} /></Field>
            </Card>
            <div className="flex flex-wrap gap-3">
              {!editing && <label className="w-full flex items-center gap-2 text-sm"><input type="checkbox" checked={inviteNow} onChange={e => setInviteNow(e.target.checked)} />Email an invitation to create a login for the supplier portal <span className="text-muted-foreground">(needs an email address above)</span></label>}
              <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create supplier'}</Button>
              {editing && s && s.status !== 'archived' && <Button type="button" variant="outline" onClick={() => setStatus('archived')}><Archive className="w-4 h-4" />Archive</Button>}
              {editing && s && s.status !== 'active' && <Button type="button" variant="outline" onClick={() => setStatus('active')}><ArchiveRestore className="w-4 h-4" />Restore</Button>}
              {editing && s && s.status !== 'blocked' && <Button type="button" variant="outline" onClick={() => setStatus('blocked', 'Block this supplier? They can no longer sign in or bid.')}><Ban className="w-4 h-4" />Block</Button>}
              {editing && <Button type="button" variant="ghost" className="text-destructive ml-auto" onClick={remove}><Trash2 className="w-4 h-4" />Delete</Button>}
            </div>
          </form>
          {editing && s && (
            <Card className="p-5 text-sm animate-fade-up" style={{ animationDelay: '100ms' }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Supplier account</h2>
              {s.has_account ? (
                <>
                  <p className="flex items-center gap-1.5 font-medium"><BadgeCheck className="w-4 h-4 text-accent" />{s.verified_at ? 'Active account' : 'Registered, email not confirmed yet'}</p>
                  <dl className="mt-3 text-xs text-muted-foreground space-y-1.5">
                    <div className="flex justify-between gap-3"><dt>Registered</dt><dd>{fmtMoment(s.account?.created_at)}</dd></div>
                    <div className="flex justify-between gap-3"><dt>Email confirmed</dt><dd>{s.verified_at ? fmtMoment(s.verified_at) : 'not yet'}</dd></div>
                    <div className="flex justify-between gap-3"><dt>Last sign-in</dt><dd>{s.account?.last_sign_in_at ? fmtMoment(s.account.last_sign_in_at) : 'never'}</dd></div>
                  </dl>
                  <Button type="button" variant="outline" className="w-full mt-4 h-9" onClick={sendLink}><KeyRound className="w-4 h-4" />{s.verified_at ? 'Send a password link' : 'Send the confirmation again'}</Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">No login yet. {s.email ? <>Invite them: <b className="text-foreground break-all">{s.email}</b> gets a link to create a password. Or they can register on the website with that address; the account is attached to this record, with every bid made from it.</> : 'Add an email address, save, then invite them to create a login.'}</p>
                  {s.email && <Button type="button" variant="outline" className="w-full mt-4 h-9" onClick={sendLink}><Send className="w-4 h-4" />Send invitation</Button>}
                </>
              )}
            </Card>
          )}
        </div>
      ))}

      {editing && s && tab === 'bids' && <BidsTable supplierId={s.id} />}
      {editing && s && tab === 'orders' && (
        <Card className="animate-fade-up">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border"><h2 className="font-semibold">Purchase orders</h2><Link to={`/staff360/purchase-orders/new?supplier=${s.id}`}><Button variant="accent" className="h-9"><Plus className="w-4 h-4" />New order</Button></Link></div>
          <Table head={['Number', 'Title', 'Total', 'Status', 'Issued', '']}>
            {s.orders?.map(o => (
              <tr key={o.id} className="hover:bg-muted/40">
                <Td><Link to={`/staff360/purchase-orders/${o.id}`} className="font-medium hover:text-accent">{o.number}</Link></Td>
                <Td className="text-muted-foreground">{o.title || '—'}</Td>
                <Td className="font-medium whitespace-nowrap tabular-nums">{money(o.total, o.currency)}</Td>
                <Td><Badge tone={poTone(o.status)}>{o.status}</Badge></Td>
                <Td className="text-muted-foreground whitespace-nowrap">{fmtDay(o.issued_at)}</Td>
                <Td className="text-right"><Link to={`/staff360/purchase-orders/${o.id}`} className="text-xs font-semibold text-accent">Open →</Link></Td>
              </tr>
            ))}
            {!s.orders?.length && <tr><Td colSpan={6}><Empty>No purchase orders for this supplier yet.</Empty></Td></tr>}
          </Table>
        </Card>
      )}
      {editing && s && tab === 'documents' && <DocumentsPanel scope={{ supplier_id: s.id }} note="includes the files attached to their bids and the orders you sent" />}
      {editing && s && tab === 'messages' && <Conversations scope="procurement" supplierId={s.id} email={s.email} refreshKey={msgKey} onCompose={() => setCompose(true)} className="h-[72vh] min-h-[480px]" />}

      {s && (
        <Composer open={compose} onClose={() => setCompose(false)} title={`Email ${s.company_name}`} to={s.email || ''} scope="procurement" supplierId={s.id} template={{ key: 'supplier_blank', supplier_id: s.id }}
          onSent={() => { toast('Email sent'); setMsgKey(k => k + 1); setTab('messages') }} />
      )}
      {toastEl}
    </>
  )
}
