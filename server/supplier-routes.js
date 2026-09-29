/*
 * The public half of procurement, mounted at /api:
 *
 *   /tenders…            bidding opportunities the website lists, and bid submission
 *   /bids/:id/files…     documents for a bid just submitted without an account (upload token)
 *   /po/:token…          the supplier's page for a purchase order (the token is the credential)
 *   /supplier/…          supplier accounts: register, confirm, sign-in help, and the dashboard
 *
 * Suppliers sign in with Supabase Auth in the browser and send the access
 * token as a bearer, like staff do — but they are checked against the
 * `suppliers` table, never `profiles`, so a supplier can reach nothing in
 * the panel and staff accounts are not supplier accounts.
 */
import { Router } from 'express'
import * as content from './content.js'
import { audit } from './audit.js'
import { verifyTurnstile } from './verify-turnstile.js'
import { bad, handler, isEmail, clientIp, throttled } from './http.js'
import { acknowledgeBid, notifyProcurement, sendSupplierLink, panelLink, orderLink } from './messaging.js'
import { renderPurchaseOrderPdf } from './quote-pdf.js'
import { driver } from './store/index.js'

const router = Router()
// Visitors never see which migration is missing: until procurement is set up the list is
// simply empty and everything else says it is not available yet.
const guarded = handler('supplier')
const h = fn => guarded(async (req, res) => {
  try { await fn(req, res) }
  catch (e) {
    if (!(e.expose && /database migration/.test(e.message))) throw e
    if (req.method === 'GET' && req.path === '/tenders') return res.json([])
    throw bad('Bidding is not available yet. Please check back soon.', 503)
  }
})
let svc = null
const supabase = () => svc ??= import('./store/supabase.js').then(m => m.supabase)
const SUPPLIER = { id: null, label: 'supplier' }
const clean = (v, max = 2000) => String(v ?? '').trim().slice(0, max)
const isUpstream = e => e?.name === 'AuthRetryableFetchError' || (typeof e?.status === 'number' && e.status >= 500) || /fetch failed|ECONN|ETIMEDOUT|socket/i.test(String(e?.message))

// Procurement needs Supabase (accounts, storage); say so instead of failing oddly on the SQLite dev store.
router.use(['/tenders', '/bids', '/po', '/supplier'], (_req, res, next) => (driver === 'supabase' ? next() : res.status(503).json({ error: 'Procurement requires Supabase.' })))

/* ------------------------------------------------------ who is asking --- */
/** The supplier behind a bearer token: { supplier, user }, null without a token, or throws 401/403. */
async function supplierOf(req, { optional = false } = {}) {
  const hdr = req.get('authorization') || ''
  if (!hdr.startsWith('Bearer ')) { if (optional) return null; throw bad('Sign in required.', 401) }
  const sb = await supabase()
  let r = await sb.auth.getUser(hdr.slice(7))
  if (r.error && isUpstream(r.error)) { await new Promise(x => setTimeout(x, 400)); r = await sb.auth.getUser(hdr.slice(7)) }
  if (r.error && isUpstream(r.error)) throw bad('The sign-in service is unavailable right now. Please try again in a moment.', 503)
  const user = r.data?.user
  if (r.error || !user) throw bad('Your session has expired. Please sign in again.', 401)
  const supplier = await content.getSupplierByUser(user.id)
  if (!supplier) throw bad('This account is not a supplier account.', 403)
  if (supplier.status === 'blocked') throw bad('This supplier account is suspended. Please contact us.', 403)
  if (!supplier.verified_at && !user.email_confirmed_at) throw Object.assign(bad('Please confirm your email address first: use the link we emailed you.', 403), { code: 'unverified' })
  return { supplier, user }
}
const asSupplier = fn => h(async (req, res) => { const who = await supplierOf(req); return fn(req, res, who.supplier, who.user) })
/** What a supplier may see of their own record. */
const mine = s => ({ id: s.id, company_name: s.company_name, contact_person: s.contact_person, email: s.email, phone: s.phone, address: s.address, commodities: s.commodities, verified: Boolean(s.verified_at), created_at: s.created_at })

