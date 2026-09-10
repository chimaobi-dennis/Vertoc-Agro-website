/*
 * Outbound email through Resend.
 *
 * One function, one provider, no SDK: Resend's REST API is a single POST.
 * The API key comes from the panel's encrypted settings or RESEND_API_KEY
 * in the server environment — never the browser. The sender address
 * comes from the editable `email` settings row, so switching to Resend's
 * test sender while the domain is unverified needs no deploy.
 *
 * Errors are thrown as `expose`d so the panel shows Resend's real reason
 * (unverified domain, bad address) instead of a generic 500.
 */
const API = 'https://api.resend.com/emails'

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY)

const expose = (message, status = 502) => Object.assign(new Error(message), { expose: true, status })

function friendly(d) {
  const m = String(d?.message || 'Resend rejected the email.')
  if (/not verified/i.test(m)) {
    return `${m} Until the domain is verified, set the From address in Settings → Email to "Vertoc Agro <onboarding@resend.dev>" to test.`
  }
  return m
}

/**
 * @param {object} o
 * @param {string} [o.apiKey]  Resend key; falls back to RESEND_API_KEY
 * @param {string} o.from      "Name <addr>" — must be on a Resend-verified domain
 * @param {string} o.to
 * @param {string} [o.replyTo]
 * @param {string} o.subject
 * @param {string} o.text      plain-text body
 * @param {string} o.html
 * @param {{filename:string, content:Buffer}[]} [o.attachments]
 * @returns {Promise<{id:string}>}
 */
export async function sendEmail({ apiKey, from, to, replyTo, subject, text, html, attachments = [] }) {
  const key = apiKey || process.env.RESEND_API_KEY
  if (!key) throw expose('Email is not set up yet: add a Resend API key under Settings → Email.', 503)

  const payload = {
    from, to: [to], subject, text, html,
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(attachments.length ? { attachments: attachments.map(a => ({ filename: a.filename, content: a.content.toString('base64') })) } : {}),
  }
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw expose(friendly(d))
  return { id: d.id }
}

/* ------------------------------------------------------------ template --- */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const paragraphs = text => String(text ?? '').trim().split(/\n{2,}/)
  .map(p => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')

/**
 * Brand wrapper for a plain-text message: navy header, the text as
 * paragraphs, an optional call-to-action button, the signature, and a
 * company footer. Everything inline-styled — email clients ignore <style>.
 */
export function renderEmailHtml({ body, signature = '', company = {}, cta = null }) {
  const button = cta
    ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#7fbe37;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">${esc(cta.label)}</a></p>`
    : ''
  const sig = signature ? `<p style="margin:22px 0 0;color:#334155;white-space:pre-line">${esc(signature)}</p>` : ''
  const footer = [company.name, company.address, company.phone, company.website].filter(Boolean).map(esc).join(' · ')
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1ec;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e2d9">
<tr><td style="background:#001a4d;padding:20px 28px"><span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.2px">${esc(company.name || 'Vertoc Agro')}</span></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${paragraphs(body)}${button}${sig}</td></tr>
<tr><td style="padding:16px 28px;background:#faf8f5;border-top:1px solid #e7e2d9;font-size:12px;color:#64748b">${footer}</td></tr>
</table></td></tr></table></body></html>`
}
