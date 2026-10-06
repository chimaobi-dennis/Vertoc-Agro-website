/*
 * The investment portal, mounted at /api: investor accounts
 * (/investor/register …) and, behind an investor session, the profile and
 * KYC documents, the opportunities on offer, applying to one, and the
 * investor's own investments with their returns.
 */
import { Router } from 'express'
import * as content from './content.js'
import { audit } from './audit.js'
import { bad, handler } from './http.js'
import { noticeTeam, panelLink } from './messaging.js'
import { portalAccounts, startDoc, finishDoc, docView } from './portal-accounts.js'
import { driver } from './store/index.js'

const router = Router()
const guarded = handler('investor')
const h = fn => guarded(async (req, res) => {
  try { await fn(req, res) } catch (e) { if (e.expose && /database migration/.test(e.message)) throw bad('The investment portal is not available yet. Please check back soon.', 503); throw e }
})
router.use('/investor', (_req, res, next) => (driver === 'supabase' ? next() : res.status(503).json({ error: 'The investment portal requires Supabase.' })))

const need = (v, msg) => { if (!String(v ?? '').trim()) throw bad(msg) }
const accounts = portalAccounts({
  kind: 'investor', table: 'investors',
  nameOf: i => i.name,
  blocked: i => (i.status === 'blocked' ? 'This investor account is suspended. Please contact us.' : null),
  async create(b, userId) {
    if (b.investor_type !== 'company' && (b.first_name || b.last_name || !b.name)) { need(b.first_name, 'Please enter your first name.'); need(b.last_name, 'Please enter your last name.') }
    else need(b.name, 'Please enter your company name.')
    need(b.phone, 'Please enter a phone number.'); need(b.address, 'Please enter your address.')
    return { row: await content.createInvestor(b, userId), existing: false }
  },
  async undo(row) { await content.deleteInvestor(row.id) },
})
accounts.mount(router, h)
/** Staff invite an investor record to open its portal account (used by the panel). */
export const inviteInvestor = (row, email) => accounts.invite(row, email)
const mine = fn => h(async (req, res) => fn(req, res, await accounts.who(req)))
const INVESTOR = accounts.ACTOR
const KYC_LABELS = ['Means of identification', 'Proof of address', 'Company registration documents', 'Other document']
const money = (cur, n) => `${cur} ${Number(n).toLocaleString('en-NG')}`

const avatarUrl = async i => (i.avatar_document_id ? (await content.documentUrl(i.avatar_document_id, { expires: 3600 }).catch(() => null))?.url || null : null)
router.get('/investor/me', mine(async (_req, res, i) => {
  const [mineInv, notes] = await Promise.all([content.listInvestments({ investor_id: i.id }), content.listNotifications('investor', i.id)])
  const live = mineInv.filter(x => ['active', 'matured'].includes(x.status))
  res.json({ ...content.publicInvestor(i), avatar_url: await avatarUrl(i), titles: content.INVESTOR_TITLES, controlled: content.CONTROLLED_FIELDS, change_groups: content.CHANGE_GROUPS, kyc_labels: KYC_LABELS, counts: {
    investments: mineInv.length, pending: mineInv.filter(x => x.status === 'pending').length, active: live.length,
    invested: live.reduce((s, x) => s + x.amount, 0), returns: mineInv.reduce((s, x) => s + x.payouts.filter(p => p.kind === 'return').reduce((n, p) => n + p.amount, 0), 0),
    unread: notes.filter(n => !n.read_at).length,
  } })
}))
router.patch('/investor/me', mine(async (req, res, i) => {
  const after = await content.updateInvestor(i.id, req.body || {})
  await audit({ actor: INVESTOR, action: 'update', entity: 'investor', entityId: i.id, after: { name: after.name } })
  res.json(content.publicInvestor(after))
}))
/* identification and other KYC documents */
router.get('/investor/documents', mine(async (_req, res, i) => res.json((await content.listDocuments({ investor_id: i.id })).filter(d => d.investment_id == null && ![content.SUPPORT_LABEL, content.PICTURE_LABEL].includes(d.label)).map(docView))))
router.post('/investor/documents', mine(async (req, res, i) => {
  const count = (await content.listDocuments({ investor_id: i.id })).length
  const label = KYC_LABELS.includes(req.body?.label) ? req.body.label : String(req.body?.label || '').slice(0, 80)
  res.status(201).json(await startDoc({ investor_id: i.id, label }, req.body, { limit: 20, count }))
}))
router.post('/investor/documents/:docId/complete', mine(async (req, res, i) => {
  const d = await finishDoc(req.params.docId, x => x.investor_id === i.id)
  await audit({ actor: INVESTOR, action: 'upload', entity: 'document', entityId: d.id, after: { name: d.name, investor_id: i.id } })
  await noticeTeam({ headline: `${i.name} uploaded ${d.label ? d.label.toLowerCase() : 'a document'} for identity checking`, details: `File: ${d.name}`, link: panelLink(`/investors/${i.id}`) })
  res.json(docView(d._row))
}))
const ownDoc = async (i, id) => { const d = await content.getDocument(id, { any: true }); if (!d || d.investor_id !== i.id) throw bad('document not found', 404); return d }
router.get('/investor/documents/:docId/url', mine(async (req, res, i) => { const d = await ownDoc(i, req.params.docId); const { url } = await content.documentUrl(d.id, { expires: 600 }); res.json({ url }) }))
router.delete('/investor/documents/:docId', mine(async (req, res, i) => {
  const d = await ownDoc(i, req.params.docId)
  if (d.uploaded_by != null || d.investment_id != null) throw bad('This document cannot be removed here.', 403)
  await content.deleteDocument(d.id); res.json({ deleted: true, id: d.id })
}))

