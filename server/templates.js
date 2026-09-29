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
    name: 'Invoice to client', description: 'Sent with the PDF and the unique online link when an invoice goes out.',
    subject: 'Invoice {{quote_number}} from {{company_name}}',
    body: 'Dear {{client_name}},\n\nThank you for your interest in {{company_name}}. Please find attached our invoice {{quote_number}}{{#if quote_title}} for {{quote_title}}{{/if}}.{{#if valid_until}} It is valid until {{valid_until}}.{{/if}}\n\nYou can review it and accept or decline online using the button below. If you have any questions, simply reply to this email.\n\nKind regards,\n{{company_name}}',
    cta_label: 'View and respond online',
    variables: ['client_name', 'client_email', 'quote_number', 'quote_title', 'total', 'currency', 'valid_until', 'link', 'company_name', 'sender_name'],
  },
  enquiry_received: {
    name: 'Quote request received (to the client)', description: 'Sent automatically to whoever submits the Request a Quote form, as soon as it arrives.',
    subject: 'We received your request, {{name}}',
    body: 'Dear {{name}},\n\nThank you for your interest in {{company_name}}. We have received your request{{#if commodity}} for {{commodity}}{{/if}}{{#if quantity}} ({{quantity}}){{/if}}{{#if destination}} to {{destination}}{{/if}} and our team is reviewing it now.\n\nWe usually reply within one business day with a priced offer. If you have anything to add in the meantime, simply reply to this email.\n\nKind regards,\n{{company_name}}',
    cta_label: '',
    variables: ['name', 'email', 'phone', 'commodity', 'quantity', 'destination', 'message', 'company_name', 'site_name'],
  },
  enquiry_notice: {
    name: 'New quote request (to the team)', description: 'Sent to your notification address when the website\'s Request a Quote form is submitted.',
    subject: 'New quote request from {{name}}{{#if commodity}}: {{commodity}}{{/if}}',
    body: '{{name}} <{{email}}>{{#if phone}} · {{phone}}{{/if}} asked for a quote.{{#if commodity}}\n\nCommodity: {{commodity}}{{/if}}{{#if quantity}}\nQuantity: {{quantity}}{{/if}}{{#if destination}}\nDestination: {{destination}}{{/if}}{{#if message}}\n\nMessage:\n{{message}}{{/if}}',
    cta_label: 'Open the request',
    variables: ['name', 'email', 'phone', 'commodity', 'quantity', 'destination', 'message', 'link'],
  },
  review_notice: {
    name: 'New review awaiting approval (to the team)', description: 'Sent to your notification address when a client submits a review on the website.',
    subject: 'New review from {{name}} ({{rating}}/5) awaiting approval',
    body: '{{name}}{{#if role}} ({{role}}){{/if}} left a {{rating}}-star review on the website:\n\n"{{quote}}"\n\nIt is not on the homepage until you approve it.',
    cta_label: 'Review it in the panel',
    variables: ['name', 'role', 'rating', 'quote', 'email', 'link'],
  },
  enquiry_reply: {
    name: 'Reply to a website enquiry', description: 'Pre-filled when you reply to a quote request or contact message from the inbox. Edit before sending.',
    subject: 'Re: your {{enquiry_type}} to {{company_name}}',
    body: 'Dear {{name}},\n\nThank you for your {{enquiry_type}}{{#if commodity}} about {{commodity}}{{/if}}.\n\n\n\nKind regards,',
    cta_label: '',
    variables: ['name', 'email', 'enquiry_type', 'commodity', 'quantity', 'destination', 'subject', 'message', 'company_name', 'staff_name', 'staff_position'],
  },
  blank: {
    name: 'Email to a client', description: 'Pre-filled when you email a client from their record.',
    subject: '', body: 'Dear {{name}},\n\n\n\nKind regards,', cta_label: '',
    variables: ['name', 'email', 'company_name', 'staff_name', 'staff_position'],
  },
  user_invite: {
    name: 'Staff invitation', description: 'Sent to a new team member with their set-password link. Replaces the plain Supabase mail.',
    subject: "You're invited to the {{site_name}} staff panel",
    body: 'Hello {{name}},\n\n{{inviter_name}} has invited you to join the {{site_name}} staff panel as {{role}}. Use the button below to set your password and sign in.\n\nThe link expires in 24 hours. If you were not expecting this, you can ignore this email.',
    cta_label: 'Set your password',
    variables: ['name', 'email', 'role', 'inviter_name', 'site_name', 'link'],
  },
  password_link: {
    name: 'Set-password link (to staff)', description: 'Sent from a user page when an admin sends a team member a fresh link to choose a new password.',
    subject: 'Set a new password for the {{site_name}} staff panel',
    body: 'Hello {{name}},\n\n{{inviter_name}} sent you a link to set a new password for the {{site_name}} staff panel. Use the button below; the link works once and expires after a short while.\n\nIf you were not expecting this, you can ignore this email.',
    cta_label: 'Set your password',
    variables: ['name', 'email', 'role', 'inviter_name', 'site_name', 'link'],
  },
  quote_response: {
    name: 'Invoice answered (to the team)', description: 'Sent to your notification address when a client accepts or declines an invoice online.',
    subject: '{{client_name}} {{response}} invoice {{quote_number}}',
    body: '{{client_name}} has {{response}} invoice {{quote_number}}{{#if quote_title}} ({{quote_title}}){{/if}} — total {{total}}.{{#if note}}\n\nTheir note:\n{{note}}{{/if}}',
    cta_label: 'Open the invoice',
    variables: ['client_name', 'response', 'quote_number', 'quote_title', 'total', 'note', 'link'],
  },
  inbound_notice: {
    name: 'New email received (to the team)', description: 'Sent to your notification address when a client emails you and the message lands in the inbox.',
    subject: 'New email from {{from_name}}: {{subject}}',
    body: '{{from_name}} <{{from}}> wrote:\n\n{{excerpt}}',
    cta_label: 'Open in the inbox',
    variables: ['from', 'from_name', 'subject', 'excerpt', 'link'],
  },
  /* ---- procurement ---- */
  bid_received: {
    name: 'Bid received (to the supplier)', description: 'Procurement. Sent automatically to a supplier as soon as their bid arrives.',
    subject: 'We received your bid for {{tender_title}} ({{tender_number}})',
    body: 'Dear {{contact_person}},\n\nThank you. We have received the bid from {{supplier_name}} for {{tender_title}} ({{tender_number}}).\n\nQuantity: {{quantity}}\nProposed price: {{price}}\nTotal bid value: {{total}}\nExpected delivery: {{delivery_date}}\n\nBids close on {{closes_at}}. We will email you whenever the status of your bid changes.\n\nFrom your supplier dashboard you can follow the bid, add documents and answer our questions. No account yet? Create one with this email address and the bid will be waiting there.\n\nKind regards,\n{{company_name}} Procurement',
    cta_label: 'Open your supplier dashboard',
    variables: ['supplier_name', 'contact_person', 'email', 'tender_number', 'tender_title', 'commodity', 'quantity', 'price', 'total', 'delivery_date', 'closes_at', 'link', 'company_name'],
  },
  bid_notice: {
    name: 'New bid (to the team)', description: 'Procurement. Sent to the procurement notification address when a supplier submits a bid.',
    subject: 'New bid from {{supplier_name}} on {{tender_number}}: {{price}}',
    body: '{{supplier_name}} ({{contact_person}}, {{email}}{{#if phone}}, {{phone}}{{/if}}) bid on {{tender_title}} ({{tender_number}}).\n\nQuantity: {{quantity}}\nPrice: {{price}}{{#if asking_price}} — we asked {{asking_price}}{{#if vs_asking}} ({{vs_asking}}){{/if}}{{/if}}\nTotal bid value: {{total}}\nCommodity location: {{commodity_location}}\nExpected delivery: {{delivery_date}}\nPayment terms: {{terms_answer}}{{#if note}}\n\nTheir note:\n{{note}}{{/if}}',
    cta_label: 'Open the bid',
    variables: ['supplier_name', 'contact_person', 'email', 'phone', 'tender_number', 'tender_title', 'quantity', 'price', 'asking_price', 'vs_asking', 'total', 'commodity_location', 'delivery_date', 'terms_answer', 'note', 'link'],
  },
  bid_status: {
    name: 'Bid status changed (to the supplier)', description: 'Procurement. Sent to the supplier whenever the status of their bid changes: under review, shortlisted, awarded, not selected.',
    subject: 'Your bid for {{tender_title}}: {{status}}',
    body: 'Dear {{contact_person}},\n\nThe status of your bid for {{tender_title}} ({{tender_number}}) is now: {{status}}.\n\n{{status_explained}}{{#if status_note}}\n\nA note from our team:\n{{status_note}}{{/if}}\n\nKind regards,\n{{company_name}} Procurement',
    cta_label: 'View your bid',
    variables: ['supplier_name', 'contact_person', 'tender_number', 'tender_title', 'status', 'status_explained', 'status_note', 'quantity', 'price', 'total', 'link', 'company_name'],
  },
  bid_request: {
    name: 'Request for information (to the supplier)', description: 'Procurement. Sent when the team asks a supplier for more information about their bid.',
    subject: 'More information needed for your bid on {{tender_number}}',
    body: 'Dear {{contact_person}},\n\nTo continue reviewing your bid for {{tender_title}} ({{tender_number}}) we need the following:\n\n{{question}}\n\nPlease answer from your supplier dashboard, where you can also upload documents. No account yet? Create one with this email address ({{email}}) and your bid will be waiting there.\n\nKind regards,\n{{company_name}} Procurement',
    cta_label: 'Answer in your dashboard',
    variables: ['supplier_name', 'contact_person', 'email', 'tender_number', 'tender_title', 'question', 'link', 'company_name'],
  },
  bid_update_notice: {
    name: 'Supplier answered or withdrew (to the team)', description: 'Procurement. Sent to the procurement notification address when a supplier answers a request for information or withdraws a bid.',
    subject: '{{supplier_name}} {{event}} — {{tender_number}}',
    body: '{{supplier_name}} {{event}} on {{tender_title}} ({{tender_number}}).{{#if question}}\n\nWe asked:\n{{question}}{{/if}}{{#if answer}}\n\nTheir answer:\n{{answer}}{{/if}}',
    cta_label: 'Open the bid',
    variables: ['supplier_name', 'event', 'tender_number', 'tender_title', 'question', 'answer', 'link'],
  },
  supplier_verify: {
    name: 'Confirm supplier account', description: 'Procurement. Sent to a supplier who registers, to confirm their email address.',
    subject: 'Confirm your {{site_name}} supplier account',
    body: 'Dear {{contact_person}},\n\nThank you for registering {{supplier_name}} as a supplier to {{company_name}}. Please confirm your email address with the button below to activate your account.\n\nThe link works once and expires in 24 hours. If you did not register, you can ignore this email.',
    cta_label: 'Confirm my email address',
    variables: ['supplier_name', 'contact_person', 'email', 'link', 'company_name', 'site_name'],
  },
  supplier_reset: {
    name: 'Supplier password reset', description: 'Procurement. Sent when a supplier asks to reset their password.',
    subject: 'Choose a new password for your {{site_name}} supplier account',
    body: 'Dear {{contact_person}},\n\nUse the button below to choose a new password for your supplier account. The link works once and expires in 2 hours.\n\nIf you did not ask for this, you can ignore this email; your password stays as it is.',
    cta_label: 'Choose a new password',
    variables: ['supplier_name', 'contact_person', 'email', 'link', 'company_name', 'site_name'],
  },
  purchase_order: {
    name: 'Purchase order to supplier', description: 'Procurement. Sent with the PDF and the supplier\'s online link when a PO or LPO is issued.',
    subject: '{{po_kind}} {{po_number}} from {{company_name}}',
    body: 'Dear {{supplier_name}},\n\nPlease find attached our {{po_kind}} {{po_number}}{{#if po_title}} for {{po_title}}{{/if}}, total {{total}}.{{#if delivery_date}} Delivery is required by {{delivery_date}}{{#if delivery_location}} at {{delivery_location}}{{/if}}.{{/if}}\n\nPlease review it and acknowledge the order online using the button below.\n\nKind regards,\n{{company_name}} Procurement',
    cta_label: 'View and acknowledge online',
    variables: ['supplier_name', 'supplier_email', 'po_kind', 'po_number', 'po_title', 'total', 'currency', 'delivery_date', 'delivery_location', 'payment_terms', 'link', 'company_name'],
  },
  po_response: {
    name: 'Purchase order answered (to the team)', description: 'Procurement. Sent to the procurement notification address when a supplier acknowledges or declines an order online.',
    subject: '{{supplier_name}} {{response}} {{po_number}}',
    body: '{{supplier_name}} has {{response}} {{po_kind}} {{po_number}}{{#if po_title}} ({{po_title}}){{/if}} — total {{total}}.{{#if note}}\n\nTheir note:\n{{note}}{{/if}}',
    cta_label: 'Open the order',
    variables: ['supplier_name', 'response', 'po_kind', 'po_number', 'po_title', 'total', 'note', 'link'],
  },
  supplier_blank: {
    name: 'Email to a supplier', description: 'Procurement. Pre-filled when you email a supplier from their record or a bid.',
    subject: '', body: 'Dear {{name}},\n\n\n\nKind regards,', cta_label: '',
    variables: ['name', 'email', 'supplier_name', 'tender_number', 'tender_title', 'company_name', 'staff_name', 'staff_position'],
  },
}
export const TEMPLATE_KEYS = Object.keys(DEFAULT_TEMPLATES)
/** Templates the procurement team may pre-fill a composer from. */
export const PROCUREMENT_TEMPLATES = ['supplier_blank', 'purchase_order', 'bid_status', 'bid_request']

