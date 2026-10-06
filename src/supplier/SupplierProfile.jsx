import { useEffect, useState } from 'react'
import { changeSupplierPassword, supplierFetch, useSupplier } from '../lib/supplier'
import { PasswordChange } from '../portal/Shared'
import { Label, Notice, Problem, accent, input } from './ui'

/** The supplier's own details, used to fill in every bid. */
export default function SupplierProfile() {
  const { me, refresh } = useSupplier()
  const [f, setF] = useState({ company_name: '', contact_person: '', phone: '', address: '', commodities: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(false)
  useEffect(() => { setF({ company_name: me.company_name || '', contact_person: me.contact_person || '', phone: me.phone || '', address: me.address || '', commodities: me.commodities || '' }) }, [me])
  const set = k => e => { setF(x => ({ ...x, [k]: e.target.value })); setOk(false) }
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr(null); setOk(false)
    try { await supplierFetch('/supplier/me', { method: 'PATCH', body: f }); await refresh(); setOk(true) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-6">
    <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 md:p-8 max-w-3xl space-y-4">
      <div><h1 className="font-semibold text-lg text-foreground">Company details</h1><p className="text-sm text-muted-foreground mt-0.5">These fill in your bids, and our purchase orders are addressed to them.</p></div>
      <Problem>{err}</Problem>
      {ok && <Notice>Saved.</Notice>}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block sm:col-span-2"><Label>Supplier / company name *</Label><input required maxLength={200} className={input} value={f.company_name} onChange={set('company_name')} /></label>
        <label className="block"><Label>Contact person</Label><input maxLength={120} className={input} value={f.contact_person} onChange={set('contact_person')} /></label>
        <label className="block"><Label>Phone number</Label><input type="tel" maxLength={60} className={input} value={f.phone} onChange={set('phone')} /></label>
        <label className="block sm:col-span-2"><Label hint="(you sign in with it; contact us to change it)">Email address</Label><input disabled className={input} value={me.email} /></label>
        <label className="block sm:col-span-2"><Label>Company address</Label><textarea rows={2} maxLength={500} className={input} value={f.address} onChange={set('address')} /></label>
        <label className="block sm:col-span-2"><Label>What do you supply?</Label><input maxLength={500} className={input} value={f.commodities} onChange={set('commodities')} placeholder="Soybeans, maize, cocoa…" /></label>
      </div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={busy} className={accent}>{busy ? 'Saving…' : 'Save changes'}</button></div>
    </form>
    <PasswordChange change={changeSupplierPassword} email={me.email} />
    </div>
  )
}