/* -------------------------------------------- bidding opportunities --- */
router.get('/tenders', h(async (_req, res) => res.json(await content.listPublicTenders())))
router.get('/tenders/:number', h(async (req, res) => {
  const t = await content.getPublicTender(req.params.number)
  if (!t) throw bad('not found', 404)
  res.json({ ...t, declaration: content.BID_DECLARATION, max_files: content.BID_MAX_FILES })
}))

// Submit a bid. With a supplier session the bid goes under that account; without one the same
// defences as the enquiry form apply (honeypot, throttle, captcha) and the response carries a
// short-lived token for attaching documents.
router.post('/tenders/:number/bids', h(async (req, res) => {
  const ip = clientIp(req), b = req.body || {}
  const who = await supplierOf(req, { optional: true })
  if (!who) {
    if (clean(b.website)) return res.status(202).json({ ok: true })   // honeypot
    if (throttled('bid', ip, 12)) throw bad('Too many submissions. Please try again later.', 429)
    const captcha = await verifyTurnstile(b.captchaToken, ip)
    if (!captcha.ok) throw bad('Captcha verification failed. Please try again.')
  }
  const { bid, tender, upload_token } = await content.createBid(req.params.number, b, { supplier: who?.supplier || null, ip })
  await audit({ actor: who ? { id: null, label: 'supplier' } : SUPPLIER, action: 'create', entity: 'bid', entityId: bid.id, after: { supplier: bid.company_name, email: bid.email, tender: tender.number, quantity: bid.quantity, price: bid.price, total: bid.total, account: Boolean(who) } })
  // Best effort, but awaited: a serverless function must not freeze before they go out.
  await Promise.all([acknowledgeBid({ bid, tender }), notifyProcurement('bid_notice', { bid, tender, link: panelLink(`/bids/${bid.id}`) })])
  res.status(201).json({ ok: true, id: bid.id, tender: tender.number, upload_token, max_files: content.BID_MAX_FILES })
}))

/* ------------------------------------------------------- bid documents --- */
const FILE_LABELS = ['Company registration documents', 'CAC documents', 'Commodity specification / quality certificate', 'Previous supply references', 'Other supporting document']
const friendly = e => (/^(createDocument|completeDocument)/.test(e.message) ? e : bad(e.message))
async function startUpload(bid, body, actorId = null) {
  if (await content.countBidFiles(bid.id) >= content.BID_MAX_FILES) throw bad(`A bid can carry up to ${content.BID_MAX_FILES} documents.`)
  const label = FILE_LABELS.includes(body?.label) ? body.label : clean(body?.label, 80)
  const r = await content.createDocument({ bid_id: bid.id, supplier_id: bid.supplier_id, label, name: body?.name, content_type: body?.content_type, bytes: body?.bytes }, actorId).catch(e => { throw friendly(e) })
  return { document: { id: r.document.id, name: r.document.name, label: r.document.label }, upload: r.upload }
}
async function finishUpload(bid, docId) {
  const d = await content.getDocument(docId, { any: true })
  if (!d || d.bid_id !== bid.id) throw bad('document not found', 404)
  const doc = await content.completeDocument(d.id).catch(e => { throw friendly(e) })
  await audit({ actor: SUPPLIER, action: 'upload', entity: 'document', entityId: doc.id, after: { name: doc.name, bytes: doc.bytes, bid_id: bid.id, supplier_id: bid.supplier_id } })
  return { id: doc.id, name: doc.name, label: doc.label || '', bytes: doc.bytes, content_type: doc.content_type, created_at: doc.created_at }
}
const guestBid = async req => {
  if (throttled('bid-file', clientIp(req), 60)) throw bad('Too many uploads. Please try again later.', 429)
  const bid = await content.bidForUploadToken(req.params.id, req.get('x-upload-token') || req.body?.upload_token)
  if (!bid) throw bad('This upload link has expired. Sign in to your supplier account to add documents to your bid.', 403)
  return bid
}
router.get('/bids/file-labels', (_req, res) => res.json(FILE_LABELS))
router.post('/bids/:id/files', h(async (req, res) => res.status(201).json(await startUpload(await guestBid(req), req.body))))
router.post('/bids/:id/files/:docId/complete', h(async (req, res) => res.json(await finishUpload(await guestBid(req), req.params.docId))))

