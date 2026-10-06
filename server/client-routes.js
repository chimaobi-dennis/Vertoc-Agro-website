/*
 * The client portal, mounted at /api: accounts (/client/register …) and,
 * behind a client session, the profile, invoices with what was paid, the
 * shipments of those invoices, payments with their receipts, and purchases.
 */
import { Router } from 'express'
import * as content from './content.js'
import { audit } from './audit.js'
import { bad, handler } from './http.js'
import { noticeTeam, panelLink } from './messaging.js'
import { portalAccounts, startDoc, finishDoc, docView } from './portal-accounts.js'
import { driver } from './store/index.js'

const router = Router()
const guarded = handler('client')
// Visitors never see which migration is missing.
const h = fn => guarded(async (req, res) => {
  try { await fn(req, res) } catch (e) { if (e.expose && /database migration/.test(e.message)) throw bad('The client portal is not available yet. Please check back soon.', 503); throw e }
})
router.use('/client', (_req, res, next) => (driver === 'supabase' ? next() : res.status(503).json({ error: 'The client portal requires Supabase.' })))

const need = (v, msg) => { if (!String(v ?? '').trim()) throw bad(msg) }
const accounts = portalAccounts({
  kind: 'client', table: 'clients',
  nameOf: c => c.data?.contact_person || c.name,
  blocked: c => (c.status === 'archived' ? 'This client account is closed. Please contact us.' : null),
  async create(b, userId) {
    need(b.company_name, 'Please enter your company name.'); need(b.contact_person, 'Please enter the contact person.'); need(b.phone, 'Please enter a phone number.'); need(b.address, 'Please enter your company address.')
    const existing = await content.findClientRecordByEmail(b.email)
    // A record our team already keeps for this address becomes the account.
    return existing ? { row: await content.attachClientAccount(existing.id, userId, b), existing: true } : { row: await content.createClientAccount(b, userId), existing: false }
  },
  async undo(row, existing) { if (existing) await content.detachClientAccount(row.id); else await content.deleteClient(row.id) },
})
accounts.mount(router, h)
const mine = fn => h(async (req, res) => fn(req, res, await accounts.who(req)))
const CLIENT = accounts.ACTOR

router.get('/client/me', mine(async (_req, res, c) => {
  const [invoices, notes] = await Promise.all([content.listClientInvoices(c.id), content.listNotifications('client', c.id)])
  const open = invoices.filter(i => ['sent', 'viewed'].includes(i.status))
  res.json({ ...content.publicClient(c), counts: {
    invoices: invoices.length, to_answer: open.length, unread: notes.filter(n => !n.read_at).length,
    owing: invoices.filter(i => i.status === 'accepted' && i.balance > 0).length,
  } })
}))
router.patch('/client/me', mine(async (req, res, c) => {
  const after = await content.updateClientAccount(c.id, req.body || {})
  await audit({ actor: CLIENT, action: 'update', entity: 'client', entityId: c.id, before: content.publicClient(c), after: content.publicClient(after) })
  res.json(content.publicClient(after))
}))
router.get('/client/invoices', mine(async (_req, res, c) => res.json((await content.listClientInvoices(c.id)).map(({ id, ...q }) => ({ id, ...q })))))

// Shipments of the client's invoices, with their route and latest position.
router.get('/client/shipments', mine(async (_req, res, c) => {
  const invoices = await content.listClientInvoices(c.id)
  const out = []
  for (const q of invoices) {
    const s = await content.listShipments(q.id).catch(() => ({ items: [] }))
    for (const x of s.items) out.push({ ...content.publicShipment(x), invoice: { number: q.number, token: q.token, title: q.title } })
  }
  res.json(out.sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at))))
}))