/* profile picture: the first one is set at once; a replacement is a change request */
router.post('/investor/avatar', mine(async (req, res, i) => res.status(201).json(await startDoc({ investor_id: i.id, label: content.PICTURE_LABEL }, { ...req.body, content_type: String(req.body?.content_type || '').startsWith('image/') ? req.body.content_type : 'x/invalid' }))))
router.post('/investor/avatar/:docId/complete', mine(async (req, res, i) => {
  const d = await finishDoc(req.params.docId, x => x.investor_id === i.id && x.label === content.PICTURE_LABEL)
  const direct = !i.avatar_document_id
  if (direct) await content.attachInvestorAvatar(i.id, d.id)
  await audit({ actor: INVESTOR, action: 'upload', entity: 'investor', entityId: i.id, after: { picture: d.name, applied: direct } })
  res.json({ ...docView(d._row), direct })
}))

/* change requests: what is on record changes only through review */
router.post('/investor/change-docs', mine(async (req, res, i) => {
  const count = (await content.listDocuments({ investor_id: i.id })).filter(d => d.label === content.SUPPORT_LABEL).length
  res.status(201).json(await startDoc({ investor_id: i.id, label: content.SUPPORT_LABEL }, req.body, { limit: 40, count }))
}))
router.post('/investor/change-docs/:docId/complete', mine(async (req, res, i) => {
  const d = await finishDoc(req.params.docId, x => x.investor_id === i.id && x.label === content.SUPPORT_LABEL)
  res.json(docView(d._row))
}))
router.get('/investor/change-requests', mine(async (_req, res, i) => res.json(await content.listRequests({ investor_id: i.id }))))
router.post('/investor/change-requests', mine(async (req, res, i) => {
  const r = await content.createRequest(i, req.body || {})
  await audit({ actor: INVESTOR, action: 'create', entity: 'investor_change', entityId: r.id, after: { investor: i.name, fields: Object.keys(r.changes), reason: r.reason } })
  await noticeTeam({ headline: `${i.name} asked to change ${Object.keys(r.changes).map(f => f.replace(/_/g, ' ')).join(', ')} on their profile`, details: `Reason: ${r.reason}`, link: panelLink('/investments?tab=changes') })
  res.status(201).json(r)
}))
router.post('/investor/change-requests/:id/cancel', mine(async (req, res, i) => {
  const r = await content.cancelRequest(i, req.params.id)
  await audit({ actor: INVESTOR, action: 'cancel', entity: 'investor_change', entityId: r.id })
  res.json(r)
}))