/* ---------------------------------------------- purchase order link --- */
const orderView = async o => content.publicPurchaseOrder(o, await content.getSettings())
router.get('/po/:token', h(async (req, res) => {
  let o = await content.getPurchaseOrderByToken(req.params.token)
  if (!o) throw bad('not found', 404)
  if (o.status === 'issued' && !o.viewed_at) o = await content.markPurchaseOrderViewed(o.id)
  res.json(await orderView(o))
}))
router.get('/po/:token/pdf', h(async (req, res) => {
  const o = await content.getPurchaseOrderByToken(req.params.token)
  if (!o) throw bad('not found', 404)
  const pdf = await renderPurchaseOrderPdf(o, await content.getSettings(), orderLink(o))
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${o.number}.pdf"`)
  res.send(pdf)
}))
router.post('/po/:token/respond', h(async (req, res) => {
  if (throttled('po', clientIp(req), 10)) throw bad('Too many attempts. Please try again later.', 429)
  const o = await content.respondToPurchaseOrder(req.params.token, req.body?.action, req.body?.note)
  if (!o) throw bad('not found', 404)
  await audit({ actor: SUPPLIER, action: o.status, entity: 'purchase_order', entityId: o.id, after: { number: o.number, note: o.response_note } })
  await notifyProcurement('po_response', { order: o, link: panelLink(`/purchase-orders/${o.id}`) })
  res.json(await orderView(o))
}))

/* ---------------------------------------------------- supplier accounts --- */
const PASSWORD_RULE = 'Choose a password of at least 8 characters.'
const okPassword = p => typeof p === 'string' && p.length >= 8 && p.length <= 72

router.post('/supplier/register', h(async (req, res) => {
  const ip = clientIp(req), b = req.body || {}
  if (clean(b.website)) return res.status(202).json({ ok: true })   // honeypot
  const company_name = clean(b.company_name, 200), contact_person = clean(b.contact_person, 120), phone = clean(b.phone, 60), email = clean(b.email, 200).toLowerCase(), address = clean(b.address, 500)
  if (!company_name) throw bad('Please enter your company name.')
  if (!contact_person) throw bad('Please enter the contact person.')
  if (!phone) throw bad('Please enter a phone number.')
  if (!isEmail(email)) throw bad('Please enter a valid email address.')
  if (!okPassword(b.password)) throw bad(PASSWORD_RULE)
  if (throttled('register', ip, 5)) throw bad('Too many attempts. Please try again later.', 429)
  const captcha = await verifyTurnstile(b.captchaToken, ip)
  if (!captcha.ok) throw bad('Captcha verification failed. Please try again.')

  const existing = await content.findSupplierByEmail(email)
  const taken = () => bad('An account already exists for this email address. Sign in, or use "Forgot password" to choose a new password.', 409)
  if (existing?.user_id) throw taken()
  if (existing?.status === 'blocked') throw bad('We cannot open an account for this supplier at the moment. Please contact us.', 403)
  const sb = await supabase()
  const { data, error } = await sb.auth.admin.createUser({ email, password: b.password, email_confirm: false, user_metadata: { account_type: 'supplier', name: contact_person, company: company_name } })
  if (error) { if (/already|registered|exists/i.test(error.message)) throw taken(); throw new Error(`register: ${error.message}`) }
  const user = data.user
  // Before migration 014 the sign-up trigger files every new account as an inactive staff profile: take it out again.
  await sb.from('profiles').delete().eq('id', user.id).eq('active', false).then(() => {}, () => {})
  let supplier
  try {
    if (existing) {
      // Bids made with this address before the account existed already started the record: keep what it has, fill the gaps.
      const gaps = Object.fromEntries(Object.entries({ contact_person, phone, address, commodities: clean(b.commodities, 500) }).filter(([k, v]) => v && !existing[k]))
      if (Object.keys(gaps).length) await content.updateSupplier(existing.id, gaps)
      supplier = await content.attachSupplierAccount(existing.id, user.id)
    } else supplier = await content.createSupplier({ company_name, contact_person, email, phone, address, commodities: clean(b.commodities, 500) }, { source: 'signup', userId: user.id })
    const token = await content.issueSupplierToken(supplier.id, 'verify', 24)
    await sendSupplierLink({ supplier, kind: 'verify', token })
  } catch (e) {
    // No confirmation email, no account: undo, so they can simply try again.
    await sb.auth.admin.deleteUser(user.id).catch(() => {})
    if (supplier && !existing) await content.deleteSupplier(supplier.id).catch(() => {})
    console.error('[supplier-register]', e.message)
    if (e.expose && e.status === 409) throw e
    throw bad('We could not send the confirmation email just now. Please try again in a few minutes.', 503)
  }
  await audit({ actor: SUPPLIER, action: 'register', entity: 'supplier', entityId: supplier.id, after: { company_name: supplier.company_name, email } })
  res.status(201).json({ ok: true, email })
}))

