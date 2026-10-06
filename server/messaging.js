/*
 * The outbound email pipeline, shared by the admin routes and the MCP tools.
 *
 *   compose -> record (queued) -> Resend -> record (sent | failed) -> audit
 *
 * A message row is written BEFORE the provider is called, so a crash between
 * the two can never lose the fact that a send was attempted, and a failure
 * is stored with Resend's reason for the panel to show.
 *
 * Subjects and bodies come from the editable templates (templates.js) when
 * the caller does not supply them. Sending can be disabled without touching
 * code: EMAIL_DRY_RUN=1 records the message as sent with a `dry-run`
 * provider id and never contacts Resend.
 */
import * as content from './content.js'
import { audit } from './audit.js'
import { sendEmail, renderEmailHtml, fetchSentMessageId } from './email.js'
import { decryptSecret } from './secrets.js'
import { renderQuotePdf, renderPurchaseOrderPdf } from './quote-pdf.js'
import { renderKey } from './templates.js'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const bad = (message, status = 400) => Object.assign(new Error(message), { expose: true, status })
const MAX_ATTACH = 25 * 1024 * 1024

export const dryRun = () => process.env.EMAIL_DRY_RUN === '1'
export const SYSTEM_ACTOR = { id: null, label: 'system' }

/** Panel-stored key first (the owner's choice), then the environment. */
export async function resolveResendKey() {
  const stored = decryptSecret((await content.readSecrets()).resend_api_key)
  if (stored) return { key: stored, source: 'panel' }
  if (process.env.RESEND_API_KEY) return { key: process.env.RESEND_API_KEY, source: 'env' }
  return { key: null, source: null }
}
export async function resolveWebhookSecret() {
  const stored = decryptSecret((await content.readSecrets()).resend_webhook_secret)
  if (stored) return { secret: stored, source: 'panel' }
  if (process.env.RESEND_WEBHOOK_SECRET) return { secret: process.env.RESEND_WEBHOOK_SECRET, source: 'env' }
  return { secret: null, source: null }
}

export const publicUrl = () => (process.env.SITE_URL || process.env.ADMIN_URL || '').replace(/\/$/, '')
export const quoteLink = q => `${publicUrl()}/q/${q.token}`
export const panelLink = path => `${publicUrl()}/staff360${path}`
export const orderLink = o => `${publicUrl()}/po/${o.token}`
export const supplierLink = path => `${publicUrl()}/supplier${path}`
export const tenderLink = t => `${publicUrl()}/bidding/${t.number}`

/**
 * Send one email to one person and log it.
 * @param {object} o
 * @param {object} o.actor            req.user, MCP_ACTOR or SYSTEM_ACTOR
 * @param {string} o.to
 * @param {string} [o.toName]
 * @param {string} o.subject
 * @param {string} o.body             plain text
 * @param {number[]} [o.attachmentIds] document ids to attach
 * @param {{filename:string, content:Buffer}[]} [o.extraAttachments] generated files (quote PDF)
 * @param {object} [o.cta]            { label, url } button under the text
 * @param {number|null} [o.clientId]
 * @param {number|null} [o.quoteId]
 * @param {number|null} [o.enquiryId]
 * @param {'sales'|'procurement'} [o.scope]  procurement mail is filed under the supplier, apart from sales
 * @param {number|null} [o.supplierId]
 * @param {number|null} [o.bidId]
 * @param {number|null} [o.poId]
 */
