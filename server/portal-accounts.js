/*
 * Accounts for the client and investor portals: register, confirm the
 * email address from a one-time link, ask for and use a password link, and
 * work out who a request comes from. (The supplier portal has the same
 * flow in supplier-routes.js.)
 *
 * People sign in with Supabase Auth in the browser and send the access
 * token as a bearer. They are checked against their own table — never
 * `profiles` — so a portal account can reach nothing in the staff panel.
 */
import * as content from './content.js'
import { audit } from './audit.js'
import { verifyTurnstile } from './verify-turnstile.js'
import { bad, isEmail, clientIp, throttled } from './http.js'
import { sendAccountLink } from './messaging.js'

let svc = null
const supabase = () => svc ??= import('./store/supabase.js').then(m => m.supabase)
const clean = (v, max = 2000) => String(v ?? '').trim().slice(0, max)
const isUpstream = e => e?.name === 'AuthRetryableFetchError' || (typeof e?.status === 'number' && e.status >= 500) || /fetch failed|ECONN|ETIMEDOUT|socket/i.test(String(e?.message))
const PASSWORD_RULE = 'Choose a password of at least 8 characters.'
const okPassword = p => typeof p === 'string' && p.length >= 8 && p.length <= 72

/**
 * @param {object} o
 * @param {'client'|'investor'} o.kind      also the portal's path on the site (/client, /investor)
 * @param {'clients'|'investors'} o.table
 * @param {(body, userId) => Promise<{row, existing:boolean}>} o.create   make (or attach to) the record
 * @param {(row, existing) => Promise<void>} o.undo                       take it back if the email cannot be sent
 * @param {(row) => string} o.nameOf
 * @param {(row) => string|null} o.blocked                                why the account may not be used, or null
 * @param {(row) => Promise<void>} [o.onVerified]
 */
