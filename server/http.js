/* Small helpers shared by the route files. */

/** A problem the caller may be told about (400 unless another status is given). */
export const bad = (message, status = 400) => Object.assign(new Error(message), { expose: true, status })

/** async handler wrapper: known input errors -> their status, anything else -> 500 (logged, not leaked) */
export const handler = tag => fn => async (req, res) => {
  try { await fn(req, res) }
  catch (e) {
    if (e.expose) return res.status(e.status || 400).json({ error: e.message, ...(e.message_id ? { message_id: e.message_id } : {}), ...(typeof e.code === 'string' && /^[a-z_]+$/.test(e.code) ? { code: e.code } : {}) })
    console.error(`[${tag}]`, req.method, req.path, e.message)
    res.status(500).json({ error: 'Something went wrong on our side.' })
  }
}

export const idOrNull = v => (v == null || v === '' ? null : Number(v))
export const isEmail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim())
export const clientIp = req => req.ip || req.socket?.remoteAddress || 'unknown'

/**
 * Small in-memory throttle, one bucket per name. Enough to stop naive
 * floods; a real deployment behind a proxy should also rate-limit there.
 */
const buckets = new Map()
// THROTTLE_SCALE multiplies every limit: a local test run makes dozens of calls from one address.
const SCALE = Math.max(1, Number(process.env.THROTTLE_SCALE) || 1)
export function throttled(name, key, limit = 5, windowMs = 10 * 60 * 1000) {
  limit *= SCALE
  let hits = buckets.get(name); if (!hits) { hits = new Map(); buckets.set(name, hits) }
  const now = Date.now()
  const list = (hits.get(key) || []).filter(t => now - t < windowMs)
  list.push(now); hits.set(key, list)
  if (hits.size > 5000) hits.clear()   // crude bound on memory
  return list.length > limit
}
