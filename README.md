# Vertoc Agro

The vertocagro.com site, recovered from the medo.dev builder as editable source,
plus a small backend so products and blog posts can be managed by chatting with
Claude.

## Layout

```
vertoc-app/
├── index.html            Vite entry, fonts, pre-paint theme script
├── tailwind.config.js    Design tokens recovered from the original build
├── src/
│   ├── App.jsx           Routes
│   ├── index.css         Light/dark CSS variables
│   ├── components/       Header, Footer, MobileMenu, ProductCard, StatCounter…
│   ├── pages/            One component per route
│   └── lib/              nav config, theme hook, API client
├── public/assets/img/    35 images, all local — no CDN dependency
└── server/
    ├── db.js             SQLite schema
    ├── content.js        The content core (shared by REST + MCP)
    ├── mcp.js            MCP tool definitions
    ├── mcp-stdio.js      stdio transport (Claude Desktop)
    ├── index.js          REST API + MCP over HTTP
    └── seed-data.js      Your recovered content
```

## Running it

Two processes. Backend first:

```bash
cd server && npm install && npm run seed && npm start   # :8787
```

Then the site (Vite proxies `/api` to the backend automatically):

```bash
npm install && npm run dev                              # :5173
```

`npm run seed` is safe to re-run — it updates existing entries by slug rather
than duplicating them.

> Node prints an "SQLite is experimental" warning on start. It is only a
> warning; `node:sqlite` is built in and needs no native compilation.

## Managing content by chatting with Claude

Ten tools are exposed: `list/get/create/update/delete` for both `product` and
`post`. Both transports serve the same tools from the same content core, so it
does not matter which one you use.

### Claude Desktop (local — simplest, works immediately)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vertoc-agro": {
      "command": "node",
      "args": ["/Users/igsoftwebstudio/Documents/IGSOFT Web/vertoc-app/server/mcp-stdio.js"]
    }
  }
}
```

Restart Claude Desktop, then just talk to it:

- "Add a product: Shea Butter, unrefined Grade A, MOQ 5 tonnes, from Niger State"
- "Write a blog post about the 2026 sesame harvest and publish it"
- "Change the cocoa MOQ to 20 tonnes and mark it featured"

### claude.ai (remote — works from any device, including mobile)

Needs the backend deployed behind public HTTPS. Set a token first:

```bash
export VERTOC_MCP_TOKEN="$(openssl rand -hex 32)"
npm start
```

Then in Claude → Settings → Connectors → Add custom connector, point it at
`https://your-domain.com/mcp` with that bearer token.

**The token is the only thing standing between the open internet and write
access to your site — do not deploy without setting it.** With no token set the
endpoint accepts unauthenticated writes, which is fine on localhost and unsafe
anywhere else.

## Database (Supabase)

The store is pluggable. With no Supabase credentials it uses a local SQLite
file, so development needs no network and no keys. Set both variables below and
it switches to hosted Postgres — the server prints which store is active on
boot.

**Setup**

1. **Run the schema.** Supabase dashboard → SQL Editor → New query → paste
   `server/migrations/001_init.sql` → Run.
2. **Get the key.** Project Settings → API → `service_role` key.
3. **Put it in `server/.env`** (copy from `server/.env.example`):

   ```
   SUPABASE_URL=https://qeogredokbndssfrcjmo.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

4. **Migrate the content:** `cd server && npm run seed`

> **The `service_role` key bypasses Row Level Security completely.** It belongs
> only in `server/.env`, never in a `VITE_*` variable — Vite inlines those into
> the browser bundle, so shipping it there hands every visitor full read/write
> access to the database. The frontend never talks to Supabase directly; it
> only calls this backend.

RLS is enabled on all three tables by the migration. The policies allow the
public `anon` key to read *published* products and posts only, and to read no
enquiries at all — so even a leaked anon key cannot expose customer details.

## Admin panel

Lives at `/staff360` (formerly `/staff360`; old links redirect), code-split so public visitors never download it. Accounts
are **invite-only** — there is no signup page.

The visual language every admin screen follows is documented in
`src/admin/DESIGN.md` — read it before adding a screen.

### Roles

| Role | Can manage |
|---|---|
| `admin` | everything, including users and the audit log |
| `editor` | products and blog posts |
| `sales` | clients, documents, quotes, purchases and email |

Roles are checked **server-side on every request**, re-read from the profile
each time — changing someone's role or deactivating them takes effect on their
very next request, with no re-login. The frontend only hides menus.

### Setup (once)

1. **Run `server/migrations/002_admin.sql`** in the Supabase SQL editor
   (profiles, roles, audit log, media bucket).
2. **Anon key → frontend.** Supabase → Settings → API → `anon` `public` key,
   into `.env` as `VITE_SUPABASE_ANON_KEY`. This key is public by design and
   is only used to sign in; all data still goes through the backend.
3. **Auth URLs.** Supabase → Authentication → URL Configuration:
   - Site URL: your deployed origin, e.g. `https://vertoc-agromain.vercel.app`
   - Redirect URLs: add `<origin>/staff360/set-password` for every origin you
     use (production and `http://localhost:5173`). Invite links land there.
