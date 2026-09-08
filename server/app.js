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
 * a bearer token. Set VERTOC_MCP_TOKEN before exposing this to the internet.
 */
import './load-env.js'
import { timingSafeEqual } from 'node:crypto'
import express from 'express'
import cors from 'cors'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { buildServer } from './mcp.js'
import * as content from './content.js'
import { verifyTurnstile } from './verify-turnstile.js'
import { driver } from './store/index.js'

const PORT = process.env.PORT || 8787
const TOKEN = process.env.VERTOC_MCP_TOKEN || ''
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
app.use(express.json({ limit: '2mb' }))

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

/* --------------------------------------------------- enquiry submission */

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

/* ------------------------------------------------- MCP over HTTP (write) */

function authorised(req) {
  if (!TOKEN) return true // local dev: no token configured
  const h = req.get('authorization') || ''
  if (!h.startsWith('Bearer ')) return false
  // Constant-time compare so response timing can't leak how many leading
  // bytes of a guessed token were correct.
  const given = Buffer.from(h.slice(7))
  const want = Buffer.from(TOKEN)
  return given.length === want.length && timingSafeEqual(given, want)
}

app.all('/mcp', async (req, res) => {
  if (!authorised(req)) {
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
