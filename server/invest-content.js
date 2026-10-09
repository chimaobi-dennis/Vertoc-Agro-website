/*
 * The /invest section as managed content (migration 022).
 *
 * Every page is a small tree of fields described by a schema here. The schema
 * is the single source of truth: it validates what is saved, and the panel's
 * editor is drawn from it. Pages have a draft and a live version; only an
 * Admin publishes, and every change is kept in a history.
 */
import { Router } from 'express'
import express from 'express'
import { can } from './auth.js'
import { audit } from './audit.js'
import { bad, handler } from './http.js'
import { hasUser } from './permissions.js'

let svc = null
const supabase = () => (svc ??= import('./store/supabase.js').then(m => m.supabase))
const missing = e => ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(e?.code)
const HINT = 'This needs the database migration 022: run server/migrations/022_invest_content.sql in the Supabase SQL editor first.'
const tt = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const tx = (s, max) => String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)

/* ------------------------------------------------------------- schema --- */
export const ICONS = ['ShieldCheck', 'Sprout', 'FileCheck2', 'BarChart3', 'Wallet', 'Clock', 'Handshake', 'Leaf', 'TrendingUp', 'Lock', 'Users', 'Globe', 'Truck', 'Award', 'BadgeCheck', 'Landmark']
const text = (key, label, max = 200, o = {}) => ({ key, label, type: 'text', max, ...o })
const area = (key, label, max = 4000, o = {}) => ({ key, label, type: 'textarea', max, ...o })
const image = (key, label, o = {}) => ({ key, label, type: 'image', ...o })
const link = (key, label, o = {}) => ({ key, label, type: 'link', ...o })
const icon = (key = 'icon', label = 'Icon') => ({ key, label, type: 'select', options: ICONS })
const list = (key, label, item, max = 20, o = {}) => ({ key, label, type: 'list', item, max, ...o })
const group = (key, label, fields, o = {}) => ({ key, label, type: 'group', fields, ...o })

const SECTIONS = list('sections', 'Sections', [text('heading', 'Heading', 160), area('body', 'Text', 8000)], 40, { hint: 'Each has a heading and a text. Hide one to take it off the page without losing it.' })