4. **`ADMIN_URL`** in `server/.env` / Vercel: the same origin, used to build
   invite links.
5. **First admin** — from your machine, so the password never leaves it:

   ```bash
   node server/create-admin.js you@example.com 'a-strong-password' 'Your Name'
   ```

   Every further user is invited from the panel (Users → Invite).

> Invite emails go through Supabase's built-in mailer, which is rate-limited
> to a few per hour — fine for a small team. Client email goes through Resend
> (see Phase 3 below).

### Guards worth knowing

- You cannot remove your own admin access, and the last active admin cannot
  be demoted or deactivated — so the panel can never lock everyone out.
- Every change — by a person in the panel or by Claude through MCP — writes
  an audit row with before/after. Admins see it under Audit log.
- Product, post, logo and favicon images upload to the public `media` bucket
  via the backend (8 MB cap, images only). Client documents go to the
  **private** `documents` bucket on a signed upload URL issued per file
  (20 MB cap) and are read only through signed links that expire in an hour.

### Clients and enquiries (Phase 2)

- **Clients** (`/staff360/clients`) — admin and `sales`. The table columns, the
  form and the exports all follow the fields you define under **Fields**
  (`/staff360/clients/fields`): add, reorder, rename, mark required, choose which
  appear in the table. Values are validated server-side against those
  definitions — required, email, number, date, URL, select options. CSV and
  PDF download the current filtered view; the PDF library loads only on click.
- **Enquiries** (`/staff360/enquiries`) — quote requests and contact messages on
  separate tabs, each with its own pipeline: quotes move new → contacted →
  quoted → won or lost; messages new → replied; either can be archived. Each
  enquiry carries internal notes and can be linked to a client or spawn one.
  Deleting a client unlinks its enquiries rather than deleting them.
- Claude has the same reach through MCP: `list_client_fields`, `list_clients`,
  `get_client`, `create_client`, `update_client`, `update_enquiry`.
- Needs `server/migrations/003_clients_quotes.sql` (seeds seven starting
  fields). Supabase-only; the SQLite dev fallback stubs these features.

### Documents, quotes, email, purchases, settings (Phase 3)

Needs `server/migrations/004_documents_quotes_messages.sql`. The client
record becomes a hub — **Profile · Documents · Quotes · Messages ·
Purchases** — and the site's own identity moves out of the code.

- **Documents** — drop PDF, Word, Excel, PowerPoint, CSV, text or images on a
  client (20 MB each). Files go straight from the browser to the private
  `documents` bucket on a one-time signed upload URL, then the backend
  confirms the object exists before the record is marked ready. Every read is
  a signed link that expires in an hour; the public anon key can read nothing.
  Client and quote fields gain two types, **Image** and **File**, whose values
  are verified references to uploaded documents.
- **Quotes** (`/staff360/quotes`) — a builder with line items, discount, tax,
  notes, terms, internal notes and **your own quote fields** (Incoterm, port,
  payment terms… managed under Quotes → Fields, same engine as client
  fields). Numbers are `VQ-YYYY-NNNN` from an atomic per-year counter. The PDF
  is rendered server-side, so the preview, the attachment and the client's
  download are the same file. **Send to client** emails the PDF with a unique
  link `/q/<token>` (24 random bytes) where the client can read, download and
  **Accept** or **Decline** online; opening the link flips sent → viewed, and
  an accepted quote locks its prices. Statuses: draft → sent → viewed →
  accepted | declined, or expired past *Valid until*. **Convert to purchase**
  turns it into an order once.
