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
  const server = new McpServer({ name: 'vertoc-agro-content', version: '1.0.0' })

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

  return server
}
