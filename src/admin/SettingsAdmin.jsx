import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, Check, Copy, FileText, Globe, Inbox, KeyRound, LayoutTemplate, Mail, Plug, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminApi'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Tabs, Textarea, useToast } from './ui'
import { Bone } from '../components/Skeleton'
import ImageUpload from './ImageUpload'
import { DraftNotice, useDraft } from './useDraft'
import { statIcon } from '../lib/statIcons'
import { flagSrc, onFlagError } from '../lib/flags'
import { fmtDateTime } from './format'

const TABS = [
  { key: 'site', label: 'Site', icon: Globe },
  { key: 'company', label: 'Company', icon: Building2 },
  { key: 'quotes', label: 'Invoices', icon: FileText },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'mcp', label: 'MCP & API', icon: Plug },
]

/** One settings group: local draft, Save writes only that group. */
function Group({ group, settings, onSaved, children, title, description }) {
  // Unsaved edits are drafted on this device, so a reload or a tab switch keeps them.
  const [draft, setDraft, draftInfo] = useDraft(`settings:${group}`, null)
  const [form, setForm] = useState(() => (draft ? { ...settings[group], ...draft } : settings[group]))
  const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()
  useEffect(() => { if (!draftInfo.restored) setForm(settings[group]) }, [settings, group]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(form) !== JSON.stringify(settings[group])
  useEffect(() => { if (dirty) setDraft(form); else if (!draftInfo.restored) draftInfo.clear() }, [form]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = async e => {
    e.preventDefault(); setBusy(true)
    try { const s = await adminFetch('/settings', { method: 'PUT', body: { [group]: form } }); draftInfo.clear(); onSaved(s); toast('Saved') } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const bind = (k, extra = {}) => ({ value: form[k] ?? '', onChange: e => setForm({ ...form, [k]: e.target.value }), ...extra })
  return (
    <form onSubmit={save}>
      <Card className="p-6 animate-fade-up">
        <div className="mb-5"><h2 className="font-semibold">{title}</h2>{description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}</div>
        <DraftNotice draft={draftInfo} onDiscard={() => { draftInfo.clear(); setForm(settings[group]) }} />
        {children({ form, setForm, bind })}
        <div className="mt-6 flex justify-end"><Button type="submit" variant="accent" disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save changes'}</Button></div>
      </Card>
      {toastEl}
    </form>
  )
}

export default function SettingsAdmin() {
  const [sp, setSp] = useSearchParams()
  const tab = TABS.some(t => t.key === sp.get('tab')) ? sp.get('tab') : 'site'
  const [settings, setSettings] = useState(null)
  const [err, setErr] = useState(null)
  const reload = () => adminFetch('/settings').then(setSettings).catch(e => setErr(e.message))
  useEffect(() => { reload() }, [])
  const onSaved = s => setSettings(prev => ({ ...prev, ...s }))

  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description="Site identity, company details, invoice defaults, email sending and Claude access — all editable here, nothing hard-coded." />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <Tabs tabs={TABS} value={tab} onChange={t => { const n = new URLSearchParams(sp); n.set('tab', t); setSp(n, { replace: true }) }} />

      {!settings ? <Card className="p-6 space-y-4 max-w-3xl">{[...Array(5)].map((_, i) => <div key={i}><Bone className="h-4 w-28 mb-2" /><Bone className="h-11 w-full" /></div>)}</Card> : (
        <div className="max-w-3xl space-y-6">
          {tab === 'site' && (
            <Group group="site" settings={settings} onSaved={onSaved} title="Site identity & contact details" description="Shown on the public website: header, footer, contact and quote pages. Changes are live immediately.">
              {({ form, setForm, bind }) => (
                <div className="grid md:grid-cols-2 gap-5">
                  <Field label="Site name"><Input {...bind('name')} /></Field>
                  <Field label="Legal name" hint="Used in the footer copyright"><Input {...bind('legal_name')} /></Field>
                  <Field label="Tagline" className="md:col-span-2"><Input {...bind('tagline')} /></Field>
                  <Field label="Description" hint="Footer blurb and search engines" className="md:col-span-2"><Textarea rows={3} {...bind('description')} /></Field>
                  <Field label="Logo" hint="PNG with transparent background works best"><ImageUpload value={form.logo} onChange={v => setForm({ ...form, logo: v })} /></Field>
                  <Field label="Favicon" hint="Square PNG, 64×64 or larger"><ImageUpload value={form.favicon} onChange={v => setForm({ ...form, favicon: v })} /></Field>
                  <Field label="Email"><Input type="email" {...bind('email')} /></Field>
                  <Field label="Phone"><Input {...bind('phone')} /></Field>
                  <Field label="WhatsApp number" hint="Digits with country code, no + or spaces"><Input {...bind('whatsapp')} placeholder="2349135009001" /></Field>
                  <Field label="Address"><Input {...bind('address')} /></Field>
                  <Field label="Opening hours"><Input {...bind('hours')} /></Field>
                  <Field label="Opening hours (short)" hint="Shown on small screens"><Input {...bind('hours_short')} /></Field>
                  <Field label="Facebook"><Input type="url" {...bind('facebook')} /></Field>
                  <Field label="Instagram"><Input type="url" {...bind('instagram')} /></Field>
                  <Field label="LinkedIn"><Input type="url" {...bind('linkedin')} /></Field>
                  <Field label="X (Twitter)"><Input type="url" {...bind('twitter')} /></Field>
                  <Field label="Threads"><Input type="url" {...bind('threads')} /></Field>
                </div>
              )}
            </Group>
          )}

          {tab === 'site' && <HomepageStatsCard />}
          {tab === 'site' && <HomepageMarketsCard />}
          {tab === 'company' && (
            <Group group="company" settings={settings} onSaved={onSaved} title="Company block on invoices" description="Printed in the header of every invoice PDF and shown on the client's online view.">
              {({ bind }) => (
                <div className="grid md:grid-cols-2 gap-5">
                  <Field label="Company name"><Input {...bind('name')} /></Field>
                  <Field label="Website"><Input {...bind('website')} /></Field>
                  <Field label="Address" className="md:col-span-2"><Input {...bind('address')} /></Field>
                  <Field label="Phone"><Input {...bind('phone')} /></Field>
                  <Field label="Email"><Input type="email" {...bind('email')} /></Field>
                </div>
              )}
            </Group>
          )}

          {tab === 'quotes' && (
            <Group group="quotes" settings={settings} onSaved={onSaved} title="Invoice defaults" description="Applied to every new invoice; each invoice can still override them.">
              {({ bind }) => (
                <div className="grid md:grid-cols-2 gap-5">
                  <Field label="Default currency" hint="ISO code, e.g. USD, EUR, NGN"><Input maxLength={3} {...bind('default_currency', { onChange: undefined })} onChange={e => bind('default_currency').onChange({ target: { value: e.target.value.toUpperCase() } })} /></Field>
                  <Field label="Valid for (days)"><Input type="number" min="1" max="365" {...bind('valid_days')} /></Field>
                  <Field label="Default terms" hint="Printed under the line items" className="md:col-span-2"><Textarea rows={4} {...bind('terms')} placeholder="e.g. 50% deposit on order confirmation, balance against shipping documents." /></Field>
                  <Field label="Payment instructions" hint="Bank details for the client. Printed on every invoice PDF and shown online." className="md:col-span-2"><Textarea rows={5} {...bind('payment_text')} placeholder={'Bank: …\nAccount name: …\nAccount number / IBAN: …\nSWIFT: …'} /></Field>
                </div>
              )}
            </Group>
          )}

          {tab === 'email' && <EmailSettings settings={settings} onSaved={onSaved} reload={reload} />}
          {tab === 'mcp' && <McpSettings settings={settings} onSaved={onSaved} reload={reload} />}
        </div>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- email --- */

/** The number tiles on the homepage: icon, number, suffix, label. */
function HomepageStatsCard() {
  const [rows, setRows] = useState(null)
  const [icons, setIcons] = useState([])
  const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()
  useEffect(() => { adminFetch('/settings/stats').then(r => { setRows(r.stats); setIcons(r.icons) }).catch(e => toast(e.message, 'error')) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const update = (i, patch) => setRows(r => r.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const move = (i, d) => setRows(r => { const n = [...r]; const j = i + d; if (j < 0 || j >= n.length) return r; [n[i], n[j]] = [n[j], n[i]]; return n })
  const save = async () => {
    setBusy(true)
    try { const r = await adminFetch('/settings/stats', { method: 'PUT', body: { stats: rows } }); setRows(r.stats); toast('Homepage stats saved') }
    catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  return (
    <Card className="p-6 animate-fade-up mt-6">
      <div className="mb-5"><h2 className="font-semibold">Homepage stats</h2><p className="text-sm text-muted-foreground mt-0.5">The number tiles under the hero ("8+ Years of Experience"). The number counts up when the section scrolls into view; the suffix is printed after it. Up to eight; four fit the row best.</p></div>
      {!rows ? <Bone className="h-10 w-full" /> : (
        <>
          <ul className="space-y-3">
            {rows.map((s, i) => {
              const Icon = statIcon(s.icon)
              return (
                <li key={i} className="rounded-xl border border-border p-4 grid gap-3 md:grid-cols-[auto_1fr_1fr_1fr_1.5fr_auto] items-end">
                  <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-5 h-5" /></span>
                  <Field label="Icon"><Select value={s.icon} onChange={e => update(i, { icon: e.target.value })}>{icons.map(n => <option key={n} value={n}>{n.replace(/([a-z])([A-Z])/g, '$1 $2')}</option>)}</Select></Field>
                  <Field label="Number"><Input type="number" min="0" step="1" value={s.value} onChange={e => update(i, { value: e.target.value })} /></Field>
                  <Field label="Suffix" hint="e.g. + or %"><Input value={s.suffix ?? ''} maxLength={3} onChange={e => update(i, { suffix: e.target.value })} /></Field>
                  <Field label="Label"><Input value={s.label} maxLength={40} onChange={e => update(i, { label: e.target.value })} placeholder="Years of Experience" /></Field>
                  <div className="flex items-center gap-1 pb-0.5">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="h-9 w-8 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="h-9 w-8 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move down">↓</button>
                    <button type="button" onClick={() => setRows(r => r.filter((_, j) => j !== i))} className="h-9 w-9 rounded-lg text-destructive hover:bg-muted flex items-center justify-center" aria-label="Remove stat"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" className="h-9" disabled={rows.length >= 8} onClick={() => setRows(r => [...r, { icon: 'Award', value: 0, suffix: '+', label: '' }])}><Plus className="w-4 h-4" />Add a stat</Button>
            <Button type="button" variant="accent" onClick={save} disabled={busy || !rows.length}>{busy ? 'Saving…' : 'Save stats'}</Button>
          </div>
        </>
      )}
      {toastEl}
    </Card>
  )
}

/** "Our Export Markets": one flag tile per country, plus the two captions under the grid. */
function HomepageMarketsCard() {
  const [v, setV] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()
  useEffect(() => { adminFetch('/settings/markets').then(setV).catch(e => toast(e.message, 'error')) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const update = (i, patch) => setV(x => ({ ...x, items: x.items.map((m, j) => (j === i ? { ...m, ...patch } : m)) }))
  const move = (i, d) => setV(x => { const n = [...x.items]; const j = i + d; if (j < 0 || j >= n.length) return x; [n[i], n[j]] = [n[j], n[i]]; return { ...x, items: n } })
  const save = async () => {
    setBusy(true)
    try { const r = await adminFetch('/settings/markets', { method: 'PUT', body: { markets: v.items, caption_left: v.caption_left, caption_right: v.caption_right } }); setV(r); toast('Export markets saved') }
    catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  return (
    <Card className="p-6 animate-fade-up mt-6">
      <div className="mb-5"><h2 className="font-semibold">Export markets</h2><p className="text-sm text-muted-foreground mt-0.5">The flag tiles under "Our Export Markets". Enter the country name and its two-letter code (GB, NL, GH…); the flag is picked from the code. Up to 24; multiples of four fill the rows.</p></div>
      {!v ? <Bone className="h-10 w-full" /> : (
        <>
          <ul className="space-y-2">
            {v.items.map((m, i) => (
              <li key={i} className="grid gap-3 md:grid-cols-[auto_1fr_120px_auto] items-end rounded-xl border border-border p-3">
                <span className="w-12 h-9 rounded-md overflow-hidden border border-border/50 bg-muted mb-0.5"><img src={flagSrc(m.code)} onError={onFlagError(m.code)} alt="" className="w-full h-full object-cover" /></span>
                <Field label="Country"><Input value={m.name} maxLength={40} onChange={e => update(i, { name: e.target.value })} placeholder="Ghana" /></Field>
                <Field label="Code" hint="ISO, 2 letters"><Input value={m.code} maxLength={2} onChange={e => update(i, { code: e.target.value.toLowerCase().replace(/[^a-z]/g, '') })} placeholder="gh" className="uppercase" /></Field>
                <div className="flex items-center gap-1 pb-0.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="h-9 w-8 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move up">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === v.items.length - 1} className="h-9 w-8 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move down">↓</button>
                  <button type="button" onClick={() => setV(x => ({ ...x, items: x.items.filter((_, j) => j !== i) }))} className="h-9 w-9 rounded-lg text-destructive hover:bg-muted flex items-center justify-center" aria-label="Remove market"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            ))}
          </ul>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Field label="Left caption" hint="Shown with a ship icon under the grid; empty hides it"><Input value={v.caption_left || ''} maxLength={60} onChange={e => setV(x => ({ ...x, caption_left: e.target.value }))} placeholder="FOB Lagos" /></Field>
            <Field label="Right caption" hint="Shown with a globe icon; empty hides it"><Input value={v.caption_right || ''} maxLength={60} onChange={e => setV(x => ({ ...x, caption_right: e.target.value }))} placeholder="12+ Countries Served" /></Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" className="h-9" disabled={v.items.length >= 24} onClick={() => setV(x => ({ ...x, items: [...x.items, { name: '', code: '' }] }))}><Plus className="w-4 h-4" />Add a country</Button>
            <Button type="button" variant="accent" onClick={save} disabled={busy || !v.items.length}>{busy ? 'Saving…' : 'Save markets'}</Button>
          </div>
        </>
      )}
      {toastEl}
    </Card>
  )
}

/** Extra sender identities: Finance <finance@…>, Logistics <…>. The From above stays the default. */
function DepartmentsCard() {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, toastEl] = useToast()
  const load = () => adminFetch('/settings/departments').then(l => setRows(l.filter(d => !d.is_default))).catch(e => toast(e.message, 'error'))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const update = (i, patch) => setRows(r => r.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const save = async () => {
    setBusy(true)
    try { const l = await adminFetch('/settings/departments', { method: 'PUT', body: { departments: rows } }); setRows(l.filter(d => !d.is_default)); toast('Departments saved') }
    catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  return (
    <Card className="p-6 animate-fade-up">
      <div className="mb-5"><h2 className="font-semibold">Departments (send as)</h2><p className="text-sm text-muted-foreground mt-0.5">Other addresses the team can send from — Finance, Logistics, a person's own mailbox — each with its own signature. The From above is always available as the default and uses the Signature above. Every address must be on a domain verified at resend.com.</p></div>
      {!rows ? <Bone className="h-10 w-full" /> : (
        <>
          <ul className="space-y-3">
            {rows.map((d, i) => (
              <li key={d.id || i} className="rounded-xl border border-border p-4 space-y-3">
                <div className="grid md:grid-cols-[1fr_1fr_1fr_36px] gap-3 items-end">
                  <Field label="Department"><Input value={d.name} onChange={e => update(i, { name: e.target.value })} placeholder="Finance" maxLength={60} /></Field>
                  <Field label="Address"><Input type="email" value={d.email} onChange={e => update(i, { email: e.target.value })} placeholder="finance@vertocagro.com" /></Field>
                  <Field label="Reply-to" hint="Optional — defaults to the address"><Input type="email" value={d.reply_to || ''} onChange={e => update(i, { reply_to: e.target.value })} placeholder="finance@vertocagro.com" /></Field>
                  <button type="button" onClick={() => setRows(r => r.filter((_, j) => j !== i))} className="h-11 w-9 rounded-lg text-destructive hover:bg-muted flex items-center justify-center" aria-label="Remove department"><Trash2 className="w-4 h-4" /></button>
                </div>
                <Field label="Signature" hint="Under every email sent from this department. The company footer (address, phone, website) is added automatically."><Textarea rows={3} value={d.signature || ''} onChange={e => update(i, { signature: e.target.value })} placeholder={'Finance Team\nVertoc Agro'} /></Field>
              </li>
            ))}
            {!rows.length && <li className="text-sm text-muted-foreground">No extra departments yet — everything goes out from the From address above.</li>}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" className="h-9" onClick={() => setRows(r => [...r, { name: '', email: '', reply_to: '', signature: '' }])}><Plus className="w-4 h-4" />Add a department</Button>
            <Button type="button" variant="accent" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save departments'}</Button>
          </div>
        </>
      )}
      {toastEl}
    </Card>
  )
}

function EmailSettings({ settings, onSaved, reload }) {
  const [key, setKey] = useState('')
  const [wh, setWh] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toast, toastEl] = useToast()
  const e = settings.email, stored = settings.secrets?.resend_api_key, storedWh = settings.secrets?.resend_webhook_secret
  const copy = text => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  const saveWh = async ev => {
    ev.preventDefault(); setBusy(true)
    try { await adminFetch('/settings/secrets/resend_webhook_secret', { method: 'PUT', body: { value: wh } }); setWh(''); toast('Webhook secret saved'); reload() } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const removeWh = async () => {
    if (!window.confirm('Remove the webhook signing secret? Received emails will be rejected until a new one is saved.')) return
    try { await adminFetch('/settings/secrets/resend_webhook_secret', { method: 'DELETE' }); toast('Secret removed'); reload() } catch (x) { toast(x.message, 'error') }
  }
  const saveKey = async ev => {
    ev.preventDefault(); setBusy(true)
    try { await adminFetch('/settings/secrets/resend_api_key', { method: 'PUT', body: { value: key } }); setKey(''); toast('Resend key saved'); reload() } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const removeKey = async () => {
    if (!window.confirm('Remove the stored Resend API key? Sending will stop unless RESEND_API_KEY is set on the server.')) return
    try { await adminFetch('/settings/secrets/resend_api_key', { method: 'DELETE' }); toast('Key removed'); reload() } catch (x) { toast(x.message, 'error') }
  }
  return (
    <>
      <Card className="p-6 animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div><h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4 text-accent" />Resend API key</h2><p className="text-sm text-muted-foreground mt-0.5">Emails are sent through resend.com. The key is stored encrypted and never shown again.</p></div>
          <Badge tone={e.configured ? 'green' : 'amber'}>{e.configured ? `connected · ${e.source === 'panel' ? 'panel key' : 'server env'}` : 'not connected'}</Badge>
        </div>
        {stored && <p className="text-sm mb-4">Stored key ends with <code className="font-mono">····{stored.hint}</code>, set {fmtDateTime(stored.set_at)}. <button type="button" onClick={removeKey} className="text-destructive font-semibold text-xs ml-2 inline-flex items-center gap-1"><Trash2 className="w-3 h-3" />Remove</button></p>}
        {!stored && settings.env?.resend && <p className="text-sm mb-4 text-muted-foreground">Using <code>RESEND_API_KEY</code> from the server environment. A key saved here takes precedence.</p>}
        <form onSubmit={saveKey} className="flex flex-col sm:flex-row gap-2">
          <Input type="password" autoComplete="off" value={key} onChange={ev => setKey(ev.target.value)} placeholder={stored ? 'Paste a new key to replace it' : 're_…'} />
          <Button type="submit" variant="accent" className="shrink-0" disabled={!key || busy}>{busy ? 'Saving…' : stored ? 'Replace key' : 'Save key'}</Button>
        </form>
        {e.dry_run && <Alert tone="info">Dry run is on (EMAIL_DRY_RUN=1): messages are logged as sent but nothing leaves the server.</Alert>}
        <p className="text-xs text-muted-foreground mt-4">The From address below must be on a domain verified at resend.com → Domains. Until <strong>vertocagro.com</strong> is verified there, use <code>Vertoc Agro &lt;onboarding@resend.dev&gt;</code> to test — Resend then only delivers to your own account email.</p>
      </Card>

      <Group group="email" settings={settings} onSaved={onSaved} title="Sender, signature & notifications" description="Every email the team sends uses these.">
        {({ form, setForm, bind }) => (
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="From" hint='Format: Name <address@domain>'><Input {...bind('from')} /></Field>
            <Field label="Reply-to" hint="Where client replies land when inbound is not set up"><Input type="email" {...bind('reply_to')} /></Field>
            <Field label="Signature" hint="Under every email sent from this From. Emails written in Messages get the writer's name and position above it; the company footer (address, phone, website) is added automatically, so it need not repeat them." className="md:col-span-2"><Textarea rows={3} {...bind('signature')} placeholder={'Sales Team\nVertoc Agro'} /></Field>
            <Field label="Inbound address" hint="Once Resend receiving is connected (below): replies go here and land in Messages. Used as Reply-To when set."><Input type="email" {...bind('inbound_address')} placeholder="sales@reply.vertocagro.com" /></Field>
            <Field label="Notify the team at" hint="Defaults to the Reply-to address"><Input type="email" {...bind('notify_to')} /></Field>
            <div className="md:col-span-2 flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.notify_enquiries !== false} onChange={ev => setForm({ ...form, notify_enquiries: ev.target.checked })} />Email the team when a quote request is submitted on the website</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.notify_reviews !== false} onChange={ev => setForm({ ...form, notify_reviews: ev.target.checked })} />Email the team when a client submits a review on the website</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.ack_enquiries !== false} onChange={ev => setForm({ ...form, ack_enquiries: ev.target.checked })} />Send the sender a confirmation ("Quote request received" template)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.notify_responses !== false} onChange={ev => setForm({ ...form, notify_responses: ev.target.checked })} />Email the team when a client accepts or declines an invoice</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.notify_inbound !== false} onChange={ev => setForm({ ...form, notify_inbound: ev.target.checked })} />Email the team when a client's email arrives</label>
            </div>
            <p className="md:col-span-2 text-xs text-muted-foreground flex items-center gap-1.5"><LayoutTemplate className="w-3.5 h-3.5 text-accent" />The wording of every email lives under <Link to="/staff360/templates" className="font-semibold text-accent">Email templates</Link>.</p>
          </div>
        )}
      </Group>

      <DepartmentsCard />

      <Card className="p-6 animate-fade-up" style={{ animationDelay: '140ms' }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div><h2 className="font-semibold flex items-center gap-2"><Inbox className="w-4 h-4 text-accent" />Inbound email (replies into Messages)</h2><p className="text-sm text-muted-foreground mt-0.5">Resend can receive mail for your domain and hand it to the panel. Client replies then appear in Messages and on the client's record, with attachments.</p></div>
          <Badge tone={e.inbound_configured ? 'green' : 'amber'}>{e.inbound_configured ? `connected · ${e.inbound_source === 'panel' ? 'panel secret' : 'server env'}` : 'not connected'}</Badge>
        </div>
        <ol className="text-sm space-y-2 mb-5 list-decimal pl-5 text-foreground/90">
          <li>In Resend → <strong>Domains</strong>, enable <em>Receiving</em> on a domain and add the MX record it shows to your DNS. Use a subdomain such as <code>reply.vertocagro.com</code> so your existing <code>sales@vertocagro.com</code> mailbox keeps working; the root domain would route all its mail to Resend.</li>
          <li>In Resend → <strong>Webhooks</strong> → Add endpoint: paste the URL below and select the <code>email.received</code> event. Copy the signing secret it gives you into the box underneath.</li>
          <li>Set the <em>Inbound address</em> above (e.g. <code>sales@reply.vertocagro.com</code>). Replies to your emails will then go to Resend, and into the panel.</li>
        </ol>
        <Field label="Webhook URL">
          <div className="flex gap-2"><Input readOnly value={e.webhook_url || ''} /><Button type="button" variant="outline" className="shrink-0" onClick={() => copy(e.webhook_url)}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button></div>
        </Field>
        <div className="mt-4">
          {storedWh && <p className="text-sm mb-3">Signing secret ends with <code className="font-mono">····{storedWh.hint}</code>, set {fmtDateTime(storedWh.set_at)}. <button type="button" onClick={removeWh} className="text-destructive font-semibold text-xs ml-2 inline-flex items-center gap-1"><Trash2 className="w-3 h-3" />Remove</button></p>}
          <form onSubmit={saveWh} className="flex flex-col sm:flex-row gap-2">
            <Input type="password" autoComplete="off" value={wh} onChange={ev => setWh(ev.target.value)} placeholder={storedWh ? 'Paste a new signing secret to replace it' : 'whsec_…'} />
            <Button type="submit" variant="accent" className="shrink-0" disabled={!wh || busy}>{busy ? 'Saving…' : storedWh ? 'Replace secret' : 'Save secret'}</Button>
          </form>
        </div>
      </Card>
      {toastEl}
    </>
  )
}

/* ------------------------------------------------------------------ mcp --- */

function McpSettings({ settings, onSaved, reload }) {
  const [fresh, setFresh] = useState(null)   // a just-generated token, shown once
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toast, toastEl] = useToast()
  const m = settings.mcp
  const toggle = async enabled => { try { onSaved(await adminFetch('/settings', { method: 'PUT', body: { mcp: { enabled } } })); toast(enabled ? 'MCP endpoint enabled' : 'MCP endpoint disabled') } catch (x) { toast(x.message, 'error') } }
  const generate = async () => {
    if (m.token_hint && !window.confirm('Generate a new token? The current panel-issued token stops working immediately.')) return
    setBusy(true)
    try { const r = await adminFetch('/settings/mcp/token', { method: 'POST' }); setFresh(r); reload() } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  const revoke = async () => {
    if (!window.confirm('Revoke the panel-issued token? Claude connectors using it will be disconnected.')) return
    try { await adminFetch('/settings/mcp/token', { method: 'DELETE' }); setFresh(null); toast('Token revoked'); reload() } catch (x) { toast(x.message, 'error') }
  }
  const copy = text => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })

  return (
    <>
      <Card className="p-6 animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div><h2 className="font-semibold flex items-center gap-2"><Plug className="w-4 h-4 text-accent" />Claude connection (MCP)</h2><p className="text-sm text-muted-foreground mt-0.5">Lets Claude manage products, posts, clients, invoices and email by chatting. Every change it makes is in the audit log as "Claude".</p></div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={m.enabled !== false} onChange={e => toggle(e.target.checked)} />Enabled</label>
        </div>
        <Field label="Endpoint">
          <div className="flex gap-2"><Input readOnly value={m.endpoint || ''} /><Button type="button" variant="outline" className="shrink-0" onClick={() => copy(m.endpoint)}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button></div>
        </Field>
        <div className="mt-5 rounded-xl border border-border p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Access token</p>
              <p className="text-xs text-muted-foreground">{m.token_hint ? <>Panel token ends with <code>····{m.token_hint}</code>, issued {fmtDateTime(m.rotated_at)}.</> : 'No panel-issued token.'}{m.env_token ? ' A VERTOC_MCP_TOKEN from the server environment also works.' : ''}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="accent" className="h-9" onClick={generate} disabled={busy}><RefreshCw className="w-4 h-4" />{m.token_hint ? 'Generate new' : 'Generate token'}</Button>
              {m.token_hint && <Button type="button" variant="outline" className="h-9" onClick={revoke}>Revoke</Button>}
            </div>
          </div>
          {fresh && (
            <div className="rounded-xl bg-accent/10 border border-accent/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">Copy it now — it will not be shown again</p>
              <div className="flex gap-2"><Input readOnly value={fresh.token} className="font-mono text-xs" /><Button type="button" variant="primary" className="shrink-0" onClick={() => copy(fresh.token)}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}Copy</Button></div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-4">Use the endpoint and token in claude.ai (Settings → Connectors → Add custom connector) or in Claude Desktop; the README's "Managing content by chatting with Claude" section has the exact steps.</p>
      </Card>

      <Card className="p-6 animate-fade-up" style={{ animationDelay: '70ms' }}>
        <h2 className="font-semibold mb-1">Server environment</h2>
        <p className="text-sm text-muted-foreground mb-4">Read-only view of what the deployment has set. These change in Vercel → Settings → Environment Variables.</p>
        <ul className="text-sm space-y-2">
          {[['RESEND_API_KEY', settings.env?.resend], ['TURNSTILE_SECRET_KEY', settings.env?.turnstile], ['VERTOC_MCP_TOKEN', m.env_token], ['SITE_URL / ADMIN_URL', Boolean(settings.public_url)]].map(([k, v]) => (
            <li key={k} className="flex items-center justify-between gap-3"><code className="text-xs">{k}</code><Badge tone={v ? 'green' : 'muted'}>{v ? 'set' : 'not set'}</Badge></li>
          ))}
        </ul>
      </Card>
      {toastEl}
    </>
  )
}