- **Email** — one-to-one only, through [Resend](https://resend.com). Compose
  from a client (Send email), a quote (Send to client) or an enquiry (Reply by
  email — the enquiry leaves *new* on its own). Plain text goes inside the
  brand template with the signature from Settings; attachments come from the
  client's documents. Every send is logged under **Messages** with Resend's
  answer — including the reason when it fails (an unverified domain, say) —
  so nothing is silently lost.
- **Purchases** — manual entries or converted quotes, moving pending → paid →
  shipped → delivered (or cancelled), with a lifetime total per currency on the
  client.
- **Settings** (`/staff360/settings`, admins) — *Site*: name, tagline, logo,
  favicon, contact details, hours, social links (the public site reads these
  live from `/api/site`, with the old hard-coded values as fallback). *Company*:
  the block printed on quotes. *Quotes*: default currency, validity, terms and
  the payment instructions printed on every quote. *Email*: sender, reply-to,
  signature, and the Resend API key — stored encrypted (AES-256-GCM under a
  key derived from the service-role key), write-only, shown as "ends with
  ····abcd". *MCP & API*: switch the endpoint on or off and generate or revoke
  a Claude access token; only its SHA-256 hash is stored, and it is shown once.
- Claude gets the same reach through MCP (35 tools): documents, quotes
  (`create_quote`, `send_quote`, `convert_quote_to_purchase`…), `send_email`,
  purchases and `get_settings` / `update_settings`.

Environment for this phase (server side, never `VITE_`):

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | optional if the key is saved in Settings → Email (the panel key wins) |
| `SITE_URL` | public origin used in quote links and emails; falls back to `ADMIN_URL` |
| `EMAIL_DRY_RUN=1` | log messages as sent without calling Resend — local testing only |
| `RESEND_WEBHOOK_SECRET` | optional if saved in Settings → Email → Inbound; verifies `email.received` webhooks |

Resend only delivers from a **verified domain**. Until `vertocagro.com` has its
DNS records added at resend.com → Domains, set the From address to
`Vertoc Agro <onboarding@resend.dev>`; Resend then delivers only to the account
owner's own address.

### Email templates, inbound email, staff panel URL (Phase 4)

Needs `server/migrations/005_templates_inbound.sql`.

- **Email templates** (`/staff360/templates`, admins) — every email the panel
  sends starts from an editable template: quotation to client, reply to an
  enquiry, email to a client, staff invitation, and two team notifications
  (quote answered, email received). Subject and body are plain text with
  `{{placeholders}}` and optional `{{#if var}}…{{/if}}` blocks; the editor
  shows the placeholders, a live preview with sample data, and a reset to the
  built-in default. Compose screens are pre-filled from the rendered template
  and remain editable before sending; a disabled template starts them empty
  and switches its notification off.
- **Staff invitations** are now sent by the panel through Resend using the
  "Staff invitation" template, with the set-password link generated from
  Supabase (`generateLink`). Without a Resend key the previous Supabase
  mailer is used, so invites always work.
- **Inbound email** — Resend can receive mail for your domain and POST an
  `email.received` event to `/api/webhooks/resend`. The handler verifies the
  Svix signature (secret from Settings → Email or `RESEND_WEBHOOK_SECRET`),
  fetches the body and attachments from Resend, files the email under the
  client whose email matches the sender, links it to a quote when the subject
  carries a quote number or the sender was last emailed about one, stores the
  attachments in the private `documents` bucket, and notifies the team. It
  appears in **Messages** (`/staff360/messages`, with unread badge) and on the
  client's Messages tab, where it can be answered in place. Retries are
  idempotent. Setup: enable *Receiving* on a domain in Resend and add the MX
  record it shows — use a subdomain such as `reply.vertocagro.com` so the
  existing `sales@` mailbox keeps working — then add a webhook for
  `email.received` pointing at the URL shown in Settings, paste its signing
  secret there, and set the *Inbound address* so replies are routed to it.
- The staff panel moved from `/admin` to **`/staff360`**; old links and
  already-sent invite emails redirect. Update the Supabase redirect URL to
  `<origin>/staff360/set-password`.
- MCP: `list_email_templates`, `update_email_template`, `get_message`,
  `mark_message_read`; `list_messages` filters by direction and unread.

### Testing

With the backend running and steps 1–2 done:

```bash
node server/test-admin.mjs
```

Creates a throwaway admin, signs in the way the browser does, exercises every
admin route including the role and lock-out guards, the signed document
upload, the quote lifecycle and the public accept flow, and removes everything
it made — even on failure. It **never emails anyone**: the send steps run only
when the backend was started with `EMAIL_DRY_RUN=1`; otherwise they are
reported as skipped.

## Security

Hardened after a live audit of the public repo and Vercel deployment. What is
in place, and why:

- **Secrets never ship.** `service_role`, the Turnstile secret and the MCP
  token exist only in `server/.env` (local) and Vercel's environment. Nothing
  secret is in git history or the served bundle — the only key in the bundle
  is the Turnstile *site* key, which is public by design.
- **MCP write endpoint** is bearer-token gated, compared with
  `crypto.timingSafeEqual` so response timing cannot leak partial matches.
- **CORS is an allowlist**, not `*`. Same-origin needs nothing; the Vite dev
  server is allowed in development; `ALLOWED_ORIGINS` extends it if ever needed.
- **Internal errors are not returned to clients.** They are logged server-side
  and a generic message is sent, so database schema details cannot leak.
- **Headers** (`vercel.json`): `frame-ancestors 'self'` + `X-Frame-Options`
  against clickjacking, `X-Content-Type-Options: nosniff`, a strict
  `Referrer-Policy`, `Permissions-Policy` denying device APIs, and
  `Cache-Control: no-store` on `/api` and `/mcp`. `X-Powered-By` is disabled.
- **Row Level Security** is enabled on all tables; the public `anon` key can
  read published content only and cannot read enquiries at all.
- **Dependencies:** `qs` is overridden to a patched version — Express pins a
  vulnerable range that `npm audit fix` will not cross on its own.

**Recommended follow-up:** a full `Content-Security-Policy` with `script-src`.
It is deliberately not set yet, because `index.html` carries an inline theme
script and Turnstile injects its own; a strict policy must be tested against
both before it is safe to deploy.

## Spam protection (Cloudflare Turnstile)

The original site used a canvas captcha generated and checked in the browser,
which is not protection — the answer lives in client JavaScript, and a bot can
post straight past it. It is replaced with Turnstile, verified **server-side**.

1. Cloudflare dashboard → Turnstile → Add site → copy both keys.
2. Frontend: put the **site key** in `.env` at the project root:
   `VITE_TURNSTILE_SITE_KEY=0x...`
3. Backend: export the **secret key** where the server runs:
   `export TURNSTILE_SECRET_KEY=0x...`

With no keys set, forms stay usable locally and submissions are accepted
unverified. `NODE_ENV=production` without `TURNSTILE_SECRET_KEY` refuses to
start, so the public form can never silently run unprotected.

Submissions are stored in the `enquiries` table and readable through the MCP
tools — ask Claude "any new enquiries?". Defence layers, in order: hidden
honeypot field, format validation, per-IP throttle (5 per 10 min), then
Turnstile.

## Deploying to Vercel

The frontend builds to static files; `api/index.js` exposes the same Express
app as a serverless function. `vercel.json` routes `/api/*` and `/mcp` to that
function and rewrites everything else to `index.html` so deep links work.

**Supabase is required in production.** Serverless filesystems are ephemeral
and not shared between invocations, so the SQLite fallback would appear to work
and then silently discard every write. `server/store/index.js` refuses to start
rather than let that happen.

### Environment variables

Set these in Vercel → Project → Settings → Environment Variables. `server/.env`
is local-only and is never deployed.

| Variable | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://qeogredokbndssfrcjmo.supabase.co` | runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | runtime, secret |
| `TURNSTILE_SECRET_KEY` | Turnstile secret | runtime, secret — **required**, Vercel sets `NODE_ENV=production` |
| `VERTOC_MCP_TOKEN` | `openssl rand -hex 32` | runtime, secret — **required**, `/mcp` is now publicly reachable |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key | **build-time** |
| `VITE_API_BASE` | leave empty | same origin as the site |

`VITE_*` values are read when the bundle is built, so changing one needs a
redeploy, not just a restart.

### First deploy

```bash
npm i -g vercel
vercel link
vercel --prod
```

Then run `server/migrations/001_init.sql` in the Supabase SQL editor and seed
Postgres once from your machine:

```bash
cd server && npm run seed     # with SUPABASE_* set in server/.env
```

### Your MCP endpoint becomes public

Deploying gives you the HTTPS URL that claude.ai custom connectors need:
`https://<your-app>.vercel.app/mcp`, using `VERTOC_MCP_TOKEN` as the bearer
token. That is what unlocks managing content from your phone rather than only
from Claude Desktop.

### One caveat

The per-IP throttle on the enquiry form is in-memory, so on serverless it only
applies within a warm instance and resets on cold starts. Turnstile is the real
protection; treat the throttle as a speed bump. If you want a hard limit, move
it into Postgres or put Cloudflare rate limiting in front.

## Deploying

The frontend is static (`npm run build` → `dist/`) and can go on any host. The
backend needs a Node process and a persistent disk for `server/data/content.db`.
Point the frontend at the deployed API with `VITE_API_BASE` at build time.

Because it is a single-page app, configure the host to rewrite unknown paths to
`index.html`, or deep links like `/products/cocoa` will 404 on refresh.