export const PAGES = {
  landing: {
    label: 'Landing page', path: '/invest', visible: true, hint: 'The first page investors see.',
    fields: [
      group('banner', 'Banner', [
        text('badge', 'Small heading above the title', 60), text('title', 'Title', 160, { required: true }), area('text', 'Subtitle', 800),
        image('image', 'Banner picture (optional background)'),
        text('primary_label', 'Main button: label', 60), link('primary_link', 'Main button: link'),
        text('secondary_label', 'Second button: label', 60), link('secondary_link', 'Second button: link'),
      ]),
      text('steps_title', 'Steps: heading', 120),
      list('steps', 'Steps', [icon(), image('image', 'Picture instead of the icon (optional)'), text('title', 'Title', 120), area('text', 'Text', 500)], 8),
      text('faq_title', 'Questions: heading', 120),
      list('faqs', 'Frequently asked questions', [text('q', 'Question', 200), area('a', 'Answer', 2000)], 30),
      group('cta', 'Closing call to action', [text('title', 'Title', 120), area('text', 'Text', 400), text('button_label', 'Button: label', 60), link('button_link', 'Button: link')]),
      area('notice', 'Notice at the bottom (risk warning)', 1500),
      list('footer_links', 'Links at the bottom', [text('label', 'Label', 80), link('link', 'Link')], 8),
    ],
  },
  register: {
    label: 'Sign-in and registration texts', path: '/investor/register', visible: true, hint: 'The words on the investor sign-in and registration pages.',
    fields: [
      text('eyebrow', 'Small heading', 60), text('login_text', 'Sign-in page: text', 300),
      text('register_title', 'Registration page: title', 120), area('register_text', 'Registration page: introduction', 800), area('register_note', 'Registration page: note under the form', 600),
      text('terms_label', 'Terms link: label', 120), link('terms_link', 'Terms link: destination'),
    ],
  },
  terms: {
    label: 'Terms and conditions', path: '/invest/terms', visible: false, hint: 'Investment terms, eligibility, risk disclosure and disclaimers. Hidden until you publish it.',
    fields: [
      text('title', 'Page title', 160, { required: true }), area('intro', 'Introduction', 2000), text('updated_label', 'Last updated (text)', 80),
      list('eligibility', 'Eligibility criteria', [text('text', 'Criterion', 400)], 20),
      SECTIONS,
      text('risk_title', 'Risk disclosure: heading', 120), area('risk_text', 'Risk disclosure: text', 6000),
      text('disclaimer_title', 'Disclaimer: heading', 120), area('disclaimer_text', 'Disclaimer: text', 6000),
    ],
  },
  portal: {
    label: 'Investor portal texts', path: '/investor', visible: true, hint: 'Buttons and notices inside the investor portal.',
    fields: [
      area('risk_notice', 'Risk notice (under opportunities)', 1500),
      text('view_button', 'Opportunity card button (open for investing)', 60), text('details_button', 'Opportunity card button (closed)', 60), text('apply_button', 'Apply button', 60),
      area('payment_note', 'Note under the Apply button', 600),
      text('agree_prefix', 'Agreement: starts with', 80), text('agree_suffix', 'Agreement: ends with', 300), text('agree_fallback', 'Agreement when an opportunity has no documents', 300),
      text('docs_title', 'Heading above the documents to read', 80),
      text('empty_title', 'No open opportunities: title', 120), area('empty_text', 'No open opportunities: text', 400),
    ],
  },
  custom: {
    label: 'Extra page', path: '/invest/p/…', visible: false, hint: 'A page you added: shown at /invest/p/ followed by its address.',
    fields: [
      text('title', 'Page title', 160, { required: true }), area('intro', 'Introduction', 2000), image('image', 'Picture (optional)'), SECTIONS,
      text('button_label', 'Button: label', 60), link('button_link', 'Button: link'),
    ],
  },
}
export const FIXED_KEYS = ['landing', 'register', 'terms', 'portal']
const CUSTOM_RE = /^page-[a-z0-9]+(-[a-z0-9]+)*$/
const pageOf = key => (PAGES[key] ? { ...PAGES[key], key } : CUSTOM_RE.test(key) ? { ...PAGES.custom, key, custom: true } : null)

