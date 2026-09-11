/*
 * Vertoc Agro backend — the Express app itself.
 *
 * Exported without calling listen() so it can be used two ways:
 *   server/index.js  -> long-running process for local development
 *   api/index.js     -> serverless handler on Vercel
 *
 *   /api/*  — read-only JSON the website consumes
 *   /mcp    — Streamable HTTP MCP endpoint for claude.ai custom connectors
 *
 * The MCP endpoint can create, edit and delete content, so it is protected by
 * a bearer token: VERTOC_MCP_TOKEN in the environment, or a token generated
 * under Settings → MCP (stored as a hash). Either must be set before exposing
 * this to the internet.
 */
import './load-env.js'
import express from 'express'
import cors from 'cors'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { buildServer } from './mcp.js'
import * as content from './content.js'
import { verifyTurnstile } from './verify-turnstile.js'
import adminRouter from './admin-routes.js'
import { driver } from './store/index.js'
import { renderQuotePdf } from './quote-pdf.js'
import { authorised } from './mcp-auth.js'
import { verifySvix, ingestReceived } from './inbound.js'
import { resolveResendKey, resolveWebhookSecret, notifyTeam, dryRun, panelLink } from './messaging.js'
import { audit } from './audit.js'

const PORT = process.env.PORT || 8787
const PROD = process.env.NODE_ENV === 'production'

// Throw rather than process.exit: on a serverless platform exit() kills the
// runtime with an opaque crash, while a thrown error is reported in the logs.
if (PROD && !process.env.TURNSTILE_SECRET_KEY) {
  throw new Error(
    'TURNSTILE_SECRET_KEY is required in production — without it the public ' +
    'enquiry form would accept unverified submissions.'
  )
}

const app = express()
app.disable('x-powered-by')

// The site and its API share an origin, and the MCP client (claude.ai) calls
// server-to-server, so no cross-origin browser access is needed in production.
// Only the Vite dev server needs it. ALLOWED_ORIGINS can extend the list.
const devOrigins = PROD ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']
const allowed = new Set([...devOrigins, ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)])
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
  methods: ['GET', 'POST', 'OPTIONS'],
}))
// The image upload route parses its own (larger) body; skip it here so the
// 2 MB global limit doesn't reject uploads before they reach it.
app.use(express.json({
  limit: '2mb',
  type: req => req.path !== '/api/admin/upload' && /json/i.test(req.get('content-type') || ''),
  // The Resend webhook signature covers the exact bytes received.
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8') },
}))

// Small in-memory throttle. Enough to stop naive floods; a real deployment
// behind a proxy should also rate-limit at that layer.
const hits = new Map()
function throttled(ip, limit = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter(t => now - t < windowMs)
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) hits.clear() // crude bound on memory
  return list.length > limit
}

/* ------------------------------------------------------ public read API */

// The store is async (the Supabase driver is promise-based), so this must
// await before serialising — otherwise every response is an empty object.
const send = async (res, fn) => {
  try {
    const data = await fn()
    if (data === null || data === undefined) {
      return res.status(404).json({ error: 'not found' })
    }
    res.json(data)
  } catch (e) {
    console.error('[api]', e.message)
    res.status(500).json({ error: 'Something went wrong on our side.' })
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.get('/api/products', (req, res) =>
  send(res, () => content.listProducts({ status: req.query.status || 'published' })))
app.get('/api/products/:slug', (req, res) =>
  send(res, () => content.getProduct(req.params.slug)))
app.get('/api/posts', (req, res) =>
  send(res, () => content.listPosts({ status: req.query.status || 'published' })))
app.get('/api/posts/:slug', (req, res) =>
  send(res, () => content.getPost(req.params.slug)))

// Site identity and contact details, edited under Settings → Site.
app.get('/api/site', (_req, res) =>
  send(res, async () => (await content.getSettings()).site))

/* ------------------------------------------------ public quote links --- */
// /q/<token> in the browser calls these. The token is the only credential:
// 24 random bytes, so the link is unguessable; nothing internal is exposed.

async function liveQuote(token) {
  const q = await content.getQuoteByToken(token)
  return q && q.status !== 'draft' ? q : null
}
const quoteView = async q => {
  const [settings, fields] = await Promise.all([content.getSettings(), content.listQuoteFields()])
  return { view: content.publicQuote(q, settings, fields), settings, fields }
}

app.get('/api/q/:token', (req, res) => send(res, async () => {
  let q = await liveQuote(req.params.token)
  if (!q) return null
  if (q.status === 'sent') q = await content.markQuoteViewed(q.id)
  return (await quoteView(q)).view
}))

app.get('/api/q/:token/pdf', async (req, res) => {
  try {
    const q = await liveQuote(req.params.token)
    if (!q) return res.status(404).json({ error: 'not found' })
    const { settings, fields } = await quoteView(q)
    const link = `${(process.env.SITE_URL || process.env.ADMIN_URL || '').replace(/\/$/, '')}/q/${q.token}`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${q.number}.pdf"`)
    res.send(renderQuotePdf(q, settings, fields, link))
  } catch (e) {
    console.error('[quote-pdf]', e.message)
    res.status(500).json({ error: 'Something went wrong on our side.' })
  }
})

app.post('/api/q/:token/respond', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  if (throttled(ip, 10)) return res.status(429).json({ error: 'Too many attempts. Please try again later.' })
  try {
    const q = await content.respondToQuote(req.params.token, req.body?.action, req.body?.note)
    if (!q) return res.status(404).json({ error: 'not found' })
    await audit({ actor: { id: null, label: 'client' }, action: q.status, entity: 'quote', entityId: q.id, after: { number: q.number, note: q.response_note } })
    res.json((await quoteView(q)).view)
    notifyTeam('quote_response', { quote: q, link: panelLink(`/quotes/${q.id}`) })
  } catch (e) {
    // respondToQuote's messages are written for the client to read.
    res.status(409).json({ error: e.message })
  }
})

/* ----------------------------------------------------------- admin API */

app.use('/api/admin', adminRouter)

/* --------------------------------------------------- enquiry submission */

const isEmail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim())
const clean = (v, max = 2000) => String(v ?? '').trim().slice(0, max)