export function portalAccounts({ kind, table, create, undo, nameOf, blocked, onVerified }) {
  const ACTOR = { id: null, label: kind }
  const link = (row, purpose, token) => sendAccountLink({ portal: kind, kind: purpose, token, email: row.email, name: nameOf(row), clientId: kind === 'client' ? row.id : null })

  /** The account behind a bearer token, or 401/403. */
  async function who(req) {
    const hdr = req.get('authorization') || ''
    if (!hdr.startsWith('Bearer ')) throw bad('Sign in required.', 401)
    const sb = await supabase()
    let r = await sb.auth.getUser(hdr.slice(7))
    if (r.error && isUpstream(r.error)) { await new Promise(x => setTimeout(x, 400)); r = await sb.auth.getUser(hdr.slice(7)) }
    if (r.error && isUpstream(r.error)) throw bad('The sign-in service is unavailable right now. Please try again in a moment.', 503)
    const user = r.data?.user
    if (r.error || !user) throw bad('Your session has expired. Please sign in again.', 401)
    const row = await content.accountByUser(table, user.id)
    if (!row) throw bad(`This account is not ${kind === 'investor' ? 'an investor' : 'a client'} account.`, 403)
    const why = blocked(row); if (why) throw bad(why, 403)
    if (!row.verified_at && !user.email_confirmed_at) throw Object.assign(bad('Please confirm your email address first: use the link we emailed you.', 403), { code: 'unverified' })
    return row
  }

  /** Create the Supabase login for a record staff made, with the password the person just chose. */
  async function createInvitedLogin(sb, row, password) {
    const { data, error } = await sb.auth.admin.createUser({ email: row.email, password, email_confirm: true, user_metadata: { account_type: kind, name: clean(nameOf(row), 120) } })
    if (error) {
      if (/already|registered|exists/i.test(error.message)) throw bad('A login already exists for this email address. Use "Forgot password" on the sign-in page.', 409)
      if (/password/i.test(error.message)) throw bad(error.message)
      throw new Error(`invite: ${error.message}`)
    }
    await sb.from('profiles').delete().eq('id', data.user.id).eq('active', false).then(() => {}, () => {})   // never a staff profile
    try { await content.attachAccountUser(table, row.id, data.user.id) } catch (e) { await sb.auth.admin.deleteUser(data.user.id).catch(() => {}); throw e }
    return data.user.id
  }

  /** Staff invite the person behind a record: a seven-day link to choose a password. Throws if the email cannot be sent. */
  async function invite(row, email) {
    if (row.user_id && row.verified_at) throw bad('This person already has a login. Send a password link instead.', 409)
    const to = email || row.email
    const rec = to && to.toLowerCase() !== String(row.email || '').toLowerCase() ? await content.setAccountEmail(table, row.id, to) : row
    if (!isEmail(rec.email)) throw bad('Add an email address first: the invitation is sent there.')
    // An unconfirmed self-registration already has a login: let them confirm it; otherwise they choose a password.
    if (rec.user_id) { await link(rec, 'verify', await content.issueAccountToken(table, rec.id, 'verify', 24)); return { kind: 'verify', email: rec.email } }
    await link(rec, 'invite', await content.issueAccountToken(table, rec.id, 'invite', 168))
    return { kind: 'invite', email: rec.email }
  }

  function mount(router, h) {
    const p = `/${kind}`
    router.post(`${p}/register`, h(async (req, res) => {
      const ip = clientIp(req), b = req.body || {}
      if (clean(b.website)) return res.status(202).json({ ok: true })   // honeypot
      const email = clean(b.email, 200).toLowerCase()
      if (!isEmail(email)) throw bad('Please enter a valid email address.')
      if (!okPassword(b.password)) throw bad(PASSWORD_RULE)
      if (throttled(`${kind}-register`, ip, 5)) throw bad('Too many attempts. Please try again later.', 429)
      const captcha = await verifyTurnstile(b.captchaToken, ip)
      if (!captcha.ok) throw bad('Captcha verification failed. Please try again.')
      const taken = () => bad('An account already exists for this email address. Sign in, or use "Forgot password" to choose a new password.', 409)
      if ((await content.accountByEmail(table, email))?.user_id) throw taken()

      const sb = await supabase()
      const { data, error } = await sb.auth.admin.createUser({ email, password: b.password, email_confirm: false, user_metadata: { account_type: kind, name: clean(b.contact_person || b.name, 120) } })
      if (error) {
        if (/already|registered|exists/i.test(error.message)) throw taken()
        if (/password/i.test(error.message)) throw bad(error.message)
        throw new Error(`register: ${error.message}`)
      }
      const user = data.user
      await sb.from('profiles').delete().eq('id', user.id).eq('active', false).then(() => {}, () => {})   // never a staff profile
      let made = null
      try {
        made = await create({ ...b, email }, user.id)
        await link(made.row, 'verify', await content.issueAccountToken(table, made.row.id, 'verify', 24))
      } catch (e) {
        await sb.auth.admin.deleteUser(user.id).catch(() => {})
        if (made) await undo(made.row, made.existing).catch(() => {})
        if (e.expose && e.status !== 502 && e.status !== 503) throw e          // a problem with what they entered
        console.error(`[${kind}-register]`, e.message)
        throw bad('We could not send the confirmation email just now. Please try again in a few minutes.', 503)
      }
      await audit({ actor: ACTOR, action: 'register', entity: kind, entityId: made.row.id, after: { name: nameOf(made.row), email } })
      res.status(201).json({ ok: true, email })
    }))

    router.post(`${p}/verify`, h(async (req, res) => {
      if (throttled(`${kind}-verify`, clientIp(req), 20)) throw bad('Too many attempts. Please try again later.', 429)
      const row = await content.accountForToken(table, req.body?.token, 'verify', { consume: true })
      if (!row || !row.user_id) throw bad('This confirmation link is no longer valid. Ask for a new one from the sign-in page.', 410)
      const { error } = await (await supabase()).auth.admin.updateUserById(row.user_id, { email_confirm: true })
      if (error) throw new Error(`verify: ${error.message}`)
      await content.markAccountVerified(table, row.id)
      await onVerified?.(row)
      await audit({ actor: ACTOR, action: 'verify', entity: kind, entityId: row.id, after: { email: row.email } })
      res.json({ ok: true, email: row.email })
    }))

    // These two always answer the same way, whether or not the address has an account.
    const quietly = fn => h(async (req, res) => {
      const email = clean(req.body?.email, 200).toLowerCase()
      if (!isEmail(email)) throw bad('Please enter a valid email address.')
      if (throttled(`${kind}-link`, clientIp(req), 5) || throttled(`${kind}-link-to`, email, 3, 30 * 60 * 1000)) throw bad('Too many attempts. Please try again later.', 429)
      try { const row = await content.accountByEmail(table, email); if (row?.user_id && !blocked(row)) await fn(row) } catch (e) { console.error(`[${kind}-link]`, e.message) }
      res.json({ ok: true })
    })
    router.post(`${p}/resend`, quietly(async row => { if (!row.verified_at) await link(row, 'verify', await content.issueAccountToken(table, row.id, 'verify', 24)) }))
    router.post(`${p}/forgot`, quietly(async row => link(row, 'reset', await content.issueAccountToken(table, row.id, 'reset', 2))))
    router.post(`${p}/reset`, h(async (req, res) => {
      if (throttled(`${kind}-reset`, clientIp(req), 10)) throw bad('Too many attempts. Please try again later.', 429)
      if (!okPassword(req.body?.password)) throw bad(PASSWORD_RULE)
      // 'invite' links come from staff who made the record: the login does not exist until the person chooses a password.
      const row = await content.accountForToken(table, req.body?.token, ['reset', 'invite'])
      if (!row || (!row.user_id && row.auth_token_kind !== 'invite')) throw bad('This link is no longer valid. Ask for a new one from the sign-in page.', 410)
      const sb = await supabase()
      let userId = row.user_id
      if (!userId) userId = await createInvitedLogin(sb, row, req.body.password)
      else {
        const { error } = await sb.auth.admin.updateUserById(userId, { password: req.body.password, email_confirm: true })
        if (error) throw (/password/i.test(error.message) ? bad(error.message) : new Error(`reset: ${error.message}`))
      }
      await content.clearAccountToken(table, row.id)
      if (!row.verified_at) { await content.markAccountVerified(table, row.id); await onVerified?.(row) }
      await audit({ actor: ACTOR, action: row.user_id ? 'password_reset' : 'accept_invite', entity: kind, entityId: row.id, after: { email: row.email } })
      res.json({ ok: true, email: row.email })
    }))
    // Change the password while signed in: the current one is asked again.
    router.post(`${p}/password`, h(async (req, res) => {
      const row = await who(req)
      if (!okPassword(req.body?.password)) throw bad(PASSWORD_RULE)
      if (throttled(`${kind}-password`, String(row.id), 8)) throw bad('Too many attempts. Please try again later.', 429)
      const { createClient } = await import('@supabase/supabase-js')
      const probe = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
      const { error: wrong } = await probe.auth.signInWithPassword({ email: row.email, password: String(req.body?.current || '') })
      if (wrong) throw bad('Your current password is not right.')
      const { error } = await (await supabase()).auth.admin.updateUserById(row.user_id, { password: req.body.password })
      if (error) throw (/password/i.test(error.message) ? bad(error.message) : new Error(`password: ${error.message}`))
      await audit({ actor: ACTOR, action: 'password_change', entity: kind, entityId: row.id, after: { email: row.email } })
      res.json({ ok: true })
    }))
    router.get(`${p}/notifications`, h(async (req, res) => res.json(await content.listNotifications(kind, (await who(req)).id))))
    router.post(`${p}/notifications/read`, h(async (req, res) => res.json(await content.readNotifications(kind, (await who(req)).id, req.body?.ids || null))))
  }
  return { who, mount, invite, ACTOR }
}

/** Start and finish a file upload for a portal user: metadata here, bytes straight to storage. */
export async function startDoc(scope, body, { limit = null, count = null } = {}) {
  if (limit != null && count != null && count >= limit) throw bad(`Up to ${limit} files can be added here.`)
  const friendly = e => (/^(createDocument|completeDocument)/.test(e.message) ? e : bad(e.message))
  const r = await content.createDocument({ ...scope, name: body?.name, content_type: body?.content_type, bytes: body?.bytes }, null).catch(e => { throw friendly(e) })
  return { document: { id: r.document.id, name: r.document.name, label: r.document.label || '' }, upload: r.upload }
}
export async function finishDoc(docId, owns) {
  const d = await content.getDocument(docId, { any: true })
  if (!d || !owns(d)) throw bad('document not found', 404)
  const doc = await content.completeDocument(d.id).catch(e => { throw (/^completeDocument/.test(e.message) ? e : bad(e.message)) })
  return { id: doc.id, name: doc.name, label: doc.label || '', bytes: doc.bytes, content_type: doc.content_type, created_at: doc.created_at, _row: doc }
}
export const docView = d => ({ id: d.id, name: d.name, label: d.label || '', bytes: d.bytes, content_type: d.content_type, created_at: d.created_at })