// What a bid status is called, and the sentence that explains it to the supplier.
const BID_STATUS_LABELS = { open: 'Open', under_review: 'Under review', shortlisted: 'Shortlisted', awarded: 'Awarded', not_selected: 'Not selected', withdrawn: 'Withdrawn' }
const BID_STATUS_TEXT = {
  open: 'Your bid has been received and is waiting for review.',
  under_review: 'Our procurement team is now reviewing your bid.',
  shortlisted: 'Your bid is on our shortlist. We may contact you for more information before a decision is made.',
  awarded: 'Congratulations — your bid has been selected. Our purchase order will follow.',
  not_selected: 'Thank you for taking part. Your bid was not selected this time, and we hope you will bid on our future opportunities.',
  withdrawn: 'Your bid has been withdrawn.',
}
const quantity = n => { const v = Number(n) || 0; return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(v) }
const SAMPLE_BID = { supplier_name: 'Kano Grains Ltd', contact_person: 'Musa Abdullahi', email: 'musa@example.com', phone: '+234 803 000 0000', tender_number: 'VB-2026-0004', tender_title: 'Soybeans supply opportunity', commodity: 'Soybeans', quantity: '500 MT', price: 'NGN 640,000.00 per MT', asking_price: 'NGN 650,000.00 per MT', vs_asking: 'NGN 10,000.00 below our asking price', total: 'NGN 320,000,000.00', commodity_location: 'Kano', delivery_date: '15 November 2026', closes_at: '20 October 2026', terms_answer: 'accepts the stated terms', note: '', status: 'Open', status_explained: '', status_note: '' }

