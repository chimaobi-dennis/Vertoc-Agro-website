/*
 * Cloudflare Turnstile server-side verification.
 *
 * The browser widget only produces a token; it proves nothing until the token
 * is exchanged with Cloudflare here, from the server, using the secret key.
 * A client-side check is not spam protection — anything the browser can decide,
 * a bot can skip by posting straight to this endpoint.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export async function verifyTurnstile(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY

  if (!secret) {
    // Local development without keys. Never allowed once a secret is set,
    // and index.js refuses to start in production without one.
    return { ok: true, skipped: true, reason: 'no TURNSTILE_SECRET_KEY set (dev)' }
  }
  if (!token) return { ok: false, reason: 'missing captcha token' }

  const body = new URLSearchParams({ secret, response: token })
  if (remoteip) body.set('remoteip', remoteip)

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json()
    return data.success
      ? { ok: true }
      : { ok: false, reason: (data['error-codes'] || []).join(', ') || 'captcha rejected' }
  } catch (e) {
    return { ok: false, reason: `captcha verification unavailable: ${e.message}` }
  }
}