export async function deliver({ actor, to, toName = '', subject, body, attachmentIds = [], extraAttachments = [], cta = null, clientId = null, quoteId = null, enquiryId = null, inReplyTo = null, internal = false, auto = false, fromId = null, signOff = false, scope = 'sales', supplierId = null, bidId = null, poId = null }) {
  to = String(to || '').trim()
  if (!EMAIL_RE.test(to)) throw bad('Please enter a valid recipient email address.')
  subject = String(subject || '').trim().slice(0, 300)
  if (!subject) throw bad('Please enter a subject.')
  body = String(body || '').trim().slice(0, 20000)
  if (!body) throw bad('Please write a message.')

  const settings = await content.getSettings()
  const procurement = scope === 'procurement'
  // Who it is from: the chosen department (or the default From; procurement has its own default
  // under Settings → Procurement), plus a sign-off line naming the staff member and their position
  // on free-text emails.
  const sender = await content.resolveSender(fromId || (procurement ? settings.procurement?.from_id : null) || null, settings)
  const who = signOff && actor?.name ? `${actor.name}${actor.position ? `, ${actor.position}` : ''}` : ''
  const signature = [who, sender.signature].filter(Boolean).join('\n')
  const html = renderEmailHtml({ body, signature, company: settings.company, cta })
  const text = signature ? `${body}\n\n${signature}` : body
  const replyTo = settings.email.inbound_address || sender.reply_to

  // Threading: a reply carries In-Reply-To / References pointing at the
  // message it answers, so the client's mail app files it in the same
  // thread. The old text is NOT pasted into the body.
  const parentId = inReplyTo?.provider_message_id || null
  const references = parentId ? [inReplyTo.headers?.references, inReplyTo.in_reply_to, parentId].filter(Boolean).join(' ') : null
  const headers = parentId ? { 'In-Reply-To': parentId, References: references } : {}

  const attachments = [...extraAttachments]
  const meta = extraAttachments.map(a => ({ document_id: null, name: a.filename }))
  for (const id of attachmentIds.map(Number).filter(Boolean)) {
    const { document, content: buf } = await content.downloadDocument(id).catch(() => { throw bad(`Attachment #${id} was not found.`) })
    attachments.push({ filename: document.name, content: buf })
    meta.push({ document_id: document.id, name: document.name })
  }
  if (attachments.reduce((s, a) => s + a.content.length, 0) > MAX_ATTACH) throw bad('Attachments must total under 25 MB.')

  const msg = await content.createMessage({
    client_id: clientId, quote_id: quoteId, enquiry_id: enquiryId, direction: 'out',
    to_email: to, to_name: String(toName || '').slice(0, 200), from_email: sender.from,
    subject, body, html, status: 'queued', attachments: meta, sent_by: actor?.id ?? null,
    // `internal` marks mail to the team itself (notifications), kept out of client conversations.
    headers: { ...(parentId ? { 'in-reply-to': parentId, references } : {}), ...(internal ? { internal: true } : {}) }, ...(parentId ? { in_reply_to: parentId } : {}),
    // Only procurement mail names the new columns, so sales keeps working before migration 014.
    ...(procurement ? { scope: 'procurement', supplier_id: supplierId, bid_id: bidId, po_id: poId } : {}),
  })

  let sent, key = null
  try {
    if (dryRun()) sent = { id: `dry-run-${msg.id}` }
    else {
      key = (await resolveResendKey()).key
      if (!key) throw bad('Email is not set up yet. Add your Resend API key under Settings → Email.', 503)
      sent = await sendEmail({ apiKey: key, from: sender.from, to, replyTo, subject, text, html, attachments, headers })
    }
  } catch (e) {
    const failed = await content.updateMessage(msg.id, { status: 'failed', error: String(e.message).slice(0, 1000) })
    await audit({ actor, action: 'send_failed', entity: 'message', entityId: msg.id, after: { to, subject, error: e.message } })
    throw Object.assign(e, { expose: true, status: e.status || 502, message_id: msg.id, message: e.message, record: failed })
  }

  const messageId = dryRun() ? `<dry-run-${msg.id}@vertocagro.local>` : await fetchSentMessageId({ apiKey: key, id: sent.id })
  const done = await content.updateMessage(msg.id, { status: 'sent', provider_id: sent.id, ...(messageId ? { provider_message_id: messageId } : {}) })
  await audit({ actor, action: 'send', entity: 'message', entityId: msg.id, after: { to, subject, quote_id: quoteId, enquiry_id: enquiryId, ...(procurement ? { scope, supplier_id: supplierId, bid_id: bidId, po_id: poId } : {}), attachments: meta.length } })

  // A reply to a fresh enquiry moves it out of "new" on its own — but an automatic
  // acknowledgement is not a reply, so the request stays new for the team.
  if (enquiryId && !auto) {
    const e = await content.getEnquiry(enquiryId).catch(() => null)
    if (e?.status === 'new') await content.updateEnquiry(e.id, { status: e.kind === 'quote' ? 'contacted' : 'replied' }).catch(() => {})
  }
  return done
}