/* ------------------------------------------------------------ defaults --- */
const RISK = 'Investing puts your money at risk. Expected returns are estimates, not guarantees, and you may get back less than you put in. Opportunities are shown to registered investors only. Read the terms of each opportunity and take independent advice if you are unsure.'
export const DEFAULTS = {
  landing: {
    banner: { badge: 'Investment portal', title: 'Invest in agricultural trade with Vertoc Agro', text: 'Fund real commodity cycles, sourced from Nigerian farms and delivered to buyers we already work with. Each opportunity has a stated minimum, tenor and expected return, and you follow your money from the first day to maturity.', image: '', primary_label: 'Register as an investor', primary_link: '/investor/register', secondary_label: 'Investor sign-in', secondary_link: '/investor/login' },
    steps_title: 'How it works',
    steps: [
      { icon: 'ShieldCheck', image: '', title: 'Register and verify', text: 'Open an investor account, confirm your email address and upload your identification. We verify every investor.' },
      { icon: 'Sprout', image: '', title: 'Choose an opportunity', text: 'Each opportunity states its minimum amount, its tenor and the return we expect. Read the terms and apply for the amount you choose.' },
      { icon: 'FileCheck2', image: '', title: 'Fund and get approved', text: 'Our team reviews your application and sends the payment details. Your investment starts once your payment is confirmed.' },
      { icon: 'BarChart3', image: '', title: 'Follow it to maturity', text: 'Your dashboard shows the status, the maturity date, the returns paid and the full history of every investment.' },
    ],
    faq_title: 'Frequently asked questions',
    faqs: [
      { q: 'How do I start?', a: 'Register as an investor, confirm your email address, and upload your means of identification. Once your identity is verified your applications can be approved.' },
      { q: 'Are returns guaranteed?', a: 'No. Returns are expected, not guaranteed, and you may get back less than you put in. Read the terms of each opportunity before you apply.' },
      { q: 'When does my investment start?', a: 'After you apply, our team reviews the application and sends the payment details. The investment starts once your payment is confirmed.' },
    ],
    cta: { title: 'Ready to invest?', text: 'Create your investor account to see the opportunities open now.', button_label: 'Register as an investor', button_link: '/investor/register' },
    notice: RISK,
    footer_links: [{ label: 'Investor terms and conditions', link: '/invest/terms' }],
  },
  register: {
    eyebrow: 'Investment portal', login_text: 'See the opportunities open to you and follow your investments.',
    register_title: 'Register as an investor',
    register_text: 'An account lets you see our investment opportunities, apply to them and follow each investment to maturity. We verify your identity before an investment is approved.',
    register_note: 'After signing in you can upload your means of identification. Your bank details are used only to pay your returns and principal.',
    terms_label: 'Read the investor terms and conditions', terms_link: '/invest/terms',
  },
  terms: {
    title: 'Investor terms and conditions', intro: '', updated_label: '', eligibility: [],
    sections: [], risk_title: 'Risk disclosure', risk_text: RISK, disclaimer_title: 'Disclaimer', disclaimer_text: '',
  },
  portal: {
    risk_notice: 'Investing puts your money at risk. Expected returns are estimates, not guarantees, and you may get back less than you put in. Read the terms of each opportunity and take independent advice if you are unsure.',
    view_button: 'View and invest', details_button: 'View details', apply_button: 'Apply to invest',
    payment_note: 'Your application goes to our team for approval. We then send you the payment details; the investment starts once your payment is confirmed.',
    agree_prefix: 'I have read the', agree_suffix: 'and accept these terms. I understand that returns are expected, not guaranteed.',
    agree_fallback: 'I have read the terms of this opportunity and understand that returns are expected, not guaranteed.',
    docs_title: 'Read before you apply',
    empty_title: 'No open opportunities right now', empty_text: 'New opportunities are published here as they become available. We will notify you.',
  },
  custom: { title: '', intro: '', image: '', sections: [], button_label: '', button_link: '' },
}
const defaultFor = key => structuredClone(PAGES[key] ? DEFAULTS[key] : DEFAULTS.custom)

/* ---------------------------------------------------------- validation --- */
const okLink = v => !v || /^(\/(?!\/)|https:\/\/|mailto:|tel:)/.test(v)
function cleanFields(fields, input, path = '') {
  const src = input && typeof input === 'object' ? input : {}
  const out = {}
  for (const f of fields) {
    const v = src[f.key], where = `${path}${f.label}`
    switch (f.type) {
      case 'text': out[f.key] = tt(v, f.max); break
      case 'textarea': out[f.key] = tx(v, f.max); break
      case 'image': { const s = tt(v, 500); if (s && !/^(\/(?!\/)|https:\/\/)/.test(s)) throw bad(`${where}: use an uploaded picture or an https:// address.`); out[f.key] = s; break }
      case 'link': { const s = tt(v, 500); if (!okLink(s)) throw bad(`${where}: a link starts with / (this site) or https://.`); out[f.key] = s; break }
      case 'select': out[f.key] = f.options.includes(v) ? v : f.options[0]; break
      case 'group': out[f.key] = cleanFields(f.fields, v, `${where} → `); break
      case 'list': {
        const arr = Array.isArray(v) ? v : []
        if (arr.length > f.max) throw bad(`${where}: at most ${f.max} entries.`)
        out[f.key] = arr.map(it => ({ ...cleanFields(f.item, it, `${where} → `), ...(it?.hidden ? { hidden: true } : {}) }))
          .filter(it => f.item.some(sub => sub.type !== 'select' && sub.type !== 'image' && it[sub.key]))   // an entry with nothing typed is dropped
        break
      }
    }
    if (f.required && !out[f.key]) throw bad(`${where} is required.`)
  }
  return out
}
// Saved content over the built-in default: a field never set shows the default, a list is taken as saved.
const withDefaults = (key, saved) => (saved ? { ...defaultFor(key), ...saved } : defaultFor(key))

