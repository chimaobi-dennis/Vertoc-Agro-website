/*
 * Secrets that admins may set from the panel (e.g. the Resend API key).
 *
 * Stored in the `settings` table under key 'secrets', encrypted with
 * AES-256-GCM. The encryption key is derived (HKDF) from the service role
 * key, which the server already holds and which never leaves it. So a copy
 * of the database alone cannot reveal these values; the panel never reads
 * them back either — it only ever sees a "configured, ends with ····abcd".
 *
 * Environment variables remain the recommended home for secrets; this is
 * the convenience path for the non-technical owner.
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'

function material() {
  const seed = process.env.SECRETS_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!seed) throw new Error('No key material to encrypt settings secrets (SUPABASE_SERVICE_ROLE_KEY unset)')
  return Buffer.from(hkdfSync('sha256', seed, 'vertoc-settings', 'secrets-v1', 32))
}

/** @returns {{v:1, iv:string, ct:string, tag:string, hint:string, set_at:string}} */
export function encryptSecret(plain) {
  const value = String(plain)
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', material(), iv)
  const ct = Buffer.concat([c.update(value, 'utf8'), c.final()])
  return { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: c.getAuthTag().toString('base64'), hint: value.slice(-4), set_at: new Date().toISOString() }
}

/** Returns the plaintext, or null when absent or unreadable (key rotated). */
export function decryptSecret(rec) {
  if (!rec || rec.v !== 1) return null
  try {
    const d = createDecipheriv('aes-256-gcm', material(), Buffer.from(rec.iv, 'base64'))
    d.setAuthTag(Buffer.from(rec.tag, 'base64'))
    return Buffer.concat([d.update(Buffer.from(rec.ct, 'base64')), d.final()]).toString('utf8')
  } catch { return null }
}

export const sha256 = s => createHash('sha256').update(String(s)).digest('hex')
export const newToken = (bytes = 32) => randomBytes(bytes).toString('hex')
