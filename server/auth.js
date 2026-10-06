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
import { BUILT_IN_ROLES, LEGACY_ROLE, MODULES, actionFor, cleanPermissions, hasUser } from './permissions.js'

let clientPromise = null
function serviceClient() {
  if (!clientPromise) clientPromise = import('./store/supabase.js').then(m => m.supabase)
  return clientPromise
}

const deny = (res, code, error) => res.status(code).json({ error })
// supabase-js marks network/5xx failures as retryable; 401/403 mean the token itself is bad.
const isUpstream = e => e?.name === 'AuthRetryableFetchError' || (typeof e?.status === 'number' && e.status >= 500) || /fetch failed|ECONN|ETIMEDOUT|socket/i.test(String(e?.message))

export async function authenticate(req, res, next) {
  if (driver !== 'supabase') {
    return deny(res, 503, 'Admin features require Supabase. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  const h = req.get('authorization') || ''
  if (!h.startsWith('Bearer ')) return deny(res, 401, 'Sign in required.')

  try {
    const supabase = await serviceClient()
    // A bad token is the caller's problem (401). A hiccup reaching the auth
    // server is not: retry once, then say so (503) instead of signing them out.
    let result = await supabase.auth.getUser(h.slice(7))
    if (result.error && isUpstream(result.error)) { await new Promise(r => setTimeout(r, 400)); result = await supabase.auth.getUser(h.slice(7)) }
    if (result.error && isUpstream(result.error)) return deny(res, 503, 'The sign-in service is unavailable right now. Please try again in a moment.')
    const user = result.data?.user
    if (result.error || !user) return deny(res, 401, 'Session expired. Please sign in again.')

    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()

    if (!profile) return deny(res, 403, 'No profile for this account. Ask an admin to enable it.')
    if (!profile.active) return deny(res, 403, 'This account has been deactivated.')

    const { key, perms, custom } = await effectivePermissions(supabase, profile)
    req.user = { id: profile.id, email: profile.email || user.email, name: profile.name, role: profile.role, role_key: key, perms, custom_permissions: custom, position: profile.position || '', staff_id: profile.staff_id || '', phone: profile.phone || '', department: profile.department || '', avatar_url: profile.avatar_url || '', reports_to: profile.reports_to || null }
    next()
  } catch (e) {
    console.error('[auth]', e.message)
    deny(res, 500, 'Authentication failed.')
  }
}

/**
 * A staff member's role key and permissions. Their own set wins over the
 * role's; a custom role comes from staff_roles; before migration 015 (no
 * role_key column) the old enum decides.
 */
const roleCache = new Map()   // custom role key -> { at, permissions }
export const forgetRole = key => (key ? roleCache.delete(key) : roleCache.clear())
export async function effectivePermissions(supabase, profile) {
  const key = profile.role_key || LEGACY_ROLE[profile.role] || 'editor'
  if (profile.permissions && typeof profile.permissions === 'object') return { key, perms: cleanPermissions(profile.permissions), custom: true }
  if (BUILT_IN_ROLES[key]) return { key, perms: BUILT_IN_ROLES[key].permissions, custom: false }
  const hit = roleCache.get(key)
  if (hit && Date.now() - hit.at < 30000) return { key, perms: hit.permissions, custom: false }
  const { data } = await supabase.from('staff_roles').select('permissions').eq('key', key).maybeSingle()
  const permissions = cleanPermissions(data?.permissions)   // an unknown role can do nothing
  roleCache.set(key, { at: Date.now(), permissions })
  return { key, perms: permissions, custom: false }
}

/**
 * Route guard: the signed-in staff member needs `action` in `module`.
 * Without an action it follows the request: reading needs view, POST
 * create, PUT/PATCH edit, DELETE delete. Always stack after authenticate.
 */
export const can = (module, action = null) => (req, res, next) => {
  const need = action || actionFor(req.method, module)
  return hasUser(req.user, module, need) ? next() : deny(res, 403, `You don't have permission for this (${MODULES[module]?.label || module}: ${need}).`)
}
/** Any one of several modules will do (shared screens such as documents). */
export const canAny = (...modules) => (req, res, next) =>
  modules.some(m => hasUser(req.user, m, actionFor(req.method, m))) ? next() : deny(res, 403, "You don't have permission for this.")
/** Inside a handler: throw 403 unless allowed. */
export function demand(req, module, action = 'view') {
  if (!hasUser(req.user, module, action)) throw Object.assign(new Error(`You don't have permission for this (${MODULES[module]?.label || module}: ${action}).`), { expose: true, status: 403 })
}
