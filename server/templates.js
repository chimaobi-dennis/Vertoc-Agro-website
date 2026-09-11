/*
 * Email templates: plain text with {{placeholders}} and {{#if var}}...{{/if}}
 * blocks, edited in the panel (Settings → Email templates) and rendered
 * here. DEFAULT_TEMPLATES mirrors the migration seed so "Reset to default"
 * and a missing row both behave.
 */
import * as content from './content.js'
import { formatMoney } from './quote-pdf.js'

export const DEFAULT_TEMPLATES = {
  quote: {
    name: 'Quotation to client', description: 'Sent with the PDF and the unique online link when a quote goes out.',
    subject: 'Quotation {{quote_number}} from {{company_name}}',
    body: 'Dear {{client_name}},\n\nThank you for your interest in {{company_name}}. Please find attached our quotation {{quote_number}}{{#if quote_title}} for {{quote_title}}{{/if}}.{{#if valid_until}} It is valid until {{valid_until}}.{{/if}}\n\nYou can review it and accept or decline online using the button below. If you have any questions, simply reply to this email.\n\nKind regards,\n{{sender_name}}',
    cta_label: 'View and respond online',
    variables: ['client_name', 'client_email', 'quote_number', 'quote_title', 'total', 'currency', 'valid_until', 'link', 'company_name', 'sender_name'],
  },
  enquiry_reply: {
    name: 'Reply to a website enquiry', description: 'Pre-filled when you reply to a quote request or contact message from the inbox. Edit before sending.',
    subject: 'Re: your {{enquiry_type}} to {{company_name}}',
    body: 'Dear {{name}},\n\nThank you for your {{enquiry_type}}{{#if commodity}} about {{commodity}}{{/if}}.\n\n\n\nKind regards,\n{{sender_name}}',
    cta_label: '',
    variables: ['name', 'email', 'enquiry_type', 'commodity', 'quantity', 'destination', 'subject', 'message', 'company_name', 'sender_name'],
  },
  blank: {
    name: 'Email to a client', description: 'Pre-filled when you email a client from their record.',
    subject: '', body: 'Dear {{name}},\n\n\n\nKind regards,\n{{sender_name}}', cta_label: '',
    variables: ['name', 'email', 'company_name', 'sender_name'],
  },
  user_invite: {
    name: 'Staff invitation', description: 'Sent to a new team member with their set-password link. Replaces the plain Supabase mail.',
    subject: "You're invited to the {{site_name}} staff panel",
    body: 'Hello {{name}},\n\n{{inviter_name}} has invited you to join the {{site_name}} staff panel as {{role}}. Use the button below to set your password and sign in.\n\nThe link expires in 24 hours. If you were not expecting this, you can ignore this email.',
    cta_label: 'Set your password',
    variables: ['name', 'email', 'role', 'inviter_name', 'site_name', 'link'],
  },
  quote_response: {
    name: 'Quote answered (to the team)', description: 'Sent to your notification address when a client accepts or declines a quote online.',
    subject: '{{client_name}} {{response}} quotation {{quote_number}}',
    body: '{{client_name}} has {{response}} quotation {{quote_number}}{{#if quote_title}} ({{quote_title}}){{/if}} — total {{total}}.{{#if note}}\n\nTheir note:\n{{note}}{{/if}}',
    cta_label: 'Open the quote',
    variables: ['client_name', 'response', 'quote_number', 'quote_title', 'total', 'note', 'link'],
  },
  inbound_notice: {
    name: 'New email received (to the team)', description: 'Sent to your notification address when a client emails you and the message lands in the inbox.',
    subject: 'New email from {{from_name}}: {{subject}}',
    body: '{{from_name}} <{{from}}> wrote:\n\n{{excerpt}}',
    cta_label: 'Open in the inbox',
    variables: ['from', 'from_name', 'subject', 'excerpt', 'link'],
  },
}
export const TEMPLATE_KEYS = Object.keys(DEFAULT_TEMPLATES)

const truthy = v => v != null && v !== '' && v !== false && v !== 0
/** {{#if x}}…{{/if}} blocks, then {{x}} substitutions. Unknown names render empty. */
export function renderTemplate(str, vars = {}) {
  return String(str ?? '')
    .replace(/\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, k, inner) => (truthy(vars[k]) ? inner : ''))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])))
}