/** Email a quote: PDF attached, public link as the button, status -> sent. */
export async function sendQuote(id, { actor, to, subject, body, attachmentIds = [], fromId = null }) {
  const q = await content.getQuote(id)
  if (!q) throw bad('invoice not found', 404)
  if (['accepted', 'declined'].includes(q.status)) throw bad(`This invoice was already ${q.status}; create a new one instead.`)
  if (!q.items?.length) throw bad('Add at least one line item before sending.')
  const settings = await content.getSettings()
  const fields = await content.listQuoteFields()
  const link = quoteLink(q)
  const pdf = await renderQuotePdf(q, settings, fields, link)
  const recipient = to || q.client_email
  const tpl = await renderKey('quote', { quote: q, link, settings, actor })
  // File the PDF under the client's documents (and the invoice), replacing the copy from an
  // earlier send of the same invoice, so it shows on the client record and can be reopened.
  let pdfDoc = null
  try {
    const previous = (await content.listDocuments({ quote_id: q.id })).find(d => d.name === `${q.number}.pdf`)
    if (previous) await content.deleteDocument(previous.id)
    pdfDoc = await content.createDocumentFromBuffer({ client_id: q.client_id, quote_id: q.id, name: `${q.number}.pdf`, content_type: 'application/pdf', content: pdf, folder: `invoices/${q.id}` }, actor?.id ?? null)
  } catch (e) { console.error('[send-quote] pdf not filed:', e.message) }
  const msg = await deliver({
    actor, to: recipient, toName: q.client_name,
    subject: subject || tpl.subject, body: body || tpl.body,
    attachmentIds: pdfDoc ? [pdfDoc.id, ...attachmentIds] : attachmentIds, extraAttachments: pdfDoc ? [] : [{ filename: `${q.number}.pdf`, content: pdf }],
    cta: tpl.cta || { label: 'View and respond online', url: link },
    clientId: q.client_id, quoteId: q.id, fromId,
  })
  const quote = await content.markQuoteSent(q.id, { to: recipient })
  if (q.client_id) await content.notify('client', q.client_id, { title: `Invoice ${q.number} is ready`, body: q.title || '', link: `/q/${q.token}` })
  await audit({ actor, action: 'send', entity: 'quote', entityId: q.id, after: { number: q.number, to: recipient, message_id: msg.id } })
  if (q.client_id) {
    // A quote request in the inbox moves to "quoted" once a quote goes out.
    const enqs = await content.listClientEnquiries(q.client_id).catch(() => [])
    for (const e of enqs.filter(e => e.kind === 'quote' && ['new', 'contacted'].includes(e.status))) {
      await content.updateEnquiry(e.id, { status: 'quoted' }).catch(() => {})
    }
  }
  return { quote, message: msg }
}

/**
 * A fresh set-password link for an existing staff account, from the user
 * page. Unaccepted invitation → the invitation again (new link, old one
 * stops working); confirmed account → a one-time recovery link. Goes out
 * through Resend with the matching template, or the Supabase mailer when
 * no key is configured.
 */
export async function sendSetPasswordLink({ actor, profile, supabase, redirectTo }) {
  const { data: au } = await supabase.auth.admin.getUserById(profile.id)
  const confirmed = Boolean(au?.user?.email_confirmed_at || au?.user?.confirmed_at)
  const kind = confirmed ? 'password_link' : 'reinvite'
  const { key } = await resolveResendKey()
  if (!key && !dryRun()) {
    const { error } = confirmed
      ? await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo })
      : await supabase.auth.admin.inviteUserByEmail(profile.email, { data: { name: profile.name }, redirectTo })
    if (error) throw bad(error.message)
    return { kind, via: 'supabase', message: null }
  }
  const { data, error } = await supabase.auth.admin.generateLink({ type: confirmed ? 'recovery' : 'invite', email: profile.email, options: { redirectTo, ...(confirmed ? {} : { data: { name: profile.name } }) } })
  if (error) throw bad(error.message)
  const link = data.properties?.action_link
  if (!link) throw new Error('Supabase returned no link')
  const tpl = await renderKey(confirmed ? 'password_link' : 'user_invite', { name: profile.name, email: profile.email, role: profile.role, link, actor })
  try {
    const message = await deliver({ actor, to: profile.email, toName: profile.name, subject: tpl.subject, body: tpl.body, cta: tpl.cta || { label: 'Set your password', url: link }, internal: true })
    return { kind, via: 'resend', message }
  } catch (e) {
    const { error: fbErr } = confirmed
      ? await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo })
      : await supabase.auth.admin.inviteUserByEmail(profile.email, { data: { name: profile.name }, redirectTo })
    if (fbErr) throw e
    return { kind, via: 'supabase', message: null, warning: `Sent with the plain Supabase email instead: ${e.message}` }
  }
}