/** Hidden entries never reach the public site. */
function publicView(fields, data) {
  const out = {}
  for (const f of fields) {
    const v = data?.[f.key]
    if (f.type === 'group') out[f.key] = publicView(f.fields, v)
    else if (f.type === 'list') out[f.key] = (v || []).filter(it => !it.hidden).map(({ hidden, ...it }) => it)
    else out[f.key] = v
  }
  return out
}

/* ------------------------------------------------------------ storage --- */
async function rows() {
  const { data, error } = await (await supabase()).from('invest_content').select('*')
  if (error) { if (missing(error)) return null; throw new Error(`invest_content: ${error.message}`) }
  return data || []
}
const visibleOf = (key, row) => (row?.visible ?? (pageOf(key)?.visible ?? false))

/** Everything visitors may see: live versions of the visible pages, hidden entries removed. */
export async function publicContent(given = null) {
  const list = given || (await rows()) || []
  const out = {}
  const keys = [...FIXED_KEYS, ...list.filter(r => CUSTOM_RE.test(r.key)).map(r => r.key)]
  for (const key of keys) {
    const row = list.find(r => r.key === key), page = pageOf(key)
    if (!page || !visibleOf(key, row)) { out[key] = { visible: false }; continue }
    if (page.custom && !row?.live) { out[key] = { visible: false }; continue }   // an extra page exists once it has been published
    out[key] = { visible: true, title: row?.title || '', content: publicView(page.fields, withDefaults(key, row?.live)) }
  }
  return out
}
async function previewContent() {
  const list = (await rows()) || []
  const out = {}
  const keys = [...FIXED_KEYS, ...list.filter(r => CUSTOM_RE.test(r.key)).map(r => r.key)]
  for (const key of keys) { const row = list.find(r => r.key === key), page = pageOf(key); out[key] = { visible: true, title: row?.title || '', content: publicView(page.fields, withDefaults(key, row?.draft || row?.live)) } }
  return out
}

/* -------------------------------------------------------------- routes --- */
const router = Router()
const h = handler('admin')
const edit = can('investments', 'edit')
const admin = (req) => { if (!hasUser(req.user, 'staff', 'manage')) throw bad('Only an Admin can publish, hide or add pages.', 403) }
const who = req => req.user.name || req.user.email || 'staff'
async function row(key) {
  const { data, error } = await (await supabase()).from('invest_content').select('*').eq('key', key).maybeSingle()
  if (error) { if (missing(error)) throw Object.assign(new Error(HINT), { expose: true, status: 409 }); throw new Error(error.message) }
  return data
}
const history = async (req, key, action, snapshot, note = '') => (await supabase()).from('invest_content_history').insert({ key, action, snapshot: snapshot ?? null, note, by_id: req.user.id, by_name: who(req) })
const meta = (key, r) => {
  const p = pageOf(key)
  return { key, label: r?.title || p.label, path: p.custom ? `/invest/p/${key.slice(5)}` : p.path, hint: p.hint, custom: Boolean(p.custom), visible: visibleOf(key, r), published: Boolean(r?.live), has_draft: Boolean(r?.draft),
    updated_name: r?.updated_name || '', updated_at: r?.updated_at || null, published_name: r?.published_name || '', published_at: r?.published_at || null }
}

