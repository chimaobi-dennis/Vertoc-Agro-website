/*
 * MCP server for Vertoc Agro content.
 *
 * Exposes the content core as tools so products and blog posts can be managed
 * by chatting with Claude. The same server definition is used by both
 * transports: stdio (Claude Desktop, local) and Streamable HTTP (claude.ai
 * custom connector, remote) — see mcp-stdio.js and index.js.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import * as content from './content.js'
import { audit, MCP_ACTOR } from './audit.js'
import { deliver, sendQuote, quoteLink } from './messaging.js'
import { TEMPLATE_KEYS, templateFor } from './templates.js'

const ok = data => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })
const fail = err => ({
  content: [{ type: 'text', text: `Error: ${err.message}` }],
  isError: true,
})
const run = fn => async (args) => { try { return ok(await fn(args)) } catch (e) { return fail(e) } }

const productShape = {
  name: z.string().describe('Display name, e.g. "Hibiscus Flowers"'),
  slug: z.string().optional().describe('URL slug; derived from the name when omitted'),
  category: z.string().optional().describe('Category label shown on the card, e.g. "Agro"'),
  summary: z.string().optional().describe('Short blurb shown on the products listing card'),
  description: z.string().optional().describe('Full description shown on the product page'),
  image: z.string().optional().describe('Image path or URL, e.g. /assets/img/hibiscus.jpg'),
  origin: z.string().optional(),
  processing: z.string().optional(),
  packaging: z.string().optional(),
  moq: z.string().optional().describe('Minimum order quantity, e.g. "10 Metric Tonnes"'),
  grade: z.string().optional().describe('Grade / specification summary'),
  hs_code: z.string().optional().describe('Customs HS code'),
  applications: z.array(z.string()).optional().describe('Use cases, e.g. ["Bakery", "Animal Feed"]'),
  certifications: z.array(z.string()).optional().describe('e.g. ["NAFDAC", "SGS", "Halal"]'),
  specs: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  featured: z.boolean().optional().describe('Show in the featured commodities section'),
  status: z.enum(['published', 'draft']).optional(),
  sort_order: z.number().optional(),
}

const postShape = {
  title: z.string().describe('Post title'),
  slug: z.string().optional().describe('URL slug; derived from the title when omitted'),
  excerpt: z.string().optional().describe('Short summary shown on the blog listing'),
  body: z.string().optional().describe('Full post body (markdown supported)'),
  category: z.string().optional().describe('e.g. "Market Insights"'),
  image: z.string().optional(),
  author: z.string().optional(),
  read_time: z.string().optional().describe('e.g. "6 min read"'),
  status: z.enum(['published', 'draft']).optional(),
  published_at: z.string().optional().describe('YYYY-MM-DD'),
}

export function buildServer() {
  const server = new McpServer({ name: 'vertoc-agro-content', version: '1.3.0' })

  /* ------------------------------------------------------------ products */

  server.registerTool('list_products', {
    title: 'List products',
    description: 'List commodity products on the Vertoc Agro site.',
    inputSchema: {
      status: z.enum(['published', 'draft', 'all']).optional(),
      limit: z.number().optional(),
    },
  }, run(a => content.listProducts(a)))

  server.registerTool('get_product', {
    title: 'Get a product',
    description: 'Fetch one product by slug or id, with all of its detail fields.',
    inputSchema: { slug: z.string().describe('Product slug or numeric id') },
  }, run(async a => {
    const p = await content.getProduct(a.slug, { status: 'all' })
    if (!p) throw new Error(`no product found for "${a.slug}"`)
    return p
  }))

  server.registerTool('create_product', {
    title: 'Create a product',
    description: 'Add a new commodity product. Only name is required.',
    inputSchema: productShape,
  }, run(async a => { const after = await content.createProduct(a); await audit({ actor: MCP_ACTOR, action: 'create', entity: 'product', entityId: after.slug, after }); return after }))

  server.registerTool('update_product', {
    title: 'Update a product',
    description: 'Change fields on an existing product. Only pass what should change.',
    inputSchema: { slug: z.string().describe('Slug or id of the product to update'), ...Object.fromEntries(Object.entries(productShape).map(([k, v]) => [k, v.optional()])) },
  }, run(async ({ slug, ...patch }) => { const before = await content.getProduct(slug, { status: 'all' }); const after = await content.updateProduct(slug, patch); await audit({ actor: MCP_ACTOR, action: 'update', entity: 'product', entityId: after.slug, before, after }); return after }))

  server.registerTool('delete_product', {
    title: 'Delete a product',
    description: 'Permanently remove a product from the site.',
    inputSchema: { slug: z.string().describe('Slug or id of the product to delete') },
  }, run(async a => { const before = await content.getProduct(a.slug, { status: 'all' }); const r = await content.deleteProduct(a.slug); await audit({ actor: MCP_ACTOR, action: 'delete', entity: 'product', entityId: r.slug, before }); return r }))

  /* --------------------------------------------------------------- blog */

  server.registerTool('list_posts', {
    title: 'List blog posts',
    description: 'List blog posts on the Vertoc Agro site.',
    inputSchema: {
      status: z.enum(['published', 'draft', 'all']).optional(),
      limit: z.number().optional(),
    },
  }, run(a => content.listPosts(a)))

  server.registerTool('get_post', {
    title: 'Get a blog post',
    description: 'Fetch one blog post by slug or id, including its full body.',
    inputSchema: { slug: z.string().describe('Post slug or numeric id') },
  }, run(async a => {
    const p = await content.getPost(a.slug, { status: 'all' })
    if (!p) throw new Error(`no post found for "${a.slug}"`)
    return p
  }))

  server.registerTool('create_post', {
    title: 'Create a blog post',
    description: 'Publish a new blog post. Only title is required.',
    inputSchema: postShape,
  }, run(async a => { const after = await content.createPost(a); await audit({ actor: MCP_ACTOR, action: 'create', entity: 'post', entityId: after.slug, after }); return after }))

  server.registerTool('update_post', {
    title: 'Update a blog post',
    description: 'Change fields on an existing post. Only pass what should change.',
    inputSchema: { slug: z.string().describe('Slug or id of the post to update'), ...Object.fromEntries(Object.entries(postShape).map(([k, v]) => [k, v.optional()])) },
  }, run(async ({ slug, ...patch }) => { const before = await content.getPost(slug, { status: 'all' }); const after = await content.updatePost(slug, patch); await audit({ actor: MCP_ACTOR, action: 'update', entity: 'post', entityId: after.slug, before, after }); return after }))

  server.registerTool('delete_post', {
    title: 'Delete a blog post',
    description: 'Permanently remove a blog post from the site.',
    inputSchema: { slug: z.string().describe('Slug or id of the post to delete') },
  }, run(async a => { const before = await content.getPost(a.slug, { status: 'all' }); const r = await content.deletePost(a.slug); await audit({ actor: MCP_ACTOR, action: 'delete', entity: 'post', entityId: r.slug, before }); return r }))

  /* ---------------------------------------------------------- enquiries */

  server.registerTool('list_enquiries', {
    title: 'List enquiries',
    description: 'List contact and quote-request submissions from the website.',
    inputSchema: {
      status: z.enum(['new', 'read', 'archived', 'all']).optional(),
      kind: z.enum(['contact', 'quote', 'all']).optional(),
      limit: z.number().optional(),
    },
  }, run(a => content.listEnquiries(a)))

  server.registerTool('get_enquiry', {
    title: 'Get an enquiry',
    description: 'Fetch one enquiry by its numeric id.',
    inputSchema: { id: z.number().describe('Enquiry id') },
  }, run(async a => {
    const e = await content.getEnquiry(a.id)
    if (!e) throw new Error(`no enquiry found with id ${a.id}`)
    return e
  }))

  server.registerTool('update_enquiry_status', {
    title: 'Update enquiry status',
    description: 'Mark an enquiry as new, read, or archived.',
    inputSchema: {
      id: z.number().describe('Enquiry id'),
      status: z.string().describe('quote: new|contacted|quoted|won|lost|archived. contact: new|replied|archived'),
    },
  }, run(async a => { const before = await content.getEnquiry(a.id); const after = await content.updateEnquiryStatus(a.id, a.status); await audit({ actor: MCP_ACTOR, action: 'update', entity: 'enquiry', entityId: a.id, before, after }); return after }))

  /* ------------------------------------------------------- clients (CRM) */

  server.registerTool('list_client_fields', {
    title: 'List client fields',
    description: 'The user-defined fields tracked for each client: key, label, type, options, required.',
    inputSchema: {},
  }, run(() => content.listClientFields()))

  server.registerTool('list_clients', {
    title: 'List clients',
    inputSchema: { status: z.enum(['active', 'archived', 'all']).optional() },
  }, run(a => content.listClients(a)))

  server.registerTool('get_client', {
    title: 'Get a client',
    description: 'One client with all field values and their linked enquiries.',
    inputSchema: { id: z.number() },
  }, run(async a => {
    const c = await content.getClient(a.id)
    if (!c) throw new Error(`no client with id ${a.id}`)
    return { ...c, enquiries: await content.listClientEnquiries(c.id) }
  }))

  server.registerTool('create_client', {
    title: 'Create a client',
    description: 'Add a client. `data` holds values keyed by the client field keys from list_client_fields.',
    inputSchema: {
      name: z.string().describe('Company or person name'),
      data: z.record(z.any()).optional().describe('e.g. { "email": "...", "country": "Nigeria" }'),
      status: z.enum(['active', 'archived']).optional(),
    },
  }, run(async a => {
    const after = await content.createClient(a)
    await audit({ actor: MCP_ACTOR, action: 'create', entity: 'client', entityId: after.id, after })
    return after
  }))

  server.registerTool('update_client', {
    title: 'Update a client',
    inputSchema: {
      id: z.number(),
      name: z.string().optional(),
      data: z.record(z.any()).optional().describe('Merged into existing values'),
      status: z.enum(['active', 'archived']).optional(),
    },
  }, run(async ({ id, ...patch }) => {
    const before = await content.getClient(id)
    const after = await content.updateClient(id, patch)
    await audit({ actor: MCP_ACTOR, action: 'update', entity: 'client', entityId: id, before, after })
    return after
  }))

  server.registerTool('update_enquiry', {
    title: 'Update an enquiry',
    description: 'Move a quote request or message through the pipeline, link it to a client, or add internal notes.',
    inputSchema: {
      id: z.number(),
      status: z.string().optional().describe('quote: new|contacted|quoted|won|lost|archived. contact: new|replied|archived'),
      client_id: z.number().nullable().optional(),
      notes: z.string().optional(),
    },
  }, run(async ({ id, ...patch }) => {
    const before = await content.getEnquiry(id)
    const after = await content.updateEnquiry(id, patch)
    await audit({ actor: MCP_ACTOR, action: 'update', entity: 'enquiry', entityId: id, before, after })
    return after
  }))

  /* ------------------------------------------------- documents (files) */

  server.registerTool('list_documents', {
    title: 'List documents',
    description: 'Files uploaded for a client or quote (PDF, images, Word, Excel...).',
    inputSchema: { client_id: z.number().optional(), quote_id: z.number().optional() },
  }, run(a => content.listDocuments(a)))

  server.registerTool('get_document_link', {
    title: 'Get a document link',
    description: 'A signed download link for one document, valid for one hour.',
    inputSchema: { id: z.number() },
  }, run(async a => { const { url, expires_in, document } = await content.documentUrl(a.id, { download: true }); return { url, expires_in, name: document.name } }))

  /* -------------------------------------------------- quotes (outbound) */

  const itemShape = z.object({
    description: z.string(), quantity: z.number().optional().describe('default 1'),
    unit: z.string().optional().describe('e.g. MT, kg, bag'), unit_price: z.number(),
  })
  const quoteShape = {
    client_id: z.number().optional().describe('Link to a client; name/email are copied from it'),
    client_name: z.string().optional(), client_email: z.string().optional(),
    title: z.string().optional().describe('e.g. "Cocoa beans, 20 MT CIF Rotterdam"'),
    currency: z.string().optional().describe('ISO code; defaults to Settings → Quotes'),
    items: z.array(itemShape).optional(),
    discount: z.number().optional().describe('Absolute amount'),
    tax_rate: z.number().optional().describe('Percent'),
    notes: z.string().optional().describe('Shown to the client'),
    terms: z.string().optional().describe('Shown to the client'),
    internal_notes: z.string().optional(),
    data: z.record(z.any()).optional().describe('Values keyed by quote field keys from list_quote_fields'),
    valid_until: z.string().optional().describe('YYYY-MM-DD'),
  }

  server.registerTool('list_quote_fields', {
    title: 'List quote fields',
    description: 'The user-defined fields tracked on each quote (Incoterm, port of loading...).',
    inputSchema: {},
  }, run(() => content.listQuoteFields()))

  server.registerTool('list_quotes', {
    title: 'List quotes',
    description: 'Outbound quotations. status "open" = sent or viewed but not yet answered.',
    inputSchema: { status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'open', 'all']).optional(), client_id: z.number().optional() },
  }, run(a => content.listQuotes(a)))

  server.registerTool('get_quote', {
    title: 'Get a quote',
    description: 'One quote with its line items, totals, public link and the emails sent for it.',
    inputSchema: { id: z.number() },
  }, run(async a => {
    const q = await content.getQuote(a.id)
    if (!q) throw new Error(`no quote with id ${a.id}`)
    return { ...q, link: quoteLink(q), messages: await content.listMessages({ quote_id: q.id }) }
  }))

  server.registerTool('create_quote', {
    title: 'Create a quote',
    description: 'Draft a priced quotation. Totals are computed server-side. Use send_quote to email it.',
    inputSchema: quoteShape,
  }, run(async a => {
    const after = await content.createQuote(a)
    await audit({ actor: MCP_ACTOR, action: 'create', entity: 'quote', entityId: after.id, after })
    return { ...after, link: quoteLink(after) }
  }))

  server.registerTool('update_quote', {
    title: 'Update a quote',
    description: 'Change a quote. Prices are locked once the client has accepted. status may be set manually (e.g. accepted after a phone call).',
    inputSchema: { id: z.number(), ...quoteShape, status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired']).optional(), response_note: z.string().optional() },
  }, run(async ({ id, ...patch }) => {
    const before = await content.getQuote(id)
    const after = await content.updateQuote(id, patch)
    await audit({ actor: MCP_ACTOR, action: 'update', entity: 'quote', entityId: id, before, after })
    return { ...after, link: quoteLink(after) }
  }))

  server.registerTool('send_quote', {
    title: 'Send a quote by email',
    description: 'Emails the quote as a PDF with its unique online link, logs the message, and marks the quote sent. Defaults to the client email on the quote.',
    inputSchema: { id: z.number(), to: z.string().optional(), subject: z.string().optional(), body: z.string().optional().describe('Plain text; a default covering letter is used when omitted') },
  }, run(async ({ id, ...o }) => {
    const r = await sendQuote(id, { actor: MCP_ACTOR, ...o })
    return { sent_to: r.message.to_email, message_id: r.message.id, status: r.quote.status, link: quoteLink(r.quote) }
  }))

  server.registerTool('convert_quote_to_purchase', {
    title: 'Convert a quote to a purchase',
    description: 'Records an order from a sent/accepted quote (once per quote).',
    inputSchema: { id: z.number() },
  }, run(async a => { const after = await content.convertQuoteToPurchase(a.id); await audit({ actor: MCP_ACTOR, action: 'create', entity: 'purchase', entityId: after.id, after }); return after }))

  /* ------------------------------------------------------ email (Resend) */

  server.registerTool('send_email', {
    title: 'Send an email',
    description: 'One-to-one email to a client or enquirer, sent from the configured address and logged under the client. Not for bulk mail.',
    inputSchema: {
      to: z.string().describe('Recipient address'),
      subject: z.string(),
      body: z.string().describe('Plain text; wrapped in the brand template with the signature from Settings'),
      client_id: z.number().optional().describe('Logs the message on this client'),
      enquiry_id: z.number().optional().describe('Reply to a website enquiry; moves it out of "new"'),
      attachment_ids: z.array(z.number()).optional().describe('Document ids to attach'),
    },
  }, run(async a => {
    let toName = ''
    if (a.client_id) toName = (await content.getClient(a.client_id))?.name || ''
    if (a.enquiry_id && !toName) toName = (await content.getEnquiry(a.enquiry_id))?.name || ''
    const m = await deliver({ actor: MCP_ACTOR, to: a.to, toName, subject: a.subject, body: a.body, attachmentIds: a.attachment_ids || [], clientId: a.client_id ?? null, enquiryId: a.enquiry_id ?? null })
    return { id: m.id, status: m.status, to: m.to_email, provider_id: m.provider_id }
  }))

  server.registerTool('list_messages', {
    title: 'List emails',
    description: 'Emails sent to and received from clients. direction "in" = received (inbox), "out" = sent; unread lists only unread received mail.',
    inputSchema: { client_id: z.number().optional(), quote_id: z.number().optional(), enquiry_id: z.number().optional(), direction: z.enum(['in', 'out', 'all']).optional(), unread: z.boolean().optional(), q: z.string().optional().describe('Search subject / addresses') },
  }, run(a => content.listMessages(a)))

  server.registerTool('get_message', {
    title: 'Get an email',
    description: 'One sent or received email in full (body, attachments, links to client / quote / enquiry).',
    inputSchema: { id: z.number() },
  }, run(async a => { const m = await content.getMessage(a.id); if (!m) throw new Error(`no message with id ${a.id}`); return m }))

  server.registerTool('mark_message_read', {
    title: 'Mark a received email read or unread',
    inputSchema: { id: z.number(), read: z.boolean().optional().describe('default true') },
  }, run(async a => { const m = await content.getMessage(a.id); if (!m) throw new Error(`no message with id ${a.id}`); return content.markMessageRead(a.id, a.read !== false) }))

  /* ----------------------------------------------------- email templates */

  server.registerTool('list_email_templates', {
    title: 'List email templates',
    description: 'The editable templates behind quotes, enquiry replies, staff invitations and team notifications, with their placeholders.',
    inputSchema: {},
  }, run(async () => Promise.all(TEMPLATE_KEYS.map(templateFor))))

  server.registerTool('update_email_template', {
    title: 'Update an email template',
    description: 'Change the subject, body or button text of a template. Placeholders use {{name}}; optional blocks use {{#if name}}…{{/if}}.',
    inputSchema: { key: z.enum(TEMPLATE_KEYS), subject: z.string().optional(), body: z.string().optional(), cta_label: z.string().optional(), enabled: z.boolean().optional() },
  }, run(async ({ key, ...patch }) => {
    const before = await templateFor(key)
    const after = await content.upsertTemplate({ key, name: before.name, description: before.description, subject: patch.subject ?? before.subject, body: patch.body ?? before.body, cta_label: patch.cta_label ?? before.cta_label, enabled: patch.enabled ?? before.enabled, variables: before.variables })
    await audit({ actor: MCP_ACTOR, action: 'update', entity: 'email_template', entityId: key, before, after })
    return after
  }))

  /* ---------------------------------------------------------- purchases */

  const purchaseShape = {
    client_id: z.number().optional(), quote_id: z.number().optional(),
    description: z.string(), reference: z.string().optional().describe('PO or invoice number'),
    currency: z.string().optional(), amount: z.number().optional(),
    status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']).optional(),
    purchased_at: z.string().optional().describe('YYYY-MM-DD'), notes: z.string().optional(),
  }
  server.registerTool('list_purchases', {
    title: 'List purchases',
    inputSchema: { client_id: z.number().optional(), status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'all']).optional() },
  }, run(a => content.listPurchases(a)))

  server.registerTool('create_purchase', {
    title: 'Record a purchase',
    inputSchema: purchaseShape,
  }, run(async a => { const after = await content.createPurchase(a); await audit({ actor: MCP_ACTOR, action: 'create', entity: 'purchase', entityId: after.id, after }); return after }))

  server.registerTool('update_purchase', {
    title: 'Update a purchase',
    description: 'Move an order through pending → paid → shipped → delivered, or cancel it.',
    inputSchema: { id: z.number(), ...Object.fromEntries(Object.entries(purchaseShape).map(([k, v]) => [k, v.optional()])) },
  }, run(async ({ id, ...patch }) => { const before = await content.getPurchase(id); const after = await content.updatePurchase(id, patch); await audit({ actor: MCP_ACTOR, action: 'update', entity: 'purchase', entityId: id, before, after }); return after }))

  /* ----------------------------------------------------------- settings */

  const EDITABLE_GROUPS = ['site', 'company', 'quotes', 'email']
  server.registerTool('get_settings', {
    title: 'Get site settings',
    description: 'Site identity and contact details, company block for quotes, quote defaults, email sender.',
    inputSchema: {},
  }, run(async () => { const s = await content.getSettings(); return Object.fromEntries(EDITABLE_GROUPS.map(g => [g, s[g]])) }))

  server.registerTool('update_settings', {
    title: 'Update site settings',
    description: 'Change values in one or more groups: site, company, quotes, email. Pass only the keys to change.',
    inputSchema: { site: z.record(z.any()).optional(), company: z.record(z.any()).optional(), quotes: z.record(z.any()).optional(), email: z.record(z.any()).optional() },
  }, run(async a => {
    const patch = Object.fromEntries(Object.entries(a).filter(([g, v]) => EDITABLE_GROUPS.includes(g) && v))
    if (!Object.keys(patch).length) throw new Error('nothing to update')
    const before = await content.getSettings()
    const after = await content.updateSettings(patch)
    await audit({ actor: MCP_ACTOR, action: 'update', entity: 'settings', entityId: Object.keys(patch).join(','), before: Object.fromEntries(Object.keys(patch).map(g => [g, before[g]])), after: Object.fromEntries(Object.keys(patch).map(g => [g, after[g]])) })
    return Object.fromEntries(Object.keys(patch).map(g => [g, after[g]]))
  }))

  return server
}