/**
 * Automatic confirmation to whoever submitted the website's Request a Quote
 * form, with the "Quote request received" template. Best effort: never
 * throws, and the request stays "new" for the team. Returns the message row
 * or null when acknowledgements are switched off / email is not set up.
 */
export async function acknowledgeEnquiry(enquiry, { settings: given } = {}) {
  try {
    const settings = given || (await content.getSettings())
    if (settings.email.ack_enquiries === false || !EMAIL_RE.test(String(enquiry?.email || ''))) return null
    const tpl = await renderKey('enquiry_received', { enquiry, settings })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor: SYSTEM_ACTOR, to: enquiry.email, toName: enquiry.name, subject: tpl.subject, body: tpl.body, cta: tpl.cta, enquiryId: enquiry.id, auto: true })
  } catch (e) { console.error('[acknowledge]', e.message); return null }
}

/**
 * Notification to the team (quote answered, email received). Best effort:
 * never throws, never blocks the action that triggered it.
 */
export async function notifyTeam(key, ctx) {
  try {
    const settings = ctx.settings || (await content.getSettings())
    const flag = { inbound_notice: settings.email.notify_inbound, quote_response: settings.email.notify_responses, enquiry_notice: settings.email.notify_enquiries, review_notice: settings.email.notify_reviews }[key]
    const to = settings.email.notify_to || settings.email.reply_to
    if (!flag || !EMAIL_RE.test(to)) return null
    const tpl = await renderKey(key, { ...ctx, settings })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor: SYSTEM_ACTOR, to, subject: tpl.subject, body: tpl.body, cta: tpl.cta, clientId: ctx.quote?.client_id ?? ctx.message?.client_id ?? null, quoteId: ctx.quote?.id ?? null, internal: true })
  } catch (e) { console.error(`[notify:${key}]`, e.message); return null }
}

/**
 * Invite a team member. With email configured, the set-password link is
 * generated here and sent through Resend with the "Staff invitation"
 * template; otherwise Supabase's own mailer is used as before.
 */
export async function inviteUser({ actor, email, name = '', role = 'editor', supabase, redirectTo }) {
  const { key } = await resolveResendKey()
  const useResend = Boolean(key) || dryRun()
  if (!useResend) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { data: { name }, redirectTo })
    if (error) throw bad(error.message.includes('already') ? 'That email already has an account.' : error.message)
    return { user: data.user, via: 'supabase', message: null }
  }
  const { data, error } = await supabase.auth.admin.generateLink({ type: 'invite', email, options: { data: { name }, redirectTo } })
  if (error) throw bad(error.message.includes('already') ? 'That email already has an account.' : error.message)
  const link = data.properties?.action_link
  if (!link) throw new Error('Supabase returned no invite link')
  const tpl = await renderKey('user_invite', { name, email, role, link, actor })
  try {
    const message = await deliver({ actor, to: email, toName: name, subject: tpl.subject, body: tpl.body, cta: tpl.cta || { label: 'Set your password', url: link }, internal: true })
    return { user: data.user, via: 'resend', message }
  } catch (e) {
    // Resend refused (typically: domain not verified yet). Fall back to the
    // Supabase mailer so the invitation still goes out, and say why.
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => {})
    const { data: fb, error: fbErr } = await supabase.auth.admin.inviteUserByEmail(email, { data: { name }, redirectTo })
    if (fbErr) throw e
    return { user: fb.user, via: 'supabase', message: null, warning: `Sent with the plain Supabase email instead: ${e.message}` }
  }
}

/* ------------------------------------------------------- procurement --- */
// Everything below is filed under the supplier (scope 'procurement'), apart
// from sales conversations. The automatic ones are best effort: they never
// throw and never block the action that triggered them.

const procEnabled = async flag => { const s = await content.getSettings(); return { settings: s, on: s.procurement?.[flag] !== false } }

