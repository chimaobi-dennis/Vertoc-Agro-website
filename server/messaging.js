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
import { sendEmail, renderEmailHtml } from './email.js'
import { decryptSecret } from './secrets.js'
import { renderQuotePdf } from './quote-pdf.js'
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
 */
export async function deliver({ actor, to, toName = '', subject, body, attachmentIds = [], extraAttachments = [], cta = null, clientId = null, quoteId = null, enquiryId = null }) {
  to = String(to || '').trim()
  if (!EMAIL_RE.test(to)) throw bad('Please enter a valid recipient email address.')
  subject = String(subject || '').trim().slice(0, 300)
  if (!subject) throw bad('Please enter a subject.')
  body = String(body || '').trim().slice(0, 20000)
  if (!body) throw bad('Please write a message.')

  const settings = await content.getSettings()
  const html = renderEmailHtml({ body, signature: settings.email.signature, company: settings.company, cta })
  const replyTo = settings.email.inbound_address || settings.email.reply_to

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
    to_email: to, to_name: String(toName || '').slice(0, 200), from_email: settings.email.from,
    subject, body, html, status: 'queued', attachments: meta, sent_by: actor?.id ?? null,
  })

  let sent
  try {
    if (dryRun()) sent = { id: `dry-run-${msg.id}` }
    else {
      const { key } = await resolveResendKey()
      if (!key) throw bad('Email is not set up yet. Add your Resend API key under Settings → Email.', 503)
      sent = await sendEmail({ apiKey: key, from: settings.email.from, to, replyTo, subject, text: body, html, attachments })
    }
  } catch (e) {
    const failed = await content.updateMessage(msg.id, { status: 'failed', error: String(e.message).slice(0, 1000) })
    await audit({ actor, action: 'send_failed', entity: 'message', entityId: msg.id, after: { to, subject, error: e.message } })
    throw Object.assign(e, { expose: true, status: e.status || 502, message_id: msg.id, message: e.message, record: failed })
  }

  const done = await content.updateMessage(msg.id, { status: 'sent', provider_id: sent.id })
  await audit({ actor, action: 'send', entity: 'message', entityId: msg.id, after: { to, subject, quote_id: quoteId, enquiry_id: enquiryId, attachments: meta.length } })

  // A reply to a fresh enquiry moves it out of "new" on its own.
  if (enquiryId) {
    const e = await content.getEnquiry(enquiryId).catch(() => null)
    if (e?.status === 'new') await content.updateEnquiry(e.id, { status: e.kind === 'quote' ? 'contacted' : 'replied' }).catch(() => {})
  }
  return done
}

/** Email a quote: PDF attached, public link as the button, status -> sent. */
export async function sendQuote(id, { actor, to, subject, body, attachmentIds = [] }) {
  const q = await content.getQuote(id)
  if (!q) throw bad('quote not found', 404)
  if (['accepted', 'declined'].includes(q.status)) throw bad(`This quote was already ${q.status}; create a new one instead.`)
  if (!q.items?.length) throw bad('Add at least one line item before sending.')
  const settings = await content.getSettings()
  const fields = await content.listQuoteFields()
  const link = quoteLink(q)
  const pdf = renderQuotePdf(q, settings, fields, link)
  const recipient = to || q.client_email
  const tpl = await renderKey('quote', { quote: q, link, settings, actor })
  const msg = await deliver({
    actor, to: recipient, toName: q.client_name,
    subject: subject || tpl.subject, body: body || tpl.body,
    attachmentIds, extraAttachments: [{ filename: `${q.number}.pdf`, content: pdf }],
    cta: tpl.cta || { label: 'View and respond online', url: link },
    clientId: q.client_id, quoteId: q.id,
  })
  const quote = await content.markQuoteSent(q.id, { to: recipient })
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
 * Notification to the team (quote answered, email received). Best effort:
 * never throws, never blocks the action that triggered it.
 */
export async function notifyTeam(key, ctx) {
  try {
    const settings = ctx.settings || (await content.getSettings())
    const flag = key === 'inbound_notice' ? settings.email.notify_inbound : settings.email.notify_responses
    const to = settings.email.notify_to || settings.email.reply_to
    if (!flag || !EMAIL_RE.test(to)) return null
    const tpl = await renderKey(key, { ...ctx, settings })
    if (!tpl.subject || !tpl.body) return null
    return await deliver({ actor: SYSTEM_ACTOR, to, subject: tpl.subject, body: tpl.body, cta: tpl.cta, clientId: ctx.quote?.client_id ?? ctx.message?.client_id ?? null, quoteId: ctx.quote?.id ?? null })
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
    const message = await deliver({ actor, to: email, toName: name, subject: tpl.subject, body: tpl.body, cta: tpl.cta || { label: 'Set your password', url: link } })
    return { user: data.user, via: 'resend', message }
  } catch (e) {
    // The account exists but the mail did not go out: remove it so the admin can retry cleanly.
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => {})
    throw e
  }
}
