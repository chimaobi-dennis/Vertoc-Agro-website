/*
 * Inbound email from Resend.
 *
 * Resend receives mail for the domain (MX record), POSTs an `email.received`
 * event to /api/webhooks/resend, and we fetch the body and attachments from
 * its API — the webhook itself carries only metadata. Each received email
 * becomes a `messages` row with direction 'in', matched to a client by
 * sender address and to a quote or an earlier conversation where possible.
 * Attachments are copied into the private `documents` bucket.
 *
 * Signatures follow the Svix scheme Resend uses: HMAC-SHA256 over
 * "<svix-id>.<svix-timestamp>.<raw body>" with the base64 secret after
 * the `whsec_` prefix, compared in constant time against every `v1,…`
 * entry in svix-signature; timestamps older than 5 minutes are refused.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import * as content from './content.js'
import { audit } from './audit.js'

const API = 'https://api.resend.com'

export function verifySvix(rawBody, headers, secret) {
  const id = headers['svix-id'], ts = headers['svix-timestamp'], sigs = headers['svix-signature']
  if (!id || !ts || !sigs || !secret) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest()
  return String(sigs).split(' ').some(part => {
    const [v, sig] = part.split(',')
    if (v !== 'v1' || !sig) return false
    const given = Buffer.from(sig, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

const parseAddress = s => {
  const m = String(s || '').match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/)
  return m ? { name: (m[1] || '').trim(), email: m[2].trim().toLowerCase() } : { name: '', email: String(s || '').trim().toLowerCase() }
}
const htmlToText = html => String(html || '')
  .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\n{3,}/g, '\n\n').trim()

async function resendGet(path, apiKey) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Resend ${path}: ${d.message || r.status}`)
  return d
}

/**
 * @param {object} data      the webhook's `data` object
 * @param {object} o
 * @param {string|null} o.apiKey
 * @param {boolean} [o.dryRun]  tests: take text/html from the payload, skip Resend
 * @returns {Promise<{message: object, created: boolean}>}
 */
export async function ingestReceived(data, { apiKey, dryRun = false }) {
  const emailId = String(data?.email_id || '')
  if (!emailId) throw new Error('email_id missing')
  const existing = await content.getMessageByProviderId(emailId, 'in')
  if (existing) return { message: existing, created: false }

  let full, attachmentList = []
  if (dryRun && (data.text !== undefined || data.html !== undefined)) {
    full = { ...data, text: data.text ?? '', html: data.html ?? '', headers: data.headers || {}, to: data.to || [] }
  } else {
    if (!apiKey) throw new Error('no Resend API key to fetch the received email')
    full = await resendGet(`/emails/receiving/${emailId}`, apiKey)
    if (data.attachments?.length) attachmentList = (await resendGet(`/emails/receiving/${emailId}/attachments`, apiKey).catch(() => ({ data: [] }))).data || []
  }

  const from = parseAddress(full.from)
  const headers = full.headers || {}
  const subject = String(full.subject || '(no subject)').slice(0, 300)
  const body = (full.text && String(full.text).trim()) || htmlToText(full.html)

  // Who is this from, and what is it about?
  const client = await content.findClientByEmail(from.email)
  let quote_id = null, enquiry_id = null, client_id = client?.id ?? null
  const num = subject.match(/VQ-\d{4}-\d{4}/)?.[0]
  if (num) { const q = await content.getQuoteByNumber(num); if (q) { quote_id = q.id; client_id ??= q.client_id } }
  const inReplyTo = headers['in-reply-to'] || headers['In-Reply-To'] || null
  const prior = await content.latestOutboundTo(from.email)
  if (prior) { quote_id ??= prior.quote_id; enquiry_id ??= prior.enquiry_id; client_id ??= prior.client_id }

  // Attachments → private documents bucket.
  const attachments = []
  for (const a of attachmentList.slice(0, 20)) {
    try {
      if (!a.download_url) continue
      const r = await fetch(a.download_url); if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      const doc = await content.createDocumentFromBuffer({ client_id, name: a.filename || 'attachment', content_type: a.content_type, content: buf, folder: `inbound/${emailId}` })
      attachments.push({ document_id: doc.id, name: doc.name })
    } catch (e) { console.error('[inbound] attachment skipped:', e.message) }
  }

  const message = await content.createMessage({
    client_id, quote_id, enquiry_id, direction: 'in', status: 'received',
    to_email: String((full.to || [])[0] || (data.to || [])[0] || '').slice(0, 200), from_email: from.email.slice(0, 200), from_name: from.name.slice(0, 200),
    subject, body: body.slice(0, 50000), html: String(full.html || '').slice(0, 200000),
    headers: { 'message-id': full.message_id || data.message_id || null, 'in-reply-to': inReplyTo, references: headers.references || null, date: headers.date || null },
    provider_id: emailId, provider_message_id: full.message_id || data.message_id || null, in_reply_to: inReplyTo,
    attachments, sent_by: null,
  })
  await audit({ actor: { id: null, label: 'inbound' }, action: 'receive', entity: 'message', entityId: message.id, after: { from: from.email, subject, client_id, quote_id, attachments: attachments.length } })
  return { message, created: true }
}
