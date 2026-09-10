/*
 * Admin authentication and authorisation.
 *
 * The browser signs in with Supabase Auth directly and sends the resulting
 * access token as a bearer. This middleware validates that token with
 * Supabase, loads the user's profile, and attaches { id, email, name, role }
 * to the request. Role checks happen HERE, on every request — the frontend
 * hides menus by role purely as a convenience and is never trusted.
 *
 * Admin features require Supabase; there is no SQLite equivalent for auth.
 */
import { driver } from './store/index.js'

let clientPromise = null
function serviceClient() {
  if (!clientPromise) clientPromise = import('./store/supabase.js').then(m => m.supabase)
  return clientPromise
}

const deny = (res, code, error) => res.status(code).json({ error })

export async function authenticate(req, res, next) {
  if (driver !== 'supabase') {
    return deny(res, 503, 'Admin features require Supabase. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  const h = req.get('authorization') || ''
  if (!h.startsWith('Bearer ')) return deny(res, 401, 'Sign in required.')

  try {
    const supabase = await serviceClient()
    const { data: { user }, error } = await supabase.auth.getUser(h.slice(7))
    if (error || !user) return deny(res, 401, 'Session expired. Please sign in again.')

    const { data: profile } = await supabase
      .from('profiles').select('id, email, name, role, active').eq('id', user.id).maybeSingle()

    if (!profile) return deny(res, 403, 'No profile for this account. Ask an admin to enable it.')
    if (!profile.active) return deny(res, 403, 'This account has been deactivated.')

    req.user = { id: profile.id, email: profile.email || user.email, name: profile.name, role: profile.role }
    next()
  } catch (e) {
    console.error('[auth]', e.message)
    deny(res, 500, 'Authentication failed.')
  }
}

/** Route guard: allow only the listed roles. Always stack after authenticate. */
export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : deny(res, 403, `This action requires role: ${roles.join(' or ')}.`)

/** Permission matrix, kept in one place so the frontend can mirror it. */
export const PERMISSIONS = {
  products: ['admin', 'editor'],
  posts:    ['admin', 'editor'],
  users:    ['admin'],
  audit:    ['admin'],
  clients:  ['admin', 'sales'],
  quotes:   ['admin', 'sales'],
  email:    ['admin', 'sales'],
  settings: ['admin'],
}