/** "We received your bid" to the supplier, as soon as it arrives. */
export async function acknowledgeBid({ bid, tender }) {
  try {
    const { settings, on } = await procEnabled('ack_bids')
    if (!on || !EMAIL_RE.test(String(bid?.email || ''))) return null
    const tpl = await renderKey('bid_received', { bid, tender, settings, link: supplierLink(`/bids/${bid.id}`) })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor: SYSTEM_ACTOR, to: bid.email, toName: bid.contact_person || bid.company_name, subject: tpl.subject, body: tpl.body, cta: tpl.cta, scope: 'procurement', supplierId: bid.supplier_id, bidId: bid.id, auto: true })
  } catch (e) { console.error('[acknowledge-bid]', e.message); return null }
}

/** Notification to the procurement team: a bid arrived, a supplier answered, an order was acknowledged, an email came in. */
export async function notifyProcurement(key, ctx) {
  try {
    const { settings, on } = await procEnabled('notify_bids')
    const to = settings.procurement?.notify_to || settings.email.notify_to || settings.email.reply_to
    if (!on || !EMAIL_RE.test(to)) return null
    const tpl = await renderKey(key, { ...ctx, settings })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor: SYSTEM_ACTOR, to, subject: tpl.subject, body: tpl.body, cta: tpl.cta, scope: 'procurement', supplierId: ctx.bid?.supplier_id ?? ctx.order?.supplier_id ?? ctx.message?.supplier_id ?? null, bidId: ctx.bid?.id ?? null, poId: ctx.order?.id ?? null, internal: true })
  } catch (e) { console.error(`[notify-procurement:${key}]`, e.message); return null }
}

/** The supplier is told whenever the status of their bid changes (Settings → Procurement can switch it off). */
export async function notifyBidStatus({ bid, tender, actor = SYSTEM_ACTOR, force = false }) {
  try {
    const { settings, on } = await procEnabled('notify_status')
    await content.notify('supplier', bid.supplier_id, { title: `Your bid on ${tender?.number || 'the opportunity'}: ${({ open: 'Open', under_review: 'Under review', shortlisted: 'Shortlisted', awarded: 'Awarded', not_selected: 'Not selected' })[bid.status] || bid.status}`, body: bid.status_note || '', link: `/supplier/bids/${bid.id}` })
    if ((!on && !force) || !EMAIL_RE.test(String(bid?.email || ''))) return null
    const tpl = await renderKey('bid_status', { bid, tender, settings, actor, link: supplierLink(`/bids/${bid.id}`) })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor, to: bid.email, toName: bid.contact_person || bid.company_name, subject: tpl.subject, body: tpl.body, cta: tpl.cta, scope: 'procurement', supplierId: bid.supplier_id, bidId: bid.id, auto: true })
  } catch (e) { console.error('[bid-status]', e.message); return null }
}

/** A request for additional information goes to the supplier by email; they answer in their dashboard. */
export async function sendBidRequest({ bid, tender, request, actor }) {
  try {
    await content.notify('supplier', bid.supplier_id, { title: `We need more information about your bid on ${tender?.number || ''}`.trim(), body: request?.question || '', link: `/supplier/bids/${bid.id}` })
    if (!EMAIL_RE.test(String(bid?.email || ''))) return null
    const tpl = await renderKey('bid_request', { bid, tender, request, actor, link: supplierLink(`/bids/${bid.id}`) })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor, to: bid.email, toName: bid.contact_person || bid.company_name, subject: tpl.subject, body: tpl.body, cta: tpl.cta, scope: 'procurement', supplierId: bid.supplier_id, bidId: bid.id, auto: true })
  } catch (e) { console.error('[bid-request]', e.message); return null }
}

/**
 * The one-time link for a supplier account: confirm the email address, or
 * choose a new password. Unlike the notices above this one throws — without
 * the email the account cannot be used, so the caller must know.
 */
export async function sendSupplierLink({ supplier, kind, token }) {
  const link = supplierLink(`/${kind === 'reset' ? 'reset' : 'verify'}?token=${token}`)
  const tpl = await renderKey(kind === 'reset' ? 'supplier_reset' : 'supplier_verify', { supplier, link })
  const d = DEFAULT_LINK_TEXT[kind === 'reset' ? 'reset' : 'verify']
  return deliver({ actor: SYSTEM_ACTOR, to: supplier.email, toName: supplier.contact_person || supplier.company_name, subject: tpl.subject || d.subject, body: tpl.body || d.body, cta: tpl.cta || { label: d.cta, url: link }, scope: 'procurement', supplierId: supplier.id, internal: true, auto: true })
}
// A switched-off template must not lock suppliers out of their accounts.
const DEFAULT_LINK_TEXT = {
  verify: { subject: 'Confirm your supplier account', body: 'Please confirm your email address with the button below to activate your supplier account. The link works once and expires in 24 hours.', cta: 'Confirm my email address' },
  reset: { subject: 'Choose a new password', body: 'Use the button below to choose a new password for your supplier account. The link works once and expires in 2 hours.', cta: 'Choose a new password' },
}