const truthy = v => v != null && v !== '' && v !== false && v !== 0
/** {{#if x}}…{{/if}} blocks (they may be nested), then {{x}} substitutions. Unknown names render empty. */
const INNERMOST_IF = /\{\{#if\s+([\w.]+)\s*\}\}((?:(?!\{\{#if\s)[\s\S])*?)\{\{\/if\}\}/g
export function renderTemplate(str, vars = {}) {
  let out = String(str ?? '')
  // Innermost blocks first, until none is left, so a block inside a block resolves correctly.
  for (let i = 0; i < 20 && /\{\{#if\s/.test(out); i++) {
    const next = out.replace(INNERMOST_IF, (_, k, inner) => (truthy(vars[k]) ? inner : ''))
    if (next === out) break
    out = next
  }
  return out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])))
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
// Templates sign as the company; the person writing is `staff_name` / `staff_position` (added
// automatically under emails started from the message wizard, so templates need not include it).
const senderName = (_actor, settings) => settings.company.name || (settings.email.from.match(/^(.*?)\s*</)?.[1] || '').trim()

/** Variables for a template from the records it concerns. `link` is the CTA target. */
export async function buildVars(key, ctx = {}) {
  const settings = ctx.settings || (await content.getSettings())
  const base = { company_name: settings.company.name, site_name: settings.site.name, sender_name: senderName(ctx.actor, settings), staff_name: ctx.actor?.name || '', staff_position: ctx.actor?.position || '' }
  if (key === 'quote') {
    const q = ctx.quote
    return { ...base, client_name: q.client_name, client_email: q.client_email, quote_number: q.number, quote_title: q.title, total: formatMoney(q.total, q.currency), currency: q.currency, valid_until: fmtDate(q.valid_until), link: ctx.link || '' }
  }
  if (key === 'enquiry_reply' || key === 'enquiry_received' || key === 'enquiry_notice') {
    const e = ctx.enquiry
    return { ...base, name: e.name, email: e.email, phone: e.phone || '', enquiry_type: e.kind === 'quote' ? 'quote request' : 'message', commodity: e.commodity, quantity: e.quantity, destination: e.destination, subject: e.subject, message: e.message, link: ctx.link || '' }
  }
  if (key === 'blank') {
    const c = ctx.client
    return { ...base, name: c?.data?.contact_person || c?.name || '', email: c?.data?.email || '' }
  }
  if (key === 'review_notice') { const r = ctx.review || {}; return { ...base, name: r.name, role: r.role || '', rating: String(r.rating ?? 5), quote: r.quote, email: r.email || '', link: ctx.link || '' } }
  if (key === 'user_invite' || key === 'password_link') return { ...base, name: ctx.name || '', email: ctx.email || '', role: ctx.role || '', inviter_name: ctx.actor?.name || ctx.actor?.email || 'An administrator', link: ctx.link || '' }
  if (key === 'quote_response') {
    const q = ctx.quote
    return { ...base, client_name: q.client_name || q.client_email || 'A client', response: q.status, quote_number: q.number, quote_title: q.title, total: formatMoney(q.total, q.currency), note: q.response_note, link: ctx.link || '' }
  }
  if (key === 'inbound_notice') {
    const m = ctx.message
    return { ...base, from: m.from_email, from_name: m.from_name || m.from_email, subject: m.subject, excerpt: String(m.body || '').trim().slice(0, 600), link: ctx.link || '' }
  }
  if (['bid_received', 'bid_notice', 'bid_status', 'bid_request', 'bid_update_notice'].includes(key)) {
    const b = ctx.bid || {}, t = ctx.tender || {}
    const unit = b.unit || t.unit || 'MT', cur = b.currency || t.currency || 'NGN'
    const asking = t.asking_price == null ? null : Number(t.asking_price)
    const diff = asking == null ? null : Math.round((Number(b.price) - asking) * 100) / 100
    return {
      ...base, supplier_name: b.company_name, contact_person: b.contact_person || b.company_name, email: b.email, phone: b.phone || '',
      tender_number: t.number, tender_title: t.title, commodity: b.commodity || t.commodity, closes_at: fmtDate(t.closes_at),
      quantity: `${quantity(b.quantity)} ${unit}`, price: `${formatMoney(b.price, cur)} per ${unit}`, total: formatMoney(b.total, cur),
      asking_price: asking == null ? '' : `${formatMoney(asking, cur)} per ${unit}`,
      vs_asking: diff == null || diff === 0 ? (diff === 0 ? 'the same as our asking price' : '') : `${formatMoney(Math.abs(diff), cur)} ${diff < 0 ? 'below' : 'above'} our asking price`,
      commodity_location: b.commodity_location, delivery_date: fmtDate(b.delivery_date), note: b.note || '',
      terms_answer: b.accepts_terms ? 'accepts the stated terms' : `does NOT accept the stated terms${b.terms_note ? ` — proposes: ${b.terms_note}` : ''}`,
      status: BID_STATUS_LABELS[b.status] || b.status, status_explained: BID_STATUS_TEXT[b.status] || '', status_note: b.status_note || '',
      question: ctx.request?.question || '', answer: ctx.request?.answer || '', event: ctx.event || '', link: ctx.link || '',
    }
  }
  if (key === 'supplier_verify' || key === 'supplier_reset') {
    const s = ctx.supplier || {}
    return { ...base, supplier_name: s.company_name, contact_person: s.contact_person || s.company_name, email: s.email, link: ctx.link || '' }
  }
  if (key === 'purchase_order' || key === 'po_response') {
    const o = ctx.order || {}
    return {
      ...base, supplier_name: o.supplier_name || o.supplier_email || 'The supplier', supplier_email: o.supplier_email, po_kind: o.kind === 'po' ? 'Purchase Order' : 'Local Purchase Order', po_number: o.number, po_title: o.title,
      total: formatMoney(o.total, o.currency), currency: o.currency, delivery_date: o.delivery_date ? fmtDate(o.delivery_date) : '', delivery_location: o.delivery_location, payment_terms: o.payment_terms,
      response: o.status === 'acknowledged' ? 'acknowledged' : o.status, note: o.response_note, link: ctx.link || '',
    }
  }
  if (key === 'supplier_blank') {
    const s = ctx.supplier || {}, b = ctx.bid || {}, t = ctx.tender || {}
    return { ...base, name: s.contact_person || b.contact_person || s.company_name || b.company_name || '', email: s.email || b.email || '', supplier_name: s.company_name || b.company_name || '', tender_number: t.number || '', tender_title: t.title || '' }
  }
  return base
}

export const SAMPLE_VARS = {
  quote: { client_name: 'Alessia Loghin', client_email: 'alessia@example.com', quote_number: 'VA-2026-0007', quote_title: 'Cocoa beans, 20 MT, CIF Rotterdam', total: 'USD 51,600.00', currency: 'USD', valid_until: '24 September 2026', link: 'https://vertocagro.com/q/example' },
  enquiry_reply: { name: 'Alessia Loghin', email: 'alessia@example.com', enquiry_type: 'quote request', commodity: 'Cocoa Beans', quantity: '20 MT', destination: 'Rotterdam', subject: '', message: 'Please quote for 20 MT of cocoa beans.' },
  review_notice: { name: 'Alessia Loghin', role: 'Buyer, Loghin Foods', rating: '5', quote: 'Reliable supplier, on-time shipments every time.', email: 'alessia@example.com', link: 'https://vertocagro.com/staff360/reviews' },
  enquiry_received: { name: 'Alessia Loghin', email: 'alessia@example.com', phone: '+39 02 1234 5678', commodity: 'Cocoa Beans', quantity: '20 MT', destination: 'Rotterdam', message: 'Please quote for 20 MT of cocoa beans.' },
  enquiry_notice: { name: 'Alessia Loghin', email: 'alessia@example.com', phone: '+39 02 1234 5678', commodity: 'Cocoa Beans', quantity: '20 MT', destination: 'Rotterdam', message: 'Please quote for 20 MT of cocoa beans.', link: 'https://vertocagro.com/staff360/enquiries/12' },
  blank: { name: 'Alessia Loghin', email: 'alessia@example.com' },
  user_invite: { name: 'Tunde', email: 'tunde@example.com', role: 'sales', inviter_name: 'Chimaobi', link: 'https://vertocagro.com/staff360/set-password' },
  password_link: { name: 'Tunde', email: 'tunde@example.com', role: 'sales', inviter_name: 'Chimaobi', link: 'https://vertocagro.com/staff360/set-password' },
  quote_response: { client_name: 'Alessia Loghin', response: 'accepted', quote_number: 'VA-2026-0007', quote_title: 'Cocoa beans, 20 MT', total: 'USD 51,600.00', note: 'Please confirm the shipping date.', link: 'https://vertocagro.com/staff360/quotes/7' },
  inbound_notice: { from: 'alessia@example.com', from_name: 'Alessia Loghin', subject: 'Re: Invoice VA-2026-0007', excerpt: 'Thank you, we would like to proceed. Can you confirm the loading port?', link: 'https://vertocagro.com/staff360/messages/12' },
  bid_received: { ...SAMPLE_BID, link: 'https://vertocagro.com/supplier/bids/14' },
  bid_notice: { ...SAMPLE_BID, link: 'https://vertocagro.com/staff360/bids/14' },
  bid_status: { ...SAMPLE_BID, status: 'Shortlisted', status_explained: BID_STATUS_TEXT.shortlisted, status_note: 'Please keep the stock available until 20 October.', link: 'https://vertocagro.com/supplier/bids/14' },
  bid_request: { ...SAMPLE_BID, question: 'Please upload the latest moisture analysis for this lot and confirm the bag size.', link: 'https://vertocagro.com/supplier/bids/14' },
  bid_update_notice: { ...SAMPLE_BID, event: 'answered a request for information', question: 'Please confirm the bag size.', answer: '100 kg jute bags, new.', link: 'https://vertocagro.com/staff360/bids/14' },
  supplier_verify: { supplier_name: 'Kano Grains Ltd', contact_person: 'Musa Abdullahi', email: 'musa@example.com', link: 'https://vertocagro.com/supplier/verify?token=example' },
  supplier_reset: { supplier_name: 'Kano Grains Ltd', contact_person: 'Musa Abdullahi', email: 'musa@example.com', link: 'https://vertocagro.com/supplier/reset?token=example' },
  purchase_order: { supplier_name: 'Kano Grains Ltd', supplier_email: 'musa@example.com', po_kind: 'Local Purchase Order', po_number: 'LPO-2026-0003', po_title: 'Soybeans supply — VB-2026-0004', total: 'NGN 325,000,000.00', currency: 'NGN', delivery_date: '15 November 2026', delivery_location: 'Ibadan, Oyo State', payment_terms: 'Payment on delivery, after quality and quantity confirmation.', link: 'https://vertocagro.com/po/example' },
  po_response: { supplier_name: 'Kano Grains Ltd', response: 'acknowledged', po_kind: 'Local Purchase Order', po_number: 'LPO-2026-0003', po_title: 'Soybeans supply — VB-2026-0004', total: 'NGN 325,000,000.00', note: 'Loading starts Monday.', link: 'https://vertocagro.com/staff360/purchase-orders/3' },
  supplier_blank: { name: 'Musa Abdullahi', email: 'musa@example.com', supplier_name: 'Kano Grains Ltd', tender_number: 'VB-2026-0004', tender_title: 'Soybeans supply opportunity' },
}

/** Rendered subject/body/cta for a key in a context. Disabled templates render empty. */
export async function renderKey(key, ctx = {}) {
  const t = await templateFor(key)
  const vars = await buildVars(key, ctx)
  if (!t.enabled) return { subject: '', body: '', cta: null, template: t, vars }
  const cta = t.cta_label && vars.link ? { label: renderTemplate(t.cta_label, vars), url: vars.link } : null
  return { subject: renderTemplate(t.subject, vars), body: renderTemplate(t.body, vars), cta, template: t, vars }
}