/* payments and their receipts */
const payView = p => ({ id: p.id, amount: p.amount, currency: p.currency, paid_on: p.paid_on, method: p.method, reference: p.reference, note: p.note, status: p.status, status_note: p.status_note, created_at: p.created_at, has_receipt: p.receipt_document_id != null, invoice: p.quote ? { number: p.quote.number } : null })
router.get('/client/payments', mine(async (_req, res, c) => res.json((await content.listPayments({ client_id: c.id })).map(payView))))
router.post('/client/payments', mine(async (req, res, c) => {
  const p = await content.createPayment(req.body || {}, { source: 'client', clientId: c.id })
  await audit({ actor: CLIENT, action: 'create', entity: 'payment', entityId: p.id, after: { client: c.name, amount: p.amount, currency: p.currency, quote_id: p.quote_id, reference: p.reference } })
  // The stored row has no invoice number; the list does.
  const full = (await content.listPayments({ client_id: c.id })).find(x => x.id === p.id)
  res.status(201).json(payView(full || p))
}))
const ownPayment = async (c, id) => { const p = await content.getPayment(id); if (!p || p.client_id !== c.id) throw bad('payment not found', 404); return p }
router.post('/client/payments/:id/receipt', mine(async (req, res, c) => {
  const p = await ownPayment(c, req.params.id)
  if (p.status !== 'submitted') throw bad(`This payment is ${p.status}; its receipt can no longer be changed.`, 409)
  res.status(201).json(await startDoc({ client_id: c.id, quote_id: p.quote_id, payment_id: p.id, label: 'Payment receipt' }, req.body))
}))
router.post('/client/payments/:id/receipt/:docId/complete', mine(async (req, res, c) => {
  const p = await ownPayment(c, req.params.id)
  const d = await finishDoc(req.params.docId, x => x.payment_id === p.id && x.client_id === c.id)
  await content.setPaymentReceipt(p.id, d.id)
  const [full] = (await content.listPayments({ client_id: c.id })).filter(x => x.id === p.id)
  await noticeTeam({ headline: `${c.name} uploaded a payment receipt${full?.quote ? ` for ${full.quote.number}` : ''}`, details: `Amount: ${p.currency} ${p.amount.toLocaleString('en-NG')}${p.reference ? `\nReference: ${p.reference}` : ''}${p.paid_on ? `\nPaid on: ${p.paid_on}` : ''}`, link: panelLink('/payments') })
  res.json(docView(d._row))
}))
router.get('/client/payments/:id/receipt/url', mine(async (req, res, c) => {
  const p = await ownPayment(c, req.params.id)
  if (!p.receipt_document_id) throw bad('No receipt was uploaded for this payment.', 404)
  const { url, expires_in } = await content.documentUrl(p.receipt_document_id, { expires: 600 })
  res.json({ url, expires_in })
}))
/* Company documents the client uploads themselves (KYC). Files our team keeps on the client stay private to the team. */
const KYC_LABELS = ['Business registration certificate', 'Tax identification', 'Means of identification of a director', 'Proof of address', 'Other document']
const isKyc = d => d.payment_id == null && d.quote_id == null && String(d.label || '').startsWith('KYC: ')
router.get('/client/documents', mine(async (_req, res, c) => res.json({ labels: KYC_LABELS, items: (await content.listDocuments({ client_id: c.id })).filter(isKyc).map(d => ({ ...docView(d), label: d.label.slice(5) })) })))
router.post('/client/documents', mine(async (req, res, c) => {
  const count = (await content.listDocuments({ client_id: c.id })).filter(isKyc).length
  const label = `KYC: ${KYC_LABELS.includes(req.body?.label) ? req.body.label : 'Other document'}`
  res.status(201).json(await startDoc({ client_id: c.id, label }, req.body, { limit: 15, count }))
}))
router.post('/client/documents/:docId/complete', mine(async (req, res, c) => {
  const d = await finishDoc(req.params.docId, x => x.client_id === c.id && isKyc(x))
  await audit({ actor: CLIENT, action: 'upload', entity: 'document', entityId: d.id, after: { name: d.name, client_id: c.id, label: d.label } })
  await noticeTeam({ headline: `${c.name} uploaded a company document`, details: `${d.label.slice(5)}: ${d.name}`, link: panelLink(`/clients/${c.id}?tab=documents`) })
  res.json({ ...docView(d._row), label: d.label.slice(5) })
}))
router.get('/client/documents/:docId/url', mine(async (req, res, c) => {
  const d = await content.getDocument(req.params.docId, { any: true })
  if (!d || d.client_id !== c.id || !isKyc(d)) throw bad('document not found', 404)
  const { url } = await content.documentUrl(d.id, { expires: 600 }); res.json({ url })
}))
// Orders recorded by our team for this client: the transaction history.
router.get('/client/purchases', mine(async (_req, res, c) => {
  res.json((await content.listPurchases({ client_id: c.id })).map(p => ({ id: p.id, description: p.description, reference: p.reference, amount: Number(p.amount), currency: p.currency, status: p.status, purchased_at: p.purchased_at, created_at: p.created_at })))
}))

export default router