/** Email a PO / LPO: PDF attached, the supplier's link as the button, status -> issued. */
export async function sendPurchaseOrder(id, { actor, to, subject, body, attachmentIds = [], fromId = null }) {
  const o = await content.getPurchaseOrder(id)
  if (!o) throw bad('order not found', 404)
  if (['acknowledged', 'fulfilled'].includes(o.status)) throw bad(`This order was already ${o.status}; raise a new one instead.`)
  if (o.status === 'cancelled') throw bad('This order was cancelled. Set it back to draft to send it.')
  if (!o.items?.length) throw bad('Add at least one line item before sending.')
  const settings = await content.getSettings()
  const link = orderLink(o)
  const pdf = await renderPurchaseOrderPdf(o, settings, link)
  const recipient = to || o.supplier_email
  const tpl = await renderKey('purchase_order', { order: o, link, settings, actor })
  // File the PDF under the supplier, replacing the copy from an earlier send of the same order.
  let pdfDoc = null
  try {
    const previous = (await content.listDocuments({ po_id: o.id })).find(d => d.name === `${o.number}.pdf`)
    if (previous) await content.deleteDocument(previous.id)
    pdfDoc = await content.createDocumentFromBuffer({ supplier_id: o.supplier_id, po_id: o.id, name: `${o.number}.pdf`, content_type: 'application/pdf', content: pdf, folder: `orders/${o.id}` }, actor?.id ?? null)
  } catch (e) { console.error('[send-order] pdf not filed:', e.message) }
  const msg = await deliver({
    actor, to: recipient, toName: o.supplier_name,
    subject: subject || tpl.subject, body: body || tpl.body,
    attachmentIds: pdfDoc ? [pdfDoc.id, ...attachmentIds] : attachmentIds, extraAttachments: pdfDoc ? [] : [{ filename: `${o.number}.pdf`, content: pdf }],
    cta: tpl.cta || { label: 'View and acknowledge online', url: link },
    scope: 'procurement', supplierId: o.supplier_id, bidId: o.bid_id, poId: o.id, fromId,
  })
  const order = await content.markPurchaseOrderIssued(o.id)
  if (o.supplier_id) await content.notify('supplier', o.supplier_id, { title: `${o.kind === 'po' ? 'Purchase order' : 'LPO'} ${o.number} has been issued to you`, body: o.title || '', link: `/po/${o.token}` })
  await audit({ actor, action: 'send', entity: 'purchase_order', entityId: o.id, after: { number: o.number, to: recipient, message_id: msg.id } })
  return { order, message: msg }
}

/**
 * The same email to every supplier whose bid on an opportunity has one of
 * the given statuses ("contact the shortlisted suppliers"). Each supplier
 * gets their own email, addressed by name, in their own conversation.
 * {{name}}, {{supplier_name}}, {{tender_number}} and {{tender_title}} are filled in per supplier.
 */
export async function messageBidders({ tender, bids, subject, body, actor, fromId = null }) {
  subject = String(subject || '').trim(); body = String(body || '').trim()
  if (!subject) throw bad('Please enter a subject.')
  if (!body) throw bad('Please write a message.')
  if (!bids.length) throw bad('No supplier matches.')
  const { renderTemplate } = await import('./templates.js')
  const sent = [], failed = []
  for (const b of bids) {
    const vars = { name: b.contact_person || b.company_name, supplier_name: b.company_name, tender_number: tender.number, tender_title: tender.title }
    try {
      const m = await deliver({ actor, to: b.email, toName: b.contact_person || b.company_name, subject: renderTemplate(subject, vars), body: renderTemplate(body, vars), scope: 'procurement', supplierId: b.supplier_id, bidId: b.id, fromId, signOff: true })
      sent.push({ bid_id: b.id, to: b.email, message_id: m.id })
    } catch (e) { failed.push({ bid_id: b.id, to: b.email, error: e.message }) }
  }
  return { sent, failed }
}