router.post('/supplier/verify', h(async (req, res) => {
  if (throttled('verify', clientIp(req), 20)) throw bad('Too many attempts. Please try again later.', 429)
  const s = await content.supplierForToken(req.body?.token, 'verify', { consume: true })
  if (!s || !s.user_id) throw bad('This confirmation link is no longer valid. Ask for a new one from the sign-in page.', 410)
  const { error } = await (await supabase()).auth.admin.updateUserById(s.user_id, { email_confirm: true })
  if (error) throw new Error(`verify: ${error.message}`)
  await content.markSupplierVerified(s.id)
  await audit({ actor: SUPPLIER, action: 'verify', entity: 'supplier', entityId: s.id, after: { email: s.email } })
  res.json({ ok: true, email: s.email })
}))

// These two always answer the same way, whether or not the address has an account.
const quietly = fn => h(async (req, res) => {
  const email = clean(req.body?.email, 200).toLowerCase()
  if (!isEmail(email)) throw bad('Please enter a valid email address.')
  if (throttled('link', clientIp(req), 5) || throttled('link-to', email, 3, 30 * 60 * 1000)) throw bad('Too many attempts. Please try again later.', 429)
  try { const s = await content.findSupplierByEmail(email); if (s?.user_id && s.status !== 'blocked') await fn(s) } catch (e) { console.error('[supplier-link]', e.message) }
  res.json({ ok: true })
})
router.post('/supplier/resend', quietly(async s => {
  if (s.verified_at) return
  await sendSupplierLink({ supplier: s, kind: 'verify', token: await content.issueSupplierToken(s.id, 'verify', 24) })
}))
router.post('/supplier/forgot', quietly(async s => {
  await sendSupplierLink({ supplier: s, kind: 'reset', token: await content.issueSupplierToken(s.id, 'reset', 2) })
}))
router.post('/supplier/reset', h(async (req, res) => {
  if (throttled('reset', clientIp(req), 10)) throw bad('Too many attempts. Please try again later.', 429)
  if (!okPassword(req.body?.password)) throw bad(PASSWORD_RULE)
  const s = await content.supplierForToken(req.body?.token, 'reset', { consume: true })
  if (!s || !s.user_id) throw bad('This link is no longer valid. Ask for a new one from the sign-in page.', 410)
  // Whoever opened the link owns the mailbox, so the address is confirmed as well.
  const { error } = await (await supabase()).auth.admin.updateUserById(s.user_id, { password: req.body.password, email_confirm: true })
  if (error) throw (/password/i.test(error.message) ? bad(error.message) : new Error(`reset: ${error.message}`))
  if (!s.verified_at) await content.markSupplierVerified(s.id)
  await audit({ actor: SUPPLIER, action: 'password_reset', entity: 'supplier', entityId: s.id, after: { email: s.email } })
  res.json({ ok: true, email: s.email })
}))