/** The stored template merged over its default; the default alone when no row exists. */
export async function templateFor(key) {
  const d = DEFAULT_TEMPLATES[key]
  if (!d) throw Object.assign(new Error(`unknown template "${key}"`), { expose: true, status: 404 })
  let row = null
  try { row = await content.getTemplate(key) } catch { row = null }
  return { key, ...d, ...(row || {}), variables: d.variables, enabled: row ? row.enabled !== false : true }
}

const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
const senderName = (actor, settings) => actor?.name || (settings.email.from.match(/^(.*?)\s*</)?.[1] || '').trim() || settings.company.name

/** Variables for a template from the records it concerns. `link` is the CTA target. */
export async function buildVars(key, ctx = {}) {
  const settings = ctx.settings || (await content.getSettings())
  const base = { company_name: settings.company.name, site_name: settings.site.name, sender_name: senderName(ctx.actor, settings) }
  if (key === 'quote') {
    const q = ctx.quote
    return { ...base, client_name: q.client_name, client_email: q.client_email, quote_number: q.number, quote_title: q.title, total: formatMoney(q.total, q.currency), currency: q.currency, valid_until: fmtDate(q.valid_until), link: ctx.link || '' }
  }
  if (key === 'enquiry_reply') {
    const e = ctx.enquiry
    return { ...base, name: e.name, email: e.email, enquiry_type: e.kind === 'quote' ? 'quote request' : 'message', commodity: e.commodity, quantity: e.quantity, destination: e.destination, subject: e.subject, message: e.message }
  }
  if (key === 'blank') {
    const c = ctx.client
    return { ...base, name: c?.data?.contact_person || c?.name || '', email: c?.data?.email || '' }
  }
  if (key === 'user_invite') return { ...base, name: ctx.name || '', email: ctx.email || '', role: ctx.role || '', inviter_name: ctx.actor?.name || ctx.actor?.email || 'An administrator', link: ctx.link || '' }
  if (key === 'quote_response') {
    const q = ctx.quote
    return { ...base, client_name: q.client_name || q.client_email || 'A client', response: q.status, quote_number: q.number, quote_title: q.title, total: formatMoney(q.total, q.currency), note: q.response_note, link: ctx.link || '' }
  }
  if (key === 'inbound_notice') {
    const m = ctx.message
    return { ...base, from: m.from_email, from_name: m.from_name || m.from_email, subject: m.subject, excerpt: String(m.body || '').trim().slice(0, 600), link: ctx.link || '' }
  }
  return base
}

export const SAMPLE_VARS = {
  quote: { client_name: 'Alessia Loghin', client_email: 'alessia@example.com', quote_number: 'VQ-2026-0007', quote_title: 'Cocoa beans, 20 MT, CIF Rotterdam', total: 'USD 51,600.00', currency: 'USD', valid_until: '24 September 2026', link: 'https://vertocagro.com/q/example' },
  enquiry_reply: { name: 'Alessia Loghin', email: 'alessia@example.com', enquiry_type: 'quote request', commodity: 'Cocoa Beans', quantity: '20 MT', destination: 'Rotterdam', subject: '', message: 'Please quote for 20 MT of cocoa beans.' },
  blank: { name: 'Alessia Loghin', email: 'alessia@example.com' },
  user_invite: { name: 'Tunde', email: 'tunde@example.com', role: 'sales', inviter_name: 'Chimaobi', link: 'https://vertocagro.com/staff360/set-password' },
  quote_response: { client_name: 'Alessia Loghin', response: 'accepted', quote_number: 'VQ-2026-0007', quote_title: 'Cocoa beans, 20 MT', total: 'USD 51,600.00', note: 'Please confirm the shipping date.', link: 'https://vertocagro.com/staff360/quotes/7' },
  inbound_notice: { from: 'alessia@example.com', from_name: 'Alessia Loghin', subject: 'Re: Quotation VQ-2026-0007', excerpt: 'Thank you, we would like to proceed. Can you confirm the loading port?', link: 'https://vertocagro.com/staff360/messages/12' },
}

/** Rendered subject/body/cta for a key in a context. Disabled templates render empty. */
export async function renderKey(key, ctx = {}) {
  const t = await templateFor(key)
  const vars = await buildVars(key, ctx)
  if (!t.enabled) return { subject: '', body: '', cta: null, template: t, vars }
  const cta = t.cta_label && vars.link ? { label: renderTemplate(t.cta_label, vars), url: vars.link } : null
  return { subject: renderTemplate(t.subject, vars), body: renderTemplate(t.body, vars), cta, template: t, vars }
}