router.get('/invest-content', can('investments'), h(async (_req, res) => {
  const list = (await rows()) ?? []
  res.json({ ready: (await rows()) !== null, pages: [...FIXED_KEYS, ...list.filter(r => CUSTOM_RE.test(r.key)).map(r => r.key)].map(k => meta(k, list.find(r => r.key === k))) })
}))
router.get('/invest-preview', can('investments'), h(async (_req, res) => res.json(await previewContent())))
router.post('/invest-content/media', express.json({ limit: '12mb' }), edit, h(async (req, res) => {
  const { contentType, data } = req.body || {}
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'].includes(contentType)) throw bad('Use a JPEG, PNG, WebP, GIF, AVIF or SVG image.')
  const buffer = Buffer.from(String(data || '').replace(/^data:[^;]+;base64,/, ''), 'base64')
  if (!buffer.length) throw bad('No picture received.')
  if (buffer.length > 8 * 1024 * 1024) throw bad('The picture must be under 8 MB.')
  const sb = await supabase()
  const path = `invest/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${{ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg' }[contentType]}`
  const { error } = await sb.storage.from('media').upload(path, buffer, { contentType, upsert: false })
  if (error) throw new Error(error.message)
  const url = sb.storage.from('media').getPublicUrl(path).data.publicUrl
  await audit({ actor: req.user, action: 'upload', entity: 'invest_media', entityId: path, after: { url, bytes: buffer.length } })
  res.status(201).json({ url })
}))
router.post('/invest-content/pages', can('investments'), h(async (req, res) => {
  admin(req)
  const slug = tt(req.body?.slug, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const title = tt(req.body?.title, 160)
  if (!slug || !title) throw bad('Give the page a title and an address.')
  const key = `page-${slug}`
  if (!CUSTOM_RE.test(key) || FIXED_KEYS.includes(slug)) throw bad('That address cannot be used.')
  if (await row(key)) throw bad('A page with that address already exists.', 409)
  const draft = { ...defaultFor(key), title }
  const { error } = await (await supabase()).from('invest_content').insert({ key, title, draft, visible: false, updated_by: req.user.id, updated_name: who(req) })
  if (error) throw new Error(error.message)
  await history(req, key, 'create', draft)
  await audit({ actor: req.user, action: 'create', entity: 'invest_page', entityId: key, after: { title } })
  res.status(201).json(meta(key, await row(key)))
}))
router.get('/invest-content/:key', can('investments'), h(async (req, res) => {
  const page = pageOf(req.params.key)
  if (!page) throw bad('page not found', 404)
  const r = await row(page.key)
  res.json({ ...meta(page.key, r), fields: page.fields, content: withDefaults(page.key, r?.draft || r?.live), live: Boolean(r?.live) ? withDefaults(page.key, r.live) : null, defaults: defaultFor(page.key) })
}))
router.put('/invest-content/:key', edit, h(async (req, res) => {
  const page = pageOf(req.params.key)
  if (!page) throw bad('page not found', 404)
  const draft = cleanFields(page.fields, req.body?.content)
  const before = await row(page.key)
  const sb = await supabase()
  const patch = { draft, updated_by: req.user.id, updated_name: who(req), updated_at: new Date().toISOString() }
  const { error } = before ? await sb.from('invest_content').update(patch).eq('key', page.key) : await sb.from('invest_content').insert({ key: page.key, title: '', ...patch })
  if (error) throw new Error(error.message)
  await history(req, page.key, 'save_draft', draft)
  await audit({ actor: req.user, action: 'update', entity: 'invest_page', entityId: page.key, after: { draft: true } })
  res.json(meta(page.key, await row(page.key)))
}))
router.post('/invest-content/:key/publish', can('investments', 'edit'), h(async (req, res) => {
  admin(req)
  const page = pageOf(req.params.key); if (!page) throw bad('page not found', 404)
  const r = await row(page.key)
  const content = r?.draft || r?.live || defaultFor(page.key)
  const clean = cleanFields(page.fields, content)
  const patch = { live: clean, draft: null, published_by: req.user.id, published_name: who(req), published_at: new Date().toISOString(), updated_by: req.user.id, updated_name: who(req), updated_at: new Date().toISOString(), ...(r?.visible == null && !PAGES[page.key]?.visible ? { visible: true } : {}) }
  const sb = await supabase()
  const { error } = r ? await sb.from('invest_content').update(patch).eq('key', page.key) : await sb.from('invest_content').insert({ key: page.key, title: '', ...patch, visible: true })
  if (error) throw new Error(error.message)
  await history(req, page.key, 'publish', clean, req.body?.note || '')
  await audit({ actor: req.user, action: 'publish', entity: 'invest_page', entityId: page.key })
  res.json(meta(page.key, await row(page.key)))
}))
router.post('/invest-content/:key/discard', edit, h(async (req, res) => {
  const page = pageOf(req.params.key); if (!page) throw bad('page not found', 404)
  const r = await row(page.key)
  if (!r?.draft) throw bad('There is no unpublished draft.', 409)
  await (await supabase()).from('invest_content').update({ draft: null, updated_by: req.user.id, updated_name: who(req), updated_at: new Date().toISOString() }).eq('key', page.key)
  await history(req, page.key, 'discard_draft', r.draft)
  await audit({ actor: req.user, action: 'discard', entity: 'invest_page', entityId: page.key })
  res.json(meta(page.key, await row(page.key)))
}))
router.post('/invest-content/:key/visibility', can('investments', 'edit'), h(async (req, res) => {
  admin(req)
  const page = pageOf(req.params.key); if (!page) throw bad('page not found', 404)
  const visible = Boolean(req.body?.visible)
  const r = await row(page.key)
  if (visible && page.custom && !r?.live) throw bad('Publish the page before showing it.', 409)
  const sb = await supabase()
  const { error } = r ? await sb.from('invest_content').update({ visible, updated_by: req.user.id, updated_name: who(req), updated_at: new Date().toISOString() }).eq('key', page.key) : await sb.from('invest_content').insert({ key: page.key, title: '', visible, updated_by: req.user.id, updated_name: who(req) })
  if (error) throw new Error(error.message)
  await history(req, page.key, visible ? 'show' : 'hide', null)
  await audit({ actor: req.user, action: visible ? 'show' : 'hide', entity: 'invest_page', entityId: page.key })
  res.json(meta(page.key, await row(page.key)))
}))
router.get('/invest-content/:key/history', can('investments'), h(async (req, res) => {
  if (!pageOf(req.params.key)) throw bad('page not found', 404)
  const { data, error } = await (await supabase()).from('invest_content_history').select('id,action,note,by_name,at,snapshot').eq('key', req.params.key).order('at', { ascending: false }).limit(100)
  if (error) { if (missing(error)) return res.json([]); throw new Error(error.message) }
  res.json((data || []).map(({ snapshot, ...x }) => ({ ...x, has_snapshot: snapshot != null })))
}))
router.post('/invest-content/:key/restore', edit, h(async (req, res) => {
  const page = pageOf(req.params.key); if (!page) throw bad('page not found', 404)
  const { data } = await (await supabase()).from('invest_content_history').select('snapshot').eq('key', page.key).eq('id', Number(req.body?.history_id)).maybeSingle()
  if (!data?.snapshot) throw bad('That version cannot be loaded.', 404)
  const draft = cleanFields(page.fields, data.snapshot)
  const sb = await supabase(); const before = await row(page.key)
  const patch = { draft, updated_by: req.user.id, updated_name: who(req), updated_at: new Date().toISOString() }
  const { error } = before ? await sb.from('invest_content').update(patch).eq('key', page.key) : await sb.from('invest_content').insert({ key: page.key, title: '', ...patch })
  if (error) throw new Error(error.message)
  await history(req, page.key, 'restore', draft, `from version ${req.body.history_id}`)
  await audit({ actor: req.user, action: 'restore', entity: 'invest_page', entityId: page.key, after: { from: req.body.history_id } })
  res.json(meta(page.key, await row(page.key)))
}))

export default router