app.post('/api/enquiries', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const b = req.body || {}

  // 1. Honeypot: a real person never fills a hidden field.
  if (clean(b.website)) return res.status(202).json({ ok: true })

  // 2. Basic validation before spending a captcha call.
  const name = clean(b.name, 120)
  const email = clean(b.email, 200)
  if (!name) return res.status(400).json({ error: 'Please enter your name.' })
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' })

  // 3. Throttle.
  if (throttled(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' })
  }

  // 4. Captcha, verified server-side.
  const captcha = await verifyTurnstile(b.captchaToken, ip)
  if (!captcha.ok) {
    return res.status(400).json({ error: 'Captcha verification failed. Please try again.' })
  }

  try {
    const saved = content.createEnquiry({
      kind: b.kind === 'quote' ? 'quote' : 'contact',
      name,
      email,
      phone: clean(b.phone, 60),
      subject: clean(b.subject, 200),
      message: clean(b.message, 5000),
      commodity: clean(b.commodity, 200),
      quantity: clean(b.quantity, 120),
      destination: clean(b.destination, 200),
    })
    res.status(201).json({ ok: true, id: saved.id })
  } catch (e) {
    console.error('[enquiries]', e.message)
    res.status(500).json({ error: 'Could not save your message. Please try again.' })
  }
})

/* ------------------------------------------------- inbound email webhook */
// Resend POSTs `email.received` here. The signature is checked against the
// secret from Settings → Email (or RESEND_WEBHOOK_SECRET); the body and
// attachments are then fetched from Resend and filed under the client.
app.post('/api/webhooks/resend', async (req, res) => {
  try {
    const { secret } = await resolveWebhookSecret()
    if (!secret) return res.status(503).json({ error: 'Inbound email is not set up: add the webhook signing secret under Settings → Email.' })
    if (!verifySvix(req.rawBody || '', req.headers, secret)) return res.status(401).json({ error: 'Invalid signature.' })
    const ev = req.body || {}
    if (ev.type !== 'email.received') return res.json({ ignored: ev.type || 'unknown' })
    const { key } = await resolveResendKey()
    const { message, created } = await ingestReceived(ev.data, { apiKey: key, dryRun: dryRun() })
    res.json({ ok: true, id: message.id, created })
    if (created) notifyTeam('inbound_notice', { message, link: panelLink(`/messages/${message.id}`) })
  } catch (e) {
    console.error('[inbound]', e.message)
    // 5xx makes Resend retry later rather than drop the email.
    if (!res.headersSent) res.status(500).json({ error: 'Could not store the received email.' })
  }
})

/* ------------------------------------------------- MCP over HTTP (write) */

app.all('/mcp', async (req, res) => {
  if (!(await authorised(req))) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: null,
    })
  }

  // Stateless: a fresh server + transport per request keeps this safe to run
  // behind any load balancer without sticky sessions.
  const server = buildServer()
  // Stateless: no session id, so each request is fully self-contained and
  // safe behind any load balancer without sticky sessions.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  res.on('close', () => {
    transport.close?.()
    server.close?.()
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: e.message },
        id: null,
      })
    }
  }
})

export default app
