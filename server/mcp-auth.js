/*
 * Bearer-token gate for the MCP endpoint.
 *
 * Two tokens are accepted: VERTOC_MCP_TOKEN from the environment, and the
 * one generated under Settings → MCP, which is stored only as a SHA-256
 * hash. The settings row is cached for 15 s so a chatty connector does not
 * hit the database on every call; token changes from the panel call
 * refreshMcpSettings() so they apply at once.
 *
 * In production, no token at all means the endpoint is CLOSED — never open.
 */
import { timingSafeEqual } from 'node:crypto'
import * as content from './content.js'
import { sha256 } from './secrets.js'

const TOKEN = process.env.VERTOC_MCP_TOKEN || ''
const PROD = process.env.NODE_ENV === 'production'

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

let cache = { at: 0, value: null }
export function refreshMcpSettings() { cache = { at: 0, value: null } }

async function mcpSettings() {
  if (cache.value !== null && Date.now() - cache.at < 15000) return cache.value
  let value = null
  try { value = (await content.getSettings()).mcp } catch { value = null }   // no settings table yet: env-only
  cache = { at: Date.now(), value }
  return value
}

export async function authorised(req) {
  const cfg = await mcpSettings()
  if (cfg && cfg.enabled === false) return false
  const hash = cfg?.token_hash || ''
  if (!TOKEN && !hash) return !PROD                 // local dev only
  const h = req.get('authorization') || ''
  if (!h.startsWith('Bearer ')) return false
  const given = h.slice(7)
  // Constant-time compares so response timing can't leak how many leading
  // bytes of a guessed token were correct.
  if (TOKEN && safeEqual(given, TOKEN)) return true
  if (hash && safeEqual(sha256(given), hash)) return true
  return false
}