/* ------------------------------------------ codes, portals, notices --- */
export const portalLink = (portal, path = '') => `${publicUrl()}/${portal}${path}`

/** The one-time code for accepting an invoice or acknowledging an order. Throws if it cannot be sent. */
export async function sendOtp({ to, name, code, purpose, reference, minutes, clientId = null, quoteId = null, supplierId = null, poId = null }) {
  const tpl = await renderKey('otp_code', { name, code, purpose, reference, minutes })
  const subject = tpl.subject || `Your verification code for ${reference}`
  const body = tpl.body && tpl.body.includes(code) ? tpl.body : `Use this code to ${purpose} ${reference}:\n\n${code}\n\nIt is valid for ${minutes} minutes.`
  const procurement = supplierId != null || poId != null
  return deliver({ actor: SYSTEM_ACTOR, to, toName: name, subject, body, internal: true, auto: true, clientId, quoteId, ...(procurement ? { scope: 'procurement', supplierId, poId } : {}) })
}
/** Confirm-email and reset-password links for client and investor accounts. Throws if it cannot be sent. */
export async function sendAccountLink({ portal, kind, token, email, name, clientId = null }) {
  const link = portalLink(portal, `/${kind === 'reset' ? 'reset' : 'verify'}?token=${token}`)
  const tpl = await renderKey(kind === 'reset' ? 'account_reset' : 'account_verify', { name, email, portal, link })
  const d = DEFAULT_LINK_TEXT[kind === 'reset' ? 'reset' : 'verify']
  return deliver({ actor: SYSTEM_ACTOR, to: email, toName: name, subject: tpl.subject || d.subject.replace('supplier', portal), body: tpl.body || d.body.replace('supplier', portal), cta: tpl.cta || { label: d.cta, url: link }, internal: true, auto: true, clientId })
}
/** Tell the team something arrived from a portal. Best effort. */
export async function noticeTeam({ headline, details = '', link, procurement = false, flag = 'notify_inbound' }) {
  try {
    const settings = await content.getSettings()
    const to = (procurement ? settings.procurement?.notify_to : '') || settings.email.notify_to || settings.email.reply_to
    if ((procurement ? settings.procurement?.notify_bids === false : settings.email[flag] === false) || !EMAIL_RE.test(to)) return null
    const tpl = await renderKey('portal_notice', { headline, details, link, settings })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor: SYSTEM_ACTOR, to, subject: tpl.subject, body: tpl.body, cta: tpl.cta, internal: true, ...(procurement ? { scope: 'procurement' } : {}) })
  } catch (e) { console.error('[notice-team]', e.message); return null }
}
/** Tell a client, supplier or investor that the team acted: a line in their portal, and an email. Best effort. */
export async function tellPortal({ audience, id, email, name, headline, details = '', path = '', actor = SYSTEM_ACTOR, mail = true }) {
  const portal = { client: 'client', supplier: 'supplier', investor: 'investor' }[audience]
  await content.notify(audience, id, { title: headline, body: details, link: `/${portal}${path}` })
  if (!mail || !EMAIL_RE.test(String(email || ''))) return null
  try {
    const tpl = await renderKey('portal_update', { name, headline, details, link: portalLink(portal, path) })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor, to: email, toName: name, subject: tpl.subject, body: tpl.body, cta: tpl.cta, auto: true, internal: audience === 'investor',
      ...(audience === 'client' ? { clientId: id } : audience === 'supplier' ? { scope: 'procurement', supplierId: id } : {}) })
  } catch (e) { console.error('[tell-portal]', e.message); return null }
}
/** The supplier is told their bid was reopened. Best effort. */
export async function notifyBidUnlocked({ bid, tender, reason, actor }) {
  await content.notify('supplier', bid.supplier_id, { title: `Your bid on ${tender.number} was reopened for changes`, body: reason, link: `/supplier/bids/${bid.id}` })
  try {
    if (!EMAIL_RE.test(String(bid.email || ''))) return null
    const tpl = await renderKey('bid_unlocked', { bid, tender, reason, actor, link: supplierLink(`/bids/${bid.id}`) })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor, to: bid.email, toName: bid.contact_person || bid.company_name, subject: tpl.subject, body: tpl.body, cta: tpl.cta, scope: 'procurement', supplierId: bid.supplier_id, bidId: bid.id, auto: true })
  } catch (e) { console.error('[bid-unlocked]', e.message); return null }
}