/* opportunities */
// The cover picture is signed for an hour: the page shows it in an <img>.
const withCover = async (o, cover) => ({ ...content.publicOpportunity(o), image_url: cover ? (await content.documentUrl(cover.id, { expires: 3600 }).catch(() => null))?.url || null : null })
router.get('/investor/opportunities', mine(async (_req, res) => {
  const all = (await content.listOpportunities({})).filter(o => ['published', 'closed'].includes(o.status))
  const covers = await content.opportunityCovers(all.map(o => o.id))
  const rank = { open: 0, upcoming: 1, closed: 2 }
  res.json((await Promise.all(all.map(o => withCover(o, covers[o.id])))).sort((a, b) => (rank[a.state] ?? 3) - (rank[b.state] ?? 3)))
}))
const liveOpp = async number => { const o = await content.getOpportunity(number); if (!o || !['published', 'closed'].includes(o.status)) throw bad('not found', 404); return o }
router.get('/investor/opportunities/:number', mine(async (req, res) => {
  const o = await liveOpp(req.params.number)
  const docs = (await content.listDocuments({ opportunity_id: o.id })).filter(d => d.label !== content.COVER_LABEL)
  const cover = (await content.opportunityCovers([o.id]))[o.id]
  res.json({ ...(await withCover(o, cover)), documents: docs.map(docView) })
}))
router.get('/investor/opportunities/:number/documents/:docId/url', mine(async (req, res) => {
  const o = await liveOpp(req.params.number)
  const d = await content.getDocument(req.params.docId)
  if (!d || d.opportunity_id !== o.id) throw bad('document not found', 404)
  const { url } = await content.documentUrl(d.id, { download: true, expires: 600 }); res.json({ url })
}))
router.post('/investor/opportunities/:number/invest', mine(async (req, res, i) => {
  const { investment, opportunity } = await content.createInvestment(i, req.params.number, req.body || {})
  await audit({ actor: INVESTOR, action: 'create', entity: 'investment', entityId: investment.id, after: { number: investment.number, investor: i.name, opportunity: opportunity.number, amount: investment.amount, currency: investment.currency } })
  await noticeTeam({ headline: `${i.name} applied to invest ${money(investment.currency, investment.amount)} in ${opportunity.title}`, details: `Application ${investment.number} is waiting for approval.`, link: panelLink(`/investments/${investment.id}`) })
  res.status(201).json(content.publicInvestment(await content.getInvestment(investment.id)))
}))

/* the investor's own investments */
router.get('/investor/investments', mine(async (_req, res, i) => res.json((await content.listInvestments({ investor_id: i.id })).map(content.publicInvestment))))
const ownInv = async (i, id) => { const x = await content.getInvestment(id); if (!x || x.investor_id !== i.id) throw bad('investment not found', 404); return x }
router.get('/investor/investments/:id', mine(async (req, res, i) => res.json(content.publicInvestment(await ownInv(i, req.params.id)))))
router.post('/investor/investments/:id/cancel', mine(async (req, res, i) => {
  const x = await ownInv(i, req.params.id)
  if (x.status !== 'pending') throw bad('Only an application that is still waiting for approval can be cancelled here.', 409)
  const { investment } = await content.updateInvestment(x.id, { status: 'cancelled' })
  await audit({ actor: INVESTOR, action: 'cancel', entity: 'investment', entityId: x.id, after: { number: x.number } })
  res.json(content.publicInvestment(investment))
}))
// Proof of payment for an application.
router.post('/investor/investments/:id/proof', mine(async (req, res, i) => {
  const x = await ownInv(i, req.params.id)
  if (!['pending', 'active'].includes(x.status)) throw bad('Proof of payment can no longer be added to this investment.', 409)
  res.status(201).json(await startDoc({ investor_id: i.id, investment_id: x.id, label: 'Proof of payment' }, req.body))
}))
router.post('/investor/investments/:id/proof/:docId/complete', mine(async (req, res, i) => {
  const x = await ownInv(i, req.params.id)
  const d = await finishDoc(req.params.docId, doc => doc.investment_id === x.id && doc.investor_id === i.id)
  await content.setInvestmentProof(x.id, d.id)
  await noticeTeam({ headline: `${i.name} uploaded proof of payment for ${x.number}`, details: `Amount: ${money(x.currency, x.amount)}`, link: panelLink(`/investments/${x.id}`) })
  res.json(docView(d._row))
}))

export default router