/* ------------------------------------------------- supplier dashboard --- */
router.get('/supplier/me', asSupplier(async (_req, res, s) => {
  const [bids, orders] = await Promise.all([content.listSupplierBids(s.id), content.listSupplierOrders(s.id)])
  res.json({ ...mine(s), counts: {
    bids: bids.length, live: bids.filter(b => b.can_withdraw).length, awarded: bids.filter(b => b.status === 'awarded').length,
    not_selected: bids.filter(b => b.status === 'not_selected').length, requests_open: bids.reduce((n, b) => n + (b.requests_open || 0), 0),
    orders: orders.length, orders_open: orders.filter(o => o.status === 'issued').length,
  } })
}))
router.patch('/supplier/me', asSupplier(async (req, res, s) => {
  const b = req.body || {}
  const patch = Object.fromEntries(['company_name', 'contact_person', 'phone', 'address', 'commodities'].filter(k => b[k] !== undefined).map(k => [k, b[k]]))
  const after = await content.updateSupplier(s.id, patch)
  await audit({ actor: SUPPLIER, action: 'update', entity: 'supplier', entityId: s.id, before: mine(s), after: mine(after) })
  res.json(mine(after))
}))
router.get('/supplier/bids', asSupplier(async (_req, res, s) => res.json(await content.listSupplierBids(s.id))))
const ownBid = async (s, id) => { const b = await content.getSupplierBid(s.id, id); if (!b) throw bad('bid not found', 404); return b }
router.get('/supplier/bids/:id', asSupplier(async (req, res, s) => { const { _row, ...b } = await ownBid(s, req.params.id); res.json({ ...b, file_labels: FILE_LABELS, max_files: content.BID_MAX_FILES }) }))
router.post('/supplier/bids/:id/withdraw', asSupplier(async (req, res, s) => {
  const before = await ownBid(s, req.params.id)
  const bid = await content.withdrawBid(s.id, before.id)
  await audit({ actor: SUPPLIER, action: 'withdraw', entity: 'bid', entityId: bid.id, before: { status: before.status }, after: { status: bid.status, supplier: bid.company_name } })
  await notifyProcurement('bid_update_notice', { bid, tender: before.tender && { ...before.tender, id: bid.tender_id }, event: 'withdrew their bid', link: panelLink(`/bids/${bid.id}`) })
  const { _row, ...after } = await ownBid(s, bid.id)
  res.json(after)
}))
router.post('/supplier/bids/:id/requests/:rid/answer', asSupplier(async (req, res, s) => {
  const before = await ownBid(s, req.params.id)
  const { request, bid } = await content.answerBidRequest(s.id, before.id, req.params.rid, req.body?.answer)
  await audit({ actor: SUPPLIER, action: 'answer', entity: 'bid', entityId: bid.id, after: { request_id: request.id, supplier: bid.company_name } })
  await notifyProcurement('bid_update_notice', { bid, tender: before.tender, request, event: 'answered a request for information', link: panelLink(`/bids/${bid.id}`) })
  const { _row, ...after } = await ownBid(s, bid.id)
  res.json(after)
}))
const attachable = b => { if (!b.can_attach) throw bad(`This bid is ${b.label.toLowerCase()}; documents can no longer be changed.`, 409); return b._row }
router.post('/supplier/bids/:id/files', asSupplier(async (req, res, s) => res.status(201).json(await startUpload(attachable(await ownBid(s, req.params.id)), req.body))))
router.post('/supplier/bids/:id/files/:docId/complete', asSupplier(async (req, res, s) => res.json(await finishUpload((await ownBid(s, req.params.id))._row, req.params.docId))))
const ownFile = async (s, bidId, docId) => { const b = await ownBid(s, bidId); const d = await content.getDocument(docId, { any: true }); if (!d || d.bid_id !== b.id) throw bad('document not found', 404); return { b, d } }
router.get('/supplier/bids/:id/files/:docId/url', asSupplier(async (req, res, s) => {
  const { d } = await ownFile(s, req.params.id, req.params.docId)
  const { url, expires_in } = await content.documentUrl(d.id, { download: req.query.download === '1', expires: 600 })
  res.json({ url, expires_in })
}))
router.delete('/supplier/bids/:id/files/:docId', asSupplier(async (req, res, s) => {
  const { b, d } = await ownFile(s, req.params.id, req.params.docId)
  attachable(b)
  await content.deleteDocument(d.id)
  await audit({ actor: SUPPLIER, action: 'delete', entity: 'document', entityId: d.id, before: { name: d.name, bid_id: b.id, supplier_id: s.id } })
  res.json({ deleted: true, id: d.id })
}))
router.get('/supplier/orders', asSupplier(async (_req, res, s) => res.json(await content.listSupplierOrders(s.id))))

export default router
